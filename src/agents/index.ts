/** 四个角色的注册表。提示词、工具、面板文案都从这里取。 */

import type { Role } from '../constants'
import type { NexusTool, RoleSpec } from './types'
import { ROLES } from '../constants'
import { main } from './main'
import { project } from './project'
import { supervisor } from './supervisor'
import { TOOLS, toolsFor } from './tools'
import { worker } from './worker'

/** 角色 id → 定义。 */
export const ROLES_SPEC: Record<Role, RoleSpec> = {
  main,
  project,
  worker,
  supervisor,
}

/** 某个角色能用的工具。 */
export function toolsOf(role: Role): NexusTool[] {
  return toolsFor(role)
}

/** 面板上「这个角色能干什么」的那一段。 */
export function describe(role: Role): { title: string, tools: string[] } {
  return { title: ROLES_SPEC[role].title, tools: toolsOf(role).map(tool => tool.name) }
}

export { ROLES, TOOLS }
export type { NexusTool, RoleSpec }
