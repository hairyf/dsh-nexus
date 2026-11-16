import type { SQLInputValue } from 'node:sqlite'
import type { NexusDatabase } from '../database'
import type { DB } from '../database/types'
import type { AcceptanceInput, Actor, AnswerInput, AskInput, AttentionInput, BindingInput, ExecutionMetadata, IdTable, MergeTarget, PolicySnapshot, ProjectInput, Role, Row, SettingsPatch, ThreadInput, TicketInput, TriggerInput } from '../types/ledger'
import { randomUUID } from 'node:crypto'
import { isAbsolute } from 'node:path'
import { LedgerError, requireDatabase, transaction } from '../database'
import { defineService } from '../utils/service'
import { policy } from './policy'

export const ledger = defineService({
  load<T extends IdTable>(database: NexusDatabase, table: T, id: string): Row<T> | null {
    return load(database, table, id)
  },
  list<T extends keyof DB>(database: NexusDatabase, table: T): Row<T>[] {
    return rows(database, table)
  },
  getSettings(database: NexusDatabase): Row<'setting'> {
    insert(database, 'setting', { id: 'global', updatedAt: now() }, true)
    return required(database, 'setting', 'global')
  },
  updateSettings(database: NexusDatabase, patch: SettingsPatch, actor: Actor): Row<'setting'> {
    human(database, actor)
    validatePolicy({ questionLevel: patch.defaultQuestionLevel ?? 'important', mergePolicy: patch.defaultMergePolicy ?? 'follow_question_level' })
    for (const [key, value] of Object.entries(patch)) {
      if (typeof value === 'number' && (!Number.isSafeInteger(value) || value <= 0 || (key === 'maxWorkers' && value > 16)))
        fail('invalid_config')
    }
    const { whitelist, ...scalarPatch } = patch
    const values: Record<string, SQLInputValue> = { ...scalarPatch, updatedAt: now() }
    if (whitelist) {
      if (whitelist.some(login => !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(login.trim())))
        fail('invalid_config')
      values.whitelist = JSON.stringify([...new Set(whitelist.map(login => login.trim().toLowerCase()))])
    }
    update(database, 'setting', 'global', values)
    return required(database, 'setting', 'global')
  },
  createProject(database: NexusDatabase, input: ProjectInput): Row<'project'> {
    const repository = repositoryIdentity(input.remoteUrl)
    if (!input.id || !input.workspaceId || !input.directory || !input.name)
      fail('invalid_config')
    const existing = load(database, 'project', input.id)
    if (existing && existing.workspaceId !== input.workspaceId)
      fail('identity_conflict')
    const conflict = rows(database, 'project').find(project => project.id !== input.id && (project.workspaceId === input.workspaceId || project.repository === repository))
    if (conflict)
      fail('identity_conflict')
    if (existing) {
      if (existing.repository && existing.repository !== repository)
        fail('identity_conflict')
      update(database, 'project', input.id, { name: input.name, directory: input.directory, remoteUrl: input.remoteUrl, repository, available: Number(input.available), updatedAt: now() })
    }
    else {
      insert(database, 'project', { ...input, available: Number(input.available), repository, createdAt: now(), updatedAt: now() })
    }
    return required(database, 'project', input.id)
  },
  updateProject(database: NexusDatabase, id: string, enabled: boolean, actor: Actor): Row<'project'> {
    human(database, actor)
    const project = required(database, 'project', id)
    if (enabled && (!project.repository || !project.available))
      fail('project_unavailable')
    update(database, 'project', id, { enabled: Number(enabled), attentionReason: null, updatedAt: now() })
    return required(database, 'project', id)
  },
  createTicket(database: NexusDatabase, input: TicketInput, actor: Actor): Row<'ticket'> {
    return transaction(database, () => {
      manager(database, actor, ['main'])
      activeProject(database, input.projectId)
      if (!input.id || !input.title.trim() || !input.authorization.trim() || !input.acceptanceCriteria.trim())
        fail('invalid_config')
      const existing = load(database, 'ticket', input.id)
      if (existing) {
        if (existing.projectId !== input.projectId || existing.authorization !== input.authorization || existing.acceptanceCriteria !== input.acceptanceCriteria)
          fail('identity_conflict')
        return existing
      }
      const settings = ledger.getSettings(database)
      insert(database, 'channel', { id: input.channelId, name: input.channelId, createdAt: now() }, true)
      insert(database, 'ticket', { ...input, questionLevel: settings.defaultQuestionLevel, mergePolicy: settings.defaultMergePolicy, status: 'waiting', createdAt: now(), updatedAt: now() })
      return required(database, 'ticket', input.id)
    })
  },
  authorizeTicket(database: NexusDatabase, ticketId: string, authorization: string, acceptanceCriteria: string, reason: string, actor: Actor): Row<'ticket'> {
    human(database, actor)
    if (!authorization.trim() || !acceptanceCriteria.trim() || !reason.trim())
      fail('invalid_config')
    return transaction(database, () => {
      const ticket = required(database, 'ticket', ticketId)
      if (['done', 'cancelled'].includes(ticket.status))
        fail('ticket_closed')
      insert(database, 'policy_change', { id: randomUUID(), ticketId, actor: JSON.stringify(actor), at: now(), previous: JSON.stringify({ authorization: ticket.authorization, acceptanceCriteria: ticket.acceptanceCriteria }), current: JSON.stringify({ authorization, acceptanceCriteria }), reason })
      update(database, 'ticket', ticketId, { authorization, acceptanceCriteria, policyRevision: ticket.policyRevision + 1, updatedAt: now() })
      for (const ask of rows(database, 'ask').filter(ask => ask.status === 'pending' && askTickets(database, ask.id).some(ticket => ticket.id === ticketId)))
        update(database, 'ask', ask.id, { policyBasis: basis(askTickets(database, ask.id)) })
      return required(database, 'ticket', ticketId)
    })
  },
  setPolicy(database: NexusDatabase, ticketId: string, snapshot: PolicySnapshot, reason: string, actor: Actor): Row<'ticket'> {
    human(database, actor)
    validatePolicy(snapshot)
    if (!reason.trim())
      fail('invalid_config')
    return transaction(database, () => {
      const ticket = required(database, 'ticket', ticketId)
      insert(database, 'policy_change', { id: randomUUID(), ticketId, actor: JSON.stringify(actor), at: now(), previous: JSON.stringify(snapshotOf(ticket)), current: JSON.stringify(snapshot), reason })
      update(database, 'ticket', ticketId, { ...snapshot, policyRevision: ticket.policyRevision + 1, updatedAt: now() })
      for (const ask of rows(database, 'ask').filter(ask => ask.status === 'pending' && askTickets(database, ask.id).some(ticket => ticket.id === ticketId))) {
        const tickets = askTickets(database, ask.id)
        const next = route(database, ask.initiatorRole as Role, tickets, ask.decisionType as AskInput['decisionType'], !!ask.withinAuthorization)
        rerouteAskDelivery(database, ask, next)
        update(database, 'ask', ask.id, { handler: next, policyBasis: basis(tickets) })
      }
      return required(database, 'ticket', ticketId)
    })
  },
  bindRole(database: NexusDatabase, input: BindingInput, actor?: Actor): Row<'role_binding'> {
    return transaction(database, () => {
      if (!['main', 'project', 'supervisor', 'worker'].includes(input.role) || !input.sessionId || !input.id)
        fail('invalid_config')
      const existing = load(database, 'role_binding', input.id)
      if (existing) {
        if (existing.sessionId !== input.sessionId || existing.role !== input.role)
          fail('binding_conflict')
        return existing
      }
      let scope = 'global'
      if (input.role === 'project') {
        if (!input.projectId)
          fail('invalid_config')
        required(database, 'project', input.projectId)
        scope = input.projectId
      }
      if (input.role === 'worker') {
        if (!input.ticketId)
          fail('invalid_config')
        const ticket = required(database, 'ticket', input.ticketId)
        if (rows(database, 'role_binding').some(binding => binding.role === 'worker' && binding.ticketId === ticket.id && binding.status !== 'closed'))
          fail('binding_conflict')
        if (!actor)
          fail('management_authorization_required')
        ticketManager(database, actor, ticket)
        dispatchable(database, ticket)
        if (rows(database, 'role_binding').filter(binding => binding.role === 'worker' && binding.status !== 'closed').length >= ledger.getSettings(database).maxWorkers)
          fail('worker_limit')
        if (input.projectId !== ticket.projectId || input.repository !== activeProject(database, ticket.projectId).repository || !input.worktree || !input.branch)
          fail('scope_denied')
        scope = input.ticketId
      }
      if (input.role === 'supervisor') {
        if (!actor)
          fail('management_authorization_required')
        manager(database, actor, ['main'])
        if (!input.supervisorId || !input.ticketIds?.length)
          fail('invalid_config')
        for (const id of input.ticketIds)
          required(database, 'ticket', id)
        scope = input.supervisorId
        insert(database, 'supervisor', { id: scope, sessionId: input.sessionId, title: scope, reason: input.recoveryReason ?? 'coordination', createdAt: now() }, true)
        for (const ticketId of input.ticketIds)
          insert(database, 'supervisor_ticket', { supervisorId: scope, ticketId, createdAt: now() }, true)
      }
      if (rows(database, 'role_binding').some(binding => binding.activeKey === `${input.role}:${scope}`))
        fail('binding_conflict')
      insert(database, 'role_binding', { id: input.id, role: input.role, sessionId: input.sessionId, projectId: input.projectId, ticketId: input.ticketId, supervisorId: input.supervisorId, worktree: input.worktree, branch: input.branch, repository: input.repository, previousBindingId: input.previousBindingId, recoveryReason: input.recoveryReason, scope, status: 'idle', startedAt: null, activeKey: `${input.role}:${scope}`, createdAt: now(), updatedAt: now() })
      return required(database, 'role_binding', input.id)
    })
  },
  updateBinding(database: NexusDatabase, id: string, status: 'idle' | 'running' | 'unavailable' | 'closed', reason: string): Row<'role_binding'> {
    return transaction(database, () => {
      const current = required(database, 'role_binding', id)
      if (current.status === 'closed' || !reason.trim())
        fail('binding_closed')
      if (current.role === 'worker' && status === 'running') {
        if (current.status !== 'running' || !current.startedAt || !current.ticketId)
          fail('invalid_transition')
        const ticket = required(database, 'ticket', current.ticketId)
        if (ticket.status !== 'running' || ticket.executionBindingId !== current.id)
          fail('invalid_transition')
      }
      update(database, 'role_binding', id, { status, recoveryReason: reason, updatedAt: now(), ...(status === 'closed' ? { closedAt: now(), activeKey: null } : {}) })
      return required(database, 'role_binding', id)
    })
  },
  createAsk(database: NexusDatabase, input: AskInput, actor: Actor): Row<'ask'> {
    return transaction(database, () => {
      const initiator = agent(database, actor)
      const tickets = [...new Set(input.ticketIds)].map(id => required(database, 'ticket', id))
      if (!input.id || !input.content.trim() || (!tickets.length && initiator.role !== 'main'))
        fail('invalid_config')
      for (const ticket of tickets) {
        scope(database, initiator, ticket)
        activeProject(database, ticket.projectId)
      }
      if (input.decisionType === 'merge') {
        if (tickets.length !== 1 || !input.target || !input.options.includes('allow_merge') || !input.options.includes('deny_merge'))
          fail('invalid_merge_target')
        if (!sameTarget(input.target, parseTarget(tickets[0].deliveryTarget)))
          fail('stale_target')
        accepted(database, tickets[0])
      }
      if (input.decisionType === 'delivery' && (!input.options.includes('accept_delivery') || !input.options.includes('reject_delivery')))
        fail('invalid_config')
      const existing = load(database, 'ask', input.id)
      if (existing) {
        if (existing.initiatorBinding !== initiator.id || existing.content !== input.content || existing.source !== input.source)
          fail('identity_conflict')
        return existing
      }
      if (input.supersedesId)
        required(database, 'ask', input.supersedesId)
      const handler = route(database, initiator.role as Role, tickets, input.decisionType, input.withinAuthorization)
      insert(database, 'ask', { id: input.id, source: input.source, initiatorRole: initiator.role, initiatorBinding: initiator.id, responseRecipient: initiator.id, handler, decisionType: input.decisionType, withinAuthorization: Number(input.withinAuthorization), policyBasis: basis(tickets), content: input.content, options: JSON.stringify(input.options), target: input.target ? JSON.stringify(input.target) : null, supersedesId: input.supersedesId ?? null, createdAt: now() })
      for (const ticket of tickets)
        insert(database, 'ask_ticket', { askId: input.id, ticketId: ticket.id })
      enqueue(database, { id: `ask:${input.id}`, ticketId: tickets[0]?.id ?? null, recipient: handler, sender: initiator.id, content: input.content, kind: 'ask', askId: input.id })
      return required(database, 'ask', input.id)
    })
  },
  escalateAsk(database: NexusDatabase, askId: string, actor: Actor): Row<'ask'> {
    return transaction(database, () => {
      const ask = pending(database, askId)
      handler(database, ask, actor)
      if (ask.handler === 'human')
        fail('already_human')
      const current = required(database, 'role_binding', ask.handler)
      const tickets = askTickets(database, askId)
      const next = current.role === 'project' ? route(database, 'project', tickets, 'ordinary', true) : 'human'
      rerouteAskDelivery(database, ask, next)
      update(database, 'ask', askId, { handler: next, escalations: ask.escalations + 1, lastEscalatedAt: now() })
      return required(database, 'ask', askId)
    })
  },
  answerAsk(database: NexusDatabase, input: AnswerInput, actor: Actor): Row<'ask'> {
    return transaction(database, () => {
      const ask = pending(database, input.askId)
      if (ask.policyBasis !== input.policyBasis)
        fail('policy_changed')
      handler(database, ask, actor)
      const tickets = askTickets(database, ask.id)
      for (const ticket of tickets) {
        activeProject(database, ticket.projectId)
        if (['done', 'cancelled'].includes(ticket.status))
          fail('ticket_closed')
      }
      if (basis(tickets) !== ask.policyBasis)
        fail('policy_changed')
      if (ask.decisionType === 'merge') {
        if (!sameTarget(input.target, parseTarget(ask.target)) || !sameTarget(input.target, parseTarget(tickets[0].deliveryTarget)))
          fail('stale_target')
        if (input.answer === 'allow_merge' && !input.verified)
          fail('verification_required')
        accepted(database, tickets[0])
      }
      const result = requireDatabase(database).prepare('UPDATE ask SET status = \'answered\', answer = ?, answerActor = ?, answerSource = ?, answeredAt = ?, answerPolicy = ?, verified = ? WHERE id = ? AND status = \'pending\'').run(input.answer, JSON.stringify(actor), actor.kind, now(), basis(tickets), Number(!!input.verified), ask.id)
      if (result.changes !== 1)
        fail('ask_settled')
      retireAskRequests(database, ask.id)
      const recipient = ask.responseRecipient ?? ask.initiatorBinding ?? 'human'
      const message = enqueue(database, { id: `answer:${ask.id}`, ticketId: tickets[0]?.id ?? null, recipient, sender: actorKey(actor), content: input.answer, kind: 'answer', askId: ask.id })
      const receiver = recipient === 'human' ? null : load(database, 'role_binding', recipient)
      if (recipient !== 'human' && (!receiver || !['idle', 'running'].includes(receiver.status)))
        update(database, 'message', message.id, { deliveryState: 'failed', error: 'initiator_requires_recovery' })
      return required(database, 'ask', ask.id)
    })
  },
  cancelAsk(database: NexusDatabase, askId: string, reason: string, actor: Actor): Row<'ask'> {
    return transaction(database, () => {
      const ask = pending(database, askId)
      if (!reason.trim())
        fail('invalid_config')
      if (!isHuman(database, actor)) {
        const caller = agent(database, actor)
        if (caller.id !== ask.initiatorBinding && caller.id !== ask.handler)
          fail('scope_denied')
      }
      update(database, 'ask', askId, { status: 'cancelled', cancelledAt: now(), cancelReason: `${reason} [${actorKey(actor)}]` })
      retireAskRequests(database, askId)
      return required(database, 'ask', askId)
    })
  },
  setDeliveryTarget(database: NexusDatabase, ticketId: string, target: MergeTarget, actor: Actor): Row<'ticket'> {
    const ticket = required(database, 'ticket', ticketId)
    ticketManager(database, actor, ticket)
    const project = activeProject(database, ticket.projectId)
    if (!target.head || !target.base || !target.pullRequest || target.repository !== project.repository)
      fail('invalid_merge_target')
    return transaction(database, () => {
      const encoded = JSON.stringify(target)
      if (!sameTarget(target, parseTarget(ticket.deliveryTarget))) {
        for (const ask of rows(database, 'ask').filter(ask => ask.status === 'pending' && ask.target && askTickets(database, ask.id).some(ticket => ticket.id === ticketId))) {
          update(database, 'ask', ask.id, { status: 'cancelled', cancelledAt: now(), cancelReason: 'delivery_target_changed' })
          retireAskRequests(database, ask.id)
        }
      }
      update(database, 'ticket', ticketId, { deliveryTarget: encoded, prUrl: target.pullRequest, prState: 'open', updatedAt: now() })
      return required(database, 'ticket', ticketId)
    })
  },
  recordPullRequest(database: NexusDatabase, ticketId: string, target: MergeTarget, state: 'open' | 'merged' | 'closed', ciState?: Row<'ticket'>['ciState']): Row<'ticket'> {
    return transaction(database, () => {
      const ticket = required(database, 'ticket', ticketId)
      const previous = parseTarget(ticket.deliveryTarget)
      if (!previous || previous.repository !== target.repository || previous.pullRequest !== target.pullRequest || !target.head || !target.base)
        fail('stale_target')
      if (!sameTarget(target, previous)) {
        for (const ask of rows(database, 'ask').filter(ask => ask.status === 'pending' && ask.target && askTickets(database, ask.id).some(ticket => ticket.id === ticketId))) {
          update(database, 'ask', ask.id, { status: 'cancelled', cancelledAt: now(), cancelReason: 'delivery_target_changed' })
          retireAskRequests(database, ask.id)
        }
      }
      update(database, 'ticket', ticketId, { deliveryTarget: JSON.stringify(target), prState: state, ciState: ciState ?? ticket.ciState, updatedAt: now() })
      return required(database, 'ticket', ticketId)
    })
  },
  recordAcceptance(database: NexusDatabase, input: AcceptanceInput, actor: Actor): Row<'acceptance'> {
    const ticket = required(database, 'ticket', input.ticketId)
    ticketManager(database, actor, ticket)
    requireExecution(database, ticket, input.executionBindingId)
    if (input.verdict === 'accepted' && ticket.failureReason && ticket.failureBindingId === input.executionBindingId)
      fail('execution_failed')
    if (!input.scope.trim() || !input.basis.trim() || !input.evidence.length || input.evidence.some(item => !item.trim()))
      fail('acceptance_evidence_required')
    insert(database, 'acceptance', { ...input, criteria: ticket.acceptanceCriteria, evidence: JSON.stringify(input.evidence), judge: JSON.stringify(actor), target: ticket.deliveryTarget, createdAt: now() })
    return required(database, 'acceptance', input.id)
  },
  resolveMerge(database: NexusDatabase, askId: string, target: MergeTarget, repositoryVerified: boolean): boolean {
    const ask = required(database, 'ask', askId)
    return repositoryVerified && validDecision(database, ask, target)
  },
  dispatchTicket(database: NexusDatabase, ticketId: string, actor: Actor): Row<'ticket'> {
    return transaction(database, () => {
      const ticket = required(database, 'ticket', ticketId)
      ticketManager(database, actor, ticket)
      executionReady(database, ticket)
      if (ticket.status === 'queued')
        return ticket
      if (ticket.status !== 'waiting')
        fail('invalid_transition')
      if (ticket.failureReason)
        fail('retry_required')
      if (rows(database, 'role_binding').some(binding => binding.ticketId === ticketId && binding.role === 'worker' && ['running', 'unavailable'].includes(binding.status)))
        fail('binding_conflict')
      update(database, 'ticket', ticketId, { status: 'queued', updatedAt: now() })
      recordTransition(database, ticket, 'dispatch', 'queued', actor, 'dispatch_accepted')
      return required(database, 'ticket', ticketId)
    })
  },
  startTicket(database: NexusDatabase, ticketId: string, bindingId: string, actor: Actor): Row<'ticket'> {
    return transaction(database, () => {
      const ticket = required(database, 'ticket', ticketId)
      ticketManager(database, actor, ticket)
      executionReady(database, ticket)
      const binding = required(database, 'role_binding', bindingId)
      if (ticket.status !== 'queued' || binding.role !== 'worker' || binding.ticketId !== ticketId || binding.status !== 'idle' || binding.startedAt)
        fail('invalid_transition')
      if (binding.repository !== activeProject(database, ticket.projectId).repository || !binding.worktree || !binding.branch)
        fail('scope_denied')
      if (rows(database, 'role_binding').filter(binding => binding.role === 'worker' && binding.status === 'running').length >= ledger.getSettings(database).maxWorkers)
        fail('worker_limit')
      update(database, 'ticket', ticketId, { status: 'running', executionBindingId: bindingId, startedAt: ticket.startedAt ?? now(), updatedAt: now() })
      update(database, 'role_binding', bindingId, { status: 'running', startedAt: now(), updatedAt: now() })
      recordTransition(database, ticket, 'start', 'running', actor, 'execution_started', bindingId)
      return required(database, 'ticket', ticketId)
    })
  },
  verifyExecutionMetadata(database: NexusDatabase, ticketId: string, bindingId: string, metadata: ExecutionMetadata, reason: string, actor: Actor): Row<'role_binding'> {
    return transaction(database, () => {
      const ticket = required(database, 'ticket', ticketId)
      ticketManager(database, actor, ticket)
      const binding = executionBinding(database, ticket, bindingId)
      if (!reason.trim() || !isAbsolute(metadata.worktree) || !metadata.branch.trim())
        fail('invalid_config')
      if (metadata.repository !== activeProject(database, ticket.projectId).repository || (binding.repository && binding.repository !== metadata.repository))
        fail('scope_denied')
      if (binding.status === 'running')
        fail('invalid_transition')
      const previous = { repository: binding.repository, worktree: binding.worktree, branch: binding.branch }
      update(database, 'role_binding', bindingId, { repository: metadata.repository, worktree: metadata.worktree, branch: metadata.branch, recoveryReason: reason, updatedAt: now() })
      recordTransition(database, ticket, 'verify_execution', ticket.status, actor, JSON.stringify({ reason, previous, verified: { repository: metadata.repository, worktree: metadata.worktree, branch: metadata.branch } }), bindingId)
      return required(database, 'role_binding', bindingId)
    })
  },
  confirmExecutionStopped(database: NexusDatabase, ticketId: string, bindingId: string, reason: string, actor: Actor): Row<'ticket'> {
    return transaction(database, () => {
      const ticket = required(database, 'ticket', ticketId)
      projectAuthority(database, actor, ticket)
      const binding = executionBinding(database, ticket, bindingId)
      if (!reason.trim())
        fail('invalid_config')
      update(database, 'role_binding', bindingId, { status: 'closed', activeKey: null, closedAt: binding.closedAt ?? now(), recoveryReason: reason, updatedAt: now() })
      const unresolved = ['running', 'queued', 'waiting'].includes(ticket.status)
      const status = unresolved ? 'waiting' : ticket.status
      if (unresolved)
        update(database, 'ticket', ticketId, { status, failureReason: ticket.failureReason ?? reason, failureBindingId: ticket.failureBindingId ?? bindingId, updatedAt: now() })
      recordTransition(database, ticket, 'execution_stopped', status, actor, reason, bindingId)
      return required(database, 'ticket', ticketId)
    })
  },
  recoverTicket(database: NexusDatabase, ticketId: string, bindingId: string, reason: string, actor: Actor): Row<'ticket'> {
    return transaction(database, () => {
      const ticket = required(database, 'ticket', ticketId)
      ticketManager(database, actor, ticket)
      executionReady(database, ticket)
      const binding = requireExecution(database, ticket, bindingId)
      if (!reason.trim())
        fail('invalid_config')
      if (ticket.status !== 'running' || (ticket.failureReason && ticket.failureBindingId === bindingId) || !['idle', 'unavailable'].includes(binding.status))
        fail('invalid_transition')
      if (binding.repository !== activeProject(database, ticket.projectId).repository || !binding.worktree || !binding.branch)
        fail('scope_denied')
      if (rows(database, 'role_binding').filter(item => item.role === 'worker' && item.status === 'running').length >= ledger.getSettings(database).maxWorkers)
        fail('worker_limit')
      update(database, 'role_binding', bindingId, { status: 'running', recoveryReason: reason, updatedAt: now() })
      recordTransition(database, ticket, 'recover', 'running', actor, reason, bindingId)
      return required(database, 'ticket', ticketId)
    })
  },
  retryTicket(database: NexusDatabase, ticketId: string, reason: string, actor: Actor): Row<'ticket'> {
    return transaction(database, () => {
      const ticket = required(database, 'ticket', ticketId)
      ticketManager(database, actor, ticket)
      executionReady(database, ticket)
      if (!reason.trim())
        fail('invalid_config')
      if (!['waiting', 'review'].includes(ticket.status) || ticket.prState === 'merged')
        fail('invalid_transition')
      if (rows(database, 'role_binding').some(binding => binding.role === 'worker' && binding.ticketId === ticketId && binding.status !== 'closed'))
        fail('binding_conflict')
      update(database, 'ticket', ticketId, { status: 'queued', executionBindingId: null, prepareError: null, updatedAt: now() })
      recordTransition(database, ticket, 'retry', 'queued', actor, reason)
      return required(database, 'ticket', ticketId)
    })
  },
  advanceTicket(database: NexusDatabase, ticketId: string, event: 'ready' | 'session_ended' | 'failed' | 'complete', actor: Actor, reason = '', executionBindingId?: string): Row<'ticket'> {
    return transaction(database, () => {
      const ticket = required(database, 'ticket', ticketId)
      let caller: Row<'role_binding'> | null = null
      if (!isHuman(database, actor)) {
        caller = agent(database, actor)
        scope(database, caller, ticket)
        if (!['project', 'worker'].includes(caller.role) || (event === 'complete' && caller.role !== 'project'))
          fail('scope_denied')
      }
      if (['done', 'cancelled'].includes(ticket.status))
        fail('ticket_closed')
      const execution = event === 'complete' ? null : requireExecution(database, ticket, executionBindingId ?? (caller?.role === 'worker' ? caller.id : undefined))
      if (caller?.role === 'worker' && execution?.id !== caller.id)
        fail('scope_denied')
      if (event === 'complete') {
        activeProject(database, ticket.projectId)
        if (ticket.paused)
          fail('human_paused')
        if (ticket.status !== 'review' || ticket.failureReason)
          fail('invalid_transition')
        accepted(database, ticket)
        const decisions = rows(database, 'ask').filter(ask => askTickets(database, ask.id).some(item => item.id === ticketId))
        if (ticket.deliveryTarget) {
          if (ticket.prState !== 'merged' || !decisions.some(ask => validDecision(database, ask, parseTarget(ticket.deliveryTarget)!)))
            fail('delivery_decision_required')
        }
        else if (!decisions.some(ask => ask.decisionType === 'delivery' && ask.status === 'answered' && ask.answer === 'accept_delivery' && decisionAuthorized(database, ask))) {
          fail('delivery_decision_required')
        }
        update(database, 'ticket', ticketId, { status: 'done', endedAt: now(), updatedAt: now() })
        satisfy(database, ticketId)
      }
      else if (event === 'ready' || event === 'session_ended') {
        if (ticket.failureReason && event === 'session_ended') {
          const status = ticket.status === 'running' ? 'review' : ticket.status
          update(database, 'ticket', ticketId, { status, updatedAt: now() })
          recordTransition(database, ticket, event, status, actor, reason || 'execution_ended_with_unresolved_failure', execution!.id)
          return required(database, 'ticket', ticketId)
        }
        if (!['running', 'review'].includes(ticket.status) || (ticket.failureReason && ticket.failureBindingId === execution!.id))
          fail('invalid_transition')
        update(database, 'ticket', ticketId, { status: 'review', ...(event === 'ready' ? { failureReason: null, failureBindingId: null } : {}), updatedAt: now() })
        recordTransition(database, ticket, event, 'review', actor, reason || event, execution!.id)
      }
      else {
        if (!reason.trim())
          fail('invalid_config')
        if (!['running', 'review'].includes(ticket.status) && !ticket.failureReason)
          fail('invalid_transition')
        update(database, 'ticket', ticketId, { failureReason: reason, failureBindingId: execution!.id, status: 'waiting', updatedAt: now() })
        recordTransition(database, ticket, 'failed', 'waiting', actor, reason, execution!.id)
      }
      return required(database, 'ticket', ticketId)
    })
  },
  pauseTicket(database: NexusDatabase, ticketId: string, paused: boolean, reason: string, actor: Actor): Row<'ticket'> {
    human(database, actor)
    required(database, 'ticket', ticketId)
    if (!reason.trim())
      fail('invalid_config')
    update(database, 'ticket', ticketId, { paused: Number(paused), pauseReason: reason, pauseActor: JSON.stringify(actor), pausedAt: now(), updatedAt: now() })
    return required(database, 'ticket', ticketId)
  },
  cancelTicket(database: NexusDatabase, ticketId: string, reason: string, actor: Actor): Row<'ticket'> {
    human(database, actor)
    const ticket = required(database, 'ticket', ticketId)
    if (!reason.trim() || ['done', 'cancelled'].includes(ticket.status))
      fail('invalid_transition')
    update(database, 'ticket', ticketId, { status: 'cancelled', endedAt: now(), pauseReason: reason, pauseActor: JSON.stringify(actor), updatedAt: now() })
    return required(database, 'ticket', ticketId)
  },
  linkTickets(database: NexusDatabase, ticketId: string, relatedId: string, kind: 'depends' | 'relates', actor: Actor): void {
    manager(database, actor, ['main'])
    required(database, 'ticket', ticketId)
    required(database, 'ticket', relatedId)
    if (ticketId === relatedId)
      fail('invalid_config')
    insert(database, 'ticket_link', { ticketId, relatedId, kind, createdAt: now() }, true)
  },
  resolveTicket(database: NexusDatabase, ticketId: string): { ticket: Row<'ticket'>, reasons: string[], dependencySatisfied: boolean } {
    const ticket = required(database, 'ticket', ticketId)
    const reasons: string[] = []
    const project = required(database, 'project', ticket.projectId)
    if (!project.enabled)
      reasons.push('project_disabled')
    if (!project.available)
      reasons.push('project_unavailable')
    if (ticket.paused)
      reasons.push('human_paused')
    if (ticket.failureReason)
      reasons.push('execution_failed')
    if (rows(database, 'ask').some(ask => ask.status === 'pending' && askTickets(database, ask.id).some(item => item.id === ticketId)))
      reasons.push('pending_ask')
    if (rows(database, 'message').some(message => message.ticketId === ticketId && message.error))
      reasons.push('delivery_failed')
    const links = rows(database, 'ticket_link').filter(link => link.ticketId === ticketId && link.kind === 'depends')
    const dependencySatisfied = links.every(link => !!link.satisfiedAt)
    if (!dependencySatisfied)
      reasons.push('dependency_unsatisfied')
    if (ticket.prState === 'merged' && ticket.status !== 'done')
      reasons.push('merged_awaiting_verification')
    return { ticket, reasons, dependencySatisfied }
  },
  sendMessage(database: NexusDatabase, id: string, recipient: string, ticketId: string | null, content: string, actor: Actor): Row<'message'> {
    return transaction(database, () => {
      if (!content.trim())
        fail('invalid_config')
      const input = { id, recipient, ticketId, content, sender: actorKey(actor), kind: 'message', askId: null, source: JSON.stringify({ actor }) }
      const receiver = recipient === 'human' ? null : load(database, 'role_binding', recipient)
      if (!receiver && recipient !== 'human') {
        const thread = required(database, 'thread', recipient)
        if (ticketId) {
          verifyTicketPublication(database, required(database, 'ticket', ticketId), thread, actor)
        }
        else {
          if (actor.kind !== 'agent' || agent(database, actor).role !== 'main')
            fail('scope_denied')
          verifyEnabledTopic(database, thread)
        }
        return enqueue(database, input)
      }
      if (receiver && ['closed', 'unavailable'].includes(receiver.status))
        fail('target_unavailable')
      if (receiver?.projectId)
        activeProject(database, receiver.projectId)
      const ticket = ticketId ? required(database, 'ticket', ticketId) : null
      if (ticket)
        activeProject(database, ticket.projectId)
      if (!isHuman(database, actor)) {
        const sender = agent(database, actor)
        if (!receiver)
          fail('scope_denied')
        if (ticket) {
          scope(database, sender, ticket)
          scope(database, receiver, ticket)
        }
        const allowed = sender.role === 'main' ? ['project', 'supervisor'] : sender.role === 'project' ? ['main', 'supervisor', 'worker'] : sender.role === 'supervisor' ? ['main', 'project'] : ['project']
        if (!allowed.includes(receiver.role) || (sender.role !== 'main' && !ticket))
          fail('scope_denied')
      }
      return enqueue(database, input)
    })
  },
  updateMessage(database: NexusDatabase, id: string, event: 'delivered' | 'read' | 'handled' | 'failed', error?: string): Row<'message'> {
    const message = required(database, 'message', id)
    if (message.supersededAt)
      fail('delivery_superseded')
    if (event === 'failed') {
      if (!error?.trim())
        fail('invalid_config')
      const attempts = message.attempts + 1
      const settings = ledger.getSettings(database)
      update(database, 'message', id, { attempts, error, deliveryState: attempts >= settings.deliveryMaxAttempts ? 'failed' : 'pending', nextRetryAt: new Date(Date.now() + Math.min(2 ** attempts, settings.deliveryRetryCeilingSeconds) * 1000).toISOString() })
    }
    else {
      const earlier = rows(database, 'message').some(item => item.ticketId === message.ticketId && item.recipient === message.recipient && item.seq < message.seq && !item.supersededAt && !(event === 'handled' ? item.handledAt : event === 'read' ? item.readAt : item.deliveredAt))
      if (earlier)
        fail('delivery_order')
      if (event === 'read' && !message.deliveredAt)
        fail('not_delivered')
      if (event === 'handled' && !message.readAt)
        fail('not_read')
      update(database, 'message', id, event === 'delivered' ? { deliveredAt: message.deliveredAt ?? now(), deliveryState: 'delivered', error: null, nextRetryAt: null } : event === 'read' ? { readAt: message.readAt ?? now() } : { handledAt: message.handledAt ?? now() })
    }
    return required(database, 'message', id)
  },
  transferMessages(database: NexusDatabase, previousBindingId: string, bindingId: string): void {
    transaction(database, () => {
      const previous = required(database, 'role_binding', previousBindingId)
      const next = required(database, 'role_binding', bindingId)
      if (previous.status !== 'closed' || !['idle', 'running'].includes(next.status) || next.previousBindingId !== previous.id || previous.role !== next.role || previous.scope !== next.scope)
        fail('binding_conflict')
      for (const ask of rows(database, 'ask').filter(ask => ask.handler === previousBindingId && ask.status === 'pending')) {
        rerouteAskDelivery(database, ask, bindingId)
        update(database, 'ask', ask.id, { handler: bindingId })
      }
      requireDatabase(database).prepare('UPDATE message SET recipient = ?, deliveredAt = NULL, deliveryState = ?, error = NULL, nextRetryAt = NULL WHERE recipient = ? AND readAt IS NULL AND supersededAt IS NULL').run(bindingId, 'pending', previousBindingId)
      requireDatabase(database).prepare('UPDATE ask SET responseRecipient = ? WHERE COALESCE(responseRecipient, initiatorBinding) = ? AND status = \'pending\'').run(bindingId, previousBindingId)
    })
  },
  saveChannel(database: NexusDatabase, id: string, name: string, enabled: boolean): Row<'channel'> {
    if (!id || !name.trim())
      fail('invalid_config')
    insert(database, 'channel', { id, name, enabled: Number(enabled), createdAt: now() }, true)
    update(database, 'channel', id, { name, enabled: Number(enabled) })
    return required(database, 'channel', id)
  },
  triageThread(database: NexusDatabase, threadId: string, projectId: string | null, disposition: 'claimed' | 'pending' | 'ignored', actor: Actor): Row<'thread'> {
    manager(database, actor, ['main'])
    const thread = required(database, 'thread', threadId)
    if (disposition === 'claimed' && !projectId)
      fail('invalid_config')
    if (projectId)
      verifyThreadRepository(database, thread, projectId)
    update(database, 'thread', thread.id, { projectId, triage: disposition, triagedAt: now() })
    return required(database, 'thread', threadId)
  },
  recordThread(database: NexusDatabase, input: ThreadInput): Row<'thread'> {
    if (!/^[a-z0-9.-]+\/[\w.-]+\/[\w.-]+$/i.test(input.repository) || !input.resourceId || !input.title)
      fail('invalid_source')
    if (input.projectId && required(database, 'project', input.projectId).repository !== input.repository)
      fail('scope_denied')
    const repository = input.repository.toLowerCase()
    const id = `${repository}:${input.kind}:${input.resourceId}`
    const existing = load(database, 'thread', id)
    if (existing) {
      if (existing.channelId !== input.channelId || (existing.projectId && input.projectId && existing.projectId !== input.projectId))
        fail('identity_conflict')
      update(database, 'thread', id, { title: input.title, url: input.url ?? existing.url, updatedAt: now() })
    }
    else {
      required(database, 'channel', input.channelId)
      insert(database, 'thread', { id, repository, channelId: input.channelId, projectId: input.projectId, refId: id, kind: input.kind, title: input.title, url: input.url, triage: input.projectId ? 'claimed' : 'pending', createdAt: now(), updatedAt: now() })
    }
    return required(database, 'thread', id)
  },
  recordTrigger(database: NexusDatabase, input: TriggerInput, actor: Actor): { trigger: Row<'trigger'>, authorized: boolean, accepted: boolean } {
    return transaction(database, () => {
      const thread = required(database, 'thread', input.threadId)
      if (!input.id || !Number.isFinite(Date.parse(input.at)) || actor.kind === 'agent')
        fail('invalid_source')
      if (actor.kind === 'github' && (!actor.verified || !actor.providerId || !actor.login))
        fail('invalid_source')
      if (actor.kind === 'web' && (!actor.authenticated || !actor.userId))
        fail('invalid_source')
      const existing = load(database, 'trigger', input.id)
      if (existing && (existing.threadId !== input.threadId || existing.text !== input.text))
        fail('identity_conflict')
      insert(database, 'trigger', { ...input, mentioned: Number(input.mentioned), channelId: thread.channelId, actorProviderId: actor.kind === 'github' ? actor.providerId : actor.userId, actorLogin: actor.kind === 'github' ? actor.login : null, actorSource: actor.kind, actorName: actor.kind === 'github' ? actor.login : actor.userId, human: Number(actor.kind === 'web' || (!actor.bot && !actor.outbound)), outbound: Number(actor.kind === 'github' && actor.outbound) }, true)
      return { trigger: required(database, 'trigger', input.id), authorized: isHuman(database, actor), accepted: !existing }
    })
  },
  subscribeThread(database: NexusDatabase, ticketId: string, threadId: string, actor: Actor, subscribed = true): void {
    const ticket = required(database, 'ticket', ticketId)
    if (!isHuman(database, actor)) {
      const caller = agent(database, actor)
      if (!['main', 'project'].includes(caller.role))
        fail('scope_denied')
      scope(database, caller, ticket)
    }
    const thread = required(database, 'thread', threadId)
    verifyThreadRepository(database, thread, ticket.projectId)
    if (thread.projectId && thread.projectId !== ticket.projectId)
      fail('scope_denied')
    if (subscribed)
      insert(database, 'ticket_thread', { ticketId, threadId, createdAt: now() }, true)
    else
      requireDatabase(database).prepare('DELETE FROM ticket_thread WHERE ticketId = ? AND threadId = ?').run(ticketId, threadId)
  },
  saveSourceState(database: NexusDatabase, channelId: string, name: string, value: string): void {
    required(database, 'channel', channelId)
    requireDatabase(database).prepare('INSERT INTO source_state (channelId, name, value, updatedAt) VALUES (?, ?, ?, ?) ON CONFLICT (channelId, name) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt').run(channelId, name, value, now())
  },
  handleWakeup(database: NexusDatabase, id: string): Row<'wakeup'> {
    const wakeup = required(database, 'wakeup', id)
    update(database, 'wakeup', id, { handledAt: wakeup.handledAt ?? now() })
    return required(database, 'wakeup', id)
  },
  publishMessage(database: NexusDatabase, messageId: string, recipient: string, actor: Actor): Row<'outbox'> {
    return transaction(database, () => {
      const message = required(database, 'message', messageId)
      if (message.supersededAt)
        fail('delivery_superseded')
      const thread = required(database, 'thread', recipient)
      if (message.ticketId) {
        verifyTicketPublication(database, required(database, 'ticket', message.ticketId), thread, actor)
      }
      else {
        verifyMainPublication(database, message, thread, actor)
      }
      const id = `${messageId}:${recipient}`
      const existing = load(database, 'outbox', id)
      if (existing)
        return existing
      insert(database, 'outbox', { id, messageId, recipient, ticketId: message.ticketId, content: message.content, askId: message.askId, seq: nextSeq(database, 'outbox'), createdAt: now() })
      return required(database, 'outbox', id)
    })
  },
  updateOutbox(database: NexusDatabase, id: string, state: 'sent' | 'failed' | 'unknown', detail: string, remoteId?: string, remoteUrl?: string): Row<'outbox'> {
    const item = required(database, 'outbox', id)
    if (item.state === 'sent')
      fail('already_delivered')
    if (state === 'sent' && !remoteId)
      fail('remote_link_required')
    if (state === 'sent' && !item.supersededAt && rows(database, 'outbox').some(row => row.ticketId === item.ticketId && row.recipient === item.recipient && row.seq < item.seq && !row.supersededAt && row.state !== 'sent'))
      fail('delivery_order')
    const attempts = item.state === 'unknown' || item.supersededAt ? Math.max(1, item.attempts) : item.attempts + 1
    update(database, 'outbox', id, { state, attempts, error: state === 'sent' ? null : detail, remoteId: remoteId ?? item.remoteId, remoteUrl: remoteUrl ?? item.remoteUrl, sentAt: state === 'sent' ? now() : null })
    return required(database, 'outbox', id)
  },
  recordAttention(database: NexusDatabase, input: AttentionInput): Row<'attention'> {
    if (input.ticketId)
      required(database, 'ticket', input.ticketId)
    if (input.askId)
      required(database, 'ask', input.askId)
    if (input.bindingId)
      required(database, 'role_binding', input.bindingId)
    const dueAt = new Date(Date.parse(input.progressAt) + ledger.getSettings(database).reminderIntervalMinutes * 60000).toISOString()
    insert(database, 'attention', { ...input, dueAt }, true)
    return required(database, 'attention', input.id)
  },
  updateAttention(database: NexusDatabase, id: string, event: 'reminded' | 'failed' | 'escalated' | 'handled', detail: string): Row<'attention'> {
    const attention = required(database, 'attention', id)
    if (!detail.trim())
      fail('invalid_config')
    update(database, 'attention', id, event === 'reminded' ? { remindedAt: now(), deliveryState: 'delivered' } : event === 'failed' ? { deliveryState: 'failed', deliveryError: detail } : event === 'escalated' ? { escalatedAt: now() } : { handledAt: now(), resolution: detail })
    return { ...attention, ...required(database, 'attention', id) }
  },
})

