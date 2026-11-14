import type { ReactNode } from 'react'
import { Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { OVERVIEW_TASKS } from '../../constants'
import { useTranslation } from '../../hooks/use-translation'
import { Row } from './components/row'

export function Ticket(): ReactNode {
  const { t } = useTranslation()
  return (
    <section className="@container pb-10">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-[var(--dsw-alias-label-secondary)] my-1">{t('ticketListDescription')}</p>
        <Tag tone="quiet">{t('overviewDemo')}</Tag>
      </div>
      <ul className="m-0 pl-0">{OVERVIEW_TASKS.map(task => <Row key={task.id} task={task} />)}</ul>
    </section>
  )
}
