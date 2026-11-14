import type { ReactElement } from 'react'
import type { AgentGraphNode } from '../src/client/types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GraphEdgePath } from '../src/client/pages/overview/components/graph-edge-path'

vi.mock('../src/client/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

afterEach(() => vi.restoreAllMocks())

type EdgeElement = ReactElement<{ stroke: string, children: [ReactElement<{ d: string, strokeDasharray?: string }>, ReactElement<{ d: string }>] }>

const nodes: AgentGraphNode[] = [
  { id: 'route', kind: 'route', label: 'graphRoute', x: 300, y: 160 },
  { id: 'task', kind: 'task', label: 'graphTask', x: 620, y: 36 },
  { id: 'dependent', kind: 'task', label: 'graphTask', x: 620, y: 160 },
]

describe('agent graph edge geometry', () => {
  it('ends a curved dispatch with a horizontal segment sharing the arrow tip and stroke', () => {
    const element = GraphEdgePath({ edge: { source: 'route', target: 'task', kind: 'flow' }, nodes, selectedId: null }) as EdgeElement
    const [line, arrow] = element.props.children
    expect(line.props.d).toBe('M 474 194 C 544 194, 544 70, 598 70 H 614')
    expect(arrow.props.d).toBe('M 607 66 L 614 70 L 607 74')
    expect(element.props.stroke).toBe('var(--dsw-alias-state-warn-primary)')
  })

  it('draws a dependency directly between task boundaries with a downward arrow on the same centerline', () => {
    const element = GraphEdgePath({ edge: { source: 'task', target: 'dependent', kind: 'dependency' }, nodes, selectedId: null }) as EdgeElement
    const [line, arrow] = element.props.children
    expect(line.props.d).toBe('M 704 110 L 704 154')
    expect(arrow.props.d).toBe('M 700 147 L 704 154 L 708 147')
    expect(line.props.strokeDasharray).toBeUndefined()
    expect(element.props.stroke).toBe('#a56bce')
  })

  it('draws an association as a dashed connection without arrowheads', () => {
    const element = GraphEdgePath({ edge: { source: 'task', target: 'dependent', kind: 'association' }, nodes, selectedId: null }) as EdgeElement
    const [line, arrow] = element.props.children
    expect(line.props.d).toBe('M 704 110 L 704 154')
    expect(line.props.strokeDasharray).toBe('5 4')
    expect(line.props).not.toHaveProperty('markerStart')
    expect(line.props).not.toHaveProperty('markerEnd')
    expect(arrow).toBe(false)
  })

  it('omits an edge when either endpoint is absent', () => {
    expect(GraphEdgePath({ edge: { source: 'route', target: 'missing', kind: 'flow' }, nodes, selectedId: null })).toBeNull()
    expect(GraphEdgePath({ edge: { source: 'missing', target: 'task', kind: 'flow' }, nodes, selectedId: null })).toBeNull()
  })
})
