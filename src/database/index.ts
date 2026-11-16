import { mkdir } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { migrations } from './migrations'

export class LedgerError extends Error {
  constructor(public readonly code: string, message = code, options?: ErrorOptions) {
    super(message, options)
  }
}

export interface NexusDatabase {
  readonly connection: DatabaseSync
  readonly stateDirectory: string
  readonly initialized: boolean
  close: () => void
}

export async function openDatabase(stateDirectory: string): Promise<NexusDatabase> {
  if (!isAbsolute(stateDirectory))
    throw new LedgerError('invalid_config', 'stateDirectory must be absolute')
  let connection: DatabaseSync
  try {
    await mkdir(stateDirectory, { recursive: true })
    connection = new DatabaseSync(join(stateDirectory, 'data.db'))
  }
  catch (cause) {
    throw new LedgerError('unavailable', 'Cannot open Nexus database', { cause })
  }
  try {
    connection.exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE')
    connection.exec('CREATE TABLE IF NOT EXISTS kysely_migration (name TEXT PRIMARY KEY NOT NULL, timestamp TEXT NOT NULL)')
    const applied = connection.prepare('SELECT name FROM kysely_migration').all().map(row => row.name)
    if (!applied.length && connection.prepare('SELECT name FROM sqlite_master WHERE type = \'table\' AND name = \'project\'').get()) {
      const baseline = new DatabaseSync(':memory:')
      try {
        baseline.exec(migrations['20261113135519'])
        const tables = baseline.prepare('SELECT name FROM sqlite_master WHERE type = \'table\'').all()
        for (const table of tables) {
          const name = String(table.name)
          const expected = baseline.prepare(`PRAGMA table_info("${name}")`).all()
          const actual = connection.prepare(`PRAGMA table_info("${name}")`).all()
          if (JSON.stringify(actual) !== JSON.stringify(expected))
            throw new LedgerError('migration_failed', `Unrecognized baseline structure: ${name}`)
        }
        connection.prepare('INSERT INTO kysely_migration VALUES (?, ?)').run('20261113135519', new Date().toISOString())
        applied.push('20261113135519')
      }
      finally {
        baseline.close()
      }
    }
    for (const name of applied) {
      if (!(String(name) in migrations))
        throw new LedgerError('migration_failed', 'Unknown migration version')
    }
    for (const [name, sql] of Object.entries(migrations).sort(([a], [b]) => a.localeCompare(b))) {
      if (!applied.includes(name)) {
        connection.exec(sql)
        connection.prepare('INSERT INTO kysely_migration VALUES (?, ?)').run(name, new Date().toISOString())
      }
    }
    if (connection.prepare('PRAGMA foreign_key_check').all().length)
      throw new LedgerError('migration_failed', 'Foreign key check failed')
    connection.exec('COMMIT; PRAGMA foreign_keys=ON')
  }
  catch (cause) {
    if (connection.isTransaction)
      connection.exec('ROLLBACK')
    connection.close()
    throw new LedgerError('migration_failed', 'Nexus database remains uninitialized', { cause })
  }
  let initialized = true
  return {
    connection,
    stateDirectory,
    get initialized() { return initialized },
    close() {
      connection.close()
      initialized = false
    },
  }
}

export function requireDatabase(database: NexusDatabase | undefined): DatabaseSync {
  if (!database?.initialized)
    throw new LedgerError('not_initialized')
  return database.connection
}

export function transaction<T>(database: NexusDatabase, operation: () => T): T {
  const connection = requireDatabase(database)
  connection.exec('BEGIN IMMEDIATE')
  try {
    const result = operation()
    connection.exec('COMMIT')
    return result
  }
  catch (error) {
    connection.exec('ROLLBACK')
    throw error
  }
}
