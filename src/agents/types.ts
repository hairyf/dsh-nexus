/** 工具与角色的公共类型。`src/agents/tools.ts` 与各角色文件共用。 */

import type { Role } from '../constants'
import type { db } from '../database'

/** 装配好的数据库句柄：Kysely + 每张表的 model。 */
export type NexusDb = typeof db

/**
 * 工具执行时能拿到什么。
 *
 * `sessions` / `workspaces` 是宿主能力，**没注入时相关工具必须明确报错**，
 * 不能静默什么都不做 —— 半工作状态比失败更难查。
 */
export interface ToolContext {
  db: NexusDb
  /** 当前是谁在调。决定 `inbox_list` 查谁的收件箱、`report` 发给谁。 */
  role: Role
  /** 当前角色所属的项目；主编排没有。 */
  projectId?: string
  /** 当前 Supervisor 的 id；只有 supervisor 角色有。 */
  supervisorId?: string
  /** 当前 Worker 的 id；只有 worker 角色有。 */
  workerId?: string
  /** 当前 Worker 所属的任务；只有 worker 角色有。 */
  ticketId?: string
  /** 开会话 / 投递消息的宿主能力。 */
  sessions?: {
    create: (input: { cwd: string, preset: Role, title: string }) => Promise<string>
    prompt: (sessionId: string, text: string, mode: 'queue' | 'steer') => Promise<void>
    view: (sessionId: string, offset?: number) => Promise<string>
    stop: (sessionId: string) => Promise<void>
    rename: (sessionId: string, title: string) => Promise<void>
  }
  /** 工作区注册表。`create_in_workspace_project` 靠它校验目标工作区存在。 */
  workspaces?: {
    list: () => Promise<Array<{ workspaceId: string, path: string, title: string }>>
  }
}

/** 一个工具：模型看到的描述 + 真正干活的实现。 */
export interface NexusTool {
  name: string
  /** 一句话说清「什么时候用它」，写成「…时用这个」。 */
  description: string
  /** JSON Schema 参数表。 */
  parameters: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
    additionalProperties?: false
  }
  /** 哪些角色拥有它。 */
  roles: readonly Role[]
  /** 返回一个可以直接 JSON 序列化的值。 */
  run: (input: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>
}

/** 一个角色的完整定义：名字、提示词。工具靠 `roles` 声明，不在这里列。 */
export interface RoleSpec {
  role: Role
  /** 中文角色名，面板上显示 */
  title: string
  /** 预设提示词 */
  prompt: string
}

/** 取参数的小工具，统一在这里做类型收窄，避免每个 handler 重复写。 */
export const arg = {
  str: (input: Record<string, unknown>, key: string): string | undefined =>
    typeof input[key] === 'string' && input[key] ? input[key] as string : undefined,
  req: (input: Record<string, unknown>, key: string): string => {
    const value = input[key]
    if (typeof value !== 'string' || !value)
      throw new Error(`参数 ${key} 必填`)
    return value
  },
  bool: (input: Record<string, unknown>, key: string): boolean | undefined =>
    typeof input[key] === 'boolean' ? input[key] as boolean : undefined,
  num: (input: Record<string, unknown>, key: string): number | undefined =>
    typeof input[key] === 'number' ? input[key] as number : undefined,
  arr: (input: Record<string, unknown>, key: string): string[] => {
    const value = input[key]
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  },
}
