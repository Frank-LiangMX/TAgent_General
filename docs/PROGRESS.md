# TAgent 项目进度追踪

> **单文件持续更新** — 新 Agent 读此文件即可了解项目状态  
> **主设计**：`docs/plans/2026-06-05-tagent-fusion-design.md`  
> **已完成**：`docs/plans/2026-06-13-ask-mode-unification-design.md`（Ask 档位 / 退役 Chat）
> **新增规划**：`docs/plans/2026-06-16-upstream-upgrade-plan.md`（上游能力对齐 + 开发 Agent 实施手册）
> **Issue 草案**：`docs/plans/2026-06-16-upstream-upgrade-issues.md`（A~E 任务拆分）
> **WPS 协作**：`docs/plans/2026-06-16-wps-bridge-landing.md`（远程连通落地说明）

---

## 已完成（2026-06-14）

**Ask 档位统一 Composer**（全部阶段已完成）

| 项                    | 状态                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| ADR                   | ✅ [`docs/decisions/0002-ask-mode-composer.md`](decisions/0002-ask-mode-composer.md) — Status 已更新为 Implemented |
| 实施设计              | ✅ [`docs/plans/2026-06-13-ask-mode-unification-design.md`](plans/2026-06-13-ask-mode-unification-design.md)       |
| 分支                  | `feature/ask-mode-composer`                                                                                        |
| P0 核心 Ask 链路      | ✅ 已完成                                                                                                          |
| P1 引导升级 + 横幅    | ✅ 已完成                                                                                                          |
| P2 导航统一 / 藏 Chat | ✅ 已完成                                                                                                          |
| P3 删 Chat UI 栈      | ✅ 已完成                                                                                                          |

**P3 详细完成项**：

- ✅ P3-1a: 共享组件搬迁（UserAvatar → shared/, formatMessageTime → lib/time-utils.ts）
- ✅ P3-1b: 删除 `components/chat/` 整个目录
- ✅ P3-2: 删除 Chat 发送路径 IPC（SEND_MESSAGE/STOP_GENERATION/GENERATE_TITLE），保留附件 API
- ✅ P3-3: migration-service 已支持 Chat 历史导出；设置页 MigrationSettings 可导出 sessions
- ✅ P3-4: 删除 `appMode: 'chat'`、`TabType: 'chat'` 类型

---

## 当前状态（2026-06-14）

**阶段**：P2 阶段完成，所有后续优化任务已完成

**已完成**：

- ✅ Tier 1+2 品牌清理（全清 "proma" 标识 → "tagent"）
- ✅ §8.4 Context 管理 **7/7 项全部实现**
- ✅ ESLint 9 升级 + 434 warnings 清理
- ✅ **305 个单元测试**（vitest 配置修复，2026-06-11）
- ✅ 图标清理（删除 proma 旧 logo 变体，重画 icon.svg）
- ✅ dev-stop.bat + dev.bat 修复（中文乱码问题）
- ✅ 文档更新（CLAUDE.md 品牌/命名修正，PROGRESS.md 创建）
- ✅ UI 风格规范文档
- ✅ TA 工具分析 + MCP 架构设计
- ✅ TA 领域内置 TS 工具 **5 个工具已实现**
  - `check_naming` - 命名规范检查
  - `suggest_naming` - 命名建议
  - `check_directory_structure` - 目录结构验证
  - `discover_conventions` - 发现项目规范配置
  - `load_conventions` - 加载规范配置
- ✅ TA MCP Server 框架搭建 **5 个工具已实现**（11 个测试通过）
  - `tagent__check_mesh_budget` - 多边形预算检查
  - `tagent__check_fbx_info` - FBX 信息提取
  - `tagent__check_texture_info` - 纹理信息检查
  - `tagent__check_texture_batch` - 批量纹理检查
  - `tagent__analyze_assets` - 资产分类分析
- ✅ **TA MCP Server 一键安装 + Agent 拦截**（2026-06-10）
  - 红灯状态加"一键安装"按钮（`TAInstallDialog`）
  - 全局共享 venv：`~/.tagent[-dev]/ta/venv/`
  - 流式日志 + 5 步进度 + 可取消
  - 离线 wheelhouse 失败自动 fallback 在线
  - Agent canUseTool 前置守卫 + typedError `ta_dependency_missing`
  - `build-ta-wheels` 脚本 + `electron-builder.yml` extraResources
  - 端到端验证通过（venv 创建 → pip 升级 → ta-agent-mcp 安装 → import 验证）
- ✅ **资产扫描支持 UE/Unity 工程**（2026-06-10）
  - `.uasset` 按命名约定细分 (BP*→blueprint, MI*/M*→material, T*→texture, SM*/SK*→mesh, A_→level)
  - `.umap` 归到 level；`.prefab`/`.unity` 归到 level
  - 跳过构建产物目录（binaries/intermediate/library/temp/obj/logs 等）
  - 16/16 单元测试通过
