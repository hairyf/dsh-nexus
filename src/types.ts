/**
 * 面板读写的全部数据结构。Host 产出、Client 消费，两边只认这一份。
 *
 * 设计原则：每个视图返回**已经组装好的展示数据**，不在 Client 端二次 join。
 * 面板是只读监工界面，它不该知道表结构。
 *
 * 这些类型同时是 GenAPI 的响应契约，所以必须是具体 JSON 类型 ——
 * 不能有泛型、函数、class、递归。
 */

import type {
  GraphEdgeKind,
  GraphNodeKind,
  InboxKind,
  InboxStatus,
  InboxTarget,
  ReportState,
  SettingKey,
  ThreadTriage,
  TicketStatus,
} from './constants'

export type { GraphEdgeKind, GraphNodeKind, InboxKind, InboxStatus, InboxTarget, ReportState, SettingKey, ThreadTriage, TicketStatus }

// ── 概览 ────────────────────────────────────────────────────────────────

/** 渠道卡片：概览与渠道页共用。 */
export interface ChannelSummary {
  id: string
  name: string
  enabled: boolean
  /** 已登录的账号数 */
  accounts: number
  /** 监听中的话题数 */
  threads: number
}

/** 任务卡片。列表、概览、详情共用的那一段。 */
export interface TicketBrief {
  id: string
  title: string
  status: TicketStatus
  /** 项目展示名，例如 `owner/project-1` */
  project: string
  /** 触发渠道展示名 */
  channel: string
  updatedAt: string
  /** 有 pending ask 就是需介入。由收件箱派生，不占 `status` */
  attention: boolean
  /** 准备阶段失败原因；非空时列表上要显示「需介入 · 系统错误」 */
  error?: string
}

export interface OverviewStats {
  channels: ChannelSummary[]
  /** 24 小时内接收的触发数 */
  received24h: number
  /** 24 小时内被过滤掉的触发数 */
  filtered24h: number
  /** 按状态分组的任务计数 */
  tickets: Record<TicketStatus, number>
}

/** 层级关系图上的一个节点。 */
export interface GraphNode {
  id: string
  kind: GraphNodeKind
  label: string
  /** 次级说明，例如任务状态 */
  detail?: string
  /** 需要人注意时高亮 */
  attention?: boolean
}

/** 层级关系图上的一条边。 */
export interface GraphEdge {
  from: string
  to: string
  kind: GraphEdgeKind
  label?: string
}

/**
 * 概览页的层级关系图。
 *
 * 画的是「渠道 → 主编排 → 项目编排 → 任务」，外加 Supervisor 的旁路。
 * 节点按真实记录生成（有几个项目就画几个），不是示意图。
 */
export interface HierarchyGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface OverviewView {
  stats: OverviewStats
  /** 最近任务，按更新时间倒序 */
  recent: TicketBrief[]
  graph: HierarchyGraph
}

// ── 任务 ────────────────────────────────────────────────────────────────

export interface TicketThreadRef {
  key: string
  title: string
  kind: string
  url?: string
}

/** 任务之间的关联。`depends` 到终态时会自动通知 Supervisor。 */
export interface TicketLinkRef {
  id: string
  title: string
  kind: string
  status: TicketStatus
}

/** 一个执行会话。**一个 Worker 只有一个 worktree。 */
export interface WorkerBrief {
  id: string
  status: string
  title?: string
  branch?: string
  reportState?: ReportState
  report?: string
  reportAt?: string
  /** 后台工作还能跑到什么时候；非空说明还占着槽位 */
  backgroundUntil?: string
  /** 重启恢复提示 */
  recoveryNote?: string
}

/** 一条投递记录。`stalled` 是「送不到」，不进未读计数。 */
export interface InboxBrief {
  id: string
  type: InboxTarget
  origin: string
  kind: InboxKind
  status: InboxStatus
  title?: string
  message: string
  createdAt: string
  /** 同一票对同一地址按它排序 */
  seq: string
  deliveryAttempts: number
  deliveryError?: string
  nextRetryAt?: string
  /** 会话取进上下文的时刻；为空表示还在队列 */
  readAt?: string
  escalations: number
  answer?: string
  answeredBy?: string
}

export interface TicketDetail extends TicketBrief {
  description?: string
  createdAt: string
  startedAt?: string
  endedAt?: string
  prUrl?: string
  prState?: string
  ciState?: string
  /** 在任务详情里暂停，不是全局开关 */
  paused: boolean
  /** 建 worktree 失败的原因 */
  prepareError?: string
  threads: TicketThreadRef[]
  links: TicketLinkRef[]
  workers: WorkerBrief[]
  inbox: InboxBrief[]
}

export interface TaskListView {
  tickets: TicketBrief[]
  /** 各筛选下的计数，供标签页显示 */
  counts: Record<string, number>
}

// ── 触发 ────────────────────────────────────────────────────────────────

/** 渠道里发生的、不可变的一件事。 */
export interface TriggerBrief {
  id: string
  kind: string
  channel: string
  channelName: string
  threadKey: string
  threadTitle: string
  threadKind: string
  actorName?: string
  /** 是不是人发的。`system: true` 的动作不算 */
  human: boolean
  mentioned: boolean
  text: string
  url?: string
  at: string
  /** 分支名 / commit sha。PR 归票靠它 */
  ref?: string
}

/** 一个话题：issue、PR、分支 CI、或聊天话题串。 */
export interface ThreadBrief {
  key: string
  title: string
  kind: string
  channel: string
  triage: ThreadTriage
  project?: string
  url?: string
  updatedAt: string
  /** 触发总数 */
  triggers: number
}

export interface TriggerView {
  threads: ThreadBrief[]
  /** 选中话题时的触发列表；没选时为空 */
  triggers: TriggerBrief[]
}

// ── 渠道 ────────────────────────────────────────────────────────────────

export interface AccountView {
  id: string
  role: string
  name: string
  avatar?: string
  status: string
}

export interface ChannelDetail {
  id: string
  name: string
  enabled: boolean
  /** 仅 gitlab 有值 */
  host?: string
  accounts: AccountView[]
  projects: number
  threads: number
  /** 最近一次读取的游标时间 */
  lastReadAt?: string
  /** 读取游标名列表，供排查 */
  cursors: string[]
}

export interface ChannelView {
  channels: ChannelDetail[]
}

// ── 设置 ────────────────────────────────────────────────────────────────

export interface SettingView {
  values: Record<SettingKey, number | boolean>
  updatedAt: string
}

// ── 收件箱 ──────────────────────────────────────────────────────────────

export interface InboxItemView extends InboxBrief {
  /** 项目 id，用于按项目过滤 */
  projectId?: string
  /** 项目展示名 */
  project?: string
  /** 关联任务 id */
  ticketId?: string
  ticket?: string
  thread?: string
  worker?: string
}

export interface InboxView {
  items: InboxItemView[]
  /** 每个 type 的未读数。**只有 pending 计入 */
  counts: Record<InboxTarget, number>
  /** 投递卡住的条数 */
  stalled: number
}

// ── 通用响应 ────────────────────────────────────────────────────────────

/** 所有写操作统一返回它；失败由 HTTP 状态码 + message 表达。 */
export interface Ack {
  ok: boolean
  /** 给人看的一句话，面板直接显示 */
  message?: string
}

/** 项目，供设置页与收件箱用。 */
export interface ProjectView {
  id: string
  name: string
  workspaceId: string
  directory: string
}

export interface ProjectListView {
  projects: ProjectView[]
}
