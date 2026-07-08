# WPS365 CLI 集成设计文档

> 日期：2026-07-08
> 状态：技术验证完成，集成待实施

## 目标

将 WPS365 CLI 作为 TAgent 的主动调用层，让 Agent 能够主动调用 WPS API（发送消息、创建日历、管理文档等），与 WPS Bridge 形成互补：

- **WPS Bridge**：接收消息 + 被动回复（WPS → TAgent）
- **WPS CLI**：主动调用 API（TAgent → WPS）

## 一、WPS365 CLI 简介

### 1.1 项目定位

[WPS365 CLI](https://github.com/wps365-open/cli) 是 WPS 官方提供的命令行工具，面向开发者与 AI Agent 的命令行入口。

### 1.2 核心能力

| 业务域 | 命令数 | 主要功能 |
|--------|:------:|----------|
| 日历 | 25 | 日程 CRUD、会议室管理、忙闲查询 |
| 即时通讯 | 15 | 消息发送/撤回、群聊管理 |
| 通讯录 | 5 | 用户查询、部门列表 |
| 邮箱 | 8 | 邮件管理、发送草稿 |
| 云文档 | 21 | 文件 CRUD、版本管理、分享链接 |
| 多维表 | 14 | 数据表/记录管理 |
| 会议 | 13 | 会议管理、录制与纪要 |

### 1.3 技术特点

- **认证**：OAuth 2.0，支持 delegated（用户授权）和 app（应用身份）两种模式
- **Token 管理**：自动刷新 + 401 透明重试 + 并发安全文件锁
- **凭证安全**：macOS/Windows 用系统钥匙串，Linux 用 AES-256-GCM 加密文件
- **输出格式**：json / yaml / table / csv / tsv / ndjson + 内置 jq
- **版本**：v0.2.0（2026-06-29）

### 1.4 与 WPS Bridge 的关系

| 维度 | WPS Bridge | WPS CLI |
|---|---|---|
| 数据流向 | WPS → TAgent（接收消息） | TAgent → WPS（主动调用） |
| 触发方式 | 用户在 WPS 发消息触发 | Agent 主动执行后推送 |
| 典型场景 | "用户在 WPS 问问题，Agent 回复" | "Agent 完成任务后通知用户" |
| 凭证 | App ID + Secret Key | 同一套凭证 |
| 配置复杂度 | 高（需公网回调） | 低（仅需 App 凭证） |

**结论**：两者互补，不重复。Bridge 处理"用户触发"的对话，CLI 处理"Agent 主动"的通知和 API 调用。

## 二、前置准备

### 2.1 WPS365 企业环境

- 需要 **WPS365 企业账号**
- 需要在 [WPS 开放平台](https://open.wps.cn/) 创建企业自建应用
- 需要企业管理员审批权限申请

### 2.2 权限申请清单

#### 第一批：基础权限（必申请）

| Scope | 名称 | 用途 |
|---|---|---|
| `kso.user_base.read` | 用户基础信息读取 | 获取当前用户身份 |
| `kso.contact.user.read` | 用户读取 | 查询企业通讯录 |
| `kso.contact.department.read` | 部门读取 | 获取部门列表 |

#### 第二批：IM 消息（主动推送核心）

| Scope | 名称 | 用途 |
|---|---|---|
| `kso.im.message.send` | 发送消息 | 主动推送到用户私聊或群聊 |

#### 第三批：日历（按需申请）

| Scope | 名称 | 用途 |
|---|---|---|
| `kso.calendar.read` | 日历读取 | 查询日程 |
| `kso.calendar.write` | 日历写入 | 创建/修改日程 |
| `kso.calendar.freebusy.read` | 忙闲查询 | 查询用户空闲时间 |

#### 第四批：云文档/多维表（按需申请）

| Scope | 名称 | 用途 |
|---|---|---|
| `kso.drive.file.read` | 文件读取 | 搜索文档 |
| `kso.drive.file.write` | 文件写入 | 上传/移动文件 |
| `kso.drive.share.write` | 分享链接创建 | 生成分享链接 |
| `kso.dbsheet.read` | 多维表读取 | 查询数据 |
| `kso.dbsheet.write` | 多维表写入 | 写入数据 |

#### 第五批：会议（按需申请）

| Scope | 名称 | 用途 |
|---|---|---|
| `kso.meeting.read` | 会议读取 | 查询会议列表、录制 |
| `kso.meeting.write` | 会议写入 | 创建/更新会议 |

#### 最简清单（第一批就申请这个）

如果不确定，先申请这些就够了：

```
kso.user_base.read
kso.contact.user.read
kso.contact.department.read
kso.im.message.send
```

### 2.3 权限申请流程

1. 登录 [WPS 开放平台](https://open.wps.cn/)
2. 进入「应用管理」→「创建应用」→ 选择「企业自建应用」
3. 在「权限管理」搜索并添加需要的 Scope
4. **关键**：申请权限后必须创建版本并提交发布
   - 版本管理 → 创建版本 → 填写说明 → 申请发布
5. 企业管理员在 [work.wps.cn](https://work.wps.cn) → 应用审核 中审批

### 2.4 通讯录「可用范围」配置

审批通过后，企业管理员还需要配置应用的「可用范围」：

```
work.wps.cn → 应用管理 → 找到你的应用 → 通讯录权限 → 配置「可用范围」
```

可选：
- **全部员工**：应用可访问整个企业的通讯录
- **指定部门/员工**：只开放部分范围

## 三、CLI 安装与配置

### 3.1 下载 CLI 二进制

#### Windows x64（推荐）

```powershell
$dl = "$env:USERPROFILE\.tagent\wps-cli"
New-Item -ItemType Directory -Force -Path $dl | Out-Null
Invoke-WebRequest -Uri "https://github.com/wps365-open/cli/releases/download/v0.2.0/wps365-cli-x86_64-pc-windows-gnu.zip" -OutFile "$dl\wps365-cli.zip"
Expand-Archive -Path "$dl\wps365-cli.zip" -DestinationPath $dl -Force
Remove-Item "$dl\wps365-cli.zip"

# 验证安装
& "$dl\wps365-cli.exe" --version
```

#### macOS Intel

```bash
dl="$HOME/.tagent/wps-cli"
mkdir -p "$dl"
curl -L "https://github.com/wps365-open/cli/releases/download/v0.2.0/wps365-cli-x86_64-apple-darwin.tar.gz" -o "$dl/wps365-cli.tar.gz"
tar -xzf "$dl/wps365-cli.tar.gz" -C "$dl"
rm "$dl/wps365-cli.tar.gz"
$dl/wps365-cli --version
```

#### macOS Apple Silicon (M1/M2)

```bash
dl="$HOME/.tagent/wps-cli"
mkdir -p "$dl"
curl -L "https://github.com/wps365-open/cli/releases/download/v0.2.0/wps365-cli-aarch64-apple-darwin.tar.gz" -o "$dl/wps365-cli.tar.gz"
tar -xzf "$dl/wps365-cli.tar.gz" -C "$dl"
rm "$dl/wps365-cli.tar.gz"
$dl/wps365-cli --version
```

#### Linux

```bash
dl="$HOME/.tagent/wps-cli"
mkdir -p "$dl"
curl -L "https://github.com/wps365-open/cli/releases/download/v0.2.0/wps365-cli-x86_64-unknown-linux-gnu.tar.gz" -o "$dl/wps365-cli.tar.gz"
tar -xzf "$dl/wps365-cli.tar.gz" -C "$dl"
rm "$dl/wps365-cli.tar.gz"
chmod +x "$dl/wps365-cli"
$dl/wps365-cli --version
```

### 3.2 CLI 版本说明

| 版本 | 发布日期 | 说明 |
|------|---------|------|
| v0.2.0 | 2026-06-29 | 当前稳定版，Breaking Changes 较多 |
| v0.1.0 | 2026-05-20 | 初始版本 |

**注意**：v0.2.0 有较多 Breaking Changes（命令从复数改单数、auth 命令变更等），建议锁定版本使用。

### 3.3 环境变量配置

CLI 支持两种认证模式：

#### App 模式（推荐，用于 AI Agent）

无需用户交互，适合自动化场景：

```bash
export WPS365_CLIENT_ID="<AppID>"
export WPS365_CLIENT_SECRET="<SecretKey>"
export WPS365_OUTPUT="json"
export WPS365_QUIET="1"
```

#### Delegated 模式（需要浏览器授权）

```bash
wps365-cli auth setup  # 配置凭证
wps365-cli auth login --scopes "kso.user_base.read,kso.calendar.read"  # 浏览器授权
```

### 3.4 凭证获取位置

在 WPS 开放平台「凭证与基础信息」页面：
- **App ID**：格式 `wpa_xxxxxxxx`
- **Secret Key**：点击「查看」获取

## 四、验证测试

### 4.1 验证 CLI 安装

```bash
wps365-cli --version
# 预期输出：wps365-cli version 0.2.0
```

### 4.2 验证凭证配置

```bash
# 设置凭证
export WPS365_CLIENT_ID="你的AppID"
export WPS365_CLIENT_SECRET="你的SecretKey"

# 测试用户列表
wps365-cli user list --status active
# 预期：{"code": 0, "data": {"items": [...], ...}}
```

### 4.3 验证各业务域

#### 日历

```bash
wps365-cli calendar list
# 预期：返回日历列表
```

#### IM 发送

```bash
# 查看帮助
wps365-cli im messages send --help

# 发送消息（需要接收人的 user_id 或 chat_id）
wps365-cli im messages send --to <user_id> --text "测试消息"
```

#### 云文档

```bash
wps365-cli drive file list
# 预期：返回云文档文件列表
```

#### 多维表

```bash
wps365-cli dbsheet sheet list
# 预期：返回多维表列表
```

### 4.4 常见错误排查

| 错误 | 原因 | 解决方案 |
|---|---|---|
| `401 Unauthorized: incorrect client secret` | SecretKey 错误 | 检查 SecretKey 是否正确，注意不要有多余空格 |
| `403 Forbidden` | 权限未生效 | 确认权限已审批通过，并已配置「可用范围」 |
| `items: []`（空列表） | 通讯录范围未配置 | 企业管理员在 work.wps.cn 配置「可用范围」 |

## 五、集成方案设计

### 5.1 架构定位

```
Footprint Ladder:
Level 1: 扩展已有代码 ❌
Level 2: Skill          ❌（跨会话持久化场景不适合）
Level 3: MCP Server      ✅（按需加载，隔离性强）
Level 4: Service Tool   ❌
Level 5: Plugin         ❌（过重）
Level 6: Core Tool     ❌（违反约束）
```

### 5.2 凭证复用策略

TAgent 已有 WPS Bridge 配置（App ID + Secret Key），CLI 复用同一套凭证：

```
TAgent 设置页（WPS 协作）
       ↓
  wps.json（加密存储 via safeStorage）
       ↓
  ├─ WPS Bridge 直接读取
  └─ WPS CLI 转换为环境变量调用
```

### 5.3 封装层设计

#### 自动下载 CLI

首次调用时自动下载对应平台的 CLI 二进制：

```typescript
// apps/electron/src/main/lib/wps-cli-downloader.ts
const CLI_VERSION = 'v0.2.0'
const CLI_DIR = path.join(app.getPath('userData'), 'wps-cli')
```

#### 命令封装

封装高频命令为 TypeScript 函数：

```typescript
// apps/electron/src/main/lib/wps-cli-tools.ts
export const wpsCliTools = {
  // 日历
  async listCalendars() { ... },
  async createEvent(params: { calendar_id, name, from, to, attendees? }) { ... },
  async queryFreebusy(params: { users, from, to }) { ... },

  // IM
  async sendMessage(params: { to: string[]; text: string }) { ... },
  async createChat(params: { name; members }) { ... },

  // 用户
  async listUsers(params?: { status; pageSize; pageToken }) { ... },
  async searchUsers(params: { query }) { ... },

  // 云文档
  async searchFiles(params: { drive_id?; query }) { ... },
  async createShareLink(params: { file_id }) { ... },

  // 通用 API
  async apiGet(endpoint: string) { ... },
  async apiPost(endpoint: string, data: any) { ... },
}
```

#### IPC 通道

```typescript
// apps/electron/src/main/ipc.ts
ipcMain.handle('wps-cli:list-calendars', async () => wpsCliTools.listCalendars())
ipcMain.handle('wps-cli:create-event', async (_, params) => wpsCliTools.createEvent(params))
ipcMain.handle('wps-cli:send-message', async (_, params) => wpsCliTools.sendMessage(params))
// ...
```

### 5.4 Agent 使用场景

| 场景 | CLI 命令组合 | 预期结果 |
|---|---|---|
| 会议调度 | `calendar freebusy query` → `calendar event create` | 查询空闲时间，创建会议 |
| 任务通知 | `im messages send` | 任务完成后推送到 WPS 私聊 |
| 团队通知 | `im chat create` + `im messages send` | 创建项目群聊并发送通知 |
| 文档整理 | `drive file search` → `drive file move` | 搜索并归档文档 |
| 数据同步 | `dbsheet record create` | 自动化数据录入 |
| 人员查询 | `user list` / `user search` | 查询项目成员信息 |

### 5.5 实现工作量估算

| 任务 | 预估时间 |
|---|---|
| CLI 自动下载逻辑 | 2 小时 |
| 命令封装层（10 个高频命令） | 3 小时 |
| IPC 通道注册 | 1 小时 |
| 前端配置 UI（可选，显示 CLI 状态） | 2 小时 |
| 测试与文档 | 2 小时 |
| **总计** | **1 人天** |

## 六、后续规划

### Phase 1：基础集成（待实施）
- [ ] CLI 自动下载
- [ ] 命令封装层
- [ ] IPC 通道
- [ ] 基本测试

### Phase 2：MCP Server 化（可选）
- [ ] 重构为 MCP Server
- [ ] 注册到工作区 mcp.json
- [ ] 利用 MCP 协议标准化工具调用

### Phase 3：官方 MCP Server（长期）
- [ ] 关注 [WPS365 CLI 官方仓库](https://github.com/wps365-open/cli) 动态
- [ ] 官方发布 MCP Server 后替换自建方案

## 七、参考链接

- [WPS365 CLI GitHub](https://github.com/wps365-open/cli)
- [WPS 开放平台](https://open.wps.cn/)
- [WPS 企业管理后台](https://work.wps.cn/)
- [WPS CLI 官方文档](https://github.com/wps365-open/cli/blob/main/README.md)
- [权限申请文档](./prerequisites.md)（需在开放平台应用内查看）

## 八、附录

### 8.1 CLI 命令速查

#### 日历

```bash
wps365-cli calendar list                                    # 日历列表
wps365-cli calendar event list <calendar_id>                # 日程列表
wps365-cli calendar event create <calendar_id> --name "会议" --from "2026-07-08T14:00:00+08:00" --to "2026-07-08T15:00:00+08:00"  # 创建日程
wps365-cli calendar freebusy query --user <user_id> --from "2026-07-08T00:00:00+08:00" --to "2026-07-08T23:59:59+08:00"  # 忙闲查询
```

#### IM

```bash
wps365-cli im messages send --to <user_id> --text "消息内容"  # 发送消息
wps365-cli im chats list                                        # 群聊列表
wps365-cli im chats create --name "群名"                      # 创建群聊
```

#### 用户

```bash
wps365-cli user list --status active                          # 用户列表
wps365-cli user search --query "关键词"                       # 搜索用户
```

#### 云文档

```bash
wps365-cli drive file list                                    # 文件列表
wps365-cli drive file search --query "关键词"                 # 搜索文件
wps365-cli drive link create --file-id <id>                  # 创建分享链接
```

#### 多维表

```bash
wps365-cli dbsheet sheet list                                # 多维表列表
wps365-cli dbsheet record list --file-id <id> --sheet-id <id>  # 记录列表
```

### 8.2 输出格式

```bash
wps365-cli user list --status active -o json     # JSON（默认，AI Agent 推荐）
wps365-cli user list --status active -o yaml     # YAML（配置文件）
wps365-cli user list --status active -o table    # 表格（人类可读）
wps365-cli user list --status active -o csv      # CSV（数据分析）
wps365-cli user list --status active --jq '.[] | {id, name}'  # jq 过滤
```
