import type { ReactNode } from 'react'

export function SourceLink({ href, children }: {
  href: string | null
  children: ReactNode
}): ReactNode {
  const url = href && URL.canParse(href) ? new URL(href) : null

  if (!url || !['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    return <span>{children}</span>

  return (
    <a href={url.href} target="_blank" rel="noopener noreferrer" className="break-all text-[var(--dsw-alias-state-business-primary)] underline-offset-4 hover:underline focus-visible:underline">
      {children}
      {' '}
      ↗
    </a>
  )
}
