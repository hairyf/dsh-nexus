import type { NexusDatabase } from '../database'
import type { Actor, AnswerInput, PolicySnapshot, Row, SettingsPatch } from '../types/ledger'
import type { ChannelModel, InboxAsk, InboxModel, OverviewModel, PanelModel, SourceContext, TicketDetailModel, TopicsModel, WebPorts, WebSettings } from '../types/web'
import { LedgerError } from '../database'
import { defineService } from '../utils/service'
import { ledger } from './ledger'

export const webPanel = defineService({
  create(database: NexusDatabase, ports: WebPorts) {
    function asks(): InboxAsk[] {
      const bindings = ledger.list(database, 'role_binding')
      const links = ledger.list(database, 'ask_ticket')
      const tickets = ledger.list(database, 'ticket')
      const attention = ledger.list(database, 'attention')
      const messages = ledger.list(database, 'message')
      const outbox = ledger.list(database, 'outbox')
      const evidence = ledger.list(database, 'acceptance')
      const projects = ledger.list(database, 'project')
      const threads = ledger.list(database, 'thread')
      const external = new Map(projects.filter(project => project.repository).map(project => [project.id, ports.githubStatus(project.id)]))
      return ledger.list(database, 'ask').map((ask) => {
        const ticketIds = links.filter(link => link.askId === ask.id).map(link => link.ticketId)
        return {
          ...ask,
          options: JSON.parse(ask.options) as string[],
          presentation: ask.presentation ? JSON.parse(ask.presentation) as InboxAsk['presentation'] : {},
          target: ask.target ? JSON.parse(ask.target) as InboxAsk['target'] : null,
          selections: ask.selections ? JSON.parse(ask.selections) as string[] : null,
          ticketIds,
          waiting: bindings.find(binding => binding.id === (ask.responseRecipient ?? ask.initiatorBinding)) ?? null,
          waitingMilliseconds: Date.parse(ask.answeredAt ?? ask.cancelledAt ?? new Date().toISOString()) - Date.parse(ask.createdAt),
          humanRequired: ['merge', 'delivery'].includes(ask.decisionType) && tickets.some(ticket => ticketIds.includes(ticket.id) && ticket.mergePolicy === 'human_required'),
          actionable: ask.status === 'pending' && ask.handler === 'human',
          reminders: attention.filter(item => item.askId === ask.id && !item.handledAt).map(item => ({ ...item, due: Date.parse(item.dueAt) <= Date.now() })),
          deliveries: messages.filter(item => item.askId === ask.id && !item.supersededAt).map(item => ({ ...item, state: item.error ? 'delivery_failed' : item.handledAt ? 'handled' : item.readAt ? 'in_context' : item.deliveredAt ? 'delivered' : 'waiting' })),
          publications: outbox.filter(item => item.askId === ask.id).map((item) => {
            const thread = threads.find(thread => thread.id === item.recipient)
            const projectId = tickets.find(ticket => ticket.id === item.ticketId)?.projectId ?? thread?.projectId ?? projects.find(project => project.repository === thread?.repository)?.id
            const fact = projectId ? external.get(projectId)?.find(fact => fact.name === `delivery_status:${item.id}`) : null
            const status = fact?.value as { ok: boolean, reason?: string } | undefined
            return { ...item, syncProblem: status?.ok === false ? status.reason ?? 'sync_failed' : null, syncAt: fact?.updatedAt ?? null }
          }),
          evidence: evidence.filter(item => ticketIds.includes(item.ticketId) && (!ask.target || item.target === ask.target) && tickets.some(ticket => ticket.id === item.ticketId && ticket.executionBindingId === item.executionBindingId)),
        }
      })
    }

    function inbox(): InboxModel {
      const all = asks()
      const reminders = ledger.list(database, 'message').filter(item => item.recipient === 'human' && item.kind === 'runtime:reminder' && !item.handledAt && !item.supersededAt)
      return {
        pending: all.filter(ask => ask.status === 'pending' && (ask.actionable || ask.reminders.some(item => item.recipient === 'human' && item.due) || reminders.some(message => message.askId === ask.id))),
        resolved: all.filter(ask => ask.status !== 'pending' && (ask.answerSource === 'web' || ask.answerSource === 'github' || ask.handler === 'human')).sort((a, b) => (b.answeredAt ?? b.cancelledAt ?? '').localeCompare(a.answeredAt ?? a.cancelledAt ?? '')).slice(0, 50),
        blocked: ledger.list(database, 'ticket').filter(ticket => ticket.paused).map(ticket => ({ ticket, reason: ticket.pauseReason, waitingFor: 'human', since: ticket.pausedAt })),
        reminders: ledger.list(database, 'attention').filter(item => !item.askId && !item.handledAt && Date.parse(item.dueAt) <= Date.now() && item.reason !== 'human_paused' && (item.recipient === 'human' || reminders.some(message => message.source === `attention:${item.id}:${item.progressAt}`))),
      }
    }

    function overview(): OverviewModel {
      const projects = ledger.list(database, 'project')
      const tickets = ledger.list(database, 'ticket').map(ticket => ledger.resolveTicket(database, ticket.id))
      const bindings = ledger.list(database, 'role_binding').filter(binding => binding.status !== 'closed')
      const scopes = ledger.list(database, 'supervisor_ticket')
      const nodes = [
        ...projects.map(project => ({ id: `project:${project.id}`, kind: 'project', label: project.name, status: project.enabled ? project.available ? 'enabled' : 'unavailable' : 'disabled', projectId: project.id, ticketId: null as string | null, sessionId: null as string | null })),
        ...tickets.map(({ ticket }) => ({ id: `ticket:${ticket.id}`, kind: 'ticket', label: ticket.title, status: ticket.paused ? 'paused' : ticket.failureReason ? 'error' : ticket.status, projectId: ticket.projectId, ticketId: ticket.id, sessionId: null as string | null })),
        ...bindings.map(binding => ({ id: `binding:${binding.id}`, kind: binding.role, label: `${binding.role} · ${binding.sessionId}`, status: binding.status, projectId: binding.projectId, ticketId: binding.ticketId, sessionId: binding.sessionId })),
      ]
      const edges: { source: string, target: string, kind: 'flow' | 'association' | 'dependency' }[] = []
      const main = bindings.find(binding => binding.role === 'main')
      for (const project of projects) {
        if (main)
          edges.push({ source: `binding:${main.id}`, target: `project:${project.id}`, kind: 'flow' })
      }
      for (const binding of bindings) {
        if (binding.role === 'project')
          edges.push({ source: `project:${binding.projectId}`, target: `binding:${binding.id}`, kind: 'association' })
        if (binding.role === 'supervisor') {
          if (main)
            edges.push({ source: `binding:${main.id}`, target: `binding:${binding.id}`, kind: 'flow' })
          for (const scope of scopes.filter(scope => scope.supervisorId === binding.supervisorId))
            edges.push({ source: `binding:${binding.id}`, target: `ticket:${scope.ticketId}`, kind: 'association' })
        }
        if (binding.role === 'worker')
          edges.push({ source: `ticket:${binding.ticketId}`, target: `binding:${binding.id}`, kind: 'flow' })
      }
      for (const { ticket } of tickets)
        edges.push({ source: `project:${ticket.projectId}`, target: `ticket:${ticket.id}`, kind: 'flow' })
      for (const link of ledger.list(database, 'ticket_link'))
        edges.push({ source: `ticket:${link.ticketId}`, target: `ticket:${link.relatedId}`, kind: link.kind === 'depends' ? 'dependency' : 'association' })
      return { projects, tickets, graph: { nodes, edges } }
    }

    function topics(): TopicsModel {
      return { threads: ledger.list(database, 'thread'), triggers: ledger.list(database, 'trigger'), subscriptions: ledger.list(database, 'ticket_thread') }
    }

    function channels(): ChannelModel[] {
      return ledger.list(database, 'project').map((project) => {
        const facts = project.repository ? ports.githubStatus(project.id) : []
        if (!project.repository || !project.enabled || !project.available)
          return { projectId: project.id, name: project.name, repository: project.repository, available: false, reason: project.attentionReason ?? (!project.repository ? 'repository_identity_unverified' : !project.enabled ? 'project_disabled' : 'project_unavailable'), facts }
        const environment = facts.find(fact => fact.name === 'environment_status')?.value as { available: boolean, reason: string | null } | undefined
        return { projectId: project.id, name: project.name, repository: project.repository, available: environment?.available ?? false, reason: environment?.reason ?? (environment ? null : 'environment_not_selected'), facts }
      })
    }

    function settings(): WebSettings {
      const setting = ledger.getSettings(database)
      return { ...setting, whitelist: JSON.parse(setting.whitelist) as string[] }
    }

    function resolve(): PanelModel {
      const bindings = ledger.list(database, 'role_binding').filter(item => item.status !== 'closed')
      const unavailable = bindings.find(item => item.status === 'unavailable')
      const failed = ledger.list(database, 'message').find(item => item.error && !item.readAt && !item.handledAt && !item.supersededAt)
      const outbox = ledger.list(database, 'outbox').find(item => ['failed', 'unknown'].includes(item.state) && !item.supersededAt)
      const startup = ports.startup()
      const run: PanelModel['run'] = startup.state !== 'ready'
        ? { state: startup.state === 'starting' ? 'initializing' : 'initialization_failed', reason: startup.reason }
        : failed || outbox
          ? { state: 'delivery_failed', reason: failed?.error ?? outbox?.error ?? 'remote_result_unknown' }
          : unavailable
            ? { state: 'unavailable', reason: unavailable.recoveryReason }
            : { state: bindings.some(item => item.status === 'running') ? 'running' : 'idle', reason: null }
      return { ...overview(), run, inbox: inbox(), topics: topics(), channels: channels(), settings: settings() }
    }

    function ticket(id: string): TicketDetailModel {
      const result = ledger.resolveTicket(database, id)
      const topic = topics()
      const subscriptions = topic.subscriptions.filter(link => link.ticketId === id)
      return {
        ...result,
        project: ledger.load(database, 'project', result.ticket.projectId),
        executions: ledger.list(database, 'role_binding').filter(binding => binding.ticketId === id),
        history: ledger.list(database, 'ticket_transition').filter(item => item.ticketId === id),
        dependencies: ledger.list(database, 'ticket_link').filter(item => item.ticketId === id || item.relatedId === id),
        evidence: ledger.list(database, 'acceptance').filter(item => item.ticketId === id),
        messages: ledger.list(database, 'message').filter(item => item.ticketId === id && !item.supersededAt),
        topics: topic.threads.filter(thread => subscriptions.some(link => link.threadId === thread.id)),
        asks: asks().filter(ask => ask.ticketIds.includes(id)),
      }
    }

    async function refreshProjects(): Promise<Row<'project'>[]> {
      const discovered = await ports.discoverProjects()
      const previous = ledger.list(database, 'project')
      for (const input of discovered) {
        const existing = previous.find(project => project.workspaceId === input.workspaceId)
        ledger.createProject(database, { ...input, id: existing?.id ?? input.id })
      }
      for (const project of previous.filter(project => !discovered.some(input => input.workspaceId === project.workspaceId) && project.remoteUrl))
        ledger.createProject(database, { id: project.id, workspaceId: project.workspaceId, directory: project.directory, name: project.name, remoteUrl: project.remoteUrl!, available: false })
      for (const project of ledger.list(database, 'project').filter(project => project.enabled && !project.available))
        await ports.runtime.projectChanged(project.id)
      return ledger.list(database, 'project')
    }

    async function setProject(id: string, enabled: boolean, actor: Actor): Promise<{ project: Row<'project'>, interruptions: Awaited<ReturnType<WebPorts['runtime']['projectChanged']>> }> {
      const project = ledger.updateProject(database, id, enabled, actor)
      const interruptions = await ports.runtime.projectChanged(id)
      return { project, interruptions }
    }

    async function command(id: string, action: 'pause' | 'resume' | 'cancel' | 'retry' | 'dispatch', reason: string, actor: Actor): Promise<Awaited<ReturnType<WebPorts['runtime']['dispatch'] | WebPorts['runtime']['pause'] | WebPorts['runtime']['cancel'] | WebPorts['runtime']['retry']>>> {
      if (action === 'dispatch')
        return ports.runtime.dispatch(id, actor)
      if (!reason.trim())
        throw new LedgerError('reason_required')
      if (action === 'pause' || action === 'resume')
        return ports.runtime.pause(id, action === 'pause', reason, actor, signal => ports.reconcileExternal(id, signal))
      if (action === 'cancel')
        return ports.runtime.cancel(id, reason, actor)
      return ports.runtime.retry(id, reason, actor, signal => ports.reconcileExternal(id, signal))
    }

    async function answer(input: AnswerInput, actor: Actor): Promise<{ result: Awaited<ReturnType<WebPorts['communication']['answer']>>, ask: InboxAsk }> {
      const current = ledger.load(database, 'ask', input.askId)
      let verified = false
      if (current?.status === 'pending' && current.decisionType === 'merge' && input.answer === 'allow_merge') {
        const verification = await ports.verifyMerge(current, actor)
        if (!input.target || (['repository', 'pullRequest', 'base', 'head'] as const).some(key => input.target![key] !== verification.target[key]))
          throw new LedgerError('stale_target')
        verified = verification.verified
      }
      const result = await ports.communication.answer({ ...input, verified }, actor)
      return { result, ask: asks().find(ask => ask.id === input.askId)! }
    }

    async function context(sessionId: string): Promise<SourceContext> {
      if (!ledger.list(database, 'role_binding').some(binding => binding.sessionId === sessionId))
        throw new LedgerError('unknown_binding')
      const context = await ports.sourceContext(sessionId)
      return { ...context, sessionId, entries: context.entries.slice(-8) }
    }

    function setSettings(patch: SettingsPatch, actor: Actor): WebSettings {
      ledger.updateSettings(database, patch, actor)
      return settings()
    }

    function setPolicy(id: string, policy: PolicySnapshot, reason: string, actor: Actor): Row<'ticket'> {
      return ledger.setPolicy(database, id, policy, reason, actor)
    }

    return { mailbox: ports.runtime.mailbox, handleMail: ports.runtime.handleMail, resolve, overview, inbox, ticket, topics, channels, settings, refreshProjects, setProject, command, answer, context, setSettings, setPolicy }
  },
})
