import type { ReactNode } from 'react'
import type { TicketDetailPreview } from '../../../../types'
import { Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { IssueClosedIcon, IssueOpenIcon } from '../../../../components/icons'
import { useTranslation } from '../../../../hooks/use-translation'
import { Section } from './section'

export function Issues({ issues }: { issues: NonNullable<TicketDetailPreview['issues']> }): ReactNode {
  const { t } = useTranslation()
  return (
    <Section title={t('ticketIssues')} meta={issues.length > 0 && <span className="text-xs font-normal text-[var(--dsw-alias-label-tertiary)]">{t('ticketIssueCount', { total: issues.length, open: issues.filter(issue => issue.state === 'open').length })}</span>}>
      {issues.length
        ? (
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {issues.map((issue) => {
                const Icon = issue.state === 'open' ? IssueOpenIcon : IssueClosedIcon
                return (
                  <li key={issue.title}>
                    <button type="button" className="group/issue flex w-full cursor-pointer items-start gap-2 rounded-md border-0 bg-transparent p-0 text-left text-[13px] leading-5 font-[inherit] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dsw-alias-state-business-primary)]">
                      <span title={t(issue.state === 'open' ? 'ticketIssueOpen' : 'ticketIssueClosed')} className="mt-0.5 shrink-0" style={{ color: `var(--dsw-alias-state-${issue.state === 'open' ? 'success' : 'done'}-primary)` }}>
                        <Icon width={14} height={14} />
                        <span className="sr-only">{t(issue.state === 'open' ? 'ticketIssueOpen' : 'ticketIssueClosed')}</span>
                      </span>
                      <span className="min-w-0 text-[var(--dsw-alias-label-secondary)] [overflow-wrap:anywhere]">
                        <span className="underline-offset-4 group-hover/issue:underline group-focus-visible/issue:underline">{t(issue.title)}</span>
                        <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">{issue.labels.map(label => <Tag key={label} tone={label === 'bug' ? 'danger' : label === 'linux' ? 'success' : 'info'} className="!px-1.5 !py-0 !text-[10px] !leading-4">{label}</Tag>)}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )
        : <p className="m-0 text-[13px] leading-5 text-[var(--dsw-alias-label-secondary)]">{t('ticketIssuesEmpty')}</p>}
    </Section>
  )
}
