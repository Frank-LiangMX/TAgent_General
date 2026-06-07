# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**重要提示：**
- 当功能发生变化时，请保持此文件和 `README.md` 同步更新。请更新文档以反映当前状态，但是需要经过我的允许后再修改。
- 所有的注释和日志优先采用中文，保留必要的专业术语部分。
- 所有的依赖包的安装都要先进行搜索，综合判断依赖采用的版本，而不是默认采用某个版本。
- 状态管理上我们全部采用 Jotai 来实现。
- 这是个开源项目，本地存储优先，善用配置文件优于大部分默认采用 localstorage，不采用本地数据库方案。
- 保证充分的组件化以及人类的可读性，每次完成改动后都要思考这一点，保持简单直接不过渡设计的风格。
- 在 UI 设计上采用更现代的方案，UI 组件推荐采用 ShadcnUI，在合适的情况下，用卡片和阴影取代边框，用符合主题的饱满色彩，设置界面要设置背景，为未来做不同主题留下空间。
- 采用 BDD 行为驱动开发的方案。

## 项目概述

TAgent 是一个集成通用 AI Agent 的桌面应用，采用 Electron 架构。
- **品牌约束**：代码/文档/git 提交中永远用 **TAgent**，不用 Proma
- **数据目录**：`~/.tagent/`（开发模式 `~/.tagent-dev/`）
- **包命名**：`@tagent/*` 作用域

## Monorepo 结构

Bun workspace monorepo：

```
TAgent_General/
├── packages/
│   ├── shared/     # 共享类型、IPC 通道常量、配置、工具函数
│   ├── core/       # AI Provider 适配器、代码高亮服务
│   └── ui/         # 共享 UI 组件 (CodeBlock, MermaidBlock)
└── apps/
    └── electron/   # Electron 桌面应用
        └── src/
            ├── main/       # 主进程 + 服务层 (main/lib/)
            ├── preload/    # IPC 上下文桥接
            └── renderer/   # React UI (Vite + Tailwind + Radix UI)
```

**包命名规范**：`@tagent/*` 作用域（`@tagent/core`、`@tagent/shared`、`@tagent/ui`、`@tagent/electron`）

**依赖管理**：package.json 中使用 `workspace:*` 引用内部包

## 常用命令

```bash
# 开发模式（推荐）
bun run dev

# 类型检查（所有包）
bun run typecheck

# 测试
bun test

# 打包分发
cd apps/electron
bun run dist:win      # Windows
bun run dist:mac      # macOS
bun run dist:linux    # Linux
bun run dist:fast     # 当前架构快速打包
```

### Electron 构建脚本（`apps/electron/` 目录下）

```bash
bun run build:main        # esbuild → dist/main.cjs
bun run build:preload     # esbuild → dist/preload.cjs
bun run build:renderer    # Vite → dist/renderer/
bun run build:resources   # 复制 resources/ 到 dist/
```

## 运行时环境

使用 Bun 代替 Node.js/npm/pnpm：
- `bun install` 安装依赖，`bun run <script>` 运行脚本
- `bun test` 运行测试（内置测试运行器）
- Bun 自动加载 .env 文件（无需 dotenv）
- 优先使用 Bun 原生 API：`Bun.file` > `node:fs`

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| **运行时** | Bun | 1.2.5+ |
| **语言** | TypeScript | 5.0.0+ |
| **桌面框架** | Electron | 39.5.1 |
| **前端框架** | React | 18.3.1 |
| **状态管理** | Jotai | 2.17.1 |
| **UI 组件** | Radix UI | 最新 |
| **样式** | Tailwind CSS | 3.4.17 |
| **富文本编辑器** | TipTap | 3.19.0 |
| **代码高亮** | Shiki | 3.22.0 |
| **构建工具** | Vite | 6.0.3 |
| **打包工具** | esbuild | 0.24.0+ |
| **分发工具** | Electron Builder | 25.1.8 |
| **Agent SDK** | @anthropic-ai/claude-agent-sdk | 0.3.143 |

## 核心架构

### IPC 通信模式（最重要的架构模式）

类型定义 → 主进程处理 → Preload 桥接 → 渲染进程调用：

