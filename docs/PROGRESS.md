# TAgent 项目进度追踪

> **单文件持续更新** — 新 Agent 读此文件即可了解项目状态
> **设计文档**：`docs/plans/2026-06-05-tagent-fusion-design.md`

---

## 当前状态（2026-06-09）

**阶段**：P2 阶段开发中，TA 模式 UI + 工具闭环

**已完成**：
- ✅ Tier 1+2 品牌清理（全清 "proma" 标识 → "tagent"）
- ✅ §8.4 Context 管理 **7/7 项全部实现**
- ✅ ESLint 9 升级 + 434 warnings 清理
- ✅ 305 个单元测试
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
  - 后端服务：`ta-mcp-service.ts`（Python 环境检测 + MCP 配置管理）
  - Preload API：`getTAMcpStatus` / `isTAMcpConfigured` / `enableTAMcp` / `disableTAMcp`
  - UI 状态显示：运行中（绿）/ 未配置（黄）/ 未安装（红）+ 一键启用按钮
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
| 任务 | 状态 | 备注 |
|------|------|------|
| ✅ P0 品牌替换 | 已完成 | `@proma/*` → `@tagent/*` |
| ✅ P0 ta_agent MCP server mode | 已完成 | `ta-agent-mcp/` 5 个工具 |
| ✅ P0 Proma 端 MCP 配置 | 已完成 | IPC + Preload + UI 状态检测 |
| ✅ P0 验证工具可调通 | 已完成 | 工具调用测试通过 |

**设计变更（2026-06-07）**：~~"P0 Python 嵌进打包"~~ 已删除，改为用户手动安装 Python + ta-agent-mcp。

### P1 阶段 ✅ 已完成
| 任务 | 状态 | 备注 |
|------|------|------|
| ✅ P1 ModeManager + 顶层 Tab | 已完成 | `TopLevelModeTab` + `topLevelModeAtom` |
| ✅ P1 模式互斥 + 后台跑完 | 已完成 | ModeManager 锁 + PushNotification |
| ✅ P1 switch_mode 工具 | 已完成 | 工具定义 + 验证函数 |

### P2 阶段
| 任务 | 状态 | 备注 |
|------|------|------|
| ✅ P2 资产库 SQLite 直读 + UI | 已完成 | better-sqlite3 + 列表/搜索/统计 |
| ✅ P2 TA 模式 UI 框架 | 已完成 | 4 个面板 Mock 数据 |
| ✅ P2 ReviewQueue 连接真实数据 | 已完成 | IPC + Preload + UI 接入 SQLite |
| ✅ P2 记忆 5 层 + FTS5 基础实现 | 已完成 | MemoryLayerService + MemoryMonitorPanel UI |
| ✅ P2 Pipeline 连接真实数据 | **已完成** | PipelineService + IPC + UI 接入 JSONL（2026-06-10）|
| 🟡 P2 记忆自进化机制 | 待做 | Nudges / Reflect / Scheduled Cleanup（后续阶段）|

### 后续优化（不进 MVP）
| 任务 | 状态 | 备注 |
|------|------|------|
| ✅ Agent 消息排队机制 | **已完成** | Enter 排队 / Shift+Enter 打断（决策 #15，2026-06-09 实现）|
| ✅ Chat/Agent 切换器迁移 | **已完成** | SettingsPanel 顶部 SegmentedControl（2026-06-09）|
| ✅ **P3 Token 统计 / Cache 命中率 UI** | **已完成** | TokenStatsPanel + 累计 atoms（2026-06-10）|
| 🔵 MCP 设置页面集成 | 规划中 | 内置 MCP 分类展示 + 一键安装指引 |
| 🔵 Agent 对话智能引导 | 规划中 | 检测 TA 相关意图 + 主动提示安装 |
| 🔵 `/btw` 侧面提问 | 规划中 | 并行提问、覆盖层显示、不进历史（预估 2-3 天）|

---

## 历史进度

### 2026-06-10（续）

**产出**：P3 Token 统计 / Cache 命中率 UI 完成

