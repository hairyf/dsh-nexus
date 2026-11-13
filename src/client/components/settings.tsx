/**
 * 设置页。
 *
 * 全部是**全局**配置（`Setting` 单行）。项目级的运行状态不在这里 ——
 * 暂停在任务详情，并发上限在这里。
 *
 * 布局是两栏卡片：左边四组参数，右边一段「这些参数分别管什么」。
 * 一栏铺到底会让每个分组之间空出一大块，读起来像断了。
 */

import type { ReactNode } from 'react'
import type { SettingKey } from '../../types'
import type { GetApiNexusSettingsResponse } from '../apis/index.type'
import { SETTING_GROUPS, SETTING_META } from '../constants'
import { Button, Input, Switch } from './widgets'

type SettingView = GetApiNexusSettingsResponse

const BOOLEAN_KEYS = new Set<SettingKey>(['autoMerge', 'proxyDecide'])

/** 参数说明。放在右栏，不占参数区的地方。 */
const NOTES: Array<{ label: string, text: string }> = [
  {
    label: '并发',
    text: '超出后新任务留 queued。额外留 1 个槽位给「人的消息」和状态查询，所以人派活不会挤掉正在做的事。',
  },
  {
    label: '后台',
    text: '回合结束但还有后台任务在跑时，票继续占着槽位 —— 否则槽位被别的票占了，任务起了服务器却没人接。到点杀掉后台并报 waiting。',
  },
  {
    label: '自动合并',
    text: '默认关。开着也只对本票开的 PR 生效，且要满足「已批准、增删合计在上限内」。推新版本前先撤销自动合并。',
  },
  {
    label: '代理选择',
    text: '关着时 ask 停在原地，只有人能答；开着时超时后交给上一级判断要不要自己答，还是继续往上问。',
  },
  {
    label: '投递',
    text: '连续失败到上限后转 stalled。它不是「没轮到」，是「送不到」，所以不算未读，单独一栏显示。',
  },
]

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
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <span className="text-[11px] text-nx-caption">
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

      <div className="grid min-h-0 flex-1 gap-3 overflow-auto nx-scroll lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="flex min-w-0 flex-col gap-3">
          {SETTING_GROUPS.map(group => (
            <section key={group.key} className="nx-card">
              <header className="border-b border-nx-border-1 px-4 py-2">
                <h3 className="text-[12px] font-medium text-nx-text-2">{group.label}</h3>
              </header>
              <div className="divide-y divide-nx-border-1">
                {group.fields.map(key => (
                  <Row
                    key={key}
                    label={SETTING_META[key].label}
                    hint={SETTING_META[key].hint}
                    control={BOOLEAN_KEYS.has(key)
                      ? (
                          <Switch
                            checked={value(key) === true}
                            onChange={next => onDraft(key, next)}
                            label={SETTING_META[key].label}
                          />
                        )
                      : (
                          <div className="w-24">
                            <Input
                              type="number"
                              min={SETTING_META[key].min}
                              max={SETTING_META[key].max}
                              value={String(value(key))}
                              onChange={event => onDraft(key, Number(event.target.value))}
                              className="text-right"
                            />
                          </div>
                        )}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="nx-card h-fit shrink-0">
          <header className="border-b border-nx-border-1 px-4 py-2">
            <h3 className="text-[12px] font-medium text-nx-text-2">这些参数管什么</h3>
          </header>
          <dl className="flex flex-col gap-2.5 px-4 py-3">
            {NOTES.map(note => (
              <div key={note.label}>
                <dt className="text-[11px] font-medium text-nx-text">{note.label}</dt>
                <dd className="mt-0.5 text-[11px] leading-relaxed text-nx-caption">{note.text}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  )
}

/** 一行参数：左边标签与说明，右边控件。 */
function Row({ label, hint, control }: { label: string, hint: string, control: ReactNode }): ReactNode {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <div className="min-w-0">
        <div className="text-[12px] text-nx-text">{label}</div>
        <p className="mt-0.5 text-[11px] text-nx-caption">{hint}</p>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}
