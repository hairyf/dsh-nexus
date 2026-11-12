# Nexus 数据模型

SQLite + Prisma。这份映射参考官方的 dsh-superagent（`prisma_ref_to_prototype/schema.prisma`）重写，
只保留我们自己真正需要的东西。

## 文件划分

模型按领域拆成多个文件，放在 `schema/` 里，Prisma 会把它们合成一份 schema：

| 文件 | 模型 | 说明 |
| --- | --- | --- |
| `schema/.conf.prisma` | — | 数据源与生成器（datasource / generator） |
| `schema/channel.prisma` | `Channel`、`ChannelAccount` | 渠道与账号（含渠道提示词） |
| `schema/project.prisma` | `Project` | 项目（git 仓库 + DSH 工作区） |
| `schema/thread.prisma` | `Thread`、`Trigger` | 话题与触发 |
| `schema/ticket.prisma` | `Ticket`、`TicketThread`、`TicketLink` | 任务 |
| `schema/worker.prisma` | `Worker` | 执行会话 |
| `schema/inbox.prisma` | `Inbox` | 收件箱 |
| `schema/supervisor.prisma` | `Supervisor`、`SupervisorTicket` | 临时跨项目协调者 |

拆分只影响阅读顺序，不改变生成的表结构 —— 外键可以跨文件互相引用。

## 三层架构

```
主编排（main）            全局唯一，不直接改代码，只做分诊与派活
  └─ 项目编排（project）   每个工作区一个，管本项目的任务
       └─ Worker（执行会话）    真正干活的地方；一个任务可以先后换好几个
```

官方是「主 Session → 执行器」两层；我们多一层，所以 `Inbox.type` 要区分投给谁。

## 数据怎么流动

```
渠道（Channel）产生触发（Trigger）→ 落在话题（Thread）上
  话题还没分诊  → 冒到主编排的收件箱，主编排决定这事归谁（可能顺手开任务）
  话题已分诊    → 冒到对应项目编排的收件箱，项目编排决定这是不是已有任务的新消息
任务派下去 → 项目编排建 Worker → 执行结果再冒回收件箱
```

收件箱就是「代理的未读消息」：代理随时能列（`inbox_list`），看完就删（`inbox_kill`），
会话结束时会话框架数一下 pending 的条数提示「你有 N 条消息未处理」。

官方的 `TicketInput` + `UndeliveredInput` + `Outbox` + `DispositionFanout` 那一大坨，
在我们这里合起来就是一张 `Inbox`。

## 收件箱是双向的，人类也是收件人

`Inbox.type` 记「此刻轮到谁」，取 `user` / `main` / `project` / `supervisor`。
把人类也算成一个收件人，是为了让「问人类」和「问上级」变成同一件事的不同取值，
而不是两套流程：

```
Worker ask(askTo='user')      ─▶ Inbox(type=user)       锚定一条触发，往渠道发问题
Worker ask(askTo='project')   ─▶ Inbox(type=project)    只在代理之间流转，渠道无感
超时 +「代理选择」开启         ─▶ Inbox(type=main)       就地改 type，escalations += 1
```

**升级就地改 `type`，不新建记录。** 一个问题从头到尾只有一条记录、一个身份，
任何时刻都只有一个处理者，永远不会出现两条 pending 抢同一件事。

渠道收尾只有一条规则：**只有从 `user` 升级出去的那一次，要回渠道补一句话**。
因为只有 `type = user` 意味着问题已经问出口了；没问出口的直接在代理间流转，不必打扰人。

超时检查不靠后台定时器，和「你有 N 条未处理」共用同一次会话钩子。

## 相对官方删掉的概念

不是我漏了，是故意不要：

| 删掉 | 为什么 |
| --- | --- |
| `Policy` / `Eval` / `Gate` / `Decision` / `Mandate` | 主编排自己判断，判断过程不进数据库；机器人账号本身就是被授权的身份，不再层层授权 |
| `TriggerThread` / `ThreadCorrelation` | 一条触发只属于一个话题，不做关联图 |
| `TriggerDisposition` / `Handback` / `Ack` | 去向就看 `Inbox.status`，不做单独台账 |
| `Subscription` / `Fanout` | 订阅关系就是 `TicketThread`（任务关联的话题） |
| `TicketInput` / `UndeliveredInput` / `Outbox` | 全部由 `Inbox` 一张表承担 |
| `Attention`（待人工决定） | 就是一条 `kind = ask` 的 `Inbox`，带截止时间 |
| `Effect` / `KeyValue` / `*Version*` / `SourceState` | 运行时队列与配置版本，暂时不进库 |

### 没有「需介入（attention）」状态

一张工单可以一边 `running` 一边等人 —— 把 `status` 覆盖掉会丢掉它本来跑到哪一步。
所以「需介入」是派生出来的：**存在指向它的 pending ask 就是需介入**。
面板和 `list_tasks` 用一次子查询就能得到。

## 三条书写约定

1. 时间戳一律用 ISO 8601 字符串（`String`）。SQLite 里可以按字典序比较，排序不踩时区。
2. 列表一律是子表 —— SQLite 没有数组。
3. 所有跨表引用都是真实外键 + 具名 `@relation`，`prisma migrate` 会生成约束。

## 常用命令

```bash
pnpm run prisma:generate    # 重新生成 src/database 的 Kysely 类型
pnpm run prisma:migrate     # 建迁移
npx prisma validate         # 校验
npx prisma format           # 格式化
```

`prisma-kysely` 把模型编译成 `src/database/types.ts`，`src/database/index.ts` 用它建 Kysely 实例。
枚举会生成 `export const Xxx = {...} as const` + 联合类型，可以直接当运行时常量用。