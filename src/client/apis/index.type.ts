export interface GetApiNexusOverviewResponse {
  stats: { channels: { id: string, name: string, enabled: false | true, accounts: number, threads: number }[], received24h: number, filtered24h: number, tickets: { waiting: number, queued: number, running: number, review: number, done: number, cancelled: number } }
  recent: { id: string, title: string, status: 'waiting' | 'queued' | 'running' | 'review' | 'done' | 'cancelled', project: string, channel: string, updatedAt: string, attention: false | true, error?: undefined | string }[]
  graph: { nodes: { id: string, kind: 'main' | 'project' | 'worker' | 'supervisor' | 'ticket' | 'channel', label: string, detail?: undefined | string, attention?: undefined | false | true }[], edges: { from: string, to: string, kind: 'trigger' | 'dispatch' | 'delegate' | 'supervise' | 'blocked', label?: undefined | string }[] }
}
export interface GetApiNexusTasksResponse { tickets: { id: string, title: string, status: 'waiting' | 'queued' | 'running' | 'review' | 'done' | 'cancelled', project: string, channel: string, updatedAt: string, attention: false | true, error?: undefined | string }[], counts: { [key: string]: number } }
export type GetApiNexusTasksQueryFilter = undefined | 'waiting' | 'running' | 'review' | 'done' | 'cancelled' | 'all'
export interface GetApiNexusTicketsidResponse {
  description?: undefined | string
  createdAt: string
  startedAt?: undefined | string
  endedAt?: undefined | string
  prUrl?: undefined | string
  prState?: undefined | string
  ciState?: undefined | string
  paused: false | true
  prepareError?: undefined | string
  threads: { key: string, title: string, kind: string, url?: undefined | string }[]
  links: { id: string, title: string, kind: string, status: 'waiting' | 'queued' | 'running' | 'review' | 'done' | 'cancelled' }[]
  workers: { id: string, status: string, title?: undefined | string, branch?: undefined | string, reportState?: undefined | 'progress' | 'ready' | 'failed' | 'dropped', report?: undefined | string, reportAt?: undefined | string, backgroundUntil?: undefined | string, recoveryNote?: undefined | string }[]
  inbox: { id: string, type: 'main' | 'project' | 'supervisor' | 'user', origin: string, kind: 'trigger' | 'ticket' | 'ask' | 'notice', status: 'done' | 'pending' | 'stalled', title?: undefined | string, message: string, createdAt: string, seq: string, deliveryAttempts: number, deliveryError?: undefined | string, nextRetryAt?: undefined | string, readAt?: undefined | string, deadline?: undefined | string, escalations: number, answer?: undefined | string, answeredBy?: undefined | string }[]
  id: string
  title: string
  status: 'waiting' | 'queued' | 'running' | 'review' | 'done' | 'cancelled'
  project: string
  channel: string
  updatedAt: string
  attention: false | true
  error?: undefined | string
}
export interface PostApiNexusTicketsidPauseResponse { ok: false | true, message?: undefined | string }
export interface GetApiNexusTriggersResponse { threads: { key: string, title: string, kind: string, channel: string, triage: 'pending' | 'claimed' | 'ignored', project?: undefined | string, url?: undefined | string, updatedAt: string, triggers: number }[], triggers: { id: string, kind: string, channel: string, channelName: string, threadKey: string, threadTitle: string, threadKind: string, actorName?: undefined | string, human: false | true, mentioned: false | true, text: string, url?: undefined | string, at: string, ref?: undefined | string }[] }
export type GetApiNexusTriggersQueryThread = undefined | string
export interface GetApiNexusChannelsResponse { channels: { id: string, name: string, enabled: false | true, host?: undefined | string, accounts: { id: string, role: string, name: string, avatar?: undefined | string, status: string }[], projects: number, threads: number, lastReadAt?: undefined | string, cursors: string[] }[] }
export interface PostApiNexusChannelsidEnabledResponse { ok: false | true, message?: undefined | string }
export interface GetApiNexusInboxResponse {
  items: { projectId?: undefined | string, project?: undefined | string, ticketId?: undefined | string, ticket?: undefined | string, thread?: undefined | string, worker?: undefined | string, id: string, type: 'main' | 'project' | 'supervisor' | 'user', origin: string, kind: 'trigger' | 'ticket' | 'ask' | 'notice', status: 'done' | 'pending' | 'stalled', title?: undefined | string, message: string, createdAt: string, seq: string, deliveryAttempts: number, deliveryError?: undefined | string, nextRetryAt?: undefined | string, readAt?: undefined | string, deadline?: undefined | string, escalations: number, answer?: undefined | string, answeredBy?: undefined | string }[]
  counts: { main: number, project: number, supervisor: number, user: number }
  stalled: number
}
export type GetApiNexusInboxQueryType = undefined | string
export interface PostApiNexusInboxKillResponse { ok: false | true, message?: undefined | string }
export interface GetApiNexusSettingsResponse { values: { maxWorkers: number | false | true, backgroundLimitMinutes: number | false | true, autoMerge: number | false | true, autoMergeMaxLines: number | false | true, proxyDecide: number | false | true, askDeadlineMinutes: number | false | true, deliveryMaxAttempts: number | false | true, deliveryRetryCeilingSeconds: number | false | true }, updatedAt: string }
export interface PostApiNexusSettingsResponse { ok: false | true, message?: undefined | string }
export interface GetApiNexusProjectsResponse { projects: { id: string, name: string, workspaceId: string, directory: string }[] }

export interface PostApiNexusTicketsidPauseBody {
  paused: false | true
}
export interface PostApiNexusChannelsidEnabledBody {
  enabled: false | true
}
export interface PostApiNexusInboxKillBody {
  ids: string[]
}
export interface PostApiNexusSettingsBody {
  maxWorkers?: undefined | number | false | true
  backgroundLimitMinutes?: undefined | number | false | true
  autoMerge?: undefined | number | false | true
  autoMergeMaxLines?: undefined | number | false | true
  proxyDecide?: undefined | number | false | true
  askDeadlineMinutes?: undefined | number | false | true
  deliveryMaxAttempts?: undefined | number | false | true
  deliveryRetryCeilingSeconds?: undefined | number | false | true
}
export interface GetApiNexusTasksQuery {
  filter?: GetApiNexusTasksQueryFilter
}
export interface GetApiNexusTicketsidPath {
  id: string
}
export interface PostApiNexusTicketsidPausePath {
  id: string
}
export interface GetApiNexusTriggersQuery {
  thread?: GetApiNexusTriggersQueryThread
}
export interface PostApiNexusChannelsidEnabledPath {
  id: string
}
export interface GetApiNexusInboxQuery {
  type?: GetApiNexusInboxQueryType
}
