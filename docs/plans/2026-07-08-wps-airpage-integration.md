# WPS AirPage 智能文档集成方案

> 2026-07-08
> 状态：设计稿

## 1. 背景与目标

### 1.1 问题

TAgent 已有 WPS 协作能力（WPS Bridge + WPS CLI），覆盖日历/IM/通讯录/云文档搜索等场景，但**无法创建和编辑智能文档**（AirPage）。

用户需要 Agent 能：
- 创建 AirPage 智能文档
- 写入结构化内容（标题/段落/表格/图片）
- 查询和编辑已有文档
- 全程不需用户手动配置

### 1.2 调研结论

| 探索方向 | 结果 |
|---------|------|
| WPS CLI `api get/post` | ❌ CLI 有 API 路径白名单，AirPage 端点不在内 |
| WPS Open API OAuth 2.0 (`openapi.wps.cn`) | ❌ AirPage API 不在此域名，OAuth token 无效 |
| AirPage Skill (`WPS-SMARTDOCS/WPS-AIRPAGE-SKILL`) | ✅ 可用，Cookie + CSRF 认证 |
| 自研 `wpsHttpRequest`（OAuth token 直调） | ❌ AirPage API 不接受 OAuth Bearer token |
| AirSheet 智能表格 | ❌ 无可用 REST API，需 AirScript Token 手动创建 |

**核心发现**：AirPage 智能文档是独立于 WPS Open API 的系统，使用 `365.kdocs.cn` 域名和 **Cookie + CSRF** 认证，不走 OAuth 2.0。

---

## 2. 技术架构

### 2.1 API 概览

```
认证方式: Cookie + x-csrf-rand（浏览器登录态）
Base URL: https://365.kdocs.cn
```

| 操作 | 端点 | 方法 | 需要 CSRF |
|------|------|------|-----------|
| 创建文档 | `/api/v3/office/new/o/file` | POST | ✅ |
| 查询块结构 | `/api/v3/office/file/{fid}/core/execute` | POST | ✅ |
| 插入 Markdown | `/api/v3/office/file/{fid}/core/execute` | POST | ✅ |
| 插入块 | `/api/v3/office/file/{fid}/core/execute` | POST | ✅ |
| 更新块 | `/api/v3/office/file/{fid}/core/execute` | POST | ✅ |
| 删除块 | `/api/v3/office/file/{fid}/core/execute` | POST | ✅ |
| 搜索文档 | `/3rd/drive/api/v6/search/files` | GET | ❌ |
| 上传图片 | `/api/v3/office/file/{fid}/attachment` | POST | ✅ |
| 获取目录 | `/api/v3/office/file/{fid}/core/execute` | POST | ✅ |
| 评论管理 | `/api/v3/office/outline/file/{fid}/comments` | GET/POST | ✅ |

### 2.2 核心 API 详解

#### 创建文档

```http
POST https://365.kdocs.cn/api/v3/office/new/o/file
Cookie: <session cookie>
x-csrf-rand: <csrf token>
Content-Type: application/json

{ "fname": "文档标题" }
```

→ 返回：`{ "fileid": "539860755754" }`

#### 插入 Markdown 内容

```http
POST https://365.kdocs.cn/api/v3/office/file/{fileId}/core/execute
Cookie: <session cookie>
x-csrf-rand: <csrf token>
Content-Type: application/json

{
  "command": "http.otl.exec",
  "param": {
    "subType": "insertContent",
    "params": {
      "content": "# 标题\n正文...",
      "pos": "end"
    }
  }
}
```

→ 返回：`{ "result": "ok", "detail": { "result": "ok" } }`

#### 块操作命令

| subType | 用途 |
|---------|------|
| `insertContent` | 插入 Markdown 内容（整段） |
| `block.insert` | 插入指定类型的块 |
| `block.update` | 更新块内容 |
| `block.delete` | 删除块 |

### 2.3 认证机制

AirPage 使用 **WPS 365 浏览器登录态**认证，不是 OAuth 2.0：

```
Cookie: 从 WPS 365 网页端复制的完整 cookie 字符串
x-csrf-rand: CSRF 令牌（写操作需要）
```

获取方式（三选一）：

