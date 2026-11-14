import type { ReactNode } from 'react'
import type { AgentGraphNode } from '../../../types'
import { Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { AgentIcon, ChannelsIcon, NexusIcon, TasksIcon } from '../../../components/icons'
import { OVERVIEW_STATUS, OVERVIEW_TASKS } from '../../../constants'
import { useTranslation } from '../../../hooks/use-translation'

export function GraphNodeCard({ node, selected, onSelect }: { node: AgentGraphNode, selected: boolean, onSelect: () => void }): ReactNode {
  const { t } = useTranslation()
  const Icon = node.kind === 'channel' ? ChannelsIcon : node.kind === 'task' ? TasksIcon : node.kind === 'session' ? AgentIcon : NexusIcon
  const task = node.kind === 'task' ? OVERVIEW_TASKS.find(task => task.id === node.taskId) : undefined
  const status = task ? OVERVIEW_STATUS[task.status] : undefined
  return (
    <button type="button" aria-pressed={selected} aria-label={`${t(node.label)}${node.subtitle ? ` ${node.subtitle}` : ''}${node.waiting ? ` ${t('graphWaiting')}` : ''}${status ? ` ${t(status.label)}` : ''}`} onClick={onSelect} className={`flex h-full w-full items-center gap-3 rounded-xl border bg-[var(--dsw-alias-bg-layer-1)] px-3 text-left font-[inherit] shadow-sm outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--dsw-alias-state-business-primary)] ${node.waiting ? 'border-dashed' : ''} ${selected ? 'border-[var(--dsw-alias-state-business-primary)]' : 'border-[var(--dsw-alias-border-l2)] hover:border-[var(--dsw-alias-border-l1)]'}`}>
      <Icon width={18} height={18} className="shrink-0 text-[var(--dsw-alias-label-secondary)]" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[13px] leading-5 font-medium text-[var(--dsw-alias-label-primary)]">
          <span className="truncate">{t(node.label)}</span>
          {status && <Tag tone={status.tone} className="shrink-0 px-1.5! py-0! text-[10px]! leading-4! font-normal!">{t(status.label)}</Tag>}
        </span>
        {(node.subtitle || node.waiting) && <span className="block truncate text-[11px] leading-5 text-[var(--dsw-alias-label-tertiary)]">{node.waiting ? t('graphWaiting') : node.subtitle}</span>}
      </span>
    </button>
  )
}
