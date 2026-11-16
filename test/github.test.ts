import type { GhRequest, GhRunner } from '../src/channel/github/types'
import type { NexusDatabase } from '../src/database'
import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GitHubChannel } from '../src/channel/github/channel'
import { GhError } from '../src/channel/github/runner'
import { openDatabase } from '../src/database'
import { ledger } from '../src/service/ledger'

const human = { kind: 'web', authenticated: true, userId: 'host' } as const
const main = { kind: 'agent', sessionId: 'main-session' } as const
const repository = 'github.com/org/repo'
const baseline = '2026-11-16T12:00:00.000Z'
let db: NexusDatabase
let directory: string
let gh: RecordingGh
let channel: GitHubChannel

class RecordingGh implements GhRunner {
  calls: GhRequest[] = []
  responses = new Map<string, unknown[]>()

  reply(path: string, ...data: unknown[]) {
    this.responses.set(path, data)
  }

  async request(request: GhRequest) {
    this.calls.push(request)
    const key = request.method === 'GET' ? request.path : `${request.method} ${request.path}`
    const queue = this.responses.get(key)
    if (!queue?.length)
      throw new Error(`Unrecorded request: ${key}`)
    const result = queue.length === 1 ? queue[0] : queue.shift()
    if (result instanceof Error)
      throw result
    return structuredClone(result)
  }
}

beforeEach(async () => {
  directory = join(import.meta.dirname, `../.temp/github-${randomUUID()}`)
  db = await openDatabase(directory)
  ledger.createProject(db, { id: 'p', name: 'Not a repository', workspaceId: 'w', directory, remoteUrl: 'git@github.com:Org/Repo.git', available: true })
  ledger.updateProject(db, 'p', true, human)
  ledger.updateSettings(db, { whitelist: ['alice'] }, human)
  ledger.bindRole(db, { id: 'main', role: 'main', sessionId: 'main-session' })
  gh = new RecordingGh()
  gh.reply('user', { id: 1, login: 'nexus-account', type: 'User' })
  gh.reply('repos/org/repo', { id: 100, full_name: 'Org/Repo' })
  channel = new GitHubChannel(db, gh)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(baseline)
})

afterEach(async () => {
  db.close()
  vi.useRealTimers()
  vi.restoreAllMocks()
  await rm(directory, { recursive: true, force: true })
})

async function select() {
  return channel.selectEnvironment('p', { site: 'github.com', login: 'nexus-account', automationIds: ['99'] })
}

function issue(number: number, created = baseline, patch: Record<string, unknown> = {}) {
  return { id: number + 1000, number, title: `Work ${number}`, body: 'Please fix', state: 'open', created_at: created, updated_at: created, html_url: `https://github.com/org/repo/issues/${number}`, user: { id: 42, login: 'ALICE', type: 'User' }, ...patch }
}

function emptyStreams() {
  gh.reply(`repos/org/repo/issues?state=all&sort=updated&direction=asc&per_page=100&page=1&since=${encodeURIComponent(baseline)}`, [])
}

describe('gitHub environment selection', () => {
  it('keeps same-number resources in different registered repositories separate and lets a healthy project continue', async () => {
    await select()
    emptyStreams()
    ledger.createProject(db, { id: 'q', name: 'Second', workspaceId: 'w2', directory, remoteUrl: 'https://github.com/org/other', available: true })
    ledger.updateProject(db, 'q', true, human)
    gh.reply('repos/org/other', { id: 101, full_name: 'Org/Other' })
    await channel.selectEnvironment('q', { site: 'github.com', login: 'nexus-account', automationIds: [] })
    const suffix = `/issues?state=all&sort=updated&direction=asc&per_page=100&page=1&since=${encodeURIComponent(baseline)}`
    gh.reply(`repos/org/repo${suffix}`, new GhError('forbidden'))
    gh.reply(`repos/org/other${suffix}`, [issue(12, baseline, { html_url: 'https://github.com/org/other/issues/12' })])
    expect(await channel.collect('p')).toMatchObject({ ok: false, reason: 'forbidden' })
    expect(await channel.collect('q')).toEqual({ ok: true })
    expect(channel.intake('q')).toMatchObject([{ threadId: 'github.com/org/other:issue:12' }])
    expect(channel.intake('p')).toEqual([])
    expect(channel.status('p')).toEqual(expect.arrayContaining([expect.objectContaining({ name: expect.stringContaining('collection_status'), value: expect.objectContaining({ reason: 'forbidden' }) })]))
  })

  it('requires explicit matching account and consumes the verified ledger repository', async () => {
    expect(await channel.verifyEnvironment('p')).toMatchObject({ available: false, reason: 'environment_not_selected' })
    expect(await select()).toMatchObject({ available: true, site: 'github.com', login: 'nexus-account', repository })
    expect(gh.calls.map(call => call.path)).toEqual(['user', 'repos/org/repo'])
    gh.reply('user', { id: 2, login: 'other', type: 'User' })
    expect(await channel.verifyEnvironment('p')).toMatchObject({ available: false, reason: 'account_mismatch' })
  })

  it.each(['gh_missing', 'not_logged_in', 'forbidden'])('persists credential-free unavailability for %s', async (reason) => {
    gh.reply('user', new GhError(reason))
    expect(await select()).toMatchObject({ available: false, reason })
    expect(JSON.stringify(ledger.list(db, 'source_state'))).toContain(reason)
  })
})

function topicThread(number = 7, pull = false) {
  return ledger.recordThread(db, { channelId: 'github', repository, resourceId: String(number), kind: pull ? 'pull' : 'issue', title: 'Topic', projectId: 'p' })
}

