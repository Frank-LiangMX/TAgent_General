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

## Agent Onboarding Checklist（进入项目第一句话必须报告）

新进入此工程的 AI Agent（Claude / Codex / Cursor / ...）在第一句话里必须确认以下事项：

```
我已读完 CLAUDE.md 和 docs/PROGRESS.md，了解：
- 品牌约束：永远用 TAgent，不用 Proma；数据目录 ~/.tagent/
- UI 库：基础组件从 @tagent/ui 导入，玻璃样式用 session-list-item-active / session-glass-* 类，圆角/颜色用 token，禁止 @/components/ui/* 新增 import（ESLint 会 warn）
- 状态管理：全部用 Jotai
- 中文注释优先，保留专业术语
- Prompt Cache：长会话每轮复用 cached prefix，禁止中途切换 toolset / 重建 system prompt / 注入 system message（详见"Prompt Cache 不可侵犯"段）
- Footprint Ladder：新增能力按 6 级阶梯选择（扩展已有代码 > Skill > MCP Server > Service-gated Tool > Plugin > Core Tool），3+ 同类 PR 必须设计 ABC + orchestrator
请问接下来需要我做什么？
```

不报告此 checklist 的 agent 视为未读规范，用户可要求重读后再继续。

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

| 层级             | 技术                           | 版本    |
| ---------------- | ------------------------------ | ------- |
| **运行时**       | Bun                            | 1.2.5+  |
| **语言**         | TypeScript                     | 5.0.0+  |
| **桌面框架**     | Electron                       | 39.5.1  |
| **前端框架**     | React                          | 18.3.1  |
| **状态管理**     | Jotai                          | 2.17.1  |
| **UI 组件**      | Radix UI                       | 最新    |
| **样式**         | Tailwind CSS                   | 3.4.17  |
| **富文本编辑器** | TipTap                         | 3.19.0  |
| **代码高亮**     | Shiki                          | 3.22.0  |
| **构建工具**     | Vite                           | 6.0.3   |
| **打包工具**     | esbuild                        | 0.24.0+ |
| **分发工具**     | Electron Builder               | 25.1.8  |
| **Agent SDK**    | @anthropic-ai/claude-agent-sdk | 0.3.143 |

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

| 服务                         | 职责                                                                 |
| ---------------------------- | -------------------------------------------------------------------- |
| `agent-orchestrator.ts`      | Agent 核心编排：并发守卫、渠道查找、环境构建、消息持久化、事件流处理 |
| `agent-session-manager.ts`   | Agent 会话管理：SDK 消息持久化、会话元数据 CRUD                      |
| `agent-prompt-builder.ts`    | Agent 系统提示词构建                                                 |
| `agent-workspace-manager.ts` | 工作区管理：MCP Server 配置、Skills 配置                             |
| `chat-service.ts`            | Chat 流式调用编排                                                    |
| `channel-manager.ts`         | 渠道管理：渠道 CRUD、API Key 加密                                    |

### AI Provider 适配器（`packages/core/src/providers/`）

基于适配器模式的多 Provider 支持：

| Provider      | 适配器                 | API 协议                |
| ------------- | ---------------------- | ----------------------- |
| **Anthropic** | `anthropic-adapter.ts` | Messages API            |
| **OpenAI**    | `openai-adapter.ts`    | Chat Completions        |
| **DeepSeek**  | `anthropic-adapter.ts` | Anthropic 兼容          |
| **智谱 AI**   | `openai-adapter.ts`    | OpenAI 兼容             |
| **Google**    | `google-adapter.ts`    | Generative Language API |
| **Custom**    | `openai-adapter.ts`    | 自定义端点              |

### Jotai 状态管理（`renderer/atoms/`）

| Atom 文件        | 管理的状态                                         |
| ---------------- | -------------------------------------------------- |
| `model-atoms.ts` | 渠道列表、模型选择、思考展开                       |
| `agent-atoms.ts` | Agent 会话列表、当前会话、工作区选择、权限请求队列 |
| `draft-atoms.ts` | 草稿列表、当前草稿、需求块、升级到 Agent          |
| `app-mode.ts`    | 应用模式（Agent / Draft）                          |
| `theme.ts`       | 主题模式                                           |

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

## Prompt Cache 不可侵犯

