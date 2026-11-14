import type { ReactNode } from 'react'
import type { TicketDetailPreview } from '../../../../types'
import { StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import { useTranslation } from '../../../../hooks/use-translation'

export function Arrivals({ arrivals }: { arrivals: NonNullable<TicketDetailPreview['arrivals']> }): ReactNode {
  const { t } = useTranslation()
  const row = (arrival: (typeof arrivals)[number]): ReactNode => (
    <li key={`${arrival.message}-${arrival.hoursAgo}`} className="flex min-w-0 items-start gap-2 text-[13px] leading-5">
      <StateDot state="idle" size={6} className="mt-[7px] shrink-0" />
      <span className="min-w-0 flex-1 text-[var(--dsw-alias-label-secondary)] [overflow-wrap:anywhere]">{t(arrival.message)}</span>
      <span className="shrink-0 whitespace-nowrap text-xs text-[var(--dsw-alias-label-tertiary)] tabular-nums">{t('ticketArrivedAgo', { count: arrival.hoursAgo })}</span>
    </li>
  )
  if (!arrivals.length)
    return <p className="m-0 text-[13px] leading-5 text-[var(--dsw-alias-label-secondary)]">{t('ticketArrivalsEmpty')}</p>
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <ul className="m-0 flex list-none flex-col gap-2 p-0">{arrivals.slice(0, 2).map(row)}</ul>
      {arrivals.length > 2 && (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-3 rounded-md py-1 text-xs text-[var(--dsw-alias-label-secondary)] hover:text-[var(--dsw-alias-label-primary)] focus-visible:outline-2 focus-visible:outline-[var(--dsw-alias-state-business-primary)] [&::-webkit-details-marker]:hidden">
            <span aria-hidden="true" className="h-px flex-1 bg-[var(--dsw-alias-border-l3)]" />
            <span className="group-open:hidden">{t('ticketExpandArrivals')}</span>
            <span className="hidden group-open:inline">{t('ticketCollapseArrivals')}</span>
            <span aria-hidden="true" className="h-px flex-1 bg-[var(--dsw-alias-border-l3)]" />
          </summary>
          <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">{arrivals.slice(2).map(row)}</ul>
        </details>
      )}
    </div>
  )
}
