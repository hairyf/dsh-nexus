import type { ReactNode } from 'react'
import { AGENT_GRAPH_EDGES, AGENT_GRAPH_NODES } from '../../../constants'
import { useTranslation } from '../../../hooks/use-translation'
import { GraphCanvas } from './graph-canvas'

export function Graph(): ReactNode {
  const { t } = useTranslation()
  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-[var(--dsw-alias-border-l3)] bg-[var(--dsw-alias-bg-layer-1)]">
      <header className="border-b border-[var(--dsw-alias-border-l3)] px-5 py-2">
        <h2 className="text-[13px] font-medium mb-0 mt-1">{t('graphTitle')}</h2>
        <p className="mt-1 text-xs leading-5 text-[var(--dsw-alias-label-tertiary)] mb-0">{t('graphDescription')}</p>
      </header>
      <GraphCanvas nodes={AGENT_GRAPH_NODES} edges={AGENT_GRAPH_EDGES} />
    </section>
  )
}
