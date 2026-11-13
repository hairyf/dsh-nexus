import type { ReactNode } from 'react'
/**
 * 任务页：列表 + 详情。
 *
 * 详情是同一页里换内容，不开新面板 —— 返回按钮就是「把 id 清掉」。
 * 详情的四块（触发来源 / 执行记录 / 关联任务 / 消息）对应
 * `TicketThread`、`Worker`、`TicketLink`、`Inbox` 四张表。
 */

import type { GetApiNexusTasksResponse, GetApiNexusTicketsidResponse } from '../apis/index.type'
import { TICKET_FILTERS } from '../../constants'
import { getApiNexusTicketsId, usePoll } from '../api'
import { DETAIL_SECTIONS, EMPTY } from '../constants'
import { BackIcon, LinkOutIcon, PauseIcon, SessionIcon } from './icons'
import { Button, Pill } from './official'
import { AttentionMark, Card, Empty, Field, OneLine, relative, remaining, StatusTag } from './widgets'

type TaskList = GetApiNexusTasksResponse
type TaskDetail = GetApiNexusTicketsidResponse

const FILTER_LABELS: Record<string, string> = {
  all: '全部',
  running: '进行中',
  review: '待审',
  waiting: '等待',
  done: '已完成',
  cancelled: '已取消',
}

