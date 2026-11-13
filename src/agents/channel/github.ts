/**
 * GitHub 渠道的读与写。
 *
 * 分派表照官方 `readGithub` 的形状：
 *
 *   github/issues/<n>                     议题描述
 *   github/issues/<n>/comments[/<page>]   议题评论
 *   github/pulls/<n>                      合并请求描述
 *   github/pulls/<n>/comments[/<page>]    合并请求评论
 *   github/pulls/<n>/reviews[/<page>]     评审
 *   github/pulls/<n>/checks               CI
 *   github/pulls/<n>/thread/<commentId>   某条评审讨论串
 *   github/commits/<sha>/checks           提意见的 CI
 *
 * 消息统一成 `{ id, from, at, text, reply_to?, path?, line?, url }`，
 * 不是原始 API 记录 —— 代理不该读 `in_reply_to_id` 这种字段名。
 */

import { ghApi } from './commands'

/** 一条渠道消息。四个渠道都归到这个形状，代理只认它。 */
export interface ChannelMessage {
  id: string
  from: string
  at: string
  text: string
  reply_to?: string
  path?: string
  line?: number
  url?: string
}

export interface ReadResult {
  items: unknown[]
  next_offset: number | null
  next_resource: string | null
}

/** CI 失败的结论。`success` / `neutral` / `skipped` / `stale` 都不算失败。 */
const FAILING = new Set(['failure', 'timed_out', 'cancelled', 'action_required', 'startup_failure', 'error'])

interface GithubComment {
  id: number
  body?: string | null
  user?: { login?: string } | null
  created_at?: string
  submitted_at?: string
  in_reply_to_id?: number | null
  path?: string
  line?: number | null
  html_url?: string
}

interface GithubIssue {
  number: number
  title: string
  state: string
  body?: string | null
  user?: { login?: string } | null
  created_at?: string
  html_url?: string
  merged?: boolean
  draft?: boolean
  head?: { ref: string }
  base?: { ref: string }
  labels?: Array<{ name: string }>
}

/** 渲染成统一消息。`id` 用原记录 id；没有就给个稳定值。 */
function toMessage(item: GithubComment, id: string): ChannelMessage {
  return {
    id,
    from: item.user?.login ?? 'unknown',
    at: item.submitted_at ?? item.created_at ?? '',
    text: item.body ?? '',
    ...item.in_reply_to_id ? { reply_to: String(item.in_reply_to_id) } : {},
    ...item.path ? { path: item.path } : {},
    ...item.line != null ? { line: item.line } : {},
    ...item.html_url ? { url: item.html_url } : {},
  }
}

/** 一页 20 条，和官方一致。 */
const PAGE = 20

export async function readGithub(resource: string): Promise<ReadResult> {
  // 一个 commit 的 CI：默认分支的 CI 没有对应的 PR
  const commit = /^github\/commits\/([\da-f]{7,40})\/checks$/.exec(resource)
  if (commit)
    return checksOf(commit[1]!)

  const matched = /^github\/(issues|pulls)\/([1-9]\d*)(?:\/(comments|reviews|checks|thread)(?:\/([1-9]\d*))?)?$/.exec(resource)
  if (!matched) {
    throw new Error(
      '路径写法：github/issues/<号>、github/pulls/<号>，'
      + '或在其后接 /comments/<页>、/reviews/<页>、/thread/<评论id>、/checks；'
      + '以及 github/commits/<sha>/checks',
    )
  }

  const [, kind, rawNumber, section, rawId] = matched
  const number = Number(rawNumber)
  const page = Number(rawId ?? 1)

  if (kind === 'issues' && (section === 'reviews' || section === 'checks' || section === 'thread')) {
    throw new Error('reviews、thread、checks 只能用在合并请求上')
  }

  if (section === 'checks') {
    if (rawId)
      throw new Error('checks 不带页码')
    const pull = await ghApi<{ head: { sha: string } }>(`repos/{owner}/{repo}/pulls/${number}`)
    return checksOf(pull.head.sha)
  }

  if (section === 'thread') {
    if (!rawId)
      throw new Error('用其中一条评论的 id 指定讨论串：github/pulls/<号>/thread/<评论id>')
    const messages = await threadOf(number, Number(rawId))
    if (!messages.length)
      throw new Error('这条合并请求里没有这个 id 的评审评论')
    return { items: messages, next_offset: null, next_resource: null }
  }

  if (!section) {
    const issue = await ghApi<GithubIssue>(`repos/{owner}/{repo}/${kind}/${number}`)
    return {
      items: [{
        number: issue.number,
        title: issue.title,
        state: issue.state,
        ...issue.merged ? { merged: true } : {},
        ...issue.draft ? { draft: true } : {},
        ...issue.head && issue.base ? { head: issue.head.ref, base: issue.base.ref } : {},
        ...issue.labels?.length ? { labels: issue.labels.map(label => label.name) } : {},
        ...toMessage({ id: issue.number, body: issue.body, user: issue.user, created_at: issue.created_at, html_url: issue.html_url }, String(issue.number)),
      }],
      next_offset: null,
      next_resource: null,
    }
  }

  const listed = await ghApi<GithubComment[]>(
    `repos/{owner}/{repo}/${kind}/${number}/${section}?per_page=${PAGE}&page=${page}`,
  )
  const messages = listed.map(item => toMessage(item, String(item.id)))
  return {
    items: messages,
    // 拿满一页就认为后面还有；不下结论说「没有了」
    next_offset: messages.length === PAGE ? page + 1 : null,
    next_resource: null,
  }
}

