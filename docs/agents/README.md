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
| `read_channel` `reply_channel` | ✅ | ✅ | ✅ 只读本任务来源 | ✅ |
| `job_*` | ❌ | ✅ | ✅ | ❌ |
| `subagent` | ❌ | ✅ | ✅ | ❌ |
| `ask_user_question` `present` | ❌ | ❌ | ❌ | ❌ |

几条理由：

- **`job_*` 不给主编排**：官方要求主编排「永远不等」。它一挂起，新触发就没人分诊。
- **`ask_user_question` 全都不给**：问人只走领域工具 `ask`（会写 Inbox 行）。两条路必然打架。
- **`write` 按目录切不按角色切**：编排层确实需要记草稿，但写不到代码就够了。
- **渠道读写四个角色都有**：`read_channel` 一套路径、`reply_channel` 一个锚点，
  不给每个渠道造一对工具。Worker 的 `read_channel` 有范围限制（只能读自己任务的来源）。

**渠道提示词**：

每个渠道的用法说明是 `assets/skills/nexus-channel-<id>/SKILL.md`，
和官方 `skills/dsh-superagent-github/SKILL.md` 同一套形式。

**所有角色都读得到，不按角色分配。** 这正是 skill 机制的意义：
模型按当前任务自己决定 load 哪份，而不是我们在代码里替它猜。
详见 [prisma/README.md 的「渠道提示词」](../../prisma/README.md#渠道提示词不在数据库里)。

**问人 / 问上级只有两个动作**：

```
ask(question, to='user' | 'main' | 'project')   有问题要问
escalate(askId)                                这条我答不了，原样上交
```

`ask` 是问一件**新事**；`escalate` 是**同一个问题**换个人答。用错会导致重复提问或凭空冒出问题。

## 渠道读写：`read_channel` / `reply_channel`

四个角色**都有**这两个工具，一对读、一对写。渠道的细节怎么用，由
`assets/skills/nexus-channel-<id>/SKILL.md` 教 —— 工具只说"能读/能写"，skil 说"怎么读/怎么写"。

### `read_channel(resource, offset?, limit?)`

一个通用读取器，靠**路径前缀**分发到不同渠道。不是每加一个渠道就加一个工具。

| 路径 | 读什么 |
| --- | --- |
| `github/issues/<n>` | issue 描述 |
| `github/issues/<n>/comments` | 对话评论 |
| `github/pulls/<n>` | PR 描述 |
| `github/pulls/<n>/comments` | review 评论 |
| `github/pulls/<n>/thread/<comment-id>` | 一条 review 串（含它首条评论为根） |
| `github/pulls/<n>/reviews` | review 列表 |
| `github/pulls/<n>/checks` | CI 状态 |
| `feishu/<trigger-id>/message` | 源消息本身 |
| `feishu/<trigger-id>/root` | 所在话题串的首条 |
| `feishu/<trigger-id>/parent` | 它回复的那条（含合并转发） |
| `feishu/<trigger-id>/thread` | 整个话题串 |
| `feishu/<trigger-id>/around` | 周边聊天：前 5 条 + 本条 + 后 5 条，可继续往前翻 |
| `trigger/<id>` | 一条触发 + 它回复的那条 + 同话题上的前后各一条 |
| `thread/<key>` | 一个话题：标题、链接、关联任务、最新触发 |
| `ticket/<id>` | 一个任务的卡片、Worker、最近汇报 |

**返回形状统一**：

```
{ items: [...], next_offset: number | null, next_resource: string | null }
```

- `next_offset` 本地翻页（同一批数据往后读）
- `next_resource` 远端游标翻页（渠道侧还有下一页）
- **offset 0 重新读；之后的 offset 读同一份快照**，不会因为数据变了而错位
- 一页默认 20 条，上限 50

**两条翻页轴必须都跟完**，否则会误判"读完了"。

**权限**：Worker 只能读自己任务来源的内容（`TicketThread` 关联的话题、派工带来的触发）。
读别人的触发会被拒。主编排 / 项目编排 / Supervisor 不受此限。

### `reply_channel(triggerId, text)`

按触发找到渠道地址发一条。**锚点是 `triggerId`** —— 一个问题只会锚在一条触发上，
不用猜发到哪个会话。

规则：

- bot 身份发言，语气像人话，不是报告体
- 100 词硬上限（飞书按分词算，Markdown 链接标签和地址都算）
- 不要重复对方已说的话
- 排队成功 ≠ 送达。投递失败会另行通知

### 为什么不做成每个渠道一对工具

官方是 `orchestrator_read` + `orchestrator_reply` 两个通用工具，配一张
`RESOURCES` 资源表 + skill 教细节。我们照抄这个形状。

每加一个渠道就加两个工具的话，工具列表会随渠道数线性膨胀，
而模型选错工具的概率也会随之上升。路径前缀 + skill 的组合没有这个问题。

## 被否掉的：`wait`（阻塞等待子会话）

方案里建议给项目编排一个 `wait(sessionIds[])`，同时等多个 Worker。**不做**：

- DSH 是通知式的（`steer` + 排队一轮 + 子会话结束自动通知），Worker 的 `report`
  本来就会叫醒项目编排。再加一套阻塞机制，两套唤醒来源必然打架。
- 阻塞最危险的地方：等 A 时 B 来问了，B 一起等。「可中断」能缓解，但依赖运行时支持
  「阻塞中的工具调用被外部消息打断」，这个能力现在没把握假设它存在。

替代：`send` 后立刻 `view` 确认听懂了，剩下的靠 `report` 唤醒。将来若发现 Worker
崩溃时静默，再加**带硬超时**的 `wait`，而不是现在引入。
