import type { ReactNode } from 'react'
import { Button, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { usePanel } from '../../hooks/use-panel'
import { useActions, useStore } from '../../hooks/use-store'

export function Filters(): ReactNode {
  const { data } = usePanel()

  const filters = useStore(state => state.filters)

  const { filter } = useActions()

  return (
    <div className="flex flex-wrap gap-3">
      <label>
        项目
        <select className="rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-layer-1)] p-1" value={filters.project} onChange={event => filter({ project: event.target.value })}>
          <option value="">全部项目</option>
          {data.projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
      </label>
      <label>
        状态
        <select className="rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-layer-1)] p-1" value={filters.status} onChange={event => filter({ status: event.target.value })}>
          <option value="">全部状态</option>
          {['waiting', 'queued', 'running', 'review', 'done', 'cancelled', 'paused', 'error'].map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      {(filters.project || filters.status) && <Button variant="ghost" size="sm" onClick={() => filter({ project: '', status: '' })}>清除筛选</Button>}
    </div>
  )
}
export function TicketRows(): ReactNode {
  const { data } = usePanel()

  const { openTicket, go } = useActions()

  const filters = useStore(state => state.filters)

  const tickets = data.tickets.filter(({ ticket }) => (!filters.project || ticket.projectId === filters.project) && (!filters.status || (filters.status === 'paused' ? ticket.paused : filters.status === 'error' ? ticket.failureReason : ticket.status === filters.status)))

  if (!data.tickets.length) {
    return (
      <section>
        <p>账本中尚无工单。启用可用 Git 项目后，由 main 根据来源目标分诊。</p>
        <Button size="sm" variant="outline" onClick={() => go('setting')}>检查项目范围</Button>
      </section>
    )
  }

  if (!tickets.length)
    return <p role="status">没有匹配的工单。请清除项目或状态筛选。</p>

  return (
    <ul className="m-0 list-none rounded-xl border border-[var(--dsw-alias-border-l3)] p-0">
      {tickets.map(({ ticket, reasons }) => (
        <li key={ticket.id} className="flex flex-wrap items-center gap-3 border-b border-[var(--dsw-alias-border-l3)] px-4 py-3 last:border-0">
          <Button variant="ghost" size="sm" onClick={() => openTicket(ticket.id)}>{ticket.title}</Button>
          <span className="font-mono text-xs">{ticket.id}</span>
          <Tag tone={ticket.paused || ticket.failureReason ? 'warning' : ticket.status === 'done' ? 'success' : 'quiet'}>{ticket.paused ? 'paused' : ticket.status}</Tag>
          <span className="text-xs text-[var(--dsw-alias-label-secondary)]">
            {data.projects.find(project => project.id === ticket.projectId)?.name}
            {' '}
            ·
            {' '}
            {reasons.join(' · ') || '无阻塞'}
          </span>
        </li>
      ))}
    </ul>
  )
}
export function Ticket(): ReactNode {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="m-0 text-base font-medium">工单目标与进展</h2>
      <Filters />
      <TicketRows />
    </section>
  )
}
