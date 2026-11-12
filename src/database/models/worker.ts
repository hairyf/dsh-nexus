import type { Kysely, Selectable } from 'kysely'
import type { ReportState, WorkerBrief } from '../../types'
import type { DB } from '../types'
import { Model } from 'kysely-model'

type WorkerRow = Selectable<DB['worker']>

/**
 * 一个 Worker（执行会话）。任务里真正干活的那一段，短命。
 *
 * **一个 Worker 只有一个 worktree**，所以分支和路径直接放在这一行上。
 * **没有收件箱**：它被动、等的时候是阻塞的，上级的话直接 prompt 进会话。
 */
export class Worker extends Model<DB, 'worker'> {
  constructor(db: Kysely<DB>) {
    super(db, 'worker', 'id')
  }

  brief(row: WorkerRow): WorkerBrief {
    return {
      id: row.id,
      status: row.status,
      ...row.title ? { title: row.title } : {},
      ...row.branch ? { branch: row.branch } : {},
      ...row.reportState ? { reportState: row.reportState } : {},
      ...row.report ? { report: row.report } : {},
      ...row.reportAt ? { reportAt: row.reportAt } : {},
      ...row.backgroundUntil ? { backgroundUntil: row.backgroundUntil } : {},
      ...row.recoveryNote ? { recoveryNote: row.recoveryNote } : {},
    }
  }

  /** 某个任务下的所有 Worker，最新在前。 */
  async ofTicket(ticketId: string): Promise<WorkerBrief[]> {
    const rows = await this.db.selectFrom('worker').selectAll().where('ticketId', '=', ticketId).orderBy('createdAt', 'desc').execute()
    return rows.map(row => this.brief(row))
  }

  /** 正在跑的 Worker。槽位统计要用它。 */
  async running(): Promise<WorkerBrief[]> {
    const rows = await this.db.selectFrom('worker').selectAll().where('status', '=', 'running').execute()
    return rows.map(row => this.brief(row))
  }

  /**
   * 占着槽位的 Worker 数。
   *
   * 回合结束但有后台任务在跑的，`backgroundUntil` 非空 —— 它**继续占槽**，
   * 否则槽位被别的票占了，任务起了服务器却没人接。
   */
  async holdingSlots(now = new Date().toISOString()): Promise<number> {
    const rows = await this.db.selectFrom('worker').select(['status', 'backgroundUntil']).execute()
    return rows.filter(row => row.status === 'running' || (row.backgroundUntil !== null && row.backgroundUntil > now)).length
  }

  /** 记汇报。`dropped` 表示「这事不用做了」，票直接结束。 */
  async report(id: string, state: ReportState, summary: string): Promise<void> {
    await this.db.updateTable('worker')
      .set({ reportState: state, report: summary, reportAt: new Date().toISOString() })
      .where('id', '=', id)
      .execute()
  }

  /** 收工。保留 `branch` / `worktree` —— 那是「曾在哪干过」的唯一记录。 */
  async end(id: string, reason: string): Promise<void> {
    await this.db.updateTable('worker')
      .set({ status: 'ended', endedAt: new Date().toISOString(), endedReason: reason as never })
      .where('id', '=', id)
      .execute()
  }

  /** 改标题，让面板一眼看懂这个会话在干嘛。 */
  async rename(id: string, title: string): Promise<void> {
    await this.db.updateTable('worker').set({ title }).where('id', '=', id).execute()
  }

  /** 后台工作的截止时刻。超过它就该杀掉后台并报 waiting。 */
  async deadline(id: string, limitMinutes: number): Promise<string> {
    const until = new Date(Date.now() + limitMinutes * 60_000).toISOString()
    await this.db.updateTable('worker').set({ backgroundUntil: until }).where('id', '=', id).execute()
    return until
  }
}