- ✅ **修复 better-sqlite3 dlopen 失败**（2026-06-10）
  - esbuild 加 `--external:better-sqlite3`
  - electron-builder 列入 `node_modules/better-sqlite3/**/*`
- ✅ **修复资产库初始化后转圈 bug**（2026-06-10）
  - `setIsLoading(false)` 移到 finally 块
  - 成功路径补上 loadAssets / loadStats / loadProjects
- ✅ P1 顶层模式切换 UI **已完成**
  - `TopLevelModeTab` 组件 - 通用/TA 切换
  - `topLevelModeAtom` - 支持 general/ta 顶层模式
- ✅ P2 TA 模式 UI 框架 **已完成**
  - `TAModeView` - 主视图（4 个 Tab）
  - `AssetLibraryPanel` - 资产库面板（已接入 SQLite）
  - `ReviewQueuePanel` - 审核队列面板（Mock 数据）
  - `PipelinePanel` - 流水线面板（Mock 数据）
  - `TAConfigPanel` - 配置面板（命名规则 + 预算配置）
- ✅ TA MCP Server 集成 **已完成**
  - IPC 通道：`GET_TA_MCP_STATUS` / `IS_TA_MCP_CONFIGURED` / `ENABLE_TA_MCP` / `DISABLE_TA_MCP`
  - **新增** `INSTALL_TA_MCP` / `CANCEL_TA_MCP_INSTALL` / `GET_TA_INSTALL_PROGRESS` / `TA_INSTALL_LOG`
  - 后端服务：`ta-mcp-service.ts`（Python 环境检测 + venv 管理 + MCP 配置管理）
  - **新增** `ta-mcp-installer.ts`（installer 状态机 + 流式日志 + 取消）
  - Preload API：`getTAMcpStatus` / `isTAMcpConfigured` / `enableTAMcp` / `disableTAMcp`
  - **新增** `installTAMcp` / `cancelTAInstall` / `getTAInstallProgress` / `onTAInstallLog`
  - UI 状态显示：运行中（绿）/ 未配置（黄）/ 未安装（红）+ 一键启用 / 一键安装按钮
- ✅ P0 验证工具可调通 **已完成**（2026-06-08）
  - 添加 `__main__.py` 支持 `python -m ta_agent_mcp` 启动
  - 工具调用测试通过：`tagent__check_mesh_budget` 返回正确结果
  - 应用启动测试通过：运行时检测 + 渠道验证正常
- ✅ P1 模式互斥 + 后台跑完 **已完成**（2026-06-08）
  - ModeManager 服务：互斥锁 + 后台任务追踪 + 通知
  - IPC 通道：`GET_MODE_STATUS` / `SWITCH_MODE` / `REGISTER_BACKGROUND_TASK` / `COMPLETE_BACKGROUND_TASK`
  - TopLevelModeTab 集成：显示后台任务数量 + 暂停指示器
- ✅ P1 switch_mode 工具 **已完成**（2026-06-08）
  - 工具定义：`switch_mode` 伪工具
  - 参数：target_mode / reason / context_summary
- ✅ P2 资产库 SQLite 直读 + UI **已完成**（2026-06-08）
  - better-sqlite3 依赖安装
  - 数据库 Schema：assets 表 + FTS5 索引 + review_history 表
  - AssetStoreService：只读模式 + WAL + FTS5 搜索
  - IPC 通道：INIT / STATUS / LIST / SEARCH / DETAIL / STATS / PROJECTS
  - AssetLibraryPanel：已接入真实数据，支持搜索/筛选/分页
- ✅ ta_agent MCP Server 数据库写入 **已完成**（2026-06-08）
  - tag_store 模块：数据库初始化 + CRUD 操作
  - analyze_assets 工具：支持 save_to_db 参数写入数据库
  - 新增 6 个资产库管理工具：save_asset / update_asset / delete_asset / get_asset / list_assets / get_db_status
  - 数据库路径：~/.tagent[-dev]/ta/tag_store/tags.db
  - 数据库 Schema：assets 表 + FTS5 索引 + review_history 表
  - AssetStoreService：只读模式 + WAL + FTS5 搜索
  - IPC 通道：INIT / STATUS / LIST / SEARCH / DETAIL / STATS / PROJECTS
  - AssetLibraryPanel：已接入真实数据，支持搜索/筛选/分页