**核心约束**：长会话每轮复用 cached prefix，cache 命中直接影响成本与延迟（cache miss 翻倍成本）。TAgent 用 Claude Agent SDK，cache 机制由 SDK 黑盒管理，TAgent 是 SDK 上层，约束目标是"不破坏 SDK 已享受的 cache"。

**当前架构已对齐**（explorer 2026-07-03 验证）：
- ✅ 主拼装顺序稳定（`agent-prompt-builder.ts:455-836` 用 `sections[]` 固定顺序 push）
- ✅ 工具列表不进 system prompt（走 SDK `mcpServers` + `agents` 独立字段）
- ✅ skills 不进 system prompt（走 SDK plugin 机制自动发现）
- ✅ 动态内容隔离到 user message（时间/MCP 状态/工作目录走 `<workspace_state>` XML 块）
- ✅ 无中途注入 system message

**禁止行为**（除非论证无 cache 影响）：
- 中途切换 toolset（增删工具）
- 重建 system prompt（顺序调整、内容追加）
- 中途注入新的 system message
- 翻转消息顺序

**唯一例外**：context compression（`compact_session`）

**用户主动操作的 cache 失效点**（合理，无需修复）：
1. permissionMode 切换（plan / auto / bypassPermissions）
2. mode 切换（general / ta）
3. SOUL.md 编辑（用户保存后下一条消息 system prompt 变化）
4. SubAgent eagerness 档位变更（never / conservative / balanced / aggressive）

**PR 审查 checklist**：
- [ ] 改动是否影响 system prompt 组装顺序？
- [ ] 改动是否动态增删工具？
- [ ] 改动是否插入新消息到会话中部？
- 若任一为是：在 PR 描述中论证 cache 影响与替代方案

## 能力新增 Footprint Ladder

新增能力按以下阶梯选择（从轻到重）：

1. **扩展已有代码**：能改现有 service / atom 就改，不新建
2. **Skill**：写到 `~/.tagent/agent-workspaces/{ws}/skills/`，用 SKILL.md 描述
3. **MCP Server**：通过 workspace `mcp.json` 配置，按需加载
4. **Service-gated Tool**：带权限检查的工具（`check_fn`），走 IPC 通道
5. **Plugin**：独立包，按需加载（未来规划）
6. **Core Tool**：最后手段，需 PR 评审 + 架构论证

**强制规则**：3+ 同类 PR 必须设计 ABC（Abstract Base Class）+ orchestrator，避免核心膨胀。

**命令路由（v1.4.2 引入）**：
- 命令注册表：`apps/electron/src/main/lib/command-registry.ts`（统一注册表，纯逻辑）
- 命令路由三类：desktop / agent / model
- 触发方式：UI 按钮 + 未来 Cmd+K 全局命令面板（v1.6）
- **不引入 slash command 文本语法**（与现有 `/` = TipTap Mention skill 触发冲突，且非桌面原生方案）
- **不引入 `~` 触发字符**（CLI 思维，桌面应用不需要）

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

## UI 库使用规范

**写任何 UI 代码前必读 `packages/ui/DESIGN.md`**。

### 决策树（写 UI 时按顺序回答）

1. **基础组件**（Button / Input / Dialog / Tooltip / Popover / Switch / Badge / Select / Sheet / ...）
   - ✅ `import { Button } from '@tagent/ui'`
   - ❌ `import { Button } from '@/components/ui/button'`（ESLint warn，存量可保留，新增禁止）

2. **玻璃浮层样式**（侧栏列表项选中态 / 浮岛 / 模态框 / Tooltip 玻璃底 / 弹出层）
   - ✅ 查 `packages/ui/styles/glass.css` 类清单：`session-list-item-active` / `session-glass-sidebar` / `session-glass-modal` / `session-glass-popover` / `session-glass-tooltip`
   - ✅ 单行列表项选中态：直接写 `className="session-list-item-active"`（玻璃底 + 圆角 + 折射层已封装）
   - ❌ 不要拼 `session-glass session-glass-sidebar rounded-[10px]`（已弃用，用 `session-list-item-active`）
   - ❌ 不要硬编码 `rounded-[10px]` / `bg-white/10` / `backdrop-blur-md`（用 token 类）

