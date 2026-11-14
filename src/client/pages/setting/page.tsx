import type { ReactNode } from 'react'
import { Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { useId } from 'react'
import { ActivityIcon, GitBranchIcon, TasksIcon } from '../../components/icons'
import { useActions, useStore } from '../../hooks/use-store'
import { useTranslation } from '../../hooks/use-translation'
import { Projects } from './components/projects'
import { Runtime } from './components/runtime'
import { GROUPS } from './model'

export function Setting(): ReactNode {
  const { t } = useTranslation()
  const state = useStore(state => state.setting)
  const actions = useActions()
  const id = useId()
  const notices = { saved: 'settingSaved', refreshed: 'settingRefreshed', project: 'settingProjectSaved' } as const
  const sections = [
    { value: 'projects', label: 'settingProjects', icon: GitBranchIcon },
    { value: 'execution', label: 'settingExecution', icon: TasksIcon },
    { value: 'delivery', label: 'settingDelivery', icon: ActivityIcon },
  ] as const
  const dirty = Object.keys(state.draft).some(key => state.draft[key as keyof typeof state.draft] !== state.saved[key as keyof typeof state.saved])
  return (
    <section className="@container flex min-w-0 flex-col gap-4 pb-8" aria-label={t('tabSettings')}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-base font-medium">{t('tabSettings')}</h2>
          <p className="m-0 mt-1.5 text-[13px] leading-5 text-[var(--dsw-alias-label-secondary)]">{t('settingDescription')}</p>
        </div>
        <Tag tone="quiet">{t('overviewDemo')}</Tag>
      </header>
      <div className="grid min-w-0 gap-4 @min-[740px]:grid-cols-[160px_minmax(0,1fr)] @min-[940px]:gap-5">
        <aside className="self-start @min-[740px]:sticky @min-[740px]:top-4">
          <nav aria-label={t('settingNavigation')} className="flex flex-wrap gap-1 rounded-xl bg-[var(--dsw-alias-card-fill)] p-1 @min-[740px]:flex-col @min-[740px]:bg-transparent @min-[740px]:p-0">
            {sections.map(section => (
              <button key={section.value} id={`${id}-${section.value}`} type="button" aria-current={state.section === section.value ? 'page' : undefined} aria-controls={`${id}-content`} onClick={() => actions.setSettingSection(section.value)} className={`flex cursor-pointer items-center gap-2.5 rounded-lg border-0 px-3 py-2.5 text-left font-[inherit] text-xs outline-none transition-colors focus-visible:outline-2 focus-visible:outline-[var(--dsw-alias-state-business-primary)] ${state.section === section.value ? 'bg-[var(--dsw-alias-card-fill)] font-medium text-[var(--dsw-alias-label-primary)]' : 'bg-transparent text-[var(--dsw-alias-label-secondary)] hover:bg-[var(--dsw-alias-card-fill)]'}`}>
                <section.icon width={16} height={16} />
                <span>{t(section.label)}</span>
                {section.value !== 'projects' && GROUPS[section.value].some(key => state.draft[key] !== state.saved[key]) && <span className="ml-auto size-1.5 rounded-full bg-[var(--dsw-alias-state-business-primary)]" aria-label={t('settingUnsaved')} />}
              </button>
            ))}
          </nav>
        </aside>
        <div id={`${id}-content`} role="region" aria-labelledby={`${id}-${state.section}`} className="flex min-w-0 flex-col gap-4">
          {state.section === 'projects'
            ? <Projects projects={state.projects} refreshedAt={state.refreshedAt} onRefresh={() => actions.refreshSettingProjects(new Date().toISOString())} onToggle={actions.toggleSettingProject} />
            : <Runtime section={state.section} draft={state.draft} saved={state.saved} onEdit={actions.editSettings} onSave={() => actions.saveSettings(state.section as 'execution' | 'delivery')} onReset={() => actions.resetSettings(state.section as 'execution' | 'delivery')} />}
          {state.invalid ? <p role="alert" className="m-0 text-xs text-[var(--dsw-alias-state-error-primary)]">{t('settingInvalid')}</p> : state.notice && <p role="status" className="m-0 text-xs leading-5 text-[var(--dsw-alias-label-secondary)]">{t(notices[state.notice])}</p>}
          <p className="m-0 text-[11px] leading-5 text-[var(--dsw-alias-label-tertiary)]">
            {t('settingPreview')}
            {dirty && <span className="ml-1">{t('settingUnsaved')}</span>}
          </p>
        </div>
      </div>
    </section>
  )
}