function now(): string {
  return new Date().toISOString()
}

function fail(code: string): never {
  throw new LedgerError(code)
}

function rows<T extends keyof DB>(database: NexusDatabase, table: T): Row<T>[] {
  return requireDatabase(database).prepare(`SELECT * FROM "${table}"`).all() as unknown as Row<T>[]
}

function load<T extends IdTable>(database: NexusDatabase, table: T, id: string): Row<T> | null {
  return requireDatabase(database).prepare(`SELECT * FROM "${table}" WHERE id = ?`).get(id) as unknown as Row<T> ?? null
}

function required<T extends IdTable>(database: NexusDatabase, table: T, id: string): Row<T> {
  return load(database, table, id) ?? fail('not_found')
}

function insert(database: NexusDatabase, table: keyof DB, values: Record<string, unknown>, ignore = false): void {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined)
  requireDatabase(database).prepare(`INSERT INTO "${table}" (${entries.map(([key]) => `"${key}"`).join(',')}) VALUES (${entries.map(() => '?').join(',')})${ignore ? ' ON CONFLICT DO NOTHING' : ''}`).run(...entries.map(([, value]) => value as SQLInputValue))
}

function update(database: NexusDatabase, table: keyof DB, id: string, values: Record<string, SQLInputValue>): void {
  const entries = Object.entries(values)
  requireDatabase(database).prepare(`UPDATE "${table}" SET ${entries.map(([key]) => `"${key}" = ?`).join(',')} WHERE id = ?`).run(...entries.map(([, value]) => value), id)
}

