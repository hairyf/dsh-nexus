import { definePreset } from '../../utils/agent'
import { plugins } from '../_shared'
import { getSupervisorSystemPrompt } from '../_shared/prompts'

export const supervisor = definePreset({
  id: 'supervisor',
  name: '临时协调者',
  instruction: getSupervisorSystemPrompt(),
  description: '只在任务跨两个以上项目时临时拉起，协调依赖、对齐两边的结论，用完即弃。不写代码。',
  order: 6,
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
