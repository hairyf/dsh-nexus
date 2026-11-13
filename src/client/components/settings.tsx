/**
 * 设置页。
 *
 * 用官方的设置行结构（`SettingsRow` / `SettingsGroup`，从 dsh-components 复刻），
 * 而不是自己拼 flex：0.5px 分隔线、16px 行内边距、14/12 两级字号都是官方量出来的
 * 值，差一点整块就不像。
 *
 * 全部是**全局**配置（`Setting` 单行）。项目级的运行状态不在这里 ——
 * 暂停在任务详情，并发上限在这里。
 */

import type { ReactNode } from 'react'
import type { SettingKey } from '../../types'
import type { GetApiNexusSettingsResponse } from '../apis/index.type'
import { SETTING_GROUPS, SETTING_META } from '../constants'
import { Button, Input, Switch } from './official'
import { SettingsGroup, SettingsRow } from './ui/settings-row'

type SettingView = GetApiNexusSettingsResponse

const BOOLEAN_KEYS = new Set<SettingKey>(['autoMerge'])

export function SettingsPage({ data, draft, onDraft, onReset, onSave, busy, error }: {
  data: SettingView | undefined
  draft: Partial<Record<SettingKey, number | boolean>>
  onDraft: (key: SettingKey, value: number | boolean) => void
  onReset: () => void
  onSave: () => void
  busy: boolean
  error: string | undefined
}): ReactNode {
  if (!data)
    return <p className="px-4 py-8 text-center text-[12px] text-nx-text-3">正在读取…</p>

  const value = (key: SettingKey): number | boolean => draft[key] ?? data.values[key]
  const dirty = Object.keys(draft).length > 0

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-4 pt-4">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 pb-2">
          <span className="text-[12px] text-nx-text-3">
            {error
              ? <span className="text-nx-danger">{error}</span>
              : data.updatedAt
                ? `上次保存 ${new Date(data.updatedAt).toLocaleString('zh-CN')}`
                : '还未保存过'}
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" disabled={!dirty || busy} onClick={onReset}>重置</Button>
            <Button size="sm" variant="primary" disabled={!dirty || busy} onClick={onSave}>
              {busy ? '保存中…' : '保存'}
            </Button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 pb-6 nx-scroll">
        <div className="mx-auto w-full max-w-3xl">
          {SETTING_GROUPS.map(group => (
            <SettingsGroup key={group.key} title={group.label}>
              {group.fields.map((key) => {
                const meta = SETTING_META[key]
                const current = value(key)

                // 开关用官方 Switch：它的尺寸与宿主其它开关一致
                if (BOOLEAN_KEYS.has(key)) {
                  return (
                    <SettingsRow key={key} title={meta.label} description={meta.hint}>
                      <Switch
                        checked={current === true}
                        onChange={(next: boolean) => onDraft(key, next)}
                        label={meta.label}
                      />
                    </SettingsRow>
                  )
                }

                // 数值用官方 Input
                return (
                  <SettingsRow key={key} title={meta.label} description={meta.hint}>
                    <div className="w-24">
                      <Input
                        type="number"
                        min={meta.min}
                        max={meta.max}
                        value={String(current)}
                        onChange={event => onDraft(key, Number(event.target.value))}
                        className="text-right"
                      />
                    </div>
                  </SettingsRow>
                )
              })}
            </SettingsGroup>
          ))}
        </div>
      </div>
    </div>
  )
}
