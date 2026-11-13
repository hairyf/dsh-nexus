/** 任务详情：话题、关联、Worker、收件箱一次取齐。 */
import type { TicketDetail } from '../../types'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { db } from '../../database/index'

export const ticketHandler = defineEventHandler(async (event): Promise<TicketDetail> => {
  const id = getRouterParam(event, 'id') ?? ''
  const detail = await db.ticket.detail(id)
  if (!detail)
    throw createError({ statusCode: 404, statusMessage: `任务 ${id} 不存在` })
  return detail
})
