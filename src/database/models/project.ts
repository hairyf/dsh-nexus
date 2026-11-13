import type { Insertable, Kysely } from 'kysely'
import type { DB } from '../types'
import { Model } from 'kysely-model'

/** 新建项目时要给的东西。id 由仓库名派生，人一看就知道是哪个库。 */
export interface NewProject {
  /** 仓库全名，例如 `owner/repo`；`/` 会变成 `-` 作为 id */
  name: string
  channelId: string
  directory: string
  /** 绑定已有工作区时给；不给就新建一个 */
  workspaceId?: string
}

/** 一个项目 = 一个 git 仓库 + 一个 DSH 工作区。项目编排会话挂在它上面。 */
export class Project extends Model<DB, 'project'> {
  constructor(db: Kysely<DB>) {
    super(db, 'project', 'id')
  }

  /** 项目 id → 展示名。各视图组装时都要用，集中在这里查。 */
  async nameMap(): Promise<Map<string, string>> {
    const rows = await this.db.selectFrom('project').select(['id', 'name']).execute()
    return new Map(rows.map(row => [row.id, row.name]))
  }

  /** 按工作区查项目。一个工作区只能绑一个项目。 */
  async byWorkspace(workspaceId: string): Promise<{ name: string } | undefined> {
    return this.db.selectFrom('project').selectAll().where('workspaceId', '=', workspaceId).executeTakeFirst()
  }

  /** 已经被项目占用的工作区 id。`list_unbound_workspaces` 靠它做差集。 */
  async boundWorkspaceIds(): Promise<Set<string>> {
    const rows = await this.db.selectFrom('project').select('workspaceId').execute()
    return new Set(rows.map(row => row.workspaceId))
  }

  /** 新建项目并**新开**一个工作区。 */
  async createStandalone(input: Omit<NewProject, 'workspaceId'>): Promise<{ id: string, workspaceId: string }> {
    return this.insert({ ...input, workspaceId: `ws_${Date.now().toString(36)}` })
  }

  /** 新建项目并**绑定已有**工作区。 */
  async createBound(input: NewProject & { workspaceId: string }): Promise<{ id: string }> {
    return this.insert(input)
  }

  /** 落库前统一检查：工作区不能已被占用，id 不能重名。 */
  private async insert(input: NewProject & { workspaceId: string }): Promise<{ id: string, workspaceId: string }> {
    const occupied = await this.byWorkspace(input.workspaceId)
    if (occupied)
      throw new Error(`工作区已被项目 ${occupied.name} 占用`)

    const id = input.name.replace(/\//g, '-')
    const existing = await this.findUnique(id).catch(() => undefined)
    if (existing)
      throw new Error(`项目 ${id} 已存在`)

    const now = new Date().toISOString()
    const row: Insertable<DB['project']> = {
      id,
      channelId: input.channelId,
      name: input.name,
      workspaceId: input.workspaceId,
      directory: input.directory,
      orchestratorSessionId: null,
      createdAt: now,
      updatedAt: now,
    }
    await this.create(row)
    return { id, workspaceId: input.workspaceId }
  }
}
