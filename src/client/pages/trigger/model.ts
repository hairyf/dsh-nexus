import type { InboxStatus, InboxTarget, ThreadKind, ThreadTriage, TriggerKind } from '../../../database/types'
import type { DshNexusKey } from '../../locale'
import type { OverviewChannelKind, OverviewTask } from '../../types'

export interface EventRecord {
  id: string
  channel: OverviewChannelKind
  kind: TriggerKind
  actor: string
  human: boolean
  mentioned: boolean
  text: DshNexusKey
  at: string
  ref?: string
  url?: string
  thread: { id: string, kind: ThreadKind, ref: string, title: DshNexusKey, triage: ThreadTriage, project?: string, url?: string }
  tickets: readonly OverviewTask['id'][]
  deliveries: readonly { target: InboxTarget, project?: string, status: InboxStatus, read: boolean, attempts?: number, error?: DshNexusKey }[]
  skipped?: 'not-mentioned' | 'ignored'
}

export type DeliveryStatus = InboxStatus | 'not-delivered'
export interface Filters {
  query: string
  channel: 'all' | OverviewChannelKind
  status: 'all' | DeliveryStatus
  kind: 'all' | TriggerKind
  mentionedOnly: boolean
}

export const KINDS = {
  comment: 'triggerKindComment',
  open: 'triggerKindOpen',
  close: 'triggerKindClose',
  ci: 'triggerKindCi',
  push: 'triggerKindPush',
} as const satisfies Record<TriggerKind, DshNexusKey>

export const STATUSES = {
  'pending': { label: 'triggerPending', tone: 'info' },
  'done': { label: 'triggerDone', tone: 'success' },
  'stalled': { label: 'triggerStalled', tone: 'danger' },
  'not-delivered': { label: 'triggerNotDelivered', tone: 'quiet' },
} as const

export function sourceHref(channel: OverviewChannelKind, url?: string): string | undefined {
  if (channel === 'feishu' || !url || !URL.canParse(url))
    return undefined
  const parsed = new URL(url)
  return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password ? parsed.href : undefined
}

export function deliveryStatus(record: EventRecord): DeliveryStatus {
  if (record.deliveries.some(delivery => delivery.status === 'stalled'))
    return 'stalled'
  if (record.deliveries.some(delivery => delivery.status === 'pending'))
    return 'pending'
  return record.deliveries.length ? 'done' : 'not-delivered'
}

export function filterRecords(records: readonly EventRecord[], filters: Filters, text: (key: DshNexusKey) => string): EventRecord[] {
  const query = filters.query.trim().toLocaleLowerCase()
  return records.filter(record =>
    (filters.channel === 'all' || record.channel === filters.channel)
    && (filters.status === 'all' || (filters.status === 'not-delivered' ? !record.deliveries.length : record.deliveries.some(delivery => delivery.status === filters.status)))
    && (filters.kind === 'all' || record.kind === filters.kind)
    && (!filters.mentionedOnly || record.mentioned)
    && (!query || [record.id, record.actor, record.channel, record.thread.ref, record.thread.project, record.ref, text(record.thread.title), text(record.text), ...record.tickets].join(' ').toLocaleLowerCase().includes(query)),
  ).sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || b.id.localeCompare(a.id))
}

export interface Topic {
  latest: EventRecord
  events: readonly EventRecord[]
}

export function groupTopics(records: readonly EventRecord[]): Topic[] {
  const grouped = new Map<string, EventRecord[]>()
  for (const record of records) {
    const events = grouped.get(record.thread.id) ?? []
    events.push(record)
    grouped.set(record.thread.id, events)
  }
  return [...grouped.values()].map((events) => {
    events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || b.id.localeCompare(a.id))
    return { latest: events[0], events }
  }).sort((a, b) => Date.parse(b.latest.at) - Date.parse(a.latest.at) || b.latest.id.localeCompare(a.latest.id))
}

export function filterTopics(topics: readonly Topic[], filters: Filters, text: (key: DshNexusKey) => string): Topic[] {
  return topics.filter(topic => filterRecords(topic.events, filters, text).length > 0)
}

export const TRIAGE = { pending: 'triggerTriagePending', claimed: 'triggerTriageClaimed', ignored: 'triggerTriageIgnored' } as const
export const THREAD_KINDS = { issue: 'triggerTopicIssue', pull: 'triggerTopicPull', chat: 'triggerTopicChat', ci: 'triggerTopicCi' } as const