| 方式 | 说明 | 用户体验 |
|------|------|----------|
| Playwright 浏览器自动提取 | 程序打开浏览器 → 用户登录 → 自动提取 | ⭐ 最优 |
| Chrome DevTools MCP | 通过 MCP 自动检测登录态 | 需配置 MCP |
| 手动粘贴 | 用户从浏览器 DevTools 复制 | 😟 差 |

**推荐：Playwright 浏览器自动提取**。用户点"登录 WPS 智能文档"→ 弹出浏览器窗口 → 登录后自动关闭 → 凭据存本地。

数据存储位置：
```
~/.claude/secrets/wps365.json
或
~/.tagent/airpage-credentials.json
```

### 2.4 文档块模型

AirPage 文档由块（Block）树组成，类似 Notion：

```
doc (根节点)
├── title        # 文档标题
├── paragraph    # 段落
├── heading      # 标题（level 1-3）
├── table        # 表格
│   ├── tableRow
│   │   ├── tableCell
│   │   └── tableCell
│   └── tableRow
├── bulletList   # 无序列表
├── orderedList  # 有序列表
├── codeBlock    # 代码块
├── image        # 图片
└── blockquote   # 引用块
```

---

## 3. TAgent 集成方案

### 3.1 Footprint Ladder 评估

| 层级 | 方案 | 评估 |
|------|------|------|
| L1: 扩展已有代码 | 在 `wps-cli-tools.ts` 加 AirPage 函数 | ✅ 主方案 |
| L2: Skill | 写成独立 SKILL.md | ❌ 需跨会话持久化，适合内嵌 |
| L3: MCP Server | 注入 Agent 工具的 MCP Server | ✅ 已有 `tagent-wps` MCP，扩展它 |
| L4: Service-gated Tool | IPC + 权限检查 | ❌ 不需要权限审批 |
| L5: Plugin | 独立包 | ❌ 过重 |
| L6: Core Tool | 修改核心 | ❌ 禁止 |

**结论**：L1 + L3，在现有 `wps-cli-tools.ts` 加函数，在 `wps-cli-mcp.ts` 加 MCP 工具。

### 3.2 组件架构

```
┌─────────────────────────────────────────────────┐
│                  TAgent 主进程                     │
│                                                   │
│  wps-cli-tools.ts                                 │
│  ├── AirpageClient (封装 365.kdocs.cn API)         │
│  ├── AirpageAuth (Playwright 浏览器认证)           │
│  └── 现有 WPS CLI 函数                              │
│                                                   │
│  wps-cli-mcp.ts                                    │
│  ├── 现有工具 (已注入 tagent-wps)                   │
│  └── + wps_create_document                         │
│      + wps_insert_content                           │
│      + wps_query_document                           │
│      + wps_search_documents                         │
│      + wps_upload_image                             │
│                                                   │
│  ipc.ts                                           │
│  └── AirPage IPC handlers                          │
│                                                   │
│  preload/index.ts                                  │
│  └── electronAPI.airpage.*                         │
│                                                   │
├─────────────────────────────────────────────────┤
│                  渲染进程                           │
│                                                   │
│  WpsSettings.tsx                                   │
│  └── "登录智能文档" 按钮                            │
│                                                   │
│  Agent 会话                                       │
│  └── Agent 通过 MCP 工具调用 AirPage 能力           │
└─────────────────────────────────────────────────┘
```

### 3.3 数据流

```
用户: "帮我创建一个智能文档，标题是Q3总结"

Agent 收到 prompt
  → 调 wps_create_document MCP 工具
    → wps-cli-tools.ts wpsCreateDocument()
      → POST 365.kdocs.cn/api/v3/office/new/o/file
        → Cookie + CSRF 认证
      → 返回 file_id
  → 调 wps_insert_content MCP 工具
    → wps-cli-tools.ts wpsInsertContent()
      → POST .../core/execute (insertContent)
    → 内容写入成功
  → 返回文档链接给用户
```

### 3.4 文件变更清单

| 文件 | 变更 |
|------|------|
| `packages/shared/src/types/wps.ts` | 新增 AirPage IPC channel 常量 |
| `apps/electron/src/main/lib/wps-cli-tools.ts` | 新增 AirpageClient 类 + 认证函数 |
| `apps/electron/src/main/lib/tools/wps-cli-mcp.ts` | 新增 5 个 MCP 工具 |
| `apps/electron/src/main/ipc.ts` | 注册 AirPage IPC handlers |
| `apps/electron/src/preload/index.ts` | 暴露 airpage API |
| `apps/electron/src/renderer/components/settings/WpsSettings.tsx` | 添加"登录智能文档"UI |

