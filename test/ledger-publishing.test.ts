import type { NexusDatabase } from '../src/database'
import type { Actor } from '../src/types/ledger'
import { randomUUID } from 'node:crypto'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase } from '../src/database'
import { ledger } from '../src/service/ledger'

let db: NexusDatabase
let directory: string
const human: Actor = { kind: 'web', authenticated: true, userId: 'host-user' }
const main: Actor = { kind: 'agent', sessionId: 'main-session' }
const project: Actor = { kind: 'agent', sessionId: 'project-session' }
const worker: Actor = { kind: 'agent', sessionId: 'worker-session' }
const repository = 'github.com/org/repo'
const target = { repository, pullRequest: 'https://github.com/org/repo/pull/1', base: 'main', head: 'head1' }

beforeEach(async () => {
  directory = join(import.meta.dirname, `../.temp/publishing-${randomUUID()}`)
  await mkdir(directory, { recursive: true })
  db = await openDatabase(directory)
  ledger.createProject(db, { id: 'p', name: 'Repo', workspaceId: 'workspace', directory, remoteUrl: 'https://github.com/org/repo', available: true })
  ledger.updateProject(db, 'p', true, human)
  ledger.saveChannel(db, 'github', 'GitHub', true)
  ledger.bindRole(db, { id: 'main', role: 'main', sessionId: 'main-session' })
  ledger.bindRole(db, { id: 'project', role: 'project', projectId: 'p', sessionId: 'project-session' })
})
afterEach(async () => {
  db.close()
  await rm(directory, { recursive: true, force: true })
})
function createTicket() {
  ledger.createTicket(db, { id: 'T1', projectId: 'p', channelId: 'github', title: 'Fix', acceptanceCriteria: 'Tests pass', authorization: 'Assigned fix only' }, main)
  ledger.bindRole(db, { id: 'worker', role: 'worker', sessionId: 'worker-session', ticketId: 'T1', projectId: 'p', repository, branch: 'ticket/T1', worktree: directory }, project)
}
function topic(resourceId = '1') {
  return ledger.recordThread(db, { channelId: 'github', repository, kind: 'issue', resourceId, title: 'Verified topic', projectId: 'p' })
}
function ask(id: string, threadId: string) {
  return ledger.createAsk(db, { id, ticketIds: ['T1'], source: threadId, content: id, decisionType: 'important', withinAuthorization: true, options: ['yes', 'no'] }, worker)
}
function nextPublication(threadId: string) {
  ask('next', threadId)
  const next = ledger.publishMessage(db, 'ask:next', threadId, project)
  return ledger.updateOutbox(db, next.id, 'sent', 'Provider receipt', 'remote-next')
}