function question(id: string, threadId: string, sent = true, ticketIds: string[] = []) {
  const ask = ledger.createAsk(db, { id, ticketIds, source: threadId, content: `Choose ${id}`, decisionType: 'important', withinAuthorization: true, options: ['yes', 'no'] }, main)
  const outbox = ledger.publishMessage(db, `ask:${ask.id}`, threadId, main)
  return sent ? ledger.updateOutbox(db, outbox.id, 'sent', '', `published-${id}`) : outbox
}

function comment(id: number, body: string, patch: Record<string, unknown> = {}) {
  return { id, body, created_at: baseline, updated_at: baseline, html_url: `https://github.com/org/repo/issues/7#issuecomment-${id}`, user: { id: 42, login: 'ALICE', type: 'User' }, ...patch }
}

function comments(threadId: string, items: unknown[]) {
  const number = threadId.split(':').at(-1)
  gh.reply(`repos/org/repo/issues/${number}/comments?per_page=100&page=1`, items)
  gh.reply(`repos/org/repo/issues/${number}/comments?per_page=100&page=1&since=${encodeURIComponent('2026-11-16T11:59:59.000Z')}`, items)
}

describe('gitHub intake collection', () => {
  it('collects subscribed historical topics, attaches every subscription, and keeps another topic moving after a read failure', async () => {
    await select()
    const first = topicThread(7)
    const second = topicThread(8)
    for (const id of ['T1', 'T2']) {
      ledger.createTicket(db, { id, projectId: 'p', channelId: 'github', title: id, authorization: 'Fix only', acceptanceCriteria: 'Tests pass' }, main)
      ledger.subscribeThread(db, id, second.id, main)
    }
    ledger.subscribeThread(db, 'T1', first.id, main)
    emptyStreams()
    gh.reply('repos/org/repo/issues/7/comments?per_page=100&page=1', new GhError('forbidden'))
    comments(second.id, [comment(88, 'Outside collaboration', { created_at: '2026-11-15T00:00:00Z', updated_at: '2026-11-15T00:00:00Z', user: { id: 4, login: 'outsider', type: 'User' } })])
    expect(await channel.collect('p')).toMatchObject({ ok: false, reason: 'forbidden' })
    expect(channel.intake('p')).toMatchObject([{ kind: 'context', ticketIds: ['T1', 'T2'], historical: true }])
    expect(ledger.list(db, 'trigger')).toMatchObject([{ actorProviderId: '4', actorLogin: 'outsider' }])
  })

  it('does not lose a page-shifted event by advancing a changing scan watermark', async () => {
    await select()
    const root = 'repos/org/repo/issues?state=all&sort=updated&direction=asc&per_page=100&page='
    const suffix = `&since=${encodeURIComponent(baseline)}`
    const firstPage = Array.from({ length: 100 }, (_, index) => issue(index + 1))
    gh.reply(`${root}1${suffix}`, firstPage)
    gh.reply(`${root}2${suffix}`, [issue(102)])
    vi.setSystemTime('2026-11-16T12:05:00Z')
    await channel.collect('p')
    gh.reply(`${root}1${suffix}`, firstPage)
    gh.reply(`${root}2${suffix}`, [issue(101), issue(102)])
    expect(await channel.collect('p')).toEqual({ ok: true })
    expect(channel.intake('p')).toHaveLength(102)
  }, 15000)

  it('does not flood history and durably admits each new whitelisted topic once', async () => {
    await select()
    emptyStreams()
    const path = `repos/org/repo/issues?state=all&sort=updated&direction=asc&per_page=100&page=1&since=${encodeURIComponent(baseline)}`
    gh.reply(path, [issue(1, '2026-11-15T00:00:00.000Z'), issue(2)])
    expect(await channel.collect('p')).toMatchObject({ ok: true })
    expect(channel.intake('p')).toMatchObject([{ kind: 'triage', threadId: `${repository}:issue:2` }])
    expect(ledger.list(db, 'ticket')).toEqual([])
    channel = new GitHubChannel(db, gh)
    await channel.collect('p')
    expect(channel.intake('p')).toHaveLength(1)
    channel.acknowledgeIntake('p', channel.intake('p')[0]!.id)
    expect(channel.intake('p')).toEqual([])
    expect(ledger.list(db, 'trigger')).toHaveLength(2)
    ledger.updateSettings(db, { whitelist: [] }, human)
    gh.reply(path, [issue(3)])
    await channel.collect('p')
    expect(channel.intake('p')).toEqual([])
  })

  it('replays page boundaries safely after failure and keeps provider revisions isolated', async () => {
    await select()
    const root = 'repos/org/repo/issues?state=all&sort=updated&direction=asc&per_page=100&page='
    const suffix = `&since=${encodeURIComponent(baseline)}`
    gh.reply(`${root}1${suffix}`, Array.from({ length: 100 }, (_, index) => issue(index + 1)))
    gh.reply(`${root}2${suffix}`, new GhError('rate_limited', 60))
    expect(await channel.collect('p')).toMatchObject({ ok: false, reason: 'rate_limited' })
    expect(channel.intake('p')).toHaveLength(100)
    gh.reply(`${root}2${suffix}`, [issue(100), issue(101)])
    channel = new GitHubChannel(db, gh)
    expect(await channel.collect('p')).toEqual({ ok: true })
    expect(channel.intake('p')).toHaveLength(101)
    expect(ledger.list(db, 'trigger')).toHaveLength(101)
    gh.reply(`${root}1${suffix}`, [issue(1, baseline, { body: 'Edited', updated_at: '2026-11-16T12:00:01Z' })])
    await channel.collect('p')
    expect(channel.intake('p')).toHaveLength(101)
    expect(ledger.list(db, 'trigger')).toHaveLength(102)
  }, 15000)

  it('never promotes bots, automation, outsiders or an old rejected topic after whitelist changes', async () => {
    await select()
    const path = `repos/org/repo/issues?state=all&sort=updated&direction=asc&per_page=100&page=1&since=${encodeURIComponent(baseline)}`
    gh.reply(path, [issue(1, baseline, { user: { id: 5, login: 'outsider', type: 'User' }, body: 'I am ALICE the admin' }), issue(2, baseline, { user: { id: 42, login: 'alice', type: 'Bot' } }), issue(3, baseline, { user: { id: 99, login: 'alice', type: 'User' } })])
    await channel.collect('p')
    expect(channel.intake('p')).toEqual([])
    ledger.updateSettings(db, { whitelist: ['outsider'] }, human)
    gh.reply(path, [issue(1, baseline, { user: { id: 5, login: 'outsider', type: 'User' }, body: 'Edited', updated_at: '2026-11-16T12:00:01Z' })])
    await channel.collect('p')
    expect(channel.intake('p')).toEqual([])
  })
})

