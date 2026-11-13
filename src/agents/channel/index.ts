/**
 * 渠道读写的分派层。
 *
 * `read_channel` 只给路径，`reply_channel` 只给触发 id —— 后者需要的仓库、编号、
 * 讨论串全部从库里推出来，代理不用自己拼。这是「锚点是触发」的具体含义：
 * 一个触发一定能定位到它在哪个渠道、哪个话题、哪条讨论上。
 */

import type { NexusDb } from '../types'
import type { ChannelMessage } from './github'
import { hasCommand } from './commands'
import { readGithub, replyGithub } from './github'
import { readGitlab, replyGitlab } from './gitlab'

export type { ChannelMessage }

export interface ChannelReadResult {
  items: unknown[]
  next_offset: number | null
  next_resource: string | null
}

/** 路径的第一段是渠道 id。 */
export function channelOf(resource: string): string {
  const [id] = resource.split('/')
  return id ?? ''
}

/**
 * 读渠道原文。
 *
 * 只有实现了 provider 的渠道才能读。没实现的**明确报错**，
 * 不返回空数组 —— 空数组会让代理以为「读到了，没内容」，然后据此下判断。
 */
export async function readChannel(resource: string): Promise<ChannelReadResult> {
  const channel = channelOf(resource)

  switch (channel) {
    case 'github':
      await requireCommand('gh', 'GitHub')
      return readGithub(resource)
    case 'gitlab':
      await requireCommand('glab', 'GitLab')
      return readGitlab(resource)
    case 'feishu':
      throw new Error(
        '飞书原文读取需要应用凭证（app_id / app_secret），'
        + '凭证配置尚未实现，见 docs/ui/credentials.md。'
        + '当前可用：从触发正文与线程标题读到的内容。',
      )
    default:
      throw new Error(
        `渠道 ${channel || '(空)'} 没有 provider。`
        + '可用路径前缀：github/、gitlab/、trigger/、thread/、ticket/。',
      )
  }
}

/** 命令不在 PATH 上时，报错要说清是环境问题而不是权限问题。 */
async function requireCommand(command: string, channel: string): Promise<void> {
  if (await hasCommand(command))
    return
  throw new Error(
    `${channel} 渠道需要 ${command} 命令行，当前 PATH 里找不到。`
    + '检查渠道账号是否已登录，以及插件是否给会话注入了 shim 目录。',
  )
}

/** 回复成功与否。`duplicate` 表示这条已经发过，不是错误。 */
export interface ReplyResult {
  ok: boolean
  duplicate: boolean
  url?: string
  message: string
}

/**
 * 以 bot 身份在渠道里回复。
 *
 * 锚点是 `triggerId`。顺着它取出话题 → 渠道 → 仓库/编号/讨论串，
 * 代理不需要知道这些。
 */
export async function replyChannel(db: NexusDb, triggerId: string, text: string): Promise<ReplyResult> {
  const trigger = await db.trigger.findUnique(triggerId).catch(() => undefined)
  if (!trigger)
    throw new Error(`触发 ${triggerId} 不存在，无法确定要回复到哪`)

  const thread = await db.thread.findUnique(trigger.threadId).catch(() => undefined)
  if (!thread)
    throw new Error(`触发 ${triggerId} 没有关联话题，无法确定要回复到哪`)

  const marker = markerFor(triggerId)
  const channel = trigger.channelId

  if (channel === 'github') {
    await requireCommand('gh', 'GitHub')
    const target = await githubTarget(db, trigger.threadId, thread.refId, thread.projectId)
    const result = await replyGithub(target, text, marker)
    return {
      ok: true,
      duplicate: result.duplicate,
      ...result.url ? { url: result.url } : {},
      message: result.duplicate ? '这条已经发过了' : '已回复',
    }
  }

  if (channel === 'gitlab') {
    await requireCommand('glab', 'GitLab')
    const target = await gitlabTarget(db, thread.refId, thread.projectId)
    const result = await replyGitlab(target, text, marker)
    return { ok: true, duplicate: result.duplicate, message: result.duplicate ? '这条已经发过了' : '已回复' }
  }

  if (channel === 'feishu') {
    throw new Error(
      '飞书回复需要应用凭证（app_id / app_secret），凭证配置尚未实现，见 docs/ui/credentials.md。',
    )
  }

  throw new Error(`渠道 ${channel} 没有回复 provider`)
}

/**
 * 防重发的标记。
 *
 * 用触发 id 派生：同一条触发上的重试都带同一个标记，第二次发之前查得到。
 * 不掺正文 —— 正文改一个字就变成新消息，那不是重试。
 */
function markerFor(triggerId: string): string {
  return `<!-- nexus:${triggerId} -->`
}

/** GitHub 的回复目标：仓库取项目名，编号取话题的 `refId`。 */
async function githubTarget(db: NexusDb, threadId: string, refId: string | null, projectId: string | null): Promise<{
  repository: string
  number: number
  discussion?: number
}> {
  const project = projectId ? await db.project.findUnique(projectId).catch(() => undefined) : undefined
  if (!project)
    throw new Error('这条话题没有绑定项目，无法确定仓库')

  const number = Number(refId)
  if (!Number.isInteger(number) || number <= 0)
    throw new Error(`话题的编号不对：${refId ?? '(空)'}`)

  // 评审讨论串：话题若记了某条评论 id，回复要发进那个串
  const discussion = await reviewDiscussion(db, threadId)
  return {
    repository: project.name,
    number,
    ...discussion !== undefined ? { discussion } : {},
  }
}

/**
 * 这条话题是否锚在某条评审评论上。
 *
 * 触发里带 `ref` 且话题是合并请求时，说明它来自某个 diff 讨论；
 * 这时回复应该进那个串，而不是总讨论区。
 */
async function reviewDiscussion(db: NexusDb, threadId: string): Promise<number | undefined> {
  const row = await db.selectFrom('trigger')
    .select(['ref'])
    .where('threadId', '=', threadId)
    .orderBy('at', 'desc')
    .executeTakeFirst()
  const value = row?.ref
  if (!value)
    return undefined
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : undefined
}

/** GitLab 的回复目标。项目内编号（iid）取话题的 `refId`。 */
async function gitlabTarget(db: NexusDb, refId: string | null, projectId: string | null): Promise<{
  project: string
  iid: number
}> {
  const project = projectId ? await db.project.findUnique(projectId).catch(() => undefined) : undefined
  if (!project)
    throw new Error('这条话题没有绑定项目，无法确定仓库')

  const iid = Number(refId)
  if (!Number.isInteger(iid) || iid <= 0)
    throw new Error(`话题的编号不对：${refId ?? '(空)'}`)

  return { project: project.name, iid }
}
