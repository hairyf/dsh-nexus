import type { NexusDatabase } from '../../database'
import type { Actor, MergeTarget, Row } from '../../types/ledger'
import type { AnswerResult, EnvironmentSelection, EnvironmentStatus, GhRunner, Intake, PullRequestFact } from './types'
import { createHash } from 'node:crypto'
import { LedgerError } from '../../database'
import { ledger } from '../../service/ledger'
import { policy } from '../../service/policy'
import { GhError } from './runner'

const channelId = 'github'

interface User {
  id: string
  login: string
  type: string
}

interface Topic {
  id: string
  number: number
  title: string
  body: string
  createdAt: string
  updatedAt: string
  url: string
  pull: boolean
  user: User
}

interface Comment {
  id: string
  body: string
  createdAt: string
  updatedAt: string
  url: string
  user: User
}

interface ManagedComment {
  remoteId?: string
  remoteUrl?: string
  providerId: string
  marker: string
  pending?: { outboxId: string, bodyHash: string, asks: { id: string, policyBasis: string }[] }
}

interface Cursor {
  since: string
  page: number
  confirmation?: { signature: string, through: string }
}

export class GitHubChannel {
  private readonly publishing = new Map<string, Promise<{ ok: boolean, reason?: string, remoteId?: string }>>()

  constructor(private readonly database: NexusDatabase, private readonly runner: GhRunner) {}

  async selectEnvironment(projectId: string, selection: EnvironmentSelection, signal?: AbortSignal): Promise<EnvironmentStatus> {
    const project = this.project(projectId)
    const site = project.repository!.split('/')[0]!
    if (selection.site !== site || !selection.login.trim())
      throw new GhError('environment_mismatch')
    ledger.saveChannel(this.database, channelId, 'GitHub', true)
    this.save(project.repository!, 'environment', selection)
    if (!this.state(project.repository!, 'baseline'))
      this.save(project.repository!, 'baseline', now())
    return this.verifyEnvironment(projectId, signal)
  }

  async verifyEnvironment(projectId: string, signal?: AbortSignal): Promise<EnvironmentStatus> {
    const project = this.project(projectId)
    const repository = project.repository!
    const selection = this.state<EnvironmentSelection & { providerId?: string }>(repository, 'environment')
    const status: EnvironmentStatus = { available: false, reason: null, repository, site: selection?.site ?? null, login: selection?.login ?? null, checkedAt: now() }
    try {
      if (!project.enabled || !project.available)
        throw new GhError('project_unavailable')
      if (!selection)
        throw new GhError('environment_not_selected')
      const account = user(await this.runner.request({ site: selection.site, method: 'GET', path: 'user', signal }))
      if (account.login.toLowerCase() !== selection.login.toLowerCase() || (selection.providerId && selection.providerId !== account.id))
        throw new GhError('account_mismatch')
      const remote = object(await this.runner.request({ site: selection.site, method: 'GET', path: `repos/${repository.split('/').slice(1).join('/')}`, signal }))
      const repositoryId = identity(remote.id)
      if ((`${selection.site}/${text(remote.full_name)}`).toLowerCase() !== repository)
        throw new GhError('repository_mismatch')
      const previous = this.state<EnvironmentStatus>(repository, 'verified_environment')
      if (previous?.repositoryId && previous.repositoryId !== repositoryId)
        throw new GhError('repository_mismatch')
      status.available = true
      status.providerId = account.id
      status.repositoryId = repositoryId
      this.save(repository, 'verified_environment', status)
      this.save(repository, 'environment', { ...selection, providerId: account.id })
    }
    catch (error) {
      status.reason = failure(error)
    }
    if (selection)
      this.save(repository, 'environment_status', status)
    return status
  }

  async collect(projectId: string, signal?: AbortSignal): Promise<{ ok: boolean, reason?: string }> {
    const environment = await this.verifyEnvironment(projectId, signal)
    if (!environment.available)
      return { ok: false, reason: environment.reason! }
    const repository = environment.repository
    const baseline = this.state<string>(repository, 'baseline') ?? now()
    this.save(repository, 'baseline', baseline)
    const cursor = this.state<Cursor>(repository, 'issues_cursor') ?? { since: baseline, page: 1 }
    const startedAt = now()
    const errors: string[] = []
    const observed: string[] = []
    try {
      let page = 1
      while (true) {
        const path = `repos/${repository.split('/').slice(1).join('/')}/issues?state=all&sort=updated&direction=asc&per_page=100&page=${page}&since=${encodeURIComponent(cursor.since)}`
        const topics = array(await this.runner.request({ site: environment.site!, method: 'GET', path, signal })).map(topic)
        const sources = new Map(ledger.list(this.database, 'source_state').filter(row => row.channelId === channelId).map(row => [row.name, row.value]))
        for (const item of topics) {
          this.recordTopic(projectId, repository, baseline, item, sources)
          observed.push(`${item.id}:${revision(item)}`)
        }
        this.save(repository, 'issues_cursor', { ...cursor, page: page + 1 })
        if (topics.length < 100)
          break
        page++
      }
      this.save(repository, 'issues_cursor', confirmedCursor(cursor, observed, startedAt, baseline))
    }
    catch (error) {
      errors.push(failure(error))
    }
    const subscribed = new Set(ledger.list(this.database, 'ticket_thread').map(link => link.threadId))
    for (const publication of ledger.list(this.database, 'outbox'))
      subscribed.add(publication.recipient)
    for (const thread of ledger.list(this.database, 'thread').filter(thread => thread.repository === repository && subscribed.has(thread.id))) {
      const result = await this.collectTopic(projectId, thread.id, signal)
      if (!result.ok)
        errors.push(result.reason!)
      if (thread.kind === 'pull') {
        const fact = await this.collectPullRequest(projectId, thread.id, signal)
        if (!fact.ok)
          errors.push(fact.reason!)
      }
    }
    const result = { ok: errors.length === 0, ...(errors.length ? { reason: errors[0] } : {}) }
    this.save(repository, 'collection_status', { ...result, collectedAt: now() })
    return result
  }

