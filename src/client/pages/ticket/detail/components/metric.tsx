import type { ReactNode } from 'react'

export function Metric({ label, icon, children }: { label: string, icon: ReactNode, children: ReactNode }): ReactNode {
  return (
    <div className="relative flex min-h-15 min-w-0 flex-col justify-center gap-1.5 rounded-xl border border-[var(--dsw-alias-border-l3)] bg-[var(--dsw-alias-bg-layer-1)] py-3 pr-3 pl-14">
      <dt className="text-xs leading-4 text-[var(--dsw-alias-label-secondary)]">
        <span className="absolute top-1/2 left-3 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg bg-[var(--dsw-alias-card-fill)] text-[var(--dsw-alias-label-secondary)]" aria-hidden="true">{icon}</span>
        {label}
      </dt>
      <dd className="m-0 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-5 font-medium">{children}</dd>
    </div>
  )
}
