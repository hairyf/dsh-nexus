# 面板

五个 Tab，一条路由（`/api/nexus/*`）。面板是**监工界面**：
读为主，写只有四处 —— 暂停任务、开关渠道、标掉消息、保存设置。

## 文件

| 内容 | 位置 |
| --- | --- |
| 面板外壳、数据轮询 | `src/client/components/app.tsx` |
| 五个页面 | `overview.tsx` / `tasks.tsx` / `triggers.tsx` / `channels.tsx` / `settings.tsx` |
| 收件箱抽屉 | `inbox-panel.tsx` |
| 层级图 | `graph.tsx` |
| 复用小块 | `widgets.tsx`（卡片、状态标签、相对时间） |
| 官方组件出口 | `components/official.ts` |
| 图标 | `components/icons.tsx` |
| 客户端常量 | `client/constants.ts` |
| **请求函数** | `client/apis/`，由 `pnpm genapi` 生成，不手写 |

## 概览

上半四张统计卡：监听渠道、近 24h 触发、任务分布、需介入。

下半用 SegmentedTabs 二选一 —— 两块都不小，同时铺开会挤：

**近期任务**：`任务号 + 标题 + 项目 · 渠道 · 时间 + 状态标签`。
有 `attention` 的挂「需介入」，`error` 非空的显示「系统错误：…」。

**层级关系**：不是示意图，**节点按真实记录生成**。
几个渠道就画几个节点，几个项目就画几个。

```
渠道 ──trigger──▶ 主编排 ──dispatch──▶ 项目编排 ──delegate──▶ 任务
                                              └──supervise──▶ Supervisor
```

`attention` 节点描边高亮。四列手工布局，没引图形库：
位置只由「第几层的第几个」决定，加一个项目不用重算任何东西。

## 任务

列表 + 详情同一页，返回就是清掉 `ticketId`。

详情四块，对应四张表：

| 区域 | 表 | 说明 |
| --- | --- | --- |
| 触发来源 | `TicketThread` | 这张票是从哪些话题来的 |
| 执行记录 | `Worker` | 分支、汇报、后台占槽、恢复提示 |
| 关联任务 | `TicketLink` | 依赖与相关 |
| 消息 | `Inbox` | 这张票下的投递记录 |

顶栏有两个按钮：`PR`（有 `prUrl` 才显示）和 `暂停`。
**暂停在详情里，不在设置里** —— 它是单票的运行状态。

## 触发

左话题、右触发。话题上的 `triage` 是唯一要看的判断：

| `triage` | 意思 |
| --- | --- |
| `pending` | 还没判 |
| `claimed` | 已认领给某个项目，之后它的触发直接进那个项目 |
| `ignored` | 不用管 |

**一条话题只判一次**，不是每条触发判一次。

## 渠道

一渠道一账号。卡片显示：监听状态、账号在线数、项目数、话题数、
最后读取时间、游标数。

`host` 只对 GitLab 显示 —— 自建实例和 SaaS 用同一个 `gitlab` 渠道。
凭证不在库里，这里只显示「已登录 / 未登录」（见 `docs/ui/credentials.md`）。

## 设置

全部是**全局**配置（`Setting` 单行）。分四组，每项有取值范围，
保存时服务端会夹到合法区间。

并发那组有一句必须写清楚的话：
超出上限后新任务留 `queued`，但**额外留 1 个槽位给「人的消息」**，
所以人派活永远挤不掉已经在做的事。

## 收件箱

右侧抽屉，按**收件人**分组（人 / 主编排 / 项目编排 / Supervisor），
因为消息的本体就是「此刻轮到谁」。

一条消息左边有个勾选圈，点一下即标掉 —— 和官方 todo 一样，不二次确认。

`stalled` 单独一栏放在最后。它不是「没轮到」，是「送不到」，
混进未读会让人以为消息还在排队。

## 样式

### 颜色：直接引 `--dsw-*`，不定义 `@theme`

组件里写 `bg-[var(--dsw-alias-bg-layer-1)]` 这种**任意值**形式，不写
`bg-nx-layer-1` 再在 CSS 里转一层。

**这不是偏好，是必须。** `dsh-taiwind` 合并多插件样式时只带 utility，
不带 `@theme` 里的变量定义 —— 于是 `--color-nx-*` 在运行时是空值，
`var()` 落空导致整条声明失效：边框变成 **0px**、背景变成透明。
排查时表现为「卡片看起来没有边框」，很难往变量上想。

直接引 `--dsw-*` 之后只有一个间接层，宿主换主题时颜色跟着变。

### 三个工具类

`nx-card`（分区）、`nx-node`（层级图节点）、`nx-scroll`（滚动条）。
它们的内部同样直接引 `--dsw-*`。

### 宿主没加载 Preflight

它不重置宿主界面，所以面板里要自己收掉浏览器默认样式：

| 元素 | 不收会怎样 |
| --- | --- |
| `ul` | 卡片里出现一排圆点 |
| `p` | 每行说明被 1em 段距撑成两倍高 |
| `button` | 纯文本行标题被画成输入框 |

都在 `main.css` 的 `.nx-root` 下，只在面板内生效，不外溢到宿主。

### 缓存

`dsh-taiwind` 把编译结果缓存在 `~/.dsh/taiwind/styles.css`。
改了 `main.css` 但界面没反应时，删掉这个目录再启一次。

组件一律从 `components/official.ts` 取，不直接 `import '@deepseek-ai/*'` ——
换版本时只改一个文件。

## 加一个 Tab

1. `src/constants.ts` 的 `TABS` 加一项
2. `src/client/constants.ts` 的 `TAB_LABELS` 补展示名
3. `src/server/routes/` 加 handler，`src/server/index.ts` 加一行 `app.get`
4. `pnpm genapi` 重新生成请求函数
5. `src/client/components/app.tsx` 的 `switch` 加一个分支

顺序别反：先有接口再画页面，否则会写出「请求 404 但界面正常」。
