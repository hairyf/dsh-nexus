import type { ToolDefinition, ToolRunContext } from '@deepseek-ai/dsh-tools'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import type { GitHubChannel } from '../channel/github/channel'
import type { NexusDatabase } from '../database'
import type { runtime } from '../service/runtime'
import type { Row } from '../types/ledger'
import { createHash } from 'node:crypto'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { LedgerError } from '../database'
import { checkInterrupt } from '../runtime/interrupt'
import { ledger } from '../service/ledger'
import { policy } from '../service/policy'

export function createManagementTools(database: NexusDatabase, run: ReturnType<typeof runtime.create>, github: GitHubChannel, binding: Row<'role_binding'>): ToolDefinition[] {
  async function caller(exec: ToolRunContext): Promise<{ kind: 'agent', sessionId: string }> {
    if (!exec.agent || exec.agent.session.id !== binding.sessionId)
      throw new LedgerError('unbound_actor')
    const { binding: current } = await run.resolve(binding.sessionId, exec.signal)
    if (current.id !== binding.id || current.status === 'unavailable')
      throw new LedgerError('binding_conflict')
    return { kind: 'agent' as const, sessionId: current.sessionId }
  }

  function nativeOwnerSource(exec: ToolRunContext): { ok: false, reason: 'source_unverifiable' | 'unauthorized_source' } | { ok: true, source: { kind: 'native_user', sessionId: string, messageId: string, rpcId: string } } {
    const session = exec.agent!.session
    if (typeof session.snapshotEvents !== 'function')
      return { ok: false as const, reason: 'source_unverifiable' }
    const event = session.snapshotEvents().findLast(event => event.type === 'user/message' && event.data.source.kind === 'user')
    if (!event || event.type !== 'user/message' || event.data.source.kind !== 'user' || 'principal' in event.data.source)
      return { ok: false as const, reason: 'unauthorized_source' }
    const source = event.data.source
    if (!('rpcId' in source) || typeof source.rpcId !== 'string' || !source.rpcId)
      return { ok: false as const, reason: 'source_unverifiable' }
    return { ok: true as const, source: { kind: 'native_user' as const, sessionId: session.id, messageId: event.data.id, rpcId: source.rpcId } }
  }

  function visible(ticket: Row<'ticket'>): boolean {
    return binding.role === 'main'
      || (binding.role === 'project' && ticket.projectId === binding.projectId)
      || (binding.role === 'worker' && ticket.id === binding.ticketId)
      || (binding.role === 'supervisor' && ledger.list(database, 'supervisor_ticket').some(link => link.supervisorId === binding.supervisorId && link.ticketId === ticket.id))
  }

  function ticketInScope(id: string): Row<'ticket'> {
    const ticket = ledger.load(database, 'ticket', id)
    if (!ticket || !visible(ticket))
      throw new LedgerError('scope_denied')
    return ticket
  }

  function threadInScope(id: string): Row<'thread'> {
    const thread = ledger.load(database, 'thread', id)
    if (!thread || !(binding.role === 'main'
      || (binding.role === 'project' && thread.projectId === binding.projectId)
      || ledger.list(database, 'ticket_thread').some(link => link.threadId === id && visible(ledger.load(database, 'ticket', link.ticketId)!)))) {
      throw new LedgerError('scope_denied')
    }
    return thread
  }

  const output = {
    schema: { type: 'object', additionalProperties: true } as const,
    render: (_args: unknown, value: unknown) => [{ type: 'text' as const, text: JSON.stringify(value) }],
  }
  const tools = [defineTool({
    name: 'list_ticket',
    description: '读取可信绑定范围内的工单、项目与来源关联；主编排全局，项目仅本项目，协调者仅关联工单，Worker 仅本票。',
    parameters: {
      projectId: { type: 'string' },
      status: { type: 'string', enum: ['waiting', 'queued', 'running', 'review', 'done', 'cancelled'] },
    },
    output,
    execute: async (args, exec) => {
      await caller(exec)
      if (binding.role !== 'main' && args.projectId && args.projectId !== binding.projectId)
        throw new LedgerError('scope_denied')
      const tickets = ledger.list(database, 'ticket').filter(ticket => visible(ticket) && (!args.projectId || ticket.projectId === args.projectId) && (!args.status || ticket.status === args.status))
      const subscriptions = ledger.list(database, 'ticket_thread').filter(link => tickets.some(ticket => ticket.id === link.ticketId))
      const projects = ledger.list(database, 'project').filter(project => binding.role === 'main' || (binding.role === 'project' && project.id === binding.projectId) || tickets.some(ticket => ticket.projectId === project.id))
      const threads = ledger.list(database, 'thread').filter(thread => binding.role === 'main' || (binding.role === 'project' && thread.projectId === binding.projectId) || subscriptions.some(link => link.threadId === thread.id))
      const native = binding.role === 'main' ? nativeOwnerSource(exec) : null
      return { tickets, projects, subscriptions, threads, ...(native ? { nativeSource: native.ok ? native.source : null, nativeSourceReason: native.ok ? null : native.reason } : {}) }
    },
  })]
  tools.push(defineTool({
    name: 'read_channel',
    description: '读取账本保存的可信渠道原文；resource 只接受 ticket/<id>、thread/<id>、trigger/<id>，不读取任意外部地址。按 next_offset 翻页。',
    parameters: {
      resource: { type: 'string', required: true },
      offset: { type: 'integer' },
      limit: { type: 'integer' },
    },
    output,
    execute: async (args, exec) => {
      await caller(exec)
      const offset = args.offset ?? 0
      const limit = args.limit ?? 50
      if (offset < 0 || limit < 1 || limit > 100)
        throw new LedgerError('invalid_config')
      const slash = args.resource.indexOf('/')
      const kind = args.resource.slice(0, slash)
      const id = args.resource.slice(slash + 1)
      let threads: Row<'thread'>[]
      let items: Row<'trigger'>[]
      if (kind === 'ticket') {
        ticketInScope(id)
        threads = ledger.list(database, 'ticket_thread').filter(link => link.ticketId === id).map(link => threadInScope(link.threadId))
        items = ledger.list(database, 'trigger').filter(trigger => threads.some(thread => thread.id === trigger.threadId))
      }
      else if (kind === 'thread') {
        threads = [threadInScope(id)]
        items = ledger.list(database, 'trigger').filter(trigger => trigger.threadId === id)
      }
      else if (kind === 'trigger') {
        const trigger = ledger.load(database, 'trigger', id)
        if (!trigger)
          throw new LedgerError('scope_denied')
        threads = [threadInScope(trigger.threadId)]
        items = [trigger]
      }
      else {
        throw new LedgerError('invalid_source')
      }
      items.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))
      return { threads, items: items.slice(offset, offset + limit), next_offset: offset + limit < items.length ? offset + limit : null }
    },
  }), defineTool({
    name: 'inbox_list',
    description: '列出当前可信绑定尚未处理的消息；问题附当前 policyBasis 与完整关联工单。已受理、送达、读过和处理是不同状态。',
    parameters: {},
    output,
    execute: async (_args, exec) => {
      await caller(exec)
      const items = ledger.list(database, 'message').filter(message => message.recipient === binding.id && !message.handledAt && !message.supersededAt).sort((a, b) => a.seq - b.seq).map(message => ({
        ...message,
        question: message.askId ? ledger.load(database, 'ask', message.askId) : null,
        ticketIds: message.askId ? ledger.list(database, 'ask_ticket').filter(link => link.askId === message.askId).map(link => link.ticketId) : [],
      }))
      return { items }
    },
  }), defineTool({
    name: 'inbox_kill',
    description: '通过 runtime 将自己的指定收件箱消息标为已处理；不删除记录，不代表批准。',
    parameters: { ids: { type: 'array', items: { type: 'string' }, required: true } },
    output,
    execute: async (args, exec) => {
      await caller(exec)
      if (args.ids.some(id => ledger.load(database, 'message', id)?.recipient !== binding.id))
        throw new LedgerError('scope_denied')
      const items = []
      for (const id of args.ids)
        items.push(await run.handled(binding.sessionId, id, exec.signal))
      return { items }
    },
  }))
  if (binding.role === 'main' || binding.role === 'project') {
    tools.push(defineTool({
      name: 'attach_thread_to_ticket',
      description: '通过账本订阅同仓库话题；不授权新工作，不更改工单状态。',
      parameters: { ticketId: { type: 'string', required: true }, threadId: { type: 'string', required: true } },
      output,
      execute: async (args, exec) => {
        const actor = await caller(exec)
        ticketInScope(args.ticketId)
        ledger.subscribeThread(database, args.ticketId, args.threadId, actor)
        return { subscribed: true }
      },
    }))
  }
  if (binding.role === 'main' || binding.role === 'supervisor') {
    tools.push(defineTool({
      name: 'dispatch_ticket',
      description: '把已授权工单持久投递给所属项目编排；不启动 Worker，不更改状态。项目编排自行判断并调用 create_worker。',
      parameters: {
        ticketId: { type: 'string', required: true },
        requestId: { type: 'string', required: true },
        message: { type: 'string' },
      },
      output,
      execute: async (args, exec) => {
        await caller(exec)
        const ticket = ticketInScope(args.ticketId)
        const { reasons } = ledger.resolveTicket(database, ticket.id)
        if (['done', 'cancelled'].includes(ticket.status))
          throw new LedgerError('ticket_closed')
        if (reasons.length)
          throw new LedgerError(reasons[0]!)
        const project = ledger.list(database, 'role_binding').find(row => row.role === 'project' && row.projectId === ticket.projectId && row.status !== 'closed')
        if (!project)
          throw new LedgerError('unknown_binding')
        const id = `dispatch-${createHash('sha256').update(JSON.stringify([binding.id, ticket.id, args.requestId])).digest('hex')}`
        const message = await run.intake({ id, source: `binding:${binding.id}`, recipient: project.id, ticketId: ticket.id, kind: 'ticket', content: JSON.stringify({ ticketId: ticket.id, authorization: ticket.authorization, acceptanceCriteria: ticket.acceptanceCriteria, message: args.message ?? '' }) }, exec.signal)
        return { accepted: true, started: false, message }
      },
    }))
  }
  if (binding.role === 'supervisor') {
    tools.push(defineTool({
      name: 'link_dependency',
      description: '记录范围内两张工单的前置依赖；ticketId 等待 dependsOn 的实际交付完成。',
      parameters: { ticketId: { type: 'string', required: true }, dependsOn: { type: 'string', required: true } },
      output,
      execute: async (args, exec) => {
        const actor = await caller(exec)
        ticketInScope(args.ticketId)
        ticketInScope(args.dependsOn)
        ledger.linkTickets(database, args.ticketId, args.dependsOn, 'depends', actor)
        return { linked: true }
      },
    }))
  }
  if (binding.role === 'main') {
    tools.push(defineTool({
      name: 'triage_thread',
      description: '给可信来源话题确定项目归属或忽略；claim 必须显式给同仓库项目。',
      parameters: {
        threadId: { type: 'string', required: true },
        action: { type: 'string', enum: ['claim', 'ignore'], required: true },
        projectId: { type: 'string' },
      },
      output,
      execute: async (args, exec) => {
        const actor = await caller(exec)
        return { thread: ledger.triageThread(database, args.threadId, args.projectId ?? null, args.action === 'claim' ? 'claimed' : 'ignored', actor) }
      },
    }), defineTool({
      name: 'create_supervisor',
      description: '为显式跨项目工单集合创建可信临时协调者，重试复用 requestId。只协调关联工单，不代替项目验收。',
      parameters: {
        requestId: { type: 'string', required: true },
        ticketIds: { type: 'array', items: { type: 'string' }, required: true },
        reason: { type: 'string', required: true },
      },
      output,
      execute: async (args, exec) => {
        const actor = await caller(exec)
        const tickets = [...new Set(args.ticketIds)].map(ticketInScope)
        if (!args.requestId.trim() || !args.reason.trim() || new Set(tickets.map(ticket => ticket.projectId)).size < 2)
          throw new LedgerError('invalid_config')
        const id = `supervisor-${createHash('sha256').update(JSON.stringify([binding.id, args.requestId])).digest('hex')}`
        const existing = ledger.list(database, 'supervisor_ticket').filter(link => link.supervisorId === id).map(link => link.ticketId).sort()
        if (existing.length && JSON.stringify(existing) !== JSON.stringify(tickets.map(ticket => ticket.id).sort()))
          throw new LedgerError('identity_conflict')
        const created = await run.bind({ id, role: 'supervisor', sessionId: `nexus-${id}`, supervisorId: id, ticketIds: tickets.map(ticket => ticket.id), recoveryReason: args.reason }, actor, exec.signal)
        await run.intake({ id: `coordination:${id}`, source: `binding:${binding.id}`, recipient: created.id, kind: 'message', content: JSON.stringify({ reason: args.reason, tickets }) }, exec.signal)
        return { binding: created }
      },
    }), defineTool({
      name: 'close_supervisor',
      description: '经 runtime 确认会话停止后关闭协调者；未解决的协调决定仍由账本阻止关闭。',
      parameters: { supervisorId: { type: 'string', required: true }, reason: { type: 'string', required: true } },
      output,
      execute: async (args, exec) => {
        const actor = await caller(exec)
        return { supervisor: await run.closeSupervisor(args.supervisorId, args.reason, actor, exec.signal) }
      },
    }))
    tools.push(defineTool({
      name: 'create_ticket',
      description: '依据持久可信来源开票。triggerId 与 sourceMessageId 必须且只能给一个。原生 owner 目标先用 list_ticket 获取 nativeSource.messageId，只接受当前 main 的最新真实 owner RPC 用户消息，可拆到已启用可用项目；旧源、非 owner 或身份参数不授权。必须明确授权范围与验收标准，同源重试复用 requestId。',
      parameters: {
        requestId: { type: 'string', required: true },
        triggerId: { type: 'string' },
        sourceMessageId: { type: 'string' },
        projectId: { type: 'string', required: true },
        title: { type: 'string', required: true },
        authorization: { type: 'string', required: true },
        acceptanceCriteria: { type: 'string', required: true },
        description: { type: 'string' },
      },
      output,
      execute: async (args, exec): Promise<Record<string, JsonValue>> => {
        const actor = await caller(exec)
        if (!args.requestId.trim())
          throw new LedgerError('invalid_config')
        if (!!args.triggerId === !!args.sourceMessageId)
          throw new LedgerError('invalid_source')
        if (args.sourceMessageId) {
          const native = nativeOwnerSource(exec)
          if (!native.ok)
            throw new LedgerError(native.reason)
          if (native.source.messageId !== args.sourceMessageId)
            throw new LedgerError('unauthorized_source')
          const id = `ticket-${createHash('sha256').update(JSON.stringify([binding.sessionId, native.source.messageId, args.requestId])).digest('hex')}`
          return { ticket: ledger.createTicket(database, { id, projectId: args.projectId, channelId: 'nexus', title: args.title, authorization: args.authorization, acceptanceCriteria: args.acceptanceCriteria, ...(args.description !== undefined ? { description: args.description } : {}) }, actor, native.source), source: native.source }
        }
        const trigger = ledger.load(database, 'trigger', args.triggerId!)
        if (!trigger)
          throw new LedgerError('unauthorized_source')
        const whitelist = JSON.parse(ledger.getSettings(database).whitelist) as string[]
        const authorized = trigger.actorSource === 'web'
          ? policy.peek({ kind: 'web', authenticated: !!trigger.human, userId: trigger.actorProviderId ?? '' }, whitelist)
          : trigger.actorSource === 'github' && policy.peek({ kind: 'github', verified: true, providerId: trigger.actorProviderId ?? '', login: trigger.actorLogin ?? '', bot: !trigger.human, outbound: !!trigger.outbound }, whitelist)
        if (!authorized)
          throw new LedgerError('unauthorized_source')
        const thread = ledger.load(database, 'thread', trigger.threadId)!
        const project = ledger.load(database, 'project', args.projectId)
        if (!project || thread.repository !== project.repository || (thread.projectId && thread.projectId !== project.id))
          throw new LedgerError('scope_denied')
        const id = `ticket-${createHash('sha256').update(JSON.stringify([trigger.id, args.requestId])).digest('hex')}`
        const ticket = ledger.createTicket(database, { id, projectId: args.projectId, channelId: thread.channelId, title: args.title, authorization: args.authorization, acceptanceCriteria: args.acceptanceCriteria, ...(args.description !== undefined ? { description: args.description } : {}) }, actor)
        ledger.subscribeThread(database, ticket.id, thread.id, actor)
        return { ticket }
      },
    }))
  }
  if (binding.role === 'project') {
    tools.push(defineTool({
      name: 'set_delivery_target',
      description: '从本票已订阅的 GitHub PR 话题实时收集精确交付目标和 CI 事实后写账本；不采信模型提供的 head/base 或完成声明。收集失败不写目标。',
      parameters: { ticketId: { type: 'string', required: true }, threadId: { type: 'string', required: true } },
      output,
      execute: async (args, exec): Promise<Record<string, JsonValue>> => {
        const actor = await caller(exec)
        const ticket = ticketInScope(args.ticketId)
        const thread = threadInScope(args.threadId)
        if (['done', 'cancelled'].includes(ticket.status))
          throw new LedgerError('ticket_closed')
        if (thread.channelId !== 'github' || thread.kind !== 'pull' || thread.projectId !== ticket.projectId || !ledger.list(database, 'ticket_thread').some(link => link.ticketId === ticket.id && link.threadId === thread.id))
          throw new LedgerError('scope_denied')
        const result = await github.collectPullRequest(ticket.projectId, thread.id, exec.signal)
        checkInterrupt(exec.signal)
        if (!result.ok || !result.fact)
          return { ok: false, reason: result.reason ?? 'pull_request_unverified' }
        ledger.setDeliveryTarget(database, ticket.id, result.fact.target, actor)
        return { ok: true, ticket: ledger.recordPullRequest(database, ticket.id, result.fact.target, result.fact.state, result.fact.ciState) }
      },
    }), defineTool({
      name: 'merge_pull_request',
      description: '消费本项目单票正式合并决定，经 GitHub channel 实时核验后合并；pending、过期验收或目标改变均不是批准。返回真实结果，不自动结单。',
      parameters: { askId: { type: 'string', required: true } },
      output,
      execute: async (args, exec) => {
        await caller(exec)
        const ask = ledger.load(database, 'ask', args.askId)
        const links = ledger.list(database, 'ask_ticket').filter(link => link.askId === args.askId)
        if (ask?.decisionType !== 'merge' || links.length !== 1)
          throw new LedgerError('invalid_merge_decision')
        ticketInScope(links[0]!.ticketId)
        if (ask.status !== 'answered' || ask.answer !== 'allow_merge')
          return { ok: false, reason: 'decision_invalid' }
        return await github.merge(ask.id, exec.signal)
      },
    }), defineTool({
      name: 'create_worker',
      description: '为本项目已授权工单调用 runtime.start，建立隔离工作区与可信 Worker；槽位不足返回 queued，不假称已经启动。分支由 runtime 决定。',
      parameters: { ticketId: { type: 'string', required: true } },
      output,
      execute: async (args, exec) => {
        const actor = await caller(exec)
        ticketInScope(args.ticketId)
        return await run.start(args.ticketId, actor, exec.signal)
      },
    }), defineTool({
      name: 'advance_ticket',
      description: '由项目编排提交当前执行的 ready、failed 或 complete。ready 不是完成；complete 必须通过账本当前验收证据、正式交付决定与实际合并事实检查。',
      parameters: {
        ticketId: { type: 'string', required: true },
        executionBindingId: { type: 'string', required: true },
        event: { type: 'string', enum: ['ready', 'failed', 'complete'], required: true },
        reason: { type: 'string', required: true },
      },
      output,
      execute: async (args, exec) => {
        const actor = await caller(exec)
        const ticket = ticketInScope(args.ticketId)
        if (ticket.executionBindingId !== args.executionBindingId)
          throw new LedgerError('stale_execution')
        if (!args.reason.trim())
          throw new LedgerError('invalid_config')
        const advanced = ledger.advanceTicket(database, ticket.id, args.event, actor, args.reason, args.executionBindingId)
        const attention = ledger.load(database, 'attention', `execution:${args.executionBindingId}`)
        if (attention && !attention.handledAt && args.event !== 'complete' && advanced.updatedAt !== ticket.updatedAt)
          await run.progress(attention.id, advanced.updatedAt, attention.reason, args.reason, exec.signal)
        return { ticket: advanced, ...(args.event === 'complete' ? { retirement: await run.retire(ticket.id, `delivery_complete: ${args.reason}`, exec.signal, actor) } : {}) }
      },
    }), defineTool({
      name: 'record_acceptance',
      description: '记录本项目当前执行的明确验收判断、范围、依据与非空证据；不会自动交付完成。requestId 在同一次验收重试时保持稳定。',
      parameters: {
        requestId: { type: 'string', required: true },
        ticketId: { type: 'string', required: true },
        executionBindingId: { type: 'string', required: true },
        scope: { type: 'string', required: true },
        evidence: { type: 'array', items: { type: 'string' }, required: true },
        basis: { type: 'string', required: true },
        verdict: { type: 'string', enum: ['accepted', 'rejected'], required: true },
      },
      output,
      execute: async (args, exec) => {
        const actor = await caller(exec)
        const ticket = ticketInScope(args.ticketId)
        if (ticket.executionBindingId !== args.executionBindingId)
          throw new LedgerError('stale_execution')
        if (!args.requestId.trim())
          throw new LedgerError('invalid_config')
        const id = `acceptance-${createHash('sha256').update(JSON.stringify([binding.id, ticket.id, args.executionBindingId, args.requestId])).digest('hex')}`
        const existing = ledger.load(database, 'acceptance', id)
        if (existing) {
          if (existing.scope !== args.scope || existing.basis !== args.basis || existing.verdict !== args.verdict || existing.evidence !== JSON.stringify(args.evidence) || existing.criteria !== ticket.acceptanceCriteria || existing.target !== ticket.deliveryTarget)
            throw new LedgerError('identity_conflict')
          return { acceptance: existing }
        }
        const acceptance = ledger.recordAcceptance(database, { id, ticketId: ticket.id, executionBindingId: args.executionBindingId, scope: args.scope, evidence: args.evidence, basis: args.basis, verdict: args.verdict }, actor)
        const attention = ledger.load(database, 'attention', `execution:${args.executionBindingId}`)
        if (attention && !attention.handledAt)
          await run.progress(attention.id, acceptance.createdAt, attention.reason, acceptance.basis, exec.signal)
        return { acceptance }
      },
    }))
  }
  return tools
}
