import type { ReactNode } from 'react'
/**
 * 触发页：左边话题列表，右边选中话题的触发。
 *
 * 分诊结论（`triage`）挂在话题上而不是触发上 —— 一条话题只判一次，
 * 之后它的所有触发都直接进项目编排。这也是页面上唯一要看的状态。
 */

import type { GetApiNexusTriggersResponse } from '../apis/index.type'
import { EMPTY, TAB_LABELS } from '../constants'
import { LinkOutIcon } from './icons'
import { Button, Empty, OneLine, relative, Tag } from './widgets'

type TriggerView = GetApiNexusTriggersResponse

/** 分诊结论的展示。 */
const TRIAGE_META = {
  pending: { label: '待判', tone: 'warning' as const },
  claimed: { label: '已认领', tone: 'success' as const },
  ignored: { label: '已忽略', tone: 'quiet' as const },
}

export function TriggersPage({ data, threadKey, onSelect }: {
  data: TriggerView | undefined
  threadKey: string | undefined
  onSelect: (key: string | undefined) => void
}): ReactNode {
  if (!data)
    return <p className="p-4 text-[12px] text-nx-text-3">正在读取…</p>

  return (
    <div className="grid h-full min-h-0 gap-3 p-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      {/* 话题 */}
      <div className="nx-card flex min-h-0 flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-nx-border-1 px-4 py-2.5">
          <h3 className="text-[13px] font-medium text-nx-text">话题</h3>
          <span className="text-[10px] text-nx-caption">{data.threads.length}</span>
        </header>
        <div className="min-h-0 flex-1 overflow-auto nx-scroll">
          {data.threads.length === 0
            ? <Empty text={EMPTY.threads} />
            : (
                <ul className="list-none divide-y divide-nx-border-1 p-0">
                  {data.threads.map((thread) => {
                    const meta = TRIAGE_META[thread.triage]
                    const active = thread.key === threadKey
                    return (
                      <li key={thread.key}>
                        <button
                          type="button"
                          onClick={() => onSelect(active ? undefined : thread.key)}
                          className={`w-full px-4 py-2.5 text-left ${active ? 'bg-nx-active' : 'hover:bg-nx-hover'}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <OneLine text={thread.title} className="text-[12px] text-nx-text" />
                            <Tag tone={meta.tone}>{meta.label}</Tag>
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-nx-caption">
                            <span>{thread.channel}</span>
                            <span aria-hidden>·</span>
                            <span>{thread.kind}</span>
                            <span aria-hidden>·</span>
                            <span>
                              {thread.triggers}
                              {' '}
                              条
                            </span>
                            {thread.project && (
                              <>
                                <span aria-hidden>·</span>
                                <span>{thread.project}</span>
                              </>
                            )}
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
        </div>
      </div>

      {/* 触发 */}
      <div className="nx-card flex min-h-0 flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-nx-border-1 px-4 py-2.5">
          <h3 className="text-[13px] font-medium text-nx-text">
            {threadKey ? `${TAB_LABELS.triggers} · ${data.triggers.length}` : TAB_LABELS.triggers}
          </h3>
          {threadKey && <span className="text-[10px] text-nx-caption">按时间倒序</span>}
        </header>
        <div className="min-h-0 flex-1 overflow-auto nx-scroll">
          {!threadKey
            ? <Empty text="从左边选一条话题，看它的触发" />
            : data.triggers.length === 0
              ? <Empty text="这个话题还没有触发" />
              : (
                  <ul className="list-none divide-y divide-nx-border-1 p-0">
                    {data.triggers.map(trigger => (
                      <li key={trigger.id} className="px-4 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="shrink-0 rounded bg-nx-layer-3 px-1.5 py-0.5 text-[10px] text-nx-text-3">
                              {trigger.kind}
                            </span>
                            <span className="truncate text-[12px] text-nx-text-2">
                              {trigger.actorName ?? '未知'}
                            </span>
                            {trigger.human && <Tag tone="neutral">人</Tag>}
                            {trigger.mentioned && <Tag tone="info">@</Tag>}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="text-[10px] text-nx-caption">{relative(trigger.at)}</span>
                            {trigger.url && (
                              <Button size="sm" variant="ghost" icon={<LinkOutIcon />} onClick={() => window.open(trigger.url, '_blank')}>
                                原文
                              </Button>
                            )}
                          </div>
                        </div>
                        <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[12px] text-nx-text">{trigger.text}</p>
                        {trigger.ref && (
                          <p className="mt-1 font-mono text-[10px] text-nx-caption">
                            ref
                            {trigger.ref}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
        </div>
      </div>
    </div>
  )
}
