import type { ReactNode } from 'react'
/**
 * 面板外壳：标题 + 五个 Tab + 收件箱抽屉 + 当前页面。
 *
 * 数据在这里统一拉一次，页面只负责画 —— 切 Tab 不会重新请求，
 * 也不会因为某个页面出错而整屏白掉。
 */

import type { SettingKey, Tab } from '../../constants'
import type { GetApiNexusTasksResponse, GetApiNexusTicketsidResponse } from '../apis/index.type'
import { useCallback, useMemo, useState } from 'react'
import { PANEL_ID } from '../../constants'
import {
  getApiNexusChannels,
  getApiNexusInbox,
  getApiNexusOverview,
  getApiNexusSettings,
  getApiNexusTasks,
  getApiNexusTriggers,
  postApiNexusChannelsIdEnabled,
  postApiNexusInboxKill,
  postApiNexusSettings,
  postApiNexusTicketsIdPause,
  usePoll,
} from '../api'
import { TAB_ITEMS, TAB_LABELS } from '../constants'
import { ChannelsPage } from './channels'
import { InboxIcon } from './icons'
import { InboxPanel } from './inbox-panel'
import { SegmentedTabs } from './official'
import { OverviewPage } from './overview'
import { SettingsPage } from './settings'
import { TaskDetailPage, TasksPage } from './tasks'
import { TriggersPage } from './triggers'

/** 页面位置。详情是「哪个 Tab + 哪个 id」，不另开路由。 */
interface Location {
  tab: Tab
  ticketId?: string
  threadKey?: string
}

export function NexusApp(): ReactNode {
  const [location, setLocation] = useState<Location>({ tab: 'overview' })
  const [inboxOpen, setInboxOpen] = useState(false)
  const [filter, setFilter] = useState('all')
  const [draft, setDraft] = useState<Partial<Record<SettingKey, number | boolean>>>({})

  const overview = usePoll(getApiNexusOverview)
  const tasks = usePoll<GetApiNexusTasksResponse>(() => getApiNexusTasks(filter === 'all' ? {} : { filter: filter as never }), undefined, [filter])
  const triggers = usePoll(() => getApiNexusTriggers(location.threadKey ? { thread: location.threadKey } : {}), undefined, [location.threadKey])
  const channels = usePoll(getApiNexusChannels)
  const settings = usePoll(getApiNexusSettings)
  const inbox = usePoll(() => getApiNexusInbox({}))

  const goto = useCallback((next: Location) => setLocation(next), [])

  const togglePause = useCallback(async (id: string, paused: boolean) => {
    await postApiNexusTicketsIdPause({ id }, { paused })
    await tasks.reload()
  }, [tasks])

  const killInbox = useCallback(async (ids: string[]) => {
    await postApiNexusInboxKill({ ids })
    await inbox.reload()
  }, [inbox])

  const saveSettings = useCallback(async () => {
    if (!Object.keys(draft).length)
      return
    await postApiNexusSettings(draft as never)
    setDraft({})
    await settings.reload()
  }, [draft, settings])

  const unread = useMemo(() => {
    const counts = inbox.data?.counts
    return counts ? counts.user + counts.main + counts.project + counts.supervisor : 0
  }, [inbox.data])

  const body = useMemo(() => {
    switch (location.tab) {
      case 'overview':
        return <OverviewPage data={overview.data} />
      case 'tasks':
        return location.ticketId
          ? (
              <TaskDetailPage
                id={location.ticketId}
                onBack={() => goto({ tab: 'tasks' })}
                onTogglePause={togglePause}
              />
            )
          : (
              <TasksPage
                data={tasks.data}
                filter={filter}
                onFilter={setFilter}
                onOpen={id => goto({ tab: 'tasks', ticketId: id })}
              />
            )
      case 'triggers':
        return (
          <TriggersPage
            data={triggers.data}
            threadKey={location.threadKey}
            onSelect={key => goto({ tab: 'triggers', threadKey: key })}
          />
        )
      case 'channels':
        return (
          <ChannelsPage
            data={channels.data}
            onToggle={async (id, enabled) => {
              await postApiNexusChannelsIdEnabled({ id }, { enabled })
              await channels.reload()
            }}
          />
        )
      case 'settings':
        return (
          <SettingsPage
            data={settings.data}
            draft={draft}
            onDraft={(key, value) => setDraft(current => ({ ...current, [key]: value }))}
            onReset={() => setDraft({})}
            onSave={saveSettings}
            busy={false}
            error={settings.error}
          />
        )
      default:
        return null
    }
    // 依赖里包含所有会改变内容的字段
  }, [location, overview.data, tasks.data, filter, triggers.data, channels.data, settings.data, draft, saveSettings, togglePause])

  return (
    <div className="nx-root relative flex h-full min-h-0 flex-col bg-nx-bg">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-4 pb-2 pt-4">
        <div className="min-w-0">
          <h1 className="text-[20px] font-semibold leading-tight text-nx-text">Nexus</h1>
          <p className="mt-0.5 max-w-[42rem] text-[11px] leading-relaxed text-nx-caption">
            三层编排：主编排判方向，项目编排管任务，Worker 动手。人不在一层里，人就是收件人之一。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setInboxOpen(open => !open)}
          className={`flex items-center gap-1.5 rounded-nx-sm border px-2.5 py-1.5 text-[12px] transition-colors ${
            unread > 0
              ? 'border-nx-warn text-nx-warn hover:bg-nx-hover'
              : 'border-nx-border-2 text-nx-text-2 hover:bg-nx-hover'
          }`}
        >
          <InboxIcon size={14} />
          收件箱
          {unread > 0 && (
            <span className="rounded-full bg-nx-warn px-1.5 text-[10px] font-medium text-white">{unread}</span>
          )}
        </button>
      </header>

      <div className="shrink-0 px-4 pb-3">
        <SegmentedTabs
          items={TAB_ITEMS}
          value={location.tab}
          onChange={tab => goto({ tab })}
          label="Nexus 导航"
          className="max-w-md"
        />
      </div>

      <main id={`${PANEL_ID}-panel`} className="min-h-0 flex-1">
        {body}
      </main>

      <InboxPanel
        data={inbox.data}
        open={inboxOpen}
        onClose={() => setInboxOpen(false)}
        onKill={killInbox}
      />
    </div>
  )
}

/** 供外部（测试 / 调试）读到的 Tab 名字。 */
export const TAB_TITLES = TAB_LABELS
export type { GetApiNexusTicketsidResponse }
