/** Host 插件入口：挂路由、注册工具与角色。 */

import type { Context } from '@deepseek-ai/cordis'
import { server } from './server/index'

export const inject = ['webServer']

/**
 * 挂上 `ctx.webServer` 的路由。卸载时 Cordis 自动摘除。
 *
 * 工具与角色的注册走宿主的工具注册表；宿主没提供时只挂面板，
 * 不报错 —— 面板本身是可用的。
 */
export function apply(ctx: Context): void {
  ctx.effect(() => server(ctx, { entry: 'nexus' }), 'nexus:routes')
}
