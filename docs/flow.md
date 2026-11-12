# 流程图

Nexus 的完整流转。状态名、字段名取自 `prisma/schema/`。
各代理的工具与提示词见 [agents/](agents/README.md)，这里只讲**跨代理的流转**。

1. [全景](#1-全景)
2. [触发与分诊](#2-触发与分诊)
3. [任务生命周期](#3-任务生命周期)
4. [Worker 生命周期](#4-worker-生命周期)
5. [汇报与求助](#5-汇报与求助)
6. [收件箱投递规则](#6-收件箱投递规则)
7. [跨项目 Supervisor](#7-跨项目-supervisor)
8. [触发点：PR 与 CI](#8-触发点pr-与-ci)
9. [端到端时序](#9-端到端时序)
10. [状态速查表](#10-状态速查表)

---

## 1. 全景

```mermaid
flowchart TB
    CH["渠道<br/>GitHub / 飞书 / …"]

    subgraph 编排层
        MAIN["主编排 main<br/>全局唯一"]
        PROJ["项目编排 project<br/>每项目一个"]
        SUP["Supervisor<br/>临时"]
    end

    W["Worker<br/>独占 worktree"]

    CH -->|"Trigger"| TH["话题 Thread"]
    TH -->|"未分诊"| MAIN
    TH -->|"已分诊"| PROJ
    MAIN -->|"create_ticket · dispatch"| PROJ
    MAIN -->|"跨 ≥2 项目"| SUP
    SUP -->|"dispatch"| PROJ
    PROJ -->|"create_worker"| W
    W -->|"report / ask"| PROJ
    PROJ -->|"ask"| MAIN
    MAIN -->|"ask_user"| CH
    PROJ -->|"reply_channel"| CH
    W -->|"reply_channel"| CH
```

`main` / `project` / `worker` / `supervisor` 既是 Inbox 的 `type` 取值，
也是四个代理在库里互相指代的名字。

图中只画了往外写的 `reply_channel`。**读方向 `read_channel` 四个角色都有**，
画出来会变成四根交叉的线，反而看不清。

---

## 2. 触发与分诊

投给谁完全由 `Thread.triage` 决定。**分诊只发生一次**，之后固定。

```mermaid
flowchart TD
    T["新 Trigger"] --> Q{"Thread.triage"}

    Q -->|pending| M["投给主编排"]
    Q -->|claimed| P["投给该项目编排"]
    Q -->|ignored| I{"mentioned?"}

    I -->|否| DROP["丢弃"]
    I -->|是| M

    M --> T2["triage_thread"]
    T2 -->|"claim + projectId"| C["triage=claimed"]
    T2 -->|ignore| G["triage=ignored"]
    T2 -->|"要开工"| C2["claim + create_ticket"]
```

| 情况 | 动作 |
| --- | --- |
| 仓库能对上某个项目 | `claim` |
| 提问 / 闲聊 / 通知 | `ignore` |
| 判完才发现要做 | `claim` + `create_ticket` + `dispatch_ticket` |
| 真拿不准 | `ask_user` |

`ignored` 不是彻底静默 —— `mentioned=true` 时仍会重新叫醒主编排。

**判重**：已有任务覆盖同一话题（`TicketThread` 有记录）→ 不开新票，
只把 `triage` 判到同一项目。

---

## 3. 任务生命周期

```mermaid
stateDiagram-v2
    direction LR
    [*] --> waiting : create_ticket
    waiting --> queued : 依赖满足但并发满
    waiting --> running : create_worker
    queued --> running : 腾出并发位
    running --> review : Worker 报 ready
    running --> waiting : Worker 结束需重开
    review --> done : PR merged
    review --> running : 有新改动要求
    waiting --> cancelled : 人类放弃
    running --> cancelled : 人类放弃
    queued --> cancelled : 人类放弃
    review --> cancelled : 人类放弃
    done --> [*]
    cancelled --> [*]
```

### 两个不存在的状态

**没有 `draft`。** 任务一旦存在，`projectId` 就必须确定。
「还没想好归谁」属于话题分诊阶段，不该污染任务列表。

**没有 `attention`。** 工单可以一边 `running` 一边等人 —— 覆盖 `status`
会丢掉它本来跑到哪一步。所以「需介入」是派生的：

```sql
SELECT * FROM ticket t WHERE EXISTS (
  SELECT 1 FROM inbox i
  WHERE i.ticketId = t.id AND i.kind = 'ask' AND i.status = 'pending')
```

### 任务之间的关联

```mermaid
flowchart LR
    A["T-105"] -->|"depends<br/>等 B 先做"| B["T-200"]
    C["T-106"] ---|"relates<br/>只是相关"| D["T-107"]
```

| kind | 影响 |
| --- | --- |
| `depends` | `relatedId` 没做完，`ticketId` 停在 `waiting` |
| `relates` | 无 |

`depends` 还有第二个作用：`relatedId` 到终态时**系统自动通知 Supervisor**（见第 7 章）。

---

## 4. Worker 生命周期

```mermaid
stateDiagram-v2
    direction LR
    [*] --> queued : create_worker
    queued --> running : worktree 建好
    queued --> ended : 未起即作废
    running --> ended : 正常 / 被停 / 失败
    ended --> [*]
```

`branch` / `worktree` 在 `queued` 时为空，`running` 起填上，`ended` 后保留不删 ——
那是「这个任务曾经在哪个分支上干过」的唯一记录。

### 结束原因与后续

| `WorkerEndReason` | 编排动作 |
| --- | --- |
| `completed` | 看 `reportState` 定任务状态 |
| `stopped` | 任务回 `waiting` |
| `failed` | 回 `waiting`，或转人工 |
| `restarted` | 回 `waiting`，自动重开 |

### 汇报状态

`reportState` 是结构化通道，和会话正文（`view` 读的）是两回事。

```mermaid
flowchart LR
    P["progress"] --> R{"干完了吗"}
    R -->|是| READY["ready<br/>PR 已开"]
    R -->|失败| F["failed"]
    READY --> T1["Ticket → review"]
    F --> T2["Ticket → waiting"]
```

只有三种 —— `report` 只讲事实，「我在等答复」归 `ask`，不占状态位。

---

## 5. 汇报与求助

**人类也是一个收件人。** 把 `type=user` 放进 `InboxTarget` 之后，
「问人」和「问上级」是同一件事的不同取值。

### 谁问到谁

```mermaid
flowchart BT
    U["人类"]
    M["主编排"]
    P["项目编排"]
    W["Worker"]
    S["Supervisor"]

    W -->|ask| P
    P -->|ask| M
    S -->|ask| M
    M -->|ask_user| U

    P -.->|"ask(supervisorId)"| S
    S -.->|answer| P
    M -.->|answer| P
    P -.->|answer| W
```

实线默认路径，虚线是 Supervisor 在场时的旁路。

### 升级链

```mermaid
stateDiagram-v2
    direction LR
    [*] --> user : ask_user
    user --> project : 超时 + 代理选择开
    user --> answered : 人抢答
    project --> main : 超时 或 escalate
    project --> answered : 项目编排答了
    main --> answered : 主编排答了
    main --> user : 答不了，改问人（新的一条）
    answered --> [*]
```

升级**就地改 `type`，不新建记录** —— 一个问题只有一条记录、一个身份，
任何时候只有一个处理者。

每次升级更新：`type` 改上一级、`escalations+1`、`lastEscalatedAt=now`、
`deadline` 重置（升到 main 则置空）、`status` 保持 `pending`。

渠道收尾只有一条规则：**只有从 `user` 升级出去的那一次要回渠道补一句话**。
因为只有 `type=user` 意味着问题已经问出口了。

### 回答与回送

```mermaid
sequenceDiagram
    participant W as Worker
    participant DB as Inbox
    participant P as 项目编排
    participant M as 主编排
    participant U as 人类

    W->>DB: ask
    DB-->>P: type=project
    alt 答得了
        P->>DB: answer
    else 答不了
        P->>DB: escalate（type→main）
        M->>DB: answer
    else 得问人
        M->>DB: ask_user
        U->>DB: 回答
    end
    DB->>DB: status=done
    DB-->>W: 答案 prompt 回会话
```

---

## 6. 收件箱投递规则

```mermaid
flowchart LR
    subgraph 来源
        CH["channel"]
        SY["system"]
        MA["main"]
        PR["project"]
        SU["supervisor"]
        WK["worker"]
    end
    subgraph 目标
        TMA["type=main"]
        TPR["type=project"]
        TSU["type=supervisor"]
        TU["type=user"]
    end

    CH -->|trigger| TMA
    CH -->|已分诊| TPR
    SY --> TMA
    SY --> TPR
    MA -->|ticket| TPR
    MA -->|ask_user| TU
    MA -->|attach / detach| TSU
    PR -->|report / ask| TMA
    PR -->|"带 supervisorId"| TSU
    SU -->|ticket| TPR
    SU -->|report / ask| TMA
    WK -->|report / ask| TPR
```

三条边界：

- **`type=user` 只有 main 能写**（`ask_user`）
- **`type=supervisor` 只有 main 和 project 能写** —— Worker 不知道它存在
- **Worker 没有收件箱**，上级的话直接 prompt 进会话

### 消费

```mermaid
flowchart TD
    A["被唤醒"] --> B["inbox_list"]
    B --> C{"逐条"}
    C --> D["处理"]
    D --> E["inbox_kill"]
    E --> F{"还有 pending?"}
    F -->|有| C
    F -->|没有| G["结束回合<br/>不要空转"]
```

会话结束或空闲时，框架数一下 `status=pending` 的条数提示「你有 N 条消息未处理」。
**超时检查不靠后台定时器**，和这次提示共用同一次会话钩子。

---

## 7. 跨项目 Supervisor

```mermaid
stateDiagram-v2
    direction LR
    [*] --> active : create_supervisor
    active --> active : attach / detach
    active --> closed : 工单全部落地
    active --> closed : 主编排强关
    closed --> [*] : 从界面消失，行保留
```

### 唤醒：四个来源

```mermaid
flowchart LR
    M["主编排"] -->|create_supervisor| S["Supervisor"]
    M -->|attach / detach / close| S
    P["项目编排"] -->|"report / ask 带 supervisorId"| S
    D["系统兜底"] -->|依赖已完成| S
```

**前三个是常规，第四个是保险。**

`link_dependency` 后，当 `dependsOn` 走到终态，插件自动投一条 notice：

```mermaid
sequenceDiagram
    participant P as 项目编排
    participant DB as TicketLink
    participant K as 插件
    participant S as Supervisor

    P->>S: link_dependency(T-105, dependsOn=T-200)
    Note over DB: T-105 depends on T-200
    Note over P: T-200 完成
    P->>DB: update_ticket(T-200, done)
    DB->>K: relatedId=T-200 的 depends 行
    K->>K: 查 T-105 属于哪个 Supervisor
    K->>S: Inbox kind=notice<br/>「T-200 完成了」
```

**为什么需要**：项目编排本来就该在工单进终态时 `report`，
但漏报会让整条跨项目链路停摆。依赖关系已经在 `TicketLink` 里，顺手兜一下不费事。

它**只兜一层**：同项目内的依赖没有 Supervisor，系统静默，由项目编排自己看 `list_tasks`。

### 范围调整

```mermaid
sequenceDiagram
    participant S as Supervisor
    participant M as 主编排
    participant P as 项目编排

    S->>M: ask「需要 B 项目加入」
    alt B 有工作区
        M->>M: attach_ticket_to_supervisor
        M->>P: Inbox kind=notice
    else 没有
        M->>M: ask_user
    end
    M-->>S: answer
```

`detach` 时退回原项目编排，**不取消** —— 取消是人的决定。

### 收工

```
全部关联工单 ∈ { done, cancelled } → close_self()
```

有工单没到终态就不许收工。

---

## 8. 触发点：PR 与 CI

### 8.1 PR 上的事件

| 事件 | `TriggerKind` | 走触发？ |
| --- | --- | --- |
| PR 打开 | `open` | ✅ |
| 对话区 / 行内评论 | `comment` | ✅ |
| Review（含无正文的通过打回） | `comment` | ✅ |
| CI 变化 | `ci` | ✅ |
| **合并 / 关闭** | — | ❌ **不发触发** |

**Review 没写正文但点了 Approve 也要发** —— 用户点 Approve 这个动作本身就是答复，
吞掉它，等审批的 Worker 就永远等不到。

PR 和 issue 共用编号，id 格式一致；但**话题不同**（issue 是 `github:42`，PR 是 `github:88`）。

### 8.2 PR 归谁处理

```mermaid
flowchart TD
    A["PR 上的事件"] --> B{"绑定了工单吗"}
    B -->|"绑定了"| C1["评论 → Worker"]
    B -->|"绑定了"| C2["CI → 项目编排"]
    B -->|"绑定了"| C3["合并 → 引擎结单"]
    B -->|"没绑定"| D["走触发 → 主编排分诊"]
```

**主编排只在没有归属时出场。** 已绑定 PR 的任何事件都不经过它。

### 8.3 合并/关闭：引擎结单

```
PR 合并 / 关闭
  → closePull → threadClosed(thread, outcome, at)
  → 引擎直接 end(ticket)                          ← 结单在这里
  → emit('ticket.ended')
      ├─ 主编排收件箱 kind=notice                  ← 只是通知
      └─ 非 GitHub 渠道补一句                      ← GitHub 时间线已有
```

三个关键点：

**① 结单是引擎做的。** 编排收到 notice 通知，不是「请你处理」。

**② `unfinished` 例外。** Worker 还有没报 `ready` 的活，或 PR 关后又起了新 Assignment
→ **不结单**，等 `ready`。防止「PR 合了但活没干完」被误判完成。

**③ `followsDone`：关注的话题全关才结单。** 自己开的 PR 全关了，
或没开 PR 时所有关注话题都关了。

我们的等价实现放在**渠道插件**（Host half）：

```
1. 按 TicketThread 找到跟进这张 PR 的工单
2. 检查 unfinished
3. 没有 → update_ticket(prState, status=done, endedAt)
4. 有   → 只记 prState，留 review，等 report(ready)
5. 主编排 + 项目编排各投一条 kind=notice
6. 非 GitHub 渠道发一句话；GitHub 上不发
```

**为什么不走触发**：PR 合并时没有要判断的东西 —— 结论已经在 GitHub 上了。
走触发等于让编排重复确认一件已确定的事，还多一个「忘了处理就永远不关」的失败点。

### 8.4 PR 归哪张工单

```mermaid
flowchart TD
    A["PR #88 打开"] --> B{"分支名对得上?"}
    B -->|"对得上"| D["link_thread + claim"]
    B -->|"对不上"| E{"正文引用了已有工单的 issue?"}
    E -->|是| F["link_thread"]
    E -->|否| G["当新活 create_ticket"]
    D --> H["update_ticket(prUrl, prState)"]
    F --> H
```

判断依据按可靠性排序：

| 依据 | 可靠性 |
| --- | --- |
| 分支名末段 == `Worker.branch` 末段 | **确定性**，纯字符串比较 |
| 正文 `Closes #42` | 高，但作者可能不写 |
| 标题 / 内容相似 | 低，不要用 |

**分支名优先**。所以建分支时末段必须就是任务号：`nexus/T-105`。
不这么做，PR 和工单关联不上，只能靠模型读正文猜。

关联错了：删掉 `TicketThread` 那行重挂即可，不用回滚 PR。

### 8.5 两套 CI

| | PR CI | 分支 CI |
| --- | --- | --- |
| 看谁 | open ticket 的 PR | 默认分支 head |
| 话题 | 跟 PR 共用 | **独立**（`github:ci:main`） |
| 能回复 | ✅ | ❌ **没有地址** |
| 开关 | 无条件 | 渠道开关，默认关 |

### 8.6 为什么必须防抖

一次 CI 运行会产生几十次状态变化，每次都发会把收件箱刷满。
两套都用 `CiWatch` 记住上次指纹，**只有变了才发**。

#### PR CI

```mermaid
flowchart TD
    A["轮询 open ticket 的 PR"] --> B{"已 closed / merged?"}
    B -->|是| SKIP["跳过"]
    B -->|否| C["读 check-runs + statuses"]
    C --> D{"和 CiWatch 一致?"}
    D -->|一致| DONE["不发"]
    D -->|不一致| F{"之前观察过?"}
    F -->|"没有（首次）"| BASE["只存基线 · 不发"]
    F -->|观察过| G["revision += 1 · 发触发"]
```

**首次只建基线**是最容易漏的一行。没有它，每接一张新任务，
第一次轮询就会因为「和空值不同」误报一次。

#### 分支 CI

```mermaid
flowchart TD
    A["轮询默认分支"] --> B{"开关开着?"}
    B -->|否| DROP["清失败基线<br/>保留 revision"]
    B -->|是| C["读 head.sha 的 checks"]
    C --> D["算 failures 数组"]
    D --> E{"还有 check 在 running?"}
    E -->|有| F["沿用上次的 failures"]
    E -->|没有| G["用这次的"]
    F --> H{"和上次一致?"}
    G --> H
    H -->|一致| DONE["不发"]
    H -->|不一致| I["revision += 1 · 发触发"]
```

第 E 步是整个分支 CI 的核心：**还有 check 在跑，就假装失败集合没变。**

没有它，跑到一半时「3 个失败」→「2 个失败」→「1 个失败」会连触发三次。
有了它，恢复只在全绿后报一次。

#### 其他细节

- **首次基线**：刚开开关或分支改名时 `known` 为空，只存不发。
- **失败判定**：`failure` · `timed_out` · `cancelled` · `action_required` ·
  `startup_failure` · `error`。check-runs 看 `conclusion`，旧式 status 看 `state`。
- **投递**：PR CI 跟 PR 的 `triage` 走；分支 CI 直接投项目编排，不走分诊 ——
  仓库已注册为项目，归属确定，没有歧义。

### 8.7 分支 CI 不能回复

`branchCiTrigger` 根本没有 channel 字段。`reply_channel` 拿到
`ThreadKind=ci` 的触发必须**明确报错**，不能猜一个地方发。

---

## 9. 端到端时序

```mermaid
sequenceDiagram
    participant GH as GitHub
    participant CH as 插件
    participant M as 主编排
    participant P as 项目编排
    participant W as Worker
    participant U as 人类

    GH->>CH: issue #42 @bot
    CH->>M: Inbox kind=trigger
    M->>M: triage_thread(claim) + create_ticket
    M->>P: Inbox kind=ticket
    P->>P: 查 TicketThread 判重
    P->>W: create_worker

    W->>P: report(progress)
    W->>P: ask「需要改 B/x」
    alt 跨项目
        P->>M: ask「请考虑 Supervisor」
        M->>M: create_supervisor
        M->>P: answer
    else 问人
        P->>M: ask
        M->>U: ask_user
        U->>M: 回答
        M->>P: answer
    end
    P->>W: send(mode=reply)

    W->>U: 开 PR
    W->>P: report(ready)
    P->>P: update_ticket(status=review)

    U->>CH: 合并
    CH->>P: update_ticket(merged, done)
    CH->>P: Inbox kind=notice
    CH->>M: Inbox kind=notice
    P->>M: report(ready, supervisorId)
```

### 同话题追加消息

```mermaid
sequenceDiagram
    participant GH as GitHub
    participant P as 项目编排
    participant W as Worker

    Note over P: Thread.triage 已是 claimed
    GH->>P: Inbox kind=trigger
    P->>P: TicketThread 有记录 → 属于 T-105
    alt 需要 Worker 知道
        P->>W: send(mode=queue)
    else 闲聊
        P->>P: inbox_kill
    end
```

**这条路径不经过主编排** —— 分诊已完成，不该被同一件事反复叫醒。

---

## 10. 状态速查表

| 枚举 | 取值 |
| --- | --- |
| `ThreadKind` | `issue` · `pull` · `chat` · `ci` |
| `ThreadTriage` | `pending` · `claimed` · `ignored` |
| `TriggerKind` | `comment` · `open` · `close` · `ci` · `push` |
| `TicketStatus` | `waiting` · `queued` · `running` · `review` · `done` · `cancelled` |
| `PullRequestState` | `open` · `merged` · `closed` |
| `CiState` | `pending` · `running` · `passing` · `failing` |
| `TicketLinkKind` | `depends` · `relates` |
| `WorkerStatus` | `queued` · `running` · `ended` |
| `WorkerEndReason` | `completed` · `stopped` · `failed` · `restarted` |
| `ReportState` | `progress` · `ready` · `failed` |
| `InboxTarget` | `user` · `main` · `project` · `supervisor` |
| `InboxOrigin` | `channel` · `main` · `project` · `worker` · `supervisor` · `system` |
| `InboxStatus` | `pending` · `done` |
| `InboxKind` | `trigger` · `ticket` · `ask` · `notice` |
| `InboxAnsweredBy` | `user` · `main` · `project` · `supervisor` · `worker` |
| `SupervisorStatus` | `active` · `closed` |

### 派生状态

| 想要 | 怎么算 |
| --- | --- |
| 任务需介入 | 存在指向它、`kind=ask`、`status=pending` 的 Inbox |
| 收件箱未读数 | `type=自己 AND status=pending` 的 count |
| 已升级的 ask | `escalations > 0` |
| Supervisor 该收工 | 关联工单全部 ∈ `{done, cancelled}` |
| 某票是不是某 Supervisor 的 | `SupervisorTicket` 有记录 |

工具矩阵见 [agents/README.md](agents/README.md#工具矩阵)，不在两处各写一遍。
