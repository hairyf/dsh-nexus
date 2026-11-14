import type { OverviewView } from '../types'
import { defineStore } from '@deepseek-ai/dsh-client-store'
import { AGENT_GRAPH } from '../constants'

export type TabKind = 'overview' | 'ticket' | 'trigger' | 'channel' | 'setting'
export type Page = TabKind | 'channel/detail' | 'ticket/detail'

export const TABS = [
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
    navigation: { page: 'overview' as Page, ticketId: null as string | null, returnTo: 'overview' as 'overview' | 'ticket' },
    overview: { view: 'recent' as OverviewView },
    graph: { zoom: 1, x: 0, y: 0, selectedId: null as string | null },
  }),
  actions: {
    go: (draft, page: Page) => {
      draft.navigation.page = page
      if (page !== 'ticket/detail')
        draft.navigation.ticketId = null
    },
    openTicket: (draft, id: string) => {
      if (draft.navigation.page !== 'ticket/detail')
        draft.navigation.returnTo = draft.navigation.page === 'overview' ? 'overview' : 'ticket'
      draft.navigation.ticketId = id
      draft.navigation.page = 'ticket/detail'
    },
    setOverviewView: (draft, view: OverviewView) => {
      draft.overview.view = view
    },
    zoomGraph: (draft, delta: number) => {
      draft.graph.zoom = Math.max(AGENT_GRAPH.zoomMin, Math.min(AGENT_GRAPH.zoomMax, draft.graph.zoom + delta))
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
