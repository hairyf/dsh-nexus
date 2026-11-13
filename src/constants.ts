/** Nexus 的 Tab、角色、状态词汇。Host 与 Client 共用，不重复定义。 */

export const TABS = ['overview', 'tasks', 'triggers', 'channels', 'settings'] as const
export type Tab = (typeof TABS)[number]

/** 四个角色。既是 Inbox 的 type 取值来源，也是会话在库里互相指代的名字。 */
export const ROLES = ['main', 'project', 'worker', 'supervisor'] as const
export type Role = (typeof ROLES)[number]

/**
 * 收件箱此刻轮到谁。
 *
 * **没有 worker** —— Worker 没有收件箱：它短命、被动、等的时候是阻塞的，
 * 上级的话直接 prompt 进会话，不能进队列等它来取。
 */
export const INBOX_TARGETS = ['user', 'main', 'project', 'supervisor'] as const
export type InboxTarget = (typeof INBOX_TARGETS)[number]

export const TICKET_STATUSES = ['waiting', 'queued', 'running', 'review', 'done', 'cancelled'] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]

export const TICKET_FILTERS = ['all', 'running', 'review', 'waiting', 'done', 'cancelled'] as const
export type TicketFilter = (typeof TICKET_FILTERS)[number]

export const THREAD_TRIAGES = ['pending', 'claimed', 'ignored'] as const
export type ThreadTriage = (typeof THREAD_TRIAGES)[number]

export const REPORT_STATES = ['progress', 'ready', 'failed', 'dropped'] as const
export type ReportState = (typeof REPORT_STATES)[number]

export const INBOX_STATUSES = ['pending', 'done', 'stalled'] as const
export type InboxStatus = (typeof INBOX_STATUSES)[number]

export const INBOX_KINDS = ['trigger', 'ticket', 'ask', 'notice'] as const
export type InboxKind = (typeof INBOX_KINDS)[number]

/** 设置里所有可调的键，与 `Setting` 字段一一对应。 */
export const SETTING_KEYS = [
  'maxWorkers',
  'backgroundLimitMinutes',
  'autoMerge',
  'autoMergeMaxLines',
  'deliveryMaxAttempts',
  'deliveryRetryCeilingSeconds',
] as const
export type SettingKey = (typeof SETTING_KEYS)[number]

/** 层级关系图的节点类型。 */
export const GRAPH_NODE_KINDS = ['channel', 'main', 'project', 'ticket', 'worker', 'supervisor'] as const
export type GraphNodeKind = (typeof GRAPH_NODE_KINDS)[number]

/** 层级关系图的边类型。 */
export const GRAPH_EDGE_KINDS = ['trigger', 'dispatch', 'delegate', 'supervise', 'blocked'] as const
export type GraphEdgeKind = (typeof GRAPH_EDGE_KINDS)[number]

/** 主面板与侧边栏的稳定标识。 */
export const PANEL_ID = 'nexus'
export const ENTRY = 'nexus'
export const LOCALE_NS = 'nexus'

/** 面板轮询间隔（毫秒）。 */
export const POLL_INTERVAL_MS = 5000

/** API 根路径。路由与客户端拼接都从这里取，不各写一遍。 */
export const API_ROOT = '/api/nexus'

/** 状态 → 官方 `StateDot` 的语义。 */
export const STATUS_DOT = {
  waiting: 'idle',
  queued: 'ongoing',
  running: 'ongoing',
  review: 'warning',
  done: 'done',
  cancelled: 'idle',
} as const satisfies Record<TicketStatus, 'done' | 'warning' | 'ongoing' | 'error' | 'idle'>

/** 状态 → 官方 `Tag` 的配色。 */
export const STATUS_TONE = {
  waiting: 'quiet',
  queued: 'info',
  running: 'info',
  review: 'warning',
  done: 'success',
  cancelled: 'quiet',
} as const satisfies Record<TicketStatus, 'outline' | 'solid' | 'neutral' | 'quiet' | 'success' | 'info' | 'warning' | 'danger'>
