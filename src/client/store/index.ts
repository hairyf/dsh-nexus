import type { PanelModel } from '../../types/web'
import { defineStore } from '@deepseek-ai/dsh-client-store'

export type TabKind = 'inbox' | 'overview' | 'ticket' | 'trigger' | 'channel' | 'setting'
export type Page = TabKind | 'channel/detail' | 'ticket/detail' | 'trigger/detail'
export const TABS = [
  { kind: 'inbox', label: 'tabInbox' },
  { kind: 'overview', label: 'tabOverview' },
  { kind: 'ticket', label: 'tabTickets' },
  { kind: 'trigger', label: 'tabTriggers' },
  { kind: 'channel', label: 'tabChannels' },
  { kind: 'setting', label: 'tabSettings' },
] as const
export function tabOf(page: Page): TabKind {
  return page.split('/')[0] as TabKind
}
export const store = defineStore({
  init: () => ({
    navigation: { page: 'inbox' as Page, ticketId: null as string | null, returnTo: 'ticket' as Page },
    channel: { selected: null as string | null },
    trigger: { selectedId: null as string | null },
    filters: { project: '', status: '', query: '' },
    graph: { zoom: 1, x: 0, y: 0, selectedId: null as string | null },
    model: null as PanelModel | null,
    read: { state: 'loading' as 'loading' | 'ready' | 'error', error: '' },
  }),
  actions: {
    go: (draft, page: Page) => {
      draft.navigation.page = page
    },
    openChannel: (draft, id: string) => {
      draft.channel.selected = id
      draft.navigation.page = 'channel/detail'
    },
    openTicket: (draft, id: string) => {
      if (draft.navigation.page !== 'ticket/detail')
        draft.navigation.returnTo = draft.navigation.page

      draft.navigation.ticketId = id

      draft.navigation.page = 'ticket/detail'
    },
    openThread: (draft, id: string) => {
      draft.trigger.selectedId = id
      draft.navigation.page = 'trigger/detail'
    },
    filter: (draft, patch: Partial<{
      project: string
      status: string
      query: string
    }>) => {
      Object.assign(draft.filters, patch)
    },
    beginRead: (draft) => {
      draft.read = { state: 'loading', error: '' }
    },
    receive: (draft, model: PanelModel) => {
      draft.model = model
      draft.read = { state: 'ready', error: '' }
    },
    failRead: (draft, error: string) => {
      draft.read = { state: 'error', error }
    },
    zoomGraph: (draft, delta: number) => {
      draft.graph.zoom = Math.max(0.5, Math.min(2, draft.graph.zoom + delta))
    },
    panGraph: (draft, x: number, y: number) => {
      draft.graph.x += x
      draft.graph.y += y
    },
    resetGraph: (draft) => {
      draft.graph.zoom = 1
      draft.graph.x = 0
      draft.graph.y = 0
    },
    selectAgent: (draft, id: string | null) => {
      draft.graph.selectedId = id
    },
  },
})
