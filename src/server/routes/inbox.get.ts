/** 收件箱：全部条目 + 每个 type 的未读数 + 卡住的条数。 */
import type { InboxView } from '../../types'
import { defineEventHandler, getQuery } from 'h3'
import { db } from '../../database/index'

export interface InboxQuery {
  /** 只看某一类收件人；不给就全给 */
  type?: string
}

export const inboxHandler = defineEventHandler(async (event): Promise<InboxView> => {
  const { type } = getQuery<InboxQuery>(event)
  return db.inbox.page(type)
})
