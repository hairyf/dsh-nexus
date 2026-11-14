import type { ReactNode } from 'react'
import type { OverviewTask } from '../../../../types'
import { Button, StateDot, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { OVERVIEW_STATUS } from '../../../../constants'
import { useActions } from '../../../../hooks/use-store'
import { useTranslation } from '../../../../hooks/use-translation'

export function Relations({ tasks, empty, clear }: { tasks: readonly OverviewTask[], empty: string, clear?: boolean }): ReactNode {
  const { t } = useTranslation()
  const { openTicket } = useActions()
  return tasks.length
    ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {tasks.map((task) => {
            const status = OVERVIEW_STATUS[task.status]
            return (
              <li key={task.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Button variant="ghost" size="sm" className="max-w-full !h-auto !justify-start !whitespace-normal text-left" onClick={() => openTicket(task.id)}>
                  <span className="text-xs text-[var(--dsw-alias-label-secondary)]">{task.id}</span>
                  <span className="[overflow-wrap:anywhere]">{t(task.title)}</span>
                </Button>
                <Tag tone={status.tone}>{t(status.label)}</Tag>
              </li>
            )
          })}
        </ul>
      )
    : (
        <p className="m-0 flex items-center gap-2 text-[13px] leading-5 text-[var(--dsw-alias-label-secondary)]">
          <StateDot state={clear ? 'done' : 'idle'} size={7} />
          {empty}
        </p>
      )
}
