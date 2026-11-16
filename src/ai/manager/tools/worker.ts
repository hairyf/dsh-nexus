import { defineTool } from '@deepseek-ai/dsh-tools'

export const create_worker = defineTool({
  name: 'create_worker',
  description: '给一张票开 Worker：建 worktree、切分支、起会话一次配好。并发满了就让它留在 queued。',
  parameters: {
    ticketId: {
      type: 'string',
      required: true,
      description: '要开跑的票，必须是本项目的。',
    },
    branch: {
      type: 'string',
      description: '分支名，省略则用 nexus/<任务号>。末段必须是任务号，PR 归哪张票就靠这个字符串比对。',
    },
  },
  output: {
    schema: { type: 'string', description: '新 Worker 的 id、分支与 worktree 路径。' },
    render: (_args, value) => [{ type: 'text', text: value }],
  },
  execute: async () => {
    // TODO: 校验并发（Setting.maxWorkers）；满了把票留 queued，不要硬开
    // TODO: git worktree add + 切分支（末段为任务号）+ 起会话，写 Worker 一行
    // TODO: 建 worktree 失败要写 prepareError，别留半成品
    throw new Error('create_worker 尚未实现')
  },
})

export const view = defineTool({
  name: 'view',
  description: '读 Worker 会话正文，分片返回。这不代替 send_message 的结构化进度与交付证据。',
  parameters: {
    workerId: {
      type: 'string',
      required: true,
      description: '要读的 Worker。',
    },
    offset: {
      type: 'integer',
      description: '从上次的 next_offset 续读；0 表示从头读。',
    },
  },
  output: {
    schema: { type: 'string', description: '会话正文分片，末尾附 next_offset。' },
    render: (_args, value) => [{ type: 'text', text: value }],
  },
  execute: async () => {
    // TODO: 分片读会话正文。正文被分片看多次说明写太长了，实现里可以提示落到文件
    throw new Error('view 尚未实现')
  },
})

export const cancel = defineTool({
  name: 'cancel',
  description: '中止 Worker 当前回合。那一次回合一并作废。',
  parameters: {
    workerId: {
      type: 'string',
      required: true,
      description: '要中止的 Worker。',
    },
    keepInbox: {
      type: 'boolean',
      description: 'true 时不清理它收件箱里的待处理消息；省略则一并清掉。',
    },
  },
  output: {
    schema: { type: 'string', description: '中止结果。' },
    render: (_args, value) => [{ type: 'text', text: value }],
  },
  execute: async () => {
    // TODO: 中止当前回合；keepInbox=false 时清掉未读
    throw new Error('cancel 尚未实现')
  },
})

export const rename = defineTool({
  name: 'rename',
  description: '改 Worker 会话的标题，方便在会话列表里认出来。',
  parameters: {
    workerId: {
      type: 'string',
      required: true,
      description: '要改名的 Worker。',
    },
    title: {
      type: 'string',
      required: true,
      description: '新标题。',
    },
  },
  output: {
    schema: { type: 'string', description: '改名结果。' },
    render: (_args, value) => [{ type: 'text', text: value }],
  },
  execute: async () => {
    // TODO: 改会话标题
    throw new Error('rename 尚未实现')
  },
})