3. **视觉 token**（圆角 / 颜色 / 阴影 / 间距 / 字号 / 动效）
   - ✅ 查 `packages/ui/src/tokens/` 源文件
   - ✅ 圆角用 `rounded-glass-*` token 类（如 `rounded-glass-tooltip`）或 `var(--radius-glass-*)`
   - ✅ 颜色用 Tailwind 语义类：`bg-background` / `text-foreground` / `border-border` / `bg-primary` / `text-muted-foreground`
   - ❌ 禁止硬编码：`#fff` / `rgb(...)` / `rounded-[14px]` / `shadow-[0_4px_12px_rgba(0,0,0,0.1)]`

4. **业务组件**（AgentView / DraftListPanel / KanbanMainView / ...）
   - 放 `apps/electron/src/renderer/components/` 下
   - 复用基础组件 + 玻璃类 + token，不要重新造轮子

### 基础组件清单

27 个基础组件已迁移到 `@tagent/ui`：Button / Input / SearchInput / Textarea / Switch / Slider / Label / Tooltip / Popover / Dialog / AlertDialog / Sheet / DropdownMenu / Alert / Badge / Spinner / LoadingIndicator / Separator / Collapsible / ScrollArea / ScrollProgressContainer / Select / Tabs / SegmentedTabs / ThreePetalSpiral / ImageLightbox / CodeBlock / MermaidBlock

### Token 系统

- 视觉 token 权威源在 `packages/ui/src/tokens/`
- 修改 token：编辑 `packages/ui/src/tokens/*.ts` → `bun run --filter @tagent/ui tokens:generate` → 全局自动更新
- 生成产物：`packages/ui/src/tokens/__generated__/tokens.css` + `tailwind-theme.js`，**不要手改生成文件**

### 新增 UI 组件流程

1. 放 `packages/ui/src/components/`（不放 `apps/electron/src/renderer/components/ui/`）
2. 在 `packages/ui/src/index.ts` 加 export
3. 更新 `packages/ui/DESIGN.md` 组件清单
4. `bun run typecheck` 通过 + 视觉抽查

### 新增玻璃样式类

1. 放 `packages/ui/styles/glass.css`
2. 圆角引用 `--radius-glass-*` token（先在 `packages/ui/src/tokens/radius.ts` 加 token，再跑 `tokens:generate`）
3. 业务侧主题色覆盖（ocean / forest / slate）放 `apps/electron/src/renderer/styles/globals.css` 的 `.theme-xxx` 块
4. 更新 `packages/ui/DESIGN.md` 样式类清单

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

## SubAgent 与看板派发策略

**全局策略已内置于 system prompt**（`agent-prompt-builder.ts:buildSubagentDispatchStrategy`），所有项目生效，所有档位都强制必委派探索/调研/审查/大目标。此处只记录本项目级补充。

### 本项目高频委派场景

- **探索 IPC 通道链路**：新增/修改 IPC 通道需同步改 4 处（`@tagent/shared` 类型 → `main/ipc.ts` 处理器 → `preload/index.ts` 桥接 → renderer atoms），派 `explorer` 先摸清现有链路
- **调研 Provider 适配器**：对比多 Provider 实现时派 `researcher`（`packages/core/src/providers/`）
- **审查 IPC / 主进程改动**：跨进程改动易引入安全漏洞，改完派 `code-reviewer`
- **大项目分析**：本 monorepo（`packages/*` + `apps/electron/src/*`）文件多，整体架构分析用看板并行拆分

### 派发策略档位

用户可在 Agent 工具栏 `SubagentEagernessSelector` 切换（never / conservative / balanced / aggressive，默认 conservative）。所有档位都强制必委派探索/调研/审查/大目标，档位只控制批量任务的激进程度。

### 反模式（避免）

- ❌ 主会话串行读 10+ 文件找某个符号 → 派 `explorer`
- ❌ 主会话串行做 3+ 独立子任务 → 用看板并行
- ❌ 主会话改完多文件代码不审查 → 派 `code-reviewer`
- ❌ 大项目分析派一个 SubAgent 硬啃 → SubAgent context 会爆，用看板拆分
- ❌ 简单单步问答也派 SubAgent → 开销高，主会话直接干更快
- ❌ **派发 kanban 任务 body 里只用相对路径** → worker 是 headless 子会话看不到当前 cwd，会到处 Glob/Grep 找项目根，单次任务多消耗 10K+ token。**强制要求**：body 开头必须写明 `项目根目录: <绝对路径>`，body 内所有文件引用用绝对路径或带项目根前缀。**根治方案见** `docs/plans/2026-06-30-kanban-v1-product-design.md` Phase D+1（`kanban_add_task` 自动注入项目根路径）。

