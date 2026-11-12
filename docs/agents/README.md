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

**工具矩阵**：

| 工具 | 主编排 | 项目编排 | Worker | Supervisor |
| --- | :-: | :-: | :-: | :-: |
| `read` `glob` `grep` | ✅ | ✅ | ✅ | ✅ |
| `write` `edit` | ✅ 笔记 | ✅ 笔记 | ✅ worktree | ✅ 笔记 |
| `pwsh` | ✅ 只读 | ✅ | ✅ | ✅ 只读 |
| `job_*` | ❌ | ✅ | ✅ | ❌ |
| `subagent` | ❌ | ✅ | ✅ | ❌ |
| `ask_user_question` `present` | ❌ | ❌ | ❌ | ❌ |
| `read_channel` | ✅ | ✅ | ✅ 限本任务 | ✅ |
| `reply_channel` | ✅ | ✅ | ✅ | ❌ |
| `report` | ❌ | ✅ | ✅ | ✅ |
| `ask` | ❌ | ✅ | ✅ | ✅ |
| `escalate` | ❌ | ✅ | ❌ | ❌ |
| `ask_user` | ✅ | ❌ | ❌ | ❌ |
| `answer` | ✅ | ❌ | ❌ | ✅ |

几条理由：

- **`job_*` 不给主编排**：它一挂起，新触发就没人分诊。
- **`ask_user_question` 全都不给**：问人只有 `ask_user` 一条路。
- **`write` 按目录切不按角色切**：编排层需要记草稿，但 cwd 是笔记区，写不到代码。
- **`reply_channel` 不给 Supervisor**：对外只有一个声音，由主编排说。
- **主编排没有 `report`**：它是每条工作线的终点，没人等它的状态。

## 汇报与求助

三个工具，按「谁问谁」分工：

| 工具 | 谁用 | 发给谁 | 等不等 |
| --- | --- | --- | --- |
| `report(state, summary, supervisorId?)` | project / worker / supervisor | 上级 | ❌ 发完继续 |
| `ask(question, supervisorId?)` | project / worker / supervisor | 上级 | ✅ 这条线停下 |
| `escalate(askId)` | project | 上级 | — 转发已有问题 |
| `ask_user(question, triggerId?)` | **只有 main** | 人类 | ✅ |

### 默认路由

```
worker    report/ask  →  project
project   report/ask  →  main        （给 supervisorId 则 → supervisor）
supervisor report/ask →  main
main      ask_user    →  user
```

`supervisorId` 只有 project 能用。Worker 不知道 Supervisor 存不存在，也不该知道 ——
它只管干活，跨项目的事由项目编排往上转。

### `report` 和 `ask` 的区别

**`report` 说事实，`ask` 要决定。**

| 想说 | 用哪个 |
| --- | --- |
| 「我做到一半了」 | `report(progress)` |
| 「我做完了」 | `report(ready)` |
| 「我失败了」 | `report(failed)` |
| 「这需求看不懂，要我怎么办」 | `ask` |
| 「要改别的仓库」 | `ask` |

`state` 只有三种：`progress` / `ready` / `failed`。
「我在等答复」不占状态位 —— 那是 `ask` 的事。

### `ask` 不阻塞会话

`ask` 发出后**这条工作线**挂起，但会话不挂起：

- **Worker**：它本来就只干这一件事，于是停下等
- **项目编排**：继续处理收件箱里别的票，答案到了再回来

同一个机制，行为自然分化，不需要两套逻辑。

### 升级链

```
user ←(ask_user)── main ←(ask)── project ←(ask)── worker
                    ↑
              supervisor（只能到 main）
```

问题往上走，答案往下送。`escalate` 例外：它把**已有那条** ask 原样往上递，
不新建记录，问题文本一个字不改。

## Supervisor 的唤醒

没有后台定时器，也没有程序推送。Supervisor 只因三件事醒来：

| 触发 | 来源 |
| --- | --- |
| 创建 | 主编排 `create_supervisor` |
| 项目上报 | project `report(..., supervisorId)` / `ask(..., supervisorId)` |
| 范围调整 | 主编排 `attach_ticket` / `detach_ticket` / `close_supervisor` |

代价：**没人上报就等于永远不知道**。缓解是每次醒来先 `list_tickets` 自己看，
以及项目编排的预设里写死「工单进终态必须上报」。

同项目内 A 依赖 B 不需要 Supervisor —— 项目编排自己看 `list_tasks` 就够。

**渠道提示词**：

每个渠道的用法说明是 `assets/skills/nexus-channel-<id>/SKILL.md`，
和官方 `skills/dsh-superagent-<name>/SKILL.md` 同一套形式。

**所有角色都读得到，不按角色分配。** 这正是 skill 机制的意义：
模型按当前任务自己决定 load 哪份，而不是我们在代码里替它猜。
详见 [prisma/README.md 的「渠道提示词」](../../prisma/README.md#渠道提示词不在数据库里)。

## 渠道读写：`read_channel` / `reply_channel`

渠道的细节怎么用，由 `assets/skills/nexus-channel-<id>/SKILL.md` 教 ——
工具只说"能读/能写"，skill 说"怎么读/怎么写"。

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
读别人的触发会被拒。其余三个角色不受此限。

### `reply_channel(triggerId, text)`

按触发找到渠道地址发一条。**锚点是 `triggerId`** —— 一个问题只会锚在一条触发上，
不用猜发到哪个会话。

**只有主编排、项目编排、Worker 有。** 主编排是默认的对外声音；项目编排和 Worker
在确有需要时才用，不重复回复由渠道 skill 约束。

规则：

- bot 身份发言，语气像人话，不是报告体
- 100 词硬上限（飞书按分词算，Markdown 链接标签和地址都算）
- 不要重复对方已说的话
- 排队成功 ≠ 送达。投递失败会另行通知

### 为什么不做成每个渠道一对工具

一个通用工具配一张路径表 + skill 教细节。每加一个渠道就加两个工具的话，
工具列表会随渠道数线性膨胀，模型选错工具的概率也会随之上升。
路径前缀 + skill 的组合没有这个问题。

## 为什么没有 `wait` 工具

不提供「阻塞等待某个 Worker / 某张票」的工具。理由：

- 依赖关系已经存在库里（`TicketLink(kind='depends')`、`SupervisorTicket`），
  再在会话里存一份「我在等谁」，两份状态必然漂移 —— 重启就丢。
- Worker 的 `report` 会主动叫醒项目编排；Supervisor 靠项目编排上报叫醒。
  唤醒来源已经够了，再加一套主动轮询只会多一条会漏的路。
- 挂在会话里的等待不跨重启，而 `TicketLink` 跨重启。

需要「等太久就上报」时，用 `Inbox.deadline` 那套机制（和「你有 N 条未处理」
共用同一次会话钩子），不新造工具。