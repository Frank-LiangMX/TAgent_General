# 2026-06-16 WPS 协作远程连通落地说明

## 目标

将 WPS 协作（WPS365）作为 TAgent 的**远程连通**入口接入现有 Bridge 体系（与飞书/钉钉/微信同级），做到：

- 设置 → 远程 → WPS 协作：配置 App 凭证
- 测试 OAuth 连接、启动/停止本地回调 Bridge
- 接收 WPS 消息事件并路由到 Agent
- Agent 回复通过 WPS API 回发

参考实现：[openclaw-channel-xiezuo](https://github.com/hornbillw/openclaw-channel-xiezuo)

## 架构

```
WPS 用户 → WPS 开放平台 → 公网回调（需反代/穿透）→ TAgent 本地 HTTP Bridge
                                                      ↓
                                              BridgeCommandHandler
                                                      ↓
                                              runAgentHeadless
                                                      ↓
WPS 用户 ← WPS /v7/messages/create ← OAuth + KSO-1 签名 ← Agent 回复
```

与 OpenClaw 插件的差异：TAgent 不依赖 `openclaw/plugin-sdk`，而是在 Electron 主进程内自建 HTTP 回调服务，并复用 `BridgeCommandHandler` 统一命令与会话路由。

## 已落地文件

| 层级    | 文件                                                                | 职责                                   |
| ------- | ------------------------------------------------------------------- | -------------------------------------- |
| 类型    | `packages/shared/src/types/wps.ts`                                  | 配置/状态/IPC 常量                     |
| 主进程  | `apps/electron/src/main/lib/wps-config.ts`                          | `~/.tagent/wps.json` 持久化 + 密钥加密 |
| 主进程  | `apps/electron/src/main/lib/wps-crypto.ts`                          | 事件签名、AES 解密、KSO-1              |
| 主进程  | `apps/electron/src/main/lib/wps-oauth.ts`                           | OAuth2 token 缓存与并发去重            |
| 主进程  | `apps/electron/src/main/lib/wps-message-parser.ts`                  | 文本消息解析、@Bot 识别                |
| 主进程  | `apps/electron/src/main/lib/wps-bridge.ts`                          | HTTP 回调 + Agent 路由 + 回发          |
| 主进程  | `apps/electron/src/main/index.ts`                                   | `registerBridge` 自动启停              |
| 主进程  | `apps/electron/src/main/ipc.ts`                                     | WPS IPC 处理器                         |
| 渲染    | `apps/electron/src/renderer/components/settings/WpsSettings.tsx`    | 配置 UI                                |
| 渲染    | `apps/electron/src/renderer/components/settings/BotHubSettings.tsx` | 远程 Hub 卡片                          |
| 渲染    | `apps/electron/src/renderer/atoms/wps-atoms.ts`                     | 连接状态                               |
| 渲染    | `apps/electron/src/renderer/main.tsx`                               | `WpsInitializer`                       |
| Preload | `apps/electron/src/preload/index.ts`                                | `window.electronAPI` 暴露              |

## 配置说明

持久化路径：`~/.tagent/wps.json`（开发模式 `~/.tagent-dev/wps.json`）

| 字段                 | 说明                                    |
| -------------------- | --------------------------------------- |
| `enabled`            | 是否启用并自动启动 Bridge               |
| `appId`              | WPS 应用 ID                             |
| `secretKey`          | 应用密钥（safeStorage 加密存储）        |
| `encryptKey`         | 事件解密密钥（可选，默认用 secretKey）  |
| `apiUrl`             | 默认 `https://openapi.wps.cn`           |
| `callbackPort`       | 本地监听端口，默认 `19086`              |
| `callbackPath`       | 回调路径，默认 `/open/receive`          |
| `defaultWorkspaceId` | IM 内 `/workspace` 切换后持久化的工作区 |

## 完整配置流程

### 1. WPS 开放平台申请应用

1. 登录 [WPS 开放平台](https://open.wps.cn/)（需企业认证的 WPS365 账号）
2. 进入「应用管理」→「创建应用」→ 选择「企业自建应用」
3. 填写应用基本信息（名称、Logo、描述）
4. 在「凭证与基础信息」获取三个关键凭证：
   - **App ID** — 应用唯一标识
   - **Secret Key** — 应用密钥（用于 OAuth 取 token + 事件解密）
   - **Encrypt Key** — 事件签名密钥（可选，与 Secret Key 不同时使用）
5. 在「事件订阅」订阅事件：`kso.app_chat.message`（应用消息接收）
6. 在「应用能力」开启「机器人」能力
7. 在「应用发布」提交审核（企业自建应用通常即时生效）

### 2. 配置公网回调 URL

WPS 开放平台要求**公网可达**的回调地址，TAgent 本地监听 `http://127.0.0.1:19086/open/receive`，需要中间层把公网请求转发到本地。三种方案：

#### 方案 A：内网穿透（开发推荐）

```bash
# ngrok
ngrok http 19086
# 拿到 https://xxxx.ngrok-free.app

# cloudflared（无需注册）
cloudflared tunnel --url http://127.0.0.1:19086
# 拿到 https://xxxx.trycloudflare.com
```

把穿透地址 + `/open/receive` 填入 WPS 开放平台回调配置：
`https://xxxx.ngrok-free.app/open/receive`

#### 方案 B：反向代理（生产推荐）

Nginx/Caddy 反代到本地：

```nginx
# Nginx 示例
location /open/receive {
    proxy_pass http://127.0.0.1:19086;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

服务器需公网可达 + HTTPS 证书。最终回调 URL：`https://your-domain.com/open/receive`

#### 方案 C：本地直连（仅本机调试）

仅当 WPS 开放平台支持配置 `127.0.0.1` 时可用，生产环境不可用。

### 3. TAgent 设置页配置

1. 启动 TAgent → 设置 → 远程协作 → WPS 协作
2. 填入凭证：
   - **App ID** — 与开放平台一致
   - **Secret Key** — 与开放平台一致（safeStorage 加密落盘）
   - **Encrypt Key** — 与开放平台一致（可选）
3. 启用开关
4. 点击「保存」 → WPS Bridge 自动启动
5. 状态卡片显示「已连接」+ 回调 URL（`http://127.0.0.1:19086/open/receive`）

### 4. 配置 Agent 渠道与默认工作区

WPS Bridge 路由消息到 Agent 时，需要知道用哪个渠道（模型凭证）和工作区：

1. **设置 → 渠道**：确保至少有一个可用渠道（如 kscc 内网、DeepSeek、智谱等 anthropic 兼容协议）
2. **设置 → 远程协作 → WPS 协作 → 默认工作区**：选择 Agent 工作目录（Agent 在该目录内读写文件）
3. **设置 → 应用设置 → Agent 渠道**：选择 IM 消息默认使用的渠道
   - 未配置时所有消息回 "请先在 TAgent 设置中选择 Agent 渠道"

### 5. 首次测试

#### 在 WPS 内测试

1. 在 WPS365 中找到你的 Bot（应用管理 → 机器人 → 添加到会话）
2. 单聊或群聊 @bot 发送 `你好`
3. 几秒后应收到 Agent 回复

#### 斜杠命令清单

WPS 内可用的 IM 命令（与飞书/微信一致）：

| 命令 | 用途 |
|---|---|
| `/help` | 查看可用命令 |
| `/new` | 新建会话 |
| `/list` | 列出当前绑定工作区的会话 |
| `/switch` | 切换会话 |
| `/stop` | 停止当前任务 |
| `/now` | 查看当前会话状态 |
| `/workspace` | 切换工作区 |
| `/model` | 切换模型 |
| `/kanban list` | 列出进行中的看板 |
| `/kanban pause <看板ID>` | 暂停看板 |
| `/kanban resume <看板ID>` | 继续看板 |
| `/kanban status <看板ID>` | 查看看板状态 |

群聊需 @机器人 才会触发（`mentions.identity.type === "app"`）。

#### 开发调试验证

```bash
# Challenge 验证（回调服务是否可达）
curl -s "http://127.0.0.1:19086/open/receive?challenge=test_123"
# 预期: {"challenge":"test_123"}

# OAuth 验证（凭证是否正确）
curl -s -X POST https://openapi.wps.cn/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=<appId>&client_secret=<secretKey>"
# 预期: {"access_token":"...","expires_in":7200}
```

## 常见问题排查

| 现象 | 原因 | 解决 |
|---|---|---|
| 状态始终「未连接」 | 凭证错或端口被占用 | 检查 App ID/Secret Key 与开放平台一致；`lsof -i:19086` 确认端口空闲 |
| WPS 发消息无响应 | 公网回调未通 | ngrok/cloudflared 确认在线；回调 URL 路径末尾必须是 `/open/receive` |
| 回 "请先在 TAgent 设置中选择 Agent 渠道" | 未配置 Agent 渠道 | 设置 → 应用设置 → Agent 渠道 选择可用渠道 |
| 回 "WPS 回发失败: HTTP 401" | KSO-1 签名错或 token 过期 | 重新保存配置触发 token 刷新；确认 Secret Key 与开放平台一致 |
| 回 "WPS 回发失败: HTTP 404" | 回调 URL 路径错 | 检查 WPS 开放平台回调配置末尾是否为 `/open/receive` |
| 群聊 @bot 无响应 | @识别失败或事件未订阅 | WPS 开放平台确认订阅 `kso.app_chat.message`；确认 Bot 在群内 |
| 重启 TAgent 后绑定丢失 | 内存态绑定（已知限制） | 重新给 Bot 发消息即可重建会话 |
| 看板任务完成未收到通知 | 看板 originBridge 不是 'wps' | 确认 Agent 调 `createBoard` 时传入了 `originBridge='wps'`（看板创建后无法修改） |
| 通知内容显示为纯文本 | WPS API 不支持卡片（已知限制） | 用 emoji 模拟视觉层次（📋▶️✅⚠️🎉） |

## 看板通知机制

WPS 渠道的看板通知已完整实现（与飞书同级），无需额外配置：

- **写入 origin**：Agent 调 `createBoard` 工具时自动写入 `originBridge='wps'` + `originChatId=当前chatId`
- **触发时机**：`kanban-dispatcher.ts` 在任务完成/全部完成时调用 `notifyTaskDone` / `notifyBoardCompleted`
- **路由机制**：通知服务读 `board.originBridge` 路由到 `wpsBridge.sendTextToChat`
- **格式限制**：WPS `/v7/messages/create` 仅支持纯文本，用 emoji + 分段模拟卡片效果

支持的里程碑：

| 里程碑 | 触发状态 | 备注 |
|---|---|---|
| `board_created` | 便捷函数已实现，**当前无调用方** | 待产品决策是否在创建看板时触发 |
| `task_started` | 默认不推送 | 避免刷屏 |
| `task_done` | ✅ 已触发 | `kanban-dispatcher.ts:497` |
| `task_blocked` | 便捷函数已实现，**当前无调用方** | 待产品决策是否在任务阻塞时触发 |
| `board_completed` | ✅ 已触发 | `kanban-dispatcher.ts:385` |



## IM 内可用命令

通过 `BridgeCommandHandler` 与微信/钉钉一致（详见上方「5. 首次测试 → 斜杠命令清单」）。

群聊需 @机器人 才会触发（`mentions.identity.type === "app"`）。

## 测试

```bash
bun test apps/electron/src/main/lib/wps-bridge.test.ts
```

覆盖：事件签名校验、消息解析、@Bot 识别。

## 当前限制（MVP）

- 仅文本消息主链路；图片/文件未落盘注入会话
- 回调默认绑定 `127.0.0.1`，生产需反代或穿透
- 无流式卡片（飞书专属能力），回复为纯文本
- 绑定不跨进程持久化（重启后 chat 绑定在内存重建）

## 下一步

1. 媒体消息下载 + `bridge-attachment-utils` 注入
2. 绑定持久化（`~/.tagent/wps-bindings.json`）
3. 设置页增加「公网回调 URL」字段（与本地端口分离）
4. 卡片消息与富文本完整解析