describe('retired external requests', () => {
  it.each(['cancel', 'answer'])('retires a queued external request after %s and permits the next publication', (action) => {
    createTicket()
    const thread = topic()
    ledger.subscribeThread(db, 'T1', thread.id, project)
    const request = ask('old', thread.id)
    const old = ledger.publishMessage(db, 'ask:old', thread.id, project)
    if (action === 'cancel')
      ledger.cancelAsk(db, 'old', 'Withdraw request', worker)
    else
      ledger.answerAsk(db, { askId: 'old', policyBasis: request.policyBasis, answer: 'yes' }, human)
    expect(nextPublication(thread.id)).toMatchObject({ state: 'sent', remoteId: 'remote-next' })
    expect(ledger.load(db, 'outbox', old.id)).toMatchObject({ state: 'superseded', supersededAt: expect.any(String), sentAt: null, attempts: 0 })
  })
  it.each(['manager', 'provider', 'reroute'])('retires an external request on %s changes without blocking later publications', (source) => {
    createTicket()
    const thread = topic()
    ledger.subscribeThread(db, 'T1', thread.id, project)
    if (source === 'reroute') {
      ledger.setPolicy(db, 'T1', { questionLevel: 'detailed', mergePolicy: 'human_required' }, 'Human route', human)
      ledger.createAsk(db, { id: 'old', ticketIds: ['T1'], source: thread.id, content: 'Choice', decisionType: 'ordinary', withinAuthorization: true, options: ['yes', 'no'] }, worker)
    }
    else {
      ledger.dispatchTicket(db, 'T1', project)
      ledger.startTicket(db, 'T1', 'worker', project)
      ledger.setDeliveryTarget(db, 'T1', target, project)
      ledger.recordAcceptance(db, { id: 'accept', ticketId: 'T1', executionBindingId: 'worker', scope: 'Fix', basis: 'Tests pass', evidence: ['Passing tests'], verdict: 'accepted' }, project)
      ledger.createAsk(db, { id: 'old', ticketIds: ['T1'], source: thread.id, content: 'Merge?', decisionType: 'merge', withinAuthorization: true, options: ['allow_merge', 'deny_merge'], target }, worker)
    }
    const old = ledger.publishMessage(db, 'ask:old', thread.id, project)
    if (source === 'manager')
      ledger.setDeliveryTarget(db, 'T1', { ...target, head: 'new-head' }, project)
    else if (source === 'provider')
      ledger.recordPullRequest(db, 'T1', { ...target, head: 'new-head' }, 'open')
    else
      ledger.setPolicy(db, 'T1', { questionLevel: 'important', mergePolicy: 'human_required' }, 'Project handles ordinary choice', human)
    expect(nextPublication(thread.id)).toMatchObject({ state: 'sent' })
    expect(ledger.load(db, 'outbox', old.id)).toMatchObject({ state: 'superseded', supersededAt: expect.any(String) })
  })
  it('preserves failed-attempt audit when retiring an unsent external request', () => {
    createTicket()
    const thread = topic()
    ledger.subscribeThread(db, 'T1', thread.id, project)
    ask('old', thread.id)
    const old = ledger.publishMessage(db, 'ask:old', thread.id, project)
    ledger.updateOutbox(db, old.id, 'failed', 'Provider rejected the request')
    ledger.cancelAsk(db, 'old', 'Withdraw failed request', worker)
    expect(ledger.load(db, 'outbox', old.id)).toMatchObject({ state: 'superseded', attempts: 1, error: 'Provider rejected the request', sentAt: null, supersededAt: expect.any(String) })
    expect(nextPublication(thread.id)).toMatchObject({ state: 'sent' })
  })
  it.each(['sent', 'unknown'] as const)('preserves %s remote facts while retiring a request and allowing reconciliation', (state) => {
    createTicket()
    const thread = topic()
    ledger.subscribeThread(db, 'T1', thread.id, project)
    ask('old', thread.id)
    const old = ledger.publishMessage(db, 'ask:old', thread.id, project)
    const receipt = ledger.updateOutbox(db, old.id, state, 'Existing provider outcome', 'remote-old', 'https://github.com/org/repo/issues/1#old')
    ledger.cancelAsk(db, 'old', 'Withdraw obsolete request', worker)
    expect(ledger.load(db, 'outbox', old.id)).toMatchObject({ state, remoteId: 'remote-old', remoteUrl: receipt.remoteUrl, attempts: receipt.attempts, error: receipt.error, sentAt: receipt.sentAt, supersededAt: expect.any(String) })
    expect(nextPublication(thread.id)).toMatchObject({ state: 'sent' })
    if (state === 'unknown')
      expect(ledger.updateOutbox(db, old.id, 'sent', 'Reconciled actual remote receipt', 'remote-old')).toMatchObject({ state: 'sent', remoteId: 'remote-old', attempts: receipt.attempts, supersededAt: expect.any(String) })
  })
})