function isHuman(database: NexusDatabase, actor: Actor): boolean {
  return policy.peek(actor, JSON.parse(ledger.getSettings(database).whitelist) as string[])
}

function human(database: NexusDatabase, actor: Actor): void {
  if (!isHuman(database, actor))
    fail('human_required')
}

function actorKey(actor: Actor): string {
  return actor.kind === 'agent' ? actor.sessionId : actor.kind === 'web' ? actor.userId : actor.providerId
}

function agent(database: NexusDatabase, actor: Actor): Row<'role_binding'> {
  if (actor.kind !== 'agent')
    fail('unbound_actor')
  const binding = rows(database, 'role_binding').find(binding => binding.sessionId === actor.sessionId)
  if (!binding)
    fail('unbound_actor')
  if (binding.status === 'closed')
    fail('binding_closed')
  if (binding.status === 'unavailable')
    fail('target_unavailable')
  return binding
}

function manager(database: NexusDatabase, actor: Actor, roles: Role[]): void {
  if (!isHuman(database, actor) && !roles.includes(agent(database, actor).role as Role))
    fail('scope_denied')
}

function scope(database: NexusDatabase, binding: Row<'role_binding'>, ticket: Row<'ticket'>): void {
  if (binding.role === 'main')
    return
  if (binding.role === 'project' && binding.projectId === ticket.projectId)
    return
  if (binding.role === 'worker' && binding.ticketId === ticket.id)
    return
  if (binding.role === 'supervisor' && rows(database, 'supervisor_ticket').some(link => link.supervisorId === binding.supervisorId && link.ticketId === ticket.id))
    return
  fail('scope_denied')
}

