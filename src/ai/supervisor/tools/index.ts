import { defineTool } from '@deepseek-ai/dsh-tools'

/**
 * Supervisor 的 `list_ticket`：只看自己关联的那几张，无参数。
 * 主编排的全局版、项目编排的本项目版都是另外的工具，不要合并。
 */
export const list_ticket = defineTool({
  name: 'list_ticket',
  description: '列自己关联的工单及其进度。每次醒来先看它 —— 不要只信收件箱里那一条转述。',
  parameters: {},
  output: {
    schema: { type: 'string', description: '关联工单：id、项目、状态、prState、有无 pending ask。' },
    render: (_args, value) => [{ type: 'text', text: value }],
  },
  execute: async () => {
    // TODO: 按 SupervisorTicket 查出本 Supervisor 的工单，带 status / prState / 有无 pending ask
    // TODO: 转述可能过时，票不会 —— 每次都读库，不要复用上一轮的记忆
    throw new Error('list_ticket 尚未实现')
  },
})

export const link_dependency = defineTool({
  name: 'link_dependency',
  description: '记一条跨项目前置依赖。方向是「后来的指向先要做的」。别只记在脑子里 —— 你随时可能被重启。',
  parameters: {
    ticketId: {
      type: 'string',
      required: true,
      description: '要等的那张票。',
    },
    dependsOn: {
      type: 'string',
      required: true,
      description: '必须先做完的那张票。',
    },
  },
  output: {
    schema: { type: 'string', description: '依赖记录结果。' },
    render: (_args, value) => [{ type: 'text', text: value }],
  },
  execute: async () => {
    // TODO: 建 TicketLink(ticketId, relatedId=dependsOn, kind=depends)
    // TODO: dependsOn 到终态时插件给本 Supervisor 投一条 notice（保险；漏报不会让整条链路停摆）
    throw new Error('link_dependency 尚未实现')
  },
})
