import type { NexusDatabase } from '../src/database'
import type { SessionGateway, SessionSnapshot } from '../src/runtime/types'
import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { openDatabase } from '../src/database'
import { communication } from '../src/service/communication'
import { ledger } from '../src/service/ledger'
import { mailbox } from '../src/service/mailbox'
import { runtime } from '../src/service/runtime'

let db: NexusDatabase
let directory: string
let run: ReturnType<typeof runtime.create>
let service: ReturnType<typeof communication.create>
let sessions: Map<string, SessionSnapshot>
let gateway: SessionGateway
let deliveries: { sessionId: string, message: { id: string, content: string }, mode: string }[]
let receipts: Map<string, 'queued' | 'read'>
const human = { kind: 'web', authenticated: true, userId: 'owner' } as const

beforeEach(async () => {
  directory = join(import.meta.dirname, '../.temp', `mailbox-${randomUUID()}`)
  db = await openDatabase(directory)
  sessions = new Map()
  deliveries = []
  receipts = new Map()
  gateway = {
    inspect: async id => sessions.get(id) ?? { state: 'missing' },
    create: async (id) => { sessions.set(id, { state: 'idle' }) },
    resume: async () => {},
    deliver: async (sessionId, message, mode) => {
      deliveries.push({ sessionId, message, mode })
      receipts.set(`${sessionId}:${message.id}`, 'queued')
    },
    receipt: async (id, messageId) => receipts.get(`${id}:${messageId}`) ?? 'absent',
    cancel: vi.fn(async () => {}),
    stop: async () => true,
  }
  run = runtime.create(db, gateway, { timeout: () => () => {} }, directory)
  await run.bind({ id: 'main', role: 'main', sessionId: 's-main' })
  ledger.createProject(db, { id: 'p', workspaceId: 'p', name: 'P', directory, remoteUrl: 'https://github.com/org/p', available: true })
  ledger.updateProject(db, 'p', true, human)
  await run.bind({ id: 'project', role: 'project', sessionId: 's-project', projectId: 'p' })
  service = communication.create(db, run)
})

afterEach(async () => {
  await run.dispose()
  db.close()
  await rm(directory, { recursive: true, force: true })
  vi.restoreAllMocks()
})

it('persists a generic envelope without any ticket, binding or business Message', () => {
  const input = { id: 'generic', recipient: 'agent:stable', sender: 'agent:other', kind: 'note', title: 'Hello', content: 'Review when free', askId: 'external-question' }
  expect(mailbox.save(db, input)).toMatchObject({ ...input, readAt: null, handledAt: null })
  expect(mailbox.save(db, input).seq).toBe(1)
  expect(ledger.list(db, 'message')).toEqual([])
  expect(ledger.list(db, 'inbox_message')).toEqual([])
  expect(() => mailbox.save(db, { ...input, content: 'Changed' })).toThrow('identity_conflict')
  expect(() => mailbox.save(db, { ...input, id: 'empty', content: ' ' })).toThrow('invalid_mail')
  expect(() => mailbox.handle(db, 'agent:other', 'generic')).toThrow('scope_denied')
  expect(() => mailbox.handle(db, input.recipient, 'generic')).toThrow('not_read')
  expect(mailbox.read(db, input.recipient)).toMatchObject([{ id: 'generic', readAt: expect.any(String), handledAt: null }])
  mailbox.handle(db, input.recipient, 'generic')
  expect(mailbox.list(db, input.recipient)).toEqual([])
  expect(mailbox.load(db, 'generic')).toMatchObject({ content: input.content, handledAt: expect.any(String) })
})

it('keeps internal messages and asks out of a running agent and emits one count notice after idle', async () => {
  sessions.set('s-project', { state: 'running' })
  const first = await service.sendMessage('s-main', 'first', { to: 'role:project', message: 'First body' })
  const second = await service.sendMessage('s-main', 'second', { to: 'role:project', message: 'Second body' })
  expect(first.delivery).toMatchObject({ state: 'pending' })
  expect(second.delivery).toMatchObject({ state: 'pending' })
  expect(deliveries).toEqual([])
  expect(gateway.cancel).not.toHaveBeenCalled()
  expect(await run.mailbox('s-project')).toMatchObject({ pendingCount: 2, messages: [{ content: 'First body' }, { content: 'Second body' }] })
  sessions.set('s-project', { state: 'idle' })
  await Promise.all([run.notifyMailbox('s-project'), run.notifyMailbox('s-project')])
  expect(deliveries).toHaveLength(1)
  expect(deliveries[0]).toMatchObject({ sessionId: 's-project', mode: 'wake' })
  expect(JSON.parse(deliveries[0].message.content)).toMatchObject({ kind: 'nexus_mailbox', pendingCount: 2 })
  expect(deliveries[0].message.content).not.toContain('First body')
  await run.notifyMailbox('s-project')
  expect(deliveries).toHaveLength(1)
  expect(ledger.list(db, 'inbox')).toHaveLength(2)
})

it('distinguishes a read-only UI snapshot, Agent reading and explicit handling', async () => {
  const letter = await service.sendMessage('s-main', 'read', { to: 'role:project', message: 'Read me' })
  expect((await run.mailbox('s-project')).messages[0]).toMatchObject({ id: letter.messageId, readAt: null, handledAt: null })
  const read = await service.readMailbox('s-project')
  expect(read).toMatchObject({ pendingCount: 1, messages: [{ readAt: expect.any(String), handledAt: null }] })
  await expect(run.handleMail('s-main', letter.messageId)).rejects.toMatchObject({ code: 'scope_denied' })
  await service.handleMail('s-project', letter.messageId)
  expect(await run.mailbox('s-project')).toMatchObject({ pendingCount: 0, messages: [] })
  expect(mailbox.load(db, letter.messageId)).toMatchObject({ content: 'Read me', handledAt: expect.any(String) })
  expect(db.connection.prepare('SELECT content, readAt, handledAt FROM message WHERE id = ?').get(letter.messageId)).toEqual({ content: '', readAt: null, handledAt: null })
})

