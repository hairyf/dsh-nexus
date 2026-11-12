/* eslint-disable antfu/no-top-level-await */
import type { DB } from './types'
import { DatabaseSync } from 'node:sqlite'
import { NodeSqliteDialect } from '@fileshed/kysely-node-sqlite'
import { Kysely } from 'kysely'
import { SqlMigrationProvider } from 'kysely-migrate-sql'
import { Migrator } from 'kysely/migration'
import { Thread } from './models/thread'

const migrations: Record<string, string> = {

}

const connection = new Kysely<DB>({
  dialect: new NodeSqliteDialect({ database: new DatabaseSync('data.db') }),
})

export const db = Object.assign(connection, {
  thread: new Thread(connection),
})

const provider = new SqlMigrationProvider({ migrations }) as any
const migrator = new Migrator({ db, provider })
await migrator.migrateToLatest()
