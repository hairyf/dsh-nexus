# Nexus 宿主装配

入口通过一个 await 的 ctx.effect 激活本模块。先以 profileContext.dir/storages/nexus 打开和迁移数据库，失败直接阻止插件启动；没有 profile 时才采用 DSH_HOME。dataDir 可显式指定绝对目录。runtime、communication、GitHubChannel 与 webPanel 每个激活周期各建一个，共用同一账本。

预设定义与现有 WebServer 路由在数据初始化后注册，角色会话在宿主 appReady 后恢复。preset 的依赖审计可能等待 Loader，不能在尚未完成的宿主加载阶段启动角色。timer 必须显式 inject；Cordis 的异步 effect 必须 await，否则 setup 拒绝只清理资源而不能让插件启动失败可见。

正常启动自动创建 main，并恢复原 main/project/supervisor/worker 责任、消息及 Attention 定时器。新发现的项目默认禁用；启用项目后下一次宿主采集建立其 project 责任。只有 gateway 自身 create/resume 的可信 setup 才安装角色管理与通信工具；原生 helper、fork 和 sidechat 不按预设名称取得身份。安装前捕获原生 send_message 定义，agent_id 分支直接调用原定义，保留原上下文与回执。

热会话回执同次读取原生 snapshotEvents、inbox 和 driver 状态；冷会话才查询持久事件。原生输入被 claim 后、user/message 落账前会暂时离开 inbox，本实例成功交付的消息在 driver 活跃期间仍视为待消费，绝不计为 read。被取消而未提交的旧 claim 要等 driver 完全空闲才允许补投；这不是逐消息 claim 证明。停止或卸载清理临时交付记录，重启只重建真实持久回执。原生 resume 不自动唤醒旧 inbox；恢复确有 Nexus 输入时，以公开 remove/send 重新提交原队列尾项，保持同一 MessageId、source、队列目标及顺序，原生日志保留移除和重排队事实，不造新的恢复提示。本人解除暂停另投递给原 project 责任，不依赖别票进展偶然唤醒，也不创建替代 worker 或解除未决问题。

GitHub 环境只能通过明确选择配置启用。以下 JSON 对象作为 dsh-nexus 行的 config：

    { "github": [{ "repository": "github.com/owner/repo", "login": "selected-login", "automationIds": [] }] }

repository 必须匹配当前 Git 工作区核实的仓库，项目仍须在 Web 中显式启用。这里不保存 token、不切换 gh 账号。GitHub 每轮串行采集与消费 durable intake/outbox，通过 ctx.timeout 安排下一次调用；Reminder 由 runtime 的持久 Attention 截止时间安排，不读取 jobs.json。

Web 所有路由复用 connection.admit 对原始 Headers 的现有 Cookie、Host 与 Origin 检查。唯一 owner principal 映射为稳定 owner Actor，不从请求体读取身份。合并答复只调用 channel.preflight 只读核验，真实外部合并由 project 的 merge_pull_request 消费正式决定；目标绑定仓库、PR、base 和 head。

main 也可依据当前原生用户目标建票。list_ticket 仅对 main 投影最新 user 来源的 nativeSource；create_ticket 的 sourceMessageId 与 triggerId 严格互斥。前者必须回指当前绑定会话 snapshotEvents 中真实的 user/message，匹配内核生成的消息 ID，带非空 user RPC 标识且 principal 属性缺席。这个 owner 判定来自现有连接层与 API gateway 契约；rpcId 本身只是客户端请求标识，不是能力凭证。无 RPC 标记的 command/headless 输入不可核实，显式非 owner principal、旧消息 ID 和无来源输入均拒绝；goal/time-context 不覆盖用户来源。主体始终是绑定的 main agent，不从工具参数读取 actor/human/verified。

Native 目标可拆到已启用可用项目，原 GitHub 同仓库来源限制不放宽。工单与 native_source:<ticketId> 的原会话/消息/RPC 回指在同一已有账本事务提交；来源落账失败整个建票回滚。nexus 是宿主内部来源标识，不添加外部渠道。project、supervisor、worker/helper 不因此取得建票工具。

停止证明先保留 live root，再读取并 drain 原生 helper 树，kill 并 wait 所有相关 session-owned jobs，最后核对每个 session 的原生活动。缺 API、helper 目录诊断、未结算 job、残留活动或重启后的旧进程关联不明均返回未确认，不写 execution_stopped。卸载取消采集/提醒和入口，等待已受理宿主回调与自有 AgentHandle 结束后关闭数据库；持久工单、问题、消息和工作区保留。

正式交付完成先通过账本原有验收、策略、决定与远端事实检查，再单独退役该执行的原生写入者。管理结果显式返回 retirement；完成事实不等于写入者已关闭，缺少退役证明保留待处置事实，不释放为已确认关闭。

面板区分初始化、初始化失败、空闲、执行中、角色不可用与投递失败。GitHub 的未选择/失联/仓库要求失败沿用渠道自身的真实状态，不用空数组冒充成功。
