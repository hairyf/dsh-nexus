import type { NexusDatabase } from '../database'
import type { HostTimers, RecoveryResult, SessionGateway, SessionSnapshot, StartResult, StopResult, Workspace } from '../runtime/types'
import type { Actor, AttentionInput, BindingInput, Row, RuntimeEventInput } from '../types/ledger'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { LedgerError } from '../database'
import { checkInterrupt, interruptible } from '../runtime/interrupt'
import { createWorkspace, planWorkspace, verifyWorkspace } from '../runtime/worktree'
import { defineService } from '../utils/service'
import { ledger } from './ledger'

const operations = new Map<string, Promise<unknown>>()
const mailboxes = new Map<string, Promise<unknown>>()

export const runtime = defineService({
  create(database: NexusDatabase, gateway: SessionGateway, timers: HostTimers, managerDirectory: string) {
    const presets = { main: 'orchestrator', project: 'manager', supervisor: 'supervisor', worker: 'worker' }

    function exclusive<T>(key: string, operation: () => Promise<T>): Promise<T> {
      key = `${database.stateDirectory}:${key}`
      const current = operations.get(key)
      if (current)
        return current as Promise<T>
      const promise = operation().finally(() => operations.delete(key))
      operations.set(key, promise)
      return promise
    }

    async function resolve(sessionId: string, signal?: AbortSignal): Promise<{ binding: Row<'role_binding'>, session: SessionSnapshot }> {
      checkInterrupt(signal)
      const binding = ledger.list(database, 'role_binding').find(binding => binding.sessionId === sessionId)
      if (!binding)
        throw new LedgerError('unknown_binding')
      if (binding.status === 'closed')
        throw new LedgerError('closed_session')
      const session = await interruptible(() => gateway.inspect(sessionId, signal), signal)
      if (session.origin === 'subagent' || session.parentSession)
        throw new LedgerError('unknown_binding')
      if (session.state === 'closed')
        throw new LedgerError('closed_session')
      return { binding, session }
    }

    async function bind(input: BindingInput, actor?: Actor, signal?: AbortSignal): Promise<Row<'role_binding'>> {
      checkInterrupt(signal)
      return exclusive(`bind:${input.id}`, async () => {
        if (input.role === 'worker')
          throw new LedgerError('dispatch_required')
        if (input.previousBindingId && (!actor || !input.recoveryReason?.trim()))
          throw new LedgerError('management_authorization_required')
        if (!/^[a-z0-9][\w-]*$/i.test(input.id))
          throw new LedgerError('invalid_config')
        const existing = ledger.load(database, 'role_binding', input.id)
        if (existing) {
          if (existing.status === 'closed')
            throw new LedgerError('closed_session')
          if (existing.sessionId !== input.sessionId || existing.role !== input.role)
            throw new LedgerError('binding_conflict')
          return existing
        }
        const session = await interruptible(() => gateway.inspect(input.sessionId, signal), signal)
        if (session.state !== 'missing')
          throw new LedgerError('binding_conflict')
        const reserved = ledger.load(database, 'role_binding', input.id)
        if (reserved) {
          if (reserved.sessionId !== input.sessionId || reserved.role !== input.role)
            throw new LedgerError('binding_conflict')
          return reserved
        }
        const binding = ledger.bindRole(database, input, actor)
        if (input.previousBindingId)
          ledger.transferMessages(database, input.previousBindingId, binding.id)
        const cwd = join(managerDirectory, binding.id)
        try {
          await mkdir(cwd, { recursive: true })
          await interruptible(() => gateway.create(binding.sessionId, presets[input.role], cwd, signal), signal)
          return binding
        }
        catch (error) {
          ledger.updateBinding(database, binding.id, 'unavailable', errorCode(error))
          attention(binding, errorCode(error))
          throw error
        }
      })
    }

    function bindingById(id: string): Row<'role_binding'> {
      const binding = ledger.load(database, 'role_binding', id)
      if (!binding)
        throw new LedgerError('unknown_binding')
      return binding
    }

    function workspaceOf(binding: Row<'role_binding'>): Workspace {
      const project = ledger.load(database, 'project', binding.projectId!)!
      if (!binding.baseCommit || !binding.repository || !binding.worktree || !binding.branch || !binding.ticketId)
        throw new LedgerError('workspace_conflict', 'Execution metadata requires verification')
      return { bindingId: binding.id, projectId: project.id, ticketId: binding.ticketId, repository: binding.repository, root: project.directory, remoteUrl: project.remoteUrl!, path: binding.worktree, branch: binding.branch, baseCommit: binding.baseCommit }
    }

    function projectBinding(projectId: string): Row<'role_binding'> {
      const binding = ledger.list(database, 'role_binding').find(binding => binding.role === 'project' && binding.projectId === projectId && binding.status !== 'closed')
      if (!binding)
        throw new LedgerError('unknown_binding', 'Project responsibility requires recovery')
      return binding
    }

    function projectActor(projectId: string): Actor {
      return { kind: 'agent', sessionId: projectBinding(projectId).sessionId }
    }

    function attention(binding: Row<'role_binding'>, reason: string): void {
      const item = ledger.recordAttention(database, { id: `runtime:${binding.id}:${reason}`, bindingId: binding.id, ticketId: binding.ticketId ?? undefined, recipient: binding.id, reason, waitingFor: 'runtime reconciliation', progressAt: new Date().toISOString() })
      armAttention(item)
    }

    async function dispatch(ticketId: string, actor: Actor, signal?: AbortSignal): Promise<{ accepted: true, started: false, ticket: Row<'ticket'> }> {
      checkInterrupt(signal)
      const ticket = ledger.dispatchTicket(database, ticketId, actor)
      return { accepted: true as const, started: false as const, ticket }
    }

    async function start(ticketId: string, actor: Actor, signal?: AbortSignal): Promise<StartResult> {
      checkInterrupt(signal)
      ledger.dispatchTicket(database, ticketId, actor)
      return exclusive(`execution:${ticketId}`, async () => {
        const ticket = ledger.load(database, 'ticket', ticketId)!
        const existing = ledger.list(database, 'role_binding').find(binding => binding.role === 'worker' && binding.ticketId === ticketId && binding.status !== 'closed')
        if (existing)
          throw new LedgerError('execution_conflict', 'Existing execution requires reconciliation')
        const project = ledger.load(database, 'project', ticket.projectId)!
        const id = randomUUID()
        const workspace = await planWorkspace(project.directory, project.remoteUrl!, join(database.stateDirectory, 'worktrees'), { bindingId: id, projectId: project.id, ticketId, repository: project.repository! }, signal)
        checkInterrupt(signal)
        let binding: Row<'role_binding'>
        try {
          binding = ledger.bindRole(database, { id, role: 'worker', sessionId: id, projectId: project.id, ticketId, repository: workspace.repository, worktree: workspace.path, branch: workspace.branch, baseCommit: workspace.baseCommit, previousBindingId: ledger.list(database, 'role_binding').filter(item => item.ticketId === ticketId && item.role === 'worker' && item.status === 'closed').at(-1)?.id, recoveryReason: 'authorized dispatch after reconciliation' }, actor)
        }
        catch (error) {
          if (error instanceof LedgerError && error.code === 'worker_limit') {
            await watch({ id: `queue:${ticketId}`, ticketId, recipient: projectBinding(project.id).id, reason: 'worker_limit', waitingFor: 'worker slot', progressAt: ticket.updatedAt }, signal)
            return { accepted: true as const, started: false as const, reason: 'worker_limit', ticket }
          }
          throw error
        }
        try {
          await createWorkspace(workspace, signal)
          await verifyWorkspace(workspace, signal)
          checkInterrupt(signal)
          await interruptible(() => gateway.create(binding.sessionId, presets.worker, workspace.path, signal), signal)
          const session = await interruptible(() => gateway.inspect(binding.sessionId, signal), signal)
          if (session.cwd !== workspace.path || session.origin === 'subagent' || session.parentSession)
            throw new LedgerError('workspace_conflict')
          checkInterrupt(signal)
          const started = ledger.startTicket(database, ticketId, binding.id, actor)
          ledger.verifyExecutionMetadata(database, ticketId, binding.id, { repository: workspace.repository, worktree: workspace.path, branch: workspace.branch, baseCommit: workspace.baseCommit }, 'workspace ownership verified', actor)
          if (ledger.load(database, 'attention', `queue:${ticketId}`))
            await settleAttention(`queue:${ticketId}`, 'execution started', signal)
          armBudget(bindingById(binding.id))
          await watch({ id: `execution:${binding.id}`, ticketId, bindingId: binding.id, recipient: projectBinding(project.id).id, reason: 'execution_in_progress', waitingFor: binding.id, progressAt: started.updatedAt }, signal)
          await intake({ id: `execution:${binding.id}`, source: `dispatch:${ticketId}`, recipient: binding.id, ticketId, kind: 'ticket', content: JSON.stringify({ title: ticket.title, description: ticket.description, authorization: ticket.authorization, acceptanceCriteria: ticket.acceptanceCriteria, worktree: workspace.path, deliveryTarget: ticket.deliveryTarget, prState: ticket.prState, previousBindingId: binding.previousBindingId }) }, signal)
          return { accepted: true as const, started: true as const, ticket: started, binding: bindingById(binding.id) }
        }
        catch (error) {
          ledger.updateBinding(database, binding.id, 'unavailable', errorCode(error))
          attention(binding, errorCode(error))
          throw error
        }
      })
    }

    async function stop(ticketId: string, reason: string, signal?: AbortSignal, actor?: Actor): Promise<StopResult> {
      const binding = ledger.list(database, 'role_binding').find(binding => binding.ticketId === ticketId && binding.role === 'worker' && binding.status !== 'closed')
      if (!binding)
        return { stopped: true as const }
      return exclusive(`stop:${binding.id}`, async () => {
        attention(binding, `stop_requested:${reason}`)
        if (!await interruptible(() => gateway.stop(binding.sessionId, reason, signal), signal))
          return { stopped: false as const, reason: 'execution_stop_unconfirmed' }
        ledger.confirmExecutionStopped(database, ticketId, binding.id, reason, actor ?? projectActor(binding.projectId!))
        for (const item of ledger.list(database, 'attention').filter(item => item.bindingId === binding.id && !item.handledAt && (item.reason === 'execution_in_progress' || item.reason.startsWith('stop_requested:'))))
          await settleAttention(item.id, `writer shutdown verified: ${reason}`, signal)
        return { stopped: true as const }
      })
    }

    async function pause(ticketId: string, paused: boolean, reason: string, actor: Actor, signal?: AbortSignal): Promise<{ ticket: Row<'ticket'>, stopped: boolean, reason?: string }> {
      checkInterrupt(signal)
      const ticket = ledger.pauseTicket(database, ticketId, paused, reason, actor)
      return { ticket, ...(paused ? await stop(ticketId, reason, signal, actor) : { stopped: false }) }
    }

    async function cancel(ticketId: string, reason: string, actor: Actor, signal?: AbortSignal): Promise<{ ticket: Row<'ticket'> } & StopResult> {
      checkInterrupt(signal)
      const ticket = ledger.cancelTicket(database, ticketId, reason, actor)
      return { ticket, ...await stop(ticketId, reason, signal, actor) }
    }

    async function retry(ticketId: string, reason: string, actor: Actor, reconcileExternal: (signal?: AbortSignal) => Promise<'verified' | 'unknown'>, signal?: AbortSignal): Promise<Row<'ticket'>> {
      checkInterrupt(signal)
      if (!ledger.load(database, 'ticket', ticketId))
        throw new LedgerError('not_found')
      const previous = ledger.list(database, 'role_binding').filter(binding => binding.ticketId === ticketId && binding.role === 'worker')
      for (const binding of previous) {
        if (!ledger.list(database, 'ticket_transition').some(item => item.bindingId === binding.id && item.event === 'execution_stopped'))
          throw new LedgerError('execution_conflict', 'Old writer shutdown has not been confirmed')
        await verifyWorkspace(workspaceOf(binding), signal)
      }
      if (await interruptible(() => reconcileExternal(signal), signal) !== 'verified' || ledger.list(database, 'outbox').some(item => item.ticketId === ticketId && item.state === 'unknown'))
        throw new LedgerError('unknown_remote_result')
      checkInterrupt(signal)
      for (const binding of previous.filter(binding => binding.status !== 'closed')) {
        ledger.confirmExecutionStopped(database, ticketId, binding.id, reason, actor)
      }
      return ledger.retryTicket(database, ticketId, reason, actor)
    }

    function errorCode(error: unknown): string {
      return error instanceof LedgerError ? error.code : error instanceof Error ? error.message : String(error)
    }

    function serializeMailbox<T>(key: string, operation: () => Promise<T>): Promise<T> {
      key = `${database.stateDirectory}:${key}`
      const previous = mailboxes.get(key) ?? Promise.resolve()
      const next = previous.then(operation, operation).finally(() => {
        if (mailboxes.get(key) === next)
          mailboxes.delete(key)
      })
      mailboxes.set(key, next)
      return next
    }

    async function deliver(messageId: string, signal?: AbortSignal): Promise<Row<'message'>> {
      checkInterrupt(signal)
      const requested = ledger.load(database, 'message', messageId)
      if (!requested)
        throw new LedgerError('not_found')
      await interruptible(() => serializeMailbox(`${requested.recipient}:${requested.ticketId}`, async () => {
        const messages = ledger.list(database, 'message').filter(item => item.recipient === requested.recipient && item.ticketId === requested.ticketId && !item.readAt && !item.supersededAt).sort((a, b) => a.seq - b.seq)
        for (const message of messages) {
          checkInterrupt(signal)
          try {
            const { binding, session } = await resolve(messageRecipient(message), signal)
            if (!['idle', 'running'].includes(session.state))
              throw new LedgerError(session.state === 'closed' ? 'closed_session' : 'session_requires_recovery')
            const receipt = await interruptible(() => gateway.receipt(binding.sessionId, message.id, signal), signal)
            if (receipt === 'unknown')
              throw new LedgerError('unknown_remote_result')
            if (receipt === 'absent') {
              if (message.deliveryState === 'failed')
                throw new LedgerError('delivery_failed')
              if (message.error && message.nextRetryAt && Date.parse(message.nextRetryAt) > Date.now())
                throw new LedgerError('delivery_pending')
              let mode: 'wake' | 'queue' | 'interrupt' = session.state === 'idle' ? 'wake' : 'queue'
              if (binding.role !== 'worker' && session.state === 'running')
                mode = 'interrupt'
              if (binding.role === 'worker' && message.kind === 'runtime:human' && session.state === 'running')
                mode = 'interrupt'
              if (binding.role === 'worker' && binding.ticketId) {
                const { ticket, reasons } = ledger.resolveTicket(database, binding.ticketId)
                if (ticket.status !== 'running' || reasons.some(reason => ['human_paused', 'project_disabled', 'project_unavailable', 'pending_ask'].includes(reason)) || (ticket.failureReason && ticket.failureBindingId === binding.id))
                  mode = 'queue'
              }
              await interruptible(() => gateway.deliver(binding.sessionId, message, mode, signal), signal)
            }
            checkInterrupt(signal)
            if (!message.deliveredAt)
              ledger.updateMessage(database, message.id, 'delivered')
            if (receipt === 'read')
              ledger.updateMessage(database, message.id, 'read')
          }
          catch (error) {
            if (error instanceof LedgerError && ['delivery_pending', 'delivery_failed'].includes(error.code))
              throw error
            ledger.updateMessage(database, message.id, 'failed', errorCode(error))
            throw error
          }
        }
      }), signal)
      return ledger.load(database, 'message', messageId)!
    }

    function messageRecipient(message: Row<'message'>): string {
      return bindingById(message.recipient).sessionId
    }

    async function intake(input: RuntimeEventInput, signal?: AbortSignal): Promise<Row<'message'>> {
      checkInterrupt(signal)
      const message = ledger.recordRuntimeEvent(database, input)
      if (message.recipient === 'human')
        return message
      return deliver(message.id, signal)
    }

    async function read(sessionId: string, messageId: string, signal?: AbortSignal): Promise<Row<'message'>> {
      const { binding } = await resolve(sessionId, signal)
      const message = ledger.load(database, 'message', messageId)
      if (!message || message.recipient !== binding.id)
        throw new LedgerError('scope_denied')
      if (await interruptible(() => gateway.receipt(sessionId, messageId, signal), signal) !== 'read')
        throw new LedgerError('not_read')
      if (!message.deliveredAt)
        ledger.updateMessage(database, message.id, 'delivered')
      return ledger.updateMessage(database, message.id, 'read')
    }

    async function handled(sessionId: string, messageId: string, signal?: AbortSignal): Promise<Row<'message'>> {
      checkInterrupt(signal)
      const { binding } = await resolve(sessionId, signal)
      const message = ledger.load(database, 'message', messageId)
      if (!message || message.recipient !== binding.id)
        throw new LedgerError('scope_denied')
      return ledger.updateMessage(database, messageId, 'handled')
    }

    async function suspend(sessionId: string, askId: string, signal?: AbortSignal): Promise<{ status: string, askId: string }> {
      const { binding } = await resolve(sessionId, signal)
      const ask = ledger.load(database, 'ask', askId)
      if (!ask || (ask.responseRecipient ?? ask.initiatorBinding) !== binding.id)
        throw new LedgerError('pending_ask_required')
      if (ask.status !== 'pending')
        return { status: ask.status, askId }
      await watch({ id: `ask:${askId}`, askId, ticketId: binding.ticketId ?? ledger.list(database, 'ask_ticket').find(link => link.askId === askId)?.ticketId, bindingId: binding.id, recipient: ask.handler === 'human' ? binding.role === 'worker' ? projectBinding(binding.projectId!).id : binding.id : ask.handler, reason: 'pending_ask', waitingFor: askId, progressAt: ask.createdAt }, signal)
      const current = ledger.load(database, 'ask', askId)!
      if (current.status !== 'pending')
        return { status: current.status, askId }
      await interruptible(() => gateway.cancel(sessionId, `workline_suspended:${askId}`, signal), signal)
      return { status: 'pending' as const, askId }
    }

    const cancellations = new Map<string, () => void>()

    function armBudget(binding: Row<'role_binding'>): void {
      if (!binding.startedAt)
        return
      cancellations.get(`budget:${binding.id}`)?.()
      const due = Date.parse(binding.startedAt) + ledger.getSettings(database).backgroundLimitMinutes * 60000
      cancellations.set(`budget:${binding.id}`, timers.timeout(async () => {
        const current = bindingById(binding.id)
        if (current.status === 'closed')
          return
        attention(current, 'background_budget_expired')
        await gateway.cancel(current.sessionId, 'background_budget_expired')
      }, Math.max(0, due - Date.now())))
    }

    async function recover(bindingId: string, reconcileExternal: (signal?: AbortSignal) => Promise<'verified' | 'unknown'>, signal?: AbortSignal): Promise<RecoveryResult> {
      checkInterrupt(signal)
      return exclusive(`recovery:${bindingId}`, async () => {
        const binding = bindingById(bindingId)
        try {
          if (binding.status === 'closed')
            throw new LedgerError('closed_session')
          const session = await interruptible(() => gateway.inspect(binding.sessionId, signal), signal)
          if (session.origin === 'subagent' || session.parentSession)
            throw new LedgerError('unknown_binding')
          if (session.state === 'closed')
            throw new LedgerError('closed_session')
          if (session.state === 'missing' || session.state === 'unknown')
            throw new LedgerError('session_requires_management')
          if (binding.role === 'worker') {
            await verifyWorkspace(workspaceOf(binding), signal)
            if (session.cwd !== binding.worktree)
              throw new LedgerError('workspace_conflict')
            if (await interruptible(() => reconcileExternal(signal), signal) !== 'verified' || ledger.list(database, 'outbox').some(item => item.ticketId === binding.ticketId && item.state === 'unknown'))
              throw new LedgerError('unknown_remote_result')
            if (ledger.list(database, 'attention').some(item => item.bindingId === binding.id && item.reason === 'background_budget_expired' && !item.handledAt))
              throw new LedgerError('background_budget_expired')
            const { ticket, reasons } = ledger.resolveTicket(database, binding.ticketId!)
            if (ticket.paused || ticket.status === 'cancelled' || reasons.includes('project_disabled') || reasons.includes('project_unavailable')) {
              await interruptible(() => gateway.cancel(binding.sessionId, 'continuation_blocked', signal), signal)
              throw new LedgerError(ticket.paused ? 'human_paused' : ticket.status === 'cancelled' ? 'ticket_closed' : reasons.includes('project_disabled') ? 'project_disabled' : 'project_unavailable')
            }
            if (reasons.includes('pending_ask'))
              return { binding, state: 'suspended' as const }
            if (!binding.startedAt)
              throw new LedgerError('execution_requires_management')
            if (binding.status !== 'running')
              ledger.recoverTicket(database, binding.ticketId!, binding.id, 'session and worktree reconciled', projectActor(binding.projectId!))
          }
          else if (session.cwd !== join(managerDirectory, binding.id)) {
            throw new LedgerError('workspace_conflict')
          }
          checkInterrupt(signal)
          if (session.state === 'resumable')
            await interruptible(() => gateway.resume(binding.sessionId, presets[binding.role as keyof typeof presets], signal), signal)
          if (binding.role !== 'worker' && binding.status === 'unavailable')
            ledger.updateBinding(database, binding.id, 'idle', 'session reconciled')
          const messages = ledger.list(database, 'message').filter(message => message.recipient === binding.id && !message.readAt && !message.supersededAt)
          await Promise.all([...new Map(messages.map(message => [message.ticketId, message])).values()].map(message => deliver(message.id, signal)))
          if (binding.role === 'worker') {
            armBudget(binding)
            if (session.state === 'resumable' || binding.status === 'unavailable')
              await intake({ id: `recovery:${binding.id}`, source: `binding:${binding.id}`, recipient: binding.id, ticketId: binding.ticketId!, kind: 'ticket', content: 'Session, workspace and external results reconciled. Read current ticket facts and existing delivery before continuing only the authorized unfinished work.' }, signal)
          }
          return { binding: bindingById(bindingId), state: 'recovered' as const }
        }
        catch (error) {
          if (binding.status !== 'closed')
            ledger.updateBinding(database, binding.id, 'unavailable', errorCode(error))
          attention(binding, errorCode(error))
          throw error
        }
      })
    }

    function superior(recipient: string, ticketId: string | null): string {
      if (recipient === 'human')
        return 'human'
      const binding = bindingById(recipient)
      const bindings = ledger.list(database, 'role_binding').filter(item => item.status !== 'closed')
      if (binding.role === 'main')
        return 'human'
      if (binding.role === 'worker')
        return bindings.find(item => item.role === 'project' && item.projectId === binding.projectId)?.id ?? 'human'
      if (binding.role === 'project' && ticketId) {
        const scopes = ledger.list(database, 'supervisor_ticket').filter(item => item.ticketId === ticketId)
        const supervisor = bindings.find(item => item.role === 'supervisor' && scopes.some(scope => scope.supervisorId === item.supervisorId))
        if (supervisor)
          return supervisor.id
      }
      return bindings.find(item => item.role === 'main')?.id ?? 'human'
    }

    function reminderMessages(item: Row<'attention'>): Row<'message'>[] {
      const source = `attention:${item.id}:${item.progressAt}`
      return ledger.list(database, 'message').filter(message => message.source === source).sort((a, b) => a.seq - b.seq)
    }

    function armAttention(item: Row<'attention'>): void {
      cancellations.get(`attention:${item.id}`)?.()
      if (item.handledAt || item.reason === 'human_paused')
        return
      const messages = reminderMessages(item)
      const previous = messages.at(-1)
      const due = previous ? Date.parse(previous.acceptedAt) + ledger.getSettings(database).reminderIntervalMinutes * 60000 : Date.parse(item.dueAt)
      cancellations.set(`attention:${item.id}`, timers.timeout(async () => {
        await remind(item.id)
      }, Math.max(0, due - Date.now())))
    }

    async function watch(input: AttentionInput, signal?: AbortSignal): Promise<Row<'attention'>> {
      checkInterrupt(signal)
      const item = ledger.recordAttention(database, input)
      armAttention(item)
      return item
    }

    async function progress(id: string, progressAt: string, reason: string, waitingFor: string, signal?: AbortSignal): Promise<Row<'attention'>> {
      checkInterrupt(signal)
      const item = ledger.refreshAttention(database, id, progressAt, reason, waitingFor)
      armAttention(item)
      return item
    }

    async function settleAttention(id: string, evidence: string, signal?: AbortSignal): Promise<Row<'attention'>> {
      checkInterrupt(signal)
      const item = ledger.updateAttention(database, id, 'handled', evidence)
      cancellations.get(`attention:${id}`)?.()
      return item
    }

    async function remind(id: string, signal?: AbortSignal): Promise<Row<'attention'>> {
      checkInterrupt(signal)
      return exclusive(`attention:${id}`, async () => {
        const item = ledger.load(database, 'attention', id)
        if (!item)
          throw new LedgerError('not_found')
        if (item.handledAt || item.reason === 'human_paused')
          return item
        const prior = reminderMessages(item)
        const last = prior.at(-1)
        const interval = ledger.getSettings(database).reminderIntervalMinutes * 60000
        if (Date.now() < (last ? Date.parse(last.acceptedAt) + interval : Date.parse(item.dueAt))) {
          armAttention(item)
          return item
        }
        const target = last ? superior(last.recipient, item.ticketId) : item.recipient
        const message = ledger.recordRuntimeEvent(database, {
          id: `reminder:${item.id}:${item.progressAt}:${prior.length}`,
          source: `attention:${item.id}:${item.progressAt}`,
          recipient: target,
          ticketId: item.ticketId ?? undefined,
          askId: item.askId ?? undefined,
          kind: 'reminder',
          content: JSON.stringify({ attentionId: item.id, bindingId: item.bindingId, askId: item.askId, ticketId: item.ticketId, waitingFor: item.waitingFor, progressAt: item.progressAt, waitedMilliseconds: Date.now() - Date.parse(item.progressAt), reason: item.reason, previousReminder: last?.id ?? null, previousDeliveryError: last?.error ?? null }),
        })
        if (last)
          ledger.updateAttention(database, id, 'escalated', message.id)
        try {
          if (target === 'human') {
            armAttention(item)
            return ledger.load(database, 'attention', id)!
          }
          await deliver(message.id, signal)
          ledger.updateAttention(database, id, 'reminded', message.id)
        }
        catch (error) {
          ledger.updateAttention(database, id, 'failed', errorCode(error))
          throw error
        }
        finally {
          armAttention(ledger.load(database, 'attention', id)!)
        }
        return ledger.load(database, 'attention', id)!
      })
    }

    async function observe(sessionId: string, eventId: string, reason: string, signal?: AbortSignal): Promise<{ bound: boolean, message?: Row<'message'> }> {
      checkInterrupt(signal)
      const binding = ledger.list(database, 'role_binding').find(item => item.sessionId === sessionId)
      if (!binding)
        return { bound: false as const }
      const messages = ledger.list(database, 'message').filter(item => item.recipient === binding.id && !item.readAt && !item.supersededAt).sort((a, b) => a.seq - b.seq)
      for (const message of messages) {
        if (await interruptible(() => gateway.receipt(sessionId, message.id, signal), signal) === 'read') {
          if (!message.deliveredAt)
            ledger.updateMessage(database, message.id, 'delivered')
          ledger.updateMessage(database, message.id, 'read')
        }
      }
      const target = binding.role === 'worker' ? projectBinding(binding.projectId!).id : superior(binding.id, binding.ticketId)
      const message = ledger.recordRuntimeEvent(database, { id: eventId, source: `session:${sessionId}:${eventId}`, recipient: target, ticketId: binding.ticketId ?? undefined, kind: 'session', content: JSON.stringify({ bindingId: binding.id, reason }) })
      if (target !== 'human')
        await deliver(message.id, signal)
      if (binding.role === 'worker' && binding.status !== 'closed') {
        const pending = ledger.list(database, 'attention').find(item => item.bindingId === binding.id && !item.handledAt && item.reason.startsWith('stop_requested:'))
        if (pending)
          await stop(binding.ticketId!, pending.reason.slice('stop_requested:'.length), signal)
      }
      return { bound: true as const, message }
    }

    async function projectChanged(projectId: string, signal?: AbortSignal): Promise<{ bindingId: string, interrupted: boolean, reason?: string }[]> {
      checkInterrupt(signal)
      const project = ledger.load(database, 'project', projectId)
      if (!project)
        throw new LedgerError('not_found')
      if (project.enabled && project.available)
        return []
      const bindings = ledger.list(database, 'role_binding').filter(binding => binding.projectId === projectId && binding.role === 'worker' && binding.status !== 'closed')
      return Promise.all(bindings.map(async (binding) => {
        attention(binding, project.enabled ? 'project_unavailable' : 'project_disabled')
        try {
          await interruptible(() => gateway.cancel(binding.sessionId, 'project_unavailable', signal), signal)
          return { bindingId: binding.id, interrupted: true as const }
        }
        catch (error) {
          return { bindingId: binding.id, interrupted: false as const, reason: errorCode(error) }
        }
      }))
    }

    async function closeSupervisor(id: string, reason: string, actor?: Actor, signal?: AbortSignal): Promise<Row<'supervisor'>> {
      checkInterrupt(signal)
      return exclusive(`supervisor:${id}`, async () => {
        const { supervisor, bindings, canClose } = ledger.resolveSupervisor(database, id, actor)
        if (supervisor.status === 'closed')
          return supervisor
        if (!canClose)
          throw new LedgerError('coordination_unresolved')
        for (const binding of bindings) {
          if (!await interruptible(() => gateway.stop(binding.sessionId, reason, signal), signal)) {
            attention(binding, 'coordination_stop_unconfirmed')
            throw new LedgerError('execution_stop_unconfirmed')
          }
        }
        return ledger.closeSupervisor(database, id, reason, actor)
      })
    }

    async function startQueued(signal?: AbortSignal): Promise<({ ticketId: string } & (StartResult | { accepted: true, started: false, reason: string }))[]> {
      checkInterrupt(signal)
      const tickets = ledger.list(database, 'ticket').filter(ticket => ticket.status === 'queued')
      return Promise.all(tickets.map(async (ticket) => {
        try {
          return { ticketId: ticket.id, ...await start(ticket.id, projectActor(ticket.projectId), signal) }
        }
        catch (error) {
          return { ticketId: ticket.id, accepted: true as const, started: false as const, reason: errorCode(error) }
        }
      }))
    }

    async function boot(reconcileExternal: (ticketId: string, signal?: AbortSignal) => Promise<'verified' | 'unknown'>, signal?: AbortSignal): Promise<{ bindingId: string, state: 'recovered' | 'suspended' | 'requires_attention', reason?: string }[]> {
      checkInterrupt(signal)
      const bindings = ledger.list(database, 'role_binding').filter(binding => binding.status !== 'closed')
      ledger.list(database, 'ticket')
      ledger.list(database, 'ask')
      ledger.list(database, 'message')
      const results = await Promise.all(bindings.map(async (binding) => {
        try {
          const result = await recover(binding.id, currentSignal => binding.ticketId ? reconcileExternal(binding.ticketId, currentSignal) : Promise.resolve('verified'), signal)
          return { bindingId: binding.id, state: result.state }
        }
        catch (error) {
          return { bindingId: binding.id, state: 'requires_attention' as const, reason: errorCode(error) }
        }
      }))
      for (const item of ledger.list(database, 'attention'))
        armAttention(item)
      await startQueued(signal)
      for (const supervisor of ledger.list(database, 'supervisor').filter(item => item.status === 'active')) {
        if (ledger.resolveSupervisor(database, supervisor.id).canClose)
          await closeSupervisor(supervisor.id, 'all coordinated tickets successfully delivered', undefined, signal)
      }
      return results
    }

    async function dispose(): Promise<void> {
      for (const cancel of cancellations.values())
        cancel()
      cancellations.clear()
    }

    return { bind, resolve, dispatch, start, pause, cancel, retry, intake, deliver, read, handled, suspend, recover, boot, startQueued, closeSupervisor, observe, projectChanged, watch, progress, settleAttention, remind, dispose }
  },
})
