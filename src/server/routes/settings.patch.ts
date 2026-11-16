import type { H3Event } from 'h3'
import type { SettingsPatch } from '../../types/ledger'
import type { WebServerOptions } from '../../types/web'
import { HTTPError } from 'h3'
import { input, request } from '../request'

export function patchSettings(event: H3Event): Promise<Awaited<ReturnType<WebServerOptions['panel']['setSettings']>>> {
  return request(event, async (panel, actor) => {
    const body = await input(event, ['defaultQuestionLevel', 'defaultMergePolicy', 'whitelist', 'maxWorkers', 'backgroundLimitMinutes', 'reminderIntervalMinutes', 'deliveryMaxAttempts', 'deliveryRetryCeilingSeconds'])
    for (const [key, value] of Object.entries(body)) {
      const valid = key === 'whitelist' ? Array.isArray(value) && value.every(item => typeof item === 'string') : key === 'defaultQuestionLevel' || key === 'defaultMergePolicy' ? typeof value === 'string' : typeof value === 'number'
      if (!valid)
        throw new HTTPError({ status: 400, message: 'invalid_config' })
    }
    return panel.setSettings(body as SettingsPatch, actor)
  })
}
