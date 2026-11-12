import type { Kysely } from 'kysely'
import type { ChannelDetail, ChannelSummary } from '../../types'
import type { DB } from '../types'
import { Model } from 'kysely-model'

/** 渠道。`host` 只有 gitlab 用。 */
export class Channel extends Model<DB, 'channel'> {
  constructor(db: Kysely<DB>) {
    super(db, 'channel', 'id')
  }

  /** 概览页的渠道卡片：监听状态 + 在线账号数 + 话题数。 */
  async summary(): Promise<ChannelSummary[]> {
    const [rows, accounts, threads] = await Promise.all([
      this.db.selectFrom('channel').selectAll().execute(),
      this.db.selectFrom('channel_account').select(['channelId', 'status']).execute(),
      this.db.selectFrom('thread').select(['id', 'channelId']).execute(),
    ])
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      enabled: row.enabled === 1,
      accounts: accounts.filter(account => account.channelId === row.id && account.status === 'online').length,
      threads: threads.filter(thread => thread.channelId === row.id).length,
    }))
  }

  /** 渠道页：账号、项目数、读取游标一次取齐。 */
  async detail(): Promise<ChannelDetail[]> {
    const [rows, accounts, projects, threads, states] = await Promise.all([
      this.db.selectFrom('channel').selectAll().execute(),
      this.db.selectFrom('channel_account').selectAll().execute(),
      this.db.selectFrom('project').select(['id', 'channelId']).execute(),
      this.db.selectFrom('thread').select(['id', 'channelId']).execute(),
      this.db.selectFrom('source_state').selectAll().execute(),
    ])
    return rows.map((row) => {
      const ownStates = states.filter(state => state.channelId === row.id)
      const lastReadAt = ownStates.map(state => state.updatedAt).sort().at(-1)
      return {
        id: row.id,
        name: row.name,
        enabled: row.enabled === 1,
        ...row.host ? { host: row.host } : {},
        accounts: accounts.filter(account => account.channelId === row.id).map(account => ({
          id: account.id,
          role: account.role,
          name: account.name,
          ...account.avatar ? { avatar: account.avatar } : {},
          status: account.status,
        })),
        projects: projects.filter(project => project.channelId === row.id).length,
        threads: threads.filter(thread => thread.channelId === row.id).length,
        ...lastReadAt ? { lastReadAt } : {},
        cursors: ownStates.map(state => state.name),
      }
    })
  }

  /** 开关监听。关掉之后不会再产生触发。 */
  async setEnabled(id: string, enabled: boolean): Promise<void> {
    await this.db.updateTable('channel').set({ enabled: enabled ? 1 : 0 }).where('id', '=', id).execute()
  }
}

/** 渠道下的账号。`bot` 在渠道里说话，`admin` 是允许派活的人。 */
export class ChannelAccount extends Model<DB, 'channel_account'> {
  constructor(db: Kysely<DB>) {
    super(db, 'channel_account', 'id')
  }
}

/**
 * CI 观察点。**每个被观察的目标一行**，记录上次的指纹。
 *
 * 一次 CI 运行会产生几十次状态变化，只有「和上次比变了」才发触发；
 * 没有这份记忆就没法比。
 */
export class CiWatch extends Model<DB, 'ci_watch'> {
  constructor(db: Kysely<DB>) {
    super(db, 'ci_watch', 'id')
  }
}

/**
 * 渠道读到哪了。进程重启后靠它接着读，不从头重读历史。
 *
 * 这是运行状态，不是配置 —— 所以不放进 `setting`。
 */
export class SourceState extends Model<DB, 'source_state'> {
  constructor(db: Kysely<DB>) {
    super(db, 'source_state', 'channelId')
  }
}
