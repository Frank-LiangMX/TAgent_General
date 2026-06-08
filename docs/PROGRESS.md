# TAgent 项目进度追踪

> **单文件持续更新** — 新 Agent 读此文件即可了解项目状态
> **设计文档**：`docs/plans/2026-06-05-tagent-fusion-design.md`

---

## 当前状态（2026-06-08）

**阶段**：P2 阶段开发中

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
| 🟡 P2 Pipeline 连接真实数据 | 待做 | 需要 pipeline_runs.jsonl 解析服务（工作量较大，MVP 可暂缓）|
| 🟡 P2 记忆自进化机制 | 待做 | Nudges / Reflect / Scheduled Cleanup（后续阶段）|

### 后续优化（不进 MVP）
| 任务 | 状态 | 备注 |
|------|------|------|
| 🔵 MCP 设置页面集成 | 规划中 | 内置 MCP 分类展示 + 一键安装指引 |
| 🔵 Agent 对话智能引导 | 规划中 | 检测 TA 相关意图 + 主动提示安装 |
| 🔵 Agent 消息排队机制 | 规划中 | 默认排队，Shift+Enter 打断（决策 #15）|
| 🔵 `/btw` 侧面提问 | 规划中 | 并行提问、覆盖层显示、不进历史（预估 2-3 天）|

---

## 历史进度

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
| TA 内置工具 | `main/lib/ta-tools/` |
| TA MCP Server | `ta-agent-mcp/` |
| 顶层模式切换 | `renderer/components/app-shell/TopLevelModeTab.tsx` |
| TA 模式 UI | `renderer/components/ta/` |
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
| **Agent 消息排队** | **默认排队，Shift+Enter 打断**（2026-06-07 拍板）|

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