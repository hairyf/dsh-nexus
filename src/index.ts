import type { Context } from '@deepseek-ai/cordis'
import type { HostOptions } from './host/activate'
import { activate } from './host/activate'

export const inject = ['agentPresets', 'agents', 'agentDefaultModel', 'workspaceRegistry', 'sessionQuery', 'webServer', 'connection', 'timer']

export async function apply(ctx: Context, options: HostOptions = {}): Promise<void> {
  await ctx.effect(() => activate(ctx, options), 'nexus:lifecycle')
}