/** 任务列表。 */
export function TasksPage({ data, filter, onFilter, onOpen }: {
  data: TaskList | undefined
  filter: string
  onFilter: (next: string) => void
  onOpen: (id: string) => void
}): ReactNode {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col gap-3">
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {TICKET_FILTERS.map(key => (
            <Pill key={key} active={filter === key} onClick={() => onFilter(key)}>
              {FILTER_LABELS[key]}
              <span className="ml-1 text-[10px] opacity-60">{data?.counts[key] ?? 0}</span>
            </Pill>
          ))}
        </div>
        <div className="nx-card min-h-0 flex-1 overflow-auto nx-scroll">
          {!data
            ? <Empty text="正在读取…" />
            : data.tickets.length === 0
              ? <Empty text={EMPTY.tickets} />
              : (
                  <ul className="divide-y divide-nx-border-1">
                    {data.tickets.map(ticket => (
                      <li key={ticket.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => onOpen(ticket.id)}
                          className="nx-plain min-w-0 flex-1 text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span className="shrink-0 font-mono text-[11px] text-nx-text-3">{ticket.id}</span>
                            <span className="truncate text-[13px] text-nx-text">{ticket.title}</span>
                            {ticket.attention && <AttentionMark />}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-nx-caption">
                            <span>{ticket.project}</span>
                            <span aria-hidden>·</span>
                            <span>{ticket.channel}</span>
                            <span aria-hidden>·</span>
                            <span>{relative(ticket.updatedAt)}</span>
                          </div>
                        </button>
                        <div className="flex shrink-0 items-center gap-2">
                          <StatusTag status={ticket.status} />
                          <Button size="sm" variant="ghost" onClick={() => onOpen(ticket.id)}>打开详情</Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={<SessionIcon />}
                            onClick={() => onOpen(ticket.id)}
                          >
                            打开会话
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
        </div>
      </div>
    </div>
  )
}

/** 任务详情。 */
export function TaskDetailPage({ id, onBack, onTogglePause }: {
  id: string
  onBack: () => void
  onTogglePause: (id: string, next: boolean) => void
}): ReactNode {
  const { data, error } = usePoll<TaskDetail>(() => getApiNexusTicketsId({ id }), 5000, [id])

  if (error)
    return <div className="p-4 text-[12px] text-nx-danger">{error}</div>
  if (!data)
    return <div className="p-4 text-[12px] text-nx-text-3">正在读取…</div>

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto p-4 nx-scroll">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
        <header className="flex shrink-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" icon={<BackIcon />} onClick={onBack}>返回</Button>
              <span className="font-mono text-[12px] text-nx-text-3">{data.id}</span>
              <StatusTag status={data.status} />
              {data.attention && <AttentionMark />}
            </div>
            <h2 className="mt-1.5 text-[16px] font-medium text-nx-text">{data.title}</h2>
            <p className="mt-1 text-[11px] text-nx-caption">
              {data.project}
              {' '}
              ·
              {data.channel}
              {' '}
              · 创建于
              {relative(data.createdAt)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {data.prUrl && (
              <Button size="sm" variant="outline" icon={<LinkOutIcon />} onClick={() => window.open(data.prUrl, '_blank')}>
                PR
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              icon={<PauseIcon />}
              onClick={() => onTogglePause(data.id, !data.paused)}
            >
              {data.paused ? '恢复' : '暂停'}
            </Button>
          </div>
        </header>

        {data.prepareError && (
          <div className="rounded-nx-sm border border-nx-danger px-3 py-2 text-[12px] text-nx-danger">
            准备阶段失败：
            {data.prepareError}
          </div>
        )}

        <div className="grid shrink-0 gap-3 md:grid-cols-2">
          <Card title="基本信息">
            <dl className="px-4 py-2">
              <Field label="需求">{data.description ?? '—'}</Field>
              <Field label="开始">{relative(data.startedAt)}</Field>
              <Field label="结束">{relative(data.endedAt)}</Field>
              <Field label="PR 状态">{data.prState ?? '—'}</Field>
              <Field label="CI">{data.ciState ?? '—'}</Field>
              <Field label="暂停">{data.paused ? '已暂停，不派发、不投递' : '正常运行'}</Field>
            </dl>
          </Card>

          <Card title={DETAIL_SECTIONS.links}>
            {data.links.length === 0
              ? <Empty text={EMPTY.links} />
              : (
                  <ul className="divide-y divide-nx-border-1">
                    {data.links.map(link => (
                      <li key={link.id} className="flex items-center justify-between gap-2 px-4 py-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] text-nx-text-3">{link.id}</span>
                            <OneLine text={link.title} className="text-[12px] text-nx-text" />
                          </div>
                          <span className="block text-[11px] text-nx-caption">
                            {link.kind === 'depends' ? '依赖' : '相关'}
                          </span>
                        </div>
                        <StatusTag status={link.status} />
                      </li>
                    ))}
                  </ul>
                )}
          </Card>
        </div>

        <Card title={DETAIL_SECTIONS.threads}>
          {data.threads.length === 0
            ? <Empty text="没有关联话题" />
            : (
                <ul className="divide-y divide-nx-border-1">
                  {data.threads.map(thread => (
                    <li key={thread.key} className="flex items-center justify-between gap-2 px-4 py-2">
                      <div className="min-w-0">
                        <OneLine text={thread.title} className="text-[12px] text-nx-text" />
                        <span className="block text-[11px] text-nx-caption">
                          {thread.kind}
                          {' '}
                          ·
                          {' '}
                          {thread.key}
                        </span>
                      </div>
                      {thread.url && (
                        <Button size="sm" variant="ghost" icon={<LinkOutIcon />} onClick={() => window.open(thread.url, '_blank')}>
                          打开
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
        </Card>

        <Card title={DETAIL_SECTIONS.workers}>
          {data.workers.length === 0
            ? <Empty text={EMPTY.workers} />
            : (
                <ul className="divide-y divide-nx-border-1">
                  {data.workers.map(worker => (
                    <li key={worker.id} className="px-4 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <OneLine text={worker.title ?? worker.id} className="text-[12px] text-nx-text" />
                          <span className="block text-[11px] text-nx-caption">
                            {worker.branch ?? '无分支'}
                            {' '}
                            ·
                            {worker.status}
                          </span>
                        </div>
                        {worker.reportState && <span className="text-[11px] text-nx-text-2">{worker.reportState}</span>}
                      </div>
                      {worker.report && (
                        <p className="mt-1 line-clamp-2 text-[11px] text-nx-text-2">{worker.report}</p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-nx-caption">
                        {worker.reportAt && (
                          <span>
                            汇报于
                            {relative(worker.reportAt)}
                          </span>
                        )}
                        {worker.backgroundUntil && (
                          <span className="text-nx-warn">
                            后台占槽
                            {remaining(worker.backgroundUntil)}
                          </span>
                        )}
                        {worker.recoveryNote && (
                          <span className="text-nx-warn">
                            恢复提示：
                            {worker.recoveryNote}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
        </Card>

        <Card title={DETAIL_SECTIONS.inbox}>
          {data.inbox.length === 0
            ? <Empty text={EMPTY.inbox} />
            : (
                <ul className="divide-y divide-nx-border-1">
                  {data.inbox.map(item => (
                    <li key={item.id} className="px-4 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 flex-1 truncate text-[12px] text-nx-text">{item.title ?? item.message}</span>
                        <span className="shrink-0 text-[10px] text-nx-caption">{item.type}</span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-nx-caption">
                        <span>{relative(item.createdAt)}</span>
                        {item.status === 'stalled' && (
                          <span className="text-nx-danger">
                            投递失败
                            {item.deliveryAttempts}
                            {' '}
                            次
                          </span>
                        )}
                        {item.escalations > 0 && (
                          <span>
                            已升级
                            {item.escalations}
                            {' '}
                            次
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
        </Card>
      </div>
    </div>
  )
}
