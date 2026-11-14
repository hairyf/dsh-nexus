export interface RuntimeSettings {
  maxWorkers: number
  backgroundLimitMinutes: number
  autoMerge: boolean
  autoMergeMaxLines: number
  deliveryMaxAttempts: number
  deliveryRetryCeilingSeconds: number
}

export interface Project {
  id: string
  workspaceId: string
  name: string
  directory: string
  remoteUrl: string | null
  enabled: boolean
  available: boolean
}

export type Section = 'projects' | 'execution' | 'delivery'

export const GROUPS = {
  execution: ['maxWorkers', 'backgroundLimitMinutes', 'autoMerge', 'autoMergeMaxLines'],
  delivery: ['deliveryMaxAttempts', 'deliveryRetryCeilingSeconds'],
} as const

export const LIMITS = {
  maxWorkers: { min: 1, max: 16 },
  backgroundLimitMinutes: { min: 1, max: 1440 },
  autoMergeMaxLines: { min: 1, max: 10000 },
  deliveryMaxAttempts: { min: 1, max: 20 },
  deliveryRetryCeilingSeconds: { min: 2, max: 3600 },
} as const

const SAMPLE_WORKSPACES: readonly Project[] = [
  { id: 'project-nexus', workspaceId: 'workspace-nexus', name: 'dsh-nexus', directory: 'E:\\projects\\dsh-nexus', remoteUrl: 'https://github.com/dsh-tauri-desk/dsh-nexus.git', enabled: true, available: true },
  { id: 'project-kernel', workspaceId: 'workspace-kernel', name: 'dsh-third-kernel', directory: 'E:\\projects\\dsh-third-kernel', remoteUrl: 'https://github.com/hairyf/dsh-third-kernel.git', enabled: true, available: true },
  { id: 'project-lab', workspaceId: 'workspace-lab', name: 'local-lab', directory: 'E:\\projects\\local-lab', remoteUrl: null, enabled: false, available: true },
  { id: 'project-archived', workspaceId: 'workspace-archived', name: 'archived-console', directory: 'E:\\archive\\console', remoteUrl: 'https://gitlab.com/team/console.git', enabled: false, available: false },
]

export function validSettings(settings: RuntimeSettings): boolean {
  return typeof settings.autoMerge === 'boolean' && Object.entries(LIMITS).every(([key, limits]) => {
    const value = settings[key as keyof typeof LIMITS]
    return Number.isInteger(value) && value >= limits.min && value <= limits.max
  })
}

export function eligibleProjects(projects: readonly Project[]): Project[] {
  return projects.filter(project => project.available && Boolean(project.remoteUrl?.trim()))
}

export function refreshProjects(current: readonly Project[], discovered: readonly Project[] = SAMPLE_WORKSPACES): Project[] {
  const known = new Map(current.map(project => [project.workspaceId, project]))
  const refreshed = discovered.map((project) => {
    const existing = known.get(project.workspaceId)
    known.delete(project.workspaceId)
    return { ...project, id: existing?.id ?? project.id, enabled: existing?.enabled ?? project.enabled }
  })
  return [...refreshed, ...[...known.values()].map(project => ({ ...project, available: false }))]
}

export interface SettingsState {
  section: Section
  projects: Project[]
  saved: RuntimeSettings
  draft: RuntimeSettings
  refreshedAt: string | null
  notice: 'saved' | 'refreshed' | 'project' | null
  invalid: boolean
}

export function initialSettings(): SettingsState {
  const saved: RuntimeSettings = { maxWorkers: 10, backgroundLimitMinutes: 30, autoMerge: false, autoMergeMaxLines: 200, deliveryMaxAttempts: 3, deliveryRetryCeilingSeconds: 60 }
  return {
    section: 'projects' as Section,
    projects: refreshProjects([]),
    saved,
    draft: { ...saved },
    refreshedAt: null as string | null,
    notice: null as 'saved' | 'refreshed' | 'project' | null,
    invalid: false,
  }
}