| 任务 | 内容 |
|------|------|
| 累计 token atoms | `sessionTokenStatsAtom` + `currentSessionTokenStatsAtom` |
| 缓存命中率 atom | `cacheHitRateAtom`（派生：cacheRead / totalInput）|
| 成本明细 atom | `costBreakdownAtom`（待模型定价数据细化）|
| TokenStatsPanel | 会话页底部显示输入/输出/缓存命中/费用/轮数（通用模式专用）|
| usage_update 累计 | `useGlobalAgentListeners` 内累计 token 统计 |
| **里程碑** | **P3 阶段首项任务完成** |

### 2026-06-10

**产出**：P2 Pipeline 流水线数据接入完成

| 任务 | 内容 | Commit |
|------|------|--------|
| Pipeline Schema | `PipelineRun` 类型定义 + `PIPELINE_IPC_CHANNELS` 常量 | `4d8c9651` |
| PipelineService | 读取/写入/追加 `pipeline_runs.jsonl`，支持 CRUD 和统计 | `4d8c9651` |
| IPC + Preload | 7 个 IPC 处理器 + Preload API | `4d8c9651` |
| UI 连接 | `PipelinePanel` 和 `TASidebar.Pipeline` 接入真实数据 | `4d8c9651` |
| **里程碑** | **P2 阶段 5/6 任务完成，仅剩记忆自进化** |

### 2026-06-09

**产出**：TA 模式 UI 重构 + 会话子系统 + 决策 #15 落地 + Chat/Agent 切换器迁移（共 13 个 commit）

| 任务 | 内容 | Commit |
|------|------|--------|
| 侧边栏 rail 改造 | FunctionalRail TA 模式显示 6 个图标（会话/资产库/审核/流水线/记忆/配置），TATabBar 移到主区顶部 | `24fb6ea4` |
| TA 会话存储 | `AgentSessionMeta` 加 `mode: 'general' \| 'ta'` 字段；list/create IPC 透传 mode；`taSessionsAtom` 派生过滤 | `24fb6ea4` |
| TA 模式主区 | 5 个模块面板（资产/审核/流水线/记忆/配置）；TA 模式选『会话』走 `GeneralMainArea` 路径 | `f2265661` |
| 模式独立 UI | 隐藏工作区控件（TA 模式不显示 Briefcase / 工作区 Popover） | `598745da` |
| 模式独立数据 | 新建 TA 会话自动打 `mode='ta'`；通用模式过滤掉 TA 会话 | `664b5415`, `b424c6e1` |
| per-mode 状态 | `activeTabIdByModeAtom` + `activeRailItemAtom` 改为按 mode 派生；独立 localStorage key | `9cb5090e`, `61dd34e1` |
| 老逻辑清理 | 删除 FunctionalRail 内 `useEffect` 重置 rail（覆盖了 per-mode 记忆） | `704c97bd` |
| UI 简化 | 会话列表项删除工作区名徽标 | `010952be` |
| **TA 工具自动注入** | `injectTATools` 把 5 个 in-process ta-tools 包装成 SDK MCP server `tagent-ta`；`buildSystemPrompt` 在 `mode==='ta'` 时 push TA 视角 section | `38eadda0` |
| **决策 #15 落地** | Enter → priority='next' 排队；Shift+Enter → priority='now' + interrupt 软中断 | `67e482c5` |
| **Chat/Agent 切换器** | SettingsPanel 顶部加 SegmentedControl；TA 模式隐藏；LeftSidebar 删死变量 | `7a8580f3` |
| **验证清单** | `docs/verification-2026-06-09.md` 完整回归手册 | `10babab3` |
| **ESLint 清理** | import order 规范化（25 文件）+ LeftSidebar/FunctionalRail import-type 修复 | `8352a7f1` |
| **里程碑** | **TA 模式 UI / 数据隔离 / 工具注入 闭环** + **决策 #15 实现** + **Chat/Agent 切换器迁移** |

### 2026-06-08

**产出**：P0 阶段完成 — TA MCP Server 工具验证通过

| 任务 | 内容 |
|------|------|
| MCP 启动修复 | 添加 `__main__.py` 支持 `python -m ta_agent_mcp` |
| 工具测试 | `tagent__check_mesh_budget` 返回正确结果 |
| 应用测试 | 启动成功，运行时检测 + 渠道验证正常 |
| **里程碑** | **P0 MVP 阶段完成，进入 P1 阶段** |