/** 某个 commit 的 CI 快照。 */
async function checksOf(sha: string): Promise<ReadResult> {
  interface CheckRun { name: string, status: string, conclusion: string | null }
  interface CommitStatus { context: string, state: string }

  const [runPage, statuses] = await Promise.all([
    ghApi<{ check_runs?: CheckRun[] }>(`repos/{owner}/{repo}/commits/${sha}/check-runs`),
    ghApi<CommitStatus[]>(`repos/{owner}/{repo}/commits/${sha}/statuses`),
  ])
  const checks = runPage.check_runs ?? []

  const failed = [
    ...checks.filter(check => FAILING.has(check.conclusion ?? '')).map(check => check.name),
    ...statuses.filter(status => FAILING.has(status.state)).map(status => status.context),
  ]
  const running = [
    ...checks.filter(check => check.status !== 'completed').map(check => check.name),
    ...statuses.filter(status => status.state === 'pending').map(status => status.context),
  ]

  return {
    items: [{
      head: sha,
      failed,
      running,
      passing: failed.length === 0 && running.length === 0,
    }],
    next_offset: null,
    next_resource: null,
  }
}

/** 一条评审讨论串：给定其中任一条评论，顺着 `in_reply_to_id` 收齐整串。 */
async function threadOf(number: number, commentId: number): Promise<ChannelMessage[]> {
  const all = await ghApi<GithubComment[]>(`repos/{owner}/{repo}/pulls/${number}/comments?per_page=100`)
  const seed = all.find(comment => comment.id === commentId)
  if (!seed)
    return []

  // 往上找到根
  let root = seed
  const byId = new Map(all.map(comment => [comment.id, comment]))
  while (root.in_reply_to_id) {
    const parent = byId.get(root.in_reply_to_id)
    if (!parent)
      break
    root = parent
  }

  // 往下收集所有后代
  const collected = new Set<number>([root.id])
  let grew = true
  while (grew) {
    grew = false
    for (const comment of all) {
      if (collected.has(comment.id) || comment.in_reply_to_id == null)
        continue
      if (collected.has(comment.in_reply_to_id)) {
        collected.add(comment.id)
        grew = true
      }
    }
  }

  return all
    .filter(comment => collected.has(comment.id))
    .sort((left, right) => (left.created_at ?? '').localeCompare(right.created_at ?? ''))
    .map(comment => toMessage(comment, String(comment.id)))
}

/** 回复目标：发到议题总讨论区，还是某个评审讨论串。 */
export interface ReplyTarget {
  /** `owner/repo` */
  repository: string
  number: number
  /** 评审讨论串的根评论 id；有它就发到讨论串，没有就发到总讨论区 */
  discussion?: number
}

/**
 * 发一条评论。
 *
 * `marker` 是防重发的锚：投递可能重试，没有它同一条消息会被贴两遍。
 * 发之前先查一遍已有评论里有没有这个标记 —— 这比「记得自己发过」可靠。
 */
export async function replyGithub(target: ReplyTarget, text: string, marker: string): Promise<{ url?: string, duplicate: boolean }> {
  const exists = await hasMarker(target, marker)
  if (exists)
    return { duplicate: true }

  const body = `${text}\n\n${marker}`
  if (target.discussion !== undefined) {
    await ghApi(`repos/${target.repository}/pulls/${target.number}/comments`, {
      input: JSON.stringify({ body, in_reply_to: target.discussion }),
    })
    return { duplicate: false }
  }

  const created = await ghApi<{ html_url?: string }>(`repos/${target.repository}/issues/${target.number}/comments`, {
    input: JSON.stringify({ body }),
  })
  return { ...created.html_url ? { url: created.html_url } : {}, duplicate: false }
}

/** 已有评论里是否包含这个标记。只查最近一页，投递重试的窗口很短。 */
async function hasMarker(target: ReplyTarget, marker: string): Promise<boolean> {
  const path = target.discussion !== undefined
    ? `repos/${target.repository}/pulls/${target.number}/comments?per_page=100`
    : `repos/${target.repository}/issues/${target.number}/comments?per_page=100`
  const listed = await ghApi<GithubComment[]>(path)
  return listed.some(comment => (comment.body ?? '').includes(marker))
}
