/** 全局设置。只有一行，`id = 'global'`。 */
import type { SettingView } from '../../types'
import { defineEventHandler } from 'h3'
import { db } from '../../database/index'

export const settingsHandler = defineEventHandler(async (): Promise<SettingView> => db.setting.read())
