import type { Kysely } from 'kysely'
import type {
  TicketBrief,
  TicketDetail,
  TicketLinkRef,
  TicketStatus,
  TicketThreadRef,
  WorkerBrief,
} from '../../types'
import type { DB } from '../types'
import { Model } from 'kysely-model'
import { TICKET_STATUSES } from '../../constants'
import { Inbox } from './inbox'

/**
 * 一个任务。主编排分诊出来的一件具体工作。
 *
 * 没有 `draft`：任务一旦存在，`projectId` 就必须确定。
 * 没有 `attention`：「需介入」由 pending ask 派生，不占状态位。
 */
export class Ticket extends Model<DB, 'ticket'> {
  private readonly inbox: Inbox

  constructor(db: Kysely<DB>) {
    super(db, 'ticket', 'id')
    this.inbox = new Inbox(db)
  }

  /** 有 pending ask 的票。一次查完，不逐票查。 */
  async attentionIds(): Promise<Set<string>> {
    const rows = await this.db.selectFrom('inbox').select('ticketId').where('kind', '=', 'ask').where('status', '=', 'pending').where('ticketId', 'is not', null).execute()
    return new Set(rows.flatMap(row => row.ticketId ? [row.ticketId] : []))
  }

  /** 任务列表。`filter` 只影响返回的票，不影响计数。 */
  async board(filter?: string): Promise<{ tickets: TicketBrief[], counts: Record<string, number> }> {
    const [rows, projects, channels, attention] = await Promise.all([
      this.db.selectFrom('ticket').selectAll().orderBy('updatedAt', 'desc').execute(),
      this.db.selectFrom('project').select(['id', 'name']).execute(),
      this.db.selectFrom('channel').select(['id', 'name']).execute(),
      this.attentionIds(),
    ])
    const projectMap = new Map(projects.map(row => [row.id, row.name]))
    const channelMap = new Map(channels.map(row => [row.id, row.name]))
    const briefs = rows.map(row => toBrief(row, projectMap, channelMap, attention))

    const counts: Record<string, number> = { all: rows.length, attention: attention.size }
    for (const status of TICKET_STATUSES) counts[status] = rows.filter(row => row.status === status).length

    return { tickets: !filter || filter === 'all' ? briefs : briefs.filter(brief => brief.status === filter), counts }
  }

  /** 最近任务，概览页用。 */
  async recent(limit = 8): Promise<TicketBrief[]> {
    const { tickets } = await this.board()
    return tickets.slice(0, limit)
  }

  /** 详情：话题、关联、Worker、收件箱一次取齐。 */
  async detail(id: string): Promise<TicketDetail | undefined> {
    const [row, projects, channels, attention] = await Promise.all([
      this.db.selectFrom('ticket').selectAll().where('id', '=', id).executeTakeFirst(),
      this.db.selectFrom('project').select(['id', 'name']).execute(),
      this.db.selectFrom('channel').select(['id', 'name']).execute(),
      this.attentionIds(),
    ])
    if (!row)
      return undefined

    const [threadRows, linkRows, workerRows, inboxRows] = await Promise.all([
      this.db.selectFrom('ticket_thread').innerJoin('thread', 'thread.id', 'ticket_thread.threadId').select(['thread.id as key', 'thread.title', 'thread.kind', 'thread.url', 'ticket_thread.createdAt']).where('ticket_thread.ticketId', '=', id).orderBy('ticket_thread.createdAt', 'asc').execute(),
      this.db.selectFrom('ticket_link').innerJoin('ticket', 'ticket.id', 'ticket_link.relatedId').select(['ticket.id', 'ticket.title', 'ticket.status', 'ticket_link.kind']).where('ticket_link.ticketId', '=', id).execute(),
      this.db.selectFrom('worker').selectAll().where('ticketId', '=', id).orderBy('createdAt', 'desc').execute(),
      this.db.selectFrom('inbox').selectAll().where('ticketId', '=', id).orderBy('seq', 'desc').limit(50).execute(),
    ])

    const threads: TicketThreadRef[] = threadRows.map(thread => ({
      key: thread.key,
      title: thread.title,
      kind: thread.kind,
      ...thread.url ? { url: thread.url } : {},
    }))
    const links: TicketLinkRef[] = linkRows.map(link => ({
      id: link.id,
      title: link.title,
      kind: link.kind,
      status: link.status as TicketStatus,
    }))
    const workers: WorkerBrief[] = workerRows.map(worker => ({
      id: worker.id,
      status: worker.status,
      ...worker.title ? { title: worker.title } : {},
      ...worker.branch ? { branch: worker.branch } : {},
      ...worker.reportState ? { reportState: worker.reportState } : {},
      ...worker.report ? { report: worker.report } : {},
      ...worker.reportAt ? { reportAt: worker.reportAt } : {},
      ...worker.backgroundUntil ? { backgroundUntil: worker.backgroundUntil } : {},
      ...worker.recoveryNote ? { recoveryNote: worker.recoveryNote } : {},
    }))

    return {
      ...toBrief(row, new Map(projects.map(p => [p.id, p.name])), new Map(channels.map(c => [c.id, c.name])), attention),
      ...row.description ? { description: row.description } : {},
      createdAt: row.createdAt,
      ...row.startedAt ? { startedAt: row.startedAt } : {},
      ...row.endedAt ? { endedAt: row.endedAt } : {},
      ...row.prUrl ? { prUrl: row.prUrl } : {},
      ...row.prState ? { prState: row.prState } : {},
      ...row.ciState ? { ciState: row.ciState } : {},
      paused: row.paused === 1,
      ...row.prepareError ? { prepareError: row.prepareError } : {},
      threads,
      links,
      workers,
      inbox: inboxRows.map(row => this.inbox.brief(row)),
    }
  }

