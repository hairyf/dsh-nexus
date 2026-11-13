/**
 * GitLab 渠道的读与写。
 *
 * 和 GitHub 的差别都是真的差别，不是换个名字：
 *
 *   - 编号是**项目内**递增的（iid），不同项目会撞号 → 路径必须带项目名
 *   - 讨论按 **discussion** 分组，一个串里可以有多条 note
 *   - note 有 `system: true`，那是 GitLab 自己记的动作，不是人说的话
 *   - CI 是 pipeline → jobs，不是 check-runs
 *
 *   gitlab/<group%2Fproject>/issues/<iid>
 *   gitlab/<group%2Fproject>/issues/<iid>/notes[/<page>]
 *   gitlab/<group%2Fproject>/merges/<iid>
 *   gitlab/<group%2Fproject>/merges/<iid>/notes[/<page>]
 *   gitlab/<group%2Fproject>/merges/<iid>/discussions[/<page>]
 *   gitlab/<group%2Fproject>/merges/<iid>/pipeline
 *   gitlab/<group%2Fproject>/merges/<iid>/changes
 */

import type { ChannelMessage, ReadResult } from './github'
import { glabApi } from './commands'

/** GitLab 的失败状态。`skipped` 和 `manual` 不算失败。 */
const FAILING = new Set(['failed', 'canceled'])

interface GitlabNote {
  id: number
  body?: string | null
  author?: { username?: string } | null
  created_at?: string
  system?: boolean
  position?: { new_path?: string, new_line?: number, old_line?: number } | null
}

interface GitlabIssue {
  iid: number
  title: string
  state: string
  description?: string | null
  author?: { username?: string } | null
  created_at?: string
  web_url?: string
  labels?: string[]
  source_branch?: string
  target_branch?: string
}

interface GitlabDiscussion {
  id: string
  notes: GitlabNote[]
}

const PAGE = 20

/** `group%2Fproject` → `group/project`；`glab api` 需要未编码的项目路径。 */
function projectPath(encoded: string): string {
  const decoded = decodeURIComponent(encoded)
  if (!decoded.includes('/'))
    throw new Error(`项目要写成 namespace/name（URL 编码后传入）：${encoded}`)
  return decoded
}

function toMessage(note: GitlabNote, extra: { url?: string } = {}): ChannelMessage {
  return {
    id: String(note.id),
    from: note.author?.username ?? 'unknown',
    at: note.created_at ?? '',
    text: note.body ?? '',
    ...note.position?.new_path ? { path: note.position.new_path } : {},
    ...note.position?.new_line != null ? { line: note.position.new_line } : {},
    ...extra.url ? { url: extra.url } : {},
    // system 不是人说的话，但也不能丢 —— 上层要据此跳过它
    ...note.system ? { system: true } : {},
  }
}