  async collectTopic(projectId: string, threadId: string, signal?: AbortSignal): Promise<{ ok: boolean, reason?: string, answers: AnswerResult[] }> {
    const environment = await this.verifyEnvironment(projectId, signal)
    if (!environment.available)
      return { ok: false, reason: environment.reason!, answers: [] }
    const repository = environment.repository
    const thread = this.thread(projectId, threadId)
    const baseline = this.state<string>(repository, 'baseline') ?? now()
    this.save(repository, 'baseline', baseline)
    const answers: AnswerResult[] = []
    const streams = [`issues/${resourceNumber(thread)}/comments`]
    if (thread.kind === 'pull')
      streams.push(`pulls/${resourceNumber(thread)}/comments`, `pulls/${resourceNumber(thread)}/reviews`)
    const errors: string[] = []
    for (const stream of streams) {
      const cursorKey = `cursor:${thread.id}:${stream}`
      const cursor = this.state<Cursor>(repository, cursorKey)
      const startedAt = now()
      const observed: string[] = []
      try {
        let page = 1
        while (true) {
          const path = `repos/${repository.split('/').slice(1).join('/')}/${stream}?per_page=100&page=${page}${cursor?.since && !stream.endsWith('/reviews') ? `&since=${encodeURIComponent(cursor.since)}` : ''}`
          const items = array(await this.runner.request({ site: environment.site!, method: 'GET', path, signal })).map(comment)
          for (const item of items) {
            answers.push(...await this.recordComment(projectId, thread, stream, baseline, item, signal))
            observed.push(`${item.id}:${revision(item)}`)
          }
          this.save(repository, cursorKey, { ...cursor, since: cursor?.since ?? '', page: page + 1 })
          if (items.length < 100)
            break
          page++
        }
        this.save(repository, cursorKey, confirmedCursor(cursor ?? { since: '', page: 1 }, observed, startedAt, ''))
      }
      catch (error) {
        errors.push(failure(error))
      }
    }
    const result = { ok: errors.length === 0, ...(errors.length ? { reason: errors[0] } : {}), answers }
    this.save(repository, `topic_status:${thread.id}`, { ...result, collectedAt: now() })
    return result
  }

  async publish(outboxId: string, signal?: AbortSignal): Promise<{ ok: boolean, reason?: string, remoteId?: string }> {
    const item = ledger.load(this.database, 'outbox', outboxId)
    if (!item)
      return { ok: false, reason: 'outbox_not_found' }
    const previous = this.publishing.get(item.recipient) ?? Promise.resolve({ ok: true })
    const operation = previous.then(() => this.deliver(outboxId, signal), () => this.deliver(outboxId, signal))
    this.publishing.set(item.recipient, operation)
    try {
      return await operation
    }
    finally {
      if (this.publishing.get(item.recipient) === operation)
        this.publishing.delete(item.recipient)
    }
  }

