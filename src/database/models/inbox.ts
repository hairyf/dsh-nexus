import type { Kysely, Selectable } from 'kysely'
import type { InboxBrief, InboxItemView, InboxKind, InboxStatus, InboxTarget, InboxView } from '../../types'
import type { DB } from '../types'
import { Model } from 'kysely-model'
import { INBOX_TARGETS } from '../../constants'

type InboxRow = Selectable<DB['inbox']>

/**
 * 一条投给某个代理——或者人类——的消息。
 *
 * 三个状态：`pending` 还没轮到、`done` 处理完、`stalled` 投递卡住。
 * **只有 `pending` 进「你有 N 条未处理」**，`stalled` 是「送不到」，要人看。
 */
export class Inbox extends Model<DB, 'inbox'> {
  constructor(db: Kysely<DB>) {
    super(db, 'inbox', 'id')
  }

  /** 面板条目。时间戳、投递信息、ask 字段全在这里收口。 */
  brief(row: InboxRow): InboxBrief {
    return {
      id: row.id,
      type: row.type,
      origin: row.origin,
      kind: row.kind,
      status: row.status,
      ...row.title ? { title: row.title } : {},
      message: row.message,
      createdAt: row.createdAt,
      seq: String(row.seq),
      deliveryAttempts: row.deliveryAttempts,
      ...row.deliveryError ? { deliveryError: row.deliveryError } : {},
      ...row.nextRetryAt ? { nextRetryAt: row.nextRetryAt } : {},
      ...row.readAt ? { readAt: row.readAt } : {},
      escalations: row.escalations,
      ...row.answer ? { answer: row.answer } : {},
      ...row.answeredBy ? { answeredBy: row.answeredBy } : {},
    }
  }

  /** 收件箱页：全部条目 + 每个 type 的未读数 + 卡住的条数。 */
  async page(type?: string): Promise<InboxView> {
    const rows = await this.db.selectFrom('inbox').selectAll().orderBy('seq', 'desc').limit(200).execute()
    const counts: Record<InboxTarget, number> = { user: 0, main: 0, project: 0, supervisor: 0 }
    for (const row of rows) {
      if (row.status === 'pending')
        counts[row.type] += 1
    }
    const stalled = rows.filter(row => row.status === 'stalled').length
    const visible = type ? rows.filter(row => row.type === type) : rows

    const [projects, tickets, threads, workers] = await Promise.all([
      this.db.selectFrom('project').select(['id', 'name']).execute(),
      this.db.selectFrom('ticket').select(['id', 'title']).execute(),
      this.db.selectFrom('thread').select(['id', 'title']).execute(),
      this.db.selectFrom('worker').select(['id', 'ticketId']).execute(),
    ])
    const projectMap = new Map(projects.map(row => [row.id, row.name]))
    const ticketMap = new Map(tickets.map(row => [row.id, row.title]))
    const threadMap = new Map(threads.map(row => [row.id, row.title]))
    const workerMap = new Map(workers.map(row => [row.id, row.ticketId]))

    const items: InboxItemView[] = visible.map(row => ({
      id: row.id,
      type: row.type,
      origin: row.origin,
      kind: row.kind,
      status: row.status,
      ...row.title ? { title: row.title } : {},
      message: row.message,
      createdAt: row.createdAt,
      seq: String(row.seq),
      deliveryAttempts: row.deliveryAttempts,
      ...row.deliveryError ? { deliveryError: row.deliveryError } : {},
      ...row.nextRetryAt ? { nextRetryAt: row.nextRetryAt } : {},
      ...row.readAt ? { readAt: row.readAt } : {},
      escalations: row.escalations,
      ...row.answer ? { answer: row.answer } : {},
      ...row.answeredBy ? { answeredBy: row.answeredBy } : {},
      ...row.projectId ? { projectId: row.projectId } : {},
      ...row.projectId ? { project: projectMap.get(row.projectId) ?? row.projectId } : {},
      ...row.ticketId ? { ticketId: row.ticketId } : {},
      ...row.ticketId ? { ticket: ticketMap.get(row.ticketId) ?? row.ticketId } : {},
      ...row.threadId ? { thread: threadMap.get(row.threadId) ?? row.threadId } : {},
      ...row.workerId ? { worker: workerMap.get(row.workerId) ?? row.workerId } : {},
    }))
    return { items, counts, stalled }
  }

  /** 某个代理名下还有几条未处理。会话结束时用它提示「你有 N 条消息未处理」。 */
  async pendingCount(target: InboxTarget, projectId?: string): Promise<number> {
    let query = this.db.selectFrom('inbox').select(eb => eb.fn.countAll<number>().as('total')).where('type', '=', target).where('status', '=', 'pending')
    if (projectId)
      query = query.where('projectId', '=', projectId)
    const row = await query.executeTakeFirst()
    return Number(row?.total ?? 0)
  }

