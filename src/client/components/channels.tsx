/**
 * 渠道页。
 *
 * 一渠道一账号。`host` 只有 GitLab 有值 —— 自建实例和 SaaS 用同一个
 * `gitlab` 渠道，只改站点。凭证不在库里，这里只显示「有没有登录」。
 *
 * 加渠道用右上角的按钮开一个弹窗：选渠道 → 填站点（仅 GitLab）→ 走登录。
 */

import type { ReactNode } from 'react'
import type { GetApiNexusChannelsResponse } from '../apis/index.type'
import { useState } from 'react'
import { CHANNEL_LABELS, EMPTY } from '../constants'
import { NexusIcon } from './icons'
import { Button, StateDot } from './official'
import { FormDialog } from './ui/form-dialog'

type ChannelView = GetApiNexusChannelsResponse
type Channel = ChannelView['channels'][number]

/** 能加的渠道。id 与 `Channel.id` 一致，也是 skill 文件名的后缀。 */
const ADDABLE = ['github', 'gitlab', 'feishu', 'qq', 'wechat'] as const

const ACCOUNT_ROLE_LABELS: Record<string, string> = { bot: '机器人', admin: '管理员' }

export function ChannelsPage({ data, onToggle, onCreate }: {
  data: ChannelView | undefined
  onToggle: (id: string, enabled: boolean) => void
  onCreate: (input: { id: string, host?: string }) => Promise<void>
}): ReactNode {
  const [adding, setAdding] = useState(false)

  if (!data)
    return <p className="px-4 py-8 text-center text-[12px] text-nx-text-3">正在读取…</p>

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-4 pt-4">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 pb-3">
          <div className="min-w-0">
            <h2 className="text-[14px] font-medium text-nx-text">渠道</h2>
            <p className="mt-0.5 text-[12px] text-nx-text-3">
              监听中的渠道会把触发送进主编排；关掉的不会再产生触发。
            </p>
          </div>
          <Button size="sm" variant="primary" onClick={() => setAdding(true)}>添加渠道</Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 pb-6 nx-scroll">
        <div className="mx-auto w-full max-w-5xl">
          {data.channels.length === 0
            ? (
                <div className="nx-card flex flex-col items-center gap-3 px-4 py-14">
                  <NexusIcon size={28} className="text-nx-text-3" />
                  <p className="text-[12px] text-nx-text-3">{EMPTY.channels}</p>
                  <Button size="sm" variant="outline" onClick={() => setAdding(true)}>添加第一个渠道</Button>
                </div>
              )
            : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {data.channels.map(channel => (
                    <ChannelCard key={channel.id} channel={channel} onToggle={onToggle} />
                  ))}
                </div>
              )}
        </div>
      </div>

      <AddChannelDialog
        open={adding}
        onOpenChange={setAdding}
        existing={data.channels.map(channel => channel.id)}
        onCreate={onCreate}
      />
    </div>
  )
}

