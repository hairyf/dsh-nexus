import { definePreset } from '../../utils/agent'
import { plugins, sharedTools } from '../_shared'
import { getWorkerSystemPrompt } from '../_shared/prompts'

export const worker = definePreset({
  id: 'worker',
  name: '执行会话',
  instruction: getWorkerSystemPrompt(),
  description: '在任务指定的 worktree 里干活：改代码、跑测试、开 PR，提供交付证据。',
  order: 7,
  tools: [
    sharedTools.channel.read_channel,

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