  /** 暂停 / 恢复。在任务详情里按，不是全局开关。 */
  async setPaused(id: string, paused: boolean): Promise<void> {
    await this.db.updateTable('ticket').set({ paused: paused ? 1 : 0, updatedAt: new Date().toISOString() }).where('id', '=', id).execute()
  }

  /** 状态机迁移。`done` / `cancelled` 是终态。 */
  async setStatus(id: string, status: TicketStatus): Promise<void> {
    const now = new Date().toISOString()
    await this.db.updateTable('ticket')
      .set({ status, updatedAt: now, ...status === 'running' ? { startedAt: now } : {}, ...status === 'done' || status === 'cancelled' ? { endedAt: now } : {} })
      .where('id', '=', id)
      .execute()
  }

  /** 下一个任务号。`T-105` 这种，人和代理都靠它互相指代。 */
  async nextId(): Promise<string> {
    const rows = await this.db.selectFrom('ticket').select('id').execute()
    const max = rows.reduce((acc, row) => {
      const matched = /^T-(\d+)$/.exec(row.id)
      return matched ? Math.max(acc, Number(matched[1])) : acc
    }, 100)
    return `T-${max + 1}`
  }

  /** 每个状态各几张。概览页用。 */
  async statusCounts(): Promise<Record<TicketStatus, number>> {
    const rows = await this.db.selectFrom('ticket').select('status').select(eb => eb.fn.countAll<number>().as('total')).groupBy('status').execute()
    const found = new Map(rows.map(row => [row.status, Number(row.total)]))
    return Object.fromEntries(TICKET_STATUSES.map(status => [status, found.get(status) ?? 0])) as Record<TicketStatus, number>
  }
}

/** 任务 ↔ 话题。这就是「订阅」：话题上再来新触发，就该冒到编排的收件箱。 */
export class TicketThread extends Model<DB, 'ticket_thread'> {
  constructor(db: Kysely<DB>) {
    super(db, 'ticket_thread', 'ticketId')
  }
}

/** 任务 ↔ 任务。`depends` 到终态时会自动通知该票所属的 Supervisor。 */
export class TicketLink extends Model<DB, 'ticket_link'> {
  constructor(db: Kysely<DB>) {
    super(db, 'ticket_link', 'relatedId')
  }
}

/** 行 → 卡片。`attention` 由 pending ask 派生。 */
function toBrief(
  row: { id: string, title: string, status: string, projectId: string, channelId: string, updatedAt: string, prepareError: string | null },
  projects: Map<string, string>,
  channels: Map<string, string>,
  attention: Set<string>,
): TicketBrief {
  return {
    id: row.id,
    title: row.title,
    status: row.status as TicketStatus,
    project: projects.get(row.projectId) ?? row.projectId,
    channel: channels.get(row.channelId) ?? row.channelId,
    updatedAt: row.updatedAt,
    attention: attention.has(row.id),
    ...row.prepareError ? { error: row.prepareError } : {},
  }
}
