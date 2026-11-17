import type { NexusDatabase } from '../src/database'
import type { Actor } from '../src/types/ledger'
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
    + 'INSERT INTO worker (id, ticketId, status, createdAt, startedAt, endedAt) VALUES (\'ended-worker\', \'T2\', \'ended\', \'old\', \'2026-11-13T00:00:00Z\', \'2026-11-13T00:30:00Z\');'
    + 'INSERT INTO supervisor (id, title, reason, createdAt) VALUES (\'S1\', \'Coordinator\', \'Cross project\', \'old\');'
    + 'INSERT INTO supervisor_ticket VALUES (\'S1\', \'T1\', \'old\');'
    + 'INSERT INTO inbox (id, seq, type, projectId, origin, kind, message, createdAt, ticketId, triggerId, threadId, workerId) VALUES (\'ask-old\', 1, \'project\', \'P1\', \'worker\', \'ask\', \'Old pending question\', \'old\', \'T1\', \'trigger1\', \'thread1\', \'old-worker\');'
    + 'UPDATE inbox SET escalations = 2, lastEscalatedAt = \'2026-11-13T01:00:00Z\' WHERE id = \'ask-old\';'
    + 'INSERT INTO inbox (id, seq, type, projectId, origin, kind, title, message, createdAt, ticketId, triggerId, threadId) VALUES (\'trigger-message-old\', 3, \'project\', \'P1\', \'channel\', \'trigger\', \'Original trigger title\', \'Original trigger message\', \'old\', \'T1\', \'trigger1\', \'thread1\');'
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
  expect(ledger.list(database, 'worker')).toHaveLength(2)
  expect(ledger.load(database, 'worker', 'old-worker')).toMatchObject({ ticketId: 'T1', status: 'running', branch: 'old/branch', worktree: '/old/worktree' })
  expect(ledger.load(database, 'role_binding', 'migrated:worker:ended-worker')).toMatchObject({ status: 'closed', startedAt: '2026-11-13T00:00:00Z', closedAt: '2026-11-13T00:30:00Z' })
  expect(ledger.list(database, 'supervisor_ticket')).toEqual([{ supervisorId: 'S1', ticketId: 'T1', createdAt: 'old' }])
  expect(ledger.load(database, 'ask', 'ask-old')).toMatchObject({ id: 'ask-old', status: 'pending', handler: 'human', content: 'Old pending question', verified: 0 })
  expect(JSON.parse(ledger.load(database, 'ask', 'ask-old')!.source)).toEqual({ inboxId: 'ask-old', triggerId: 'trigger1', threadId: 'thread1', workerId: 'old-worker', previousHandler: 'project', origin: 'worker' })
  expect(ledger.load(database, 'ask', 'answered-old')).toMatchObject({ status: 'answered', answer: 'yes', answerActor: null, answerSource: 'user', verified: 0 })
  expect(ledger.list(database, 'acceptance')).toEqual([])
  expect(ledger.list(database, 'message')).toHaveLength(3)
  expect(ledger.load(database, 'message', 'trigger-message-old')).toMatchObject({ triggerId: 'trigger1', threadId: 'thread1', title: 'Original trigger title', content: 'Original trigger message' })
  expect(JSON.parse(ledger.load(database, 'message', 'trigger-message-old')!.source!)).toMatchObject({ inboxId: 'trigger-message-old', origin: 'channel', projectId: 'P1', triggerId: 'trigger1', threadId: 'thread1', title: 'Original trigger title' })
  expect(ledger.load(database, 'ask', 'ask-old')).toMatchObject({ escalations: 2, lastEscalatedAt: '2026-11-13T01:00:00Z' })
  expect(ledger.load(database, 'thread', 'thread1')).toMatchObject({ repository: null, attentionReason: 'repository_identity_unverified' })
  expect(() => ledger.triageThread(database, 'thread1', 'P1', 'claimed', { kind: 'web', authenticated: true, userId: 'host-user' })).toThrow('repository_identity_unverified')
  expect(ledger.load(database, 'message', 'ask-old')).toMatchObject({ readAt: null, handledAt: null, deliveryState: 'failed', error: 'recipient_binding_requires_verification' })
  expect(ledger.load(database, 'role_binding', 'migrated:worker:old-worker')).toMatchObject({ sessionId: 'old-worker', ticketId: 'T1', status: 'unavailable', startedAt: null, activeKey: 'worker:T1', worktree: '/old/worktree', recoveryReason: 'migration_requires_session_verification' })
  expect(() => ledger.advanceTicket(database, 'T1', 'ready', { kind: 'web', authenticated: true, userId: 'host-user' }, '', 'migrated:worker:old-worker')).toThrow('execution_not_started')
  expect(ledger.load(database, 'message', 'answered-old')).toMatchObject({ deliveryState: 'superseded', readAt: null, handledAt: null })
  expect(database.connection.prepare('SELECT count(*) AS count FROM sqlite_master WHERE type = \'table\' AND name = \'inbox\'').get()).toEqual({ count: 0 })
  expect(database.connection.prepare('PRAGMA foreign_key_check').all()).toEqual([])
  expect(database.connection.prepare('PRAGMA integrity_check').get()).toEqual({ integrity_check: 'ok' })
  database.close()
  const reopened = await open()
  expect(ledger.list(reopened, 'ticket')).toHaveLength(3)
  expect(ledger.list(reopened, 'ask')).toHaveLength(2)
  expect(reopened.connection.prepare('SELECT count(*) AS count FROM kysely_migration').get()).toEqual({ count: 4 })
})

