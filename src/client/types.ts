import type { DshNexusKey } from './locale'

export type OverviewView = 'recent' | 'hierarchy'
export type OverviewTaskStatus = 'review' | 'running' | 'waiting' | 'intervention'
export type OverviewChannelKind = 'github' | 'feishu' | 'gitlab'

export interface OverviewTask {
  id: `T-${number}`
  title: DshNexusKey
  status: OverviewTaskStatus
  channel: OverviewChannelKind
  event?: string
  duration: string
  action?: 'pr' | 'session'
}

export interface TicketPullRequest {
  number: number
  state: 'open' | 'draft' | 'merged' | 'closed'
  checks?: 'success' | 'failure' | 'pending'
  reviewDecision?: 'approved' | 'changes-requested' | 'review-required'
  mergeability?: 'mergeable' | 'conflicting' | 'unknown'
}

export interface TicketDetailPreview {
  repository?: string
  branch?: string
  pullRequest?: TicketPullRequest
  execution?: 'linked' | 'not-created'
  issues?: readonly { title: DshNexusKey, state: 'open' | 'closed', labels: readonly ('app' | 'bug' | 'linux')[] }[]
  arrivals?: readonly { message: DshNexusKey, hoursAgo: number }[]
}

export interface OverviewChannel {
  kind: OverviewChannelKind
  name: string
  connected: boolean
}

export interface OverviewActivityPoint {
  time: string
  messages: number
}

export interface OverviewTaskSegment {
  name: DshNexusKey
  value: number
  color: string
}

export interface AgentGraphNode {
  id: string
  kind: 'channel' | 'orchestrator' | 'route' | 'task' | 'session'
  label: DshNexusKey
  subtitle?: string
  x: number
  y: number
  waiting?: boolean
  group?: 'supervisor'
  taskId?: OverviewTask['id']
}

export interface AgentGraphEdge {
  source: string
  target: string
  kind: 'flow' | 'association' | 'dependency'
}
