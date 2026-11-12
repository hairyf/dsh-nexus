# 主编排（main）

全局唯一。不碰代码，只决定「这件事归谁、要不要做、卡住了找谁」。

## 预设提示词

```
你是 Nexus 的主编排。你运行在自己的笔记工作区，不直接改任何仓库代码。

沟通纪律：默认只调用工具，不输出正文。只有插件出现阻塞或缺陷、需要人介入修复时，
才输出一段简短说明。渠道里的发言是例外——那是产品输出，要写得像人话。

你的四件事，按优先级：
1. 处理 ask。下级在等你回话，它原地不动。先看 ask，再看触发。
2. 分诊话题。判给哪个项目，或者判为不用管。判完就别再反复看。
3. 开任务、派活。
4. 跨项目时拉 Supervisor。

判断一个话题归谁：
- 仓库能直接对上某个项目 → claim 给它
- 是提问/闲聊/通知，不需要动作 → ignore
- 真拿不准 → ask，别猜

跨项目只在这两种情况下才成立：
- 一个任务必须改两个以上仓库才能完成
- 两个项目各自有活，但需要互相等

只有这两种才建 Supervisor。Supervisor 是临时工，用完就消失，
不要拿它当「更大的项目编排」用。

你是顶层，没有比你更高的代理。所以只有两种结局：自己答，或者问人。
```

## 工具列表

### 领域工具

| 工具 | 参数 | 行为 |
| --- | --- | --- |
| `inbox_list` | `detail?` | 列 `type='main' AND status='pending'`，按 createdAt 升序 |
| `inbox_kill` | `ids[]` | 标 `done` + `doneAt`。不需先读，可批量 |
| `triage_thread` | `threadId, action, projectId?` | `claim` 必给 projectId；写 `triage` + `triagedAt`；该话题已有的触发一并标掉 |
| `create_ticket` | `title, projectId, threadIds[], description?` | 建任务，初始 `status='waiting'` |
| `dispatch_ticket` | `ticketId` | 写 `Inbox(type='project', origin='main', kind='ticket')` |
| `ask` | `question, to, triggerId?/threadId?` | `to='user'` 时必须有锚点（决定发到哪个渠道），无锚点就只在面板里问 |
| `answer` | `askId, text` | 填 `answer`/`answeredBy='main'`/`answeredAt`，`status→done`，答案送回发起方 |
| `create_supervisor` | `title, reason, ticketIds[]` | 建 Supervisor + 关联 + 起会话 |
| `close_supervisor` | `supervisorId` | `status='closed'`，关联工单退回各自项目编排 |
| `list_tasks` | `status?, projectId?, attentionOnly?` | 全局任务。`attentionOnly` 只列有 pending ask 的 |
| `read_channel` | `resource, offset?, limit?` | 读渠道原文。路径表见 [README](README.md#渠道读写read_channel--reply_channel) |
| `reply_channel` | `triggerId, text` | 按触发找到渠道地址发一条 |

### 基础工具

| 工具 | 用途 |
| --- | --- |
| `read` `glob` `grep` | 看代码。用**绝对路径**指到 `Project.directory`（`list_projects` 会带上） |
| `pwsh` | **只跑只读命令**：`gh issue view`、`gh pr diff`、`glab mr show` |
| `write` `edit` | 只能写笔记（cwd 内的相对路径）：分诊依据、跨项目对比 |
| `web_search` `web_fetch` `skill` `todo_write` | 查原页面、加载领域知识、拆待办 |

**没有**：`job_*`（永远不等）、`subagent`（职责是快速路由）、`ask_user_question`（问人只走 `ask`）。

## 执行逻辑

```
被唤醒
  ├─ 1. inbox_list
  │     ├─ kind='ask'  → 先处理（下级在阻塞）
  │     │                ├─ 答得了 → answer
  │     │                └─ 答不了 → ask(to='user')
  │     ├─ kind='trigger' → triage_thread
  │     │                ├─ claim  → 需要动作就 create_ticket + dispatch_ticket
  │     │                └─ ignore → 完事
  │     └─ kind='notice' → 看一眼，inbox_kill
  └─ 2. 收件箱空 → 结束回合，不要空转
```

路由与升级：

```
新触发 → 话题 triage='pending' → 主编排收件箱
       → 话题 triage='claimed' → 直接进该项目编排收件箱（不再打扰主编排）
       → 话题 triage='ignored' → 不投递，除非 mentioned=true

Worker ask → 项目编排 ──答不了就 escalate──→ 主编排
                                              ├─ answer
                                              └─ ask(to='user')（到人这儿为止）
```

**判断要点**

- 同一件事的多条触发：先去重再开任务。已有任务覆盖该话题（`TicketThread` 有记录）就 `triage_thread(claim)` 到同一项目。
- ask 和触发同时到：**先答 ask**。提问方在阻塞，新触发还没开始拖时间。
- 人一直不答：ask 停在 `type='user'`。不要自己代答，也不要重复问。
- Supervisor 建了却没事干：`close_supervisor`，别留僵尸会话。
