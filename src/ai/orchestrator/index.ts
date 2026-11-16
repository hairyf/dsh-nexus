import { definePreset } from '../../utils/agent'
import { plugins, sharedTools } from '../_shared'
import { getOrchestratorSystemPrompt } from './prompts'
import * as tools from './tools'

export const orchestrator = definePreset({
  id: 'orchestrator',
  name: '主编排',
  instruction: getOrchestratorSystemPrompt(),
  description: '全局只有一个，管所有项目和渠道：分诊话题、开票派活、跨项目卡住时拉临时协调者。不写代码。',
  order: 4,
  tools: [
    sharedTools.channel.read_channel,

    sharedTools.inbox.inbox_list,
    sharedTools.inbox.inbox_kill,

    tools.supervisor.supervisor_list,
    tools.supervisor.create_supervisor,
    tools.supervisor.close_supervisor,
    tools.supervisor.attach_tickets_to_supervisor,
    tools.supervisor.detach_tickets_from_supervisor,

    tools.ticket.list_ticket,
    tools.ticket.create_ticket,
    sharedTools.ticket.dispatch_ticket,
    sharedTools.ticket.note_ticket,

    tools.thread.triage_thread,
    tools.thread.attach_thread_to_ticket,
    tools.thread.unlink_thread,
  ],
  plugins: [
    plugins.agentInstructions,
    plugins.compaction,
    plugins.commandGoal,
    plugins.delegation,
    plugins.skillFilesystem,
    plugins.timeContext,
    plugins.toolBash,
    plugins.toolExecutorPtc,
    plugins.toolFs,
    plugins.toolFsSearch,
    plugins.toolJobs,
    plugins.toolPresent,
    plugins.toolPwsh,
    plugins.toolSkill,
    plugins.toolTodo,
    plugins.toolWeb,
  ],
})
