import type { ReactNode } from 'react'
/**
 * 收件箱面板。
 *
 * 复刻官方 todo-panel 的观感：右侧抽屉、按收件人分组、每条可单独标掉。
 * 区别在于这里的分组是**收件人**（人 / 主编排 / 项目编排 / Supervisor），
 * 因为消息的本体就是「此刻轮到谁」。
 *
 * `stalled` 单独一栏：它不是「没轮到」，是「送不到」，混进未读会让人误判。
 */

import type { InboxTarget } from '../../types'
import type { GetApiNexusInboxResponse } from '../apis/index.type'
import { EMPTY, INBOX_GROUP_LABELS } from '../constants'
import { InboxIcon } from './icons'
import { Button, Empty, relative, remaining, Tag } from './widgets'

type InboxView = GetApiNexusInboxResponse
type InboxItem = InboxView['items'][number]

/** 收件箱里按收件人分组的顺序：人在最前，因为只有人会真的去看。 */
const GROUPS: InboxTarget[] = ['user', 'main', 'project', 'supervisor']

const KIND_META: Record<string, { label: string, tone: 'warning' | 'info' | 'neutral' | 'quiet' }> = {
  ask: { label: '待回答', tone: 'warning' },
  trigger: { label: '新触发', tone: 'info' },
  ticket: { label: '任务', tone: 'neutral' },
  notice: { label: '提醒', tone: 'quiet' },
}

export function InboxPanel({ data, open, onClose, onKill }: {
  data: InboxView | undefined
  open: boolean
  onClose: () => void
  onKill: (ids: string[]) => void
}): ReactNode {
  if (!open)
    return null

  const items = data?.items ?? []
  const stalled = items.filter(item => item.status === 'stalled')
  const total = (data?.counts.user ?? 0) + (data?.counts.main ?? 0) + (data?.counts.project ?? 0) + (data?.counts.supervisor ?? 0)

  return (
    <aside className="absolute inset-y-0 right-0 z-20 flex w-[22rem] max-w-[86%] flex-col border-l border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-layer-1)] shadow-xl">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--dsw-alias-border-l1)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <InboxIcon size={15} className="text-[var(--dsw-alias-label-primary)]-2" />
          <h3 className="text-[13px] font-medium text-[var(--dsw-alias-label-primary)]">收件箱</h3>
          <span className="text-[11px] text-[var(--dsw-alias-label-caption)]">
            {total}
            {' '}
            条未处理
          </span>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>关闭</Button>
      </header>

      <div className="min-h-0 flex-1 overflow-auto nx-scroll">
        {items.length === 0 && <Empty text={EMPTY.inbox} />}

        {GROUPS.map((target) => {
          const group = items.filter(item => item.type === target && item.status !== 'stalled')
          if (group.length === 0)
            return null
          return (
            <section key={target}>
              <header className="sticky top-0 z-10 flex items-center justify-between bg-[var(--dsw-alias-bg-layer-2)] px-4 py-1.5">
                <span className="text-[11px] font-medium text-[var(--dsw-alias-label-primary)]-2">{INBOX_GROUP_LABELS[target]}</span>
                <span className="text-[10px] text-[var(--dsw-alias-label-caption)]">
                  {data?.counts[target] ?? 0}
                  {' '}
                  未处理
                </span>
              </header>
              <ul className="divide-y divide-[var(--dsw-alias-border-l1)]">
                {group.map(item => (
                  <InboxRow key={item.id} item={item} onKill={onKill} />
                ))}
              </ul>
            </section>
          )
        })}

        {stalled.length > 0 && (
          <section>
            <header className="sticky top-0 z-10 flex items-center justify-between bg-[var(--dsw-alias-bg-layer-2)] px-4 py-1.5">
              <span className="text-[11px] font-medium text-[var(--dsw-alias-state-error-primary)]">投递卡住</span>
              <span className="text-[10px] text-[var(--dsw-alias-label-caption)]">
                {stalled.length}
                {' '}
                条
              </span>
            </header>
            <ul className="divide-y divide-[var(--dsw-alias-border-l1)]">
              {stalled.map(item => (
                <InboxRow key={item.id} item={item} onKill={onKill} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </aside>
  )
}

/** 一条消息。整行可点即标掉 —— 和官方 todo 一样，不需要二次确认。 */
function InboxRow({ item, onKill }: { item: InboxItem, onKill: (ids: string[]) => void }): ReactNode {
  const meta = KIND_META[item.kind] ?? KIND_META.notice
  const done = item.status === 'done'
  const stalled = item.status === 'stalled'

  return (
    <li className={`group flex items-start gap-2 px-4 py-2.5 ${done ? 'opacity-50' : ''}`}>
      <button
        type="button"
        aria-label={done ? '已处理' : '标为已处理'}
        onClick={() => onKill([item.id])}
        className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
          done
            ? 'border-[var(--dsw-alias-state-success-primary)] bg-[var(--dsw-alias-state-success-primary)] text-white'
            : 'border-[var(--dsw-alias-border-l3)] text-transparent hover:border-[var(--dsw-alias-label-primary)]-2 hover:text-[var(--dsw-alias-label-primary)]-3'
        }`}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden>
          <path d="m5 13 4 4L19 7" />
        </svg>
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Tag tone={stalled ? 'danger' : meta.tone}>{stalled ? '送不到' : meta.label}</Tag>
          {item.ticketId && <span className="font-mono text-[10px] text-[var(--dsw-alias-label-caption)]">{item.ticketId}</span>}
          <span className="ml-auto shrink-0 text-[10px] text-[var(--dsw-alias-label-caption)]">{relative(item.createdAt)}</span>
        </div>

        <p className={`mt-1 whitespace-pre-wrap text-[12px] leading-snug ${done ? 'text-[var(--dsw-alias-label-primary)]-3 line-through' : 'text-[var(--dsw-alias-label-primary)]'}`}>
          {item.title ?? item.message}
        </p>

        {item.title && item.message !== item.title && (
          <p className="mt-0.5 line-clamp-2 text-[11px] text-[var(--dsw-alias-label-primary)]-2">{item.message}</p>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-[var(--dsw-alias-label-caption)]">
          <span>{item.origin}</span>
          {item.project && (
            <>
              <span aria-hidden>·</span>
              <span>{item.project}</span>
            </>
          )}
          {item.deadline && item.status === 'pending' && (
            <span className="text-[var(--dsw-alias-state-warn-primary)]">{remaining(item.deadline)}</span>
          )}
          {item.escalations > 0 && (
            <span>
              已升级
              {item.escalations}
              {' '}
              次
            </span>
          )}
          {stalled && item.deliveryError && <span className="text-[var(--dsw-alias-state-error-primary)]">{item.deliveryError}</span>}
          {item.answer && (
            <span className="text-[var(--dsw-alias-state-success-primary)]">
              已答：
              {item.answer}
            </span>
          )}
        </div>
      </div>
    </li>
  )
}
