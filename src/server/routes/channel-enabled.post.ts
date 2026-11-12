/** 开 / 关一个渠道的监听。关掉之后不会再产生触发。 */
import type { Ack } from '../../types'
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { db } from '../../database/index'

export interface EnabledBody {
  enabled: boolean
}

export const channelEnabledHandler = defineEventHandler(async (event): Promise<Ack> => {
  const body = (await readBody<EnabledBody>(event)) ?? { } as EnabledBody
  await db.channel.setEnabled(getRouterParam(event, 'id') ?? '', body.enabled === true)
  return { ok: true, message: body.enabled ? '已开启监听' : '已关闭监听' }
})
