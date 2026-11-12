# 四个角色

**提示词和工具都在代码里**，不在这份文档里：

| 内容 | 位置 |
| --- | --- |
| 提示词 | `src/agents/main.ts`、`project.ts`、`worker.ts`、`supervisor.ts` |
| 工具定义 | `src/agents/tools.ts`，每个工具用 `roles` 声明谁有它 |
| 装配 | `src/agents/index.ts` |

文档只讲**为什么这样分**。改提示词去改代码，别在这儿抄一遍。

## 一条链

```
主编排 ──dispatch──▶ 项目编排 ──create_worker──▶ Worker
   │                    │
   └──supervise────────▶ Supervisor（临时，跨项目才拉）
```

后面的只向上汇报，不横向对话。Worker 不知道别的 Worker 存在。

## 谁有哪个工具

`✓` 是有，`—` 是没有。

| 工具 | main | project | worker | supervisor |
| --- | :-: | :-: | :-: | :-: |
| `inbox_list` / `inbox_kill` | ✓ | ✓ | — | ✓ |
| `report` / `ask` | — | ✓ | ✓ | ✓ |
| `escalate` | — | ✓ | — | — |
| `answer` | ✓ | — | — | ✓ |
| `ask_user` | ✓ | — | — | — |
| `list_tasks` | ✓ | ✓ | — | — |
| `triage_thread` | ✓ | — | — | — |
| `create_ticket` / `dispatch_ticket` | ✓ | — | — | — |
| `link_thread` | — | ✓ | ✓ | — |
| `update_ticket` | — | ✓ | — | — |
| `create_worker` | — | ✓ | — | — |
| `send` / `view` / `cancel` / `rename` | — | ✓ | — | — |
| `supervisor_list` | ✓ | ✓ | — | — |
| `create_supervisor` / `close_supervisor` / `attach_*` / `detach_*` | ✓ | — | — | — |
| `list_tickets` / `dispatch_to_project` | — | — | — | ✓ |
| `link_dependency` / `close_self` | — | — | — | ✓ |
| `list_unbound_workspaces` / `create_project` / `create_in_workspace_project` | ✓ | — | — | — |
| `read_channel` | ✓ | ✓ | ✓ | ✓ |
| `reply_channel` | ✓ | ✓ | ✓ | — |

## 几个不显然的取舍

**Worker 没有收件箱。** 它短命、被动、在等的时候是阻塞的，
上级的话必须直接 prompt 进会话 —— 进队列等它来取，它永远不会来取。

**只有 main 能 `ask_user`。** 它是唯一还有「人」这个上级的角色。
其他角色要问人，只能往上递，让人替它转达。

**只有 main 和 project 能写 `reply_channel` 之外的东西。**
`reply_channel` 是「以 bot 身份在渠道里说话」，四个角色里三个有，
**supervisor 没有** —— 对外只能有一个声音。

**`escalate` 只有 project 有。** 它转发的是一条已经存在的 ask：
问题原文一个字都不改，只换回答的人。这样「问过没有」永远只有一份记录。

**`send` 的 `interrupt` 是例外手段。** 默认 `queue`。
只有确定 Worker 正在把事情做错、需要立刻止损才打断 ——
打断会留下半成品。

## 汇报与求助的区别

| | `report` | `ask` |
| --- | --- | --- |
| 干什么 | 讲事实 | 要决定 |
| 之后 | 继续干 | 这条线停下 |
| 状态位 | 占 `ReportState` | 不占 |

`report` 的四个状态：`progress` / `ready` / `failed` / `dropped`。

`dropped` 是「这事不用做」的合法表达 —— 没有它，遇到复现不了或已被别人
修好的活，Worker 只能谎报 `ready` 或者白问一次人。

## 项目与工作区

`Project` 绑一个 DSH 工作区（`workspaceId @unique`），由主编排建：

| 工具 | 什么时候用 |
| --- | --- |
| `list_unbound_workspaces` | 先看哪些工作区还没绑项目 |
| `create_project` | 新仓库，连目录带工作区一起建 |
| `create_in_workspace_project` | 工作区已经在系统里了，绑过去 |

绑之前必须先 `list_unbound_workspaces` 拿 id —— **不要猜工作区 id**。