function projectAuthority(database: NexusDatabase, actor: Actor, ticket: Row<'ticket'>): void {
  if (!isHuman(database, actor)) {
    const binding = agent(database, actor)
    if (binding.role !== 'project')
      fail('scope_denied')
    scope(database, binding, ticket)
  }
}

function ticketManager(database: NexusDatabase, actor: Actor, ticket: Row<'ticket'>): void {
  projectAuthority(database, actor, ticket)
  activeProject(database, ticket.projectId)
}

function activeProject(database: NexusDatabase, projectId: string): Row<'project'> {
  const project = required(database, 'project', projectId)
  if (!project.enabled)
    fail('project_disabled')
  if (!project.available || !project.repository)
    fail('project_unavailable')
  return project
}

function dispatchable(database: NexusDatabase, ticket: Row<'ticket'>): void {
  activeProject(database, ticket.projectId)
  if (ticket.paused)
    fail('human_paused')
  if (!ticket.authorization.trim() || !ticket.acceptanceCriteria.trim())
    fail('authorization_required')
  if (['done', 'cancelled'].includes(ticket.status))
    fail('ticket_closed')
  if (rows(database, 'ticket_link').some(link => link.ticketId === ticket.id && link.kind === 'depends' && !link.satisfiedAt))
    fail('dependency_unsatisfied')
}

