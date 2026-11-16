import type { Context } from '@deepseek-ai/cordis'
import { randomUUID } from 'node:crypto'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { expect, it } from 'vitest'
import { apply } from '../src'
import { server } from '../src/server'

it('registers and disposes real H3 routes through the existing host WebServer', () => {
  const routes = new Map<string, unknown>()
  const dispose = server({ webServer: { register: (route: { path: string }) => {
    routes.set(route.path, route)
    return () => routes.delete(route.path)
  } } } as never, { panel: {} as never, owner: () => null })
  expect(routes.has('/api/nexus/panel')).toBe(true)
  expect(routes.has('/api/nexus/asks')).toBe(true)
  dispose()
  expect(routes.size).toBe(0)
})

it('fails initialization visibly before registering presets, routes, listeners or dispatch', async () => {
  const registrations: string[] = []
  const ctx = {
    get: (name: string) => {
      registrations.push(name)
      return undefined
    },
    effect: (operation: () => Promise<unknown>) => operation(),
  } as unknown as Context
  await expect(apply(ctx, { dataDir: 'relative-state' })).rejects.toMatchObject({ code: 'invalid_config' })
  expect(registrations).toEqual(['profileContext'])
})

it('does not activate any host resource when an existing ledger fails migration', async () => {
  const directory = join(import.meta.dirname, '../.temp', `host-migration-${randomUUID()}`)
  await mkdir(directory, { recursive: true })
  const connection = new DatabaseSync(join(directory, 'data.db'))
  connection.exec('CREATE TABLE project (id TEXT PRIMARY KEY)')
  connection.close()
  const services: string[] = []
  const ctx = {
    get: (name: string) => {
      services.push(name)
      return undefined
    },
    effect: (operation: () => Promise<unknown>) => operation(),
  } as unknown as Context
  try {
    await expect(apply(ctx, { dataDir: directory })).rejects.toMatchObject({ code: 'migration_failed' })
    expect(services).toEqual(['profileContext'])
    const original = new DatabaseSync(join(directory, 'data.db'))
    expect(original.prepare('PRAGMA table_info(project)').all()).toHaveLength(1)
    original.close()
  }
  finally {
    await rm(directory, { recursive: true, force: true })
  }
})
