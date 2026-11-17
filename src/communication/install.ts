import type { ToolDefinition, ToolRunContext } from '@deepseek-ai/dsh-tools'
import type { Communication } from '../service/communication.types'
import type { Row } from '../types/ledger'
import { LedgerError } from '../database'
import { createCommunicationTools } from './tools'

interface AgentContext {
  tools: { register: (tool: ToolDefinition) => () => void }
}

export function createCommunicationInstaller(service: Communication, nativeSend: (args: { agent_id: string, message: string }, exec: ToolRunContext) => Promise<{ messageId: string }>, management?: (binding: Row<'role_binding'>) => ToolDefinition[]): { attach: (agentCtx: AgentContext, binding: Row<'role_binding'> | undefined) => Promise<(() => void) | null> } {
  const installed = new WeakMap<AgentContext, () => void>()

  async function attach(agentCtx: AgentContext, binding: Row<'role_binding'> | undefined): Promise<(() => void) | null> {
    if (!binding)
      return null
    const current = await service.resolve(binding.sessionId)
    if (current.id !== binding.id)
      throw new LedgerError('binding_conflict')
    const existing = installed.get(agentCtx)
    if (existing)
      return existing
    const definitions = [...(management?.(current) ?? []), ...createCommunicationTools(service, current.sessionId, nativeSend)]
    const disposers = definitions.map(tool => agentCtx.tools.register(tool))
    const detach = (): void => {
      for (const dispose of disposers.reverse())
        dispose()
      installed.delete(agentCtx)
    }
    installed.set(agentCtx, detach)
    return detach
  }

  return { attach }
}
