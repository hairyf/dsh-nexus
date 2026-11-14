import type { ReactNode } from 'react'
import type { Project } from '../model'
import { Button, Input, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { useId, useState } from 'react'
import { useTranslation } from '../../../hooks/use-translation'
import { eligibleProjects } from '../model'

export function Projects({ projects, refreshedAt, onRefresh, onToggle }: {
  projects: readonly Project[]
  refreshedAt: string | null
  onRefresh: () => void
  onToggle: (id: string, enabled: boolean) => void
}): ReactNode {
  const { t } = useTranslation()
  const id = useId()
  const [query, setQuery] = useState('')
  const normalized = query.trim().toLocaleLowerCase()
  const candidates = eligibleProjects(projects)
  const visible = candidates.filter(project => !normalized || [project.name, project.directory].join(' ').toLocaleLowerCase().includes(normalized))
  const enabled = candidates.filter(project => project.enabled).length
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--dsw-alias-border-l3)] bg-[var(--dsw-alias-bg-layer-1)]" aria-labelledby={id}>
      <header className="flex flex-wrap items-start justify-between gap-3 p-5 pb-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id={id} className="m-0 text-sm font-medium">{t('settingProjects')}</h3>
            <Tag tone="quiet">{t('settingEnabledCount', { enabled, total: candidates.length })}</Tag>
          </div>
          <p className="m-0 mt-1.5 text-xs leading-5 text-[var(--dsw-alias-label-secondary)]">{t('settingProjectsDescription')}</p>
        </div>
        <Button size="sm" variant="outline" onClick={onRefresh}>{t('settingRefresh')}</Button>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-4">
        <Input type="search" aria-label={t('settingSearchProjects')} placeholder={t('settingSearchProjects')} value={query} onChange={event => setQuery(event.currentTarget.value)} className="min-w-40 flex-1 !text-xs @min-[620px]:max-w-xs" />
        {refreshedAt && (
          <time dateTime={refreshedAt} title={refreshedAt} className="text-[11px] text-[var(--dsw-alias-label-tertiary)]">
            {t('settingLastSynced')}
            {' '}
            {new Date(refreshedAt).toLocaleTimeString()}
          </time>
        )}
      </div>
      {visible.length
        ? (
            <ul className="m-0 list-none p-0">
              {visible.map((project) => {
                const pathId = `${id}-path-${project.id}`
                return (
                  <li key={project.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-[var(--dsw-alias-border-l3)] px-5 py-4">
                    <div className="flex min-w-0 flex-1 basis-48 items-start gap-2">
                      <label className="flex size-6 shrink-0 cursor-pointer items-center justify-center">
                        <input type="checkbox" checked={project.enabled} aria-label={t('settingSelectProject', { name: project.name })} aria-describedby={pathId} onChange={event => onToggle(project.id, event.currentTarget.checked)} className="size-3 cursor-pointer accent-[var(--dsw-alias-state-business-primary)]" />
                      </label>
                      <div className="min-w-0 pt-0.5">
                        <div className="truncate text-[13px] leading-5 font-medium text-[var(--dsw-alias-label-primary)]">{project.name}</div>
                        <p id={pathId} className="m-0 mt-1 truncate font-mono text-[11px] leading-5 text-[var(--dsw-alias-label-tertiary)]" title={project.directory}>{project.directory}</p>
                      </div>
                    </div>
                    <div className="ml-auto flex shrink-0 items-center gap-2">
                      <Button type="button" size="sm" variant="outline" disabled>{t('settingOpenSession')}</Button>
                      <Button type="button" size="sm" variant="outline" disabled>{t('settingOpenRepository')}</Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )
        : (
            <div className="flex flex-col items-center gap-2 border-t border-[var(--dsw-alias-border-l3)] px-4 py-7 text-center">
              <h4 className="m-0 text-xs font-medium">{t(normalized ? 'settingNoMatchingProjects' : 'settingNoProjects')}</h4>
              <p className="m-0 max-w-md text-xs leading-5 text-[var(--dsw-alias-label-secondary)]">{t(normalized ? 'settingNoMatchingProjectsHelp' : 'settingNoProjectsHelp')}</p>
              {normalized && <Button size="sm" variant="ghost" onClick={() => setQuery('')}>{t('settingClearSearch')}</Button>}
            </div>
          )}
    </section>
  )
}
