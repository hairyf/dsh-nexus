import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import process from 'node:process'

export function resolveDataDirectory(options: { dataDir?: string } = {}, dshHome = process.env.DSH_HOME ?? join(homedir(), '.dsh'), profileDirectory?: string): string {
  const directory = options.dataDir ?? join(profileDirectory ?? dshHome, 'storages/nexus')
  if (!isAbsolute(directory))
    throw new Error('Nexus dataDir must be absolute')
  return directory
}

export const DSH_PLUGIN_HOME = resolveDataDirectory()
