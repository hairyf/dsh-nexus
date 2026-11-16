import type { ReactNode } from 'react'
import type { AgentGraphNode } from '../../../types'
import { AgentIcon, ChannelsIcon, NexusIcon, TasksIcon } from '../../../components/icons'

export function GraphNodeCard({ node, selected, onSelect }: {
  node: AgentGraphNode
  selected: boolean
  onSelect: () => void
}): ReactNode {
  const Icon = node.kind === 'channel' ? ChannelsIcon : node.kind === 'task' ? TasksIcon : node.kind === 'session' ? AgentIcon : NexusIcon

  return (
    <button type="button" aria-pressed={selected} aria-label={`${node.label} ${node.status}`} onClick={onSelect} className="flex h-full w-full items-center gap-3 rounded-xl border bg-[var(--dsw-alias-bg-layer-1)] px-3 text-left font-[inherit] outline-none focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--dsw-alias-state-business-primary)]" style={{ borderColor: selected ? 'var(--dsw-alias-state-business-primary)' : 'var(--dsw-alias-border-l2)' }}>
      <Icon width={18} height={18} className="shrink-0 text-[var(--dsw-alias-label-secondary)]" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">{node.label}</span>
        <span className="block truncate text-[11px] text-[var(--dsw-alias-label-tertiary)]">
          {node.status}
          {' '}
          ·
          {' '}
          {node.subtitle}
        </span>
      </span>
    </button>
  )
}