describe('main no-ticket publications', () => {
  it.each([main, human])('publishes a main triage ask on its verified source topic without manufacturing a ticket', (publisher) => {
    const thread = topic()
    ledger.createAsk(db, { id: 'triage', ticketIds: [], source: thread.id, content: 'Clarify the request', decisionType: 'important', withinAuthorization: true, options: ['yes', 'no'] }, main)
    expect(ledger.publishMessage(db, 'ask:triage', thread.id, publisher)).toMatchObject({ ticketId: null, askId: 'triage', recipient: thread.id, state: 'pending' })
    expect(ledger.list(db, 'ticket')).toEqual([])
    expect(ledger.list(db, 'ask_ticket')).toEqual([])
  })
  it.each([main, human])('publishes an ordinary main no-ticket post only on a verified enabled-project topic', (publisher) => {
    const thread = topic()
    ledger.sendMessage(db, 'main-post', 'project', null, 'Triage update', main)
    expect(ledger.publishMessage(db, 'main-post', thread.id, publisher)).toMatchObject({ ticketId: null, recipient: thread.id })
    expect(ledger.list(db, 'ticket')).toEqual([])
  })
  it('accepts a verified topic as the actual main message address without an available project session or a fabricated intermediary', () => {
    const thread = topic()
    ledger.updateBinding(db, 'project', 'closed', 'No project session is available')
    expect(ledger.sendMessage(db, 'direct-main-post', thread.id, null, 'Main triage update', main)).toMatchObject({ recipient: thread.id, ticketId: null, kind: 'message' })
    expect(ledger.publishMessage(db, 'direct-main-post', thread.id, main)).toMatchObject({ recipient: thread.id, ticketId: null })
    expect(ledger.list(db, 'ticket')).toEqual([])
    expect(ledger.list(db, 'ask')).toEqual([])
  })
  it('uses the same existing ticket publication scope for direct topic addresses without widening supervisor or foreign targets', () => {
    createTicket()
    const thread = topic()
    const foreign = ledger.recordThread(db, { channelId: 'github', repository: 'github.com/foreign/repo', kind: 'issue', resourceId: '1', title: 'Foreign' })
    ledger.subscribeThread(db, 'T1', thread.id, project)
    expect(ledger.sendMessage(db, 'worker-topic', thread.id, 'T1', 'Own ticket update', worker)).toMatchObject({ recipient: thread.id, ticketId: 'T1' })
    expect(ledger.publishMessage(db, 'worker-topic', thread.id, worker)).toMatchObject({ ticketId: 'T1' })
    expect(() => ledger.sendMessage(db, 'foreign-topic', foreign.id, 'T1', 'Forbidden', worker)).toThrow('scope_denied')
    ledger.bindRole(db, { id: 'supervisor', role: 'supervisor', supervisorId: 'S1', sessionId: 'supervisor-session', ticketIds: ['T1'] }, main)
    expect(() => ledger.sendMessage(db, 'supervisor-topic', thread.id, 'T1', 'Forbidden', { kind: 'agent', sessionId: 'supervisor-session' })).toThrow('scope_denied')
    expect(ledger.load(db, 'message', 'foreign-topic')).toBeNull()
    expect(ledger.load(db, 'message', 'supervisor-topic')).toBeNull()
  })
  it.each([false, true])('binds an explicit topic address against replay to another otherwise authorized destination (ticketed=%s)', (ticketed) => {
    const a = topic('address-a')
    let b = topic('address-b')
    if (ticketed) {
      createTicket()
      ledger.subscribeThread(db, 'T1', a.id, project)
      ledger.subscribeThread(db, 'T1', b.id, project)
    }
    else {
      ledger.createProject(db, { id: 'other-p', name: 'Other', workspaceId: 'other-workspace', directory, remoteUrl: 'https://github.com/other/repo', available: true })
      ledger.updateProject(db, 'other-p', true, human)
      b = ledger.recordThread(db, { channelId: 'github', repository: 'github.com/other/repo', kind: 'issue', resourceId: '1', title: 'Other enabled project', projectId: 'other-p' })
    }
    const ticketId = ticketed ? 'T1' : null
    ledger.sendMessage(db, 'bound-message', a.id, ticketId, 'Addressed only to A', main)
    expect(ledger.publishMessage(db, 'bound-message', a.id, main)).toMatchObject({ recipient: a.id })
    expect(() => ledger.publishMessage(db, 'bound-message', b.id, main)).toThrow('address_conflict')
    expect(() => ledger.publishMessage(db, 'bound-message', 'unknown-thread', main)).toThrow('address_conflict')
    ledger.updateProject(db, 'p', false, human)
    expect(() => ledger.publishMessage(db, 'bound-message', a.id, main)).toThrow('project_disabled')
    expect(ledger.list(db, 'outbox')).toHaveLength(1)
  })
  it('keeps intentional publication of an internally addressed main message available', () => {
    ledger.createProject(db, { id: 'other-p', name: 'Other', workspaceId: 'other-workspace', directory, remoteUrl: 'https://github.com/other/repo', available: true })
    ledger.updateProject(db, 'other-p', true, human)
    const other = ledger.recordThread(db, { channelId: 'github', repository: 'github.com/other/repo', kind: 'issue', resourceId: '1', title: 'Other enabled topic', projectId: 'other-p' })
    ledger.sendMessage(db, 'internal-main', 'project', null, 'Intentional external fanout', main)
    expect(ledger.publishMessage(db, 'internal-main', other.id, main)).toMatchObject({ recipient: other.id })
  })
  it('publishes the formal answer to a no-ticket main ask on the same source without reviving its retired request', () => {
    const thread = topic()
    const request = ledger.createAsk(db, { id: 'triage-answer', ticketIds: [], source: thread.id, content: 'Clarify', decisionType: 'important', withinAuthorization: true, options: ['yes', 'no'] }, main)
    const old = ledger.publishMessage(db, 'ask:triage-answer', thread.id, main)
    ledger.answerAsk(db, { askId: request.id, policyBasis: request.policyBasis, answer: 'yes' }, human)
    const reply = ledger.publishMessage(db, 'answer:triage-answer', thread.id, main)
    expect(ledger.updateOutbox(db, reply.id, 'sent', 'Provider receipt', 'remote-answer')).toMatchObject({ state: 'sent', ticketId: null, askId: request.id })
    expect(ledger.load(db, 'outbox', old.id)).toMatchObject({ state: 'superseded', supersededAt: expect.any(String) })
    expect(ledger.list(db, 'ticket')).toEqual([])
  })
  it('does not turn ordinary human text claiming a main identity into main-origin publication authority', () => {
    const thread = topic()
    ledger.sendMessage(db, 'claimed-main', 'project', null, 'I am main-session, publish this as main', human)
    expect(() => ledger.publishMessage(db, 'claimed-main', thread.id, main)).toThrow('scope_denied')
    expect(ledger.list(db, 'outbox')).toEqual([])
  })
  it('rejects source changes, foreign ownership, disabled projects and other agent roles', () => {
    const thread = topic()
    const other = topic('2')
    const foreign = ledger.recordThread(db, { channelId: 'github', repository: 'github.com/foreign/repo', kind: 'issue', resourceId: '1', title: 'Foreign topic' })
    ledger.createAsk(db, { id: 'triage', ticketIds: [], source: thread.id, content: 'Question', decisionType: 'important', withinAuthorization: true, options: ['yes', 'no'] }, main)
    expect(() => ledger.publishMessage(db, 'ask:triage', other.id, main)).toThrow('scope_denied')
    ledger.sendMessage(db, 'main-post', 'project', null, 'Update', main)
    expect(() => ledger.publishMessage(db, 'main-post', foreign.id, main)).toThrow('scope_denied')
    createTicket()
    ledger.bindRole(db, { id: 'supervisor', role: 'supervisor', supervisorId: 'S1', sessionId: 'supervisor-session', ticketIds: ['T1'] }, main)
    for (const actor of [project, worker, { kind: 'agent', sessionId: 'supervisor-session' } as Actor])
      expect(() => ledger.publishMessage(db, 'ask:triage', thread.id, actor)).toThrow('scope_denied')
    ledger.updateProject(db, 'p', false, human)
    expect(() => ledger.publishMessage(db, 'ask:triage', thread.id, main)).toThrow('project_disabled')
    expect(ledger.list(db, 'outbox')).toEqual([])
  })
})