export async function readGitlab(resource: string): Promise<ReadResult> {
  const matched = /^gitlab\/([^/]+)\/(issues|merges)\/([1-9]\d*)(?:\/(notes|discussions|pipeline|changes)(?:\/([1-9]\d*))?)?$/.exec(resource)
  if (!matched) {
    throw new Error(
      '路径写法：gitlab/<namespace%2Fname>/issues/<iid>、gitlab/<namespace%2Fname>/merges/<iid>，'
      + '或接 /notes/<页>、/discussions/<页>、/pipeline、/changes',
    )
  }

  const [, encoded, kind, rawNumber, section, rawPage] = matched
  const project = encodeURIComponent(projectPath(encoded))
  const iid = Number(rawNumber)
  const page = Number(rawPage ?? 1)
  const base = `projects/${project}/${kind}/${iid}`

  if (!section) {
    const item = await glabApi<GitlabIssue>(base)
    return {
      items: [{
        iid: item.iid,
        title: item.title,
        state: item.state,
        ...item.source_branch && item.target_branch ? { head: item.source_branch, base: item.target_branch } : {},
        ...item.labels?.length ? { labels: item.labels } : {},
        ...toMessage({ id: item.iid, body: item.description, author: item.author, created_at: item.created_at }, { url: item.web_url }),
      }],
      next_offset: null,
      next_resource: null,
    }
  }

  if (section === 'pipeline') {
    if (rawPage)
      throw new Error('pipeline 不带页码')
    const pipeline = await glabApi<{ id: number, status: string, sha?: string }>(`${base}/pipelines?per_page=1`)
      .then(body => Array.isArray(body) ? body[0] : body) as { id: number, status: string, sha?: string } | undefined
    if (!pipeline)
      return { items: [{ status: 'none', failed: [], running: [] }], next_offset: null, next_resource: null }

    const jobs = await glabApi<Array<{ name: string, status: string }>>(`projects/${project}/pipelines/${pipeline.id}/jobs?per_page=100`)
    return {
      items: [{
        pipeline: pipeline.id,
        ...pipeline.sha ? { head: pipeline.sha } : {},
        status: pipeline.status,
        failed: jobs.filter(job => FAILING.has(job.status)).map(job => job.name),
        running: ['running', 'pending', 'created'].includes(pipeline.status)
          ? jobs.filter(job => ['running', 'pending', 'created'].includes(job.status)).map(job => job.name)
          : [],
      }],
      next_offset: null,
      next_resource: null,
    }
  }

  if (section === 'changes') {
    if (rawPage)
      throw new Error('changes 不带页码')
    const changes = await glabApi<{ changes?: Array<{ new_path: string }> }>(`${base}/changes`)
    return {
      items: (changes.changes ?? []).map(change => ({ path: change.new_path })),
      next_offset: null,
      next_resource: null,
    }
  }

  if (section === 'discussions') {
    const listed = await glabApi<GitlabDiscussion[]>(`${base}/discussions?per_page=${PAGE}&page=${page}`)
    const messages = listed.flatMap(discussion => discussion.notes.map(note => ({
      ...toMessage(note),
      // 讨论串 id 单独给出：回复必须发到这个串，不能发到总讨论区
      discussion: discussion.id,
    })))
    return {
      items: messages,
      next_offset: listed.length === PAGE ? page + 1 : null,
      next_resource: null,
    }
  }

  const listed = await glabApi<GitlabNote[]>(`${base}/notes?per_page=${PAGE}&page=${page}`)
  const messages = listed.map(note => toMessage(note))
  return {
    items: messages,
    next_offset: messages.length === PAGE ? page + 1 : null,
    next_resource: null,
  }
}

/** 回复目标。`discussion` 有值就发到那个讨论串，否则发到总讨论区。 */
export interface GitlabReplyTarget {
  /** `group/project` */
  project: string
  iid: number
  discussion?: string
}

export async function replyGitlab(target: GitlabReplyTarget, text: string, marker: string): Promise<{ duplicate: boolean }> {
  const project = encodeURIComponent(target.project)
  const body = `${text}\n\n${marker}`

  // 讨论串里的回复和总讨论区的回复是两条不同的 API
  const path = target.discussion
    ? `projects/${project}/merge_requests/${target.iid}/discussions/${target.discussion}/notes`
    : `projects/${project}/merge_requests/${target.iid}/notes`

  if (await hasMarker(project, target, marker))
    return { duplicate: true }

  await glabApi(path, { input: JSON.stringify({ body }) })
  return { duplicate: false }
}

async function hasMarker(project: string, target: GitlabReplyTarget, marker: string): Promise<boolean> {
  const path = target.discussion
    ? `projects/${project}/merge_requests/${target.iid}/discussions/${target.discussion}/notes?per_page=100`
    : `projects/${project}/merge_requests/${target.iid}/notes?per_page=100`
  const listed = await glabApi<GitlabNote[]>(path)
  return listed.some(note => (note.body ?? '').includes(marker))
}
