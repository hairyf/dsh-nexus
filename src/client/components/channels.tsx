import type { ReactNode } from 'react'
/**
 * 渠道页。
 *
 * 一个渠道一个账号。`host` 只有 GitLab 有值 —— 自建实例和 SaaS 用同一个
 * `gitlab` 渠道，只改站点。凭证不在库里，这里只显示「有没有登录」。
 */

import type { GetApiNexusChannelsResponse } from '../apis/index.type'
import { CHANNEL_LABELS, EMPTY } from '../constants'
import { NexusIcon } from './icons'
import { Button, Empty, relative, StatusLine } from './widgets'

type ChannelView = GetApiNexusChannelsResponse

const ACCOUNT_ROLE_LABELS: Record<string, string> = { bot: '机器人', admin: '管理员' }

export function ChannelsPage({ data, onToggle }: {
  data: ChannelView | undefined
  onToggle: (id: string, enabled: boolean) => void
}): ReactNode {
  if (!data)
    return <p className="p-4 text-[12px] text-[var(--dsw-alias-label-primary)]-3">正在读取…</p>
  if (data.channels.length === 0) {
    return <div className="p-4"><div className="nx-card"><Empty text={EMPTY.channels} /></div></div>
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto p-4 nx-scroll">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data.channels.map(channel => (
          <ChannelCard key={channel.id} channel={channel} onToggle={onToggle} />
        ))}
      </div>
    </div>
  )
}

function ChannelCard({ channel, onToggle }: {
  channel: ChannelView['channels'][number]
  onToggle: (id: string, enabled: boolean) => void
}): ReactNode {
  const online = channel.accounts.filter(account => account.status === 'online').length

  return (
    <section className="nx-card flex flex-col gap-2.5 px-4 py-3">
      <header className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <NexusIcon size={16} className={channel.enabled ? 'text-[var(--dsw-alias-state-success-primary)]' : 'text-[var(--dsw-alias-state-idle-primary)]'} />
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium text-[var(--dsw-alias-label-primary)]">
              {CHANNEL_LABELS[channel.id] ?? channel.name}
            </div>
            <div className="truncate text-[11px] text-[var(--dsw-alias-label-caption)]">
              {channel.host ?? channel.id}
            </div>
          </div>
        </div>
        <StatusLine
          state={channel.enabled ? 'done' : 'idle'}
          text={channel.enabled ? '监听中' : '已关闭'}
        />
      </header>

      <dl className="grid grid-cols-3 gap-2 text-[11px]">
        <Stat label="账号" value={`${online}/${channel.accounts.length}`} />
        <Stat label="项目" value={String(channel.projects)} />
        <Stat label="话题" value={String(channel.threads)} />
      </dl>

      <div className="min-h-[2.5rem]">
        {channel.accounts.length === 0
          ? <p className="text-[11px] text-[var(--dsw-alias-label-primary)]-3">还没有机器人账号</p>
          : (
              <ul className="flex flex-col gap-1">
                {channel.accounts.map(account => (
                  <li key={account.id} className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] text-[var(--dsw-alias-label-primary)]-2">
                      {account.name}
                      <span className="ml-1 text-[var(--dsw-alias-label-caption)]">{ACCOUNT_ROLE_LABELS[account.role] ?? account.role}</span>
                    </span>
                    <span className={`text-[10px] ${account.status === 'online' ? 'text-[var(--dsw-alias-state-success-primary)]' : 'text-[var(--dsw-alias-label-primary)]-3'}`}>
                      {account.status === 'online' ? '已登录' : '未登录'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-[var(--dsw-alias-border-l1)] pt-2">
        <span className="text-[10px] text-[var(--dsw-alias-label-caption)]">
          {channel.lastReadAt ? `最后读取 ${relative(channel.lastReadAt)}` : '还没读取过'}
          {channel.cursors.length > 0 && ` · ${channel.cursors.length} 个游标`}
        </span>
        <div className="flex shrink-0 gap-1.5">
          <Button size="sm" variant="ghost">添加账号</Button>
          <Button size="sm" variant="outline" onClick={() => onToggle(channel.id, !channel.enabled)}>
            {channel.enabled ? '关闭监听' : '开启监听'}
          </Button>
        </div>
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string, value: string }): ReactNode {
  return (
    <div className="rounded-nx-sm bg-[var(--dsw-alias-bg-layer-2)] px-2 py-1.5">
      <dt className="text-[10px] text-[var(--dsw-alias-label-caption)]">{label}</dt>
      <dd className="mt-0.5 text-[13px] font-medium tabular-nums text-[var(--dsw-alias-label-primary)]">{value}</dd>
    </div>
  )
}
