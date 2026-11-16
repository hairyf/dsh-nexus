import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import process from 'node:process'
import { LedgerError } from '../database'

export function resolveDataDirectory(options: { dataDir?: string } = {}, dshHome = process.env.DSH_HOME ?? join(homedir(), '.dsh'), profileDirectory?: string): string {
  const directory = options.dataDir ?? join(profileDirectory ?? dshHome, 'storages/nexus')
  if (!isAbsolute(directory))
    throw new LedgerError('invalid_config', 'Nexus dataDir must be absolute')
  return directory
}

export const DSH_PLUGIN_HOME = resolveDataDirectory()