it.each(['queued', 'read'] as const)('keeps the address and read state across archival and notifies the replacement after an old %s notice', async (receipt) => {
  const letter = await service.sendMessage('s-main', 'inherit', { to: 'role:project', message: 'Persistent body' })
  await service.readMailbox('s-project')
  receipts.set(`s-project:${deliveries[0].message.id}`, receipt)
  const original = mailbox.load(db, letter.messageId)!
  sessions.set('s-project', { state: 'closed', archived: true })
  ledger.updateBinding(db, 'project', 'closed', 'session_archived')
  expect(await run.mailbox('s-project')).toMatchObject({ active: false, pendingCount: 0, messages: [] })
  await run.bind({ id: 'project-next', role: 'project', sessionId: 's-next', projectId: 'p' })
  const inherited = await run.mailbox('s-next')
  expect(inherited).toMatchObject({ active: true, pendingCount: 1, messages: [{ id: letter.messageId, recipient: 'nexus:project:p', readAt: original.readAt }] })
  await run.notifyMailbox('s-next')
  expect(deliveries).toHaveLength(2)
  expect(deliveries[1]).toMatchObject({ sessionId: 's-next', mode: 'wake' })
  expect(mailbox.load(db, letter.messageId)!.recipient).toBe(original.recipient)
  expect(ledger.list(db, 'message')).toHaveLength(1)
  await expect(run.handleMail('s-project', letter.messageId)).rejects.toMatchObject({ code: 'closed_session' })
})

it('rejects a stale Agent mutation when archive closes its binding during session inspection', async () => {
  const letter = await service.sendMessage('s-main', 'race', { to: 'role:project', message: 'Do not consume from archived session' })
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<SessionSnapshot>()
  vi.spyOn(gateway, 'inspect').mockImplementationOnce(async () => {
    entered.resolve()
    return release.promise
  })
  const reading = run.readMailbox('s-project')
  await entered.promise
  ledger.updateBinding(db, 'project', 'closed', 'session_archived')
  release.resolve({ state: 'idle' })
  await expect(reading).rejects.toMatchObject({ code: 'closed_session' })
  expect(mailbox.load(db, letter.messageId)).toMatchObject({ readAt: null, handledAt: null })
})

it('returns an inactive mailbox for unbound, archived and helper sessions and never wakes them', async () => {
  expect(await run.mailbox('ordinary')).toMatchObject({ active: false, messages: [], pendingCount: 0 })
  mailbox.save(db, { id: 'archived', recipient: 'nexus:project:p', sender: 'external', kind: 'note', content: 'Keep this' })
  sessions.set('s-project', { state: 'idle', archived: true })
  expect(await run.mailbox('s-project')).toMatchObject({ active: false, messages: [] })
  await run.notifyMailbox('s-project')
  expect(deliveries).toEqual([])
  sessions.set('s-project', { state: 'idle', origin: 'subagent', parentSession: 'parent' })
  expect(await run.mailbox('s-project')).toMatchObject({ active: false, messages: [] })
  expect(mailbox.load(db, 'archived')).toMatchObject({ content: 'Keep this', handledAt: null })
})

it('keeps user input on the existing interrupt path while an internal letter waits in the mailbox', async () => {
  sessions.set('s-project', { state: 'running' })
  await service.sendMessage('s-main', 'internal', { to: 'role:project', message: 'Internal body' })
  await run.intake({ id: 'human', source: 'human:web', recipient: 'project', kind: 'human', content: 'User intervention' })
  expect(deliveries).toEqual([{ sessionId: 's-project', message: expect.objectContaining({ id: 'human', content: 'User intervention' }), mode: 'interrupt' }])
  expect(ledger.listMail(db, 'project')).toMatchObject([{ content: 'Internal body', readAt: null }])
})

it('persists generic mail and notification receipts across database reopen without duplicating bodies', async () => {
  const letter = await service.sendMessage('s-main', 'restart', { to: 'role:project', message: 'Survive restart' })
  await run.dispose()
  db.close()
  db = await openDatabase(directory)
  expect(mailbox.list(db, 'nexus:project:p')).toMatchObject([{ id: letter.messageId, content: 'Survive restart', notifiedAt: expect.any(String) }])
  expect(db.connection.prepare('SELECT content FROM message WHERE id = ?').get(letter.messageId)).toEqual({ content: '' })
  expect(db.connection.prepare('PRAGMA foreign_key_check').all()).toEqual([])
})

it('defers a busy notification race without changing the healthy binding or swallowing unknown receipts', async () => {
  mailbox.save(db, { id: 'busy-race', recipient: 'nexus:project:p', sender: 'external', kind: 'note', content: 'Wait for idle' })
  const { LedgerError } = await import('../src/database')
  vi.spyOn(gateway, 'deliver').mockRejectedValueOnce(new LedgerError('delivery_pending'))
  await run.notifyMailbox('s-project')
  expect(ledger.load(db, 'role_binding', 'project')).toMatchObject({ status: 'idle' })
  expect(mailbox.load(db, 'busy-race')).toMatchObject({ notifiedAt: null, handledAt: null })
  expect(ledger.list(db, 'attention')).toEqual([])
  await run.notifyMailbox('s-project')
  expect(deliveries).toHaveLength(1)
  vi.spyOn(gateway, 'receipt').mockResolvedValueOnce('unknown')
  await expect(run.notifyMailbox('s-project')).rejects.toMatchObject({ code: 'unknown_remote_result' })
})
