import type { ReactNode } from 'react'

export function Section({ title, meta, children }: { title: string, meta?: ReactNode, children: ReactNode }): ReactNode {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-2xl border border-[var(--dsw-alias-border-l3)] bg-[var(--dsw-alias-bg-layer-1)] px-4 py-4">
      <h3 className="m-0 flex flex-wrap items-center gap-2 text-sm leading-5 font-medium">
        <span className="h-3 w-0.5 shrink-0 rounded-full bg-[var(--dsw-alias-state-business-primary)] mt-px" aria-hidden="true" />
        {title}
        {meta}
      </h3>
      {children}
    </section>
  )
}