### 2026-06-07（续四）

**产出**：新增 `/btw` 侧面提问功能规划

| 任务 | 内容 |
|------|------|
| 功能调研 | Claude Code `/btw` 功能分析（来源：hubwiz 博客）|
| 源码检查 | Claude Code 开源仓库无核心实现，需自行开发 |
| 功能设计 | 并行提问 + 覆盖层显示 + 不进历史 + 无工具访问 |
| 预估工时 | 2-3 天 |

### 2026-06-07（续三）

**产出**：设计决策 #15 — Agent 消息排队机制

| 任务 | 内容 |
|------|------|
| 新决策 | 决策 #15：默认排队，Shift+Enter 打断 |
| 设计动机 | 用户发送消息时不轻易打断正在执行的任务 |
| 交互设计 | Enter → 加入队列；Shift+Enter → 打断当前任务 |
| 文档更新 | §2 关键决策表新增 #15 |

### 2026-06-07（续二）

**产出**：设计文档更新 — Python 安装方式变更

| 任务 | 内容 |
|------|------|
| 设计变更 | 决策 #5：~~Python 嵌入打包~~ → 用户手动安装 |
| 设计文档 | §10.1 P0 阶段删除"Python 嵌进打包"任务 |
| MVP 范围 | §10.2 新增 2 项延后功能（MCP 设置页 / 智能引导）|
| 原因 | 用户选择"保持手动安装"更灵活，避免打包体积膨胀 |

### 2026-06-07（续）

**产出**：TA MCP Server 集成完成 + P2 TA 模式 UI 框架

| 任务 | 内容 |
|------|------|
| TA MCP Server 测试 | 11 个 pytest 测试全部通过 |
| IPC 通道定义 | `AGENT_IPC_CHANNELS` 新增 4 个 TA MCP 通道 |
| 后端服务 | `ta-mcp-service.ts` 实现 Python 检测 + MCP 配置管理 |
| Preload API | 新增 `getTAMcpStatus` / `isTAMcpConfigured` / `enableTAMcp` / `disableTAMcp` |
| TAModeView | 连接真实 MCP 状态检测 + 一键启用按钮 |
| P2 UI 框架 | 4 个 TA 模式面板（资产库/审核/流水线/配置）Mock 数据 MVP |
| 文档标注 | PROGRESS.md 按 §10.1 阶段重新划分任务 |

### 2026-06-07

**产出**：P1-3 完成 + 图标清理 + 文档更新

| 任务 | 内容 |
|------|------|
| P1-3 客户端压缩 | ✅ 已完整实现（压缩逻辑 + IPC + UI + 16 单测）|
| 图标清理 | 删除 16 个 proma 旧 logo 变体，重画 icon.svg（icosahedron），重打包 icon.icns |
| dev-stop.bat | 中文注释改英文，解决 CMD 编码乱码问题 |
| dev.bat | 同上 |
| 文档更新 | CLAUDE.md 修正品牌命名，创建 PROGRESS.md |

### 2026-06-06

**产出**：26 个 commit，10 个设计章节，93 个单元测试

#### 1. Tier 1+T2 品牌清理（10 commit）

| Commit | 改动 | 文件数 |
|---|---|---|
| `8e5e9ab` | `proma-file://` → `tagent-file://` | 6 |
| `05c525c` | `~/.proma-dev/` → `~/.tagent-dev/` | 4 |
| `d6c4e32` | `appId: com.proma.app` → `com.tagent.app` | 1 |
| `935064e` | 扩展名 `proma-*` → `tagent-*` | 8 |
| `7018bba` | skill `proma-coach` → `tagent-coach` | 1 |
| `9b81d9e` | in-app state / DOM / URL | 51 |
| `7c56f97` | Logo 资源文件 | 19 |
| `8baaee2` | yml + package.json | 5 |
| `e9d05d9` | `~/.proma/` → `~/.tagent/` | 45 |

#### 2. 设计文档补完（6 commit, 决策 #7-#12）

