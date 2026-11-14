import type { ReactNode } from 'react'
import type { TicketPullRequest } from '../../../../types'
import { PullRequestClosedIcon, PullRequestDraftIcon, PullRequestIcon, PullRequestMergedIcon } from '../../../../components/icons'
import { useTranslation } from '../../../../hooks/use-translation'

export function PrStatus({ pullRequest }: { pullRequest: TicketPullRequest }): ReactNode {
  const { t } = useTranslation()
  const blocked = pullRequest.state === 'open' && (pullRequest.checks === 'failure' || pullRequest.reviewDecision === 'changes-requested' || pullRequest.mergeability === 'conflicting')
  const tone = pullRequest.state === 'draft' ? 'draft' : blocked ? 'blocked' : pullRequest.state
  const appearance = {
    open: { Icon: PullRequestIcon, color: 'var(--dsw-alias-state-success-primary)', label: 'ticketPrOpen' },
    draft: { Icon: PullRequestDraftIcon, color: 'var(--dsw-alias-label-tertiary)', label: 'ticketPrDraft' },
    blocked: { Icon: PullRequestIcon, color: 'var(--dsw-alias-state-warn-primary)', label: 'ticketPrBlocked' },
    merged: { Icon: PullRequestMergedIcon, color: 'var(--dsw-alias-state-done-primary)', label: 'ticketPrMerged' },
    closed: { Icon: PullRequestClosedIcon, color: 'var(--dsw-alias-state-error-primary)', label: 'ticketPrClosed' },
  } as const
  const { Icon, color, label } = appearance[tone]
  const description = `PR #${pullRequest.number} · ${t(label)}`
  return (
    <button type="button" aria-label={description} title={description} className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--dsw-alias-border-l3)] bg-[var(--dsw-alias-card-fill)] px-2.5 text-xs leading-4 font-medium text-[var(--dsw-alias-label-primary)] outline-none transition-colors hover:bg-[var(--dsw-alias-interactive-bg-hover)] active:bg-[var(--dsw-alias-interactive-bg-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dsw-alias-state-business-primary)]">
      <Icon width={12} height={12} style={{ color }} />
      <span className="tabular-nums">{`PR #${pullRequest.number}`}</span>
      <span className="text-[11px] font-normal text-[var(--dsw-alias-label-secondary)]">{t(label)}</span>
    </button>
  )
}
