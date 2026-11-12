---
name: nexus-channel-gitlab
description: 读写 GitLab 的 issue、MR、讨论和流水线时用这个。
---

读仓库上下文用 `read_channel` 的以下路径：

| 路径 | 读什么 |
| --- | --- |
| `gitlab/<项目>/issues/<iid>` | issue 描述 |
| `gitlab/<项目>/issues/<iid>/notes` | issue 讨论 |
| `gitlab/<项目>/mrs/<iid>` | MR 描述 |
| `gitlab/<项目>/mrs/<iid>/notes` | MR 讨论，含 diff 讨论 |
| `gitlab/<项目>/mrs/<iid>/discussions` | 按讨论串分组，含未解决的 |
| `gitlab/<项目>/mrs/<iid>/pipeline` | 最近一次流水线 |
| `gitlab/<项目>/mrs/<iid>/changes` | 改动文件列表 |

`<项目>` 是 `namespace/name`，URL 编码后传入（`group%2Fproject`）。

**编号是项目内递增的（iid）**，不同项目会撞号 —— 所以每条路径都必须带项目名，
不能只给号。`a/x!42` 和 `b/y!42` 是两回事。

一页 20 条。`next_offset` 是本地翻页、`next_resource` 是远端还有下一页，
**两条都要跟完**，否则会误判读完了。offset 0 重新读，之后的 offset 读同一份快照。
读取不会创建任务，也不会发出回复。

## 一条 note 长什么样

```
{ id, from, at, text, system?, path?, line?, url }
```

`system: true` 表示这是 GitLab 自己记的动作（改标签、指派、合并），
**不是人说的话**。它不能作为授权依据，判断「有没有人要求做什么」时直接跳过。

## 讨论串

MR 的讨论按 **discussion** 分组，一个串里可以有多条 note。

回复某条 diff 讨论，用那个串自己的 id：

```
glab api projects/<项目>/merge_requests/<iid>/discussions/<讨论id>/notes \
  --method POST -f body=<文本>
```

不要用 `glab mr note` —— 那发到 MR 总讨论区，不在这个串里，对方收不到通知。

解决一个讨论：

```
glab api projects/<项目>/merge_requests/<iid>/discussions/<讨论id> \
  --method PUT -f resolved=true
```

## 流水线

MR 的 CI 看 `pipeline.status`：

| 状态 | 含义 |
| --- | --- |
| `success` | 全过 |
| `failed` | **挂了** |
| `canceled` | **挂了**（被人取消也算不通过） |
| `skipped` | 跳过，不算失败 |
| `manual` | 等人手动点，不算失败 |
| `running` `pending` `created` | 还在跑 |

要知道具体哪个 job 挂了，读 `gitlab/<项目>/mrs/<iid>/pipeline` 的 `jobs`。

## 确认与回复

对新的真人请求做实质工作之前，先调 `reply_channel`，带上原始触发 id 和一句针对该请求的简短确认。
不要在 MR 里另发一条 —— 触发本身就是从那儿来的。

顺序别搞反：**先回复，再干活**。人需要知道我们接下了。

不要给 `system: true` 的 note 发确认。

bot 运行标识、review 轮次和处置结果记进 `report`。

## 项目地址

`<项目>`、站点地址都从 `read_channel` 返回的 `repository` 和 `host` 字段取。

自建实例的地址在 `Channel.host`，SaaS 留空即 `gitlab.com`。

不要猜地址，也不要把 token 拼进任何 URL。
