import type { H3Event } from 'h3'
import type { Communication, MergeVerifier } from '../service/communication.types'
import type { ledger } from '../service/ledger'
import type { runtime } from '../service/runtime'
import type { webPanel } from '../service/web-panel'
import type { Actor, MergeTarget, ProjectInput, Row } from './ledger'

export interface MailboxModel {
  sessionId: string
  bindingId: string | null
  role: string | null
  scope: string | null
  active: boolean
  pendingCount: number
  messages: Row<'inbox'>[]
}
export interface SourceContext {
  sessionId: string
  available: boolean
  reason: string | null
  entries: { origin: string, at: string, text: string }[]
}
export interface WebPorts {
  startup: () => { state: 'starting' | 'ready' | 'failed', reason: string | null }
  runtime: Pick<ReturnType<typeof runtime.create>, 'dispatch' | 'pause' | 'cancel' | 'retry' | 'projectChanged' | 'mailbox' | 'handleMail'>
  communication: Pick<Communication, 'answer'>
  discoverProjects: () => Promise<ProjectInput[]>
  verifyMerge: MergeVerifier
  sourceContext: (sessionId: string) => Promise<SourceContext>
  githubStatus: (projectId: string) => { name: string, value: unknown, updatedAt: string }[]
  reconcileExternal: (ticketId: string, signal?: AbortSignal) => Promise<'verified' | 'unknown'>
}
export interface WebServerOptions {
  panel: ReturnType<typeof webPanel.create>
  owner: (event: H3Event) => Extract<Actor, { kind: 'web' }> | null
}
export interface InboxAsk extends Omit<Row<'ask'>, 'options' | 'presentation' | 'target' | 'selections'> {
  options: string[]
  presentation: { title?: string, detail?: string, multiSelect?: boolean }
  target: MergeTarget | null
  selections: string[] | null
  ticketIds: string[]
  waiting: Row<'role_binding'> | null
  waitingMilliseconds: number
  humanRequired: boolean
  actionable: boolean
  reminders: (Row<'attention'> & { due: boolean })[]
  deliveries: (Row<'message'> & { state: string })[]
  publications: (Row<'outbox'> & { syncProblem: string | null, syncAt: string | null })[]
  evidence: Row<'acceptance'>[]
}
export interface InboxModel {
  pending: InboxAsk[]
  resolved: InboxAsk[]
  blocked: { ticket: Row<'ticket'>, reason: string | null, waitingFor: string, since: string | null }[]
  reminders: Row<'attention'>[]
}
export interface OverviewModel {
  projects: Row<'project'>[]
  tickets: ReturnType<typeof ledger.resolveTicket>[]
  graph: {
    nodes: { id: string, kind: string, label: string, status: string, projectId: string | null, ticketId: string | null, sessionId: string | null }[]
    edges: { source: string, target: string, kind: 'flow' | 'association' | 'dependency' }[]
  }
}
export interface TopicsModel {
  threads: Row<'thread'>[]
  triggers: Row<'trigger'>[]
  subscriptions: Row<'ticket_thread'>[]
}
export interface ChannelModel {
  projectId: string
  name: string
  repository: string | null
  available: boolean
  reason: string | null
  facts: ReturnType<WebPorts['githubStatus']>
}
export interface WebSettings extends Omit<Row<'setting'>, 'whitelist'> {
  whitelist: string[]
}
export interface PanelModel extends OverviewModel {
  run: { state: 'initializing' | 'initialization_failed' | 'idle' | 'running' | 'unavailable' | 'delivery_failed', reason: string | null }
  inbox: InboxModel
  topics: TopicsModel
  channels: ChannelModel[]
  settings: WebSettings
}
export interface TicketDetailModel extends ReturnType<typeof ledger.resolveTicket> {
  project: Row<'project'> | null
  executions: Row<'role_binding'>[]
  history: Row<'ticket_transition'>[]
  dependencies: Row<'ticket_link'>[]
  evidence: Row<'acceptance'>[]
  messages: Row<'message'>[]
  topics: Row<'thread'>[]
  asks: InboxAsk[]
}
