import type { Kysely } from 'kysely'
import type { ThreadBrief, ThreadTriage, TriggerBrief, TriggerView } from '../../types'
import type { DB } from '../types'
import { Model } from 'kysely-model'

/**
 * 一个话题：issue、PR、分支 CI、或飞书话题串。
 *
 * `triage` 是主编排的判断结论，只写一次 —— 它既是「已经认领过」的凭据，
 * 也是不让主编排被同一条话题反复叫醒的东西。
 */
export class Thread extends Model<DB, 'thread'> {
  constructor(db: Kysely<DB>) {
    super(db, 'thread', 'id')
  }

  /** 触发页的话题列表，按最近活动倒序。 */
  async brief(limit = 100): Promise<ThreadBrief[]> {
    const [rows, channels, projects] = await Promise.all([
      this.db.selectFrom('thread').selectAll().orderBy('updatedAt', 'desc').limit(limit).execute(),
      this.db.selectFrom('channel').select(['id', 'name']).execute(),
      this.db.selectFrom('project').select(['id', 'name']).execute(),
    ])
    const counts = await this.db.selectFrom('trigger').select('threadId').select(eb => eb.fn.countAll<number>().as('total')).groupBy('threadId').execute()
    const countMap = new Map(counts.map(row => [row.threadId, Number(row.total)]))
    const channelMap = new Map(channels.map(row => [row.id, row.name]))
    const projectMap = new Map(projects.map(row => [row.id, row.name]))

    return rows.map(row => ({
      key: row.id,
      title: row.title,
      kind: row.kind,
      channel: channelMap.get(row.channelId) ?? row.channelId,
      triage: row.triage,
      ...row.projectId ? { project: projectMap.get(row.projectId) ?? row.projectId } : {},
      ...row.url ? { url: row.url } : {},
      updatedAt: row.updatedAt,
      triggers: countMap.get(row.id) ?? 0,
    }))
  }

  /** 触发页：话题列表 + 选中话题的触发；没选就只给列表。 */
  async page(threadKey?: string): Promise<TriggerView> {
    const threads = await this.brief()
    if (!threadKey)
      return { threads, triggers: [] }
    const selected = await this.findUnique(threadKey).catch(() => undefined)
    const triggers = await this.db.selectFrom('trigger').selectAll().where('threadId', '=', threadKey).orderBy('at', 'desc').limit(100).execute()
    const channels = await this.db.selectFrom('channel').select(['id', 'name']).execute()
    const channelMap = new Map(channels.map(row => [row.id, row.name]))

    return {
      threads,
      triggers: triggers.map((row): TriggerBrief => ({
        id: row.id,
        kind: row.kind,
        channel: row.channelId,
        channelName: channelMap.get(row.channelId) ?? row.channelId,
        threadKey: row.threadId,
        threadTitle: selected?.title ?? row.threadId,
        threadKind: selected?.kind ?? 'issue',
        ...row.actorName ? { actorName: row.actorName } : {},
        human: row.human === 1,
        mentioned: row.mentioned === 1,
        text: row.text,
        ...row.url ? { url: row.url } : {},
        at: row.at,
        ...row.ref ? { ref: row.ref } : {},
      })),
    }
  }

  /** 写分诊结论。`claim` 时 `projectId` 必填。 */
  async triageTo(threadKey: string, triage: ThreadTriage, projectId?: string): Promise<void> {
    if (triage === 'claimed' && !projectId)
      throw new Error('claim 必须给 projectId')
    await this.db.updateTable('thread')
      .set({ triage, triagedAt: new Date().toISOString(), ...projectId ? { projectId } : {} })
      .where('id', '=', threadKey)
      .execute()
  }
}

/** 渠道里发生的、不可变的一件事。`ref` 带分支名或 commit sha。 */
export class Trigger extends Model<DB, 'trigger'> {
  constructor(db: Kysely<DB>) {
    super(db, 'trigger', 'id')
  }

  /** 24 小时内的触发计数，概览页用。 */
  async receivedSince(iso: string): Promise<number> {
    const row = await this.db.selectFrom('trigger').select(eb => eb.fn.countAll<number>().as('total')).where('at', '>=', iso).executeTakeFirst()
    return Number(row?.total ?? 0)
  }

  /**
   * 按分支名找触发。
   * PR 归哪张工单靠它判断：分支末段和 `Worker.branch` 末段对得上就是同一张票。
   */
  async byBranchSuffix(suffix: string): Promise<Array<{ id: string, ref: string | null }>> {
    return this.db.selectFrom('trigger').selectAll().where('ref', 'like', `%${suffix}`).execute()
  }
}