| 决策 | 内容 |
|------|------|
| #7 | TA 模式数据布局（`~/.tagent/ta/`）|
| #8 | 缓存机制 + 目录规范 |
| #9 | 缓存层 C1-C5 命名 |
| #10 | 记忆自进化（L0-L5）|
| #11 | 工作区 UI 重构（D 方案 v2）|
| #12 | Context 管理机制（7 项）|

#### 3. §8.4 Context 管理 6/7 实现

| 优先级 | 改动 | 状态 |
|--------|------|------|
| P0-1 | 动态 token 预算 | ✅ |
| P0-2 | model 验证（启动 hook + UI 按钮）| ✅ |
| P1-1 | tool summary 截断 | ✅ |
| P1-2 | 图片 placeholder | ✅ |
| P2-1 | Nudges 80%/90% | ✅ |
| P2-2 | 圆环 3 态颜色 | ✅ |
| **P1-3** | **客户端 compact_session 工具** | ❌ 待做 |

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

| 内容 | 位置 |
|------|------|
| model 验证 | `main/lib/channel-manager.ts` |
| 启动 hook | `main/lib/runtime-init.ts` |
| 动态 token 预算 | `main/lib/agent-context-utils.ts` |
| Agent 编排 | `main/lib/agent-orchestrator.ts` |
| 消息排队（决策 #15）| `main/lib/agent-orchestrator.ts` `queueMessage`（priority: 'now' \| 'next'）|
| TA 工具集注入 | `main/lib/agent-orchestrator.ts` `injectTATools` |
| TA 内置工具 | `main/lib/ta-tools/` |
| TA system prompt | `main/lib/agent-prompt-builder.ts` `SystemPromptContext.mode` |
| TA MCP Server | `ta-agent-mcp/` |
| 顶层模式切换 | `renderer/atoms/app-mode.ts` `topLevelModeAtom` |
| Chat/Agent 切换 | `renderer/components/settings/SettingsPanel.tsx` `SettingsModeSwitcher` |
| per-mode rail 记忆 | `renderer/atoms/app-mode.ts` `activeRailItemAtom` (派生) |
| per-mode tab 记忆 | `renderer/atoms/tab-atoms.ts` `activeTabIdAtom` (派生) |
| TA 会话数据隔离 | `renderer/atoms/agent-atoms.ts` `taSessionsAtom` |
| 模式切换路由 | `renderer/components/tabs/MainArea.tsx` |
| TA 模式 UI | `renderer/components/ta/` (TASidebar.* + TAWelcomePanel) |
| 验证清单 | `docs/verification-2026-06-09.md` |
| 单测 | `main/lib/*.test.ts` |

---

## 用户已拍板决策（不可逆）

| 决策 | 内容 |
|------|------|
| 品牌策略 | 全清 "proma" 标识 |
| 数据丢失 | 接受（不做迁移脚本）|
| 目录名 | `F:\TAgent_General\` |
| TA 数据根 | `~/.tagent/ta/` |
| 命名空间 | 记忆 L / 缓存 C 分开 |
| context 验证 | 启动时 + UI 双触发 |
| 工作区 UI | D 方案 v2 |
| **Python 安装方式** | **手动安装**（不嵌入打包，2026-06-07 拍板）|
| **Agent 消息排队** | **默认排队，Shift+Enter 打断**（2026-06-07 拍板，2026-06-09 实现）|
| **TA 模式会话数据隔离** | **同表不同 mode 字段**（`AgentSessionMeta.mode`），切模式互不可见（2026-06-09 拍板）|
| **TA 模式 UI 与通用模式分离** | **TA 模式 FunctionalRail 单独 6 个图标**，主区 5 个模块面板（无 TabBar），左栏 5 个概览面板；通用模式不变（2026-06-09 拍板）|
| **TA 会话区复用通用模式布局** | **TA 模式选『会话』走 GeneralMainArea 路径**（顶部 TabBar + 草稿/会话 tab），数据按 mode 隔离（2026-06-09 拍板）|
| **Chat/Agent 切换器位置** | **SettingsPanel 顶部 SegmentedControl**（不在 LeftSidebar，2026-06-09 拍板）|

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
