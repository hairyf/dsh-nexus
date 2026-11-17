# 2026-11-17 集成修复与真实复验

本文件记录 Spec 06 首次真实验收（[2026-11-16-nexus-spec06.md](./2026-11-16-nexus-spec06.md)）之后的集成评审修复与复验，不替换该报告，也不改变其"已验证/未执行"边界。

## 修复范围

最终集成评审在 `ee91493` 上发现三项接线缺口，修复提交 `bb9e8ae`（合并 `a38340b`）：

- 暂停不再走终止路径：保留原 binding / session / worktree，无 failureReason；显式 resume 经真实外部核对后续接同一执行，不强制 retry 或替换 Worker。
- 依赖唤醒：账本持久 wakeup 在正常 flush 与 boot 幂等消费并投递到依赖票的 project / 关联 supervisor；成功协调完成后自动关闭临时 supervisor，取消或失败不冒充成功。
- 提醒进展：仅在已验证的有效进展上刷新 attention 并重挂计时，纯通知、重复读与空回合不算进展。

复核在 `a38340b` 上又发现三项提醒负路径，修复提交 `0751578`（合并 `9d4f615`）：

- 依赖/通知类 runtime 消息被标记 handled 不再刷新执行 attention；只有本执行已投递的证据性续接、真实 dispatch/resume/recovery 或正式答复才刷新。
- 重复的 advance_ticket ready 在 review 且无待清故障时返回原票，不更新 updatedAt/transition、不刷新提醒；真实新验收证据仍经 record_acceptance 刷新。
- 显式 paused -> resume 的排队未启动票只恢复因 human_paused 退役的 queue worker_limit 等待，不复活无关 ask/fault/human_paused 等待。

## 真实复验（a38340b，修复一）

隔离实例：DSH_HOME=/tmp/dsh-nexus-test，profile nexus-test，端口 3091，真实 magpie / auto/deepseek-flash / max。28 项真实断言通过：

- GitHub issue #10 经 main 分诊、project 派真实 Worker `adcbe9f4-7c11-4443-a994-1023abe81ea6`；owner 两次 pause 均无 failureReason 且真实 turn 被 aborted；两次 resume 保持同一 session、同一 worktree/branch，无 retry/替代 Worker，最终 done。
- 暂停期间真实 GitHub 评论与正式 ask 答复到达，均未解除人工暂停。
- 跨项目 A/B：A done 后 B 的 project 与 supervisor 各收到一条 durable wake；整实例重启与多次 host flush 后仍各一条，B 仅在依赖满足后启动。
- 主管在全部协调票成功后自动 closed（`all coordinated tickets successfully delivered`）；取消前置票的负例保持依赖不满足、dispatch 409、无 wake。
- reminderIntervalMinutes=1：ask 创建后 60s 提醒责任角色、120s 升级 human；正式回答退役旧等待且票仍 paused=1。
- 4 轮真实进展事实刷新 progressAt，连续进展窗口无 stale reminder/escalation。
- 真实浏览器连接 3091：6 tabs、0 pageerror。

原始证据（未提交，保留在测试 home）：`/tmp/dsh-nexus-test/artifacts/verify2-*.json`；issue #10 已关闭，无新增 PR/分支，3091 已停止。

## 修复二（attention 负路径）的验证边界

`0751578` 的三项负路径以真实 SQLite 账本 + runtime/management 公共接口回归验证（新增 7 例，全套 359 单测、乱序与 5 次重复通过），未在真实实例重跑这三条负路径；正向提醒与进展行为已由上述真实复验覆盖。

## 未执行

- 用户现有 3081 GUI 的部署、刷新与只读验收仍未执行（用户明确要求不动该实例）。
- workspace-write 沙箱后端在本机执行前报错；只有隔离私有 danger-full-access/never 有真实模型证据，生产默认未改。
- Windows、完整托管 CI 模型环境未执行。
- 真实复验的 GitHub 只写 issue #10（创建/评论/关闭），未新增 PR/分支。

## 最终状态

main = `9d4f615`；unit 17 文件 359 测试通过；tsc 通过；无遗留 worktree/分支/测试服务；用户唯一在跑的 3081 未改动。除宿主 read_image 工具自动导入 `~/.dsh/attachments` 截图缓存外，未改真实 profile 配置或会话。
