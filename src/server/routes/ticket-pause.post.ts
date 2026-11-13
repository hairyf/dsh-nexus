/** 暂停 / 恢复一个任务。开关在任务详情里，不是全局设置。 */
import type { Ack } from '../../types'
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { db } from '../../database/index'

export interface PauseBody {
  paused: boolean
}

export const ticketPauseHandler = defineEventHandler(async (event): Promise<Ack> => {
  const body = (await readBody<PauseBody>(event)) ?? { } as PauseBody
  await db.ticket.setPaused(getRouterParam(event, 'id') ?? '', body.paused === true)
  return { ok: true, message: body.paused ? '已暂停' : '已恢复' }
})
