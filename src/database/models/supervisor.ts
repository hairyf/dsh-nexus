import type { Kysely } from 'kysely'
import type { DB } from '../types'
import { Model } from 'kysely-model'

/**
 * 临时 Supervisor。一件工作跨两个以上项目时，主编排拉起来的协调者。
 *
 * 用完即弃：关联工单全部落地后 `status = closed`，从界面消失但行不删 ——
 * 那几张工单还指着它说明自己当初为什么存在。
 */
export class Supervisor extends Model<DB, 'supervisor'> {
  constructor(db: Kysely<DB>) {
    super(db, 'supervisor', 'id')
  }

  /** 在协调的 Supervisor。 */
  async active(): Promise<Array<{ id: string, title: string, reason: string, status: string, createdAt: string }>> {
    return this.db.selectFrom('supervisor').selectAll().where('status', '=', 'active').execute()
  }

  /** 某张票属于哪个 Supervisor。`report` / `ask` 带 `supervisorId` 前先查它。 */
  async ofTicket(ticketId: string): Promise<string | undefined> {
    const row = await this.db.selectFrom('supervisor_ticket')
      .innerJoin('supervisor', 'supervisor.id', 'supervisor_ticket.supervisorId')
      .select('supervisor.id')
      .where('supervisor_ticket.ticketId', '=', ticketId)
      .where('supervisor.status', '=', 'active')
      .executeTakeFirst()
    return row?.id
  }

  /** 这个 Supervisor 关注的票全部到终态了吗。收工条件。 */
  async settled(id: string): Promise<boolean> {
    const rows = await this.db.selectFrom('supervisor_ticket')
      .innerJoin('ticket', 'ticket.id', 'supervisor_ticket.ticketId')
      .select('ticket.status')
      .where('supervisor_ticket.supervisorId', '=', id)
      .execute()
    return rows.length > 0 && rows.every(row => row.status === 'done' || row.status === 'cancelled')
  }

  /** 这个 Supervisor 现在管着哪几张票。每次醒来先看它，不能只信收件箱那一条。 */
  async ticketsOf(id: string): Promise<Array<{ id: string, title: string, status: string, prUrl: string | null, prState: string | null }>> {
    return this.db.selectFrom('supervisor_ticket')
      .innerJoin('ticket', 'ticket.id', 'supervisor_ticket.ticketId')
      .select(['ticket.id', 'ticket.title', 'ticket.status', 'ticket.prUrl', 'ticket.prState'])
      .where('supervisor_ticket.supervisorId', '=', id)
      .execute()
  }

  /** 收工。 */
  async close(id: string): Promise<void> {
    await this.db.updateTable('supervisor')
      .set({ status: 'closed', closedAt: new Date().toISOString() })
      .where('id', '=', id)
      .execute()
  }
}

/** Supervisor 关联了哪些工单。全部分到终态，Supervisor 就该收工。 */
export class SupervisorTicket extends Model<DB, 'supervisor_ticket'> {
  constructor(db: Kysely<DB>) {
    super(db, 'supervisor_ticket', 'supervisorId')
  }

  /** 解除一张票的关联。票退回原项目编排，不取消。 */
  async detach(supervisorId: string, ticketId: string): Promise<void> {
    await this.db.deleteFrom('supervisor_ticket')
      .where('supervisorId', '=', supervisorId)
      .where('ticketId', '=', ticketId)
      .execute()
  }

  /** 记一条关联。 */
  async attach(supervisorId: string, ticketId: string): Promise<void> {
    await this.db.insertInto('supervisor_ticket')
      .values({ supervisorId, ticketId, createdAt: new Date().toISOString() })
      .execute()
  }
}
