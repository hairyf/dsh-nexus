import type { RuntimeSettings, Section } from '../pages/setting/model'
import type { Filters } from '../pages/trigger/model'
import type { OverviewChannelKind, OverviewView } from '../types'
import { defineStore } from '@deepseek-ai/dsh-client-store'
import { AGENT_GRAPH } from '../constants'
import { GROUPS, initialSettings, refreshProjects, validSettings } from '../pages/setting/model'

export type TabKind = 'overview' | 'ticket' | 'trigger' | 'channel' | 'setting'
export type Page = TabKind | 'channel/detail' | 'ticket/detail' | 'trigger/detail'

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
    navigation: { page: 'overview' as Page, ticketId: null as string | null, returnTo: 'overview' as 'overview' | 'ticket' | 'trigger' | 'trigger/detail' },
    channel: { selected: null as OverviewChannelKind | null },
    overview: { view: 'recent' as OverviewView },
    setting: initialSettings(),
    trigger: { selectedId: null as string | null, openFilter: null as 'channel' | 'kind' | 'status' | null, filters: { query: '', channel: 'all', status: 'all', kind: 'all', mentionedOnly: false } as Filters },
    graph: { zoom: 1, x: 0, y: 0, selectedId: null as string | null },
  }),
  actions: {
    go: (draft, page: Page) => {
      draft.navigation.page = page
      draft.trigger.openFilter = null
      if (page !== 'ticket/detail')
        draft.navigation.ticketId = null
      if (page !== 'channel/detail')
        draft.channel.selected = null
    },
    openChannel: (draft, kind: OverviewChannelKind) => {
      draft.channel.selected = kind
      draft.navigation.ticketId = null
      draft.navigation.page = 'channel/detail'
    },
    openTicket: (draft, id: string) => {
      if (draft.navigation.page !== 'ticket/detail')
        draft.navigation.returnTo = draft.navigation.page === 'overview' || draft.navigation.page === 'trigger' || draft.navigation.page === 'trigger/detail' ? draft.navigation.page : 'ticket'
      draft.navigation.ticketId = id
      draft.channel.selected = null
      draft.navigation.page = 'ticket/detail'
    },
    openThread: (draft, id: string) => {
      draft.trigger.selectedId = id
      draft.navigation.ticketId = null
      draft.channel.selected = null
      draft.navigation.page = 'trigger/detail'
    },
    setTriggerFilterMenu: (draft, filter: 'channel' | 'kind' | 'status' | null) => {
      draft.trigger.openFilter = filter
    },
    setTriggerFilters: (draft, filters: Partial<Filters>) => {
      Object.assign(draft.trigger.filters, filters)
      draft.trigger.openFilter = null
    },
    resetTriggerFilters: (draft) => {
      draft.trigger.openFilter = null
      draft.trigger.filters = { query: '', channel: 'all', status: 'all', kind: 'all', mentionedOnly: false }
    },
    setSettingSection: (draft, section: Section) => {
      draft.setting.section = section
      draft.setting.invalid = false
      draft.setting.notice = null
    },
    refreshSettingProjects: (draft, at: string) => {
      draft.setting.projects = refreshProjects(draft.setting.projects)
      draft.setting.refreshedAt = at
      draft.setting.notice = 'refreshed'
    },
    toggleSettingProject: (draft, id: string, enabled: boolean) => {
      const project = draft.setting.projects.find(project => project.id === id)
      if (!project || (enabled && !project.available))
        return
      project.enabled = enabled
      draft.setting.notice = 'project'
    },
    editSettings: (draft, patch: Partial<RuntimeSettings>) => {
      Object.assign(draft.setting.draft, patch)
      if (patch.autoMerge === false && !validSettings({ ...draft.setting.saved, autoMergeMaxLines: draft.setting.draft.autoMergeMaxLines }))
        draft.setting.draft.autoMergeMaxLines = draft.setting.saved.autoMergeMaxLines
      draft.setting.invalid = false
      draft.setting.notice = null
    },
    resetSettings: (draft, section: 'execution' | 'delivery') => {
      for (const key of GROUPS[section])
        Object.assign(draft.setting.draft, { [key]: draft.setting.saved[key] })
      draft.setting.invalid = false
      draft.setting.notice = null
    },
    saveSettings: (draft, section: 'execution' | 'delivery') => {
      const next = { ...draft.setting.saved }
      for (const key of GROUPS[section])
        Object.assign(next, { [key]: draft.setting.draft[key] })
      if (!validSettings(next)) {
        draft.setting.invalid = true
        draft.setting.notice = null
        return
      }
      draft.setting.saved = next
      draft.setting.invalid = false
      draft.setting.notice = 'saved'
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
