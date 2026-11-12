import type { ReactNode } from 'react'
/**
 * 层级关系图。
 *
 * 手工分列布局，不引入图形库：渠道一列 → 主编排 → 项目编排一列 → 任务一列。
 * 节点位置只由「它是第几层的第几个」决定，所以加一个项目不需要重算任何东西。
 */

import type { GraphEdge, GraphNode } from '../../types'

/** 四列的固定顺序。Supervisor 挂在主编排下面，和项目同列。 */
/** 节点上显示的角标。`kind` 决定它在哪一列。 */
const KIND_LABELS = {
  channel: '渠道',
  main: '主编排',
  project: '项目编排',
  ticket: '任务',
  worker: 'Worker',
  supervisor: 'Supervisor',
} as const

/** 一列。按 `order` 稳定排序，同一份数据每次画出来一样。 */
function column(nodes: GraphNode[], kind: GraphNode['kind']): GraphNode[] {
  return nodes.filter(node => node.kind === kind)
}

function NodeBox({ node }: { node: GraphNode }): ReactNode {
  const attention = node.attention === true
  return (
    <div
      className={`nx-node flex w-full flex-col gap-0.5 px-2.5 py-1.5 ${attention ? 'border-[var(--dsw-alias-state-warn-primary)]' : ''}`}
      title={node.detail ?? node.label}
    >
      <div className="flex items-center gap-1.5">
        <span className="shrink-0 rounded bg-[var(--dsw-alias-bg-layer-3)] px-1 text-[10px] text-[var(--dsw-alias-label-primary)]-3">{KIND_LABELS[node.kind]}</span>
        <span className="truncate text-[12px] text-[var(--dsw-alias-label-primary)]">{node.label}</span>
      </div>
      {node.detail && <span className="truncate text-[11px] text-[var(--dsw-alias-label-caption)]">{node.detail}</span>}
    </div>
  )
}

export function HierarchyGraph({ nodes, edges }: { nodes: GraphNode[], edges: GraphEdge[] }): ReactNode {
  const channels = column(nodes, 'channel')
  const mains = column(nodes, 'main')
  const projects = column(nodes, 'project')
  const supervisors = column(nodes, 'supervisor')
  const tickets = column(nodes, 'ticket')

  // 主编排是这张图的轴：所有渠道都指向它，所有项目都从它指出去
  const mainNode = mains[0]

  return (
    <div className="flex items-stretch gap-3 p-4">
      <Column title={KIND_LABELS.channel} count={channels.length}>
        {channels.map(node => <NodeBox key={node.id} node={node} />)}
      </Column>

      <Arrow count={edges.filter(edge => edge.kind === 'trigger').length} label="trigger" />

      <div className="flex flex-col justify-center">
        {mainNode && <NodeBox node={mainNode} />}
      </div>

      <Arrow count={edges.filter(edge => edge.kind === 'dispatch').length} label="dispatch" />

      <Column title={KIND_LABELS.project} count={projects.length + supervisors.length}>
        {projects.map(node => <NodeBox key={node.id} node={node} />)}
        {supervisors.map(node => <NodeBox key={node.id} node={node} />)}
      </Column>

      <Arrow count={edges.filter(edge => edge.kind === 'delegate').length} label="delegate" />

      <Column title={KIND_LABELS.ticket} count={tickets.length}>
        {tickets.map(node => <NodeBox key={node.id} node={node} />)}
      </Column>
    </div>
  )
}

function Column({ title, count, children }: { title: string, count: number, children: React.ReactNode }): ReactNode {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[11px] font-medium text-[var(--dsw-alias-label-primary)]-2">{title}</span>
        <span className="text-[10px] text-[var(--dsw-alias-label-caption)]">{count}</span>
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  )
}

function Arrow({ count, label }: { count: number, label: string }): ReactNode {
  return (
    <div className="flex w-14 shrink-0 flex-col items-center justify-center gap-0.5 self-center">
      <span className="text-[10px] text-[var(--dsw-alias-label-caption)]">{label}</span>
      <div className="flex items-center gap-0.5 text-[var(--dsw-alias-border-l3)]">
        <span className="h-px w-6 bg-[var(--dsw-alias-border-l3)]" />
        <span className="text-[12px] leading-none">›</span>
      </div>
      {count > 1 && (
        <span className="text-[10px] text-[var(--dsw-alias-label-caption)]">
          ×
          {count}
        </span>
      )}
    </div>
  )
}