function executionBinding(database: NexusDatabase, ticket: Row<'ticket'>, bindingId: string | undefined): Row<'role_binding'> {
  if (!bindingId)
    fail('execution_identity_required')
  if (ticket.executionBindingId !== bindingId)
    fail('stale_execution')
  const binding = required(database, 'role_binding', bindingId)
  if (binding.role !== 'worker' || binding.ticketId !== ticket.id)
    fail('scope_denied')
  return binding
}

function requireExecution(database: NexusDatabase, ticket: Row<'ticket'>, bindingId: string | undefined): Row<'role_binding'> {
  const binding = executionBinding(database, ticket, bindingId)
  if (!binding.startedAt)
    fail('execution_not_started')
  return binding
}

function executionReady(database: NexusDatabase, ticket: Row<'ticket'>): void {
  dispatchable(database, ticket)
  if (rows(database, 'ask').some(ask => ask.status === 'pending' && askTickets(database, ask.id).some(item => item.id === ticket.id)))
    fail('pending_ask')
}

function validatePolicy(snapshot: PolicySnapshot): void {
  if (!['detailed', 'important', 'automatic'].includes(snapshot.questionLevel) || !['follow_question_level', 'human_required', 'automatic_allowed'].includes(snapshot.mergePolicy))
    fail('invalid_config')
}

