/**
 * 数据库入口。
 *
 * **不引 `kysely/migration`** —— 宿主加载插件时解析不到这个子路径
 * （`kysely` 0.29 的 `exports` 里虽然有 `./migration`，但宿主外置解析只认主入口），
 * 结果是整个插件激活失败、面板根本不出现。
 *
 * 建表直接用 `prisma migrate diff` 产出的 SQL，`CREATE TABLE IF NOT EXISTS`
 * 天然幂等，启动时跑一遍即可。
 */

import type { DB } from './types'
import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { NodeSqliteDialect } from '@fileshed/kysely-node-sqlite'
import { Kysely } from 'kysely'
import { Channel, ChannelAccount, CiWatch, SourceState } from './models/channel'
import { Inbox } from './models/inbox'
import { Project } from './models/project'
import { Setting } from './models/setting'
import { Supervisor, SupervisorTicket } from './models/supervisor'
import { Thread, Trigger } from './models/thread'
import { Ticket, TicketLink, TicketThread } from './models/ticket'
import { Worker } from './models/worker'
import { SCHEMA_SQL } from './schema'

/**
 * 库文件位置。
 *
 * **不能用相对路径。** 宿主的工作目录是 profile 目录，插件被 require 的时机
 * 又和 `apply()` 不同，相对路径会解析到两个不同的文件 —— 结果是建表建在一个库、
 * 查询查另一个库，报 `no such table`。
 */
const DATA_DIR = join(homedir(), '.dsh', 'nexus')
mkdirSync(DATA_DIR, { recursive: true })
const DATA_FILE = join(DATA_DIR, 'nexus.db')

const sqlite = new DatabaseSync(DATA_FILE)

// 建表是幂等的：每个语句都是 IF NOT EXISTS。
// 逐行去掉 `--` 注释再按 `;` 切 —— 整段判断开头不够，注释行会留在语句内部。
const statements = SCHEMA_SQL
  .split('\n')
  .filter(line => !line.trimStart().startsWith('--'))
  .join('\n')
  .split(';')
  .map(statement => statement.trim())
  .filter(Boolean)

for (const statement of statements) sqlite.exec(`${statement};`)

const connection = new Kysely<DB>({ dialect: new NodeSqliteDialect({ database: sqlite }) })

/**
 * 一个连接 + 每张表一个 model。
 *
 * model 只包 CRUD 与「这张表自己的查询」；跨表组装放在需要它的那个 model 上
 * （例如 `ticket.board()` 自己取项目名和渠道名），不在路由层拼 SQL。
 */
export const db = Object.assign(connection, {
  channel: new Channel(connection),
  channelAccount: new ChannelAccount(connection),
  ciWatch: new CiWatch(connection),
  sourceState: new SourceState(connection),
  project: new Project(connection),
  thread: new Thread(connection),
  trigger: new Trigger(connection),
  ticket: new Ticket(connection),
  ticketThread: new TicketThread(connection),
  ticketLink: new TicketLink(connection),
  worker: new Worker(connection),
  inbox: new Inbox(connection),
  supervisor: new Supervisor(connection),
  supervisorTicket: new SupervisorTicket(connection),
  setting: new Setting(connection),
})