  private async deliver(outboxId: string, signal?: AbortSignal): Promise<{ ok: boolean, reason?: string, remoteId?: string }> {
    const item = ledger.load(this.database, 'outbox', outboxId)
    if (!item)
      return { ok: false, reason: 'outbox_not_found' }
    const thread = ledger.load(this.database, 'thread', item.recipient)
    if (!thread?.projectId)
      return { ok: false, reason: 'topic_mismatch' }
    const environment = await this.verifyEnvironment(thread.projectId, signal)
    if (!environment.available)
      return { ok: false, reason: environment.reason! }
    const repository = environment.repository
    const name = `managed:${thread.id}`
    const managed = this.state<ManagedComment>(repository, name) ?? { providerId: environment.providerId!, marker: `<!-- nexus:${revision(thread.id)} -->` }
    const root = `repos/${repository.split('/').slice(1).join('/')}`
    try {
      this.thread(thread.projectId, thread.id)
      const publications = ledger.list(this.database, 'outbox').filter(row => row.recipient === thread.id)
      if (managed.pending) {
        const pending = ledger.load(this.database, 'outbox', managed.pending.outboxId)!
        let remote: Comment | undefined
        if (managed.remoteId) {
          remote = comment(await this.runner.request({ site: environment.site!, method: 'GET', path: `${root}/issues/comments/${managed.remoteId}`, signal }))
        }
        else {
          const candidates = await this.remoteComments(environment.site!, root, thread, signal)
          const matching = candidates.filter(row => row.user.id === managed.providerId && row.body.includes(managed.marker))
          if (matching.length > 1)
            throw new GhError('managed_comment_conflict')
          remote = matching[0]
        }
        if (!remote)
          throw new GhError('write_result_unknown')
        this.verifyManaged(remote, managed)
        managed.remoteId = remote.id
        managed.remoteUrl = remote.url
        if (revision(remote.body) === managed.pending.bodyHash) {
          if (pending.state !== 'sent')
            ledger.updateOutbox(this.database, pending.id, 'sent', '', remote.id, remote.url)
          this.recordPublishedAsks(repository, managed.pending.asks)
          managed.pending = undefined
          this.save(repository, name, managed)
          this.save(repository, `retry:${pending.id}`, null)
          this.save(repository, `delivery_status:${pending.id}`, { ok: true, remoteId: remote.id, at: now() })
          if (pending.id === item.id)
            return { ok: true, remoteId: remote.id }
        }
        else {
          ledger.updateOutbox(this.database, pending.id, 'failed', 'write_not_observed', remote.id, remote.url)
          managed.pending = undefined
          this.save(repository, name, managed)
          throw new GhError('write_not_observed')
        }
      }
      if (item.supersededAt && item.state !== 'sent')
        throw new GhError('delivery_superseded')
      if (publications.some(row => row.ticketId === item.ticketId && row.seq < item.seq && !row.supersededAt && row.state !== 'sent'))
        throw new GhError('delivery_order')
      const settings = ledger.getSettings(this.database)
      const retry = this.state<{ attempts: number, nextRetryAt: string }>(repository, `retry:${item.id}`)
      if ((item.state !== 'sent' && item.attempts >= settings.deliveryMaxAttempts) || (retry?.attempts ?? 0) >= settings.deliveryMaxAttempts)
        throw new GhError('retry_exhausted')
      if (retry && retry.nextRetryAt > now())
        throw new GhError('retry_not_due')
      this.writable(thread, item)
      let remoteHash: string | undefined
      if (managed.remoteId) {
        try {
          const remote = comment(await this.runner.request({ site: environment.site!, method: 'GET', path: `${root}/issues/comments/${managed.remoteId}`, signal }))
          this.verifyManaged(remote, managed)
          remoteHash = revision(remote.body)
        }
        catch (error) {
          if (!(error instanceof GhError) || error.code !== 'not_found')
            throw error
          const visible = await this.remoteComments(environment.site!, root, thread, signal)
          if (visible.some(row => row.id === managed.remoteId))
            throw new GhError('comment_inaccessible')
          managed.remoteId = undefined
          managed.remoteUrl = undefined
        }
      }
      const visible = publications.filter(row => row.state === 'sent' || row.remoteId || row.id === item.id)
      const { body: rendered, asks } = this.render(thread, managed.marker, visible)
      const bodyHash = revision(rendered)
      if (remoteHash === bodyHash && managed.remoteId) {
        this.recordPublishedAsks(repository, asks)
        if (item.state !== 'sent')
          ledger.updateOutbox(this.database, item.id, 'sent', '', managed.remoteId, managed.remoteUrl)
        this.save(repository, `retry:${item.id}`, null)
        return { ok: true, remoteId: managed.remoteId }
      }
      if (!managed.remoteId)
        managed.providerId = environment.providerId!
      this.save(repository, `retry:${item.id}`, { attempts: (retry?.attempts ?? 0) + 1, nextRetryAt: now() })
      managed.pending = { outboxId: item.id, bodyHash, asks }
      this.save(repository, name, managed)
      if (item.state !== 'sent')
        ledger.updateOutbox(this.database, item.id, 'unknown', 'write_in_progress', managed.remoteId, managed.remoteUrl)
      this.writable(thread, item)
      const response = comment(await this.runner.request({ site: environment.site!, method: managed.remoteId ? 'PATCH' : 'POST', path: managed.remoteId ? `${root}/issues/comments/${managed.remoteId}` : `${root}/issues/${resourceNumber(thread)}/comments`, body: { body: rendered }, signal }))
      if (response.user.id !== managed.providerId)
        throw new GhError('invalid_write_receipt')
      managed.remoteId = response.id
      managed.remoteUrl = response.url
      this.recordPublishedAsks(repository, asks)
      managed.pending = undefined
      this.save(repository, name, managed)
      if (item.state !== 'sent')
        ledger.updateOutbox(this.database, item.id, 'sent', '', response.id, response.url)
      this.save(repository, `retry:${item.id}`, null)
      this.save(repository, `delivery_status:${item.id}`, { ok: true, remoteId: response.id, at: now() })
      return { ok: true, remoteId: response.id }
    }
    catch (error) {
      const reason = failure(error)
      if (managed.pending && error instanceof GhError && ['forbidden', 'not_found', 'remote_rejected', 'rate_limited', 'not_logged_in', 'gh_missing'].includes(reason)) {
        managed.pending = undefined
        this.save(repository, name, managed)
        if (item.state !== 'sent')
          ledger.updateOutbox(this.database, item.id, 'failed', reason)
        const attempts = ledger.load(this.database, 'outbox', item.id)!.attempts
        const delay = Math.max(error.retryAfterSeconds ?? 0, Math.min(2 ** attempts, ledger.getSettings(this.database).deliveryRetryCeilingSeconds))
        this.save(repository, `retry:${item.id}`, { attempts: this.state<{ attempts: number }>(repository, `retry:${item.id}`)!.attempts, nextRetryAt: new Date(Date.now() + delay * 1000).toISOString() })
      }
      this.save(repository, `delivery_status:${item.id}`, { ok: false, reason, at: now() })
      return { ok: false, reason }
    }
  }

  async collectPullRequest(projectId: string, threadId: string, signal?: AbortSignal): Promise<{ ok: boolean, reason?: string, fact?: PullRequestFact }> {
    const environment = await this.verifyEnvironment(projectId, signal)
    if (!environment.available)
      return { ok: false, reason: environment.reason! }
    try {
      const thread = this.thread(projectId, threadId)
      if (thread.kind !== 'pull')
        throw new GhError('not_pull_request')
      const fact = await this.readPullRequest(environment, thread, signal)
      const status = this.state<{ ok: boolean, reason?: string }>(environment.repository, `pr_status:${thread.id}`)!
      return { ...status, fact }
    }
    catch (error) {
      const reason = failure(error)
      this.save(environment.repository, `pr_status:${threadId}`, { ok: false, reason, at: now() })
      return { ok: false, reason }
    }
  }