function snapshotOf(ticket: Row<'ticket'>): PolicySnapshot {
  return { questionLevel: ticket.questionLevel as PolicySnapshot['questionLevel'], mergePolicy: ticket.mergePolicy as PolicySnapshot['mergePolicy'] }
}

function basis(tickets: Row<'ticket'>[]): string {
  return JSON.stringify(tickets.map(ticket => ({ id: ticket.id, ...snapshotOf(ticket), revision: ticket.policyRevision, executionBindingId: ticket.executionBindingId })).sort((a, b) => a.id.localeCompare(b.id)))
}

function askTickets(database: NexusDatabase, askId: string): Row<'ticket'>[] {
  return rows(database, 'ask_ticket').filter(link => link.askId === askId).map(link => required(database, 'ticket', link.ticketId))
}

function route(database: NexusDatabase, initiator: Role, tickets: Row<'ticket'>[], decision: AskInput['decisionType'], withinAuthorization: boolean): string {
  if (!tickets.length)
    return 'human'
  const handlers = tickets.map((ticket) => {
    const bindings = rows(database, 'role_binding').filter(binding => binding.status !== 'closed')
    const supervisors = bindings.filter(binding => binding.role === 'supervisor' && rows(database, 'supervisor_ticket').some(link => link.supervisorId === binding.supervisorId && link.ticketId === ticket.id))
    if (supervisors.length > 1)
      fail('binding_conflict')
    const role = policy.resolve(snapshotOf(ticket), initiator, decision, withinAuthorization, supervisors.length === 1)
    if (role === 'human')
      return 'human'
    const binding = role === 'supervisor' ? supervisors[0] : bindings.find(binding => binding.activeKey === `${role}:${role === 'main' ? 'global' : ticket.projectId}`)
    if (!binding || !['idle', 'running'].includes(binding.status))
      fail('target_unavailable')
    return binding.id
  })
  return handlers.every(value => value === handlers[0]) ? handlers[0] : 'human'
}

