import type { NexusDatabase } from '../src/database'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { resolveDataDirectory } from '../src/config/paths'
import { openDatabase, requireDatabase } from '../src/database'
import { ledger } from '../src/service/ledger'

let directory: string
const opened: NexusDatabase[] = []
beforeEach(async () => {
  directory = join(import.meta.dirname, `../.temp/migration-${randomUUID()}`)
  await mkdir(directory, { recursive: true })
})
afterEach(async () => {
  for (const database of opened.splice(0)) {
    if (database.initialized)
      database.close()
  }
  await rm(directory, { recursive: true, force: true })
})
async function open(path = directory) {
  const database = await openDatabase(path)
  opened.push(database)
  return database
}
function baseline(withMetadata = false) {
  const connection = new DatabaseSync(join(directory, 'data.db'))
  connection.exec(readFileSync(new URL('../prisma/migrations/20261113135519/migration.sql', import.meta.url), 'utf8'))
  if (withMetadata)
    connection.exec('CREATE TABLE kysely_migration (name TEXT PRIMARY KEY NOT NULL, timestamp TEXT NOT NULL); INSERT INTO kysely_migration VALUES (\'20261113135519\', \'2026-11-13T00:00:00Z\')')
  return connection
}
function history(connection: DatabaseSync) {
  connection.exec(
    'INSERT INTO channel (id, name, createdAt) VALUES (\'github\', \'GitHub\', \'old\'), (\'other\', \'Other source\', \'old\');'
    + 'INSERT INTO project (id, channelId, name, workspaceId, directory, orchestratorSessionId, createdAt, updatedAt) VALUES (\'P1\', \'github\', \'same display name\', \'W1\', \'/old/one\', \'old-project-session\', \'old\', \'old\'), (\'P2\', \'other\', \'same display name\', \'W2\', \'/old/two\', NULL, \'old\', \'old\');'
    + 'INSERT INTO setting (id, autoMerge, autoMergeMaxLines, updatedAt) VALUES (\'global\', 1, 10000, \'old\');'
    + 'INSERT INTO ticket (id, projectId, channelId, title, status, createdAt, updatedAt) VALUES (\'T1\', \'P1\', \'github\', \'unfinished\', \'running\', \'old\', \'old\'), (\'T2\', \'P2\', \'other\', \'finished\', \'done\', \'old\', \'old\'), (\'T3\', \'P2\', \'other\', \'cancelled\', \'cancelled\', \'old\', \'old\');'
    + 'INSERT INTO thread (id, channelId, projectId, refId, kind, title, createdAt, updatedAt) VALUES (\'thread1\', \'github\', \'P1\', \'7\', \'issue\', \'Issue\', \'old\', \'old\');'
    + 'INSERT INTO trigger (id, channelId, threadId, kind, actorName, text, at) VALUES (\'trigger1\', \'github\', \'thread1\', \'comment\', \'Alice\', \'Question\', \'old\');'
    + 'INSERT INTO ticket_thread VALUES (\'T1\', \'thread1\', \'old\');'
    + 'INSERT INTO ticket_link VALUES (\'T1\', \'T3\', \'depends\', \'old\');'
    + 'INSERT INTO worker (id, ticketId, status, createdAt, worktree, branch) VALUES (\'old-worker\', \'T1\', \'running\', \'old\', \'/old/worktree\', \'old/branch\');'
    + 'INSERT INTO supervisor (id, title, reason, createdAt) VALUES (\'S1\', \'Coordinator\', \'Cross project\', \'old\');'
    + 'INSERT INTO supervisor_ticket VALUES (\'S1\', \'T1\', \'old\');'
    + 'INSERT INTO inbox (id, seq, type, projectId, origin, kind, message, createdAt, ticketId, triggerId, threadId, workerId) VALUES (\'ask-old\', 1, \'project\', \'P1\', \'worker\', \'ask\', \'Old pending question\', \'old\', \'T1\', \'trigger1\', \'thread1\', \'old-worker\');'
    + 'INSERT INTO inbox (id, seq, type, origin, kind, message, createdAt, status, answer, answeredBy, answeredAt) VALUES (\'answered-old\', 1, \'user\', \'main\', \'ask\', \'Old historical answer\', \'old\', \'done\', \'yes\', \'user\', \'old\');',
  )
}

