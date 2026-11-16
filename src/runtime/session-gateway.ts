import type { Context } from '@deepseek-ai/cordis'
import type { AgentHandle } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-agent-default-model'
import type {} from '@deepseek-ai/dsh-agent-preset-registry'
import type {} from '@deepseek-ai/dsh-session-query'
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

export function createSessionGateway(ctx: Context, retireWriters: (sessionId: string, signal?: AbortSignal) => Promise<boolean>): SessionGateway {
  const handles = new Map<string, AgentHandle>()
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
    async inspect(sessionId, signal) {
      checkInterrupt(signal)
      const agent = agents.get(SessionId(sessionId))
      if (agent)
        return { state: agent.status, cwd: agent.session.header.cwd, origin: agent.session.header.origin, parentSession: agent.session.header.parentSession }
      try {
        const { session } = await query.readSession(SessionId(sessionId))
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
      const handle = await agents.create({ sessionId: SessionId(sessionId), meta: { cwd, agentPreset: preset }, agentOptions, signal, setup: async (agentCtx) => {
        await presets.mount(agentCtx, preset)
      } })
      handles.set(sessionId, handle)
    },
    async resume(sessionId, preset, signal) {
      checkInterrupt(signal)
      if (retiring.has(sessionId))
        throw new LedgerError('execution_stop_pending')
      const handle = await agents.resume({ resumeSessionId: SessionId(sessionId), agentOptions, signal, setup: async (agentCtx) => {
        await presets.mount(agentCtx, preset)
      } })
      handles.set(sessionId, handle)
    },
    async deliver(sessionId, item, mode, signal) {
      checkInterrupt(signal)
      const agent = agents.get(SessionId(sessionId))
      if (!agent)
        throw new LedgerError('closed_session')
      if (retiring.has(sessionId))
        throw new LedgerError('execution_stop_pending')
      const message = createUserMessage({ content: [{ type: 'text', text: item.content }], source: { kind: 'nexus', messageId: item.id, source: item.source } })
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
    },
    async receipt(sessionId, messageId, signal) {
      checkInterrupt(signal)
      const session = await query.readSession(SessionId(sessionId))
      if (session?.events.some(event => event.type === 'user/message' && event.data.source?.kind === 'nexus' && event.data.source.messageId === messageId))
        return 'read'
      const agent = agents.get(SessionId(sessionId))
      if (agent && [...agent.inbox.nextStep, ...agent.inbox.nextTurn].some(message => message.source?.kind === 'nexus' && message.source.messageId === messageId))
        return 'queued'
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
      handles.delete(sessionId)
      return true
    },
    async cancel(sessionId, reason, signal) {
      checkInterrupt(signal)
      const agent = agents.get(SessionId(sessionId))
      if (!agent)
        return
      agent.cancel({ kind: 'hook', reason }, { keepInbox: true })
    },
  }
}