it('produces the same actual schema from empty installation and old baseline upgrade', async () => {
  const old = baseline()
  history(old)
  old.close()
  const upgraded = await open()
  const fresh = await open(join(directory, 'fresh'))
  const schema = (database: NexusDatabase) => database.connection.prepare('SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE \'sqlite_%\' ORDER BY name').all().map(row => ({ ...row, sql: typeof row.sql === 'string' ? row.sql.replaceAll('\r\n', '\n') : row.sql }))
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

async function verifiedLegacyExecution(startedAt: string | null, options: { ended?: boolean, merged?: boolean, ambiguous?: boolean, conflicting?: boolean, conflictStatus?: 'running' | 'queued' | 'waiting', absentMetadata?: boolean } = {}) {
  const old = baseline()
  old.exec('INSERT INTO channel (id, name, createdAt) VALUES (\'legacy-channel\', \'GitHub\', \'old\'); INSERT INTO project (id, channelId, name, workspaceId, directory, createdAt, updatedAt) VALUES (\'legacy-p\', \'legacy-channel\', \'Repo\', \'legacy-workspace\', \'/legacy/repo\', \'old\', \'old\'); INSERT INTO setting (id, updatedAt) VALUES (\'global\', \'old\')')
  old.prepare('INSERT INTO ticket (id, projectId, channelId, title, status, createdAt, updatedAt, startedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('legacy-T', 'legacy-p', 'legacy-channel', 'Historical work', 'running', 'old', 'old', startedAt)
  old.prepare('INSERT INTO worker (id, ticketId, status, createdAt, startedAt, worktree, branch) VALUES (?, ?, ?, ?, ?, ?, ?)').run('legacy-worker', 'legacy-T', 'running', 'old', startedAt, '/legacy/worktree', 'legacy/branch')
  if (options.ended || options.merged || options.ambiguous)
    old.exec('UPDATE worker SET status = \'ended\', endedAt = \'2026-11-13T00:30:00Z\' WHERE id = \'legacy-worker\'')
  if (options.merged)
    old.exec('UPDATE ticket SET status = \'review\', prState = \'merged\', prUrl = \'https://github.com/org/legacy/pull/1\' WHERE id = \'legacy-T\'')
  if (options.conflicting)
    old.exec('UPDATE ticket SET status = \'running\' WHERE id = \'legacy-T\'')
  if (options.conflictStatus)
    old.prepare('UPDATE ticket SET status = ? WHERE id = ?').run(options.conflictStatus, 'legacy-T')
  if (options.absentMetadata)
    old.exec('UPDATE worker SET worktree = NULL, branch = NULL WHERE id = \'legacy-worker\'')
  if (options.ambiguous) {
    old.exec('INSERT INTO worker (id, ticketId, status, createdAt, endedAt) VALUES (\'other-ended-worker\', \'legacy-T\', \'ended\', \'old\', \'2026-11-13T00:20:00Z\'); INSERT INTO ticket (id, projectId, channelId, title, status, createdAt, updatedAt) VALUES (\'unrelated-T\', \'legacy-p\', \'legacy-channel\', \'Other work\', \'review\', \'old\', \'old\'); INSERT INTO worker (id, ticketId, status, createdAt, endedAt) VALUES (\'unrelated-worker\', \'unrelated-T\', \'ended\', \'old\', \'2026-11-13T00:10:00Z\')')
  }
  old.exec('INSERT INTO inbox (id, seq, type, projectId, origin, kind, message, createdAt, ticketId, workerId) VALUES (\'legacy-question\', 1, \'project\', \'legacy-p\', \'worker\', \'ask\', \'Pending before restart\', \'old\', \'legacy-T\', \'legacy-worker\')')
  old.close()
  const database = await open()
  const human: Actor = { kind: 'web', authenticated: true, userId: 'host-user' }
  ledger.createProject(database, { id: 'legacy-p', name: 'Repo', workspaceId: 'legacy-workspace', directory: '/legacy/repo', remoteUrl: 'https://github.com/org/legacy', available: true })
  ledger.updateProject(database, 'legacy-p', true, human)
  ledger.authorizeTicket(database, 'legacy-T', 'Reconfirmed scope', 'Verified regression passes', 'Human reauthorized historical work', human)
  ledger.cancelAsk(database, 'legacy-question', 'Historical question resolved by explicit management decision', human)
  ledger.bindRole(database, { id: 'legacy-project', role: 'project', projectId: 'legacy-p', sessionId: 'legacy-project-session' })
  const actor: Actor = { kind: 'agent', sessionId: 'legacy-project-session' }
  return { database, actor, bindingId: 'migrated:worker:legacy-worker' }
}

it.each([false, true])('reconciles an unknown-start historical execution after verified termination and retries without inventing a start (alreadyClosed=%s)', async (alreadyClosed) => {
  const { database, actor, bindingId } = await verifiedLegacyExecution(null)
  expect(() => ledger.recoverTicket(database, 'legacy-T', bindingId, 'Cannot invent a historical start', actor)).toThrow('execution_not_started')
  if (alreadyClosed)
    ledger.updateBinding(database, bindingId, 'closed', 'Old session termination already verified')
  expect(ledger.confirmExecutionStopped(database, 'legacy-T', bindingId, 'Confirmed old session no longer exists', actor)).toMatchObject({ status: 'waiting', failureBindingId: bindingId })
  expect(ledger.load(database, 'role_binding', bindingId)).toMatchObject({ status: 'closed', startedAt: null })
  expect(ledger.retryTicket(database, 'legacy-T', 'Authorized clean retry after reconciliation', actor)).toMatchObject({ status: 'queued', authorization: 'Reconfirmed scope' })
  ledger.bindRole(database, { id: 'fresh-legacy-worker', role: 'worker', sessionId: 'fresh-legacy-session', ticketId: 'legacy-T', projectId: 'legacy-p', repository: 'github.com/org/legacy', branch: 'retry/legacy', worktree: join(directory, 'fresh-worktree'), previousBindingId: bindingId }, actor)
  expect(ledger.startTicket(database, 'legacy-T', 'fresh-legacy-worker', actor)).toMatchObject({ status: 'running', executionBindingId: 'fresh-legacy-worker' })
  expect(ledger.load(database, 'role_binding', 'fresh-legacy-worker')).toMatchObject({ startedAt: expect.any(String) })
  expect(ledger.load(database, 'role_binding', bindingId)).toMatchObject({ startedAt: null })
  expect(ledger.list(database, 'ticket_transition').map(item => item.event)).toEqual(['execution_stopped', 'retry', 'start'])
})

it('records verified legacy execution metadata and recovers a genuinely started session without replacing its timestamp', async () => {
  const startedAt = '2026-11-13T00:00:00Z'
  const { database, actor, bindingId } = await verifiedLegacyExecution(startedAt)
  expect(() => ledger.recoverTicket(database, 'legacy-T', bindingId, 'Metadata not verified yet', actor)).toThrow('scope_denied')
  const metadata = { repository: 'github.com/org/legacy', worktree: '/verified/legacy-worktree', branch: 'legacy/branch' }
  const human: Actor = { kind: 'web', authenticated: true, userId: 'host-user' }
  ledger.createProject(database, { id: 'foreign-p', name: 'Foreign', workspaceId: 'foreign-workspace', directory: '/foreign', remoteUrl: 'https://github.com/org/foreign', available: true })
  ledger.updateProject(database, 'foreign-p', true, human)
  ledger.bindRole(database, { id: 'foreign-project', role: 'project', projectId: 'foreign-p', sessionId: 'foreign-project-session' })
  const foreign: Actor = { kind: 'agent', sessionId: 'foreign-project-session' }
  const before = ledger.load(database, 'role_binding', bindingId)
  expect(() => ledger.verifyExecutionMetadata(database, 'legacy-T', bindingId, metadata, 'Wrong owner', foreign)).toThrow('scope_denied')
  expect(() => ledger.confirmExecutionStopped(database, 'legacy-T', bindingId, 'Wrong owner', foreign)).toThrow('scope_denied')
  expect(() => ledger.verifyExecutionMetadata(database, 'legacy-T', bindingId, { ...metadata, repository: 'github.com/org/foreign' }, 'Wrong repository', actor)).toThrow('scope_denied')
  expect(ledger.load(database, 'role_binding', bindingId)).toEqual(before)
  expect(ledger.list(database, 'ticket_transition')).toEqual([])
  expect(ledger.verifyExecutionMetadata(database, 'legacy-T', bindingId, metadata, 'Verified DSH session and repository ownership', actor)).toMatchObject({ ...metadata, startedAt, status: 'unavailable' })
  expect(ledger.recoverTicket(database, 'legacy-T', bindingId, 'Verified existing session is resumable', actor)).toMatchObject({ status: 'running', executionBindingId: bindingId, startedAt })
  expect(ledger.load(database, 'role_binding', bindingId)).toMatchObject({ status: 'running', startedAt })
  expect(ledger.list(database, 'ticket_transition').map(item => item.event)).toEqual(['verify_execution', 'recover'])
})

it.each([null, '2026-11-13T00:00:00Z'])('preserves the sole already-ended historical binding and retries it without inventing its start (%s)', async (startedAt) => {
  const { database, actor, bindingId } = await verifiedLegacyExecution(startedAt, { ended: true })
  expect(ledger.load(database, 'ticket', 'legacy-T')).toMatchObject({ status: 'running', executionBindingId: bindingId })
  expect(ledger.load(database, 'role_binding', bindingId)).toMatchObject({ status: 'closed', startedAt })
  expect(ledger.confirmExecutionStopped(database, 'legacy-T', bindingId, 'Verified historical session ended', actor)).toMatchObject({ status: 'waiting', executionAttention: null })
  ledger.retryTicket(database, 'legacy-T', 'Authorized retry of unfinished legacy work', actor)
  ledger.bindRole(database, { id: 'new-ended-retry', role: 'worker', sessionId: 'new-ended-retry-session', ticketId: 'legacy-T', projectId: 'legacy-p', repository: 'github.com/org/legacy', worktree: join(directory, 'retry'), branch: 'retry/ended', previousBindingId: bindingId }, actor)
  expect(ledger.startTicket(database, 'legacy-T', 'new-ended-retry', actor)).toMatchObject({ status: 'running', executionBindingId: 'new-ended-retry' })
  expect(ledger.load(database, 'role_binding', bindingId)).toMatchObject({ startedAt })
})

it.each([null, '2026-11-13T00:00:00Z'])('verifies an already-merged review ticket with a closed historical binding without inventing a start or replaying a merge (%s)', async (startedAt) => {
  const { database, actor, bindingId } = await verifiedLegacyExecution(startedAt, { ended: true, merged: true })
  const human: Actor = { kind: 'web', authenticated: true, userId: 'host-user' }
  const target = { repository: 'github.com/org/legacy', pullRequest: 'https://github.com/org/legacy/pull/1', base: 'main', head: 'verified-merged-head' }
  expect(ledger.load(database, 'ticket', 'legacy-T')).toMatchObject({ executionBindingId: bindingId, status: 'review', prState: 'merged' })
  ledger.verifyExecutionMetadata(database, 'legacy-T', bindingId, { repository: target.repository, worktree: '/verified/legacy', branch: 'legacy/branch' }, 'Verified historical repository', actor)
  expect(ledger.setDeliveryTarget(database, 'legacy-T', target, actor)).toMatchObject({ prState: 'merged' })
  ledger.recordPullRequest(database, 'legacy-T', target, 'merged')
  ledger.recordAcceptance(database, { id: 'legacy-acceptance', ticketId: 'legacy-T', executionBindingId: bindingId, scope: 'Existing merged delivery', basis: 'Provider head and acceptance criteria verified now', evidence: ['Verified merged head and passing regression'], verdict: 'accepted' }, actor)
  const question = ledger.createAsk(database, { id: 'legacy-delivery', ticketIds: ['legacy-T'], source: 'verified-provider-merged', content: 'Confirm already merged delivery', decisionType: 'merge', withinAuthorization: true, options: ['allow_merge', 'deny_merge'], target }, actor)
  expect(() => ledger.advanceTicket(database, 'legacy-T', 'complete', actor)).toThrow('delivery_decision_required')
  ledger.answerAsk(database, { askId: question.id, policyBasis: question.policyBasis, answer: 'allow_merge', target, verified: true }, human)
  expect(ledger.resolveMerge(database, question.id, target, true)).toBe(false)
  expect(ledger.advanceTicket(database, 'legacy-T', 'complete', actor)).toMatchObject({ status: 'done', prState: 'merged' })
  expect(ledger.load(database, 'role_binding', bindingId)).toMatchObject({ status: 'closed', startedAt })
  expect(ledger.list(database, 'ticket_transition').some(item => item.event === 'start' || item.event === 'recover')).toBe(false)
})

it('keeps multiple ended candidates manual and reconciles only a matching historical closed binding', async () => {
  const { database, actor, bindingId } = await verifiedLegacyExecution(null, { ended: true, ambiguous: true })
  const metadata = { repository: 'github.com/org/legacy', worktree: '/verified/legacy', branch: 'legacy/branch' }
  expect(ledger.resolveTicket(database, 'legacy-T')).toMatchObject({ ticket: { executionBindingId: null, executionAttention: 'legacy_execution_ambiguous' }, reasons: ['legacy_execution_ambiguous'] })
  const before = ledger.list(database, 'ticket_transition')
  expect(() => ledger.verifyExecutionMetadata(database, 'legacy-T', 'migrated:worker:unrelated-worker', metadata, 'Wrong ticket candidate', actor)).toThrow('scope_denied')
  expect(() => ledger.verifyExecutionMetadata(database, 'legacy-T', bindingId, { ...metadata, repository: 'github.com/foreign/repo' }, 'Wrong repository', actor)).toThrow('scope_denied')
  expect(ledger.list(database, 'ticket_transition')).toEqual(before)
  expect(ledger.load(database, 'ticket', 'legacy-T')).toMatchObject({ executionBindingId: null, executionAttention: 'legacy_execution_ambiguous' })
  expect(ledger.verifyExecutionMetadata(database, 'legacy-T', bindingId, metadata, 'Verified this historical candidate belongs to the current work', actor)).toMatchObject({ id: bindingId, ...metadata })
  expect(ledger.load(database, 'ticket', 'legacy-T')).toMatchObject({ executionBindingId: bindingId, executionAttention: null })
  expect(ledger.load(database, 'role_binding', bindingId)).toMatchObject({ startedAt: null, status: 'closed', repository: metadata.repository })
  ledger.confirmExecutionStopped(database, 'legacy-T', bindingId, 'Confirmed selected historical execution stopped', actor)
  ledger.retryTicket(database, 'legacy-T', 'Authorized retry after manual reconciliation', actor)
  ledger.bindRole(database, { id: 'reconciled-new', role: 'worker', sessionId: 'reconciled-new-session', ticketId: 'legacy-T', projectId: 'legacy-p', repository: metadata.repository, worktree: join(directory, 'reconciled'), branch: 'retry/reconciled' }, actor)
  expect(ledger.startTicket(database, 'legacy-T', 'reconciled-new', actor)).toMatchObject({ status: 'running' })
  expect(ledger.list(database, 'ticket_transition').filter(item => item.event === 'verify_execution')).toMatchObject([{ bindingId }])
})

it('keeps a conflicting historical running-and-merged state manual until audited reconciliation', async () => {
  const { database, actor, bindingId } = await verifiedLegacyExecution(null, { ended: true, merged: true, conflicting: true })
  expect(ledger.load(database, 'ticket', 'legacy-T')).toMatchObject({ status: 'running', prState: 'merged', executionBindingId: bindingId, executionAttention: 'legacy_delivery_requires_reconciliation' })
  expect(() => ledger.dispatchTicket(database, 'legacy-T', actor)).toThrow('execution_reconciliation_required')
  const metadata = { repository: 'github.com/org/legacy', worktree: '/verified/legacy', branch: 'legacy/branch' }
  ledger.verifyExecutionMetadata(database, 'legacy-T', bindingId, metadata, 'Verified historical merge needs current delivery judgment', actor)
  expect(ledger.load(database, 'ticket', 'legacy-T')).toMatchObject({ status: 'review', prState: 'merged', executionAttention: null })
  expect(() => ledger.advanceTicket(database, 'legacy-T', 'complete', actor)).toThrow('acceptance_evidence_required')
  expect(ledger.load(database, 'role_binding', bindingId)).toMatchObject({ status: 'closed', startedAt: null })
})

function verifyMergedLegacyDelivery(database: NexusDatabase, actor: Actor, bindingId: string) {
  const target = { repository: 'github.com/org/legacy', pullRequest: 'https://github.com/org/legacy/pull/1', base: 'main', head: 'verified-merged-head' }
  ledger.verifyExecutionMetadata(database, 'legacy-T', bindingId, { repository: target.repository, worktree: '/verified/legacy', branch: 'legacy/branch' }, 'Verified current execution repository and worktree', actor)
  ledger.setDeliveryTarget(database, 'legacy-T', target, actor)
  ledger.recordPullRequest(database, 'legacy-T', target, 'merged')
  ledger.recordAcceptance(database, { id: 'current-legacy-evidence', ticketId: 'legacy-T', executionBindingId: bindingId, scope: 'Existing merged delivery', basis: 'Current provider head and criteria verified', evidence: ['Current regression passes'], verdict: 'accepted' }, actor)
  return target
}

it.each(['running', 'queued', 'waiting'] as const)('preserves delivery reconciliation after confirming a historical %s execution stopped', async (conflictStatus) => {
  const { database, actor, bindingId } = await verifiedLegacyExecution(null, { ended: true, merged: true, conflictStatus })
  const human: Actor = { kind: 'web', authenticated: true, userId: 'host-user' }
  expect(ledger.confirmExecutionStopped(database, 'legacy-T', bindingId, 'Observed historical execution is stopped', actor)).toMatchObject({ status: 'review', prState: 'merged', executionAttention: 'legacy_delivery_requires_reconciliation', failureReason: null })
  const before = ledger.load(database, 'ticket', 'legacy-T')
  const audit = ledger.list(database, 'ticket_transition')
  expect(() => ledger.retryTicket(database, 'legacy-T', 'Cannot erase pending delivery', actor)).toThrow('execution_reconciliation_required')
  expect(() => ledger.dispatchTicket(database, 'legacy-T', actor)).toThrow('execution_reconciliation_required')
  expect(() => ledger.advanceTicket(database, 'legacy-T', 'complete', actor)).toThrow('execution_reconciliation_required')
  expect(ledger.load(database, 'ticket', 'legacy-T')).toEqual(before)
  expect(ledger.list(database, 'ticket_transition')).toEqual(audit)
  ledger.confirmExecutionStopped(database, 'legacy-T', bindingId, 'Repeated observation does not erase delivery attention', actor)
  const target = verifyMergedLegacyDelivery(database, actor, bindingId)
  const question = ledger.createAsk(database, { id: 'stopped-delivery', ticketIds: ['legacy-T'], source: 'provider:merged', content: 'Confirm verified external delivery', decisionType: 'merge', withinAuthorization: true, options: ['allow_merge', 'deny_merge'], target }, actor)
  ledger.answerAsk(database, { askId: question.id, policyBasis: question.policyBasis, answer: 'allow_merge', target, verified: true }, human)
  expect(ledger.advanceTicket(database, 'legacy-T', 'complete', actor)).toMatchObject({ status: 'done', prState: 'merged' })
  expect(ledger.load(database, 'role_binding', bindingId)).toMatchObject({ startedAt: null })
})

it('requires execution metadata for historical acceptance and delivery even when the real start time is present', async () => {
  const startedAt = '2026-11-13T00:00:00Z'
  const { database, actor, bindingId } = await verifiedLegacyExecution(startedAt, { ended: true, merged: true, absentMetadata: true })
  const target = { repository: 'github.com/org/legacy', pullRequest: 'https://github.com/org/legacy/pull/1', base: 'main', head: 'verified-merged-head' }
  ledger.setDeliveryTarget(database, 'legacy-T', target, actor)
  ledger.recordPullRequest(database, 'legacy-T', target, 'merged')
  expect(ledger.load(database, 'role_binding', bindingId)).toMatchObject({ startedAt, repository: null, worktree: null, branch: null })
  expect(() => ledger.recordAcceptance(database, { id: 'unverified-metadata', ticketId: 'legacy-T', executionBindingId: bindingId, scope: 'Existing delivery', basis: 'A start time is not repository proof', evidence: ['Claimed passing tests'], verdict: 'accepted' }, actor)).toThrow('execution_metadata_unverified')
  expect(() => ledger.createAsk(database, { id: 'unverified-delivery', ticketIds: ['legacy-T'], source: 'provider:merged', content: 'Cannot approve unverified execution metadata', decisionType: 'merge', withinAuthorization: true, options: ['allow_merge', 'deny_merge'], target }, actor)).toThrow('execution_metadata_unverified')
  expect(() => ledger.advanceTicket(database, 'legacy-T', 'complete', actor)).toThrow('execution_metadata_unverified')
  expect(ledger.list(database, 'acceptance')).toEqual([])
  expect(ledger.list(database, 'ticket_transition')).toEqual([])
  verifyMergedLegacyDelivery(database, actor, bindingId)
  expect(ledger.list(database, 'ticket_transition')).toMatchObject([{ event: 'verify_execution', bindingId }])
  expect(() => ledger.advanceTicket(database, 'legacy-T', 'complete', actor)).toThrow('delivery_decision_required')
  const question = ledger.createAsk(database, { id: 'verified-delivery', ticketIds: ['legacy-T'], source: 'provider:merged', content: 'Verify the known repository result', decisionType: 'merge', withinAuthorization: true, options: ['allow_merge', 'deny_merge'], target }, actor)
  ledger.answerAsk(database, { askId: question.id, policyBasis: question.policyBasis, answer: 'allow_merge', target, verified: true }, { kind: 'web', authenticated: true, userId: 'host-user' })
  expect(ledger.advanceTicket(database, 'legacy-T', 'complete', actor)).toMatchObject({ status: 'done' })
  expect(ledger.load(database, 'role_binding', bindingId)).toMatchObject({ startedAt })
})

it('uses the current explicit automatic merge policy for historical delivery without fabricating a human answer', async () => {
  const { database, actor, bindingId } = await verifiedLegacyExecution(null, { ended: true, merged: true })
  const human: Actor = { kind: 'web', authenticated: true, userId: 'host-user' }
  ledger.bindRole(database, { id: 'legacy-main', role: 'main', sessionId: 'legacy-main-session' })
  const main: Actor = { kind: 'agent', sessionId: 'legacy-main-session' }
  const target = verifyMergedLegacyDelivery(database, actor, bindingId)
  const question = ledger.createAsk(database, { id: 'policy-delivery', ticketIds: ['legacy-T'], source: 'provider:merged', content: 'Current delivery decision', decisionType: 'merge', withinAuthorization: true, options: ['allow_merge', 'deny_merge'], target }, actor)
  expect(question.handler).toBe('human')
  ledger.setPolicy(database, 'legacy-T', { questionLevel: 'detailed', mergePolicy: 'automatic_allowed' }, 'Human explicitly delegates this current merge decision', human)
  const rerouted = ledger.load(database, 'ask', question.id)!
  expect(rerouted).toMatchObject({ status: 'pending', handler: 'legacy-main', answer: null })
  expect(() => ledger.advanceTicket(database, 'legacy-T', 'complete', actor)).toThrow('delivery_decision_required')
  const settled = ledger.answerAsk(database, { askId: question.id, policyBasis: rerouted.policyBasis, answer: 'allow_merge', target, verified: true }, main)
  expect(JSON.parse(settled.answerActor!)).toEqual(main)
  expect(ledger.resolveMerge(database, question.id, target, true)).toBe(false)
  expect(ledger.advanceTicket(database, 'legacy-T', 'complete', actor)).toMatchObject({ status: 'done' })
})

it('invalidates a delegated historical delivery answer when the current policy is tightened before completion', async () => {
  const { database, actor, bindingId } = await verifiedLegacyExecution(null, { ended: true, merged: true })
  const human: Actor = { kind: 'web', authenticated: true, userId: 'host-user' }
  ledger.bindRole(database, { id: 'legacy-main', role: 'main', sessionId: 'legacy-main-session' })
  const main: Actor = { kind: 'agent', sessionId: 'legacy-main-session' }
  const target = verifyMergedLegacyDelivery(database, actor, bindingId)
  ledger.setPolicy(database, 'legacy-T', { questionLevel: 'detailed', mergePolicy: 'automatic_allowed' }, 'Human delegates current verification', human)
  const question = ledger.createAsk(database, { id: 'delegated-delivery', ticketIds: ['legacy-T'], source: 'provider:merged', content: 'Verify delivery', decisionType: 'merge', withinAuthorization: true, options: ['allow_merge', 'deny_merge'], target }, actor)
  ledger.answerAsk(database, { askId: question.id, policyBasis: question.policyBasis, answer: 'allow_merge', target, verified: true }, main)
  ledger.setPolicy(database, 'legacy-T', { questionLevel: 'detailed', mergePolicy: 'human_required' }, 'Human takes back the unfulfilled decision', human)
  expect(() => ledger.advanceTicket(database, 'legacy-T', 'complete', actor)).toThrow('delivery_decision_required')
  const fresh = ledger.createAsk(database, { id: 'human-delivery', ticketIds: ['legacy-T'], source: 'provider:merged', content: 'Current human decision required', decisionType: 'merge', withinAuthorization: true, options: ['allow_merge', 'deny_merge'], target }, actor)
  expect(() => ledger.answerAsk(database, { askId: fresh.id, policyBasis: fresh.policyBasis, answer: 'allow_merge', target, verified: true }, main)).toThrow('human_required')
  ledger.answerAsk(database, { askId: fresh.id, policyBasis: fresh.policyBasis, answer: 'allow_merge', target, verified: true }, human)
  expect(ledger.advanceTicket(database, 'legacy-T', 'complete', actor)).toMatchObject({ status: 'done' })
})

it('does not turn a preserved historical ended pointer into permission to add acceptance to a terminal ticket', async () => {
  const old = baseline()
  history(old)
  old.close()
  const database = await open()
  const human: Actor = { kind: 'web', authenticated: true, userId: 'host-user' }
  ledger.createProject(database, { id: 'P2', name: 'Repo 2', workspaceId: 'W2', directory: '/old/two', remoteUrl: 'https://github.com/org/repo-2', available: true })
  ledger.updateProject(database, 'P2', true, human)
  expect(ledger.load(database, 'ticket', 'T2')).toMatchObject({ status: 'done', executionBindingId: 'migrated:worker:ended-worker' })
  expect(() => ledger.recordAcceptance(database, { id: 'not-a-new-delivery', ticketId: 'T2', executionBindingId: 'migrated:worker:ended-worker', scope: 'Historical completion', evidence: ['A new claim about old history'], basis: 'Must not create a new-flow acceptance', verdict: 'accepted' }, human)).toThrow('ticket_closed')
  expect(ledger.list(database, 'acceptance')).toEqual([])
})

it('does not publish a no-ticket main ask through an unverified historical topic identity', async () => {
  const old = baseline()
  history(old)
  old.close()
  const database = await open()
  const human: Actor = { kind: 'web', authenticated: true, userId: 'host-user' }
  ledger.createProject(database, { id: 'P1', name: 'Repo', workspaceId: 'W1', directory: '/old/one', remoteUrl: 'https://github.com/org/repo', available: true })
  ledger.updateProject(database, 'P1', true, human)
  ledger.bindRole(database, { id: 'main', role: 'main', sessionId: 'verified-main-session' })
  const main: Actor = { kind: 'agent', sessionId: 'verified-main-session' }
  ledger.createAsk(database, { id: 'legacy-triage', ticketIds: [], source: 'thread1', content: 'Clarify historical source', decisionType: 'important', withinAuthorization: true, options: ['yes', 'no'] }, main)
  expect(() => ledger.publishMessage(database, 'ask:legacy-triage', 'thread1', main)).toThrow('repository_identity_unverified')
  expect(ledger.list(database, 'outbox')).toEqual([])
})

it('resolves the dataDir option under the supplied DSH home without reading a real user directory', () => {
  expect(resolveDataDirectory({}, directory)).toBe(join(directory, 'storages/nexus'))
  expect(resolveDataDirectory({}, directory, join(directory, 'profiles/test'))).toBe(join(directory, 'profiles/test/storages/nexus'))
  expect(resolveDataDirectory({ dataDir: join(directory, 'custom') }, directory)).toBe(join(directory, 'custom'))
  expect(() => resolveDataDirectory({ dataDir: './relative' }, directory)).toThrow('must be absolute')
})
