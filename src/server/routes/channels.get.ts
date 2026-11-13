/** 渠道页：账号、项目数、读取游标一次取齐。 */
import type { ChannelView } from '../../types'
import { defineEventHandler } from 'h3'
import { db } from '../../database/index'

export const channelsHandler = defineEventHandler(async (): Promise<ChannelView> => {
  return { channels: await db.channel.detail() }
})
