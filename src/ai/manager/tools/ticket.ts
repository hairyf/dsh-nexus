import { defineTool } from '@deepseek-ai/dsh-tools'

/**
 * 项目编排的版本：范围锁死在本项目。
 * 没有 projectId 参数 —— 你只能看自己的票，这和主编排的全局 `list_ticket` 是两个工具。
 */
export const list_ticket = defineTool({
  name: 'list_ticket',
  description: '列本项目的任务。判重时必看。',
  parameters: {
    status: {
      type: 'string',
      enum: ['waiting', 'queued', 'running', 'review', 'done', 'cancelled'],
      description: '只看某个状态；省略表示不含已终态的票。',
    },
    attentionOnly: {
      type: 'boolean',
      description: 'true 时只返回存在指向它的 pending ask 的票。',
    },
  },
  output: {
    schema: { type: 'string', description: '本项目任务列表：id、标题、状态、PR 状态、有无 pending ask。' },
    render: (_args, value) => [{ type: 'text', text: value }],
  },
  execute: async () => {
    // TODO: 只查本项目的 Ticket（projectId 由会话身份决定，不接受入参），叠加 status / attentionOnly
    throw new Error('list_ticket 尚未实现')
  },
})

export const link_ticket = defineTool({
  name: 'link_ticket',
  description: '建一张工单到另一张工单的关联。限本项目；跨项目依赖由 Supervisor 的 link_dependency 记。',
  parameters: {
    ticketId: {
      type: 'string',
      required: true,
      description: '发起关联的票，必须是本项目的。',
    },
    relatedId: {
      type: 'string',
      required: true,
      description: '被指向的那张票。',
    },
    kind: {
      type: 'string',
      enum: ['depends', 'relates'],
      required: true,
      description: 'depends 前置依赖：relatedId 没做完，ticketId 停在 waiting。relates 只是相关，谁都不等谁。',
    },
  },
  output: {
    schema: { type: 'string', description: '关联结果。' },
    render: (_args, value) => [{ type: 'text', text: value }],
  },
  execute: async () => {
    // TODO: 建 TicketLink(ticketId, relatedId, kind)，方向是 ticketId 指向 relatedId
    // TODO: ticketId 不属于本项目时拒绝；depends 时若 relatedId 未到终态则把 ticketId 停在 waiting
    // TODO: depends 的 relatedId 到终态时，插件给该票所属的 Supervisor 投一条 notice（保险，不是常规）
    throw new Error('link_ticket 尚未实现')
  },
})

export const stop_ticket = defineTool({
  name: 'stop_ticket',
  description: '按人的明确要求结单为 cancelled。必须绑一条 human=true 的触发 —— 停止是人的决定，不是编排的判断。',
  parameters: {
    ticketId: {
      type: 'string',
      required: true,
      description: '要停的票。',
    },
    triggerId: {
      type: 'string',
      required: true,
      description: '人说停的那条触发。必须是 human=true，否则拒绝。',
    },
    reason: {
      type: 'string',
      description: '一句话说明为什么停，写进记录。',
    },
  },
  output: {
    schema: { type: 'string', description: '结单结果。' },
    render: (_args, value) => [{ type: 'text', text: value }],
  },
  execute: async () => {
    // TODO: 校验 triggerId 存在且 human=true，否则报错
    // TODO: 写 status=cancelled + endedAt；中止在跑的 Worker 回合；残留的 pending 消息退回
    throw new Error('stop_ticket 尚未实现')
  },
})

export const retry_ticket = defineTool({
  name: 'retry_ticket',
  description: '重开卡住的票：结束旧 Worker，开一个新的。只对还开着、卡在 failed 的票有效。',
  parameters: {
    ticketId: {
      type: 'string',
      required: true,
      description: '要重开的票。已到终态的票不适用 —— 那张只能由插件在人类消息到达时复活。',
    },
  },
  output: {
    schema: { type: 'string', description: '重开结果。' },
    render: (_args, value) => [{ type: 'text', text: value }],
  },
  execute: async () => {
    // TODO: 校验票未到终态且 Worker 卡在 failed；否则拒绝
    // TODO: 结束旧 Worker，按并发上限开新的；旧 Worker 的 branch / worktree 保留不删
    throw new Error('retry_ticket 尚未实现')
  },
})