  async merge(askId: string, signal?: AbortSignal): Promise<{ ok: boolean, reason?: string, state?: string }> {
    const ask = ledger.load(this.database, 'ask', askId)
    const links = ledger.list(this.database, 'ask_ticket').filter(link => link.askId === askId)
    if (!ask?.target || links.length !== 1)
      return { ok: false, reason: 'invalid_merge_decision' }
    const target: MergeTarget = JSON.parse(ask.target)
    const ticket = ledger.load(this.database, 'ticket', links[0]!.ticketId)!
    const environment = await this.verifyEnvironment(ticket.projectId, signal)
    if (!environment.available)
      return { ok: false, reason: environment.reason! }
    const repository = environment.repository
    const statusKey = `merge_status:${askId}`
    try {
      if (target.repository !== repository)
        throw new GhError('repository_mismatch')
      const number = pullNumber(target)
      const thread = ledger.list(this.database, 'thread').find(row => row.repository === repository && row.kind === 'pull' && resourceNumber(row) === number && row.projectId === ticket.projectId)
      if (!thread || !this.subscriptions(thread.id).includes(ticket.id))
        throw new GhError('topic_mismatch')
      const fact = await this.readPullRequest(environment, thread, signal)
      if (fact.state === 'merged') {
        this.save(repository, statusKey, { state: 'merged', target: fact.target, at: now() })
        return { ok: true, state: 'already_merged' }
      }
      const previous = this.state<{ state: string, attempts: number, nextRetryAt?: string }>(repository, statusKey)
      if (previous?.state === 'unknown') {
        this.save(repository, statusKey, { ...previous, state: 'failed', reason: 'merge_not_observed', target, at: now() })
        return { ok: false, reason: 'merge_not_observed' }
      }
      if (fact.state !== 'open')
        throw new GhError('pull_request_closed')
      if (fact.target.head !== target.head)
        throw new GhError('head_changed')
      if (fact.target.base !== target.base)
        throw new GhError('base_changed')
      const settings = ledger.getSettings(this.database)
      if (previous && previous.attempts >= settings.deliveryMaxAttempts)
        throw new GhError('retry_exhausted')
      if (previous?.nextRetryAt && previous.nextRetryAt > now())
        throw new GhError('retry_not_due')
      const verified = await this.repositoryRequirements(environment, fact, signal)
      if (!verified)
        throw new GhError('repository_requirements_unsatisfied')
      if (!ledger.resolveMerge(this.database, askId, target, verified))
        throw new GhError('decision_invalid')
      const attempts = (previous?.attempts ?? 0) + 1
      this.save(repository, statusKey, { state: 'unknown', attempts, target, at: now() })
      const root = `repos/${repository.split('/').slice(1).join('/')}`
      const receipt = object(await this.runner.request({ site: environment.site!, method: 'PUT', path: `${root}/pulls/${number}/merge`, body: { sha: target.head, merge_method: 'merge' }, signal }))
      if (receipt.merged !== true)
        throw new GhError('remote_rejected')
      const actual = await this.readPullRequest(environment, thread, signal)
      if (actual.state !== 'merged')
        throw new GhError('write_result_unknown')
      this.save(repository, statusKey, { state: 'merged', attempts, target: actual.target, mergeSha: text(receipt.sha), at: now() })
      return { ok: true, state: 'merged' }
    }
    catch (error) {
      const reason = failure(error)
      const previous = this.state<{ state: string, attempts: number }>(repository, statusKey)
      const unknown = previous?.state === 'unknown' && !['remote_rejected', 'forbidden', 'not_found', 'not_logged_in', 'gh_missing', 'rate_limited'].includes(reason)
      const attempts = previous?.attempts ?? 0
      const settings = ledger.getSettings(this.database)
      const delay = Math.max(error instanceof GhError ? error.retryAfterSeconds ?? 0 : 0, Math.min(2 ** attempts, settings.deliveryRetryCeilingSeconds))
      this.save(repository, statusKey, { state: unknown ? 'unknown' : 'failed', attempts, reason, target, at: now(), nextRetryAt: new Date(Date.now() + delay * 1000).toISOString() })
      return { ok: false, reason }
    }
  }

  status(projectId: string): { name: string, value: unknown, updatedAt: string }[] {
    const repository = this.project(projectId).repository!
    const prefix = key(repository, '')
    return ledger.list(this.database, 'source_state').filter(row => row.channelId === channelId && row.name.startsWith(prefix) && /^(?:environment_status|collection_status|topic_status:|delivery_status:|pr_status:|merge_status:|answer_result:)/.test(row.name.slice(prefix.length))).map(row => ({ name: row.name.slice(prefix.length), value: JSON.parse(row.value) as unknown, updatedAt: row.updatedAt }))
  }

  intake(projectId: string): Intake[] {
    const repository = this.project(projectId).repository!
    return ledger.list(this.database, 'source_state').filter(row => row.channelId === channelId && row.name.startsWith(key(repository, 'intake:'))).map(row => JSON.parse(row.value) as Intake).filter(item => !item.acknowledged)
  }

  acknowledgeIntake(projectId: string, id: string): void {
    const repository = this.project(projectId).repository!
    const item = this.state<Intake>(repository, `intake:${id}`)
    if (!item)
      throw new GhError('intake_not_found')
    this.save(repository, `intake:${id}`, { ...item, acknowledged: true })
  }

  private recordTopic(projectId: string, repository: string, baseline: string, item: Topic, sources: Map<string, string>): void {
    const id = `${repository}:topic:${item.id}:${revision(item)}`
    if (sources.has(key(repository, `handled:${id}`)))
      return
    const thread = ledger.recordThread(this.database, { channelId, repository, kind: item.pull ? 'pull' : 'issue', resourceId: String(item.number), title: item.title, url: item.url, projectId })
    const actor = this.actor(JSON.parse(sources.get(key(repository, 'environment'))!) as EnvironmentSelection, item.user, false)
    const historical = item.createdAt < baseline
    const storedAdmission = sources.get(key(repository, `admission:${item.id}`))
    const admission = storedAdmission ? JSON.parse(storedAdmission) as { triggerId: string, authorized: boolean } : { triggerId: id, authorized: !historical && policy.peek(actor, JSON.parse(ledger.getSettings(this.database).whitelist)) }
    this.save(repository, `admission:${item.id}`, admission)
    sources.set(key(repository, `admission:${item.id}`), JSON.stringify(admission))
    this.save(repository, `revision:${id}`, item)
    ledger.recordTrigger(this.database, { id, threadId: thread.id, kind: 'open', text: item.body || item.title, at: item.updatedAt, mentioned: false, url: item.url, ref: item.id }, actor)
    const ticketIds = this.subscriptions(thread.id)
    const triage = admission.triggerId === id && admission.authorized
    if (triage) {
      const intake: Intake = { id, kind: 'triage', projectId, threadId: thread.id, triggerId: id, ticketIds, historical, acknowledged: false }
      this.save(repository, `intake:${id}`, intake)
    }
    else if (ticketIds.length) {
      this.save(repository, `intake:${id}`, { id, kind: 'context', projectId, threadId: thread.id, triggerId: id, ticketIds, historical, acknowledged: false } satisfies Intake)
    }
    this.save(repository, `handled:${id}`, true)
    sources.set(key(repository, `handled:${id}`), 'true')
  }

