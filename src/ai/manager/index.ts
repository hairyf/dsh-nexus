import { definePreset } from '../../utils/agent'
import { plugins, sharedTools } from '../_shared'
import { getManagerSystemPrompt } from '../_shared/prompts'
import * as tools from './tools'

export const manager = definePreset({
  id: 'manager',
  name: '项目编排',
  description: '一个仓库一个：派 Worker、看汇报、收尾，任务走到哪一步由它推。不写代码。',
  instruction: getManagerSystemPrompt(),
  order: 5,
  tools: [
    sharedTools.channel.read_channel,

    sharedTools.inbox.inbox_list,
    sharedTools.inbox.inbox_kill,

    tools.supervisor.supervisor_list,

    tools.ticket.list_ticket,
    tools.ticket.link_ticket,
    tools.ticket.stop_ticket,
    tools.ticket.retry_ticket,

    tools.worker.create_worker,
    tools.worker.view,
    tools.worker.cancel,
    tools.worker.rename,
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

    // plugins.toolSchedule,
    // plugins.toolPluginManager,
    // plugins.toolPluginMarket,
    // plugins.planning,
    // plugins.toolAskUser,
  ],
})
