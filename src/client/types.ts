export interface AgentGraphNode {
  id: string
  kind: 'channel' | 'orchestrator' | 'route' | 'task' | 'session'
  label: string
  subtitle?: string
  status?: string
  x: number
  y: number
  waiting?: boolean
  group?: 'supervisor'
  taskId?: string
  sessionId?: string | null
}
export interface AgentGraphEdge {
  source: string
  target: string
  kind: 'flow' | 'association' | 'dependency'
}
