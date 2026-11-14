import type { ReactNode } from 'react'
import type { AgentGraphEdge, AgentGraphNode } from '../../../types'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { useRef } from 'react'
import { AgentIcon, FitViewIcon, ZoomInIcon, ZoomOutIcon } from '../../../components/icons'
import { AGENT_GRAPH, AGENT_GRAPH_EDGE_COLORS } from '../../../constants'
import { useActions, useStore } from '../../../hooks/use-store'
import { useTranslation } from '../../../hooks/use-translation'
import { GraphEdgePath } from './graph-edge-path'
import { GraphNodeCard } from './graph-node-card'

export function GraphCanvas({ nodes, edges }: { nodes: readonly AgentGraphNode[], edges: readonly AgentGraphEdge[] }): ReactNode {
  const { t } = useTranslation()
  const { zoomGraph, panGraph, resetGraph, selectAgent, openTicket } = useActions()
  const { zoom, x, y, selectedId } = useStore(state => state.graph)
  const drag = useRef<{ id: number, x: number, y: number } | null>(null)
  const width = AGENT_GRAPH.width / zoom
  const height = AGENT_GRAPH.height / zoom
  const left = (AGENT_GRAPH.width - width) / 2 + x
  const top = (AGENT_GRAPH.height - height) / 2 + y
  const selected = nodes.find(node => node.id === selectedId)
  const supervised = nodes.filter(node => node.group === 'supervisor')
  const group = supervised.length
    ? {
        x: Math.min(...supervised.map(node => node.x)) - 16,
        y: Math.min(...supervised.map(node => node.y)) - 12,
        width: Math.max(...supervised.map(node => node.x)) - Math.min(...supervised.map(node => node.x)) + AGENT_GRAPH.nodeWidth + 32,
        height: Math.max(...supervised.map(node => node.y)) - Math.min(...supervised.map(node => node.y)) + AGENT_GRAPH.nodeHeight + 28,
      }
    : null
  return (
    <div>
      <div className="relative">
        <div className="overflow-x-auto">
          <svg
            viewBox={`${left} ${top} ${width} ${height}`}
            className="block h-[380px] w-full min-w-[1040px] touch-none select-none bg-[var(--dsw-alias-bg-layer-2)]/40 outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--dsw-alias-state-business-primary)]"
            aria-label={t('graphTitle')}
            role="group"
            tabIndex={0}
            onPointerDown={(event) => {
              if (event.button !== 0 || (event.target as Element).closest('button'))
                return
              drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
              event.currentTarget.setPointerCapture(event.pointerId)
            }}
            onPointerMove={(event) => {
              const previous = drag.current
              if (!previous || previous.id !== event.pointerId)
                return
              const bounds = event.currentTarget.getBoundingClientRect()
              const scale = Math.min(bounds.width / width, bounds.height / height)
              if (scale > 0)
                panGraph((previous.x - event.clientX) / scale, (previous.y - event.clientY) / scale)
              drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
            }}
            onPointerUp={(event) => {
              drag.current = null
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                event.currentTarget.releasePointerCapture(event.pointerId)
            }}
            onPointerCancel={() => { drag.current = null }}
            onLostPointerCapture={() => { drag.current = null }}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget)
                return
              const delta = 40 / zoom
              if (event.key === 'ArrowLeft')
                panGraph(-delta, 0)
              else if (event.key === 'ArrowRight')
                panGraph(delta, 0)
              else if (event.key === 'ArrowUp')
                panGraph(0, -delta)
              else if (event.key === 'ArrowDown')
                panGraph(0, delta)
              else if (event.key === '+' || event.key === '=')
                zoomGraph(0.2)
              else if (event.key === '-')
                zoomGraph(-0.2)
              else if (event.key === 'Home')
                resetGraph()
              else return
              event.preventDefault()
            }}
          >
            {group && (
              <g pointerEvents="none">
                <rect x={group.x} y={group.y} width={group.width} height={group.height} rx={18} fill="var(--dsw-alias-state-business-primary)" fillOpacity={0.025} stroke="var(--dsw-alias-state-business-primary)" strokeOpacity={0.5} strokeDasharray="6 5" />
                <text x={group.x + 12} y={group.y - 10} fill="var(--dsw-alias-state-business-primary)" fontSize={13}>{t('graphSupervisor')}</text>
              </g>
            )}
            {edges.map(edge => <GraphEdgePath key={`${edge.source}-${edge.target}-${edge.kind}`} edge={edge} nodes={nodes} selectedId={selectedId} />)}
            {nodes.map(node => <foreignObject key={node.id} x={node.x} y={node.y} width={AGENT_GRAPH.nodeWidth} height={AGENT_GRAPH.nodeHeight}><GraphNodeCard node={node} selected={selectedId === node.id} onSelect={() => selectAgent(node.id)} /></foreignObject>)}
          </svg>
        </div>
        <div className="absolute right-3 bottom-3 flex items-center gap-1 rounded-xl border border-[var(--dsw-alias-border-l3)] bg-[var(--dsw-alias-bg-layer-1)] p-1 shadow-sm">
          <Button size="sm" variant="ghost" aria-label={t('graphZoomOut')} disabled={zoom <= AGENT_GRAPH.zoomMin} onClick={() => zoomGraph(-0.2)} icon={<ZoomOutIcon width={16} height={16} />} />
          <span className="min-w-10 text-center text-xs tabular-nums text-[var(--dsw-alias-label-secondary)]">{`${Math.round(zoom * 100)}%`}</span>
          <Button size="sm" variant="ghost" aria-label={t('graphZoomIn')} disabled={zoom >= AGENT_GRAPH.zoomMax} onClick={() => zoomGraph(0.2)} icon={<ZoomInIcon width={16} height={16} />} />
          <Button size="sm" variant="ghost" aria-label={t('graphFit')} onClick={resetGraph} icon={<FitViewIcon width={16} height={16} />} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[var(--dsw-alias-border-l3)] px-5 py-3 text-[11px] text-[var(--dsw-alias-label-tertiary)]">
        <span>{t('graphHint')}</span>
        <span className="ml-auto flex gap-3">
          {(['flow', 'association', 'dependency'] as const).map(kind => (
            <span key={kind} className="flex items-center gap-1.5">
              <span className="h-px w-4" style={{ background: AGENT_GRAPH_EDGE_COLORS[kind] }} />
              {t(kind === 'flow' ? 'graphFlow' : kind === 'association' ? 'graphAssociation' : 'graphDependency')}
            </span>
          ))}
        </span>
      </div>
      {selected && (
        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--dsw-alias-border-l3)] px-5 py-3 text-xs">
          <AgentIcon width={16} height={16} />
          <span>
            {t(selected.label)}
            {selected.subtitle ? ` · ${selected.subtitle}` : ''}
          </span>
          <span className="text-[var(--dsw-alias-label-tertiary)]">{t(selected.waiting ? 'graphWaiting' : 'overviewDemo')}</span>
          {selected.taskId && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (selected.taskId)
                  openTicket(selected.taskId)
              }}
              className="ml-auto"
            >
              {t('overviewOpenDetails')}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
