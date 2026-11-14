import type { ReactNode } from 'react'
import { Button, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { ArrowLeftIcon } from '../../../components/icons'
import { useActions, useStore } from '../../../hooks/use-store'
import { useTranslation } from '../../../hooks/use-translation'
import { groupTopics, RECORDS, sourceHref, THREAD_KINDS, TRIAGE } from '../model'
import { Event } from './components/event'

export function TriggerDetail(): ReactNode {
  const { t } = useTranslation()
  const { go, openTicket } = useActions()
  const id = useStore(state => state.trigger.selectedId)
  const topic = groupTopics(RECORDS).find(topic => topic.latest.thread.id === id)
  const back = <Button size="sm" variant="ghost" icon={<ArrowLeftIcon width={16} height={16} />} onClick={() => go('trigger')}>{t('triggerBack')}</Button>
  if (!topic) {
    return (
      <section className="flex flex-col gap-5 pb-10">
        <div>{back}</div>
        <p className="rounded-xl border border-[var(--dsw-alias-border-l3)] p-5 text-sm">{t('triggerTopicNotFound')}</p>
      </section>
    )
  }
  const { latest, events } = topic
  const href = sourceHref(latest.channel, latest.thread.url)
  const channel = latest.channel === 'feishu' ? t('triggerFeishu') : latest.channel === 'github' ? 'GitHub' : 'GitLab'
  const tickets = [...new Set(events.flatMap(event => [...event.tickets]))]
  return (
    <section className="@container flex min-w-0 flex-col gap-5 pb-10" aria-label={t('triggerTopicDetail')}>
      <div>{back}</div>
      <header>
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[var(--dsw-alias-label-tertiary)]">
          <span>{channel}</span>
          {href
            ? (
                <a href={href} target="_blank" rel="noopener noreferrer" title={t('triggerSampleLink')} className="text-[var(--dsw-alias-state-business-primary)] underline-offset-4 hover:underline focus-visible:underline">
                  {latest.thread.ref}
                  {' '}
                  ↗
                </a>
              )
            : <span>{latest.thread.ref}</span>}
          <Tag tone="neutral">{t(THREAD_KINDS[latest.thread.kind])}</Tag>
          <Tag tone="outline">{t(TRIAGE[latest.thread.triage])}</Tag>
          <Tag tone="quiet">{t('overviewDemo')}</Tag>
        </div>
        <h2 className="m-0 text-lg leading-7 font-medium [overflow-wrap:anywhere]">{t(latest.thread.title)}</h2>
      </header>
      <div className="grid min-w-0 gap-5 @min-[780px]:grid-cols-[minmax(0,1fr)_250px]">
        <div className="min-w-0">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="m-0 text-sm font-medium">{t('triggerTimeline')}</h3>
            <span className="text-xs text-[var(--dsw-alias-label-tertiary)]">
              {t('triggerEventCount', { count: events.length })}
              {' '}
              ·
              {' '}
              {t('triggerNewestFirst')}
            </span>
          </div>
          <ol className="m-0 list-none p-0 pl-1.5">{events.map(event => <Event key={event.id} record={event} />)}</ol>
        </div>
        <aside className="flex min-w-0 flex-col gap-4 self-start @min-[780px]:sticky @min-[780px]:top-4">
          <section className="rounded-xl border border-[var(--dsw-alias-border-l3)] bg-[var(--dsw-alias-bg-layer-1)] p-4">
            <h3 className="m-0 text-sm font-medium">{t('triggerThread')}</h3>
            <dl className="m-0 mt-3 flex flex-col gap-3 text-xs">
              <div>
                <dt className="text-[var(--dsw-alias-label-tertiary)]">{t('ticketProject')}</dt>
                <dd className="m-0 mt-1 break-all leading-5">{latest.thread.project ?? t('triggerNoProject')}</dd>
              </div>
              <div>
                <dt className="text-[var(--dsw-alias-label-tertiary)]">{t('triggerThreadId')}</dt>
                <dd className="m-0 mt-1 break-all font-mono text-[11px] leading-5">{latest.thread.id}</dd>
              </div>
            </dl>
          </section>
          <section className="rounded-xl border border-[var(--dsw-alias-border-l3)] bg-[var(--dsw-alias-bg-layer-1)] p-4">
            <h3 className="m-0 text-sm font-medium">{t('triggerLinkedTasks')}</h3>
            <div className="mt-3 flex flex-wrap gap-2">{tickets.length ? tickets.map(ticket => <Button key={ticket} size="sm" variant="outline" onClick={() => openTicket(ticket)}>{ticket}</Button>) : <span className="text-xs text-[var(--dsw-alias-label-tertiary)]">{t('triggerNoTask')}</span>}</div>
          </section>
          <p className="m-0 text-[11px] leading-5 text-[var(--dsw-alias-label-tertiary)]">{t('triggerExternalText')}</p>
          {href && <p className="m-0 text-[11px] leading-5 text-[var(--dsw-alias-label-tertiary)]">{t('triggerSampleLink')}</p>}
        </aside>
      </div>
    </section>
  )
}
