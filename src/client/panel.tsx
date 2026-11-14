import type { SegmentedTab } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReactNode } from 'react'
import type { TabKind } from './store'
import { Button, SegmentedTabs } from '@deepseek-ai/dsh-client-ui-primitives'
import { useId } from 'react'
import { Case, Switch } from 'react-if-lite'
import { useNavigate, usePage } from './hooks/use-navigation'
import { useTranslation } from './hooks/use-translation'
import { ChannelDetail } from './pages/channel/detail/page'
import { Channel } from './pages/channel/page'
import { Overview } from './pages/overview/page'
import { Setting } from './pages/setting/page'
import { TicketDetail } from './pages/ticket/detail/page'
import { Ticket } from './pages/ticket/page'
import { Trigger } from './pages/trigger/page'
import { tabOf, TABS } from './store'

export function Panel(): ReactNode {
  const { t } = useTranslation()
  const page = usePage()
  const navigate = useNavigate()
  const tabsId = useId().replaceAll(':', '')
  const items = TABS.map(tab => ({ value: tab.kind, label: t(tab.label), id: `${tabsId}-${tab.kind}`, panelId: `${tabsId}-${tab.kind}-panel` })) as [SegmentedTab<TabKind>, ...SegmentedTab<TabKind>[]]
  const tab = tabOf(page)
  return (
    <section className="flex h-full min-w-0 w-full flex-col items-center overflow-y-auto px-[clamp(20px,4vw,48px)] text-[13px] leading-5 text-[var(--dsw-alias-label-primary)]" style={{ fontFamily: 'var(--dsw-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif)' }}>
      <header className="flex w-full max-w-[1080px] flex-none flex-col gap-5 pt-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl leading-7 font-semibold">{t('title')}</h1>
            <p className="mt-1 text-[13px] leading-5 text-[var(--dsw-alias-label-secondary)]">{t('desc')}</p>
          </div>
          <Button variant="outline" size="sm" disabled title={t('overviewUnavailable')}>{t('openMainSession')}</Button>
        </div>
        <SegmentedTabs size="sm" items={items} value={tab} onChange={navigate} label={t('tabsLabel')} className="w-fit" />
      </header>
      <div id={`${tabsId}-${tab}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${tab}`} className="mt-6 flex w-full max-w-[1080px] flex-none flex-col gap-6">
        <Switch value={page}>
          <Case cond="overview"><Overview /></Case>
          <Case cond="ticket"><Ticket /></Case>
          <Case cond="ticket/detail"><TicketDetail /></Case>
          <Case cond="trigger"><Trigger /></Case>
          <Case cond="channel"><Channel /></Case>
          <Case cond="channel/detail"><ChannelDetail /></Case>
          <Case cond="setting"><Setting /></Case>
        </Switch>
      </div>
    </section>
  )
}
