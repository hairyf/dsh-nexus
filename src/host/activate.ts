import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-session-query'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-workspace'
import type { MergeVerifier } from '../service/communication.types'
import type { MergeTarget } from '../types/ledger'
import type { SourceContext, WebPorts } from '../types/web'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { SessionId } from '@deepseek-ai/dsh-session'
import { agents } from '../ai'
import { GitHubChannel } from '../channel/github/channel'
import { ExecFileGhRunner } from '../channel/github/runner'
import { createCommunicationInstaller } from '../communication/install'
import { createManagementTools } from '../communication/management'
import { resolveDataDirectory } from '../config/paths'
import { LedgerError, openDatabase } from '../database'
import { createSessionGateway } from '../runtime/session-gateway'
import { server } from '../server'
import { communication } from '../service/communication'
import { ledger } from '../service/ledger'
import { runtime } from '../service/runtime'
import { webPanel } from '../service/web-panel'
import { retireWriters } from './writers'

export interface HostOptions {
  dataDir?: string
  github?: { repository: string, login: string, automationIds?: string[] }[]
}

const execute = promisify(execFile)

export async function activate(ctx: Context, options: HostOptions): Promise<() => Promise<void>> {
  const profile = (ctx as unknown as { get: (name: string) => unknown }).get('profileContext') as { dir: string, home: string } | undefined
  const database = await openDatabase(resolveDataDirectory(options, profile?.home, profile?.dir))
  const abort = new AbortController()
  const signal = abort.signal
  const disposers: (() => unknown)[] = []
  const logger = ctx.logger('nexus')
  let startup: ReturnType<WebPorts['startup']> = { state: 'starting', reason: null }
  const native = new WeakMap<object, ToolDefinition>()
  const tasks = new Set<Promise<unknown>>()
  function track<T>(operation: Promise<T>): Promise<T> {
    const task = operation.finally(() => tasks.delete(task))
    tasks.add(task)
    return task
  }
  let installer: ReturnType<typeof createCommunicationInstaller>
  const gateway = createSessionGateway(ctx, async (id, currentSignal) => {
    const proof = await retireWriters(ctx, id, currentSignal)
    if (!proof.stopped) {
      const binding = ledger.list(database, 'role_binding').find(item => item.sessionId === id)
      if (binding)
        ledger.updateBinding(database, binding.id, 'unavailable', proof.reason!)
      logger.warn(proof.reason)
    }
    return proof.stopped
  }, async (agentCtx, agent) => {
    const binding = ledger.list(database, 'role_binding').find(item => item.sessionId === agent.id && item.status !== 'closed')
    const original = agentCtx.tools.get('send_message', agent)
    if (original)
      native.set(agent, original)
    const detach = await installer.attach(agentCtx, binding)
    if (detach)
      agentCtx.effect(() => detach, 'nexus:role-tools')
  })
  const timeout = (callback: () => Promise<void>, milliseconds: number): (() => void) => (ctx as Context & { timeout: (callback: () => void, milliseconds: number) => () => void }).timeout(() => {
    if (!signal.aborted)
      void track(callback()).catch(report)
  }, milliseconds)
  const run = runtime.create(database, gateway, { timeout }, join(database.stateDirectory, 'managers'))
  const github = new GitHubChannel(database, new ExecFileGhRunner())
  const verifyMerge: MergeVerifier = (ask, _actor, currentSignal) => github.preflight(ask.id, currentSignal ? AbortSignal.any([signal, currentSignal]) : signal)
  const messages = communication.create(database, run, verifyMerge)
  installer = createCommunicationInstaller(messages, async (args, exec) => {
    const definition = exec.agent && native.get(exec.agent)
    if (!definition)
      throw new LedgerError('native_delegation_unavailable')
    return await definition.execute(args, exec) as { messageId: string }
  }, binding => createManagementTools(database, run, github, binding))
  const panel = webPanel.create(database, {
    startup: () => startup,
    runtime: run,
    communication: messages,
    verifyMerge,
    discoverProjects: async () => {
      const projects = []
      for (const workspace of ctx.get('workspaceRegistry')!.list()) {
        if (await workspace.status() !== 'ok')
          continue
        try {
          const directory = (await execute('git', ['rev-parse', '--show-toplevel'], { cwd: workspace.path, signal })).stdout.trim()
          const remoteUrl = (await execute('git', ['remote', 'get-url', 'origin'], { cwd: directory, signal })).stdout.trim()
          projects.push({ id: workspace.id, workspaceId: workspace.id, directory, remoteUrl, name: workspace.title, available: true })
        }
        catch (error) {
          if (![1, 2, 128, 'ENOENT'].includes((error as { code: number | string }).code))
            throw error
        }
      }
      return projects
    },
    sourceContext: async (sessionId): Promise<SourceContext> => {
      try {
        const snapshot = await ctx.get('sessionQuery')!.readSession(SessionId(sessionId))
        return { sessionId, available: true, reason: null, entries: snapshot.events.filter(event => event.type === 'user/message' || event.type === 'assistant/message').map(event => ({ origin: event.type === 'user/message' ? event.data.source?.kind ?? 'user' : event.type, at: new Date(event.time).toISOString(), text: (event.type === 'user/message' ? event.data.content : event.data.message.content).filter(block => block.type === 'text').map(block => block.text).join('\n') })).filter(item => item.text).slice(-8) }
      }
      catch (error) {
        return { sessionId, available: false, reason: code(error), entries: [] }
      }
    },
    githubStatus: id => github.status(id),
    reconcileExternal,
  })
  let flushing: Promise<void> | undefined
  let collecting: Promise<void> | undefined
  let cancelCollection: (() => void) | undefined
  const selected = new Set<string>()

  function report(error: unknown): void {
    if (!signal.aborted)
      logger.error('Nexus operation failed: %s', code(error))
  }

  async function reconcileExternal(ticketId: string, currentSignal?: AbortSignal): Promise<'verified' | 'unknown'> {
    const ticket = ledger.load(database, 'ticket', ticketId)!
    if (ledger.list(database, 'outbox').some(item => item.ticketId === ticketId && item.state === 'unknown'))
      return 'unknown'
    if (!ticket.deliveryTarget)
      return 'verified'
    const target = JSON.parse(ticket.deliveryTarget) as MergeTarget
    const thread = ledger.list(database, 'thread').find(item => item.url === target.pullRequest && item.projectId === ticket.projectId)
    if (!thread)
      return 'unknown'
    const result = await github.collectPullRequest(ticket.projectId, thread.id, currentSignal)
    if (!result.ok || !result.fact || (['repository', 'pullRequest', 'base', 'head'] as const).some(key => result.fact!.target[key] !== target[key]))
      return 'unknown'
    const unknown = github.status(ticket.projectId).some(item => item.name.startsWith('merge_status:') && (item.value as { state: string }).state === 'unknown')
    return unknown && result.fact.state !== 'merged' ? 'unknown' : 'verified'
  }

  async function responsibilities(): Promise<void> {
    if (!ledger.list(database, 'role_binding').some(item => item.role === 'main' && item.status !== 'closed'))
      await run.bind({ id: randomUUID(), role: 'main', sessionId: randomUUID() }, undefined, signal)
    for (const project of ledger.list(database, 'project').filter(item => item.enabled && item.available)) {
      if (!ledger.list(database, 'role_binding').some(item => item.role === 'project' && item.projectId === project.id && item.status !== 'closed'))
        await run.bind({ id: randomUUID(), role: 'project', projectId: project.id, sessionId: randomUUID() }, undefined, signal)
      const selection = options.github?.find(item => item.repository.toLowerCase() === project.repository)
      if (selection && !selected.has(project.id)) {
        await github.selectEnvironment(project.id, { site: project.repository!.split('/')[0]!, login: selection.login, automationIds: selection.automationIds ?? [] }, signal)
        selected.add(project.id)
      }
    }
  }

  async function drain(): Promise<void> {
    signal.throwIfAborted()
    await responsibilities()
    const bindings = ledger.list(database, 'role_binding').filter(item => item.status !== 'closed')
    for (const binding of bindings) {
      const pending = ledger.list(database, 'message').filter(item => item.recipient === binding.id && !item.readAt && !item.supersededAt)
      if (!pending.length)
        continue
      try {
        const session = await gateway.inspect(binding.sessionId, signal)
        if (session.state === 'resumable')
          await run.recover(binding.id, currentSignal => binding.ticketId ? reconcileExternal(binding.ticketId, currentSignal) : Promise.resolve('verified'), signal)
        else
          await run.deliver(pending[0]!.id, signal)
      }
      catch (error) {
        report(error)
      }
    }
    const main = bindings.find(item => item.role === 'main')!
    for (const ask of ledger.list(database, 'ask').filter(item => item.handler === 'human')) {
      const threads = ledger.list(database, 'ask_ticket').filter(link => link.askId === ask.id).flatMap(link => ledger.list(database, 'ticket_thread').filter(item => item.ticketId === link.ticketId).map(item => item.threadId))
      if (!threads.length && ledger.load(database, 'thread', ask.source))
        threads.push(ask.source)
      const request = ledger.list(database, 'message').find(item => item.askId === ask.id && item.kind === 'ask' && !item.supersededAt)
      if (!request)
        continue
      for (const thread of new Set(threads)) {
        try {
          ledger.publishMessage(database, request.id, thread, { kind: 'agent', sessionId: main.sessionId })
        }
        catch (error) {
          report(error)
        }
      }
    }
    for (const item of ledger.list(database, 'outbox').filter(item => !item.supersededAt || item.state === 'unknown')) {
      const result = await github.publish(item.id, signal)
      if (!result.ok)
        logger.warn('Nexus delivery failed: %s', result.reason)
    }
    await run.startQueued(signal)
  }

  function flush(): Promise<void> {
    if (!flushing)
      flushing = drain().finally(() => { flushing = undefined })
    return flushing
  }

  async function collect(): Promise<void> {
    signal.throwIfAborted()
    await panel.refreshProjects()
    await responsibilities()
    for (const project of ledger.list(database, 'project').filter(item => item.enabled && item.available && item.repository)) {
      const result = await github.collect(project.id, signal)
      if (!result.ok)
        logger.warn('Nexus GitHub unavailable: %s', result.reason)
      for (const item of github.intake(project.id)) {
        const bindings = ledger.list(database, 'role_binding').filter(binding => binding.status !== 'closed')
        const targets = item.kind === 'triage' ? bindings.filter(binding => binding.role === 'main') : bindings.filter(binding => binding.role === 'project' && binding.projectId === project.id)
        for (const target of targets) {
          try {
            await run.intake({ id: `github:${item.id}:${target.id}`, source: item.triggerId, recipient: target.id, kind: 'message', content: JSON.stringify({ ...item, trigger: ledger.load(database, 'trigger', item.triggerId), thread: ledger.load(database, 'thread', item.threadId) }) }, signal)
            github.acknowledgeIntake(project.id, item.id)
          }
          catch (error) {
            report(error)
          }
        }
      }
    }
    await flush()
  }

  function scheduleCollection(): void {
    cancelCollection = timeout(async () => {
      collecting = collect()
      try {
        await collecting
      }
      finally {
        collecting = undefined
        if (!signal.aborted)
          scheduleCollection()
      }
    }, 60000)
  }

  async function bootstrap(): Promise<void> {
    await responsibilities()
    const recovered = await run.boot(reconcileExternal, signal)
    for (const result of recovered.filter(item => item.state === 'requires_attention'))
      logger.warn('Nexus recovery requires attention: %s %s', result.bindingId, result.reason)
    await collect()
    startup = { state: 'ready', reason: null }
    scheduleCollection()
    logger.info('Nexus ready: %s; model=%j', database.stateDirectory, ctx.get('agentDefaultModel')!.currentSelection())
  }

  async function dispose(): Promise<void> {
    abort.abort()
    cancelCollection?.()
    for (const dispose of disposers.reverse())
      await dispose()
    await run.dispose()
    await gateway.dispose()
    await Promise.allSettled([...tasks, flushing, collecting].filter(Boolean))
    database.close()
  }

  try {
    for (const definition of Object.values(agents))
      disposers.push(await ctx.get('agentPresets')!.register(definition.preset))
    await panel.refreshProjects()
    disposers.push(server(ctx, { panel, owner: (event) => {
      const admission = ctx.get('connection')!.admit({ headers: event.req.headers })
      return 'rejection' in admission || admission.peer.principal.kind !== 'owner' ? null : { kind: 'web', authenticated: true, userId: 'owner' }
    } }))
    disposers.push(ctx.on('session/event', (session, event) => {
      if (signal.aborted || !ledger.list(database, 'role_binding').some(item => item.sessionId === session.id))
        return
      const binding = ledger.list(database, 'role_binding').find(item => item.sessionId === session.id)!
      if (binding.role !== 'worker' && binding.status !== 'unavailable' && binding.status !== 'closed' && (event.type === 'turn/start' || event.type === 'turn/end'))
        ledger.updateBinding(database, binding.id, event.type === 'turn/start' ? 'running' : 'idle', event.type)
      if (event.type === 'turn/end')
        void track(run.observe(session.id, `session:${session.id}:${event.seq}`, event.type, signal).then(flush)).catch(report)
      else if (event.type === 'tool/result')
        void track(flush()).catch(report)
    }))
    const start = (): void => {
      if (!signal.aborted) {
        void track(bootstrap()).catch((error) => {
          startup = { state: 'failed', reason: code(error) }
          report(error)
        })
      }
    }
    const ready = (ctx as unknown as { get: (name: string) => unknown }).get('appReady') as { onReady: (callback: () => void) => () => void } | undefined
    disposers.push(ready ? ready.onReady(start) : timeout(async () => start(), 0))
    return dispose
  }
  catch (error) {
    await dispose()
    throw error
  }
}

function code(error: unknown): string {
  return error instanceof Error && 'code' in error ? String(error.code) : error instanceof Error ? error.message : String(error)
}
