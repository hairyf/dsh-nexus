import type { SegmentedTab } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReactNode } from 'react'
import type { OverviewView } from '../../types'
import { SegmentedTabs, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { useId } from 'react'
import { ActivityIcon, ChannelsIcon, TasksIcon } from '../../components/icons'
import { OVERVIEW_CHANNELS, OVERVIEW_METRICS, OVERVIEW_TASK_SEGMENTS, OVERVIEW_TASKS } from '../../constants'
import { useNavigate } from '../../hooks/use-navigation'
import { useActions, useStore } from '../../hooks/use-store'
import { useTranslation } from '../../hooks/use-translation'
import { Row } from '../ticket/components/row'
import { ActivityChart } from './components/activity-chart'
import { ChannelTile } from './components/channel-tile'
import { Graph } from './components/graph'
import { SummaryCard } from './components/summary-card'
import { TaskChart } from './components/task-chart'

export function Overview(): ReactNode {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { setOverviewView } = useActions()
  const view = useStore(state => state.overview.view)
  const id = useId().replaceAll(':', '')
  const tabs: [SegmentedTab<OverviewView>, SegmentedTab<OverviewView>] = [
    { value: 'recent', label: t('overviewRecent'), id: `${id}-recent`, panelId: `${id}-recent-panel` },
    { value: 'hierarchy', label: t('overviewHierarchy'), id: `${id}-hierarchy`, panelId: `${id}-hierarchy-panel` },
  ]
  return (
    <div className="@container flex flex-col gap-7 pb-10">
      <div className="grid grid-cols-1 gap-4 @min-[800px]:grid-cols-3">
        <SummaryCard title={t('overviewChannels')} meta={`${OVERVIEW_CHANNELS.filter(channel => channel.connected).length}/${OVERVIEW_CHANNELS.length}`} icon={<ChannelsIcon width={18} height={18} className="shrink-0" />} actionLabel={t('overviewMoreChannels')} onMore={() => navigate('channel')}>
          <div className="mt-auto grid grid-cols-3 gap-2.5">{OVERVIEW_CHANNELS.slice(0, 3).map(channel => <ChannelTile key={channel.name} channel={channel} />)}</div>
          <p className="mt-auto pt-3 text-xs leading-5 text-[var(--dsw-alias-label-tertiary)]">{t('overviewOtherChannel')}</p>
        </SummaryCard>
        <SummaryCard
          title={t('overviewReceived')}
          meta={t('overviewLastDay')}
          icon={<ActivityIcon width={18} height={18} className="shrink-0" />}
          actionLabel={t('overviewMoreActivity')}
          onMore={() => navigate('trigger')}
          background={<ActivityChart />}
        >
          <p aria-label={t('overviewActivityChart')} className="flex items-baseline gap-1.5 tabular-nums">
            <span className="text-[32px] leading-10 font-semibold tracking-tight">{OVERVIEW_METRICS.rate}</span>
            <span className="text-sm text-[var(--dsw-alias-label-secondary)]">{t('overviewPerHour')}</span>
          </p>
          <dl className="mt-auto flex flex-col gap-1 text-xs leading-5 text-[var(--dsw-alias-label-secondary)]">
            <div className="flex gap-2">
              <dt>{t('overviewTotalMessages')}</dt>
              <dd className="tabular-nums">{`${OVERVIEW_METRICS.received} ${t('overviewItems')}`}</dd>
            </div>
            <div className="flex gap-2">
              <dt>{t('overviewFiltered')}</dt>
              <dd className="tabular-nums">{`${OVERVIEW_METRICS.filtered} ${t('overviewItems')}`}</dd>
            </div>
          </dl>
        </SummaryCard>
        <SummaryCard title={t('overviewTaskSummary')} icon={<TasksIcon width={18} height={18} className="shrink-0" />} actionLabel={t('overviewMoreTasks')} onMore={() => navigate('ticket')}>
          <div className="flex min-h-0 flex-1 items-center justify-between gap-3">
            <div className="flex h-full min-w-0 flex-col">
              <p className="flex items-baseline gap-1.5 tabular-nums">
                <span className="text-[32px] leading-10 font-semibold tracking-tight">{OVERVIEW_METRICS.added}</span>
                <span className="text-xs text-[var(--dsw-alias-label-secondary)]">{t('overviewAdded')}</span>
              </p>
              <dl className="mt-auto grid grid-cols-[auto_max-content] gap-x-5 gap-y-1 text-xs leading-5 text-[var(--dsw-alias-label-secondary)]">
                {OVERVIEW_TASK_SEGMENTS.map(segment => (
                  <div key={segment.name} className="col-span-2 grid grid-cols-subgrid items-center whitespace-nowrap">
                    <dt className="flex items-center gap-2">
                      <span className="size-1.5 shrink-0 rounded-full" style={{ background: segment.color }} />
                      {t(segment.name)}
                    </dt>
                    <dd className="m-0 text-right tabular-nums">{segment.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <TaskChart />
          </div>
        </SummaryCard>
      </div>
      <section aria-label={t('overviewTaskViews')}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <SegmentedTabs size="sm" value={view} onChange={setOverviewView} items={tabs} label={t('overviewTaskViews')} />
          <span title={t('overviewDemoDescription')}><Tag tone="quiet">{t('overviewDemo')}</Tag></span>
        </div>
        <div id={`${id}-${view}-panel`} role="tabpanel" aria-labelledby={`${id}-${view}`} tabIndex={0} className="rounded-2xl outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dsw-alias-state-business-primary)]">
          {view === 'recent' ? <ul className="pl-0">{OVERVIEW_TASKS.map(task => <Row key={task.id} task={task} />)}</ul> : <Graph />}
        </div>
      </section>
    </div>
  )
}
