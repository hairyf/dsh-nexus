# Nexus Web 边界（Spec 05）

本模块不启动服务器、数据库、角色或 GitHub 采集。Spec 06 用同一个已打开账本和已有服务创建 `webPanel.create(database, ports)`，再用 `server(ctx, { panel, owner })` 激活现有宿主 WebServer，保存返回的 disposer。不要另外监听端口。

## 06 的接线

`WebPorts` 与响应 DTO 在 `src/types/web.ts`。端口必须来自当前宿主实例，不能从浏览器请求构造：

- `runtime`：02 的 dispatch / pause / cancel / retry / projectChanged；派工只是受理。暂停与取消同时返回实际停止结果，未确认停止仍要保留旧执行责任。
- `communication`：03 的同一实例 answer；Web 只传 askId、当前 policyBasis、answer、selections 和看见的 target。不自行写 Ask 或发送第二份答案。
- `verifyMerge`：必填的 04 可信 MergeVerifier。每次 allow_merge 前重新核验实际 PR/head/base、CI 与仓库保护，返回当前 target 和 verified。目标必须仍等于用户看到的目标。不可用时明确拒绝；不能调用会执行远端合并的 merge 来冒充只读核验，不能默认 true。05 随后交由 03 结清问题，不执行合并。
- `githubStatus(projectId)`：04 的 GitHubChannel.status，仅读持久状态。包含已送达评论后来更新失败的 delivery_status，不能只看 Outbox.sent；05 将它显示为同步问题，不重新提问。
- `discoverProjects()`：当前宿主已登记 Git 工作区的核实发现结果 ProjectInput[]；非 Git、无 remote、失联工作区不能作为可用新项目返回。workspaceId 是稳定身份。05 自行保留原项目 ID、启用选择及失联历史，新项目沿用账本的默认禁用，不从显示名猜仓库。
- `sourceContext(sessionId)`：通过宿主 sessionQuery 读取对应原会话最近有效事件，保留原始文本、事件来源与时间。预期缺失返回 available=false 和实际原因；不要把摘要当原始事实，不重放完整历史。05 最多返回最近 8 条，卡片先显示 3 条，更多背景按需展开。读失败不阻止回答持久 Ask。
- `reconcileExternal(ticketId, signal)`：02 retry 所需的 04/06 外部副作用核实，只能在真正核实后返回 verified；结果未知返回 unknown，不补造安全证明。

`owner(event)` 由已认证宿主入口提供当前浏览器 owner 的 Web Actor；未认证返回 null。所有读写都经过这个入口，带 Origin 的请求还核对当前来源。请求体不能携带 actor、userId 或 verified。这里不新增认证系统，也不读取凭证。

## HTTP

REST 路由挂载在现有宿主的 `/api/nexus`。客户端通过官方 Connection exact Fetch 入口 `POST /api/nexus/dispatch` 携带 `{ path, method, body }`，由相同 H3 路由处理；动态资源与 PATCH 无需为每个会话注册载体路由。身份由宿主认证，信封不能提供 actor 或身份信息。

| 方法与资源 | 消费方与行为 |
| --- | --- |
| GET /panel | 所有页面共用的真实项目/工单/编排图/本人信箱/话题/渠道/设置快照 |
| GET /tickets/:id | 执行历史、来源、依赖、验收、消息与 Ask 详情 |
| PATCH /tickets/:id | questionLevel、mergePolicy、reason，仅改本票快照 |
| POST /tickets/:id/pause、resume、cancel、retry、dispatch | 显式管理决定，reason；保留 02 的实际结果 |
| POST /asks/:id/answers | 正式答复；竞争失败返回 accepted=false 与原生效答案，不覆盖 |
| PATCH /projects/:id | enabled；调用 01 保存选择，调用 02 处理禁用项目的现有执行 |
| POST /projects/refresh | 空对象；核实发现并保留历史，不静默启用 |
| PATCH /settings | 01 的全局默认、白名单、并发、后台/投递/提醒参数 |
| GET /sessions/:id/context | 已登记来源会话的有界近期上下文 |
| GET /sessions/:id/mailbox | 当前未归档角色会话的通用 Inbox 信件；未绑定或归档会话返回 inactive |
| POST /sessions/:id/mailbox/:messageId/handled | 明确确认处理当前邮箱中的信件 |

路由只解析/校验 DTO 并调用领域服务。未知字段拒绝，错误保留可区分的 HTTP 状态和领域 code；读取使用 no-store。唯一真源是 01 的账本和 04 既有持久状态；没有 Web 专用数据库、迁移或并行问答状态。

## 客户端

沿用 main/sidebar 席位、主题令牌、面板密度和详情导航。默认打开概览，面板不提供信箱 Tab；本人待答问题保留在工单页面。Agent 信箱注册在官方 `conversation.input.dock`，使用 TodoPanel 的布局与主题参数；展开和查看信件不确认处理。代理内部 pending 不自动成为本人待办，真正升级给人的提醒仍归原 askId。全局策略只影响新票；本票策略另行编辑。

客户端通过同源相对地址读取，保留宿主挂载路径；桌面载体和 Web 使用相同 dispatch 入口。初次、手动刷新、焦点恢复、online 与宿主 connection/reset 都重新对账；可见且上次读取成功时每 15 秒更新当前事实，读取失败停止自动刷新并给出恢复操作。过期读响应不会覆盖较新的快照。所有请求 15 秒超时，不用无限 spinner 隐藏错误。表单提交有同步重复提交锁，失败保留草稿，服务器已生效答案使操作控件撤下。

侧聊复用 [better-sidebar 0.32.0 的客户端 API](https://github.com/omdsh-dev/DSH-better-sidebar/blob/v0.32.0/src/client/service.ts)：先核对可选服务的 getTab/isTabEnabled，再用 uiWorkspace.openSession 打开来源，调用 openTab({ type: 'sidechat' }, { sessionId })。不使用当前焦点替代来源，不新增 preset/权限/同步协议，不回答或结清 Ask。该 API 返回 void，界面只宣称请求打开；来源不可用或入口失败显示原因，并提供原会话恢复入口。

## 验证边界

单测使用工作树 .temp 的真实临时 SQLite、01/02/03 服务、04 的真实 status 和无网络原生端口，以及 H3.fetch 的受控已认证请求。没有假 Web 后端，没有真实 GitHub/凭证访问，没有拉起 DSH 或构建。

现有 unit 项目是 Node 环境，没有组件 DOM 测试框架。本次只验证客户端 sidechat 服务的实际调用契约，不声称组件/浏览器通过。深浅主题、窄屏、完整键盘/焦点路径、真正打开来源侧聊、真实宿主认证和重连验收由 Spec 06 在同一 GUI 中完成。
