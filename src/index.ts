import type { Context } from '@deepseek-ai/cordis'
// 类型增强：仅加载各服务包对 Context 的 declare module 声明，运行时无副作用
import type { } from '@deepseek-ai/dsh-agent-preset-registry'
import type { } from '@deepseek-ai/dsh-api-session-controller'
import type { } from '@deepseek-ai/dsh-credentials'
import type { } from '@deepseek-ai/dsh-session'
import type { } from '@deepseek-ai/dsh-session-query'
import type { } from '@deepseek-ai/dsh-workspace'

import { agents } from './ai'

export const inject = ['agentPresets', 'sessionController', 'workspaceRegistry', 'sessionQuery', 'credentials']

export async function apply(ctx: Context): Promise<void> {
  const presets = ctx.get('agentPresets')

  ctx.effect(async () => {
    const processes = Object.values(agents).map(p => presets?.register(p.preset))
    const unregisters = await Promise.all(processes)
    return () => Promise.all(unregisters)
  }, 'nexus:presets')
}
