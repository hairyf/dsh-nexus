import type { TICKET_FILTERS } from '../../constants'
/** 任务列表。`filter` 只影响返回的票，不影响计数。 */
import type { TaskListView } from '../../types'
import { defineEventHandler, getQuery } from 'h3'
import { db } from '../../database/index'

export interface TasksQuery {
  filter?: typeof TICKET_FILTERS[number]
}

export const tasksHandler = defineEventHandler(async (event): Promise<TaskListView> => {
  const { filter } = getQuery<TasksQuery>(event)
  return db.ticket.board(filter)
})
