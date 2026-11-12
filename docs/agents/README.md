# Nexus 代理

四个代理，三层架构 + 一个临时协调者：

```
主编排（main）     全局唯一，只分诊派活
 ├─ 项目编排（project）   每项目一个，管任务、指挥 Worker
 │    └─ Worker（执行会话）     真正干活，有写权限，一个 worktree
 └─ 临时 Supervisor        跨项目时临时拉起，用完即弃
```

| 文件 | 收件箱 | 能改代码 |
| --- | --- | --- |
| [main.md](main.md) | `type='main'` | ❌ 只写笔记 |
| [project.md](project.md) | `type='project'` | ❌ 只写笔记 |
| [worker.md](worker.md) | **无**，上级直接插话 | ✅ |
| [supervisor.md](supervisor.md) | `type='supervisor'` | ❌ 只写笔记 |

## 共用约定

**工作目录 = 笔记工作区**，不是仓库。仓库在 `Project.directory`。

| 代理 | cwd | 读代码 |
| --- | --- | --- |
| 主编排 / Supervisor | `~/.nexus/notes/<role>/` | 绝对路径指向 `Project.directory` |
| 项目编排 | `~/.nexus/notes/project/<id>/` | 同上 |
| Worker | 任务 worktree（独占） | 就在脚下 |

这样 `write` 天然被关在笔记里：相对路径写出去的是笔记，不是代码。

**工具分层**：

| 工具 | 主编排 | 项目编排 | Worker | Supervisor |
| --- | :-: | :-: | :-: | :-: |
| `read` `glob` `grep` | ✅ | ✅ | ✅ | ✅ |
| `write` `edit` | ✅ 笔记 | ✅ 笔记 | ✅ worktree | ✅ 笔记 |
| `pwsh` | ✅ 只读 | ✅ | ✅ | ✅ 只读 |
| `job_*` | ❌ | ✅ | ✅ | ❌ |
| `subagent` | ❌ | ✅ | ✅ | ❌ |
| `ask_user_question` `present` | ❌ | ❌ | ❌ | ❌ |

几条理由：

- **`job_*` 不给主编排**：官方要求主编排「永远不等」。它一挂起，新触发就没人分诊。
- **`ask_user_question` 全都不给**：问人只走领域工具 `ask`（会写 Inbox 行）。两条路必然打架。
- **`write` 按目录切不按角色切**：编排层确实需要记草稿，但写不到代码就够了。

**问人 / 问上级只有两个动作**：

```
ask(question, to='user' | 'main' | 'project')   有问题要问
escalate(askId)                                这条我答不了，原样上交
```

`ask` 是问一件**新事**；`escalate` 是**同一个问题**换个人答。用错会导致重复提问或凭空冒出问题。

## 被否掉的：`wait`（阻塞等待子会话）

方案里建议给项目编排一个 `wait(sessionIds[])`，同时等多个 Worker。**不做**：

- DSH 是通知式的（`steer` + 排队一轮 + 子会话结束自动通知），Worker 的 `report`
  本来就会叫醒项目编排。再加一套阻塞机制，两套唤醒来源必然打架。
- 阻塞最危险的地方：等 A 时 B 来问了，B 一起等。「可中断」能缓解，但依赖运行时支持
  「阻塞中的工具调用被外部消息打断」，这个能力现在没把握假设它存在。

替代：`send` 后立刻 `view` 确认听懂了，剩下的靠 `report` 唤醒。将来若发现 Worker
崩溃时静默，再加**带硬超时**的 `wait`，而不是现在引入。
