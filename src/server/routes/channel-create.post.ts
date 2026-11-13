/**
 * 新建一个渠道。
 *
 * 只落一行 `Channel`，**不碰凭证** —— 登录是渠道自己的授权流程，走
 * `docs/ui/credentials.md` 说的那条路。所以新建的渠道默认 `enabled: false`：
 * 还没登录就开始监听，只会产生一堆读不了的触发。
 */

import type { Ack } from '../../types'
import { createError, defineEventHandler, readBody } from 'h3'
import { db } from '../../database/index'

export interface ChannelCreateBody {
  /** `github` / `gitlab` / `feishu` / `qq` / `wechat` */
  id: string
  /** 展示名；不给就用 id */
  name?: string
  /** 自建 GitLab 的站点地址，其余渠道留空 */
  host?: string
}

export const channelCreateHandler = defineEventHandler(async (event): Promise<Ack> => {
  const body = (await readBody<ChannelCreateBody>(event)) ?? {} as ChannelCreateBody
  const id = body.id?.trim()
  if (!id)
    throw createError({ statusCode: 400, statusMessage: '缺少渠道 id' })

  const existing = await db.channel.findUnique(id).catch(() => undefined)
  if (existing)
    throw createError({ statusCode: 409, statusMessage: `渠道 ${id} 已经存在` })

  const host = body.host?.trim() || null
  // host 只有 gitlab 有意义，别的渠道传了也存空 —— 免得面板上显示一个假地址
  await db.channel.create({
    id,
    name: body.name?.trim() || id,
    enabled: 0,
    host: id === 'gitlab' ? host : null,
    createdAt: new Date().toISOString(),
  })

  return { ok: true, message: `已添加 ${id}，接下来要登录账号` }
})