- ✅ **TA 模式 UI 重构 + 会话子系统**（2026-06-09，9 个 commit）
  - **6 个 rail 入口**：会话/资产库/审核/流水线/记忆/配置（TA 模式 FunctionalRail 显示）
  - **TASidebar 5 个模块概览面板**：资产计数 + 最近 5 个 / 审核 4 状态 + 最近 5 待审 / 流水线 4 状态 / 记忆 5 层计数 / 配置 3 入口
  - **TA 会话数据隔离**：`AgentSessionMeta` 加 `mode: 'general' | 'ta'` 字段
    - agent-sessions 索引持久化 mode，list/create IPC 透传 mode
    - `taSessionsAtom` 派生 atom 过滤 `mode==='ta'`
    - `filteredAgentSessions` 按 topLevelMode 过滤（通用/TA 各自只看自己的）
  - **TA 会话区复用通用模式布局**：
    - TA 模式选『会话』走 `GeneralMainArea` 路径（顶部 TabBar 含草稿/会话 tab）
    - `tabsAtom` 按 mode 字段过滤，scratch tab 两边通用
    - `useOpenSession` 接受 mode 参数，openTab 写入 mode
  - **per-mode 状态记忆**：
    - `activeTabIdByModeAtom` Map<TopLevelMode, string | null>，切模式时自动切换
    - `activeRailItemAtom` 改为可写派生 atom，setter 路由到 generalRailItemAtom / taActiveTabAtom（独立 localStorage key）
    - 删除老逻辑 effect（FunctionalRail 内 setActiveRailItem 重置被删）
  - **TA 工具自动注入**（主进程）：
    - `SystemPromptContext` 加 mode 字段，TA 模式 push TA 视角 section（命名/目录/数据隔离说明）
    - `AgentOrchestrator.injectTATools` 新增：把 5 个 in-process ta-tools 包装成 SDK MCP server `tagent-ta`
    - sendMessage 在 `getAgentSessionMeta(sessionId)?.mode === 'ta'` 时调 injectTATools
  - **小修**：
    - 隐藏工作区控件（TA 模式不显示 Briefcase Popover + 目录区顶部工作区 Popover）
    - 会话列表项删除工作区名徽标
    - 使用 `useCreateSession` 统一入口创建 TA 会话
- ✅ **Agent 页面 UI 首轮收敛**（2026-06-09，未提交）
  - 无当前打开会话时显示引导页，不再继续显示上一次会话内容
  - 欢迎页不复用 `草稿` 语义；草稿只保留在 Scratch tab
  - Header 改为轻量状态栏，不显示会话标题 / 工作区 / “会话”文字
  - 顶部 Tab 用图标 + 标题承载会话定位，去除工作区 badge 和整块描边，改用底部状态横条
  - LeftSidebar / FunctionalRail 折叠态会话列表按通用 / TA 模式过滤
  - Rail 折叠态 TA / 通用模式添加与搜索按钮保持一致
  - 左侧 Agent 会话竖条语义收敛：active=主题色，running=蓝色，blocked=橙色，completed=绿色，manual working 不显示蓝条
  - 设计记录见 `docs/plans/2026-06-09-agent-ui-optimization-plan.md`

**进行中**：

- 无

**剩余任务**（按设计文档 §10.1 阶段划分）：

### P0 MVP 阶段 ✅ 已完成

| 任务                           | 状态   | 备注                        |
| ------------------------------ | ------ | --------------------------- |
| ✅ P0 品牌替换                 | 已完成 | `@proma/*` → `@tagent/*`    |
| ✅ P0 ta_agent MCP server mode | 已完成 | `ta-agent-mcp/` 5 个工具    |
| ✅ P0 Proma 端 MCP 配置        | 已完成 | IPC + Preload + UI 状态检测 |
| ✅ P0 验证工具可调通           | 已完成 | 工具调用测试通过            |

**设计变更（2026-06-07）**：~~"P0 Python 嵌进打包"~~ 已删除，改为用户手动安装 Python + ta-agent-mcp。

### P1 阶段 ✅ 已完成

| 任务                         | 状态   | 备注                                   |
| ---------------------------- | ------ | -------------------------------------- |
| ✅ P1 ModeManager + 顶层 Tab | 已完成 | `TopLevelModeTab` + `topLevelModeAtom` |
| ✅ P1 模式互斥 + 后台跑完    | 已完成 | ModeManager 锁 + PushNotification      |
| ✅ P1 switch_mode 工具       | 已完成 | 工具定义 + 验证函数                    |

### P2 阶段

| 任务                            | 状态       | 备注                                                                  |
| ------------------------------- | ---------- | --------------------------------------------------------------------- |
| ✅ P2 资产库 SQLite 直读 + UI   | 已完成     | better-sqlite3 + 列表/搜索/统计                                       |
| ✅ P2 TA 模式 UI 框架           | 已完成     | 4 个面板 Mock 数据                                                    |
| ✅ P2 ReviewQueue 连接真实数据  | 已完成     | IPC + Preload + UI 接入 SQLite                                        |
| ✅ P2 记忆 5 层 + FTS5 基础实现 | 已完成     | MemoryLayerService + MemoryMonitorPanel UI                            |
| ✅ P2 Pipeline 连接真实数据     | **已完成** | PipelineService + IPC + UI 接入 JSONL（2026-06-10）                   |
| ✅ P2 记忆自进化机制            | **已完成** | NudgeService + ReflectService + ScheduledCleanupService（2026-06-11） |

### 后续优化（不进 MVP）