  private async readPullRequest(environment: EnvironmentStatus, thread: Row<'thread'>, signal?: AbortSignal): Promise<PullRequestFact> {
    const repository = environment.repository
    const collectedAt = now()
    const number = resourceNumber(thread)
    const root = `repos/${repository.split('/').slice(1).join('/')}`
    const remote = object(await this.runner.request({ site: environment.site!, method: 'GET', path: `${root}/pulls/${number}`, signal }))
    const head = text(object(remote.head).sha)
    const base = object(remote.base)
    const url = text(remote.html_url)
    if (remote.number !== number || text(object(base.repo).full_name).toLowerCase() !== repository.split('/').slice(1).join('/') || url.toLowerCase() !== `https://${repository}/pull/${number}`)
      throw new GhError('pull_request_mismatch')
    if (!['open', 'closed'].includes(String(remote.state)) || typeof remote.merged !== 'boolean')
      throw new GhError('invalid_response')
    const checks: Record<string, unknown>[] = []
    const statuses: Record<string, unknown>[] = []
    const previous = this.state<PullRequestFact>(repository, `pr_fact:${thread.id}`)
    let ciError: string | null = null
    try {
      for (const kind of ['check-runs', 'status']) {
        let page = 1
        while (true) {
          const response = object(await this.runner.request({ site: environment.site!, method: 'GET', path: `${root}/commits/${encodeURIComponent(head)}/${kind}?per_page=100&page=${page}`, signal }))
          if (kind === 'status' && response.sha !== head)
            throw new GhError('ci_head_mismatch')
          const items = array(response[kind === 'status' ? 'statuses' : 'check_runs']).map(object)
          if (kind === 'status')
            statuses.push(...items)
          else
            checks.push(...items.filter(item => item.head_sha === head))
          if (items.length < 100)
            break
          page++
        }
      }
    }
    catch (error) {
      ciError = failure(error)
    }
    const previousRuns = this.state<{ checks: Record<string, unknown>[], statuses: Record<string, unknown>[] }>(repository, `ci_runs:${thread.id}:${head}`) ?? { checks: [], statuses: [] }
    const latestChecks = new Map<string, Record<string, unknown>>()
    for (const check of [...previousRuns.checks, ...checks]) {
      const name = `${identity(object(check.app).id)}:${text(check.name)}`
      const previous = latestChecks.get(name)
      const newer = !previous || Number(check.id) > Number(previous.id) || (check.id === previous.id && timestamp(check.completed_at ?? check.started_at ?? check.created_at) >= timestamp(previous.completed_at ?? previous.started_at ?? previous.created_at) && !(previous.status === 'completed' && check.status !== 'completed'))
      if (newer)
        latestChecks.set(name, check)
    }
    const latestStatuses = new Map<string, Record<string, unknown>>()
    for (const status of [...previousRuns.statuses, ...statuses]) {
      const name = text(status.context)
      const previous = latestStatuses.get(name)
      if (!previous || timestamp(status.updated_at) > timestamp(previous.updated_at) || (timestamp(status.updated_at) === timestamp(previous.updated_at) && Number(status.id) > Number(previous.id)))
        latestStatuses.set(name, status)
    }
    const states = [...latestChecks.values()].map(check => check.status === 'in_progress' ? 'running' : check.status !== 'completed' ? 'pending' : ['success', 'neutral', 'skipped'].includes(String(check.conclusion)) ? 'passing' : 'failing')
    states.push(...[...latestStatuses.values()].map(status => status.state === 'success' ? 'passing' : status.state === 'pending' ? 'pending' : 'failing'))
    const ciState = ciError ? previous?.target.head === head ? previous.ciState : 'pending' : states.includes('failing') ? 'failing' : states.includes('running') ? 'running' : !states.length || states.includes('pending') ? 'pending' : 'passing'
    const fact: PullRequestFact = { number, target: { repository, pullRequest: url, base: text(base.ref), head }, state: remote.merged ? 'merged' : remote.state as 'open' | 'closed', ciState, updatedAt: timestamp(remote.updated_at), collectedAt, ciCollectedAt: ciError ? previous?.target.head === head ? previous.ciCollectedAt : null : collectedAt }
    this.save(repository, `pr_revision:${thread.id}:${revision(fact)}`, fact)
    this.save(repository, `pr_status:${thread.id}`, { ok: !ciError, ...(ciError ? { reason: ciError } : {}), collectedAt })
    if (previous && (previous.collectedAt > collectedAt || previous.updatedAt > fact.updatedAt || (previous.state === 'merged' && fact.state !== 'merged')))
      return previous
    this.save(repository, `ci_runs:${thread.id}:${head}`, { checks: [...latestChecks.values()], statuses: [...latestStatuses.values()] })
    this.save(repository, `ci_evidence:${thread.id}`, { head, checks: [...latestChecks.values()].map(check => ({ name: text(check.name), appId: identity(object(check.app).id), passing: check.status === 'completed' && ['success', 'neutral', 'skipped'].includes(String(check.conclusion)) })).concat([...latestStatuses.values()].map(status => ({ name: text(status.context), appId: '', passing: status.state === 'success' }))) })
    for (const ticketId of this.subscriptions(thread.id)) {
      const ticket = ledger.load(this.database, 'ticket', ticketId)!
      const target = ticket.deliveryTarget ? JSON.parse(ticket.deliveryTarget) as MergeTarget : null
      if (target?.repository === repository && pullNumber(target) === number)
        ledger.recordPullRequest(this.database, ticketId, { ...fact.target, pullRequest: target.pullRequest }, fact.state, ciState)
    }
    this.save(repository, `pr_fact:${thread.id}`, fact)
    const content = { ...fact, collectedAt: null, ciCollectedAt: null }
    const id = `${repository}:pr-fact:${number}:${revision(content)}`
    const actor: Actor = { kind: 'github', verified: true, providerId: environment.providerId!, login: environment.login!, bot: true, outbound: false }
    ledger.recordTrigger(this.database, { id, threadId: thread.id, kind: 'ci', text: JSON.stringify(content), at: collectedAt, mentioned: false, ref: head, url }, actor)
    if (!this.state(repository, `intake:${id}`))
      this.save(repository, `intake:${id}`, { id, kind: 'facts', projectId: thread.projectId!, threadId: thread.id, triggerId: id, ticketIds: this.subscriptions(thread.id), historical: false, acknowledged: false } satisfies Intake)
    return fact
  }

