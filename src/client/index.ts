/** Client 插件入口：注册主面板与侧边栏图标。 */

import type { Context } from '@deepseek-ai/cordis'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { SidebarPanelIconOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { createElement } from 'react'
import { ENTRY, PANEL_ID } from '../constants'
import { NexusApp } from './components/app'
import { NexusIcon } from './components/icons'

/** 侧边栏图标。`size` 与 `active` 由槽位给，不是自己定的。 */
function NexusSidebarIcon({ size, active }: SidebarPanelIconOwnerProps): ReturnType<typeof createElement> {
  return createElement(NexusIcon, { size, className: active ? 'text-nx-brand' : undefined })
}

export const inject = ['slots']

/**
 * 注册两处：
 *   主面板（keyed `main`）—— 点侧边栏那一条时中间区域显示的东西
 *   侧边栏图标（`sidebar.panellist`）—— 进得去的入口
 *
 * **两处各自独立兜底。** 宿主没装 sidebar、或者槽位还没声明时，
 * 单个注册失败不能把整个客户端带崩 —— 白屏比缺一个入口严重得多。
 */
export function apply(ctx: Context): void {
  safely(ctx, 'main', () => ctx.slots.inject('main', () => ctx.slots.register(
    { name: 'main', key: PANEL_ID as MainPanelId, inject: () => ({}) },
    () => createElement(NexusApp),
  )))

  safely(ctx, 'sidebar.panellist', () => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
    { name: 'sidebar.panellist', id: PANEL_ID as MainPanelId, order: 20, label: () => 'Nexus' },
    NexusSidebarIcon,
  )))
}

/** 注册一处槽位；失败只记一笔，不抛出。 */
function safely(ctx: Context, slot: string, register: () => void): void {
  try {
    register()
  }
  catch (failure) {
    console.warn(`[${ENTRY}] 槽位 ${slot} 注册失败，面板入口不可用：${String(failure)}`)
  }
}

export { ENTRY }