### 派发 body 必须带项目根路径（硬约束）

**这是反复出现的工作流问题，2026-07-05 用户明确反馈必须根治**：

- worker 是 headless 子会话，看不到主会话 cwd
- body 里如果只有 `apps/electron/src/main/lib/...`，worker 不知道项目在哪
- 单次任务可能多消耗 10K+ token 找项目根，浪费用户配额
- **临时措施**：派发时 body 开头第一段写明 `项目根目录: /Users/frank/Downloads/TAgent_General`，body 内所有路径用绝对路径
- **根治措施**（开发期必修）：`kanban_add_task` 工具实现里自动在 body 开头注入项目根路径，详见 `docs/plans/2026-06-30-kanban-v1-product-design.md` Phase D+1

---

## 当前进度与下一步

**当前阶段**：MVP / P1 / P2 / P3 主线已完成；Automation v1（M1–M3）已合入 `main`；kscc 内网渠道集成已完成；草稿模式重构 + Chat 残留清理已完成；看板多 Agent 协作系统（B1–B10）已合入 `main`。当前活跃开发主线为 **v1.4.2 稳定性补丁已发布** + **看板 v1 产品化**（下一阶段）。

**已完成**（截至 2026-07-03）：

- Tier 1+2 品牌清理（全清 "proma" 标识 → "tagent"）
- Ask 档位统一 Composer + Chat 主路径退役
- TA 模式 UI / 会话隔离 / TA 工具注入闭环
- 记忆 5 层 + 自进化机制（Nudge / Reflect / Scheduled Cleanup）
- §8.4 Context 管理核心能力完成（含 `compact_session` 兜底、客户端压缩、Context 圆环）
- 远程连通：飞书 / 钉钉 / 微信 / WPS 协作 Bridge
- 使用统计、Token 统计、`/btw` 侧面提问等后续优化完成
- Claude Agent SDK **0.3.185** 升级（写风暴 / 断连修复）
- **Automation v1（M1–M3）**：调度内核 + 管理 UI + 运行通知（PR #15）
- **草稿模式重构 + Chat 清理**：Chat 死代码全清（-2796 行）、Draft 全系统（数据层 + Atoms + 7 UI 组件 + Agent 升级流 + 旧版迁移）
- **v1.3.0 发布**（2026-06-29）：插件市场/已安装页重构 + `@tagent/ui` 迁移 + 侧栏手风琴布局
- **v1.3.1 发布**（2026-06-29）：kscc 渠道 Bash/ripgrep 工具修复 + dev 启动脚本闪退修复 + 1.3.0 遗留 typecheck 错误清理
- **v1.4.0 发布**（2026-07-02）：看板多 Agent 协作系统 B1–B10 + 角色库 + worker 生命周期（PR #17）+ 上游 v0.13.4 对齐（PR #16）+ Superpowers 14 skill + auto-check PostToolUse 钩子
- **v1.4.1 发布**（2026-07-02）：macOS 安装包"已损坏"修复（ad-hoc 签名回归）+ 自动更新错误信息可见
- **v1.4.2 发布**（2026-07-03）：稳定性补丁 6 项（hermes-borrow-plan §5.1）+ 4 项独立修复 + CI 修复（eslint / prettier / FTS5 SQL）

**活跃待办**：

- **看板 v1 产品化**（下一主线）— `docs/plans/2026-06-30-kanban-v1-product-design.md`（B1–B10 内核已落地，UI/体验打磨 + 真实任务跑通中）
- **hermes-borrow-plan §5.2 v1.5 主线**：Skill Curator 自进化 + 看板 goal_mode judge gate + Nudge 写入升级 + Memory Graph 阶段一 + 孤儿引用修复
- **上游 v0.13.4 对齐收尾** — `docs/plans/2026-06-24-upstream-feature-roadmap.md`（Issue A/E 部分完成）
- 协作子会话 v1 — `docs/plans/2026-06-24-collaboration-design.md`
- Automation M4 扩展（MCP 工具、自然语言创建、custom cron）
- WPS 协作远程连通完善：媒体附件、绑定持久化、公网回调 URL、富文本 / 卡片
- 小修：`project_repeat` Nudge、TaskOutput 获取、真实模型成本、飞书教程视频 URL

**最近完成**（2026-07-05）：