  private async repositoryRequirements(environment: EnvironmentStatus, fact: PullRequestFact, signal?: AbortSignal): Promise<boolean> {
    if (!this.state<{ ok: boolean }>(environment.repository, `pr_status:${environment.repository}:pull:${fact.number}`)!.ok)
      throw new GhError('ci_unavailable')
    const [, owner, name] = environment.repository.split('/')
    const query = 'query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){nameWithOwner pullRequest(number:$number){number headRefOid baseRefName mergeable mergeStateStatus reviewDecision baseRef{branchProtectionRule{requiresStatusChecks requiredStatusCheckContexts requiredStatusChecks{context app{databaseId}} requiresApprovingReviews requiresConversationResolution requiresCommitSignatures requiresLinearHistory requiresDeployments lockBranch restrictsPushes requiredDeploymentEnvironments}} commits(last:1){nodes{commit{oid statusCheckRollup{state}}}}}}}'
    const response = object(await this.runner.request({ site: environment.site!, method: 'POST', path: 'graphql', body: { query, variables: { owner, name, number: fact.number } }, signal }))
    if (response.errors)
      throw new GhError('requirements_unavailable')
    const repo = object(object(response.data).repository)
    const pull = object(repo.pullRequest)
    if (text(repo.nameWithOwner).toLowerCase() !== `${owner}/${name}` || pull.number !== fact.number || pull.headRefOid !== fact.target.head || pull.baseRefName !== fact.target.base)
      throw new GhError('preflight_target_changed')
    if (pull.mergeable !== 'MERGEABLE' || pull.mergeStateStatus !== 'CLEAN' || (pull.reviewDecision !== null && pull.reviewDecision !== 'APPROVED'))
      return false
    const protection = object(pull.baseRef).branchProtectionRule
    const rule = protection === null ? null : object(protection)
    if (rule?.requiresApprovingReviews === true && pull.reviewDecision !== 'APPROVED')
      return false
    if (rule && (rule.requiresConversationResolution || rule.requiresCommitSignatures || rule.requiresLinearHistory || rule.requiresDeployments || rule.lockBranch || rule.restrictsPushes || array(rule.requiredDeploymentEnvironments).length))
      throw new GhError('unsupported_repository_requirement')
    const threadId = `${environment.repository}:pull:${fact.number}`
    const evidence = this.state<{ head: string, checks: { name: string, appId: string, passing: boolean }[] }>(environment.repository, `ci_evidence:${threadId}`)!
    if (evidence.head !== fact.target.head)
      return false
    const passes = (context: string, appId?: string): boolean => evidence.checks.some(check => check.name === context && check.passing && (!appId || appId === '-1' || check.appId === appId))
    if (rule?.requiresStatusChecks) {
      if (array(rule.requiredStatusCheckContexts).some(context => !passes(text(context))))
        return false
      if (array(rule.requiredStatusChecks).some((value) => {
        const check = object(value)
        return !passes(text(check.context), check.app ? identity(object(check.app).databaseId) : undefined)
      })) {
        return false
      }
    }
    let checksRequired = rule?.requiresStatusChecks === true
    const root = `repos/${environment.repository.split('/').slice(1).join('/')}`
    let page = 1
    while (true) {
      const rules = array(await this.runner.request({ site: environment.site!, method: 'GET', path: `${root}/rules/branches/${encodeURIComponent(fact.target.base)}?per_page=100&page=${page}`, signal })).map(object)
      for (const rule of rules) {
        const parameters = object(rule.parameters)
        if (rule.type === 'required_status_checks') {
          checksRequired = true
          if (array(parameters.required_status_checks).some((value) => {
            const check = object(value)
            return !passes(text(check.context), check.integration_id == null ? undefined : identity(check.integration_id))
          })) {
            return false
          }
        }
        else if (rule.type === 'pull_request') {
          if (parameters.required_review_thread_resolution)
            throw new GhError('unsupported_repository_requirement')
          if ((Number(parameters.required_approving_review_count) > 0 || parameters.require_code_owner_review || parameters.require_last_push_approval) && pull.reviewDecision !== 'APPROVED')
            return false
        }
        else {
          throw new GhError('unsupported_repository_requirement')
        }
      }
      if (rules.length < 100)
        break
      page++
    }
    const commits = array(object(pull.commits).nodes)
    if (commits.length !== 1)
      return false
    const commit = object(object(commits[0]).commit)
    if (commit.oid !== fact.target.head)
      return false
    if (commit.statusCheckRollup === null)
      return !checksRequired
    return object(commit.statusCheckRollup).state === 'SUCCESS' && fact.ciState === 'passing'
  }

  private writable(thread: Row<'thread'>, item: Row<'outbox'>): void {
    const project = this.project(thread.projectId!)
    if (!project.enabled || !project.available)
      throw new GhError('project_unavailable')
    if (item.ticketId && ledger.load(this.database, 'ticket', item.ticketId)!.paused)
      throw new GhError('human_paused')
    if (item.state !== 'sent' && ledger.load(this.database, 'outbox', item.id)!.supersededAt)
      throw new GhError('delivery_superseded')
  }

  private verifyManaged(remote: Comment, managed: ManagedComment): void {
    if (remote.user.id !== managed.providerId || !remote.body.includes(managed.marker))
      throw new GhError('managed_comment_mismatch')
  }

  private async remoteComments(site: string, root: string, thread: Row<'thread'>, signal?: AbortSignal): Promise<Comment[]> {
    const result: Comment[] = []
    let page = 1
    while (true) {
      const items = array(await this.runner.request({ site, method: 'GET', path: `${root}/issues/${resourceNumber(thread)}/comments?per_page=100&page=${page}`, signal })).map(comment)
      result.push(...items)
      if (items.length < 100)
        return result
      page++
    }
  }

