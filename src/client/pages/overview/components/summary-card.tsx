import type { ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { useTranslation } from '../../../hooks/use-translation'

export function SummaryCard({ title, meta, icon, actionLabel, onMore, children, background }: { title: string, meta?: string, icon: ReactNode, actionLabel: string, onMore: () => void, children: ReactNode, background?: ReactNode }): ReactNode {
  const { t } = useTranslation()
  return (
    <section className="relative isolate flex h-[120x] min-w-0 flex-col overflow-hidden rounded-[20px] border border-[var(--dsw-alias-border-l3)] bg-[var(--dsw-alias-bg-layer-1)] p-2 px-5 shadow-[0_1px_2px_#00000004]">
      {background}
      <header className="relative z-10 flex items-center justify-between gap-2">
        <h2 className="flex min-w-0 items-center gap-2 text-[13px] leading-5 font-medium">
          {icon}
          <span>{title}</span>
          {meta && <span className="shrink-0 text-xs font-normal text-[var(--dsw-alias-label-tertiary)]">{meta}</span>}
        </h2>
        <Button size="sm" variant="ghost" aria-label={actionLabel} onClick={onMore} className="shrink-0 text-xs! text-[var(--dsw-alias-label-tertiary)]!">{t('overviewMore')}</Button>
      </header>
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  )
}
