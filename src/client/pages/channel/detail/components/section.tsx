import type { ReactNode } from 'react'

export function Section({ title, description, children }: { title: string, description?: string, children: ReactNode }): ReactNode {
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-[var(--dsw-alias-border-l3)] bg-[var(--dsw-alias-bg-layer-1)] p-5">
      <header className="flex flex-col gap-1.5">
        <h3 className="m-0 text-sm font-medium">{title}</h3>
        {description && <p className="m-0 text-xs leading-5 text-[var(--dsw-alias-label-secondary)]">{description}</p>}
      </header>
      {children}
    </section>
  )
}
