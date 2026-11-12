/** 触发页：话题列表 + 选中话题的触发。 */
import type { TriggerView } from '../../types'
import { defineEventHandler, getQuery } from 'h3'
import { db } from '../../database/index'

export interface TriggersQuery {
  /** 话题 id；不给就只返回话题列表 */
  thread?: string
}

export const triggersHandler = defineEventHandler(async (event): Promise<TriggerView> => {
  const { thread } = getQuery<TriggersQuery>(event)
  return db.thread.page(thread)
})
