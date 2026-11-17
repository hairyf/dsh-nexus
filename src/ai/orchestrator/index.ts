import { definePreset } from '../../utils/agent'
import { plugins } from '../_shared'
import { getOrchestratorSystemPrompt } from './prompts'

export const orchestrator = definePreset({
  id: 'orchestrator',
  name: '主编排',
  instruction: getOrchestratorSystemPrompt(),
  description: '全局只有一个，管所有项目和渠道：分诊话题、开票派活、跨项目卡住时拉临时协调者。不写代码。',
  order: 4,
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
  ],
})