| 任务                                   | 状态       | 备注                                                                                              |
| -------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------- |
| ✅ Agent 消息排队机制                  | **已完成** | Enter 排队 / Shift+Enter 打断（决策 #15，2026-06-09 实现）                                        |
| ✅ Chat/Agent 切换器迁移               | **已完成** | SettingsPanel 顶部 SegmentedControl（2026-06-09）                                                 |
| ✅ **P3 Token 统计 / Cache 命中率 UI** | **已完成** | TokenStatsPanel + 累计 atoms（2026-06-10）                                                        |
| ✅ **使用统计页面**                    | **已完成** | UsageStatsSettings + 按模型/时间范围统计（2026-06-10）                                            |
| ✅ **MCP 设置页面集成**                | **已完成** | BuiltinMcpRecommendations 组件 + 分类展示 + 一键安装（2026-06-11）                                |
| ✅ **Agent 对话智能引导**              | **已完成** | TA 意图检测 + toast 提示 + 引导安装（2026-06-11）                                                 |
| ✅ **`/btw` 侧面提问**                 | **已完成** | 上下文共享（20 轮 history）+ 分叉到新会话 + 浮窗触发（流式期间/旁注按钮）+ 不进历史（2026-06-11） |

---

## 历史进度

### 2026-06-18

**产出**：关于页版本显示优化 + 自动检查更新

| 任务                   | 内容                                                                  |
| ---------------------- | --------------------------------------------------------------------- |
| 版本显示优化           | 关于页从 GitHub Release 获取最新版本，显示"新版本 vX.X.X 可用"提示   |
| 自动检查更新           | 进入关于页时自动触发更新检查（状态为 idle 时）                        |
| 代码改动               | `AboutSettings.tsx` HeroSection 新增 `getLatestRelease` 调用         |
| UpdateSection 自动检查 | 组件加载时检测 `status === 'idle'` 自动调用 `checkForUpdates()`      |
| **里程碑**             | **关于页版本信息与 GitHub Release 关联完成**                         |

### 2026-06-11（续四）

**产出**：测试框架修复 — `bun:test` → `vitest` 迁移

| 任务                  | 内容                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------- |
| vitest.config.ts      | 新建配置文件，添加路径别名 (`@/` → renderer, `@tagent/*`)                                |
| bun:test → vitest     | 22 个测试文件 import 从 `bun:test` 改为 `vitest`                                         |
| mock.module → vi.mock | 3 个文件（chat-service/channel-manager/bridge-model-utils）从 Bun mock API 迁移到 vitest |
| mock() → vi.fn()      | channel-manager.test.ts 中 Bun mock 函数改为 vitest vi.fn()                              |
| **验证**              | **22/22 测试文件通过，305 个测试全部绿色**                                               |

### 2026-06-11（续三）

**产出**：`/btw` 侧面提问功能完成

| 任务                    | 内容                                                                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BtwMessage 类型         | 侧面提问消息类型定义                                                                                                                                            |
| BTW_IPC_CHANNELS        | IPC 通道常量                                                                                                                                                    |
| btw-atoms               | 侧面提问状态管理 atoms                                                                                                                                          |
| BtwPanel                | 浮窗组件，显示对话界面                                                                                                                                          |
| BtwFloatingTrigger      | AI 流式期间在输入框上方显示"旁注"按钮，结束后 8 秒内仍可见                                                                                                      |
| AgentView 集成          | 检测 `/btw` 前缀自动发送；点击旁注按钮打开面板                                                                                                                  |
| btw-service             | 后端流式请求处理，不写入会话历史，复用主会话渠道/模型                                                                                                           |
| useGlobalAgentListeners | 监听流式事件更新消息                                                                                                                                            |
| **UI 优化**             | 右侧浮窗 `top-[10vh] bottom-[10vh]`，毛玻璃 `bg-background/70 backdrop-blur-xl`，`scrollbar-thin` 复合界面滚动条，`rounded-[17px]` 圆角（不与窗口控制按钮重合） |
| **上下文共享**          | 主会话 SDKMessage → ChatMessage 转换器；sendBtwMessage 接收 `sourceSessionId` 拉最近 20 轮作为 LLM history；tool_use 降级文字、tool_result 跳过                 |
| **Fork 到新会话**       | BtwPanel Header 分叉按钮（`↗` 图标）；点击后 createAgentSession + sendAgentMessage 注入"父会话 &session: 引用 + btw Q&A"作为新会话 initial user message         |
| **里程碑**              | **后续优化全部完成 + 对齐 Claude Code `/btw` 原生语义**                                                                                                         |

**Claude Code 原生定义对比**（参考其官方文档）：

