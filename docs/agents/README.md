# Nexus 代理

```
主编排 main      全局唯一，只分诊派活
 ├─ 项目编排 project   每项目一个，管任务、指挥 Worker
 │    └─ Worker        真正干活，独占一个 worktree
 └─ Supervisor         跨项目时临时拉起，用完即弃
```

| 文件 | 收件箱 | 改代码 |
| --- | --- | --- |
| [main.md](main.md) | `type=main` | ❌ 只写笔记 |
| [project.md](project.md) | `type=project` | ❌ 只写笔记 |
| [worker.md](worker.md) | **无**，上级直接插话 | ✅ |
| [supervisor.md](supervisor.md) | `type=supervisor` | ❌ 只写笔记 |

## 工作目录

cwd 是**笔记区**，不是仓库。仓库在 `Project.directory`，用绝对路径读。

| 代理 | cwd |
| --- | --- |
| main / supervisor | `~/.nexus/notes/<role>/` |
| project | `~/.nexus/notes/project/<id>/` |
| worker | 任务 worktree（就脚下） |

`write` 因此天然被关在笔记里 —— 想写代码得用绝对路径，而那要走沙箱。

## 工具矩阵

| | main | project | worker | supervisor |
| --- | :-: | :-: | :-: | :-: |
| `read` `glob` `grep` | ✅ | ✅ | ✅ | ✅ |
| `write` `edit` | 笔记 | 笔记 | worktree | 笔记 |
| `pwsh` | 只读 | ✅ | ✅ | 只读 |
| `job_*` | ❌ | ✅ | ✅ | ❌ |
| `subagent` | ❌ | ✅ | ✅ | ❌ |
| `report` | ❌ | ✅ | ✅ | ✅ |
| `ask` | ❌ | ✅ | ✅ | ✅ |
| `ask_user` | ✅ | ❌ | ❌ | ❌ |
| `escalate` | ❌ | ✅ | ❌ | ❌ |
| `answer` | ✅ | ❌ | ❌ | ✅ |
| `read_channel` | ✅ | ✅ | 限本任务 | ✅ |
| `reply_channel` | ✅ | ✅ | ✅ | ❌ |
| `ask_user_question` `present` | ❌ | ❌ | ❌ | ❌ |

几条不显然的：

- **`job_*` 不给 main / supervisor**：它们一挂起，就没人分诊、没人协调。
- **`reply_channel` 不给 supervisor**：对外只有一个声音，由 main 说。
- **main 没有 `report` 也没有 `ask`**：它是终点，没有上级。
- **`ask_user_question` 全都不给**：问人只有 `ask_user` 一条路。

## 汇报与求助

| 工具 | 发给谁 | 等不等 |
| --- | --- | --- |
| `report(state, summary, supervisorId?)` | 上级 | ❌ 发完继续 |
| `ask(question, supervisorId?)` | 上级 | ✅ 这条线停下 |
| `escalate(askId)` | 上级 | — 转发已有问题 |
| `ask_user(question, triggerId?)` | 人类（只有 main） | ✅ |

**`report` 说事实，`ask` 要决定。** `state` 有 `progress` / `ready` / `failed` / `dropped`；
「我在等答复」不占状态位，那是 `ask` 的事。

默认路由：

```
worker     → project
project    → main          （给 supervisorId 则 → supervisor）
supervisor → main
main       → user（ask_user）
```

`supervisorId` **只有 project 能用**。Worker 不知道 Supervisor 存不存在。

`ask` 发出后**这条工作线**挂起、会话不挂起：Worker 停下等，项目编排继续处理别的票。

## 渠道

工具只有一对，细节由 `assets/skills/nexus-channel-<id>/SKILL.md` 教。

### `read_channel(resource, offset?, limit?)`

靠路径前缀分发，不给每个渠道造一对工具。

| 前缀 | 例子 |
| --- | --- |
| `github/` | `github/pulls/81/thread/123`、`.../checks` |
| `feishu/` | `feishu/<trigger-id>/message` · `/root` · `/parent` · `/thread` · `/around` |
| `trigger/` `thread/` `ticket/` | 我们自己的领域数据 |

返回形状统一：

```
{ items, next_offset: number | null, next_resource: string | null }
```

两条翻页轴**都要跟完**，否则会误判「读完了」。offset 0 重读，之后的 offset 读同一份快照。

Worker 只能读本任务来源的内容，其余角色不限。

### `reply_channel(triggerId, text)`

锚点是 `triggerId`。bot 身份发言、像人话、100 词上限、不重复对方说过的话。
排队成功 ≠ 送达。

## skill

渠道说明是 `assets/skills/nexus-channel-<id>/SKILL.md`，三段式：
frontmatter `name` + `description` + 正文。

**所有角色都能读，不按角色分配** —— catalog 里只暴露 `description`，
模型按当前任务自己决定 load 哪份。见 [prisma/README.md](../../prisma/README.md#渠道提示词)。

## 为什么没有 `wait`

依赖关系已经在库里（`TicketLink`、`SupervisorTicket`），再在会话里存一份「我在等谁」，
两份状态必然漂移，且不跨重启。

唤醒靠两件事：**下级主动上报** + **系统兜底通知**（见 [supervisor.md](supervisor.md#唤醒)）。