1. **类型 & 常量**：`@tagent/shared` 定义 IPC 通道名称常量和请求/响应类型
2. **主进程处理**：`main/ipc.ts` 注册 `ipcMain.handle()` 处理器
3. **Preload 桥接**：`preload/index.ts` 通过 `contextBridge.exposeInMainWorld` 暴露 API
4. **渲染进程**：通过 `window.electronAPI.*` 调用，Jotai atoms 中封装调用逻辑

添加新 IPC 通道时，需要同步修改这四个位置。

#### 主要 IPC 通道组

- `IPC_CHANNELS` - 基础通道（运行时、Git、环境）
- `CHANNEL_IPC_CHANNELS` - 渠道管理
- `CHAT_IPC_CHANNELS` - Chat 功能
- `AGENT_IPC_CHANNELS` - Agent 功能
- `MEMORY_IPC_CHANNELS` - 记忆功能

### 主进程服务层（`main/lib/`）

| 服务 | 职责 |
|------|------|
| `agent-orchestrator.ts` | Agent 核心编排：并发守卫、渠道查找、环境构建、消息持久化、事件流处理 |
| `agent-session-manager.ts` | Agent 会话管理：SDK 消息持久化、会话元数据 CRUD |
| `agent-prompt-builder.ts` | Agent 系统提示词构建 |
| `agent-workspace-manager.ts` | 工作区管理：MCP Server 配置、Skills 配置 |
| `chat-service.ts` | Chat 流式调用编排 |
| `channel-manager.ts` | 渠道管理：渠道 CRUD、API Key 加密 |

### AI Provider 适配器（`packages/core/src/providers/`）

基于适配器模式的多 Provider 支持：

| Provider | 适配器 | API 协议 |
|----------|--------|----------|
| **Anthropic** | `anthropic-adapter.ts` | Messages API |
| **OpenAI** | `openai-adapter.ts` | Chat Completions |
| **DeepSeek** | `anthropic-adapter.ts` | Anthropic 兼容 |
| **智谱 AI** | `openai-adapter.ts` | OpenAI 兼容 |
| **Google** | `google-adapter.ts` | Generative Language API |
| **Custom** | `openai-adapter.ts` | 自定义端点 |

### Jotai 状态管理（`renderer/atoms/`）

| Atom 文件 | 管理的状态 |
|-----------|-----------|
| `chat-atoms.ts` | 对话列表、当前消息、流式状态、模型选择 |
| `agent-atoms.ts` | Agent 会话列表、当前会话、工作区选择、权限请求队列 |
| `app-mode.ts` | 应用模式（Chat / Agent） |
| `theme.ts` | 主题模式 |

### 本地文件存储（`~/.tagent/`）

```
~/.tagent/
├── channels.json           # 渠道配置（API Key 加密）
├── conversations.json      # 对话索引
├── conversations/          # 消息存储（JSONL）
├── agent-sessions.json     # Agent 会话索引
├── agent-sessions/         # Agent 会话消息（JSONL）
├── agent-workspaces/       # Agent 工作区
│   └── {workspace-slug}/
│       ├── mcp.json        # MCP Server 配置
│       └── skills/         # Skills 配置
├── user-profile.json       # 用户档案
├── settings.json           # 应用设置
└── sdk-config/             # Agent SDK 配置
```

## 构建工具

- **主进程/Preload**：esbuild (`--external:electron --external:@anthropic-ai/claude-agent-sdk`)
- **渲染进程**：Vite + React + Tailwind + HMR
- **打包分发**：electron-builder（配置见 `electron-builder.yml`）

### Agent SDK 打包注意事项

- SDK 必须使用 `--external` 排除
- SDK 0.2.113+ 改为平台 native binary，通过 optionalDependencies 分发
- `electron-builder.yml` 的 `files` 要包含主包和平台子包

## 代码风格

- 永远不要使用 `any` 类型 — 创建合适的 interface
- 对象类型优先使用 interface 而不是 type
- 尽可能使用 `import type` 进行仅类型导入
- 注释和日志采用中文，保留专业术语
- **路径别名**：`@/` → `apps/electron/src/renderer/`