| 维度          | Claude Code 原生            | 当前实现                                                               |
| ------------- | --------------------------- | ---------------------------------------------------------------------- |
| 上下文可见性  | **共享主会话完整 messages** | ✅ **最近 20 轮（user/assistant 文本）**                               |
| 模型/渠道     | 复用主会话                  | ✅ 复用                                                                |
| 工具访问      | 无                          | ✅ 无                                                                  |
| 不写历史      | ✅ dismissible overlay      | ✅ 浮窗                                                                |
| 并行于主 turn | ✅ 流式中也能开             | ✅ 架构级并行（独立 AbortController + 独立 fetch）                     |
| 分叉到新会话  | `f` 键分叉到新会话          | ✅ **Header `↗` 按钮 + createAgentSession + mentionedSessionIds 继承** |
| 提示缓存复用  | ✅ 复用父 cache             | ⚠️ 每次新 request（无 cache 复用）                                     |

> 全部核心语义已对齐 Claude Code，仅"提示缓存复用"待优化（需把父 session 的 cache key 透传到 btw 请求，复杂且依赖具体供应商实现）。

### 2026-06-11（续二）

**产出**：Agent 对话智能引导完成

| 任务                    | 内容                                                           |
| ----------------------- | -------------------------------------------------------------- |
| ta-intent-service       | 意图检测服务，识别 TA 关键词（mesh、texture、FBX、命名规范等） |
| 置信度分级              | 强/中/弱三级，弱匹配不提示减少干扰                             |
| 会话级标记              | 避免重复提示同一会话                                           |
| agent-orchestrator 集成 | workspaceSlug 赋值后检测，发送 IPC 事件                        |
| useGlobalAgentListeners | 监听事件，显示 toast 引导用户前往 TA 模式或设置                |
| **里程碑**              | **后续优化第 5 项完成**                                        |

### 2026-06-11（续）

**产出**：MCP 设置页面集成完成

| 任务                      | 内容                                                                       |
| ------------------------- | -------------------------------------------------------------------------- |
| BuiltinMcpRecommendations | 推荐组件，分通用/TA 专用两类展示                                           |
| 内置 MCP 列表             | context7、github、sequential-thinking、puppeteer、filesystem、ta-agent-mcp |
| 一键安装                  | 点击安装按钮自动填充表单，用户只需测试连接后启用                           |
| AgentSettings 集成        | MCP Tab 分"推荐 MCP"和"已配置 MCP"两区域                                   |
| **里程碑**                | **后续优化第 4 项完成**                                                    |

### 2026-06-11

**产出**：P2 记忆自进化机制完成

| 任务                    | 内容                                                       |
| ----------------------- | ---------------------------------------------------------- |
| NudgeService            | 每 5 turn 检测用户行为模式（行为重复/事实重复/显式纠正）   |
| Nudge IPC + Preload     | `GET_PENDING_NUDGES` / `RESPOND_NUDGE` / `onNudgeEvent`    |
| NudgeToast              | 用户友好的 toast 通知组件，支持"记住"/"不记"操作           |
| ReflectService          | 每日 03:00（或启动时 >36h）提炼洞察写入 L5                 |
| ScheduledCleanupService | 每周日 04:00（或启动时 >8 天）归档 L4 / 压缩 L3 / LRU 标记 |
| 主进程集成              | 在 bootstrap 中初始化所有记忆服务                          |
| **里程碑**              | **P2 阶段全部完成**                                        |

### 2026-06-10（续三）

**产出**：Token 统计持久化 + Context 圆圈修复

| 任务               | 内容                                                  |
| ------------------ | ----------------------------------------------------- |
| Token 统计持久化   | `getSessionTokenStats` IPC 从 JSONL 恢复历史统计      |
| AgentView 加载统计 | 打开会话时自动填充 `sessionTokenStatsAtom`            |
| Context 圆圈修复   | `complete` 事件同步更新 `streamingStates.inputTokens` |
| 模型 ID 提取修复   | 从 `assistant` 消息提取 `_channelModelId`             |
| ContextWindow 推断 | 扩展主流模型支持（GLM/GPT-4o/Qwen/Gemini/Llama 等）   |

### 2026-06-10（续二）

**产出**：使用统计页面完成

| 任务               | 内容                                    |
| ------------------ | --------------------------------------- |
| UsageStatsService  | 从会话文件统计 token 使用（按模型聚合） |
| UsageStatsSettings | 设置页新增"使用统计"Tab                 |
| 时间范围筛选       | 今日/本周/本月/全部                     |
| 模型统计卡片       | 每个模型的 token 消耗、费用、缓存节省   |
| IPC + Preload      | `USAGE_STATS_IPC_CHANNELS.GET_OVERVIEW` |
| **里程碑**         | **P3 阶段两项任务完成**                 |

### 2026-06-10（续）

**产出**：P3 Token 统计 / Cache 命中率 UI 完成

| 任务              | 内容                                                       |
| ----------------- | ---------------------------------------------------------- |
| 累计 token atoms  | `sessionTokenStatsAtom` + `currentSessionTokenStatsAtom`   |
| 缓存命中率 atom   | `cacheHitRateAtom`（派生：cacheRead / totalInput）         |
| 成本明细 atom     | `costBreakdownAtom`（待模型定价数据细化）                  |
| TokenStatsPanel   | 会话页底部显示输入/输出/缓存命中/费用/轮数（通用模式专用） |
| usage_update 累计 | `useGlobalAgentListeners` 内累计 token 统计                |
| **里程碑**        | **P3 阶段首项任务完成**                                    |

