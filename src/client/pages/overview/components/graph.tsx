import type { ReactNode } from 'react'
import type { AgentGraphNode } from '../../../types'
import { usePanel } from '../../../hooks/use-panel'
import { useStore } from '../../../hooks/use-store'
import { GraphCanvas } from './graph-canvas'

export function Graph(): ReactNode {
  const { data } = usePanel()

  const filters = useStore(state => state.filters)

  const visibleTickets = new Set(data.tickets.filter(({ ticket }) => (!filters.project || ticket.projectId === filters.project) && (!filters.status || (filters.status === 'paused' ? ticket.paused : filters.status === 'error' ? ticket.failureReason : ticket.status === filters.status))).map(({ ticket }) => ticket.id))

  const source = data.graph.nodes.filter(node => (!node.projectId || !filters.project || node.projectId === filters.project) && (!node.ticketId || visibleTickets.has(node.ticketId)))

  const columns = new Map<number, number>()

  const nodes: AgentGraphNode[] = source.map((node) => {
    const column = node.kind === 'main' ? 0 : node.kind === 'supervisor' ? 1 : node.kind === 'project' ? 2 : node.kind === 'ticket' ? 3 : 4

    const row = columns.get(column) ?? 0

    columns.set(column, row + 1)

    return { ...node, kind: node.kind === 'ticket' ? 'task' : node.kind === 'worker' ? 'session' : node.kind === 'project' ? 'route' : 'orchestrator', subtitle: node.sessionId ?? node.ticketId ?? node.projectId ?? '', x: 20 + column * 212, y: 30 + row * 95, taskId: node.ticketId ?? undefined }
  })

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--dsw-alias-border-l3)] bg-[var(--dsw-alias-bg-layer-1)]">
      <header className="px-5 py-3">
        <h2 className="m-0 text-sm font-medium">编排关系</h2>
        <p className="m-0 mt-1 text-xs text-[var(--dsw-alias-label-secondary)]">真实角色、项目、工单、执行与依赖。选择节点查看工单，不创建会话或连线。</p>
      </header>
      {nodes.length ? <GraphCanvas nodes={nodes} edges={data.graph.edges} /> : <p className="p-5">当前筛选没有编排节点，请清除筛选。</p>}
    </section>
  )
}