  private recordPublishedAsks(repository: string, asks: { id: string, policyBasis: string }[]): void {
    for (const ask of asks)
      this.save(repository, `published_ask:${ask.id}`, { policyBasis: ask.policyBasis })
  }

  private render(thread: Row<'thread'>, marker: string, publications: Row<'outbox'>[]): { body: string, asks: { id: string, policyBasis: string }[] } {
    const askIds = [...new Set(publications.map(item => item.askId).filter((id): id is string => !!id))]
    const asks: { id: string, policyBasis: string }[] = []
    const sections = [marker, 'Nexus：请使用独立一行「回答 完整askId：答案」逐题回答。评论更新不代表已读。']
    for (const id of askIds) {
      const ask = ledger.load(this.database, 'ask', id)!
      asks.push({ id, policyBasis: ask.policyBasis })
      sections.push(`<!-- nexus-ask:${revision({ id, policyBasis: ask.policyBasis })} -->`)
      const tickets = ledger.list(this.database, 'ask_ticket').filter(link => link.askId === id).map(link => link.ticketId)
      sections.push(`askId: ${ask.id}\n工单: ${tickets.join(', ') || 'main 分诊'}\n状态: ${ask.status}\n问题: ${ask.content}\n选项: ${(JSON.parse(ask.options) as string[]).join(', ')}`)
      if (ask.target) {
        const target = JSON.parse(ask.target)
        sections.push(`PR: ${target.pullRequest}\nbase: ${target.base}\nhead: ${target.head}`)
      }
      if (ask.answer)
        sections.push(`答案: ${ask.answer} (${ask.answerSource})`)
    }
    for (const message of publications.filter(item => !item.askId && !item.supersededAt).slice(-5))
      sections.push(message.content)
    const rejected = ledger.list(this.database, 'source_state').filter(row => row.channelId === channelId && row.name.startsWith(key(thread.repository!, `answer_result:${thread.id}:`))).slice(-5)
    for (const result of rejected)
      sections.push(`答复结果: ${result.value}`)
    return { body: sections.join('\n\n'), asks }
  }

  private async recordComment(projectId: string, thread: Row<'thread'>, stream: string, baseline: string, item: Comment, signal?: AbortSignal): Promise<AnswerResult[]> {
    const repository = thread.repository!
    const source = stream.endsWith('/reviews') ? 'review' : stream.startsWith('pulls/') ? 'review-comment' : 'comment'
    const id = `${repository}:${source}:${item.id}:${revision(item)}`
    const previous = this.state<AnswerResult[]>(repository, `handled:${id}`)
    if (previous)
      return previous
    const managed = this.state<ManagedComment>(repository, `managed:${thread.id}`)
    const outbound = ledger.list(this.database, 'outbox').some(row => row.recipient === thread.id && row.remoteId === item.id)
      || managed?.remoteId === item.id || (!!managed && managed.providerId === item.user.id && item.body.includes(managed.marker))
    const actor = this.actor(this.state<EnvironmentSelection>(repository, 'environment')!, item.user, outbound)
    this.save(repository, `revision:${id}`, item)
    ledger.recordTrigger(this.database, { id, threadId: thread.id, kind: 'comment', text: item.body || '(empty)', at: item.updatedAt, mentioned: false, url: item.url, ref: `${source}:${item.id}` }, actor)
    const historical = item.updatedAt < baseline
    const ticketIds = this.subscriptions(thread.id)
    if (ticketIds.length)
      this.save(repository, `intake:${id}`, { id, kind: 'context', projectId, threadId: thread.id, triggerId: id, ticketIds, historical, acknowledged: false } satisfies Intake)
    const results: AnswerResult[] = []
    for (const [askId, values] of answerLines(item.body)) {
      let result: string
      try {
        if (values.size !== 1)
          throw new GhError('conflicting_answers')
        if (historical)
          throw new GhError('historical_context')
        if (actor.kind !== 'github')
          throw new GhError('invalid_source')
        if (actor.outbound)
          throw new GhError('outbound')
        if (actor.bot || actor.login.toLowerCase().endsWith('[bot]'))
          throw new GhError('automation')
        if (!policy.peek(actor, JSON.parse(ledger.getSettings(this.database).whitelist)))
          throw new GhError('not_whitelisted')
        const ask = ledger.load(this.database, 'ask', askId)
        if (!ask)
          throw new GhError('unknown_ask')
        const publication = ledger.list(this.database, 'outbox').find(row => row.askId === askId && row.recipient === thread.id && row.remoteId)
        if (!publication)
          throw new GhError('wrong_topic')
        if (ask.status !== 'pending')
          throw new GhError(`ask_${ask.status}`)
        const published = this.state<{ policyBasis: string }>(repository, `published_ask:${askId}`)
        if (published && published.policyBasis !== ask.policyBasis)
          throw new GhError('policy_changed')
        const target: MergeTarget | undefined = ask.target ? JSON.parse(ask.target) : undefined
        let verified = false
        if (target) {
          if (thread.kind !== 'pull' || target.repository !== repository || pullNumber(target) !== resourceNumber(thread))
            throw new GhError('wrong_topic')
          const environment = this.state<EnvironmentStatus>(repository, 'environment_status')!
          const fact = await this.readPullRequest(environment, thread, signal)
          if (fact.target.head !== target.head || fact.target.base !== target.base || fact.state !== 'open')
            throw new GhError('stale_target')
          if ([...values][0] === 'allow_merge') {
            verified = await this.repositoryRequirements(environment, fact, signal)
            if (!verified)
              throw new GhError('repository_requirements_unsatisfied')
          }
        }
        ledger.answerAsk(this.database, { askId, answer: [...values][0]!, policyBasis: ask.policyBasis, target, verified }, actor)
        result = 'answered'
      }
      catch (error) {
        if (!(error instanceof LedgerError) && (!(error instanceof GhError) || ['transport_unknown', 'interrupted', 'rate_limited', 'invalid_response', 'forbidden', 'not_found', 'not_logged_in', 'gh_missing', 'ci_unavailable', 'requirements_unavailable'].includes(error.code)))
          throw error
        result = failure(error)
      }
      results.push({ askId, result })
    }
    if (/^回答(?:\s|$)/m.test(item.body) && !results.length)
      results.push({ askId: null, result: 'invalid_format' })
    this.save(repository, `answer_result:${thread.id}:${id}`, results)
    this.save(repository, `handled:${id}`, results)
    return results
  }

