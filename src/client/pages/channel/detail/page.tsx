import type { ReactNode } from 'react'
import { Button, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { usePanel } from '../../../hooks/use-panel'
import { useActions, useStore } from '../../../hooks/use-store'

export function ChannelDetail(): ReactNode {
  const { data } = usePanel()

  const { go } = useActions()

  const id = useStore(state => state.channel.selected)

  const channel = data.channels.find(item => item.projectId === id)

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div><Button size="sm" variant="ghost" onClick={() => go('channel')}>返回渠道</Button></div>
      {channel
        ? (
            <>
              <h2 className="m-0 text-lg font-medium">
                GitHub ·
                {channel.name}
              </h2>
              <Tag tone={channel.available ? 'success' : 'warning'}>{channel.available ? '最近核验可用' : channel.reason}</Tag>
              <p className="m-0 text-xs">
                仓库：
                {channel.repository ?? '待核验'}
                。不可用时请在宿主修复 gh 环境或项目范围，再由宿主重新核验。刷新本页只读取事实，不伪造连接。
              </p>
              {channel.facts.map(fact => (
                <article key={fact.name} className="rounded-xl border border-[var(--dsw-alias-border-l3)] p-4">
                  <h3 className="m-0 break-all text-sm font-medium">{fact.name}</h3>
                  <p className="text-xs text-[var(--dsw-alias-label-secondary)]">
                    观测时间
                    {fact.updatedAt}
                  </p>
                  <pre className="m-0 whitespace-pre-wrap break-all text-xs">{JSON.stringify(fact.value, null, 2)}</pre>
                </article>
              ))}
              {!channel.facts.length && <p>尚无环境核验或采集事实；请通过宿主完成环境选择与核验。</p>}
            </>
          )
        : <p>项目渠道未找到，请返回列表刷新。</p>}
    </section>
  )
}
