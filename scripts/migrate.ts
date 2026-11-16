import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const directory = join(root, 'prisma/migrations')
const entries = readdirSync(directory, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => [entry.name, readFileSync(join(directory, entry.name, 'migration.sql'), 'utf8')])
  .sort(([a], [b]) => a.localeCompare(b))
writeFileSync(join(root, 'src/database/migrations.ts'), `export const migrations: Record<string, string> = ${JSON.stringify(Object.fromEntries(entries), null, 2)}\n`)
console.log(`Bundled ${entries.length} immutable migrations`)
