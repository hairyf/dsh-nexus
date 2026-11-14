import type { ReactNode } from 'react'
import type { AgentGraphEdge, AgentGraphNode } from '../../../types'
import { AGENT_GRAPH, AGENT_GRAPH_EDGE_COLORS } from '../../../constants'
import { useTranslation } from '../../../hooks/use-translation'

export function GraphEdgePath({ edge, nodes, selectedId }: { edge: AgentGraphEdge, nodes: readonly AgentGraphNode[], selectedId: string | null }): ReactNode {
  const { t } = useTranslation()
  const source = nodes.find(node => node.id === edge.source)
  const target = nodes.find(node => node.id === edge.target)
  if (!source || !target)
    return null
  const vertical = source.x === target.x
  const gap = 6
  const sx = source.x + (vertical ? AGENT_GRAPH.nodeWidth / 2 : AGENT_GRAPH.nodeWidth + gap)
  const sy = source.y + (vertical ? AGENT_GRAPH.nodeHeight + gap : AGENT_GRAPH.nodeHeight / 2)
  const tx = target.x + (vertical ? AGENT_GRAPH.nodeWidth / 2 : -gap)
  const ty = target.y + (vertical ? -gap : AGENT_GRAPH.nodeHeight / 2)
  const middle = (sx + tx) / 2
  const related = !selectedId || edge.source === selectedId || edge.target === selectedId
  const tone = edge.kind === 'flow' && source.kind === 'route' ? 'dispatch' : edge.kind
  const color = AGENT_GRAPH_EDGE_COLORS[tone]
  const label = edge.kind === 'association' ? t('graphAssociation') : edge.kind === 'dependency' ? t('graphDependency') : null
  const path = vertical
    ? `M ${sx} ${sy} L ${tx} ${ty}`
    : `M ${sx} ${sy} C ${middle} ${sy}, ${middle} ${ty}, ${tx - 16} ${ty} H ${tx}`
  const arrow = vertical
    ? `M ${tx - 4} ${ty - 7} L ${tx} ${ty} L ${tx + 4} ${ty - 7}`
    : `M ${tx - 7} ${ty - 4} L ${tx} ${ty} L ${tx - 7} ${ty + 4}`
  return (
    <g opacity={related ? 1 : 0.25} pointerEvents="none" fill="none" stroke={color} strokeWidth={related && selectedId ? 1.8 : 1.4} strokeLinecap="round" strokeLinejoin="round">
      <path d={path} strokeDasharray={edge.kind === 'association' ? '5 4' : undefined} />
      {edge.kind !== 'association' && <path d={arrow} />}
      {label && <text x={edge.kind === 'dependency' ? sx - 10 : sx + 10} y={(sy + ty) / 2 + 4} fill={color} fontSize={12} textAnchor={edge.kind === 'dependency' ? 'end' : 'start'} paintOrder="stroke" stroke="var(--dsw-alias-bg-layer-1)" strokeWidth={6} strokeLinejoin="round">{label}</text>}
    </g>
  )
}
