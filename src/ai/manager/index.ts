import { definePreset } from '../../utils/agent'
import { plugins } from '../_shared'
import { getManagerSystemPrompt } from '../_shared/prompts'

export const manager = definePreset({
  id: 'manager',
  name: '项目编排',
  description: '一个仓库一个：派 Worker、看汇报、收尾，任务走到哪一步由它推。不写代码。',
  instruction: getManagerSystemPrompt(),
  order: 5,
  tools: [],
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
