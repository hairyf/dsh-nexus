import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { openDatabase } from '../src/database'

const stateDirectory = join(import.meta.dirname, '../.temp/ledger-initialization')
afterEach(async () => {
  await rm(stateDirectory, { recursive: true, force: true })
})
it('opens an empty isolated state directory and reopens without duplicate migrations', async () => {
  await mkdir(stateDirectory, { recursive: true })
  const first = await openDatabase(stateDirectory)
  expect(first.connection.prepare('SELECT count(*) AS count FROM kysely_migration').get()).toEqual({ count: 4 })
  first.close()
  const second = await openDatabase(stateDirectory)
  expect(second.connection.prepare('SELECT count(*) AS count FROM kysely_migration').get()).toEqual({ count: 4 })
  second.close()
})