function ChannelCard({ channel, onToggle }: { channel: Channel, onToggle: (id: string, enabled: boolean) => void }): ReactNode {
  const online = channel.accounts.filter(account => account.status === 'online').length

  return (
    <section className="nx-card flex flex-col gap-2.5 px-4 py-3">
      <header className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <NexusIcon size={16} className={channel.enabled ? 'text-nx-success' : 'text-nx-idle'} />
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium text-nx-text">
              {CHANNEL_LABELS[channel.id] ?? channel.name}
            </div>
            <div className="truncate text-[11px] text-nx-caption">
              {channel.host ?? channel.id}
            </div>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] text-nx-text-2">
          <StateDot state={channel.enabled ? 'done' : 'idle'} />
          {channel.enabled ? '监听中' : '已关闭'}
        </span>
      </header>

      <dl className="grid grid-cols-3 gap-2 text-[11px]">
        <Stat label="账号" value={`${online}/${channel.accounts.length}`} />
        <Stat label="项目" value={String(channel.projects)} />
        <Stat label="话题" value={String(channel.threads)} />
      </dl>

      <div className="min-h-[2.5rem]">
        {channel.accounts.length === 0
          ? <p className="text-[11px] text-nx-text-3">还没有机器人账号</p>
          : (
              <ul className="flex flex-col gap-1">
                {channel.accounts.map(account => (
                  <li key={account.id} className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] text-nx-text-2">
                      {account.name}
                      <span className="ml-1 text-nx-caption">{ACCOUNT_ROLE_LABELS[account.role] ?? account.role}</span>
                    </span>
                    <span className={`shrink-0 text-[10px] ${account.status === 'online' ? 'text-nx-success' : 'text-nx-text-3'}`}>
                      {account.status === 'online' ? '已登录' : '未登录'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-nx-border-1 pt-2">
        <span className="truncate text-[10px] text-nx-caption">
          {channel.lastReadAt ? `${channel.cursors.length} 个游标` : '还没读取过'}
        </span>
        <Button size="sm" variant="outline" onClick={() => onToggle(channel.id, !channel.enabled)}>
          {channel.enabled ? '关闭监听' : '开启监听'}
        </Button>
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string, value: string }): ReactNode {
  return (
    <div className="rounded-nx-sm bg-nx-layer-2 px-2 py-1.5">
      <dt className="text-[10px] text-nx-caption">{label}</dt>
      <dd className="mt-0.5 text-[13px] font-medium tabular-nums text-nx-text">{value}</dd>
    </div>
  )
}

/**
 * 添加渠道。
 *
 * 站点地址只对 GitLab 出现 —— GitHub 只支持 github.com，飞书站点固定。
 * 选完渠道给一句「下一步做什么」，因为真正的登录发生在渠道自己的授权页，
 * 不是在这个弹窗里填完就完事。
 */
function AddChannelDialog({ open, onOpenChange, existing, onCreate }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  existing: string[]
  onCreate: (input: { id: string, host?: string }) => Promise<void>
}): ReactNode {
  const [picked, setPicked] = useState<string | null>(null)
  const [host, setHost] = useState('')
  const [busy, setBusy] = useState(false)

  const available = ADDABLE.filter(id => !existing.includes(id))
  const options = available.map(id => ({ id, label: CHANNEL_LABELS[id] ?? id }))
  const needsHost = picked === 'gitlab'

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setPicked(null)
          setHost('')
        }
        onOpenChange(next)
      }}
      title="添加渠道"
      options={options}
      optionValue={picked}
      onOptionChange={setPicked}
      optionsLabel="要添加的渠道"
      submitLabel="添加"
      cancelLabel="取消"
      submitDisabled={picked === null}
      submitting={busy}
      onSubmit={async () => {
        if (picked === null)
          return
        setBusy(true)
        try {
          await onCreate({ id: picked, ...host.trim() ? { host: host.trim() } : {} })
          onOpenChange(false)
          setPicked(null)
          setHost('')
        }
        finally {
          setBusy(false)
        }
      }}
    >
      {picked === null
        ? <p className="mt-3 text-[12px] text-nx-text-3">选一个渠道，然后按下一步。</p>
        : (
            <div className="mt-3 flex flex-col gap-2">
              <p className="text-[12px] text-nx-text-2">
                {needsHost
                  ? '填自建实例的地址；用 gitlab.com 就留空。'
                  : `用 ${CHANNEL_LABELS[picked] ?? picked} 官方站点。`}
              </p>
              {needsHost
                ? (
                    <input
                      className="nx-textarea"
                      style={{ minHeight: 'auto', padding: '8px 12px' }}
                      placeholder="https://gitlab.example.com"
                      value={host}
                      onChange={event => setHost(event.target.value)}
                    />
                  )
                : null}
              <p className="text-[11px] text-nx-caption">
                添加后回到卡片上点「登录」完成授权，凭证会落在该渠道自己的目录里。
              </p>
            </div>
          )}
    </FormDialog>
  )
}
