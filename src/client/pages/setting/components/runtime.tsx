import type { ReactNode } from 'react'
import type { DshNexusKey } from '../../../locale'
import { Button, Input, Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import { useId } from 'react'
import { useActions, useStore } from '../../../hooks/use-store'
import { useTranslation } from '../../../hooks/use-translation'
import { GROUPS, LIMITS, validSettings } from '../model'

export function Runtime(): ReactNode {
  const { t } = useTranslation()
  const section = useStore(state => state.setting.section)
  const draft = useStore(state => state.setting.draft)
  const saved = useStore(state => state.setting.saved)
  const { editSettings, saveSettings, resetSettings } = useActions()
  const prefix = useId()
  if (section === 'projects')
    return null
  const dirty = GROUPS[section].some(key => draft[key] !== saved[key])
  const candidate = { ...saved, ...Object.fromEntries(GROUPS[section].map(key => [key, draft[key]])) }
  const valid = validSettings(candidate)
  const fields: { key: keyof typeof LIMITS, label: DshNexusKey, help: DshNexusKey, unit: DshNexusKey }[] = [
    { key: 'maxWorkers', label: 'settingMaxWorkers', help: 'settingMaxWorkersHelp', unit: 'settingWorkersUnit' },
    { key: 'backgroundLimitMinutes', label: 'settingBackgroundLimit', help: 'settingBackgroundLimitHelp', unit: 'settingMinutesUnit' },
    { key: 'autoMergeMaxLines', label: 'settingAutoMergeLines', help: 'settingAutoMergeLinesHelp', unit: 'settingLinesUnit' },
    { key: 'deliveryMaxAttempts', label: 'settingDeliveryAttempts', help: 'settingDeliveryAttemptsHelp', unit: 'settingAttemptsUnit' },
    { key: 'deliveryRetryCeilingSeconds', label: 'settingRetryCeiling', help: 'settingRetryCeilingHelp', unit: 'settingSecondsUnit' },
  ]
  return (
    <form
      className="overflow-hidden rounded-2xl border border-[var(--dsw-alias-border-l3)] bg-[var(--dsw-alias-bg-layer-1)]"
      onSubmit={(event) => {
        event.preventDefault()
        if (valid && dirty)
          saveSettings(section)
      }}
      aria-labelledby={`${prefix}-runtime`}
    >
      <header className="px-4 py-3">
        <h3 id={`${prefix}-runtime`} className="m-0 text-sm font-medium">{t(section === 'execution' ? 'settingExecution' : 'settingDelivery')}</h3>
        <p className="m-0 mt-1.5 text-xs leading-5 text-[var(--dsw-alias-label-secondary)]">{t(section === 'execution' ? 'settingExecutionDescription' : 'settingDeliveryDescription')}</p>
      </header>
      {fields.filter(field => (GROUPS[section] as readonly string[]).includes(field.key)).map((field) => {
        const limits = LIMITS[field.key]
        const value = draft[field.key]
        const disabled = field.key === 'autoMergeMaxLines' && !draft.autoMerge
        const invalid = !Number.isInteger(value) || value < limits.min || value > limits.max
        const id = `${prefix}-${field.key}`
        return (
          <div key={field.key} className="flex flex-wrap items-start justify-between gap-x-5 gap-y-3 border-t border-[var(--dsw-alias-border-l3)] px-4 py-3">
            <div className="min-w-0 flex-1 basis-52">
              <label htmlFor={id} className="text-xs font-medium">{t(field.label)}</label>
              <p id={`${id}-help`} className="m-0 mt-1.5 max-w-lg text-xs leading-5 text-[var(--dsw-alias-label-secondary)]">{t(field.help)}</p>
            </div>
            <div className="w-36 shrink-0">
              <div className="flex items-center gap-2">
                <Input id={id} type="number" min={limits.min} max={limits.max} step={1} required value={Number.isFinite(value) ? value : ''} aria-describedby={`${id}-help ${id}-range`} aria-invalid={invalid && !disabled} disabled={disabled} onChange={event => editSettings({ [field.key]: event.currentTarget.value === '' ? Number.NaN : Number(event.currentTarget.value) })} className="w-24 !text-xs" />
                <span className="text-xs text-[var(--dsw-alias-label-tertiary)]">{t(field.unit)}</span>
              </div>
              <span id={`${id}-range`} className={`mt-1.5 block text-[11px] ${invalid && !disabled ? 'text-[var(--dsw-alias-state-error-primary)]' : 'text-[var(--dsw-alias-label-tertiary)]'}`}>{t('settingRange', { min: limits.min, max: limits.max })}</span>
            </div>
          </div>
        )
      })}
      {section === 'execution' && (
        <div className="flex items-start justify-between gap-5 border-t border-[var(--dsw-alias-border-l3)] px-4 py-3">
          <div className="min-w-0">
            <h4 className="m-0 text-xs font-medium">{t('settingAutoMerge')}</h4>
            <p className="m-0 mt-1.5 max-w-lg text-xs leading-5 text-[var(--dsw-alias-label-secondary)]">{t('settingAutoMergeHelp')}</p>
          </div>
          <Switch checked={draft.autoMerge} label={t('settingAutoMerge')} onChange={autoMerge => editSettings({ autoMerge })} />
        </div>
      )}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--dsw-alias-border-l3)] bg-[var(--dsw-alias-card-fill)] px-4 py-2.5">
        <div className="min-w-0 flex-1 basis-60">
          <p className="m-0 text-[11px] leading-5 text-[var(--dsw-alias-label-tertiary)]">{t('settingPersistenceOnly')}</p>
          {dirty && !valid && <p role="status" className="m-0 mt-1 text-[11px] leading-5 text-[var(--dsw-alias-state-error-primary)]">{t('settingInvalid')}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="ghost" disabled={!dirty} onClick={() => resetSettings(section)}>{t('settingDiscard')}</Button>
          <Button type="submit" size="sm" variant="primary" disabled={!dirty || !valid}>{t('settingSave')}</Button>
        </div>
      </footer>
    </form>
  )
}