### 3.5 MCP 工具定义

#### `wps_create_document`

| 字段 | 值 |
|------|-----|
| name | `wps_create_document` |
| description | 创建 AirPage 智能文档 |
| params | `name: string` - 文档标题 |
| 返回 | `{ fileid, doc_url }` |

#### `wps_insert_content`

| 字段 | 值 |
|------|-----|
| name | `wps_insert_content` |
| description | 向文档写入 Markdown 内容 |
| params | `file_id: string`, `content: string`, `pos?: 'begin'\|'end'` |
| 返回 | `{ result: 'ok' }` |

#### `wps_query_document`

| 字段 | 值 |
|------|-----|
| name | `wps_query_document` |
| description | 查询文档块结构 |
| params | `file_id: string` |
| 返回 | 块树结构 |

#### `wps_search_documents`

| 字段 | 值 |
|------|-----|
| name | `wps_search_documents` |
| description | 搜索文档 |
| params | `keyword: string` |
| 返回 | 文件列表 |

#### `wps_upload_image`

| 字段 | 值 |
|------|-----|
| name | `wps_upload_image` |
| description | 上传图片到文档 |
| params | `file_id: string`, `image_path: string` |
| 返回 | attachment_id |

---

## 4. 认证流程设计

### 4.1 首次认证

```
1. 用户点击 TAgent 设置 → WPS 协作 → "登录智能文档"
2. 主进程启动 Playwright，打开 Chromium 浏览器
3. 浏览器导航到 365.kdocs.cn
4. 用户扫码/密码登录 WPS 365
5. Playwright 检测到登录完成，自动提取 Cookie + CSRF
6. 凭据加密存储到 ~/.tagent/airpage-credentials.json
7. 浏览器自动关闭
8. 界面显示"已登录"

全程用户只需登录一次 WPS 账号，无其他操作。
```

### 4.2 续期策略

- Cookie 有效期通常 ≥ 8 小时
- 凭据过期 → Agent 调用 AirPage API 失败 → 自动弹出重新登录
- CSRF token 随页面变化，每次登录提取最新值

### 4.3 安全性

- Cookie 加密存储（safeStorage），不落明文
- 仅存储 WPS 365 域名的 cookie，不存储其他站点凭据
- Playwright 只导航到 `365.kdocs.cn`，不注入第三方页面

---

## 5. 已验证的能力

| 能力 | 状态 | 验证方式 |
|------|------|----------|
| Cookie + CSRF 认证 | ✅ | Playwright `auth --browser` 提取成功 |
| 创建 AirPage 文档 | ✅ | `POST /api/v3/office/new/o/file` |
| 插入 Markdown 内容 | ✅ | `insertContent` 命令 |
| 插入表格（markdown 转 table 块） | ✅ | 自动转换为真实 table 块 |
| 查询文档块结构 | ✅ | `block.query` 命令 |
| 文档标题设 | ✅ | 自动更新 title 块 |
| 获取文档大纲 | ✅ | `queryContentByStyle` 命令 |
| 上传图片 | 待验证 | `upload-image` 命令可用 |
| 插入/更新/删除块 | 待验证 | `block.insert/update/delete` |

---

## 6. 与现有 WPS 能力的关系

| 能力 | 认证 | 域名 | 用途 |
|------|------|------|------|
| WPS Bridge | Webhook | 外部 → TAgent | 接收 IM 消息 |
| WPS CLI (日历/IM/通讯录) | OAuth 2.0 Bearer | `openapi.wps.cn` | 日历/消息/通讯录 |
| **AirPage（本方案）** | **Cookie + CSRF** | `365.kdocs.cn` | **智能文档创建/编辑** |

三者互补，不重叠。

---

## 7. 未解决的问题

| 问题 | 状态 |
|------|------|
| PPT 创建 | ❌ 超出 AirPage 范围，待后续调研 |
| 智能表格（AirSheet） | ❌ 无可用 REST API |
| 多维表（DbSheet） | ❌ OAuth JWT 验证失败，待官方修复 |
| 文档模板 | 🤔 AirPage 是否支持从模板创建 |
| 多人协作实时同步 | 🤔 API 层面可能不支持 |
