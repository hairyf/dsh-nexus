import type { Kysely } from 'kysely'
import type { SettingKey, SettingView } from '../../types'
import type { DB } from '../types'
import { Model } from 'kysely-model'
import { SETTING_KEYS } from '../../constants'

/** 每个键的默认值，与 `prisma/schema/setting.prisma` 的 `@default` 一一对应。 */
const FALLBACK = {
  maxWorkers: 4,
  backgroundLimitMinutes: 30,
  autoMerge: false,
  autoMergeMaxLines: 200,
  proxyDecide: false,
  askDeadlineMinutes: 30,
  deliveryMaxAttempts: 3,
  deliveryRetryCeilingSeconds: 60,
} satisfies Record<SettingKey, number | boolean>

/** 哪个键是布尔，写库时靠它决定怎么转。 */
const BOOLEAN_KEYS = new Set<SettingKey>(['autoMerge', 'proxyDecide'])

/**
 * 全局配置。**只有一行**，`id = 'global'`。
 *
 * 库表从 Prisma 生成，布尔落成 `number`（0/1），所以读写都要在这一层转一次 ——
 * 上层拿到的永远是真正的 boolean，不用到处散 `=== 1`。
 */
export class Setting extends Model<DB, 'setting'> {
  constructor(db: Kysely<DB>) {
    super(db, 'setting', 'id')
  }

  /** 读配置；没有那一行时回落到代码里的默认值，面板永远有东西显示。 */
  async read(): Promise<SettingView> {
    const row = await this.db.selectFrom('setting').selectAll().where('id', '=', 'global').executeTakeFirst()
    const values = Object.fromEntries(SETTING_KEYS.map(key => [key, row ? toValue(key, row[key]) : FALLBACK[key]]))
    return { values: values as SettingView['values'], updatedAt: row?.updatedAt ?? '' }
  }

  /** 局部更新；只写传进来的键。返回最终生效的值。 */
  async save(patch: Partial<Record<SettingKey, unknown>>): Promise<SettingView> {
    const next: Record<string, number | string> = {}
    for (const key of SETTING_KEYS) {
      const value = patch[key]
      if (value === undefined)
        continue
      const known = BOOLEAN_KEYS.has(key)
      next[key] = known ? (value === true ? 1 : 0) : clamp(key, Number(value))
    }
    if (!Object.keys(next).length)
      return this.read()

    next.updatedAt = new Date().toISOString()
    const exists = await this.db.selectFrom('setting').select('id').where('id', '=', 'global').executeTakeFirst()
    if (exists)
      await this.db.updateTable('setting').set(next).where('id', '=', 'global').execute()
    else await this.db.insertInto('setting').values({ id: 'global', ...next } as never).execute()
    return this.read()
  }

  /** 并发上限。槽位判断要用它，单独取一次比整行快。 */
  async maxWorkers(): Promise<number> {
    const row = await this.db.selectFrom('setting').select('maxWorkers').where('id', '=', 'global').executeTakeFirst()
    return row?.maxWorkers ?? FALLBACK.maxWorkers
  }
}

/** 库里的 0/1 或数字 → 上层要的值。 */
function toValue(key: SettingKey, raw: unknown): number | boolean {
  if (BOOLEAN_KEYS.has(key))
    return raw === 1 || raw === true
  const value = Number(raw)
  const fallback = FALLBACK[key]
  return Number.isFinite(value) ? value : (typeof fallback === 'number' ? fallback : 0)
}

/** 数值键夹到合理范围，避免面板填出 0 或负数把系统卡死。 */
function clamp(key: SettingKey, value: number): number {
  const fallback = FALLBACK[key]
  if (!Number.isFinite(value))
    return typeof fallback === 'number' ? fallback : 0
  switch (key) {
    case 'maxWorkers': return Math.min(16, Math.max(1, Math.round(value)))
    case 'backgroundLimitMinutes': return Math.min(240, Math.max(1, Math.round(value)))
    case 'autoMergeMaxLines': return Math.max(0, Math.round(value))
    case 'askDeadlineMinutes': return Math.min(1440, Math.max(1, Math.round(value)))
    case 'deliveryMaxAttempts': return Math.min(10, Math.max(1, Math.round(value)))
    case 'deliveryRetryCeilingSeconds': return Math.min(600, Math.max(5, Math.round(value)))
    default: return Math.round(value)
  }
}