  private thread(projectId: string, threadId: string): Row<'thread'> {
    const thread = ledger.load(this.database, 'thread', threadId)
    if (!thread || thread.repository !== this.project(projectId).repository || thread.projectId !== projectId || !['issue', 'pull'].includes(thread.kind))
      throw new GhError('topic_mismatch')
    return thread
  }

  private actor(environment: EnvironmentSelection, author: User, outbound: boolean): Actor {
    return { kind: 'github', verified: true, providerId: author.id, login: author.login, bot: author.type === 'Bot' || environment.automationIds.includes(author.id), outbound }
  }

  private subscriptions(threadId: string): string[] {
    return ledger.list(this.database, 'ticket_thread').filter(link => link.threadId === threadId).map(link => link.ticketId)
  }

  private project(projectId: string): Row<'project'> {
    const project = ledger.load(this.database, 'project', projectId)
    if (!project?.repository)
      throw new GhError('repository_identity_unverified')
    return project
  }

  private state<T>(repository: string, name: string): T | null {
    const row = ledger.list(this.database, 'source_state').find(row => row.channelId === channelId && row.name === key(repository, name))
    return row ? JSON.parse(row.value) as T : null
  }

  private save(repository: string, name: string, value: unknown): void {
    ledger.saveSourceState(this.database, channelId, key(repository, name), JSON.stringify(value))
  }
}

function confirmedCursor(cursor: Cursor, observed: string[], through: string, baseline: string): Cursor {
  const signature = revision(observed.sort())
  const since = cursor.confirmation?.signature === signature ? new Date(Math.max(baseline ? Date.parse(baseline) : 0, Date.parse(cursor.confirmation.through) - 1000)).toISOString() : cursor.since
  return { since, page: 1, confirmation: { signature, through } }
}

function key(repository: string, name: string): string {
  return `github:${repository}:${name}`
}

function now(): string {
  return new Date().toISOString()
}

function failure(error: unknown): string {
  return error instanceof GhError || error instanceof LedgerError ? error.code : 'adapter_failure'
}

function revision(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new GhError('invalid_response')
  return value as Record<string, unknown>
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value))
    throw new GhError('invalid_response')
  return value
}

function text(value: unknown): string {
  if (typeof value !== 'string' || !value)
    throw new GhError('invalid_response')
  return value
}

function identity(value: unknown): string {
  if (typeof value !== 'number' && typeof value !== 'string')
    throw new GhError('invalid_response')
  return text(String(value))
}

function timestamp(value: unknown): string {
  const input = text(value)
  if (!Number.isFinite(Date.parse(input)))
    throw new GhError('invalid_response')
  return new Date(input).toISOString()
}

function user(value: unknown): User {
  const input = object(value)
  return { id: identity(input.id), login: text(input.login), type: text(input.type) }
}

function pullNumber(target: MergeTarget): number {
  const prefix = `https://${target.repository}/pull/`
  if (!target.pullRequest.startsWith(prefix))
    throw new GhError('invalid_pull_request_identity')
  const number = Number(target.pullRequest.slice(prefix.length))
  if (!Number.isSafeInteger(number) || number < 1)
    throw new GhError('invalid_pull_request_identity')
  return number
}

function resourceNumber(thread: Row<'thread'>): number {
  const number = Number(thread.id.split(':').at(-1))
  if (!Number.isSafeInteger(number) || number < 1)
    throw new GhError('invalid_topic_identity')
  return number
}

function answerLines(body: string): Map<string, Set<string>> {
  const answers = new Map<string, Set<string>>()
  let fence: { character: string, length: number } | null = null
  let nestedParagraph = false
  let htmlBlock: string | null = null
  for (const line of body.split(/\r?\n/)) {
    if (htmlBlock) {
      if (line.toLowerCase().includes(`</${htmlBlock}>`))
        htmlBlock = null
      continue
    }
    const html = /^\s*<(blockquote|pre|code)(?:\s|>)/i.exec(line)
    if (html) {
      if (!line.toLowerCase().includes(`</${html[1]!.toLowerCase()}>`))
        htmlBlock = html[1]!.toLowerCase()
      continue
    }
    if (!line.trim())
      nestedParagraph = false
    if (/^ {0,3}(?:>|[-+*]\s|\d+[.)]\s)/.test(line))
      nestedParagraph = true
    if (nestedParagraph)
      continue
    if (fence) {
      if (new RegExp(`^ {0,3}${fence.character}{${fence.length},}\\s*$`).test(line))
        fence = null
      continue
    }
    const marker = /^ {0,3}([\x60~])\1{2,}/.exec(line)
    if (marker) {
      fence = { character: marker[1]!, length: marker[0].trimStart().length }
      continue
    }
    const match = /^回答[ \t]+([^\s:：]+)[ \t]*[:：][ \t]*(\S.*)$/.exec(line)
    if (!match)
      continue
    const values = answers.get(match[1]!) ?? new Set<string>()
    values.add(match[2]!.trim())
    answers.set(match[1]!, values)
  }
  return answers
}

function comment(value: unknown): Comment {
  const input = object(value)
  return { id: identity(input.id), body: input.body == null ? '' : String(input.body), createdAt: timestamp(input.created_at ?? input.submitted_at), updatedAt: timestamp(input.updated_at ?? input.submitted_at), url: text(input.html_url), user: user(input.user) }
}

function topic(value: unknown): Topic {
  const input = object(value)
  if (!Number.isSafeInteger(input.number) || Number(input.number) < 1)
    throw new GhError('invalid_response')
  return { id: identity(input.id), number: Number(input.number), title: text(input.title), body: input.body == null ? '' : String(input.body), createdAt: timestamp(input.created_at), updatedAt: timestamp(input.updated_at), url: text(input.html_url), user: user(input.user), pull: !!input.pull_request }
}
