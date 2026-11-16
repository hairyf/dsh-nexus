import type { ToolDefinition, ToolRunContext } from '@deepseek-ai/dsh-tools'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import type { Communication, Escalation, MessageInput, Question } from '../service/communication.types'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { LedgerError } from '../database'

export function createCommunicationTools(service: Communication, sessionId: string, nativeSend: (args: { agent_id: string, message: string }, exec: ToolRunContext) => Promise<{ messageId: string }>): ToolDefinition[] {
  function caller(exec: ToolRunContext): void {
    if (!exec.agent || exec.agent.session.id !== sessionId)
      throw new LedgerError('unbound_actor')
  }

  const output = {
    schema: { type: 'object', additionalProperties: true } as const,
    render: (_args: unknown, value: unknown) => [{ type: 'text' as const, text: JSON.stringify(value) }],
  }
  return [
    defineTool({
      name: 'ask',
      description: '创建持久问题或用 askId 上交同一问题。requestId 对同一个决定保持不变，重启/重试复用。pending 不代表批准，受影响工作线停止，其他已授权工单可继续。',
      parameters: {
        threadId: { type: 'string', description: 'main 无票分诊问题的已登记原话题；不用于改变工单范围。' },
        requestId: { type: 'string', description: '新问题的稳定请求标识；重试必须复用。' },
        askId: { type: 'string', description: '上交已有问题时只传 askId，不改原问题。' },
        question: { type: 'string', description: '实际问题正文。' },
        options: { type: 'array', items: { type: 'string' }, description: '明确可选答案；不产生默认答案。' },
        multiSelect: { type: 'boolean', description: '是否允许多选；正式答复通过 selections 保留选择。' },
        title: { type: 'string', description: '问题标题。' },
        detail: { type: 'string', description: '问题补充信息。' },
        ticketIds: { type: 'array', items: { type: 'string' }, description: '受影响工单；Worker 推导本票，project/supervisor 必须明确提供。' },
        decisionType: { type: 'string', enum: ['ordinary', 'important', 'final', 'merge', 'delivery'], description: '决定性质；默认 important，处理者始终由账本策略决定。' },
        target: { type: 'object', additionalProperties: false, properties: { repository: { type: 'string', required: true }, pullRequest: { type: 'string', required: true }, base: { type: 'string', required: true }, head: { type: 'string', required: true } }, description: '合并决定的精确目标；账本核对当前验收依据。' },
      },
      output,
      execute: async (args, exec) => {
        caller(exec)
        return await service.ask(sessionId, args as Question | Escalation, exec.signal) as unknown as Record<string, JsonValue>
      },
    }),
    defineTool({
      name: 'send_message',
      description: '互斥地址：agent_id 原生代理；to 显式 Nexus 地址；askId 正式答复且必须提供问题当前 policyBasis。仅返回受理，不代表已发送/已读/已处理。普通消息永不批准或改工单状态。',
      parameters: {
        message: { type: 'string', required: true, description: '公共消息/答案文本。' },
        agent_id: { type: 'string', description: '原生 DSH helper 地址，沿用原生父子权限和 messageId 回执。' },
        to: { type: 'string', description: 'role:main/project/supervisor/worker、binding:登记ID、session:会话ID 或 channel:已登记话题ID；歧义地址报错。' },
        askId: { type: 'string', description: '正式答复的唯一问题ID；收件者由原问题决定。' },
        policyBasis: { type: 'string', description: '问题展示的策略版本；变化后需重新判断。' },
        selections: { type: 'array', items: { type: 'string' }, description: '多选问题的完整选项集合。' },
        ticketId: { type: 'string', description: '普通消息关联工单，Worker 默认本票。' },
        facts: { type: 'object', additionalProperties: false, properties: {
          state: { type: 'string', enum: ['progress', 'ready', 'failed', 'dropped'], required: true },
          summary: { type: 'string', required: true },
          evidence: { type: 'array', items: { type: 'string' } },
          acceptanceCriteria: { type: 'string' },
        }, description: '普通消息结构化汇报与交付证据，不是验收或状态写入。' },
      },
      output,
      execute: async (args, exec) => {
        caller(exec)
        const input = args as MessageInput
        if ([input.agent_id, input.to, input.askId].filter(value => value !== undefined).length !== 1)
          throw new LedgerError('address_conflict')
        if (input.agent_id !== undefined) {
          if (input.ticketId || input.facts || input.policyBasis || input.selections)
            throw new LedgerError('parameter_conflict')
          await service.resolve(sessionId, exec.signal)
          return nativeSend({ agent_id: input.agent_id, message: input.message }, exec)
        }
        return await service.sendMessage(sessionId, exec.callId, input, exec.signal) as unknown as Record<string, JsonValue>
      },
    }),
  ]
}