### 2026-06-10

**产出**：P2 Pipeline 流水线数据接入完成

| 任务            | 内容                                                   | Commit     |
| --------------- | ------------------------------------------------------ | ---------- |
| Pipeline Schema | `PipelineRun` 类型定义 + `PIPELINE_IPC_CHANNELS` 常量  | `4d8c9651` |
| PipelineService | 读取/写入/追加 `pipeline_runs.jsonl`，支持 CRUD 和统计 | `4d8c9651` |
| IPC + Preload   | 7 个 IPC 处理器 + Preload API                          | `4d8c9651` |
| UI 连接         | `PipelinePanel` 和 `TASidebar.Pipeline` 接入真实数据   | `4d8c9651` |
| **里程碑**      | **P2 阶段 5/6 任务完成，仅剩记忆自进化**               |

### 2026-06-09

**产出**：TA 模式 UI 重构 + 会话子系统 + 决策 #15 落地 + Chat/Agent 切换器迁移（共 13 个 commit）

| 任务                  | 内容                                                                                                                                        | Commit                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 侧边栏 rail 改造      | FunctionalRail TA 模式显示 6 个图标（会话/资产库/审核/流水线/记忆/配置），TATabBar 移到主区顶部                                             | `24fb6ea4`             |
| TA 会话存储           | `AgentSessionMeta` 加 `mode: 'general' \| 'ta'` 字段；list/create IPC 透传 mode；`taSessionsAtom` 派生过滤                                  | `24fb6ea4`             |
| TA 模式主区           | 5 个模块面板（资产/审核/流水线/记忆/配置）；TA 模式选『会话』走 `GeneralMainArea` 路径                                                      | `f2265661`             |
| 模式独立 UI           | 隐藏工作区控件（TA 模式不显示 Briefcase / 工作区 Popover）                                                                                  | `598745da`             |
| 模式独立数据          | 新建 TA 会话自动打 `mode='ta'`；通用模式过滤掉 TA 会话                                                                                      | `664b5415`, `b424c6e1` |
| per-mode 状态         | `activeTabIdByModeAtom` + `activeRailItemAtom` 改为按 mode 派生；独立 localStorage key                                                      | `9cb5090e`, `61dd34e1` |
| 老逻辑清理            | 删除 FunctionalRail 内 `useEffect` 重置 rail（覆盖了 per-mode 记忆）                                                                        | `704c97bd`             |
| UI 简化               | 会话列表项删除工作区名徽标                                                                                                                  | `010952be`             |
| **TA 工具自动注入**   | `injectTATools` 把 5 个 in-process ta-tools 包装成 SDK MCP server `tagent-ta`；`buildSystemPrompt` 在 `mode==='ta'` 时 push TA 视角 section | `38eadda0`             |
| **决策 #15 落地**     | Enter → priority='next' 排队；Shift+Enter → priority='now' + interrupt 软中断                                                               | `67e482c5`             |
| **Chat/Agent 切换器** | SettingsPanel 顶部加 SegmentedControl；TA 模式隐藏；LeftSidebar 删死变量                                                                    | `7a8580f3`             |
| **验证清单**          | `docs/verification-2026-06-09.md` 完整回归手册                                                                                              | `10babab3`             |
| **ESLint 清理**       | import order 规范化（25 文件）+ LeftSidebar/FunctionalRail import-type 修复                                                                 | `8352a7f1`             |
| **里程碑**            | **TA 模式 UI / 数据隔离 / 工具注入 闭环** + **决策 #15 实现** + **Chat/Agent 切换器迁移**                                                   |

### 2026-06-08

**产出**：P0 阶段完成 — TA MCP Server 工具验证通过

| 任务         | 内容                                             |
| ------------ | ------------------------------------------------ |
| MCP 启动修复 | 添加 `__main__.py` 支持 `python -m ta_agent_mcp` |
| 工具测试     | `tagent__check_mesh_budget` 返回正确结果         |
| 应用测试     | 启动成功，运行时检测 + 渠道验证正常              |
| **里程碑**   | **P0 MVP 阶段完成，进入 P1 阶段**                |

### 2026-06-07（续四）

**产出**：新增 `/btw` 侧面提问功能规划

| 任务     | 内容                                                     |
| -------- | -------------------------------------------------------- |
| 功能调研 | Claude Code `/btw` 功能分析（来源：hubwiz 博客）         |
| 源码检查 | Claude Code 开源仓库无核心实现，需自行开发               |
| 功能设计 | 覆盖层显示 + 不进历史 + 无工具访问 + 复用主会话渠道/模型 |
| 预估工时 | 2-3 天                                                   |

### 2026-06-07（续三）

**产出**：设计决策 #15 — Agent 消息排队机制