function retireAskRequests(database: NexusDatabase, askId: string): void {
  requireDatabase(database).prepare('UPDATE message SET supersededAt = ?, deliveryState = \'superseded\', error = NULL, nextRetryAt = NULL WHERE askId = ? AND kind = \'ask\' AND supersededAt IS NULL').run(now(), askId)
  requireDatabase(database).prepare('UPDATE outbox SET supersededAt = ?, state = CASE WHEN state IN (\'pending\', \'failed\') THEN \'superseded\' ELSE state END, nextRetryAt = NULL WHERE messageId IN (SELECT id FROM message WHERE askId = ? AND kind = \'ask\') AND supersededAt IS NULL').run(now(), askId)
}

function rerouteAskDelivery(database: NexusDatabase, ask: Row<'ask'>, recipient: string): void {
  if (ask.handler === recipient)
    return
  if (recipient !== 'human' && !['idle', 'running'].includes(required(database, 'role_binding', recipient).status))
    fail('target_unavailable')
  retireAskRequests(database, ask.id)
  enqueue(database, { id: `ask:${ask.id}:route:${randomUUID()}`, ticketId: askTickets(database, ask.id)[0]?.id ?? null, recipient, sender: ask.handler, content: ask.content, kind: 'ask', askId: ask.id })
}

function pending(database: NexusDatabase, id: string): Row<'ask'> {
  const ask = required(database, 'ask', id)
  if (ask.status !== 'pending')
    fail(ask.status === 'cancelled' ? 'ask_cancelled' : 'ask_settled')
  return ask
}

function handler(database: NexusDatabase, ask: Row<'ask'>, actor: Actor): void {
  if (isHuman(database, actor))
    return
  if (ask.handler === 'human')
    fail('human_required')
  const caller = agent(database, actor)
  if (caller.id !== ask.handler || caller.id === ask.initiatorBinding)
    fail('not_current_handler')
  const tickets = askTickets(database, ask.id)
  if (route(database, ask.initiatorRole as Role, tickets, ask.decisionType as AskInput['decisionType'], !!ask.withinAuthorization) === 'human')
    fail('policy_changed')
  for (const ticket of tickets)
    scope(database, caller, ticket)
}

