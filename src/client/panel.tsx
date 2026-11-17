import type {} from '@deepseek-ai/dsh-client-connection/client'
import type { SegmentedTab } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReactNode } from 'react'
import type { TabKind } from './store'
import { Button, SegmentedTabs } from '@deepseek-ai/dsh-client-ui-primitives'
import { useAsyncState, useEventListener, useIntervalFn } from '@reause/core'
import { useEffect, useId, useRef } from 'react'
import { nexus } from './apis/nexus'
import { useDshContext } from './hooks/use-dsh-context'
import { useNavigate, usePage } from './hooks/use-navigation'
import { RefreshContext } from './hooks/use-panel'
import { useActions, useStore } from './hooks/use-store'
import { useTranslation } from './hooks/use-translation'
import { ChannelDetail } from './pages/channel/detail/page'
import { Channel } from './pages/channel/page'
import { Inbox } from './pages/inbox/page'
import { Overview } from './pages/overview/page'
import { Setting } from './pages/setting/page'
import { TicketDetail } from './pages/ticket/detail/page'
import { Ticket } from './pages/ticket/page'
import { TriggerDetail } from './pages/trigger/detail/page'
import { Trigger } from './pages/trigger/page'
import { tabOf, TABS } from './store'

export function Panel(): ReactNode {
  const { t } = useTranslation()

  const page = usePage()

  const navigate = useNavigate()

  const actions = useActions()

  const read = useStore(state => state.read)

  const model = useStore(state => state.model)

  const ctx = useDshContext()

  const sequence = useRef(0)

  const resource = useAsyncState(async () => {
    const generation = ++sequence.current

    actions.beginRead()

    try {
      const model = await nexus.read()

      if (generation === sequence.current)
        actions.receive(model)

      return model
    }
    catch (error) {
      if (generation === sequence.current)
        actions.failRead(error instanceof Error ? error.message : String(error))

      throw error
    }
  }, null, { resetOnExecute: false })
  // keep:effect Reconcile the ledger after the host replaces the authenticated connection.

  useEffect(() => {
    const dispose = ctx.on('connection/reset', () => {
      void resource.executeImmediate()
    })

    return () => {
      dispose()
    }
  }, [ctx, resource.executeImmediate])

  const refresh = async (): Promise<void> => {
    await resource.executeImmediate()
  }

  useEventListener('online', refresh)

  useEventListener('focus', refresh)

  useIntervalFn(() => {
    if (document.visibilityState === 'visible' && read.state === 'ready' && !resource.isLoading)
      void refresh()
  }, 15000)

  const tabsId = useId().replaceAll(':', '')

  const items = TABS.map(tab => ({ value: tab.kind, label: t(tab.label), id: `${tabsId}-${tab.kind}`, panelId: `${tabsId}-${tab.kind}-panel` })) as [
    SegmentedTab<TabKind>,
    ...SegmentedTab<TabKind>[],
  ]

  const tab = tabOf(page)

  return (
    <RefreshContext.Provider value={refresh}>
      <section className="box-border flex h-full min-h-0 w-full min-w-0 max-w-full flex-col items-center overflow-y-auto px-[clamp(20px,4vw,48px)] text-[13px] leading-5 text-[var(--dsw-alias-label-primary)] [&_*]:box-border" style={{ fontFamily: 'var(--dsw-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif)' }}>
        <header className="flex w-full min-w-0 max-w-[1080px] flex-none flex-col gap-5 pt-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl leading-7 font-semibold">{t('title')}</h1>
              <p className="mt-1 text-[13px] text-[var(--dsw-alias-label-secondary)]">{t('desc')}</p>
              {model && (
                <p role="status" className="mt-1 text-[var(--dsw-alias-label-secondary)]">
                  {{ initializing: '正在恢复运行责任', initialization_failed: '运行初始化失败', idle: '运行空闲', running: '正在执行', unavailable: '运行不可用', delivery_failed: '投递失败' }[model.run.state]}
                  {model.run.reason ? ` · ${model.run.reason}` : ''}
                </p>
              )}
            </div>
            <Button variant="outline" size="sm" disabled={resource.isLoading} onClick={() => void refresh()}>{resource.isLoading ? '正在与账本对账…' : '刷新服务端状态'}</Button>
          </div>
          <div className="w-full min-w-0 overflow-x-auto"><SegmentedTabs size="sm" items={items} value={tab} onChange={navigate} label={t('tabsLabel')} className="w-fit" /></div>
        </header>
        <div id={`${tabsId}-${tab}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${tab}`} className="mt-6 flex w-full min-w-0 max-w-[1080px] flex-none flex-col gap-6 pb-10">
          {read.state === 'error' && (
            <div role="alert" className="rounded-xl border border-[var(--dsw-alias-border-l2)] p-4 text-[var(--dsw-alias-state-error-primary)]">
              读取 Nexus 账本失败：
              {read.error}
              。
              {model ? '下方为上次读取结果，答复控件已锁定。' : '尚未取得数据，不代表没有待办。'}
              <Button size="sm" variant="outline" onClick={() => void refresh()}>重新读取</Button>
            </div>
          )}
          {!model && read.state === 'loading' && <p role="status">正在读取项目、信箱与运行事实；超过 15 秒将显示读取失败，可重试。</p>}
          {model && (
            <>
              {page === 'inbox' && <Inbox />}
              {page === 'overview' && <Overview />}
              {page === 'ticket' && <Ticket />}
              {page === 'ticket/detail' && <TicketDetail />}
              {page === 'trigger' && <Trigger />}
              {page === 'trigger/detail' && <TriggerDetail />}
              {page === 'channel' && <Channel />}
              {page === 'channel/detail' && <ChannelDetail />}
              {page === 'setting' && <Setting />}
            </>
          )}
        </div>
      </section>
    </RefreshContext.Provider>
  )
}