export const RECORDS: readonly EventRecord[] = [
  {
    id: 'github:hairyf/dsh-third-kernel:issue-162:comment-421',
    channel: 'github',
    kind: 'comment',
    actor: 'hairyf',
    human: true,
    mentioned: true,
    url: 'https://github.com/hairyf/dsh-third-kernel/issues/162#issuecomment-421',
    text: 'triggerTextLogin',
    at: '2026-11-14T21:56:00+08:00',
    thread: { id: 'github:issue-162', kind: 'issue', ref: '#162', title: 'overviewTaskLogin', triage: 'claimed', project: 'hairyf/dsh-third-kernel', url: 'https://github.com/hairyf/dsh-third-kernel/issues/162' },
    tickets: ['T-105'],
    deliveries: [{ target: 'project', project: 'hairyf/dsh-third-kernel', status: 'pending', read: true }],
  },
  {
    id: 'feishu:topic-api:message-82',
    channel: 'feishu',
    kind: 'comment',
    actor: '林晓',
    human: true,
    mentioned: true,
    text: 'triggerTextApi',
    at: '2026-11-14T21:48:00+08:00',
    thread: { id: 'feishu:topic-api', kind: 'chat', ref: 'API', title: 'overviewTaskApi', triage: 'pending' },
    tickets: [],
    deliveries: [{ target: 'main', status: 'pending', read: false }],
  },
  {
    id: 'github:hairyf/dsh-third-kernel:pull-81:review-23',
    channel: 'github',
    kind: 'comment',
    actor: 'hairyf',
    human: true,
    mentioned: true,
    url: 'https://github.com/hairyf/dsh-third-kernel/pull/81#pullrequestreview-23',
    text: 'triggerTextReview',
    at: '2026-11-14T21:35:00+08:00',
    thread: { id: 'github:pull-81', kind: 'pull', ref: 'PR #81', title: 'overviewTaskRemote', triage: 'claimed', project: 'hairyf/dsh-third-kernel', url: 'https://github.com/hairyf/dsh-third-kernel/pull/81' },
    tickets: ['T-104'],
    deliveries: [{ target: 'project', project: 'hairyf/dsh-third-kernel', status: 'done', read: true }],
  },
  {
    id: 'gitlab:team/console:issue-38:comment-15',
    channel: 'gitlab',
    kind: 'comment',
    actor: 'chen',
    human: true,
    mentioned: true,
    url: 'https://gitlab.com/team/console/-/issues/38#note_15',
    text: 'triggerTextDelivery',
    at: '2026-11-14T21:22:00+08:00',
    thread: { id: 'gitlab:issue-38', kind: 'issue', ref: '#38', title: 'triggerThreadConsole', triage: 'pending', url: 'https://gitlab.com/team/console/-/issues/38' },
    tickets: [],
    deliveries: [{ target: 'main', status: 'stalled', read: false, attempts: 3, error: 'triggerErrorSession' }],
  },
  {
    id: 'github:hairyf/dsh-third-kernel:ci-main:revision-12',
    channel: 'github',
    kind: 'ci',
    actor: 'GitHub Actions',
    human: false,
    mentioned: false,
    text: 'triggerTextCi',
    at: '2026-11-14T21:10:00+08:00',
    ref: '7e4b2c1',
    thread: { id: 'github:ci:main', kind: 'ci', ref: 'main', title: 'triggerThreadCi', triage: 'claimed', project: 'hairyf/dsh-third-kernel' },
    tickets: [],
    deliveries: [{ target: 'project', project: 'hairyf/dsh-third-kernel', status: 'done', read: true }],
  },
  {
    id: 'github:hairyf/dsh-third-kernel:issue-162:comment-419',
    channel: 'github',
    kind: 'comment',
    actor: 'contributor',
    human: true,
    mentioned: false,
    url: 'https://github.com/hairyf/dsh-third-kernel/issues/162#issuecomment-419',
    text: 'triggerTextUnmentioned',
    at: '2026-11-14T20:52:00+08:00',
    thread: { id: 'github:issue-162', kind: 'issue', ref: '#162', title: 'overviewTaskLogin', triage: 'claimed', project: 'hairyf/dsh-third-kernel', url: 'https://github.com/hairyf/dsh-third-kernel/issues/162' },
    tickets: ['T-105'],
    deliveries: [],
    skipped: 'not-mentioned',
  },
  {
    id: 'feishu:topic-chatter:message-17',
    channel: 'feishu',
    kind: 'comment',
    actor: '林晓',
    human: true,
    mentioned: false,
    text: 'triggerTextIgnored',
    at: '2026-11-14T20:35:00+08:00',
    thread: { id: 'feishu:topic-chatter', kind: 'chat', ref: '讨论', title: 'triggerThreadChatter', triage: 'ignored' },
    tickets: [],
    deliveries: [],
    skipped: 'ignored',
  },
  {
    id: 'github:hairyf/dsh-third-kernel:pull-81:open',
    channel: 'github',
    kind: 'open',
    actor: 'hairyf',
    human: true,
    mentioned: true,
    url: 'https://github.com/hairyf/dsh-third-kernel/pull/81',
    text: 'triggerTextOpen',
    at: '2026-11-14T20:18:00+08:00',
    ref: 'nexus/T-104',
    thread: { id: 'github:pull-81', kind: 'pull', ref: 'PR #81', title: 'overviewTaskRemote', triage: 'claimed', project: 'hairyf/dsh-third-kernel', url: 'https://github.com/hairyf/dsh-third-kernel/pull/81' },
    tickets: ['T-104'],
    deliveries: [{ target: 'project', project: 'hairyf/dsh-third-kernel', status: 'done', read: true }],
  },
]
