import type { Context } from '@deepseek-ai/cordis'
import type { Agent, AgentHandle } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-agent-default-model'
import type {} from '@deepseek-ai/dsh-agent-preset-registry'
import type {} from '@deepseek-ai/dsh-session-query'
import type {} from '@deepseek-ai/dsh-workspace'
import type { SessionGateway } from './types'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import { LedgerError } from '../database'
import { checkInterrupt, interruptible } from './interrupt'

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    nexus: { kind: 'nexus', messageId: string, source: string | null }
  }
}

export function createSessionGateway(ctx: Context, retireWriters: (sessionId: string, signal?: AbortSignal) => Promise<boolean>, setup?: (agentCtx: Context, agent: Agent) => Promise<void>): SessionGateway & { dispose: () => Promise<void> } {
  const handles = new Map<string, AgentHandle>()
  const accepted = new WeakMap<Agent, Set<string>>()
  const preparing = new Map<string, Agent>()
  const retiring = new Set<string>()
  const agents = ctx.get('agents')!
  const presets = ctx.get('agentPresets')!
  const query = ctx.get('sessionQuery')!
  const defaults = ctx.get('agentDefaultModel')!
  const agentOptions = {
    get provider() { return defaults.currentSelection().provider },
    get model() { return defaults.currentSelection().model },
    get reasoningEffort() { return defaults.currentSelection().reasoningEffort },
  }
  return {
    isArchived: sessionId => ctx.get('workspaceRegistry')?.archivedSessionIds.includes(SessionId(sessionId)) ?? false,
    async dispose() {
      for (const handle of handles.values())
        handle.agent.cancel({ kind: 'hook', reason: 'nexus_unloaded' }, { keepInbox: true })
      await Promise.all([...handles.values()].map(handle => handle.dispose()))
      for (const handle of handles.values())
        accepted.delete(handle.agent)
      handles.clear()
    },
    async inspect(sessionId, signal) {
      checkInterrupt(signal)
      if (ctx.get('workspaceRegistry')?.archivedSessionIds.includes(SessionId(sessionId)))
        return { state: 'closed', archived: true }
      const agent = agents.get(SessionId(sessionId)) ?? preparing.get(sessionId)
      if (agent)
        return { state: agent.status, cwd: agent.session.header.cwd, origin: agent.session.header.origin, parentSession: agent.session.header.parentSession }
      try {
        const { session } = await query.readSession(SessionId(sessionId))
        if (ctx.get('workspaceRegistry')?.archivedSessionIds.includes(SessionId(sessionId)))
          return { state: 'closed', archived: true }
        return { state: 'resumable', cwd: session.cwd, origin: session.origin, parentSession: session.parentSession }
      }
      catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'SESSION_QUERY_SESSION_NOT_FOUND')
          return { state: 'missing' }
        throw error
      }
    },
    async create(sessionId, preset, cwd, signal) {
      checkInterrupt(signal)
      if ((await presets.resolve(preset)).broken)
        throw new LedgerError('preset_unavailable')
      const handle = await agents.create({ sessionId: SessionId(sessionId), meta: { cwd, agentPreset: preset }, agentOptions, signal, setup: async (agentCtx, agent) => {
        preparing.set(sessionId, agent)
        try {
          await presets.mount(agentCtx, preset)
          await setup?.(agentCtx, agent)
        }
        finally {
          preparing.delete(sessionId)
        }
      } })
      handles.set(sessionId, handle)
    },
    async resume(sessionId, preset, signal) {
      checkInterrupt(signal)
      if (retiring.has(sessionId))
        throw new LedgerError('execution_stop_pending')
      const handle = await agents.resume({ resumeSessionId: SessionId(sessionId), agentOptions, signal, setup: async (agentCtx, agent) => {
        preparing.set(sessionId, agent)
        try {
          await presets.mount(agentCtx, preset)
          await setup?.(agentCtx, agent)
        }
        finally {
          preparing.delete(sessionId)
        }
      } })
      handles.set(sessionId, handle)
      const agent = handle.agent
      const restored = [...agent.inbox.nextStep, ...agent.inbox.nextTurn].flatMap(message => message.source.kind === 'nexus' ? [message.source.messageId] : [])
      if (restored.length) {
        accepted.set(agent, new Set(restored))
        if (agent.status === 'idle') {
          const target = agent.inbox.nextTurn.length ? 'next-turn' : 'next-step'
          const message = (target === 'next-turn' ? agent.inbox.nextTurn : agent.inbox.nextStep).at(-1)!
          if (agent.inbox.remove(message.id))
            agent.send(message, target, true)
        }
      }
    },
    async deliver(sessionId, item, mode, signal) {
      checkInterrupt(signal)
      const agent = agents.get(SessionId(sessionId)) ?? preparing.get(sessionId)
      if (!agent)
        throw new LedgerError('closed_session')
      if (retiring.has(sessionId))
        throw new LedgerError('execution_stop_pending')
      if (ctx.get('workspaceRegistry')?.archivedSessionIds.includes(SessionId(sessionId)))
        throw new LedgerError('archived_session')
      if (item.source === 'nexus:mailbox' && agent.status !== 'idle')
        throw new LedgerError('delivery_pending')
      const content = [{ type: 'text' as const, text: item.content }]
      if (item.askId || item.ticketId || item.facts) {
        const question = item.question
        content.unshift({ type: 'text', text: JSON.stringify({
          kind: 'nexus_context',
          messageId: item.id,
          askId: item.askId ?? null,
          ticketId: item.ticketId ?? null,
          facts: item.facts ? JSON.parse(item.facts) : null,
          question: question
            ? {
                question: question.content,
                ticketIds: question.ticketIds,
                options: JSON.parse(question.options),
                ...(question.presentation ? JSON.parse(question.presentation) : {}),
                policyBasis: question.policyBasis,
                state: question.status,
                target: question.target ? JSON.parse(question.target) : null,
                selections: question.selections ? JSON.parse(question.selections) : null,
              }
            : null,
        }) })
      }
      const message = createUserMessage({ content, source: { kind: 'nexus', messageId: item.id, source: item.source } })
      if (mode === 'interrupt') {
        agent.cancel({ kind: 'hook', reason: 'nexus_event' }, { keepInbox: true })
        agent.followup(message)
      }
      else if (mode === 'wake') {
        agent.followup(message)
      }
      else {
        agent.inject(message)
      }
      const pending = accepted.get(agent) ?? new Set<string>()
      pending.add(item.id)
      accepted.set(agent, pending)
    },
    async receipt(sessionId, messageId, signal) {
      checkInterrupt(signal)
      const agent = agents.get(SessionId(sessionId)) ?? preparing.get(sessionId)
      const events = agent ? agent.session.snapshotEvents() : (await query.readSession(SessionId(sessionId))).events
      if (events.some(event => event.type === 'user/message' && event.data.source?.kind === 'nexus' && event.data.source.messageId === messageId)) {
        if (agent)
          accepted.get(agent)?.delete(messageId)
        return 'read'
      }
      if (agent && [...agent.inbox.nextStep, ...agent.inbox.nextTurn].some(message => message.source?.kind === 'nexus' && message.source.messageId === messageId))
        return 'queued'
      if (agent?.status === 'running' && accepted.get(agent)?.has(messageId))
        return 'queued'
      if (agent)
        accepted.get(agent)?.delete(messageId)
      return 'absent'
    },
    async stop(sessionId, reason, signal) {
      checkInterrupt(signal)
      const handle = handles.get(sessionId)
      if (!handle)
        return !agents.get(SessionId(sessionId)) && await interruptible(() => retireWriters(sessionId, signal), signal)
      retiring.add(sessionId)
      handle.agent.cancel({ kind: 'hook', reason }, { keepInbox: true })
      await interruptible(() => handle.agent.whenIdle(), signal)
      if (!await interruptible(() => retireWriters(sessionId, signal), signal))
        return false
      await interruptible(() => handle.dispose(), signal)
      accepted.delete(handle.agent)
      handles.delete(sessionId)
      return true
    },
    async cancel(sessionId, reason, signal) {
      checkInterrupt(signal)
      const agent = agents.get(SessionId(sessionId)) ?? preparing.get(sessionId)
      if (!agent)
        return
      agent.cancel({ kind: 'hook', reason }, { keepInbox: true })
    },
  }
}