| 任务     | 内容                                         |
| -------- | -------------------------------------------- |
| 新决策   | 决策 #15：默认排队，Shift+Enter 打断         |
| 设计动机 | 用户发送消息时不轻易打断正在执行的任务       |
| 交互设计 | Enter → 加入队列；Shift+Enter → 打断当前任务 |
| 文档更新 | §2 关键决策表新增 #15                        |

### 2026-06-07（续二）

**产出**：设计文档更新 — Python 安装方式变更

| 任务     | 内容                                             |
| -------- | ------------------------------------------------ |
| 设计变更 | 决策 #5：~~Python 嵌入打包~~ → 用户手动安装      |
| 设计文档 | §10.1 P0 阶段删除"Python 嵌进打包"任务           |
| MVP 范围 | §10.2 新增 2 项延后功能（MCP 设置页 / 智能引导） |
| 原因     | 用户选择"保持手动安装"更灵活，避免打包体积膨胀   |

### 2026-06-07（续）

**产出**：TA MCP Server 集成完成 + P2 TA 模式 UI 框架

| 任务               | 内容                                                                         |
| ------------------ | ---------------------------------------------------------------------------- |
| TA MCP Server 测试 | 11 个 pytest 测试全部通过                                                    |
| IPC 通道定义       | `AGENT_IPC_CHANNELS` 新增 4 个 TA MCP 通道                                   |
| 后端服务           | `ta-mcp-service.ts` 实现 Python 检测 + MCP 配置管理                          |
| Preload API        | 新增 `getTAMcpStatus` / `isTAMcpConfigured` / `enableTAMcp` / `disableTAMcp` |
| TAModeView         | 连接真实 MCP 状态检测 + 一键启用按钮                                         |
| P2 UI 框架         | 4 个 TA 模式面板（资产库/审核/流水线/配置）Mock 数据 MVP                     |
| 文档标注           | PROGRESS.md 按 §10.1 阶段重新划分任务                                        |

### 2026-06-07

**产出**：P1-3 完成 + 图标清理 + 文档更新

| 任务            | 内容                                                                          |
| --------------- | ----------------------------------------------------------------------------- |
| P1-3 客户端压缩 | ✅ 已完整实现（压缩逻辑 + IPC + UI + 16 单测）                                |
| 图标清理        | 删除 16 个 proma 旧 logo 变体，重画 icon.svg（icosahedron），重打包 icon.icns |
| dev-stop.bat    | 中文注释改英文，解决 CMD 编码乱码问题                                         |
| dev.bat         | 同上                                                                          |
| 文档更新        | CLAUDE.md 修正品牌命名，创建 PROGRESS.md                                      |

### 2026-06-06

**产出**：26 个 commit，10 个设计章节，93 个单元测试

#### 1. Tier 1+T2 品牌清理（10 commit）

| Commit    | 改动                                      | 文件数 |
| --------- | ----------------------------------------- | ------ |
| `8e5e9ab` | `proma-file://` → `tagent-file://`        | 6      |
| `05c525c` | `~/.proma-dev/` → `~/.tagent-dev/`        | 4      |
| `d6c4e32` | `appId: com.proma.app` → `com.tagent.app` | 1      |
| `935064e` | 扩展名 `proma-*` → `tagent-*`             | 8      |
| `7018bba` | skill `proma-coach` → `tagent-coach`      | 1      |
| `9b81d9e` | in-app state / DOM / URL                  | 51     |
| `7c56f97` | Logo 资源文件                             | 19     |
| `8baaee2` | yml + package.json                        | 5      |
| `e9d05d9` | `~/.proma/` → `~/.tagent/`                | 45     |

#### 2. 设计文档补完（6 commit, 决策 #7-#12）

| 决策 | 内容                               |
| ---- | ---------------------------------- |
| #7   | TA 模式数据布局（`~/.tagent/ta/`） |
| #8   | 缓存机制 + 目录规范                |
| #9   | 缓存层 C1-C5 命名                  |
| #10  | 记忆自进化（L0-L5）                |
| #11  | 工作区 UI 重构（D 方案 v2）        |
| #12  | Context 管理机制（7 项）           |

#### 3. §8.4 Context 管理 6/7 实现

| 优先级   | 改动                              | 状态    |
| -------- | --------------------------------- | ------- |
| P0-1     | 动态 token 预算                   | ✅      |
| P0-2     | model 验证（启动 hook + UI 按钮） | ✅      |
| P1-1     | tool summary 截断                 | ✅      |
| P1-2     | 图片 placeholder                  | ✅      |
| P2-1     | Nudges 80%/90%                    | ✅      |
| P2-2     | 圆环 3 态颜色                     | ✅      |
| **P1-3** | **客户端 compact_session 工具**   | ❌ 待做 |

---

## 关键设计决策

### 命名空间

- **L0-L5**：记忆层
- **C1-C5**：缓存层（避免与 L 冲突）

### 数据目录

