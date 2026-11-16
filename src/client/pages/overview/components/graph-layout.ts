export const AGENT_GRAPH = { nodeWidth: 168, nodeHeight: 68, width: 1100, height: 400, zoomMin: 0.5, zoomMax: 2 } as const
export const AGENT_GRAPH_EDGE_COLORS = {
  flow: 'var(--dsw-alias-label-tertiary)',
  dispatch: 'var(--dsw-alias-state-warn-primary)',
  association: 'var(--dsw-alias-state-business-primary)',
  dependency: 'var(--dsw-alias-state-warn-primary)',
} as const
