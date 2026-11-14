import type { ReactNode } from 'react'
import type { OverviewTask } from '../../../types'
import { Button, StateDot, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { useId } from 'react'
import { ActivityIcon, ArrowLeftIcon, ChannelsIcon, GitBranchIcon, GitHubIcon, NexusIcon } from '../../../components/icons'
import { AGENT_GRAPH_EDGES, AGENT_GRAPH_NODES, OVERVIEW_CHANNEL_LABELS, OVERVIEW_CHANNELS, OVERVIEW_STATUS, OVERVIEW_TASKS, TICKET_DETAIL_PREVIEWS } from '../../../constants'
import { useActions, useStore } from '../../../hooks/use-store'
import { useTranslation } from '../../../hooks/use-translation'
import { Arrivals } from './components/arrivals'
import { Issues } from './components/issues'
import { Metric } from './components/metric'
import { PrStatus } from './components/pr-status'
import { Relations } from './components/relations'
import { Section } from './components/section'

export function TicketDetail(): ReactNode {
  const { t } = useTranslation()
  const { go } = useActions()
  const executionDescriptionId = useId()
  const { ticketId, returnTo } = useStore(state => state.navigation)
  const task = OVERVIEW_TASKS.find(task => task.id === ticketId)
  const back = <Button variant="ghost" size="sm" icon={<ArrowLeftIcon width={16} height={16} />} onClick={() => go(returnTo)}>{t('ticketBack')}</Button>
  if (!task) {
    return (
      <section className="flex flex-col gap-5 pb-10">
        <div>{back}</div>
        <div className="rounded-2xl border border-[var(--dsw-alias-border-l3)] p-6">
          <h2 className="text-base font-medium">{t('ticketNotFound')}</h2>
          <p className="mt-2 text-[13px] text-[var(--dsw-alias-label-secondary)]">{t('ticketNotFoundDescription')}</p>
          <Button variant="outline" size="sm" onClick={() => go('ticket')} className="mt-4">{t('tabTickets')}</Button>
        </div>
      </section>
    )
  }
  const preview = TICKET_DETAIL_PREVIEWS[task.id]
  const status = OVERVIEW_STATUS[task.status]
  const connected = OVERVIEW_CHANNELS.some(channel => channel.kind === task.channel && channel.connected)
  const node = AGENT_GRAPH_NODES.find(node => node.taskId === task.id)
  const dependencies = new Set<OverviewTask['id']>()
  const associations = new Set<OverviewTask['id']>()
  if (node) {
    for (const edge of AGENT_GRAPH_EDGES) {
      if (edge.kind === 'flow' || (edge.source !== node.id && (edge.kind !== 'association' || edge.target !== node.id)))
        continue
      const opposite = edge.source === node.id ? edge.target : edge.source
      const id = AGENT_GRAPH_NODES.find(node => node.id === opposite)?.taskId
      if (id)
        (edge.kind === 'dependency' ? dependencies : associations).add(id)
    }
  }
  return (
    <section className="@container flex min-w-0 flex-col gap-5 pb-10" aria-label={t('ticketDetail')}>
      <div>{back}</div>
      <header className="flex flex-wrap items-start justify-between gap-x-5 gap-y-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <span className="text-xs text-[var(--dsw-alias-label-tertiary)]">{task.id}</span>
            <Tag tone={status.tone}>{t(status.label)}</Tag>
            <Tag tone="quiet">{t('overviewDemo')}</Tag>
          </div>
          <h2 className="m-0 text-lg leading-7 font-medium [overflow-wrap:anywhere]">{t(task.title)}</h2>
        </div>
        {preview && (preview.pullRequest || preview.execution) && (
          <div className="flex min-w-0 flex-col items-end gap-1.5">
            <div className="flex flex-wrap items-center justify-end gap-2">
              {preview.pullRequest && <PrStatus pullRequest={preview.pullRequest} />}
              {preview.execution === 'linked' && <Button variant="outline" size="sm" disabled title={t('ticketExecutionUnavailable')} aria-describedby={executionDescriptionId}>{t('overviewOpenSession')}</Button>}
              {preview.execution === 'not-created' && <Button variant="outline" size="sm" disabled title={t('ticketResendUnavailable')} aria-describedby={executionDescriptionId}>{t('ticketResend')}</Button>}
            </div>
            {preview.execution && <p id={executionDescriptionId} className="m-0 max-w-64 text-right text-xs leading-4 text-[var(--dsw-alias-label-secondary)]">{t(preview.execution === 'not-created' ? 'ticketResendUnavailable' : 'ticketExecutionUnavailable')}</p>}
          </div>
        )}
      </header>
      <dl className="m-0 grid min-w-0 gap-3 @min-[460px]:grid-cols-2 @min-[820px]:grid-cols-4">
        <Metric label={t('ticketProject')} icon={<NexusIcon width={17} height={17} />}>
          {preview?.repository
            ? (
                <span className="inline-flex min-w-0 items-center gap-1.5" title={preview.repository}>
                  <GitHubIcon width={14} height={14} className="shrink-0" />
                  <span className="truncate">{preview.repository}</span>
                </span>
              )
            : <span className="font-normal text-[var(--dsw-alias-label-secondary)]">{t('ticketProjectEmpty')}</span>}
        </Metric>
        <Metric label={t('ticketChannel')} icon={<ChannelsIcon width={17} height={17} />}>
          {OVERVIEW_CHANNEL_LABELS[task.channel]}
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-normal text-[var(--dsw-alias-label-secondary)]">
            <StateDot state={connected ? 'done' : 'idle'} size={6} />
            {t(connected ? 'ticketChannelConnected' : 'overviewDisconnected')}
          </span>
        </Metric>
        <Metric label={t(task.status === 'waiting' ? 'ticketWaitDuration' : 'ticketExecutionDuration')} icon={<ActivityIcon width={17} height={17} />}>
          <span className="tabular-nums">{task.duration}</span>
        </Metric>
        <Metric label={t('ticketExecutionBranch')} icon={<GitBranchIcon width={17} height={17} />}>
          {preview?.branch
            ? <span className="min-w-0 truncate font-mono text-xs" title={preview.branch}>{preview.branch}</span>
            : <span className="font-normal text-[var(--dsw-alias-label-secondary)]">{t('ticketBranchPending')}</span>}
        </Metric>
      </dl>
      <div className="grid min-w-0 gap-4 @min-[740px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Issues issues={preview?.issues ?? []} />
          <Section title={t('ticketDependencies')}>
            <Relations tasks={OVERVIEW_TASKS.filter(task => dependencies.has(task.id))} empty={t('ticketDependenciesEmpty')} clear />
          </Section>
          <Section title={t('ticketRelatedTasks')}>
            <Relations tasks={OVERVIEW_TASKS.filter(task => associations.has(task.id))} empty={t('ticketRelatedTasksEmpty')} />
          </Section>
        </div>
        <div className="grid min-w-0 grid-rows-[auto_1fr] gap-4">
          <Section title={t('graphSupervisor')}>
            <p className="m-0 text-[13px] leading-5 text-[var(--dsw-alias-label-secondary)]">{t('ticketSupervisorEmpty')}</p>
          </Section>
          <Section title={t('ticketArrivals')}>
            <Arrivals key={task.id} arrivals={preview?.arrivals ?? []} />
          </Section>
        </div>
      </div>
    </section>
  )
}