function parseTarget(value: string | null): MergeTarget | null {
  return value ? JSON.parse(value) as MergeTarget : null
}

function sameTarget(left: MergeTarget | undefined | null, right: MergeTarget | undefined | null): boolean {
  return !!left && !!right && left.repository === right.repository && left.pullRequest === right.pullRequest && left.base === right.base && left.head === right.head
}

function accepted(database: NexusDatabase, ticket: Row<'ticket'>): Row<'acceptance'> {
  const acceptance = latestAcceptance(database, ticket)
  if (!acceptance || acceptance.verdict !== 'accepted' || !(JSON.parse(acceptance.evidence) as string[]).length)
    fail('acceptance_evidence_required')
  return acceptance
}

function decisionAuthorized(database: NexusDatabase, ask: Row<'ask'>): boolean {
  if (!ask.answerActor || !ask.answerPolicy)
    return false
  const tickets = askTickets(database, ask.id)
  if (basis(tickets) !== ask.answerPolicy)
    return false
  const actor = JSON.parse(ask.answerActor) as Actor
  if (isHuman(database, actor))
    return true
  if (actor.kind !== 'agent')
    return false
  const binding = rows(database, 'role_binding').find(binding => binding.sessionId === actor.sessionId && binding.status !== 'closed')
  return !!binding && binding.id === ask.handler && route(database, ask.initiatorRole as Role, tickets, ask.decisionType as AskInput['decisionType'], !!ask.withinAuthorization) !== 'human'
}

function latestAcceptance(database: NexusDatabase, ticket: Row<'ticket'>): Row<'acceptance'> | null {
  return requireDatabase(database).prepare('SELECT * FROM acceptance WHERE ticketId = ? AND criteria = ? AND target IS ? AND executionBindingId IS ? ORDER BY rowid DESC LIMIT 1').get(ticket.id, ticket.acceptanceCriteria, ticket.deliveryTarget, ticket.executionBindingId) as unknown as Row<'acceptance'> ?? null
}

function validDecision(database: NexusDatabase, ask: Row<'ask'>, target: MergeTarget): boolean {
  const tickets = askTickets(database, ask.id)
  if (tickets.length !== 1)
    return false
  const ticket = tickets[0]
  const project = required(database, 'project', ticket.projectId)
  const acceptance = latestAcceptance(database, ticket)
  if (!project.enabled || !project.available || ticket.paused || ticket.failureReason || !ticket.executionBindingId || ['done', 'cancelled'].includes(ticket.status) || acceptance?.verdict !== 'accepted')
    return false
  return ask.decisionType === 'merge' && ask.status === 'answered' && ask.answer === 'allow_merge' && !!ask.verified
    && sameTarget(target, parseTarget(ask.target)) && tickets.length === 1 && sameTarget(target, parseTarget(tickets[0].deliveryTarget))
    && decisionAuthorized(database, ask)
}

function nextSeq(database: NexusDatabase, table: 'message' | 'outbox'): number {
  const row = requireDatabase(database).prepare(`SELECT COALESCE(MAX(seq), 0) + 1 AS seq FROM ${table}`).get()!
  return Number(row.seq)
}

function enqueue(database: NexusDatabase, input: { id: string, ticketId: string | null, recipient: string, sender: string, content: string, kind: string, askId: string | null, source?: string }): Row<'message'> {
  const existing = load(database, 'message', input.id)
  if (existing) {
    if (existing.recipient !== input.recipient || existing.ticketId !== input.ticketId || existing.content !== input.content)
      fail('identity_conflict')
    return existing
  }
  insert(database, 'message', { ...input, seq: nextSeq(database, 'message'), acceptedAt: now() })
  return required(database, 'message', input.id)
}

function recordTransition(database: NexusDatabase, ticket: Row<'ticket'>, event: string, toStatus: string, actor: Actor, reason: string, bindingId?: string): void {
  insert(database, 'ticket_transition', { id: randomUUID(), ticketId: ticket.id, event, fromStatus: ticket.status, toStatus, actor: JSON.stringify(actor), reason, bindingId, at: now() })
}

function satisfy(database: NexusDatabase, ticketId: string): void {
  for (const link of rows(database, 'ticket_link').filter(link => link.relatedId === ticketId && link.kind === 'depends' && !link.satisfiedAt)) {
    const id = `${link.ticketId}:${ticketId}`
    insert(database, 'wakeup', { id, ticketId: link.ticketId, relatedId: ticketId, reason: 'dependency_delivered', createdAt: now() }, true)
    requireDatabase(database).prepare('UPDATE ticket_link SET satisfiedAt = ?, wakeupId = ? WHERE ticketId = ? AND relatedId = ? AND kind = ?').run(now(), id, link.ticketId, ticketId, 'depends')
  }
}

function verifyTicketPublication(database: NexusDatabase, ticket: Row<'ticket'>, thread: Row<'thread'>, actor: Actor): void {
  const project = activeProject(database, ticket.projectId)
  if (ticket.paused)
    fail('human_paused')
  verifyThreadRepository(database, thread, ticket.projectId)
  const subscription = rows(database, 'ticket_thread').some(link => link.ticketId === ticket.id && link.threadId === thread.id)
  if (thread.projectId !== project.id || !subscription)
    fail('scope_denied')
  if (!isHuman(database, actor)) {
    const caller = agent(database, actor)
    scope(database, caller, ticket)
    if (caller.role === 'supervisor')
      fail('scope_denied')
  }
}

function verifyEnabledTopic(database: NexusDatabase, thread: Row<'thread'>): void {
  if (!thread.projectId)
    fail('scope_denied')
  activeProject(database, thread.projectId)
  verifyThreadRepository(database, thread, thread.projectId)
}

function verifyMainPublication(database: NexusDatabase, message: Row<'message'>, thread: Row<'thread'>, actor: Actor): void {
  if (!isHuman(database, actor) && agent(database, actor).role !== 'main')
    fail('scope_denied')
  verifyEnabledTopic(database, thread)
  if (message.askId) {
    const ask = required(database, 'ask', message.askId)
    const initiator = ask.initiatorBinding ? load(database, 'role_binding', ask.initiatorBinding) : null
    if (ask.initiatorRole !== 'main' || initiator?.role !== 'main' || ask.source !== thread.id || askTickets(database, ask.id).length)
      fail('scope_denied')
  }
  else {
    const provenance = message.source ? JSON.parse(message.source) as { actor?: Actor } : null
    const origin = provenance?.actor
    const initiator = origin?.kind === 'agent' ? rows(database, 'role_binding').find(binding => binding.sessionId === origin.sessionId) : null
    if (message.kind !== 'message' || origin?.kind !== 'agent' || initiator?.role !== 'main' || message.sender !== origin.sessionId)
      fail('scope_denied')
  }
}

function verifyThreadRepository(database: NexusDatabase, thread: Row<'thread'>, projectId: string): void {
  if (!thread.repository)
    fail('repository_identity_unverified')
  if (thread.repository !== required(database, 'project', projectId).repository)
    fail('scope_denied')
}

function repositoryIdentity(remoteUrl: string): string {
  const normalized = remoteUrl.replace(/^git@([^:]+):/, 'https://$1/').replace(/\.git$/, '')
  let url: URL
  try {
    url = new URL(normalized)
  }
  catch {
    fail('invalid_repository')
  }
  const path = url.pathname.replace(/^\/|\/$/g, '')
  if (!['https:', 'ssh:'].includes(url.protocol) || !url.hostname || path.split('/').length !== 2)
    fail('invalid_repository')
  return `${url.hostname.toLowerCase()}/${path.toLowerCase()}`
}