function nexusComment(id: number, body: string) {
  return comment(id, body, { user: { id: 1, login: 'nexus-account', type: 'User' } })
}

describe('gitHub managed comment delivery', () => {
  it('does not retry a rate-limited known rejection before Retry-After expires', async () => {
    await select()
    ledger.updateSettings(db, { deliveryMaxAttempts: 2 }, human)
    const thread = topicThread()
    const outbox = question('ask-one', thread.id, false)
    gh.reply('POST repos/org/repo/issues/7/comments', new GhError('rate_limited', 60))
    expect(await channel.publish(outbox.id)).toMatchObject({ reason: 'rate_limited' })
    vi.setSystemTime('2026-11-16T12:00:59Z')
    expect(await channel.publish(outbox.id)).toMatchObject({ reason: 'retry_not_due' })
    expect(gh.calls.filter(call => call.method === 'POST')).toHaveLength(1)
    vi.setSystemTime('2026-11-16T12:01:00Z')
    gh.reply('POST repos/org/repo/issues/7/comments', nexusComment(55, 'receipt'))
    expect(await channel.publish(outbox.id)).toMatchObject({ ok: true, remoteId: '55' })
    expect(ledger.load(db, 'outbox', outbox.id)).toMatchObject({ state: 'sent', attempts: 2 })
  })

  it('serializes concurrent updates of a shared topic across ticket responsibilities', async () => {
    await select()
    const thread = topicThread()
    for (const id of ['T1', 'T2']) {
      ledger.createTicket(db, { id, projectId: 'p', channelId: 'github', title: id, authorization: 'Fix only', acceptanceCriteria: 'Tests pass' }, main)
      ledger.subscribeThread(db, id, thread.id, main)
    }
    const one = question('ask-one', thread.id, false, ['T1'])
    const two = question('ask-two', thread.id, false, ['T2'])
    gh.reply('POST repos/org/repo/issues/7/comments', nexusComment(55, 'receipt'))
    gh.reply('PATCH repos/org/repo/issues/comments/55', nexusComment(55, 'receipt'))
    const original = gh.request.bind(gh)
    gh.request = async (request) => {
      if (request.method === 'GET' && request.path === 'repos/org/repo/issues/comments/55')
        return nexusComment(55, String(gh.calls.find(call => call.method === 'POST')!.body!.body))
      return original(request)
    }
    expect(await Promise.all([channel.publish(one.id), channel.publish(two.id)])).toMatchObject([{ ok: true }, { ok: true }])
    expect(gh.calls.filter(call => call.method === 'POST')).toHaveLength(1)
    expect(gh.calls.filter(call => call.method === 'PATCH')).toHaveLength(1)
    expect(String(gh.calls.find(call => call.method === 'PATCH')!.body!.body)).toContain('ask-two')
  })

  it('uses configured bounded retries and honors a remote retry-after without sleeping', async () => {
    await select()
    ledger.updateSettings(db, { deliveryMaxAttempts: 1 }, human)
    const thread = topicThread()
    const outbox = question('ask-one', thread.id, false)
    gh.reply('POST repos/org/repo/issues/7/comments', new GhError('rate_limited', 60))
    expect(await channel.publish(outbox.id)).toMatchObject({ ok: false, reason: 'rate_limited' })
    expect(ledger.load(db, 'outbox', outbox.id)).toMatchObject({ state: 'failed', attempts: 1, error: 'rate_limited' })
    expect(await channel.publish(outbox.id)).toMatchObject({ ok: false, reason: 'retry_exhausted' })
    expect(gh.calls.filter(call => call.method === 'POST')).toHaveLength(1)
  })

  it('publishes one comment with multiple ask ids then PATCHes latest state in place', async () => {
    await select()
    const thread = topicThread()
    const first = question('ask-one', thread.id, false)
    question('ask-two', thread.id, false)
    gh.reply('POST repos/org/repo/issues/7/comments', nexusComment(55, 'receipt'))
    expect(await channel.publish(first.id)).toMatchObject({ ok: true, remoteId: '55' })
    const created = gh.calls.find(call => call.method === 'POST')!
    expect(created.body!.body).toContain('ask-one')
    expect(created.body!.body).not.toContain('ask-two')
    gh.reply('repos/org/repo/issues/comments/55', nexusComment(55, String(created.body!.body)))
    gh.reply('PATCH repos/org/repo/issues/comments/55', nexusComment(55, 'updated'))
    const second = ledger.list(db, 'outbox').find(row => row.askId === 'ask-two')!
    expect(await channel.publish(second.id)).toMatchObject({ ok: true, remoteId: '55' })
    expect(gh.calls.filter(call => call.method === 'POST')).toHaveLength(1)
    expect(gh.calls.filter(call => call.method === 'PATCH')).toHaveLength(1)
    expect(gh.calls.find(call => call.method === 'PATCH')!.body!.body).toContain('ask-two')
    expect(ledger.list(db, 'outbox')).toMatchObject([{ state: 'sent', remoteId: '55' }, { state: 'sent', remoteId: '55' }])
    ledger.answerAsk(db, { askId: 'ask-one', answer: 'yes', policyBasis: ledger.load(db, 'ask', 'ask-one')!.policyBasis }, human)
    await channel.publish(second.id)
    expect(String(gh.calls.filter(call => call.method === 'PATCH').at(-1)!.body!.body)).toContain('answered')
    expect(ledger.load(db, 'ask', 'ask-two')).toMatchObject({ status: 'pending' })
  })

  it('reconciles an unknown create by provider id and marker without sending a second comment', async () => {
    await select()
    const thread = topicThread()
    const outbox = question('ask-one', thread.id, false)
    gh.reply('POST repos/org/repo/issues/7/comments', new GhError('transport_unknown'))
    expect(await channel.publish(outbox.id)).toMatchObject({ ok: false, reason: 'transport_unknown' })
    expect(ledger.load(db, 'outbox', outbox.id)).toMatchObject({ state: 'unknown', attempts: 1 })
    const sentBody = String(gh.calls.find(call => call.method === 'POST')!.body!.body)
    comments(thread.id, [nexusComment(55, sentBody)])
    channel = new GitHubChannel(db, gh)
    expect(await channel.publish(outbox.id)).toMatchObject({ ok: true, remoteId: '55' })
    expect(gh.calls.filter(call => call.method === 'POST')).toHaveLength(1)
    expect(ledger.load(db, 'outbox', outbox.id)).toMatchObject({ state: 'sent', attempts: 1 })
  })

  it('keeps an unobserved unknown result visible and only recreates a confirmed deleted comment', async () => {
    await select()
    const thread = topicThread()
    const outbox = question('ask-one', thread.id, false)
    gh.reply('POST repos/org/repo/issues/7/comments', new GhError('transport_unknown'))
    await channel.publish(outbox.id)
    comments(thread.id, [])
    expect(await channel.publish(outbox.id)).toMatchObject({ ok: false, reason: 'write_result_unknown' })
    const body = String(gh.calls.find(call => call.method === 'POST')!.body!.body)
    comments(thread.id, [nexusComment(55, body)])
    await channel.publish(outbox.id)
    const next = question('ask-two', thread.id, false)
    gh.reply('repos/org/repo/issues/comments/55', new GhError('not_found'))
    comments(thread.id, [])
    gh.reply('POST repos/org/repo/issues/7/comments', nexusComment(56, 'replacement'))
    expect(await channel.publish(next.id)).toMatchObject({ ok: true, remoteId: '56' })
    expect(gh.calls.filter(call => call.method === 'POST')).toHaveLength(2)
    expect(ledger.load(db, 'outbox', next.id)).toMatchObject({ remoteId: '56' })
  })

  it('enforces outbox order before writes and leaves paused or disabled projects untouched', async () => {
    await select()
    const thread = topicThread()
    question('ask-one', thread.id, false)
    const second = question('ask-two', thread.id, false)
    expect(await channel.publish(second.id)).toMatchObject({ ok: false, reason: 'delivery_order' })
    ledger.updateProject(db, 'p', false, human)
    expect(await channel.publish(second.id)).toMatchObject({ ok: false, reason: 'project_unavailable' })
    expect(gh.calls.filter(call => call.method !== 'GET')).toEqual([])
  })
})

