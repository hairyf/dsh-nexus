import type { ReactNode } from 'react'
import type { EventRecord } from '../../model'
import { Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { useTranslation } from '../../../../hooks/use-translation'
import { KINDS, sourceHref, STATUSES } from '../../model'

export function Event({ record }: { record: EventRecord }): ReactNode {
  const { t } = useTranslation()
  const href = sourceHref(record.channel, record.url)
  const targets = { main: 'graphOrchestrator', project: 'triggerProjectAgent', supervisor: 'graphSupervisor', user: 'triggerUser' } as const
  return (
    <li className="relative min-w-0 border-l border-[var(--dsw-alias-border-l3)] pb-6 pl-5 last:pb-0">
      <span className="absolute top-1.5 -left-[3.5px] size-1.5 rounded-full bg-[var(--dsw-alias-state-business-primary)]" aria-hidden="true" />
      <article className="min-w-0 rounded-xl border border-[var(--dsw-alias-border-l3)] bg-[var(--dsw-alias-bg-layer-1)] p-4">
        <header className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{record.actor}</span>
            <Tag tone="neutral">{t(KINDS[record.kind])}</Tag>
            {record.mentioned && <Tag tone="info">{t('triggerMentioned')}</Tag>}
            {!record.human && <span className="text-[var(--dsw-alias-label-tertiary)]">{t('triggerAutomated')}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {href && (
              <a href={href} target="_blank" rel="noopener noreferrer" title={t('triggerSampleLink')} className="text-[11px] text-[var(--dsw-alias-state-business-primary)] underline-offset-4 hover:underline focus-visible:underline">
                {t(record.kind === 'comment' ? 'triggerOpenComment' : 'triggerOpenEvent')}
                {' '}
                ↗
              </a>
            )}
            <time dateTime={record.at} title={record.at} className="text-[11px] text-[var(--dsw-alias-label-tertiary)] tabular-nums">
              {record.at.slice(0, 10)}
              {' '}
              ·
              {' '}
              {record.at.slice(11, 16)}
            </time>
          </div>
        </header>
        <p className="my-3 whitespace-pre-wrap text-[13px] leading-6 text-[var(--dsw-alias-label-primary)] [overflow-wrap:anywhere]">{t(record.text)}</p>
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--dsw-alias-border-l3)] pt-3 text-xs text-[var(--dsw-alias-label-secondary)]">
          <span>{t('triggerDelivery')}</span>
        </div>
        {record.deliveries.length
          ? (
              <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
                {record.deliveries.map((delivery, index) => (
                  <li key={`${delivery.target}-${delivery.project ?? index}`} className="text-xs leading-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{t(targets[delivery.target])}</span>
                      {delivery.project && <span className="break-all text-[var(--dsw-alias-label-tertiary)]">{delivery.project}</span>}
                      <Tag tone={STATUSES[delivery.status].tone}>{t(STATUSES[delivery.status].label)}</Tag>
                    </div>
                    {delivery.status === 'pending' && <span className="block text-[11px] text-[var(--dsw-alias-label-secondary)]">{t(delivery.read ? 'triggerReadPending' : 'triggerQueued')}</span>}
                    {delivery.error && (
                      <p className="m-0 mt-1 text-[11px] text-[var(--dsw-alias-state-error-primary)]">
                        {t(delivery.error)}
                        {' '}
                        ·
                        {' '}
                        {t('triggerAttempts', { count: delivery.attempts })}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )
          : <p className="mb-0 mt-2 text-xs leading-5 text-[var(--dsw-alias-label-secondary)]">{t(record.skipped === 'ignored' ? 'triggerSkipIgnored' : record.skipped === 'not-mentioned' ? 'triggerSkipMention' : 'triggerNoDelivery')}</p>}
        {record.ref && (
          <p className="mb-0 mt-3 break-all text-[11px] text-[var(--dsw-alias-label-secondary)]">
            {t('triggerRef')}
            :
            {' '}
            <code>{record.ref}</code>
          </p>
        )}
        {/* <p className="mb-0 mt-3 break-all font-mono text-[10px] leading-4 text-[var(--dsw-alias-label-tertiary)]">
          <span className="font-sans">
            {t('triggerEventId')}
            :
            {' '}
          </span>
          {record.id}
        </p> */}
      </article>
    </li>
  )
}