## UI 风格规范

**工具栏按钮一致性**：
- 所有工具栏按钮必须是 **36px 圆形按钮**（`size-[36px] rounded-full`）
- 使用 `variant="ghost"` + `text-foreground/60 hover:text-foreground` 作为默认样式
- 状态变化通过**图标颜色**体现，不用边框或背景

**Popover vs Tooltip**：
- Tooltip：hover 显示简短提示，用于无交互的预览
- Popover：click 打开，用于有交互的设置面板
- 两者可以组合：Tooltip 显示当前状态，点击打开 Popover 调整

**Popover 内容样式**：
- 标题用 `text-xs font-medium text-foreground/80`
- 选项用 `text-xs`，描述用 `text-[10px] text-muted-foreground`
- 选项布局：单行 `label + desc`，或两行紧凑排列
- 宽度：`w-auto min-w-[180px]`，不要过宽

**颜色语义**：
- 默认/保守：`text-foreground/60`
- 中性/信息：`text-blue-500 dark:text-blue-400`
- 警告/积极：`text-amber-500 dark:text-amber-400`
- 危险/停止：`text-red-500 dark:text-red-400`
- 禁用/从无：`text-muted-foreground`

**参考组件**：
- `ContextUsageBadge`：圆形按钮 + Popover + 紧凑布局
- `PermissionModeSelector`：圆形按钮 + Tooltip + 点击切换
- `AgentThinkingPopover`：圆形按钮 + Popover + Switch 开关

## Agent SDK 集成架构

基于 `@anthropic-ai/claude-agent-sdk@0.3.143` 实现 Agent 模式。

### 核心流程

```
用户输入 → agent-orchestrator.ts (SDK 编排)
  ↓
SDK query() → SDKMessage 流
  ↓
convertSDKMessage() → AgentEvent[]
  ↓
webContents.send() → IPC 推送
  ↓
useGlobalAgentListeners → store.set(atoms)
  ↓
React UI 更新
```

### 关键设计

- **并发守卫**：同一会话不允许并行请求
- **全局 IPC 监听**：`useGlobalAgentListeners` 在 `main.tsx` 顶层挂载，永不销毁
- **权限请求排队**：按 sessionId 入队到 Map atoms
- **工作区隔离**：每个工作区独立的 MCP Server 配置和 cwd

## 核心特性

- ✅ 多 Provider 支持：Anthropic、OpenAI、DeepSeek、智谱、Google、自定义端点
- ✅ Agent SDK 集成：基于 Claude Agent SDK 的完整 Agent 模式
- ✅ 工作区管理：多工作区隔离、MCP Server 配置、Skills 管理
- ✅ 权限系统：工具权限检查、用户确认流程
- ✅ 记忆系统：跨会话记忆存储与检索
- ✅ 自动更新：Electron Updater 集成
- ✅ 多模态支持：图片、文档附件

---

## 当前进度与下一步

**当前阶段**：MVP 设计已拍板，实施进行中

**已完成**（截至 2026-06-06）：
- Tier 1+2 品牌清理（全清 "proma" 标识）
- §8.4 Context 管理 6/7 项实现
- ESLint 9 升级 + 434 warnings 清理
- 93 个单元测试

**剩余任务**：
- 🟡 P1-3 客户端 `compact_session` 工具（最大件）
- 🟢 功能验证 + 单测补充

**详细进度**：见 `docs/PROGRESS.md`

**设计文档**：`docs/plans/2026-06-05-tagent-fusion-design.md`

---

## 新 Agent 快速上手指南

如果你是新进入此项目的 AI Agent：

1. **先读本文件** — 了解项目身份、架构、约束
2. **读 `.context/PROGRESS.md`** — 了解当前进度和下一步
3. **读设计文档** — `docs/plans/2026-06-05-tagent-fusion-design.md` 了解完整设计
4. **品牌约束** — 永远用 TAgent，不用 Proma；路径用 `~/.tagent/`
5. **问用户确认** — 重大改动前先问

**第一句话建议**：
```
我已读完 CLAUDE.md 和 .context/PROGRESS.md，了解项目当前状态。
请问接下来需要我做什么？
```