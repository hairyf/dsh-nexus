import type { ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { usePanel } from '../../hooks/use-panel'
import { useActions } from '../../hooks/use-store'
import { Filters, TicketRows } from '../ticket/page'
import { Graph } from './components/graph'

export function Overview(): ReactNode {
  const { data } = usePanel()

  const { go } = useActions()

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[['项目', data.projects.length], ['工单', data.tickets.length], ['需要本人答复', data.inbox.pending.length]].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-[var(--dsw-alias-border-l3)] bg-[var(--dsw-alias-bg-layer-1)] p-4">
            <p className="m-0 text-xs text-[var(--dsw-alias-label-secondary)]">{label}</p>
            <p className="mb-0 mt-2 text-2xl tabular-nums">{value}</p>
          </div>
        ))}
      </div>
      <Button size="sm" variant="outline" onClick={() => go('inbox')}>处理信箱</Button>
      <Filters />
      <Graph />
      <TicketRows />
    </div>
  )
}
