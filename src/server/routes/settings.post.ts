/** 保存设置。只写传进来的键，没传的保持原样。 */
import type { Ack, SettingKey } from '../../types'
import { defineEventHandler, readBody } from 'h3'
import { SETTING_KEYS } from '../../constants'
import { db } from '../../database/index'

export type SettingsBody = Partial<Record<SettingKey, number | boolean>>

export const settingsSaveHandler = defineEventHandler(async (event): Promise<Ack> => {
  const body = (await readBody<SettingsBody>(event)) ?? { } as SettingsBody
  const patch = Object.fromEntries(SETTING_KEYS.filter(key => body[key] !== undefined).map(key => [key, body[key]]))
  await db.setting.save(patch)
  return { ok: true, message: '设置已保存' }
})
