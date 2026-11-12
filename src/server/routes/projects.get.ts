/** 项目列表。设置页与收件箱都要用。 */
import type { ProjectListView } from '../../types'
import { defineEventHandler } from 'h3'
import { db } from '../../database/index'

export const projectsHandler = defineEventHandler(async (): Promise<ProjectListView> => {
  const rows = await db.project.findMany() as Array<{ id: string, name: string, workspaceId: string, directory: string }>
  return { projects: rows.map(row => ({ id: row.id, name: row.name, workspaceId: row.workspaceId, directory: row.directory })) }
})
