import type { ReactNode } from 'react'
import { Button, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { usePanel } from '../../hooks/use-panel'
import { useActions } from '../../hooks/use-store'

export function Channel(): ReactNode {
  const { data } = usePanel()

  const { openChannel, go } = useActions()

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <h2 className="m-0 text-base font-medium">GitHub 环境与渠道状态</h2>
      <p className="m-0 text-xs text-[var(--dsw-alias-label-secondary)]">复用宿主 gh 环境。这里只显示 04 记录的核验与投递结果，不读取 token、不创建账号、不将未核验环境显示为已连接。</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {data.channels.map(channel => (
          <article key={channel.projectId} className="rounded-xl border border-[var(--dsw-alias-border-l3)] bg-[var(--dsw-alias-bg-layer-1)] p-4">
            <header className="flex flex-wrap items-center gap-2">
              <h3 className="m-0 text-sm font-medium">{channel.name}</h3>
              <Tag tone={channel.available ? 'success' : 'warning'}>{channel.available ? '最近核验可用' : '不可用'}</Tag>
            </header>
            <p className="break-all font-mono text-xs">{channel.repository ?? '仓库身份未核验'}</p>
            <p className="text-xs">{channel.reason ?? '已记录 gh 环境核验，请查看具体采集时间'}</p>
            <Button size="sm" variant="outline" onClick={() => openChannel(channel.projectId)}>查看环境与投递事实</Button>
          </article>
        ))}
      </div>
      {!data.channels.length && (
        <div>
          <p>尚无项目渠道。先添加 Git 工作区并核对启用范围。</p>
          <Button size="sm" variant="outline" onClick={() => go('setting')}>管理项目范围</Button>
        </div>
      )}
    </section>
  )
}
