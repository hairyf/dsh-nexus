import type { ReactElement } from 'react'
import type { TicketPullRequest } from '../src/client/types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PullRequestClosedIcon, PullRequestDraftIcon, PullRequestIcon, PullRequestMergedIcon } from '../src/client/components/icons'
import { PrStatus } from '../src/client/pages/ticket/detail/components/pr-status'

vi.mock('../src/client/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

afterEach(() => vi.restoreAllMocks())

type Badge = ReactElement<{ 'aria-label': string, 'children': [ReactElement<{ style: { color: string } }>, ReactElement<{ children: string }>, ReactElement<{ children: string }>] }>

describe('pull request status presentation', () => {
  it.each<TicketPullRequest>([
    { number: 121, state: 'open', checks: 'failure' },
    { number: 121, state: 'open', reviewDecision: 'changes-requested' },
    { number: 121, state: 'open', mergeability: 'conflicting' },
  ])('shows open PRs requiring intervention in amber: %j', (pullRequest) => {
    const badge = PrStatus({ pullRequest }) as Badge
    expect(badge.props['aria-label']).toBe('PR #121 · ticketPrBlocked')
    expect(badge.props.children[2].props.children).toBe('ticketPrBlocked')
    expect(badge.props.children[0].type).toBe(PullRequestIcon)
    expect(badge.props.children[0].props.style.color).toBe('var(--dsw-alias-state-warn-primary)')
  })

  it('keeps pending checks and unknown mergeability open rather than blocked', () => {
    const badge = PrStatus({ pullRequest: { number: 121, state: 'open', checks: 'pending', mergeability: 'unknown', reviewDecision: 'review-required' } }) as Badge
    expect(badge.props['aria-label']).toBe('PR #121 · ticketPrOpen')
    expect(badge.props.children[0].props.style.color).toBe('var(--dsw-alias-state-success-primary)')
    expect(badge.props.children[1].props.children).toBe('PR #121')
  })

  it.each([
    { state: 'draft', label: 'ticketPrDraft', color: 'var(--dsw-alias-label-tertiary)', icon: PullRequestDraftIcon },
    { state: 'merged', label: 'ticketPrMerged', color: 'var(--dsw-alias-state-done-primary)', icon: PullRequestMergedIcon },
    { state: 'closed', label: 'ticketPrClosed', color: 'var(--dsw-alias-state-error-primary)', icon: PullRequestClosedIcon },
  ] as const)('keeps $state lifecycle presentation despite stale check failures', ({ state, label, color, icon }) => {
    const badge = PrStatus({ pullRequest: { number: 81, state, checks: 'failure', mergeability: 'conflicting' } }) as Badge
    expect(badge.props['aria-label']).toBe(`PR #81 · ${label}`)
    expect(badge.props.children[0].type).toBe(icon)
    expect(badge.props.children[0].props.style.color).toBe(color)
  })
})
