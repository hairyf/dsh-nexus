/** 批量标掉处理完的消息。不需要先读。 */
import type { Ack } from '../../types'
import { defineEventHandler, readBody } from 'h3'
import { db } from '../../database/index'

export interface KillBody {
  ids: string[]
}

export const inboxKillHandler = defineEventHandler(async (event): Promise<Ack> => {
  const body = (await readBody<KillBody>(event)) ?? { } as KillBody
  const killed = await db.inbox.kill(body.ids ?? [])
  return { ok: true, message: killed ? `已处理 ${killed} 条` : '没有要处理的条目' }
})
