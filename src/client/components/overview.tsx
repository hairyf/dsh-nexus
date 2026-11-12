/**
 * 概览页。
 *
 * 上半部分是四张统计卡（监听渠道 / 近 24h 触发 / 任务分布 / 需介入），
 * 下半部分用 SegmentedTabs 在「近期任务」和「层级关系」之间切换 ——
 * 两块都不小，同时铺开会挤，所以二选一。
 */

import type { ReactNode } from 'react'
import type { GetApiNexusOverviewResponse } from '../apis/index.type'
import type { OverviewView } from '../constants'
import { useState } from 'react'
import { OVERVIEW_VIEW_LABELS, OVERVIEW_VIEWS } from '../constants'
import { HierarchyGraph } from './graph'
import { NexusIcon } from './icons'
import { SegmentedTabs } from './official'
import { AttentionMark, Empty, Metric, relative, StatusTag } from './widgets'

type Overview = GetApiNexusOverviewResponse

const VIEW_ITEMS = OVERVIEW_VIEWS.map(view => ({
  value: view,
  label: OVERVIEW_VIEW_LABELS[view],
  id: `nexus-overview-${view}`,
  panelId: `nexus-overview-panel-${view}`,
})) as [{ value: OverviewView, label: string, id: string, panelId: string }, ...{ value: OverviewView, label: string, id: string, panelId: string }[]]

export function OverviewPage({ data }: { data: Overview | undefined }): ReactNode {
  const [view, setView] = useState<OverviewView>('summary')

  if (!data) {
    return <p className="px-4 py-8 text-center text-[12px] text-[var(--dsw-alias-label-primary)]-3">正在读取…</p>
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto p-4 nx-scroll">
      <StatsRow data={data} />
      <SegmentedTabs items={VIEW_ITEMS} value={view} onChange={setView} label="概览视图" className="shrink-0 self-start" />
      <div className="min-h-0 flex-1">
        {view === 'summary' ? <RecentTickets data={data} /> : <Hierarchy data={data} />}
      </div>
    </div>
  )
}

/** 四张统计卡。 */
function StatsRow({ data }: { data: Overview }): ReactNode {
  const channels = data.stats.channels
  const listening = channels.filter(channel => channel.enabled).length
  const tickets = data.stats.tickets
  const undone = tickets.waiting + tickets.queued + tickets.running
  const attention = data.recent.filter(ticket => ticket.attention).length

  return (
    <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
      <MetricCard title="监听渠道" hint={`${listening}/${channels.length}`}>
        <div className="flex flex-wrap gap-1.5">
          {channels.length === 0
            ? <span className="text-[12px] text-[var(--dsw-alias-label-primary)]-3">还没有渠道</span>
            : channels.map(channel => (
                <span
                  key={channel.id}
                  className={`inline-flex items-center gap-1 rounded-nx-sm border px-2 py-1 text-[11px] ${
                    channel.enabled ? 'border-[var(--dsw-alias-border-l2)] text-[var(--dsw-alias-label-primary)]' : 'border-[var(--dsw-alias-border-l1)] text-[var(--dsw-alias-label-primary)]-3'
                  }`}
                  title={`${channel.threads} 个话题 · ${channel.accounts} 个账号`}
                >
                  <NexusIcon size={12} className={channel.enabled ? 'text-[var(--dsw-alias-state-success-primary)]' : 'text-[var(--dsw-alias-state-idle-primary)]'} />
                  {channel.name}
                </span>
              ))}
        </div>
      </MetricCard>

      <MetricCard title="近期触发（24h）" hint={`过滤 ${data.stats.filtered24h} 条`}>
        <Metric value={data.stats.received24h} unit="条" />
        <p className="mt-1 text-[11px] text-[var(--dsw-alias-label-caption)]">
          {data.stats.filtered24h > 0 ? `已过滤 ${data.stats.filtered24h} 条` : '全部进入处理流程'}
        </p>
      </MetricCard>

      <MetricCard title="任务分布" hint={`共 ${undone + tickets.review + tickets.done + tickets.cancelled} 张`}>
        <Metric value={tickets.running + tickets.queued} unit="进行中" hint={`等待 ${tickets.waiting}`} />
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
          <Count label="待审" value={tickets.review} tone="text-[var(--dsw-alias-state-warn-primary)]" />
          <Count label="已完成" value={tickets.done} tone="text-[var(--dsw-alias-state-success-primary)]" />
          <Count label="已取消" value={tickets.cancelled} tone="text-[var(--dsw-alias-label-primary)]-3" />
        </div>
      </MetricCard>

      <MetricCard title="需介入" hint="有 pending ask">
        <Metric value={attention} unit="张" />
        <p className="mt-1 text-[11px] text-[var(--dsw-alias-label-caption)]">
          {attention > 0 ? '这些问题停着等回答' : '没有卡住的问题'}
        </p>
      </MetricCard>
    </div>
  )
}