const target = { repository, pullRequest: 'https://github.com/org/repo/pull/7', base: 'isolated-base', head: 'head-one' }
const projectActor = { kind: 'agent', sessionId: 'project-session' } as const
const workerActor = { kind: 'agent', sessionId: 'worker-session' } as const

function delivery() {
  ledger.bindRole(db, { id: 'project', role: 'project', projectId: 'p', sessionId: 'project-session' })
  ledger.createTicket(db, { id: 'T1', projectId: 'p', channelId: 'github', title: 'Fix', authorization: 'Fix only', acceptanceCriteria: 'Tests pass' }, main)
  ledger.bindRole(db, { id: 'worker', role: 'worker', projectId: 'p', ticketId: 'T1', sessionId: 'worker-session', repository, branch: 'isolated-work', worktree: directory }, projectActor)
  ledger.dispatchTicket(db, 'T1', projectActor)
  ledger.startTicket(db, 'T1', 'worker', projectActor)
  ledger.setDeliveryTarget(db, 'T1', target, projectActor)
  const thread = topicThread(7, true)
  ledger.subscribeThread(db, 'T1', thread.id, projectActor)
  ledger.recordAcceptance(db, { id: 'acceptance', ticketId: 'T1', executionBindingId: 'worker', scope: 'Fix', evidence: ['12 tests passed'], basis: 'Tests pass', verdict: 'accepted' }, projectActor)
  const ask = ledger.createAsk(db, { id: 'merge-ask', ticketIds: ['T1'], source: thread.id, content: 'Merge?', decisionType: 'merge', withinAuthorization: true, options: ['allow_merge', 'deny_merge'], target }, workerActor)
  ledger.answerAsk(db, { askId: ask.id, answer: 'allow_merge', policyBasis: ask.policyBasis, target, verified: true }, human)
  return thread
}

function pull(patch: Record<string, unknown> = {}) {
  return { number: 7, state: 'open', merged: false, html_url: target.pullRequest, updated_at: baseline, head: { sha: 'head-one' }, base: { ref: 'isolated-base', repo: { full_name: 'Org/Repo' } }, ...patch }
}