- **记忆系统 UI 收尾**：通用模式补记忆 rail 入口（之前只在 TA 模式可见）+ 清理 MemOS Cloud 遗留代码（-609 行，删 `memos-client.ts` / `memory-tool.ts` / `getMemoryConfig` IPC 链路 + `memoryEnabled` 字段）+ 修复 L4 summary NULL bug（v1.4+ SDKMessage 嵌套格式 `{type, message: {role, content}}` 未读取，导致 L4 永远写不进 summary）+ 记忆页面重设计对齐 KanbanMainView 玻璃风格（Panel + content-glass + RailInspectorHeader + 6 层时间线卡片）+ 左栏改为会话搜索（FTS5 全文搜索 + 300ms 防抖）去除左右重复的 L0-L5 层级逻辑 + 左栏 L0-L5 点击 → 主区滚动定位 + 展开 + 左栏会话点击 → 主区 L4 卡片高亮选中会话（`memorySelectedSessionAtom` 桥接）+ 圆角升级匹配主体大圆角风格（层卡片 rounded-2xl / 会话卡片 rounded-glass-popover / 徽章 rounded-full）+ 主面板层卡片改用 `session-list-row` 玻璃浮岛模式（展开时 `session-list-item-active` 完整玻璃浮岛，未展开时透明融入底板，去掉 `bg-muted/10` 半透明灰遮盖）

**最近完成**（2026-07-03）：

- **v1.4.2 发布**：hermes-borrow-plan §5.1 6 项落地（记忆系统修复 + Cron Injection 防护 + Worker Approval 防死锁 + Prompt Cache 宪章 + Footprint Ladder + Context 压缩首尾保护）+ 用户反馈功能 + 工作区拖拽排序 + 侧栏 UI 统一 + 附件卡片抖动修复（Windows）+ session-not-found 卡死修复 + sticky-message 抖动修复 + CI 修复（eslint 不可见 Unicode / prettier 格式 / FTS5 SQL 别名）+ release workflow 修复（body_path + RELEASE_NOTES.md）
- **CI 修复**：automation-prompt-scanner.ts 不可见 Unicode 字符转义 `\u{XXXX}`、16 个文件 prettier --write、memory-layer-service.ts FTS5 SQL 用别名 `fts` 替代原表名 `sessions_fts`

**最近完成**（2026-06-29）：

- **v1.3.1 补丁发布**：修复 kscc 渠道 Bash 工具不可用（`buildSdkEnv` 把 `CLAUDE_CODE_SHELL` 配置移到 early return 前）+ ripgrep 自动补齐（新增 `ensure-kscc-ripgrep`，启动时从系统 PATH 复制 `rg.exe` 到 kscc vendor 目录）+ dev 启动脚本闪退（`Start/Stop-TAgent-Dev.bat` 编码修复，移除误杀 kscc 的旧 `dev.bat`/`dev-kill-all.ps1`）+ 1.3.0 遗留 11 个 typecheck 错误清理
- **v1.3.0 发布**：插件市场/已安装页重构、`@tagent/ui` 共享 UI 包、侧栏项目-会话手风琴布局

**详细进度**：见 `docs/PROGRESS.md`

**重点规划**：
- `docs/plans/2026-06-30-kanban-v1-product-design.md`（**当前主线**：看板 v1 产品化）
- `docs/plans/2026-06-24-upstream-feature-roadmap.md`（上游对齐）
- `docs/plans/2026-06-24-collaboration-design.md`（协作子会话 v1）
- `docs/plans/2026-06-24-automation-design.md`（M1–M3 ✅ / M4 待做）
- `docs/plans/2026-06-16-upstream-upgrade-issues.md`（B/C/D ✅ / A/E 部分）
- `docs/plans/2026-06-16-wps-bridge-landing.md`
- `docs/plans/2026-06-25-draft-restructure-design.md`（草稿重构 + Chat 清理）

---

## 新 Agent 快速上手指南

如果你是新进入此项目的 AI Agent：

1. **先读本文件** — 了解项目身份、架构、约束
2. **读 `docs/PROGRESS.md`** — 了解当前进度和下一步
3. **读设计文档** — `docs/plans/2026-06-05-tagent-fusion-design.md` 了解完整设计
4. **品牌约束** — 永远用 TAgent，不用 Proma；路径用 `~/.tagent/`
5. **问用户确认** — 重大改动前先问

**第一句话建议**：

```
我已读完 CLAUDE.md 和 .context/PROGRESS.md，了解项目当前状态。
请问接下来需要我做什么？
```