  /** 批量标掉。不需要先读 —— 代理处理完顺手清掉就行。 */
  async kill(ids: string[]): Promise<number> {
    if (!ids.length)
      return 0
    await this.db.updateTable('inbox')
      .set({ status: 'done', doneAt: new Date().toISOString() })
      .where('id', 'in', ids)
      .execute()
    return ids.length
  }

  /** 记一次投递失败；到次数上限转 `stalled`。 */
  async failDelivery(id: string, error: string, maxAttempts: number, ceilingSeconds: number): Promise<InboxStatus> {
    const row = await this.db.selectFrom('inbox').select(['deliveryAttempts']).where('id', '=', id).executeTakeFirst()
    const attempts = (row?.deliveryAttempts ?? 0) + 1
    const stalled = attempts >= maxAttempts
    // 退避 2 → 4 → 8…，封顶由设置给
    const delay = Math.min(2 ** attempts, ceilingSeconds)
    await this.db.updateTable('inbox').set({
      deliveryAttempts: attempts,
      deliveryError: error,
      nextRetryAt: stalled ? null : new Date(Date.now() + delay * 1000).toISOString(),
      ...stalled ? { status: 'stalled' } : {},
    }).where('id', '=', id).execute()
    return stalled ? 'stalled' : 'pending'
  }

  /** 投递成功：清零重试计数。 */
  async delivered(id: string): Promise<void> {
    await this.db.updateTable('inbox').set({ deliveryAttempts: 0, deliveryError: null, nextRetryAt: null, readAt: new Date().toISOString() }).where('id', '=', id).execute()
  }

  /** 记一条 ask 的回答。填上它就把状态置为 `done`。 */
  async answer(id: string, text: string, by: string): Promise<void> {
    await this.db.updateTable('inbox').set({
      answer: text,
      answeredBy: by as never,
      answeredAt: new Date().toISOString(),
      status: 'done',
      doneAt: new Date().toISOString(),
    }).where('id', '=', id).execute()
  }

  /** 升级：就地改 type，不新建行。一个问题从头到尾只有一条记录、一个身份。 */
  async escalate(id: string, to: InboxTarget): Promise<void> {
    const row = await this.db.selectFrom('inbox').select(['escalations']).where('id', '=', id).executeTakeFirst()
    await this.db.updateTable('inbox').set({
      type: to,
      escalations: (row?.escalations ?? 0) + 1,
      lastEscalatedAt: new Date().toISOString(),
      // 升到主编排之后不再需要截止时间
    }).where('id', '=', id).execute()
  }

  /** 投一条新消息。`seq` 自增，同票同地址靠它保序。 */
  async push(input: {
    type: InboxTarget
    origin: string
    kind: InboxKind
    message: string
    title?: string
    projectId?: string
    supervisorId?: string
    ticketId?: string
    threadId?: string
    triggerId?: string
    workerId?: string
  }): Promise<string> {
    const last = await this.db.selectFrom('inbox').select('seq').orderBy('seq', 'desc').limit(1).executeTakeFirst()
    const seq = BigInt(last?.seq ?? 0) + 1n
    const id = `inbox_${seq}_${Date.now().toString(36)}`
    await this.db.insertInto('inbox').values({
      id,
      seq,
      type: input.type,
      origin: input.origin,
      kind: input.kind,
      message: input.message,
      status: 'pending',
      createdAt: new Date().toISOString(),
      ...input.title ? { title: input.title } : {},
      ...input.projectId ? { projectId: input.projectId } : {},
      ...input.supervisorId ? { supervisorId: input.supervisorId } : {},
      ...input.ticketId ? { ticketId: input.ticketId } : {},
      ...input.threadId ? { threadId: input.threadId } : {},
      ...input.triggerId ? { triggerId: input.triggerId } : {},
      ...input.workerId ? { workerId: input.workerId } : {},
    } as never).execute()
    return id
  }

  /** 各 type 未读数，供面板侧边栏与总览用。 */
  async counts(): Promise<Record<InboxTarget, number>> {
    const rows = await this.db.selectFrom('inbox').select('type').where('status', '=', 'pending').select(eb => eb.fn.countAll<number>().as('total')).groupBy('type').execute()
    const found = new Map(rows.map(row => [row.type, Number(row.total)]))
    return Object.fromEntries(INBOX_TARGETS.map(type => [type, found.get(type) ?? 0])) as Record<InboxTarget, number>
  }
}
