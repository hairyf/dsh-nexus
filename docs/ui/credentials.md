# 渠道账号与环境变量

## 一、结论先说

**一个渠道一个账号，全局唯一。** 不做按项目切换，不做多账号。

登录方式：**UI 里填 key 或点按钮**，不要求用户手写 shim 脚本或管目录。
凭证落到该渠道专属的配置目录，由插件在每个 Worker 启动时注入。

## 二、为什么一渠道一账号

| 方案 | 问题 |
| --- | --- |
| 一渠道一账号 | **选这个**。`PATH` 是进程级的，插一个 shim 就够 |
| 按项目切账号 | `PATH` 没法按项目区分，得在 spawn 时逐个拼 —— 复杂且脆弱 |
| 只用环境变量 token | DSH 会剥掉形似凭证的变量名，且 token 进子进程环境不安全 |

代价：同一个 GitHub 渠道下的所有项目共用同一个 bot。
自建 GitLab 用同一个 `gitlab` 渠道，把站点填进 `host` 即可 —— 不需要额外建渠道。

## 三、凭证怎么存

**不进数据库。** 数据库存的是「哪个渠道、什么账号、是否已登录」的状态：

```prisma
model ChannelAccount {
  id        String        @id
  channelId String
  role      AccountRole   // bot | admin
  name      String        // 渠道侧显示名
  status    AccountStatus @default(offline)
  ...
}
```

真凭证（token / cookie）落在**该渠道专属的配置目录**：

```
~/.nexus/credentials/github/        ← 渠道 github
~/.nexus/credentials/gitlab/
~/.nexus/credentials/feishu/
```

目录名就是 `Channel.id`，所以一渠道一账号天然成立。

## 四、登录：两种入口

### 4.1 点按钮（推荐）

```
渠道页 → GitHub 卡片 → [登录]
  → 弹出 GitHub 授权页
  → 用户点 Authorize
  → 回调拿到 token
  → 写进 ~/.nexus/credentials/github/
  → ChannelAccount.status = online
```

### 4.2 填 key

```
渠道页 → GitHub 卡片 → [填 Token]
  → 粘贴 Personal Access Token
  → 后台跑一次 `gh auth login --with-token` 验证
  → 成功写盘，失败原样返回错误
```

两条路的结果一样：一个可以用的凭证目录 + 一行 `ChannelAccount`。

**不要求用户：** 建目录、写 shim 脚本、改 PATH、设环境变量。这些插件自己做。

## 五、Worker 怎么用上这个账号

### 5.1 shim（和官方一致）

插件启动时给每个渠道生成一个 shim 目录：

```
~/.nexus/shims/github/bin/gh          ← sh
~/.nexus/shims/gitlab/bin/glab
```

内容：

```sh
#!/bin/sh
GH_CONFIG_DIR="$HOME/.nexus/credentials/github" exec gh "$@"
```

GitLab 用 `glab`，变量名是 `GLAB_CONFIG_DIR`：

```sh
#!/bin/sh
GLAB_CONFIG_DIR="$HOME/.nexus/credentials/gitlab" exec glab "$@"
```

### 5.2 注入

Worker 会话 spawn 时，PATH 前面插入**它所属渠道**的那个 shim 目录：

```
PATH = ~/.nexus/shims/<channel>/bin : 原 PATH
```

同一个 Worker 只用得上一个渠道的账号，所以 PATH 里插一个就够。

### 5.3 清掉干扰

同时清掉环境里可能覆盖身份的东西：

```
GH_TOKEN / GITHUB_TOKEN / GITLAB_TOKEN = undefined
GIT_CONFIG_GLOBAL = ~/.nexus/credentials/<channel>/gitconfig
GIT_TERMINAL_PROMPT = 0        ← 没有凭证时必须失败，不能弹交互
```

## 六、自建实例

`gitlab.com` 之外，把站点填进 `Channel.host`：

```
Channel(id='gitlab', host=null)                          → gitlab.com
Channel(id='gitlab', host='https://gitlab.corp.com')     → 自建
```

**还是同一个 `gitlab` 渠道**，不新建 id、不复制 skill —— 用法一样，只是连的站不同。

`glab` 的站点靠 `GLAB_HOST` 决定，所以 shim 里一起设：

```sh
#!/bin/sh
GLAB_CONFIG_DIR="$HOME/.nexus/credentials/gitlab" \
GLAB_HOST="<Channel.host 或 gitlab.com>" exec glab "$@"
```


## 七、这一步是护栏，不是安全边界

**必须说清楚**，否则会误以为隔离了：

> Worker 跑在操作系统的同一用户下。它可以用绝对路径 `/usr/bin/gh` 绕过 shim，
> 也可以读你的 home 目录。

真正的隔离只能靠**独立的 OS 用户**，里面只放这个 bot 的凭证。

我们要做的是：**让「默认路径」是对的**，这样 99% 的正常用法都用了 bot 身份。
不是防止有人绕过。

## 八、Worker 需要知道的信息，从哪来

**不给 Worker 灌环境变量。** 它需要的东西走 `read_channel` 从库里取：

| 需要什么 | 怎么拿 | 不用的旧方案 |
| --- | --- | --- |
| 仓库地址 | `read_channel('thread/<key>')` 返回里带 | ~~`$DSH_NEXUS_GITHUB_REPOSITORY`~~ |
| PR 号、issue 号 | 触发本身就在派工消息里 | — |
| 提交用哪个邮箱 | 渠道账号记录里的 `commitEmail` | ~~环境变量~~ |

唯一的例外是 git 提交身份，那个必须通过 gitconfig 给，走 shim 目录里的
`gitconfig` 文件，不通过环境变量。

> 所以渠道 skill 里那句 `$DSH_NEXUS_GITHUB_REPOSITORY` 要改成
> 「从 `read_channel` 的返回里取 `repository`」。

## 九、渠道 skill 要跟着改

`assets/skills/nexus-channel-github/SKILL.md` 里现在写：

```
其中 <OWNER>/<REPO> 取自执行环境的 $DSH_NEXUS_GITHUB_REPOSITORY
```

改成：

```
其中 <OWNER>/<REPO> 取自 read_channel 返回的 repository 字段
```

**理由**：环境变量是隐式的，模型看不见它有什么；`read_channel` 的返回是显式的，
模型能直接读到。

## 十、初始化流程

```
1. 首启：Setting 行不存在 → 建一行默认值
2. 渠道页：没有账号 → 显示「添加机器人账号 / 添加管理员账号」
3. 用户点登录或填 key → 凭证落盘 + ChannelAccount 落库
4. 渠道 enabled 默认 false → 用户开启后才开始轮询
5. 开启时验证：跑一次 `gh api user` 确认身份对得上
6. 验证失败 → ChannelAccount.status = offline + 渠道页显示原因
```

第 5 步很重要：**凭证能读不代表身份对**。填了别人账号的 token，
`gh api user` 会返回别人的登录名，此时应该报错而不是静默接受。
