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

| 层级 | 文件 | 职责 |
|------|------|------|
| 类型 | `packages/shared/src/types/wps.ts` | 配置/状态/IPC 常量 |
| 主进程 | `apps/electron/src/main/lib/wps-config.ts` | `~/.tagent/wps.json` 持久化 + 密钥加密 |
| 主进程 | `apps/electron/src/main/lib/wps-crypto.ts` | 事件签名、AES 解密、KSO-1 |
| 主进程 | `apps/electron/src/main/lib/wps-oauth.ts` | OAuth2 token 缓存与并发去重 |
| 主进程 | `apps/electron/src/main/lib/wps-message-parser.ts` | 文本消息解析、@Bot 识别 |
| 主进程 | `apps/electron/src/main/lib/wps-bridge.ts` | HTTP 回调 + Agent 路由 + 回发 |
| 主进程 | `apps/electron/src/main/index.ts` | `registerBridge` 自动启停 |
| 主进程 | `apps/electron/src/main/ipc.ts` | WPS IPC 处理器 |
| 渲染 | `apps/electron/src/renderer/components/settings/WpsSettings.tsx` | 配置 UI |
| 渲染 | `apps/electron/src/renderer/components/settings/BotHubSettings.tsx` | 远程 Hub 卡片 |
| 渲染 | `apps/electron/src/renderer/atoms/wps-atoms.ts` | 连接状态 |
| 渲染 | `apps/electron/src/renderer/main.tsx` | `WpsInitializer` |
| Preload | `apps/electron/src/preload/index.ts` | `window.electronAPI` 暴露 |

## 配置说明

持久化路径：`~/.tagent/wps.json`（开发模式 `~/.tagent-dev/wps.json`）

| 字段 | 说明 |
|------|------|
| `enabled` | 是否启用并自动启动 Bridge |
| `appId` | WPS 应用 ID |
| `secretKey` | 应用密钥（safeStorage 加密存储） |
| `encryptKey` | 事件解密密钥（可选，默认用 secretKey） |
| `apiUrl` | 默认 `https://openapi.wps.cn` |
| `callbackPort` | 本地监听端口，默认 `19086` |
| `callbackPath` | 回调路径，默认 `/open/receive` |
| `defaultWorkspaceId` | IM 内 `/workspace` 切换后持久化的工作区 |

## 开放平台配置步骤

1. 登录 [WPS 开放平台](https://open.wps.cn/) 创建应用
2. 获取 App ID、Secret Key、Encrypt Key（如有）
3. 订阅事件：`kso.app_chat.message`
4. 配置回调 URL：`https://<你的公网域名>/open/receive`
5. 开发阶段用内网穿透将公网请求转发到 `http://127.0.0.1:19086/open/receive`

### Challenge 验证

```bash
curl -s "http://127.0.0.1:19086/open/receive?challenge=test_123"
# 预期: {"challenge":"test_123"}
```

### OAuth 验证

```bash
curl -s -X POST https://openapi.wps.cn/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=<appId>&client_secret=<secretKey>"
```

## IM 内可用命令

通过 `BridgeCommandHandler` 与微信/钉钉一致：

- `/help` `/new` `/list` `/switch` `/stop`
- `/workspace` `/model` `/now`

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