- 通用模式：`~/.tagent/`
- TA 模式：`~/.tagent/ta/`
- Electron userData：`~/.tagent[-dev]/electron-userdata/`

### 品牌约束

- 产品名：**TAgent**
- 包名：`@tagent/*`
- 数据目录：`~/.tagent/`
- ❌ 永不使用 "Proma"

---

## 关键代码位置

| 内容                 | 位置                                                                         |
| -------------------- | ---------------------------------------------------------------------------- |
| model 验证           | `main/lib/channel-manager.ts`                                                |
| 启动 hook            | `main/lib/runtime-init.ts`                                                   |
| 动态 token 预算      | `main/lib/agent-context-utils.ts`                                            |
| Agent 编排           | `main/lib/agent-orchestrator.ts`                                             |
| 消息排队（决策 #15） | `main/lib/agent-orchestrator.ts` `queueMessage`（priority: 'now' \| 'next'） |
| TA 工具集注入        | `main/lib/agent-orchestrator.ts` `injectTATools`                             |
| TA 内置工具          | `main/lib/ta-tools/`                                                         |
| TA system prompt     | `main/lib/agent-prompt-builder.ts` `SystemPromptContext.mode`                |
| TA MCP Server        | `apps/electron/default-mcp/ta-agent-mcp/`                                  |
| 顶层模式切换         | `renderer/atoms/app-mode.ts` `topLevelModeAtom`                              |
| Chat/Agent 切换      | `renderer/components/settings/SettingsPanel.tsx` `SettingsModeSwitcher`      |
| per-mode rail 记忆   | `renderer/atoms/app-mode.ts` `activeRailItemAtom` (派生)                     |
| per-mode tab 记忆    | `renderer/atoms/tab-atoms.ts` `activeTabIdAtom` (派生)                       |
| TA 会话数据隔离      | `renderer/atoms/agent-atoms.ts` `taSessionsAtom`                             |
| 模式切换路由         | `renderer/components/tabs/MainArea.tsx`                                      |
| TA 模式 UI           | `renderer/components/ta/` (TASidebar.\* + TAWelcomePanel)                    |
| Token 统计           | `renderer/atoms/agent-atoms.ts` `sessionTokenStatsAtom`                      |
| Context 圆圈         | `renderer/components/agent/ContextUsageBadge.tsx`                            |
| 使用统计服务         | `main/lib/usage-stats-service.ts`                                            |
| 使用统计页面         | `renderer/components/settings/UsageStatsSettings.tsx`                        |
| 验证清单             | `docs/verification-2026-06-09.md`                                            |
| 单测                 | `main/lib/*.test.ts`                                                         |

---

## 用户已拍板决策（不可逆）

| 决策                          | 内容                                                                                                                         |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 品牌策略                      | 全清 "proma" 标识                                                                                                            |
| 数据丢失                      | 接受（不做迁移脚本）                                                                                                         |
| 目录名                        | `F:\TAgent_General\`                                                                                                         |
| TA 数据根                     | `~/.tagent/ta/`                                                                                                              |
| 命名空间                      | 记忆 L / 缓存 C 分开                                                                                                         |
| context 验证                  | 启动时 + UI 双触发                                                                                                           |
| 工作区 UI                     | D 方案 v2                                                                                                                    |
| **Python 安装方式**           | **手动安装**（不嵌入打包，2026-06-07 拍板）                                                                                  |
| **Agent 消息排队**            | **默认排队，Shift+Enter 打断**（2026-06-07 拍板，2026-06-09 实现）                                                           |
| **TA 模式会话数据隔离**       | **同表不同 mode 字段**（`AgentSessionMeta.mode`），切模式互不可见（2026-06-09 拍板）                                         |
| **TA 模式 UI 与通用模式分离** | **TA 模式 FunctionalRail 单独 6 个图标**，主区 5 个模块面板（无 TabBar），左栏 5 个概览面板；通用模式不变（2026-06-09 拍板） |
| **TA 会话区复用通用模式布局** | **TA 模式选『会话』走 GeneralMainArea 路径**（顶部 TabBar + 草稿/会话 tab），数据按 mode 隔离（2026-06-09 拍板）             |
| **Chat/Agent 切换器位置**     | **SettingsPanel 顶部 SegmentedControl**（不在 LeftSidebar，2026-06-09 拍板）                                                 |

---

## 不要碰的清单

- ❌ `proma-thinking/` 目录
- ❌ Tier 2 注释里 125+ 处 "Proma" 引用
- ❌ F:\Proma 拉新东西（legacy 仓库）

---

## 新 Agent 上手流程

1. 读 `CLAUDE.md` — 项目身份、架构、约束
2. 读本文件 — 当前进度
3. 读 `docs/plans/2026-06-05-tagent-fusion-design.md` — 完整设计
4. 问用户确认下一步

**第一句话**：

```
我已读完 CLAUDE.md 和 PROGRESS.md，了解项目当前状态。
请问接下来需要我做什么？
```
