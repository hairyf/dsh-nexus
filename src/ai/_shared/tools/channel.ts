import { defineTool } from '@deepseek-ai/dsh-tools'

export const read_channel = defineTool({
  name: 'read_channel',
  description: '读渠道原文，靠 resource 路径前缀分发。返回 { items, next_offset, next_resource }，两条翻页轴都要跟完。',
  parameters: {
    resource: {
      type: 'string',
      required: true,
      description: '资源路径，前缀决定分发：github/…、feishu/…、trigger/<id>、thread/<id>、ticket/<id>。',
    },
    offset: {
      type: 'integer',
      description: '从上一次的 next_offset 续读；0 表示重读同一份快照的开头。',
    },
    limit: {
      type: 'integer',
      description: '本次最多返回多少条；省略则用渠道默认值。',
    },
  },
  output: {
    schema: { type: 'string', description: '本条资源的正文分片，末尾附 next_offset / next_resource。' },
    render: (_args, value) => [{ type: 'text', text: value }],
  },
  execute: async () => {
    // TODO: 按 resource 前缀分发到对应渠道读取器，统一返回 { items, next_offset, next_resource }
    // TODO: Worker 只能读本任务来源的资源；其余角色不限，越权直接报错
    // TODO: 分支 CI 这类没有地址的话题（ThreadKind=ci）不产生可回复地址，读可以，回复要报错
    throw new Error('read_channel 尚未实现')
  },
})