it.each([false, true])('upgrades the real immutable baseline preserving history and refusing fabricated auto-merge rights (metadata=%s)', async (metadata) => {
  const old = baseline(metadata)
  history(old)
  old.close()
  const database = await open()
  expect(ledger.list(database, 'project')).toMatchObject([
    { id: 'P1', workspaceId: 'W1', orchestratorSessionId: 'old-project-session', repository: null, remoteUrl: null, enabled: 0, attentionReason: 'repository_identity_unverified', identityEvidence: '{"channelId":"github"}' },
    { id: 'P2', workspaceId: 'W2', repository: null, enabled: 0 },
  ])
  expect(ledger.getSettings(database)).toMatchObject({ defaultQuestionLevel: 'important', defaultMergePolicy: 'human_required', maxWorkers: 4, whitelist: '[]' })
  expect(ledger.load(database, 'ticket', 'T1')).toMatchObject({ status: 'running', questionLevel: 'important', mergePolicy: 'human_required', authorization: '' })
  expect(ledger.load(database, 'ticket', 'T2')).toMatchObject({ status: 'done' })
  expect(ledger.list(database, 'ticket_thread')).toEqual([{ ticketId: 'T1', threadId: 'thread1', createdAt: 'old' }])
  expect(ledger.list(database, 'ticket_link')).toMatchObject([{ ticketId: 'T1', relatedId: 'T3', satisfiedAt: null, wakeupId: null }])
  expect(ledger.list(database, 'worker')).toMatchObject([{ id: 'old-worker', ticketId: 'T1', status: 'running', branch: 'old/branch', worktree: '/old/worktree' }])
  expect(ledger.list(database, 'supervisor_ticket')).toEqual([{ supervisorId: 'S1', ticketId: 'T1', createdAt: 'old' }])
  expect(ledger.load(database, 'ask', 'ask-old')).toMatchObject({ id: 'ask-old', status: 'pending', handler: 'human', content: 'Old pending question', verified: 0 })
  expect(JSON.parse(ledger.load(database, 'ask', 'ask-old')!.source)).toEqual({ inboxId: 'ask-old', triggerId: 'trigger1', threadId: 'thread1', workerId: 'old-worker', previousHandler: 'project', origin: 'worker' })
  expect(ledger.load(database, 'ask', 'answered-old')).toMatchObject({ status: 'answered', answer: 'yes', answerActor: null, answerSource: 'user', verified: 0 })
  expect(ledger.list(database, 'acceptance')).toEqual([])
  expect(ledger.list(database, 'message')).toHaveLength(2)
  expect(ledger.load(database, 'message', 'ask-old')).toMatchObject({ readAt: null, handledAt: null, deliveryState: 'failed', error: 'recipient_binding_requires_verification' })
  expect(ledger.load(database, 'role_binding', 'migrated:worker:old-worker')).toMatchObject({ sessionId: 'old-worker', ticketId: 'T1', status: 'unavailable', activeKey: 'worker:T1', worktree: '/old/worktree', recoveryReason: 'migration_requires_session_verification' })
  expect(database.connection.prepare('SELECT count(*) AS count FROM sqlite_master WHERE type = \'table\' AND name = \'inbox\'').get()).toEqual({ count: 0 })
  expect(database.connection.prepare('PRAGMA foreign_key_check').all()).toEqual([])
  expect(database.connection.prepare('PRAGMA integrity_check').get()).toEqual({ integrity_check: 'ok' })
  database.close()
  const reopened = await open()
  expect(ledger.list(reopened, 'ticket')).toHaveLength(3)
  expect(ledger.list(reopened, 'ask')).toHaveLength(2)
  expect(reopened.connection.prepare('SELECT count(*) AS count FROM kysely_migration').get()).toEqual({ count: 2 })
})

it('produces the same actual schema from empty installation and old baseline upgrade', async () => {
  const old = baseline()
  history(old)
  old.close()
  const upgraded = await open()
  const fresh = await open(join(directory, 'fresh'))
  const schema = (database: NexusDatabase) => database.connection.prepare('SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE \'sqlite_%\' ORDER BY name').all()
  expect(schema(upgraded)).toEqual(schema(fresh))
  expect(ledger.getSettings(fresh)).toMatchObject({ maxWorkers: 4, defaultQuestionLevel: 'important', defaultMergePolicy: 'follow_question_level' })
})

it('rolls back the whole upgrade on a foreign-key failure and stays visibly uninitialized across restart', async () => {
  const old = baseline(true)
  history(old)
  old.exec('PRAGMA foreign_keys=OFF; INSERT INTO ticket_thread VALUES (\'missing-ticket\', \'thread1\', \'old\')')
  old.close()
  await expect(openDatabase(directory)).rejects.toMatchObject({ code: 'migration_failed' })
  const persisted = new DatabaseSync(join(directory, 'data.db'))
  expect(persisted.prepare('SELECT channelId FROM project WHERE id = ?').get('P1')).toEqual({ channelId: 'github' })
  expect(persisted.prepare('SELECT autoMerge FROM setting').get()).toEqual({ autoMerge: 1 })
  expect(persisted.prepare('SELECT count(*) AS count FROM kysely_migration').get()).toEqual({ count: 1 })
  expect(persisted.prepare('SELECT count(*) AS count FROM sqlite_master WHERE type=\'table\' AND name=\'ask\'').get()).toEqual({ count: 0 })
  persisted.close()
  await expect(openDatabase(directory)).rejects.toMatchObject({ code: 'migration_failed' })
  expect(() => requireDatabase(undefined)).toThrow('not_initialized')
})

it('distinguishes unavailable storage, relative config, future schema and closed handles', async () => {
  await expect(openDatabase('relative')).rejects.toMatchObject({ code: 'invalid_config' })
  const file = join(directory, 'not-a-directory')
  await writeFile(file, 'plain file')
  await expect(openDatabase(file)).rejects.toMatchObject({ code: 'unavailable' })
  const database = await open()
  database.connection.exec('INSERT INTO kysely_migration VALUES (\'future-schema\', \'now\')')
  database.close()
  expect(() => ledger.list(database, 'ticket')).toThrow('not_initialized')
  await expect(openDatabase(directory)).rejects.toMatchObject({ code: 'migration_failed' })
})

it('resolves the dataDir option under the supplied DSH home without reading a real user directory', () => {
  expect(resolveDataDirectory({}, directory)).toBe(join(directory, 'storages/nexus'))
  expect(resolveDataDirectory({}, directory, join(directory, 'profiles/test'))).toBe(join(directory, 'profiles/test/storages/nexus'))
  expect(resolveDataDirectory({ dataDir: join(directory, 'custom') }, directory)).toBe(join(directory, 'custom'))
  expect(() => resolveDataDirectory({ dataDir: './relative' }, directory)).toThrow('must be absolute')
})
