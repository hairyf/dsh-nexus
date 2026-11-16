import { definePreset } from '../../utils/agent'
import { plugins, sharedTools } from '../_shared'
import { getSupervisorSystemPrompt } from '../_shared/prompts'
import * as tools from './tools'

export const supervisor = definePreset({
  id: 'supervisor',
  name: '临时协调者',
  instruction: getSupervisorSystemPrompt(),
  description: '只在任务跨两个以上项目时临时拉起，协调依赖、对齐两边的结论，用完即弃。不写代码。',
  order: 6,
  tools: [
    sharedTools.channel.read_channel,

    sharedTools.inbox.inbox_list,
    sharedTools.inbox.inbox_kill,

    sharedTools.ticket.dispatch_ticket,
    sharedTools.ticket.note_ticket,

    tools.list_ticket,

    tools.link_dependency,
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