function MetricCard({ title, hint, children }: { title: string, hint?: string, children: ReactNode }): ReactNode {
  return (
    <div className="nx-card flex flex-col gap-1.5 px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-medium text-[var(--dsw-alias-label-primary)]-2">{title}</span>
        {hint && <span className="text-[10px] text-[var(--dsw-alias-label-caption)]">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function Count({ label, value, tone }: { label: string, value: number, tone: string }): ReactNode {
  return (
    <span className="inline-flex items-baseline gap-1 text-[11px]">
      <span className="text-[var(--dsw-alias-label-primary)]-3">{label}</span>
      <span className={`tabular-nums ${tone}`}>{value}</span>
    </span>
  )
}

/** 近期任务。 */
function RecentTickets({ data }: { data: Overview }): ReactNode {
  return (
    <div className="nx-card flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--dsw-alias-border-l1)] px-4 py-2.5">
        <h3 className="text-[13px] font-medium text-[var(--dsw-alias-label-primary)]">近期任务</h3>
        <span className="text-[10px] text-[var(--dsw-alias-label-caption)]">
          {data.recent.length}
          {' '}
          张
        </span>
      </header>
      <div className="min-h-0 flex-1 overflow-auto nx-scroll">
        {data.recent.length === 0
          ? <Empty text="还没有任务" />
          : (
              <ul className="divide-y divide-[var(--dsw-alias-border-l1)]">
                {data.recent.map(ticket => (
                  <li key={ticket.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 font-mono text-[11px] text-[var(--dsw-alias-label-primary)]-3">{ticket.id}</span>
                        <span className="truncate text-[13px] text-[var(--dsw-alias-label-primary)]">{ticket.title}</span>
                        {ticket.attention && <AttentionMark />}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--dsw-alias-label-caption)]">
                        <span>{ticket.project}</span>
                        <span aria-hidden>·</span>
                        <span>{ticket.channel}</span>
                        <span aria-hidden>·</span>
                        <span>{relative(ticket.updatedAt)}</span>
                        {ticket.error && (
                          <span className="text-[var(--dsw-alias-state-error-primary)]">
                            系统错误：
                            {ticket.error}
                          </span>
                        )}
                      </div>
                    </div>
                    <StatusTag status={ticket.status} />
                  </li>
                ))}
              </ul>
            )}
      </div>
    </div>
  )
}

/** 层级关系图。 */
function Hierarchy({ data }: { data: Overview }): ReactNode {
  return (
    <div className="nx-card flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--dsw-alias-border-l1)] px-4 py-2.5">
        <h3 className="text-[13px] font-medium text-[var(--dsw-alias-label-primary)]">层级关系</h3>
        <span className="text-[10px] text-[var(--dsw-alias-label-caption)]">节点按真实记录生成</span>
      </header>
      <div className="min-h-0 flex-1 overflow-auto nx-scroll">
        <HierarchyGraph nodes={data.graph.nodes} edges={data.graph.edges} />
      </div>
    </div>
  )
}
