import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ClientContext } from '../types/context'
import { flushSync } from 'react-dom'

export function openSidechat(ctx: ClientContext, sessionId: string): void {
  const sidebar = ctx.get('betterSidebar' as never) as ClientContext['betterSidebar']

  if (!sidebar)
    throw new Error('better-sidebar 未启用，请启用现有插件，或打开原会话')

  if (!sidebar.getTab('sidechat'))
    throw new Error('现有插件尚未注册 sidechat，请检查插件状态或打开原会话')

  if (!sidebar.isTabEnabled('sidechat'))
    throw new Error('sidechat 已在现有侧栏设置中禁用，请在那里启用或打开原会话')

  flushSync(() => ctx.uiWorkspace.openSession(sessionId as SessionId))

  sidebar.openTab({ type: 'sidechat' }, { sessionId })
}
