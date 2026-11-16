import type { ReactNode } from 'react'
import type { PolicySnapshot, SettingsPatch } from '../../../types/ledger'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { useState } from 'react'
import { nexus } from '../../apis/nexus'
import { PolicyFields } from '../../components/policy-fields'
import { useCommand, usePanel } from '../../hooks/use-panel'

export function Setting(): ReactNode {
  const { data } = usePanel()

  const command = useCommand()

  const [section, setSection] = useState('projects')

  const [query, setQuery] = useState('')

  const [result, setResult] = useState('')

  const [draft, setDraft] = useState(() => ({ ...data.settings, whitelist: data.settings.whitelist.join(', ') }))

  const projects = data.projects.filter(project => [project.name, project.directory, project.repository].join(' ').toLowerCase().includes(query.toLowerCase()))

  const policy = { questionLevel: draft.defaultQuestionLevel, mergePolicy: draft.defaultMergePolicy } as PolicySnapshot

  const fields = [['backgroundLimitMinutes', '后台工作时限（分钟）'], ['reminderIntervalMinutes', '提醒间隔（分钟）'], ['deliveryMaxAttempts', '投递失败次数上限'], ['deliveryRetryCeilingSeconds', '投递重试间隔上限（秒）']] as const

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <h2 className="m-0 text-base font-medium">自动化范围与全局默认</h2>
      <div className="grid min-w-0 gap-4 sm:grid-cols-[150px_minmax(0,1fr)]">
        <nav aria-label="设置分类" className="flex flex-wrap gap-2 self-start sm:flex-col">
          <Button size="sm" variant={section === 'projects' ? 'outline' : 'ghost'} onClick={() => setSection('projects')}>项目范围</Button>
          <Button size="sm" variant={section === 'defaults' ? 'outline' : 'ghost'} onClick={() => setSection('defaults')}>全局默认</Button>
        </nav>
        <div className="flex min-w-0 flex-col gap-4">
          {section === 'projects'
            ? (
                <>
                  <p className="m-0 text-xs">新发现项目默认禁用；刷新保留已有选择。失联或禁用项目保留历史，不派工。</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <label>
                      搜索项目
                      <input type="search" value={query} onChange={event => setQuery(event.target.value)} className="rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-layer-1)] p-1" />
                    </label>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={command.busy}
                      onClick={() => void command.run('刷新 Git 工作区', async () => {
                        await nexus.refreshProjects()
                      })}
                    >
                      刷新 Git 工作区
                    </Button>
                    <span className="text-xs">
                      已启用
                      {data.projects.filter(project => project.enabled).length}
                      {' '}
                      /
                      {data.projects.length}
                    </span>
                  </div>
                  {projects.map(project => (
                    <article className="rounded-xl border border-[var(--dsw-alias-border-l3)] p-4" key={project.id}>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!project.enabled}
                          disabled={command.busy || (!project.enabled && (!project.available || !project.repository))}
                          onChange={(event) => {
                            const enabled = event.target.checked
                            void command.run((enabled ? '启用项目 ' : '禁用项目 ') + project.name, async () => {
                              const result = await nexus.project(project.id, enabled)
                              setResult(JSON.stringify(result))
                              const failures = result.interruptions.filter(item => !item.interrupted)
                              return failures.length ? `项目选择已保存，但会话尚未中断：${failures.map(item => `${item.bindingId} · ${item.reason}`).join(', ')}` : '项目选择已保存；不会因此虚构派工或完成。'
                            })
                          }}
                        />
                        {project.name}
                        {' '}
                        ·
                        {project.available ? '可用' : '不可用，保留历史'}
                        {' '}
                        ·
                        {project.enabled ? '已启用' : '已禁用'}
                      </label>
                      <p className="mb-0 break-all font-mono text-xs text-[var(--dsw-alias-label-secondary)]">
                        {project.directory}
                        {' '}
                        ·
                        {' '}
                        {project.repository ?? '仓库身份未核验'}
                      </p>
                      {project.attentionReason && <p className="mb-0 text-xs">{project.attentionReason}</p>}
                    </article>
                  ))}
                  {!data.projects.length
                    ? <p>尚未发现 Git 项目。请在宿主添加带 remote 的 Git 工作区，再刷新。</p>
                    : !projects.length && (
                        <div>
                          <p>没有匹配项目；历史记录没有被删除。</p>
                          <Button size="sm" variant="outline" onClick={() => setQuery('')}>清除搜索</Button>
                        </div>
                      )}
                </>
              )
            : (
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    void command.run('保存全局默认', async () => {
                      const patch: SettingsPatch = { defaultQuestionLevel: draft.defaultQuestionLevel as PolicySnapshot['questionLevel'], defaultMergePolicy: draft.defaultMergePolicy as PolicySnapshot['mergePolicy'], whitelist: draft.whitelist.split(',').map(value => value.trim()).filter(Boolean), maxWorkers: draft.maxWorkers, backgroundLimitMinutes: draft.backgroundLimitMinutes, reminderIntervalMinutes: draft.reminderIntervalMinutes, deliveryMaxAttempts: draft.deliveryMaxAttempts, deliveryRetryCeilingSeconds: draft.deliveryRetryCeilingSeconds }
                      await nexus.settings(patch)
                    })
                  }}
                  className="flex flex-col gap-5"
                >
                  <p className="m-0 rounded-lg border border-[var(--dsw-alias-border-l3)] p-3 text-xs">全局提问档位与合并策略只影响新工单，不会改变既有工单快照。修改已有票，请到工单详情单独编辑。</p>
                  <fieldset disabled={command.busy} className="m-0 flex flex-col gap-5 border-0 p-0">
                    <PolicyFields value={policy} onChange={value => setDraft(previous => ({ ...previous, defaultQuestionLevel: value.questionLevel, defaultMergePolicy: value.mergePolicy }))} />
                    <label className="flex max-w-sm flex-col gap-1 text-xs">
                      Worker 并发上限（1–16）
                      <input type="number" min={1} max={16} step={1} required value={draft.maxWorkers} onChange={event => setDraft(previous => ({ ...previous, maxWorkers: event.target.valueAsNumber }))} className="rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-layer-1)] p-2" />
                    </label>
                    <label className="flex flex-col gap-1 text-xs">
                      GitHub 人工答复白名单（login，逗号分隔）
                      <input value={draft.whitelist} onChange={event => setDraft(previous => ({ ...previous, whitelist: event.target.value }))} className="rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-layer-1)] p-2" />
                    </label>
                    <details>
                      <summary className="cursor-pointer">高级运行与投递参数</summary>
                      <div className="mt-3 grid gap-4 sm:grid-cols-2">
                        {fields.map(([key, label]) => (
                          <label key={key} className="flex flex-col gap-1 text-xs">
                            {label}
                            <input type="number" required min={1} step={1} value={draft[key]} onChange={event => setDraft(previous => ({ ...previous, [key]: event.target.valueAsNumber }))} className="rounded border border-[var(--dsw-alias-border-l2)] bg-[var(--dsw-alias-bg-layer-1)] p-2" />
                          </label>
                        ))}
                      </div>
                    </details>
                    <div className="flex gap-3">
                      <Button type="submit" size="sm" variant="outline">{command.busy ? '正在保存…' : '保存全局默认'}</Button>
                      <Button size="sm" variant="ghost" onClick={() => setDraft({ ...data.settings, whitelist: data.settings.whitelist.join(', ') })}>撤销草稿</Button>
                    </div>
                  </fieldset>
                </form>
              )}
          {command.feedback && <p role="status" className="m-0 text-xs">{command.feedback}</p>}
          {command.error && <p role="alert" className="m-0 text-xs text-[var(--dsw-alias-state-error-primary)]">{command.error}</p>}
          {result && (
            <details>
              <summary>最近项目操作结果</summary>
              <pre className="whitespace-pre-wrap break-all text-xs">{result}</pre>
            </details>
          )}
        </div>
      </div>
    </section>
  )
}
