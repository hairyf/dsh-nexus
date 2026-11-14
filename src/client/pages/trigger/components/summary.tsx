import type { ReactNode } from 'react'
import type { DeliveryStatus } from '../model'
import { useActions, useStore } from '../../../hooks/use-store'
import { useTranslation } from '../../../hooks/use-translation'
import { filterTopics, groupTopics, RECORDS, STATUSES } from '../model'

export function Summary(): ReactNode {
  const { t } = useTranslation()
  const { setTriggerFilters } = useActions()
  const selected = useStore(state => state.trigger.filters.status)
  const topics = groupTopics(RECORDS)
  const cards: { value: 'all' | DeliveryStatus, label: string, count: number, color: string }[] = [
    { value: 'all', label: t('triggerReceived'), count: topics.length, color: 'var(--dsw-alias-label-primary)' },
    ...(['pending', 'done', 'stalled'] as const).map(value => ({ value, label: t(STATUSES[value].label), count: filterTopics(topics, { query: '', channel: 'all', kind: 'all', mentionedOnly: false, status: value }, t).length, color: `var(--dsw-alias-state-${value === 'stalled' ? 'error' : value === 'done' ? 'success' : 'business'}-primary)` })),
  ]
  return (
    <div className="grid grid-cols-2 gap-3 @min-[740px]:grid-cols-4" role="group" aria-label={t('triggerSummary')}>
      {cards.map(card => (
        <button key={card.value} type="button" aria-pressed={selected === card.value} onClick={() => setTriggerFilters({ status: card.value })} className={`flex min-w-0 cursor-pointer flex-col gap-2 rounded-2xl border bg-[var(--dsw-alias-bg-layer-1)] px-4 py-3.5 text-left outline-none transition-colors hover:bg-[var(--dsw-alias-card-fill)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dsw-alias-state-business-primary)] ${selected === card.value ? 'border-[var(--dsw-alias-state-business-primary)]' : 'border-[var(--dsw-alias-border-l3)]'}`}>
          <span className="flex items-center gap-2 text-xs leading-5 text-[var(--dsw-alias-label-secondary)]">
            <span className="size-1.5 rounded-full" style={{ background: card.color }} />
            {card.label}
          </span>
          <span className="text-[26px] leading-8 font-semibold tracking-tight tabular-nums">
            {card.count}
            <span className="ml-2 text-xs font-normal text-[var(--dsw-alias-label-tertiary)]">{t('triggerTopicsUnit')}</span>
          </span>
        </button>
      ))}
    </div>
  )
}
