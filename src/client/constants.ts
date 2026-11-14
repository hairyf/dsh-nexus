import type { AgentGraphEdge, AgentGraphNode, OverviewActivityPoint, OverviewChannel, OverviewTask, OverviewTaskSegment, OverviewTaskStatus, TicketDetailPreview } from './types'

export const OVERVIEW_CHANNELS: readonly OverviewChannel[] = [
  { kind: 'github', name: 'GitHub', connected: false },
  { kind: 'gitlab', name: 'GitLab', connected: false },
  { kind: 'feishu', name: '飞书', connected: false },
]

export const OVERVIEW_ACTIVITY: OverviewActivityPoint[] = [
  { time: '00:00', messages: 5 },
  { time: '03:00', messages: 14 },
  { time: '06:00', messages: 11 },
  { time: '09:00', messages: 15 },
  { time: '12:00', messages: 6 },
  { time: '15:00', messages: 8 },
  { time: '18:00', messages: 10 },
  { time: '21:00', messages: 20 },
  { time: '24:00', messages: 12 },
]

export const OVERVIEW_METRICS = { received: 101, filtered: 27, rate: 12, added: 4 } as const

export const OVERVIEW_TASK_SEGMENTS: OverviewTaskSegment[] = [
  { name: 'overviewInProgress', value: 2, color: 'var(--dsw-alias-state-business-primary)' },
  { name: 'overviewCompleted', value: 1, color: 'var(--dsw-alias-state-success-primary)' },
  { name: 'overviewBlocked', value: 1, color: 'var(--dsw-alias-state-error-primary)' },
]

export const OVERVIEW_TASKS: readonly OverviewTask[] = [
  { id: 'T-104', title: 'overviewTaskRemote', status: 'review', channel: 'github', event: 'PR #81 open', duration: '12m 45s', action: 'pr' },
  { id: 'T-105', title: 'overviewTaskLogin', status: 'running', channel: 'github', duration: '42s', action: 'session' },
  { id: 'T-106', title: 'overviewTaskApi', status: 'waiting', channel: 'feishu', duration: '42s' },
  { id: 'T-107', title: 'overviewTaskApi', status: 'intervention', channel: 'feishu', duration: '1m 18s', action: 'session' },
]

export const TICKET_DETAIL_PREVIEWS: Partial<Record<OverviewTask['id'], TicketDetailPreview>> = {
  'T-104': {
    repository: 'hairyf/dsh-third-kernel',
    branch: 'nexus/T-104',
    pullRequest: { number: 81, state: 'draft' },
    execution: 'linked',
    arrivals: [{ message: 'ticketArrivalPullRequest', hoursAgo: 1 }],
  },
  'T-105': {
    repository: 'hairyf/dsh-third-kernel',
    branch: 'nexus/T-105',
    pullRequest: { number: 121, state: 'open' },
    execution: 'linked',
    issues: [
      { title: 'ticketIssueToken', state: 'open', labels: ['app', 'bug'] },
      { title: 'ticketIssueArchived', state: 'closed', labels: ['bug', 'linux'] },
    ],
    arrivals: [
      { message: 'ticketArrivalResearch', hoursAgo: 3 },
      { message: 'ticketArrivalLinkedIssue', hoursAgo: 3 },
      { message: 'ticketArrivalProject', hoursAgo: 4 },
      { message: 'ticketArrivalCreated', hoursAgo: 4 },
    ],
  },
  'T-106': { execution: 'not-created' },
  'T-107': { branch: 'nexus/T-107', execution: 'linked' },
}

export const OVERVIEW_STATUS = {
  review: { label: 'overviewStatusReview', tone: 'warning' },
  running: { label: 'overviewStatusRunning', tone: 'info' },
  waiting: { label: 'overviewStatusWaiting', tone: 'quiet' },
  intervention: { label: 'overviewStatusIntervention', tone: 'danger' },
} as const satisfies Record<OverviewTaskStatus, { label: string, tone: string }>

export const OVERVIEW_CHANNEL_LABELS = { github: 'GitHub', feishu: '飞书', gitlab: 'GitLab' } as const
export const AGENT_GRAPH = { nodeWidth: 168, nodeHeight: 68, width: 1100, height: 400, zoomMin: 0.5, zoomMax: 2 } as const

export const AGENT_GRAPH_NODES: readonly AgentGraphNode[] = [
  { id: 'channel', kind: 'channel', label: 'graphChannel', subtitle: 'GitHub · 飞书', x: 36, y: 58 },
  { id: 'orchestrator', kind: 'orchestrator', label: 'graphOrchestrator', x: 36, y: 244 },
  { id: 'route-3', kind: 'route', label: 'graphRoute', subtitle: 'owner/project-3', x: 300, y: 36 },
  { id: 'route-1', kind: 'route', label: 'graphRoute', subtitle: 'owner/project-1', group: 'supervisor', x: 300, y: 160 },
  { id: 'route-2', kind: 'route', label: 'graphRoute', subtitle: 'owner/project-2', group: 'supervisor', x: 300, y: 286 },
  { id: 'task-104', kind: 'task', label: 'graphTask', subtitle: 'T-104', taskId: 'T-104', x: 620, y: 36 },
  { id: 'task-106', kind: 'task', label: 'graphTask', subtitle: 'T-106', taskId: 'T-106', x: 620, y: 160 },
  { id: 'task-105', kind: 'task', label: 'graphTask', subtitle: 'T-105', taskId: 'T-105', x: 620, y: 286 },
  { id: 'session-104', kind: 'session', label: 'graphSession', x: 896, y: 36 },
  { id: 'session-106', kind: 'session', label: 'graphSession', waiting: true, x: 896, y: 160 },
  { id: 'session-105', kind: 'session', label: 'graphSession', x: 896, y: 286 },
]

export const AGENT_GRAPH_EDGES: readonly AgentGraphEdge[] = [
  { source: 'channel', target: 'orchestrator', kind: 'flow' },
  { source: 'orchestrator', target: 'route-3', kind: 'flow' },
  { source: 'orchestrator', target: 'route-1', kind: 'flow' },
  { source: 'orchestrator', target: 'route-2', kind: 'flow' },
  { source: 'route-1', target: 'task-104', kind: 'flow' },
  { source: 'route-1', target: 'task-106', kind: 'flow' },
  { source: 'route-2', target: 'task-105', kind: 'flow' },
  { source: 'task-104', target: 'session-104', kind: 'flow' },
  { source: 'task-106', target: 'session-106', kind: 'flow' },
  { source: 'task-105', target: 'session-105', kind: 'flow' },
  { source: 'task-104', target: 'task-106', kind: 'association' },
  { source: 'task-106', target: 'task-105', kind: 'dependency' },
]

export const AGENT_GRAPH_EDGE_COLORS = {
  flow: 'var(--dsw-alias-label-tertiary)',
  dispatch: 'var(--dsw-alias-state-warn-primary)',
  association: 'var(--dsw-alias-state-business-primary)',
  dependency: '#a56bce',
} as const