function facts(patch: Record<string, unknown> = {}) {
  gh.reply('repos/org/repo/pulls/7', pull(patch))
  gh.reply('repos/org/repo/commits/head-one/check-runs?per_page=100&page=1', { total_count: 1, check_runs: [{ id: 501, name: 'unit', head_sha: 'head-one', status: 'completed', conclusion: 'success', started_at: baseline, completed_at: baseline, app: { id: 1 } }] })
  gh.reply('repos/org/repo/commits/head-one/status?per_page=100&page=1', { sha: 'head-one', state: 'success', total_count: 0, statuses: [] })
}

function preflight(patch: Record<string, unknown> = {}) {
  gh.reply('repos/org/repo/rules/branches/isolated-base?per_page=100&page=1', [])
  gh.reply('POST graphql', { data: { repository: { nameWithOwner: 'Org/Repo', pullRequest: { number: 7, headRefOid: 'head-one', baseRefName: 'isolated-base', mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN', reviewDecision: null, baseRef: { branchProtectionRule: null }, commits: { nodes: [{ commit: { oid: 'head-one', statusCheckRollup: { state: 'SUCCESS' } } }] }, ...patch } } } })
}

describe('gitHub PR facts and external merge', () => {
  it.each(['pause', 'policy', 'evidence'])('rechecks current ledger %s before performing the merge action', async (change) => {
    await select()
    delivery()
    facts()
    preflight()
    if (change === 'pause')
      ledger.pauseTicket(db, 'T1', true, 'Human pause', human)
    else if (change === 'policy')
      ledger.setPolicy(db, 'T1', { questionLevel: 'detailed', mergePolicy: 'human_required' }, 'Updated policy', human)
    else
      ledger.recordAcceptance(db, { id: 'reject', ticketId: 'T1', executionBindingId: 'worker', scope: 'Fix', evidence: ['Regression failure'], basis: 'Tests fail', verdict: 'rejected' }, projectActor)
    expect(await channel.merge('merge-ask')).toMatchObject({ ok: false, reason: 'decision_invalid' })
    expect(gh.calls.filter(call => call.method === 'PUT')).toEqual([])
  })

  it('uses status ids to order same-timestamp revisions instead of replaying an older failure', async () => {
    await select()
    const thread = delivery()
    facts()
    const path = 'repos/org/repo/commits/head-one/status?per_page=100&page=1'
    const status = { context: 'external', updated_at: baseline }
    gh.reply(path, { sha: 'head-one', total_count: 1, statuses: [{ ...status, id: 1, state: 'failure' }] })
    expect(await channel.collectPullRequest('p', thread.id)).toMatchObject({ fact: { ciState: 'failing' } })
    gh.reply(path, { sha: 'head-one', total_count: 1, statuses: [{ ...status, id: 2, state: 'success' }] })
    expect(await channel.collectPullRequest('p', thread.id)).toMatchObject({ fact: { ciState: 'passing' } })
    gh.reply(path, { sha: 'head-one', total_count: 1, statuses: [{ ...status, id: 1, state: 'failure' }] })
    expect(await channel.collectPullRequest('p', thread.id)).toMatchObject({ fact: { ciState: 'passing' } })
  })

  it('preserves an observed external merge even when its CI read is unavailable', async () => {
    await select()
    const thread = delivery()
    facts({ merged: true, state: 'closed' })
    gh.reply('repos/org/repo/commits/head-one/check-runs?per_page=100&page=1', new GhError('forbidden'))
    expect(await channel.collectPullRequest('p', thread.id)).toMatchObject({ ok: false, reason: 'forbidden', fact: { state: 'merged', ciState: 'pending', ciCollectedAt: null } })
    expect(ledger.load(db, 'ticket', 'T1')).toMatchObject({ prState: 'merged', ciState: 'pending' })
    expect(await channel.merge('merge-ask')).toMatchObject({ ok: true, state: 'already_merged' })
    expect(gh.calls.filter(call => call.method === 'PUT')).toEqual([])
  })

  it('distinguishes rerunning, failing and closed-unmerged facts without regressing a completed check', async () => {
    await select()
    const thread = delivery()
    facts()
    await channel.collectPullRequest('p', thread.id)
    const path = 'repos/org/repo/commits/head-one/check-runs?per_page=100&page=1'
    const running = { id: 502, name: 'unit', head_sha: 'head-one', status: 'in_progress', conclusion: null, started_at: '2026-11-16T12:00:01Z', completed_at: null, app: { id: 1 } }
    gh.reply(path, { total_count: 1, check_runs: [running] })
    expect(await channel.collectPullRequest('p', thread.id)).toMatchObject({ fact: { ciState: 'running' } })
    gh.reply(path, { total_count: 1, check_runs: [{ ...running, status: 'completed', conclusion: 'failure', completed_at: '2026-11-16T12:00:02Z' }] })
    expect(await channel.collectPullRequest('p', thread.id)).toMatchObject({ fact: { ciState: 'failing' } })
    gh.reply(path, { total_count: 1, check_runs: [running] })
    expect(await channel.collectPullRequest('p', thread.id)).toMatchObject({ fact: { ciState: 'failing' } })
    facts({ state: 'closed', merged: false })
    expect(await channel.collectPullRequest('p', thread.id)).toMatchObject({ fact: { ciState: 'failing', state: 'closed' } })
    expect(ledger.load(db, 'ticket', 'T1')).toMatchObject({ prState: 'closed', ciState: 'failing' })
  })

  it('does not trust CLEAN while required checks are absent or an active rule cannot be verified', async () => {
    await select()
    delivery()
    facts()
    preflight({ baseRef: { branchProtectionRule: { requiresStatusChecks: true, requiredStatusCheckContexts: ['missing'], requiredStatusChecks: [], requiresApprovingReviews: false, requiresConversationResolution: false, requiresCommitSignatures: false, requiresLinearHistory: false, requiresDeployments: false, requiredDeploymentEnvironments: [] } } })
    expect(await channel.merge('merge-ask')).toMatchObject({ ok: false, reason: 'repository_requirements_unsatisfied' })
    vi.setSystemTime('2026-11-16T12:01:00Z')
    preflight()
    gh.reply('repos/org/repo/rules/branches/isolated-base?per_page=100&page=1', [{ type: 'merge_queue', parameters: {} }])
    expect(await channel.merge('merge-ask')).toMatchObject({ ok: false, reason: 'unsupported_repository_requirement' })
    expect(gh.calls.filter(call => call.method === 'PUT')).toEqual([])
  })

  it('records actual head/time and does not regress facts from old-head checks or older snapshots', async () => {
    await select()
    const thread = delivery()
    facts()
    expect(await channel.collectPullRequest('p', thread.id)).toMatchObject({ ok: true, fact: { target, ciState: 'passing', collectedAt: baseline, state: 'open' } })
    facts({ head: { sha: 'head-two' }, updated_at: '2026-11-16T12:00:02Z' })
    gh.reply('repos/org/repo/commits/head-two/check-runs?per_page=100&page=1', { total_count: 1, check_runs: [{ id: 501, name: 'unit', head_sha: 'head-one', status: 'completed', conclusion: 'success', started_at: baseline, completed_at: baseline, app: { id: 1 } }] })
    gh.reply('repos/org/repo/commits/head-two/status?per_page=100&page=1', { sha: 'head-two', state: 'pending', total_count: 0, statuses: [] })
    await channel.collectPullRequest('p', thread.id)
    expect(ledger.load(db, 'ticket', 'T1')).toMatchObject({ ciState: 'pending', deliveryTarget: JSON.stringify({ ...target, head: 'head-two' }) })
    facts()
    expect(await channel.collectPullRequest('p', thread.id)).toMatchObject({ ok: true, fact: { target: { head: 'head-two' } } })
    expect(ledger.load(db, 'ticket', 'T1')).toMatchObject({ deliveryTarget: JSON.stringify({ ...target, head: 'head-two' }) })
  })

  it.each([
    ['head_changed', { head: { sha: 'head-two' }, updated_at: '2026-11-16T12:00:02Z' }, {}],
    ['base_changed', { base: { ref: 'other-base', repo: { full_name: 'Org/Repo' } } }, {}],
    ['pull_request_closed', { state: 'closed' }, {}],
    ['repository_requirements_unsatisfied', {}, { mergeStateStatus: 'BLOCKED' }],
    ['repository_requirements_unsatisfied', {}, { mergeStateStatus: 'UNKNOWN' }],
    ['repository_requirements_unsatisfied', {}, { reviewDecision: 'CHANGES_REQUESTED' }],
  ])('rejects merge preflight %s without a remote write', async (reason, remote, requirements) => {
    await select()
    delivery()
    facts(remote)
    gh.reply('repos/org/repo/commits/head-two/check-runs?per_page=100&page=1', { total_count: 0, check_runs: [] })
    gh.reply('repos/org/repo/commits/head-two/status?per_page=100&page=1', { sha: 'head-two', state: 'pending', total_count: 0, statuses: [] })
    preflight(requirements)
    expect(await channel.merge('merge-ask')).toMatchObject({ ok: false, reason })
    expect(gh.calls.filter(call => call.method === 'PUT')).toEqual([])
    expect(ledger.load(db, 'ticket', 'T1')!.status).not.toBe('done')
  })

  it('merges only an approved exact head, then records observed merged without completing the ticket', async () => {
    await select()
    delivery()
    facts()
    preflight({ reviewDecision: 'APPROVED', baseRef: { branchProtectionRule: { requiresStatusChecks: true, requiredStatusCheckContexts: ['unit'], requiredStatusChecks: [{ context: 'unit', app: { databaseId: 1 } }], requiresApprovingReviews: true, requiresConversationResolution: false, requiresCommitSignatures: false, requiresLinearHistory: false, requiresDeployments: false, requiredDeploymentEnvironments: [] } } })
    gh.reply('repos/org/repo/rules/branches/isolated-base?per_page=100&page=1', [{ type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'unit', integration_id: 1 }] } }, { type: 'pull_request', parameters: { required_approving_review_count: 1, require_code_owner_review: false, require_last_push_approval: false, required_review_thread_resolution: false } }])
    gh.reply('repos/org/repo/pulls/7', pull(), pull({ merged: true, state: 'closed', updated_at: '2026-11-16T12:00:01Z' }))
    gh.reply('PUT repos/org/repo/pulls/7/merge', { merged: true, sha: 'actual-merge' })
    expect(await channel.merge('merge-ask')).toMatchObject({ ok: true, state: 'merged' })
    expect(gh.calls.find(call => call.method === 'PUT')!.body).toEqual({ sha: 'head-one', merge_method: 'merge' })
    expect(ledger.load(db, 'ticket', 'T1')).toMatchObject({ prState: 'merged', status: 'running' })
    expect(await channel.merge('merge-ask')).toMatchObject({ ok: true, state: 'already_merged' })
    expect(gh.calls.filter(call => call.method === 'PUT')).toHaveLength(1)
  })

  it('verifies the same PR after an unknown merge and never fabricates another approval', async () => {
    await select()
    delivery()
    facts()
    preflight()
    gh.reply('PUT repos/org/repo/pulls/7/merge', new GhError('transport_unknown'))
    expect(await channel.merge('merge-ask')).toMatchObject({ ok: false, reason: 'transport_unknown' })
    facts({ merged: true, state: 'closed', updated_at: '2026-11-16T12:00:01Z' })
    channel = new GitHubChannel(db, gh)
    expect(await channel.merge('merge-ask')).toMatchObject({ ok: true, state: 'already_merged' })
    expect(gh.calls.filter(call => call.method === 'PUT')).toHaveLength(1)
    expect(ledger.list(db, 'ask')).toHaveLength(1)
  })
})

describe('gitHub text answers', () => {
  it('keeps the published policy revision until an updated comment is actually confirmed', async () => {
    await select()
    const thread = delivery()
    const ask = ledger.createAsk(db, { id: 'policy-ask', ticketIds: ['T1'], source: thread.id, content: 'Choice?', decisionType: 'important', withinAuthorization: true, options: ['yes', 'no'] }, workerActor)
    const outbox = ledger.publishMessage(db, `ask:${ask.id}`, thread.id, projectActor)
    gh.reply('POST repos/org/repo/issues/7/comments', nexusComment(55, 'receipt'))
    await channel.publish(outbox.id)
    const originalBody = String(gh.calls.find(call => call.method === 'POST')!.body!.body)
    gh.reply('repos/org/repo/issues/comments/55', nexusComment(55, originalBody))
    ledger.setPolicy(db, 'T1', { questionLevel: 'detailed', mergePolicy: 'human_required' }, 'Updated policy', human)
    gh.reply('PATCH repos/org/repo/issues/comments/55', new GhError('remote_rejected'))
    expect(await channel.publish(outbox.id)).toMatchObject({ ok: false, reason: 'remote_rejected' })
    comments(thread.id, [comment(77, '回答 policy-ask: yes')])
    gh.reply('repos/org/repo/pulls/7/comments?per_page=100&page=1', [])
    gh.reply('repos/org/repo/pulls/7/reviews?per_page=100&page=1', [])
    expect(await channel.collectTopic('p', thread.id)).toMatchObject({ answers: [{ result: 'policy_changed' }] })
    expect(ledger.load(db, 'ask', ask.id)).toMatchObject({ status: 'pending', answer: null })
    vi.setSystemTime('2026-11-16T12:00:10Z')
    gh.reply('PATCH repos/org/repo/issues/comments/55', nexusComment(55, 'receipt'))
    expect(await channel.publish(outbox.id)).toMatchObject({ ok: true })
    comments(thread.id, [comment(77, '回答 policy-ask: yes', { updated_at: '2026-11-16T12:00:10Z' })])
    expect(await channel.collectTopic('p', thread.id)).toMatchObject({ answers: [{ result: 'answered' }] })
  })

  it('rejects a policy changed since publication instead of silently answering a stale question', async () => {
    await select()
    const thread = delivery()
    const ask = ledger.createAsk(db, { id: 'policy-ask', ticketIds: ['T1'], source: thread.id, content: 'Choice?', decisionType: 'important', withinAuthorization: true, options: ['yes', 'no'] }, workerActor)
    const outbox = ledger.publishMessage(db, `ask:${ask.id}`, thread.id, projectActor)
    gh.reply('POST repos/org/repo/issues/7/comments', nexusComment(55, 'receipt'))
    expect(await channel.publish(outbox.id)).toMatchObject({ ok: true })
    ledger.setPolicy(db, 'T1', { questionLevel: 'detailed', mergePolicy: 'human_required' }, 'Human changed policy', human)
    comments(thread.id, [comment(77, '回答 policy-ask: yes')])
    gh.reply('repos/org/repo/pulls/7/comments?per_page=100&page=1', [])
    gh.reply('repos/org/repo/pulls/7/reviews?per_page=100&page=1', [])
    expect(await channel.collectTopic('p', thread.id)).toMatchObject({ answers: [{ result: 'policy_changed' }] })
    expect(ledger.load(db, 'ask', ask.id)).toMatchObject({ status: 'pending', answer: null })
  })

  it('accepts an edited valid revision once and never overwrites a Web answer or cancelled ask', async () => {
    await select()
    const thread = topicThread()
    question('ask-one', thread.id)
    comments(thread.id, [comment(11, '同意')])
    await channel.collectTopic('p', thread.id)
    comments(thread.id, [comment(11, '回答 ask-one: yes', { updated_at: '2026-11-16T12:00:01Z' })])
    expect(await channel.collectTopic('p', thread.id)).toMatchObject({ answers: [{ result: 'answered' }] })
    comments(thread.id, [comment(11, '回答 ask-one: no', { updated_at: '2026-11-16T12:00:02Z' })])
    expect(await channel.collectTopic('p', thread.id)).toMatchObject({ answers: [{ result: 'ask_answered' }] })
    expect(ledger.load(db, 'ask', 'ask-one')).toMatchObject({ answer: 'yes' })
    question('ask-web', thread.id)
    const ask = ledger.load(db, 'ask', 'ask-web')!
    ledger.answerAsk(db, { askId: ask.id, answer: 'from web', policyBasis: ask.policyBasis }, human)
    comments(thread.id, [comment(12, '回答 ask-web: no')])
    expect(await channel.collectTopic('p', thread.id)).toMatchObject({ answers: [{ result: 'ask_answered' }] })
    expect(ledger.load(db, 'ask', 'ask-web')).toMatchObject({ answer: 'from web', answerSource: 'web' })
  })

  it.each([{ id: 42, login: 'alice', type: 'Bot' }, { id: 99, login: 'alice', type: 'User' }])('never treats provider automation as a human answer', async (user) => {
    await select()
    const thread = topicThread()
    question('ask-one', thread.id)
    comments(thread.id, [comment(11, '回答 ask-one: yes', { user })])
    expect(await channel.collectTopic('p', thread.id)).toMatchObject({ answers: [{ result: 'automation' }] })
    expect(ledger.load(db, 'ask', 'ask-one')).toMatchObject({ status: 'pending' })
  })

  it('accepts a merge answer only after fresh target, evidence and repository checks', async () => {
    await select()
    const thread = delivery()
    ledger.createAsk(db, { id: 'second-merge', ticketIds: ['T1'], source: thread.id, content: 'Merge?', decisionType: 'merge', withinAuthorization: true, options: ['allow_merge', 'deny_merge'], target }, workerActor)
    const outbox = ledger.publishMessage(db, 'ask:second-merge', thread.id, projectActor)
    ledger.updateOutbox(db, outbox.id, 'sent', '', 'managed')
    facts()
    preflight()
    comments(thread.id, [comment(77, '回答 second-merge: allow_merge')])
    gh.reply('repos/org/repo/pulls/7/comments?per_page=100&page=1', [])
    gh.reply('repos/org/repo/pulls/7/reviews?per_page=100&page=1', [])
    expect(await channel.collectTopic('p', thread.id)).toMatchObject({ ok: true, answers: [{ result: 'answered' }] })
    expect(ledger.load(db, 'ask', 'second-merge')).toMatchObject({ answer: 'allow_merge', verified: 1 })
    expect(ledger.resolveMerge(db, 'second-merge', target, true)).toBe(true)
  })

  it('rejects a stale head before accepting the published merge answer', async () => {
    await select()
    const thread = delivery()
    const ask = ledger.createAsk(db, { id: 'second-merge', ticketIds: ['T1'], source: thread.id, content: 'Merge?', decisionType: 'merge', withinAuthorization: true, options: ['allow_merge', 'deny_merge'], target }, workerActor)
    const outbox = ledger.publishMessage(db, `ask:${ask.id}`, thread.id, projectActor)
    ledger.updateOutbox(db, outbox.id, 'sent', '', 'managed')
    facts({ head: { sha: 'head-two' }, updated_at: '2026-11-16T12:00:02Z' })
    gh.reply('repos/org/repo/commits/head-two/check-runs?per_page=100&page=1', { total_count: 0, check_runs: [] })
    gh.reply('repos/org/repo/commits/head-two/status?per_page=100&page=1', { sha: 'head-two', state: 'pending', total_count: 0, statuses: [] })
    comments(thread.id, [comment(77, '回答 second-merge: allow_merge')])
    gh.reply('repos/org/repo/pulls/7/comments?per_page=100&page=1', [])
    gh.reply('repos/org/repo/pulls/7/reviews?per_page=100&page=1', [])
    expect(await channel.collectTopic('p', thread.id)).toMatchObject({ answers: [{ result: 'stale_target' }] })
    expect(ledger.load(db, 'ask', ask.id)).toMatchObject({ status: 'cancelled', answer: null })
  })

  it('binds independent top-level lines and rejects conflicting answers without guessing', async () => {
    await select()
    const thread = topicThread()
    question('ask-one', thread.id)
    question('ask-two', thread.id)
    comments(thread.id, [comment(11, '回答 ask-one：yes\n回答 ask-two: yes\n回答 ask-two: no')])
    expect(await channel.collectTopic('p', thread.id)).toMatchObject({ ok: true, answers: [{ askId: 'ask-one', result: 'answered' }, { askId: 'ask-two', result: 'conflicting_answers' }] })
    expect(ledger.load(db, 'ask', 'ask-one')).toMatchObject({ status: 'answered', answer: 'yes', answerSource: 'github', answerActor: expect.stringContaining('"providerId":"42"') })
    expect(ledger.load(db, 'ask', 'ask-two')).toMatchObject({ status: 'pending' })
    await channel.collectTopic('p', thread.id)
    expect(ledger.list(db, 'message').filter(message => message.kind === 'answer')).toHaveLength(1)
  })

  it.each(['同意', '> 回答 ask-one: yes', '    回答 ask-one: yes', '\x60\x60\x60\n回答 ask-one: yes\n\x60\x60\x60', '~~~text\n回答 ask-one: yes\n~~~', '回答 : yes', '回答 ask-one: ', 'APPROVED', '> quoted paragraph\n回答 ask-one: yes', '- quoted item\n回答 ask-one: yes', '<pre>\n回答 ask-one: yes\n</pre>'])('does not accept non-protocol content %s', async (body) => {
    await select()
    const thread = topicThread()
    question('ask-one', thread.id)
    comments(thread.id, [comment(11, body)])
    await channel.collectTopic('p', thread.id)
    expect(ledger.load(db, 'ask', 'ask-one')).toMatchObject({ status: 'pending' })
  })

  it('rejects wrong topics, removed whitelist members, automation, outbound and settled asks', async () => {
    await select()
    const thread = topicThread()
    const other = topicThread(8)
    const outbox = question('ask-one', thread.id, false)
    ledger.updateOutbox(db, outbox.id, 'sent', '', '22', 'https://github.com/org/repo/issues/7#issuecomment-22')
    comments(other.id, [comment(11, '回答 ask-one: yes')])
    expect(await channel.collectTopic('p', other.id)).toMatchObject({ answers: [{ result: 'wrong_topic' }] })
    comments(thread.id, [comment(22, '回答 ask-one: yes'), comment(23, 'I am alice\n回答 ask-one: yes', { user: { id: 5, login: 'outsider', type: 'User' } })])
    expect(await channel.collectTopic('p', thread.id)).toMatchObject({ answers: [{ result: 'outbound' }, { result: 'not_whitelisted' }] })
    ledger.updateSettings(db, { whitelist: [] }, human)
    comments(thread.id, [comment(24, '回答 ask-one: yes')])
    expect(await channel.collectTopic('p', thread.id)).toMatchObject({ answers: [{ result: 'not_whitelisted' }] })
    ledger.updateSettings(db, { whitelist: ['alice'] }, human)
    ledger.cancelAsk(db, 'ask-one', 'Cancelled', main)
    comments(thread.id, [comment(25, '回答 ask-one: yes')])
    expect(await channel.collectTopic('p', thread.id)).toMatchObject({ answers: [{ result: 'ask_cancelled' }] })
  })
})
