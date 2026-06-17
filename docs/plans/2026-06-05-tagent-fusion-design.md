# TAgent 融合架构设计文档

> **状态**：Draft v0.1  
> **日期**：2026-06-05  
> **作者**：Proma Agent（与用户 Frank Danny 共同设计）  
> **路径**：`F:\TAgent_General\docs\plans\2026-06-05-tagent-fusion-design.md`

---

## 1. 目标

将 `F:\ta_agent`（自研 Python 游戏 TA 领域 Agent，54 个工具 + 资产库 + 语义搜索 + 三层记忆 + Blender/UE5 集成）的能力**重构融合**进 Proma 框架的产物——一个名为 **TAgent** 的 Electron 桌面应用（沿用 ta_agent 的品牌）。

融合后产品具备**两种顶层模式**：

- **通用模式**：Proma 现有能力（12 Provider + Claude Agent SDK + MCP + Skill + 飞书/钉钉/微信 Bridge + 完整 UI/设计系统）
- **TA 模式**：TAgent 工具链（54 领域工具 + 资产库 + 审核 + 流水线 + 项目配置）

两模式**完全独立**（记忆、工具、会话、配置各自一套），共享 Provider / 基础设施 / UI 框架。

**MVP 目标**（2 周）：ta_agent MCP server 跑通 + Proma 接 54 工具 + 顶层 Tab 切换 + 严格互斥 + 资产库 SQLite 直读。

---

## 2. 已拍板的关键决策

| #   | 决策点                         | 选择                                                                                                                                    |
| --- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 顶层 Tab 切换                  | **通用 / TA** 两 Tab；进"通用"后还是 Proma 现有 chat/agent/scratch                                                                      |
| 2   | 模式互斥                       | **严格互斥 + 后台跑完提示**（无并发 bug，长任务切走仍跑完，红点提示）                                                                   |
| 3   | Provider 共享度                | **Provider/Channel/API Key 全局共享**，MCP/Skill 模式独立                                                                               |
| 4   | Python 进程生命周期            | **进 TA 启，退 TA 后台保留，App 退出杀**                                                                                                |
| 5   | Python 进程生命周期 / 安装方式 | **进 TA 启，退 TA 后台保留，App 退出杀**；**用户手动安装 Python + ta-agent-mcp**（不嵌入打包，2026-06-07 用户拍板：保持手动安装更灵活） |
| 6   | TA UI 优先级                   | **资产库先**（直读 SQLite，列表/详情/搜索）                                                                                             |
| 7   | 跨模式切换                     | **switch_mode 伪工具**：TA 模式 LLM 建议切到通用，反之亦然                                                                              |
| 8   | 品牌                           | **TAgent**（替换所有 Proma 字样）                                                                                                       |
| 9   | 前端                           | **Proma 现有 React + 设计系统**（改底层逻辑）                                                                                           |
| 10  | 旧数据                         | **不迁移**                                                                                                                              |
| 11  | 记忆结构                       | **5 层 + 借鉴 hermes-agent / GenericAgent**（详见 §6）                                                                                  |
| 12  | OpenAI 协议                    | **MVP 用现有 12 Provider**，TA 模式走 Anthropic 兼容层                                                                                  |
| 13  | Token / 缓存                   | **已有 input/output/cache 字段**，新增 cacheHitRate 派生 atom                                                                           |
| 14  | 模式间 L0 共享                 | **默认不共享**，可手动开启"share user profile"开关                                                                                      |
| 15  | Agent 消息排队机制             | **默认排队，Shift+Enter 打断**：正常运行中发送消息 → 加入队列等待完成；Shift+Enter → 打断当前任务立即处理新消息（2026-06-07 用户拍板）  |
| 16  | SOUL 人格机制                  | **实现 SOUL.md 人格定义系统**，借鉴 Hermes，用户可自定义 Agent 性格/语气（2026-06-15 用户拍板，详见 §19）                               |

---

## 3. 架构总览

### 3.1 三个进程 + 一组共享文件

```
┌─────────────────────────────────────────────────────────┐
│ Proma Main Process (TS + Electron, 改名 @tagent)        │
│ ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│ │ Provider │  │  Agent   │  │   MCP    │  │  Mode   │ │
│ │ Adapter  │  │  SDK     │  │  Manager │  │  Mgr    │ │
│ │ (12 个)  │  │ (Claude) │  │ (动态)   │  │(通用/TA)│ │
│ └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
└────────────────────────┬────────────────────────────────┘
                         │ stdio (JSON-RPC)
┌────────────────────────┴────────────────────────────────┐
│ ta_agent MCP Server (Python, PyInstaller 打包)         │
│  ├─ 54 tools（FBX/贴图/命名/审核/记忆/...）             │
│  ├─ Asset Store (SQLite, tag_store/tags.db)            │
│  ├─ Memory System (5 层, FTS5)                         │
│  ├─ Blender subprocess                                 │
│  └─ UE5 JSONL bridge                                   │
└─────────────────────────────────────────────────────────┘
                         │ shared SQLite file
┌────────────────────────┴────────────────────────────────┐
│ Renderer (React + Jotai, 沿用 Proma 设计系统)          │
│  ├─ 顶层 Tab: 通用 / TA                                │
│  ├─ 通用模式 UI（chat/agent/scratch 全部保留）         │
│  └─ TA 模式 UI（资产库 / 审核 / 流水线 / 项目配置）     │
└─────────────────────────────────────────────────────────┘
```

### 3.2 关键边界

- **进程数恒定 2**（Proma + ta_agent），无第三个
- **资产数据库 = 文件共享**（不是 API 调用）——Proma 用 better-sqlite3 直读，写权只在 ta_agent 侧
- **模式状态隔离 = Jotai atom 命名空间**：`general.*` 与 `ta.*` 两套 atom tree 互不引用

### 3.3 TA 模式数据目录布局（2026-06-06 拍板）

**TA 模式的所有数据都集中在 `~/.tagent/ta/`**（跨平台统一根，与 TAgent 主配置 `~/.tagent/` 同级）。ta_agent MCP server 启动时通过环境变量 `TA_AGENT_DATA_DIR=~/.tagent/ta` 指向此目录（ta_agent 已有 `TA_AGENT_CONFIG_DIR` env 支持，见 `ta_agent/packages/core/project_config.py:363`，可复用）。

```
~/.tagent/ta/                          (跨平台统一根, macOS/Linux/Windows)
├── tag_store/                        # 资产库（设计 §3.1 已定）
│   └── tags.db                       # SQLite, TAgent UI 用 better-sqlite3 直读, ta_agent 拥有写权
├── configs/                          # 静态配置（用户写的、不学习的）
│   ├── app-config.json               # 工具路径：blender_path, llm_provider, llm_api_key
│   └── project/
│       └── {ProjectName}.yaml        # 资产规范 + 引擎路径：asset_types, naming_rules,
│                                     #   mesh_budgets, texture_budgets, import_presets,
│                                     #   source_paths.{blender,engine,models,textures}
├── memory/                           # 5 层记忆（与通用模式分开, 详见 §6）
│   ├── profile.md                    # L0 用户画像
│   ├── preferences.md                # L1 用户偏好
│   ├── insights.md                   # L2 核心洞察
│   ├── corrections.jsonl             # L3 用户纠错
│   ├── sessions.db                   # L4 历史会话 (SQLite + FTS5)
│   └── knowledge.md                  # L5 领域知识
├── ue5_bridge/                       # UE5 桥接配置（连接 / 凭据 / 状态）
├── sessions/index.json               # 会话索引
├── usage_log.jsonl                   # 用量日志（与 ta_agent 格式兼容, 见 §19.10）
└── pipeline_runs.jsonl               # 流水线执行历史
```

**写权矩阵**（避免 §3.2 的"脏写"风险）：

| 数据                      | 写权                         | 读权            | 说明                            |
| ------------------------- | ---------------------------- | --------------- | ------------------------------- |
| `tag_store/tags.db`       | **ta_agent MCP**             | TAgent UI 直读  | 写权独占, 避免并发覆盖          |
| `configs/app-config.json` | **TAgent UI** + ta_agent MCP | 双方都能读      | 用户改 blender_path 走 UI       |
| `configs/project/*.yaml`  | **TAgent UI** + ta_agent MCP | 双方都能读      | 项目设置向导走 UI               |
| `memory/*`                | **ta_agent MCP**             | TAgent UI 展示  | AI 学来的知识, 不让用户直接编辑 |
| `usage_log.jsonl`         | **ta_agent MCP**             | TAgent UI 展示  | 流水 append, 无冲突             |
| `ue5_bridge/`             | **TAgent UI**                | ta_agent MCP 读 | 凭据/连接配置, 用户一次性设     |

**与原 ta_agent 布局的差异**：

| 旧 (`~/.ta_agent/`)         | 新 (`~/.tagent/ta/`)    | 差异                                                 |
| --------------------------- | ----------------------- | ---------------------------------------------------- |
| `configs/`                  | `configs/`              | 同名同结构, 直接搬                                   |
| `tag_store/tags.db`         | `tag_store/tags.db`     | 同                                                   |
| `memory/{general,ta}/sops/` | `memory/` (TA 模式专用) | 不再拆 general/ta 模式目录, 因为整个根是 TA 模式专用 |
| `ue5_bridge/`               | `ue5_bridge/`           | 同                                                   |
| `sessions/index.json`       | `sessions/index.json`   | 同                                                   |
| `usage_log.jsonl`           | `usage_log.jsonl`       | 格式不变, 路径变                                     |
| `pipeline_runs.jsonl`       | `pipeline_runs.jsonl`   | 同                                                   |

**通用模式（chat/agent/scratch）的数据**继续在 `~/.tagent/` 根下（与 TA 模式完全分离）：

```
~/.tagent/
├── channels.json, conversations/, agent-sessions/, agent-workspaces/  # 通用模式（Proma 原生）
├── default-skills/, scratch-pad.md, settings.json, user-profile.json  # 通用模式设置
├── memory/                                                            # 通用模式 5 层记忆（独立于 ta/）
└── ta/                                                                # TA 模式专用（见上）
```

**与 §6 记忆 5 层的关系**：

- §6 描述的 5 层是**通用模式**的记忆，在 `~/.tagent/memory/`
- TA 模式有**自己独立**的 5 层记忆，在 `~/.tagent/ta/memory/`
- 两套记忆**默认不共享**（与决策 #14 一致："L0 共享 = 默认不共享, 可手动开启"）

**迁移策略**（M2 阶段, 不在 MVP 范围）：

- 一次性脚本：`mv ~/.ta_agent/* ~/.tagent/ta/`
- 检测：如果 `~/.ta_agent/configs/` 存在但 `~/.tagent/ta/configs/` 不存在, 启动时弹一次性迁移对话框
- ta_agent MCP server 启动时检查 `TA_AGENT_DATA_DIR` 是否设置, 没有就 fallback 到 `~/.ta_agent/`（向后兼容老用户）

### 3.4 缓存机制 + 目录规范（2026-06-06 拍板）

**问题**：现状有 3 个不相关的根目录散在不同位置：

- TAgent app data：`~/.tagent/`（TAgent 自己写）
- Electron userData：dev `%APPDATA%@tagent\electron-dev/`、prod `%APPDATA%\TAgent\`（Electron 内部）
- OS 临时：`%TEMP%\tagent-*\`（一次性临时）

用户心智不统一，找配置要分头查 3 处。

**决策 A1 + B2 + C1**（2026-06-06）：

#### 3.4.1 统一数据根

所有数据（不论 macOS/Linux/Windows）都在 `~/.tagent/` 根下，按"重要性 / 可重建性"分 4 类子目录：

```
~/.tagent/                            (跨平台统一根, 与 T2.4B 决策一致)
│
├── [现有数据, 见 §3.3 / config-paths.ts]  # channels, conversations, agent-sessions,
│                                          # agent-workspaces, default-skills, scratch-pad,
│                                          # settings.json, user-profile.json, memory/, ta/
│
├── cache/                             # C2 派生缓存 (可重建, 7 天 LRU 滚动)
│   ├── general/                       # 通用模式缓存
│   │   ├── http/                      # LLM API 响应缓存 (Cache-Control TTL, 默认 5min)
│   │   ├── thumbnails/                # 附件 / 聊天图片缩略图
│   │   ├── search-index/              # 全局搜索 FTS5 (跨对话)
│   │   └── model-icons/               # 模型 logo 缓存
│   ├── ta/                            # TA 模式缓存
│   │   ├── thumbnails/                # 资产缩略图 (Blender 渲染产物)
│   │   ├── blender-renders/           # Blender 渲染中间产物
│   │   ├── fts5/                      # tag_store FTS5 镜像
│   │   └── ue5-screenshots/           # UE5 桥接截图缓存
│   └── shared/                        # 跨模式共享
│       ├── installers/                # 自动更新下载的安装包 (安装后 24h 清)
│       ├── tools/                     # 下载的 Bun 等运行时 binary
│       └── http-common/               # 跨 Provider 共享的 HTTP 缓存
│
├── logs/                              # C3 日志 (单文件 50MB 滚动, 总 500MB 上限, 7-30 天)
│   ├── main.log                       # 主进程
│   ├── renderer.log                   # 渲染进程
│   ├── ta-agent-stdout.log            # ta_agent MCP server stdout
│   ├── ta-agent-stderr.log            # ta_agent MCP server stderr
│   ├── updater.log                    # 自动更新
│   └── crash/                         # 崩溃 dump
│
├── tmp/                               # C4 进程级临时 (1-3 天 LRU, 重启可清)
│   ├── previews/                      # 通用模式: PDF/Office 预览 HTML
│   ├── migration-import/              # 迁移解压临时
│   ├── screenshots/                   # 截图 HTML 临时
│   └── ta-blender/                    # TA 模式: Blender 临时文件
│
└── electron-userdata/                 # C5 Electron 内部 (OS 管, 别碰)
    ├── Cache/                         # Chromium HTTP 缓存
    ├── Code Cache/                    # V8 字节码缓存
    ├── GPUCache/
    ├── Local Storage/                 # devtools localStorage (不影响业务)
    └── Session Storage/
```

#### 3.4.2 关键变更：B2 — 合并 Electron userData

**现状**（散在 `%APPDATA%`）：

```js
// apps/electron/src/main/index.ts (dev)
if (!app.isPackaged) {
  app.setPath('userData', join(app.getPath('appData'), '@tagent/electron-dev'))
}
```

dev: `%APPDATA%@tagent\electron-dev\`（Windows）/ `~/.config/@tagent/electron-dev/`（Linux）
prod: 默认 = `%APPDATA%\TAgent\` / `~/.config/TAgent/`

**改后**（指向 `~/.tagent/electron-userdata/`）：

```js
// apps/electron/src/main/index.ts
import { homedir } from 'node:os'
const baseDir = app.isPackaged ? join(homedir(), '.tagent') : join(homedir(), '.tagent-dev')
app.setPath('userData', join(baseDir, 'electron-userdata'))
```

dev: `~/.tagent-dev/electron-userdata/`
prod: `~/.tagent/electron-userdata/`

**数据丢失影响**：

- 旧 Electron userData 在 `%APPDATA%` 下的 Chromium Session / GPU 缓存 / 自动更新状态会**丢失**
- 但这些**全部可重建**（GPU 缓存下次启动自动重生成，Session 重新登录即可，自动更新会重新检测）
- 真实损失 = 0（用户已经接受数据丢失原则）

#### 3.4.3 TA 模式 vs 通用模式 — 缓存对照

| 类别                   | 通用模式                                                                                                                              | TA 模式                                                                                      | 共用                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| **C1 数据** (永久)     | `~/.tagent/{channels, conversations, agent-sessions, agent-workspaces, default-skills, scratch-pad, settings, user-profile, memory}/` | `~/.tagent/ta/{tag_store, configs, memory, ue5_bridge, sessions, usage_log, pipeline_runs}/` | —                                                |
| **C2 缓存** (7 天 LRU) | `cache/general/{http, thumbnails, search-index, model-icons}/`                                                                        | `cache/ta/{thumbnails, blender-renders, fts5, ue5-screenshots}/`                             | `cache/shared/{installers, tools, http-common}/` |
| **C3 日志** (滚动)     | `logs/{main, renderer, updater}.log`                                                                                                  | `logs/{ta-agent-stdout, ta-agent-stderr}.log`                                                | `logs/crash/`                                    |
| **C4 临时** (1-3 天)   | `tmp/{previews, screenshots}/`                                                                                                        | `tmp/ta-blender/`                                                                            | `tmp/migration-import/`                          |
| **C5 Electron 内部**   | —                                                                                                                                     | —                                                                                            | `electron-userdata/{Cache, GPUCache, ...}/`      |

#### 3.4.4 缓存失效机制（C1：自动 LRU）

启动时 `cacheScanLRU()` 自动执行（无 UI 提示）：

| 缓存             | 失效触发                | 清理策略                                               |
| ---------------- | ----------------------- | ------------------------------------------------------ |
| **缩略图**       | 源文件 mtime 变化       | LRU 7 天，启动时扫描 `cache/*/thumbnails/`，删 >7 天的 |
| **FTS5 索引**    | 数据源写入              | 进程内写后触发 `INSERT INTO fts5`；不需失效清理        |
| **HTTP 响应**    | 显式 `Cache-Control` 头 | TTL 默认 5 分钟（可被 Provider 覆盖）                  |
| **预览 HTML**    | 一次性                  | 启动时清 >24h 的；用户主动关闭后立即删                 |
| **安装包**       | 用户"立即安装"后        | 安装成功后 24h 自动删；下载失败保留 7 天               |
| **Blender 渲染** | 资产 hash 变化          | 跟随资产生命周期，不主动清                             |
| **日志**         | 滚动写入                | 单文件 >50MB 或 >7 天滚动；总大小上限 500MB            |
| **tmp/**         | 启动时                  | 1-3 天 LRU 清理                                        |

**实现**（`apps/electron/src/main/lib/cache-maintenance.ts` 新文件）：

```ts
export async function cacheScanLRU(): Promise<CleanupStats> {
  const stats = { freedBytes: 0, deletedCount: 0, errors: [] }
  const now = Date.now()
  for (const [subdir, maxAgeMs] of [
    ['cache/general/thumbnails', 7 * 86400_000],
    ['cache/ta/thumbnails', 7 * 86400_000],
    ['cache/shared/installers', 7 * 86400_000],
    ['tmp/previews', 86400_000],
    ['tmp/migration-import', 3 * 86400_000],
    ['tmp/ta-blender', 3 * 86400_000],
  ]) {
    const fullPath = join(getConfigDir(), subdir)
    if (!existsSync(fullPath)) continue
    // ... 扫描 mtime, 删除过期
  }
  return stats
}
```

启动时调用：`await cacheScanLRU()` 在 `initializeRuntime()` 之后。

#### 3.4.5 已废弃路径（迁移后不留兼容）

| 旧路径                                          | 状态                                        |
| ----------------------------------------------- | ------------------------------------------- |
| `%TEMP%\tagent-preview\`                        | **改** `~/.tagent/tmp/previews/`            |
| `%TEMP%\tagent-installers\`                     | **改** `~/.tagent/cache/shared/installers/` |
| `%TEMP%\tagent-import-{uuid}\`                  | **改** `~/.tagent/tmp/migration-import/`    |
| `%TEMP%\tagent-icon-{uuid}\`                    | **改** `~/.tagent/tmp/previews/` (合并)     |
| `%TEMP%\tagent-ss-{ts}.html`                    | **改** `~/.tagent/tmp/screenshots/`         |
| `%APPDATA%\TAgent\` (Electron)                  | **改** `~/.tagent/electron-userdata/`       |
| `%APPDATA%@tagent\electron-dev\` (Electron dev) | **改** `~/.tagent-dev/electron-userdata/`   |

### 3.5 Agent 工作区机制 + UI 布局（2026-06-06 拍板, D 方案 v2）

TAgent 的 "工作区" 是抽象的**多项目容器**——与 Codex / Claude Code 的"单 cwd"模型根本不同。本节定义：**5 个核心概念** + **5 概念到 UI 区域的映射** + **跟 hermes-desktop 的对比** + **UI 重构决策 (D 方案 v2)**。

#### 3.5.1 5 个核心概念精确定义

| #                                     | 概念                                                 | 物理位置 | 谁拥有            | 跨 session                                                | 用途 |
| ------------------------------------- | ---------------------------------------------------- | -------- | ----------------- | --------------------------------------------------------- | ---- |
| **① 工作区** (Workspace)              | `~/.tagent/agent-workspaces.json` + slug 目录        | TAgent   | ✅ 跨 session     | 项目容器（多项目并行）                                    |
| **② workspace-files/**                | `~/.tagent/agent-workspaces/{slug}/workspace-files/` | Agent    | ✅ 跨 session     | **Agent 的内部笔记**（不污染用户代码）                    |
| **③ 附加工作区目录** (Attached dir)   | 外部真实目录（如 `D:/MyGame/`）                      | 用户     | ✅ 跨 session     | **Claude Code cwd 等价物**（Agent 读 / 写用户的真实代码） |
| **④' 附加工作区文件** (Attached file) | 外部真实单文件                                       | 用户     | ✅ 跨 session     | 精细化权限（只暴露 1 个文件而不是整个项目）               |
| **⑤ 会话附加目录** (Session attached) | 外部真实目录                                         | 用户     | ❌ 仅当前 session | 会话级临时附加（不污染工作区配置）                        |

**读 / 写方向的核心约束**（设计的灵魂）：

| 方向                   | 落在哪                     | 目的                         |
| ---------------------- | -------------------------- | ---------------------------- |
| Agent **读**用户代码   | ③ ④' ⑤（外部附加）         | 看到真实项目                 |
| Agent **写**自己的笔记 | ② workspace-files/（内部） | 跨会话共享 + 不污染 git 仓库 |

**为什么这么分**：避免两个错——(a) Agent 笔记写到用户代码里污染 git；(b) Agent 只看自己笔记见不到真实项目。

#### 3.5.2 现状（2026-06-06）的问题

TAgent **当前**的 UI 布局违反"作用域"心智：

```
[当前布局]
┌──────────┬─────────────────────────┬────────────┐
│ 工作区    │                         │ 会话文件   │  ← Tab 1
│ 列表      │   Chat / Agent          │ 工作区文件 │  ← Tab 2 (混着工作区配置)
│          │                         │ 文件改动   │  ← Tab 3
└──────────┴─────────────────────────┴────────────┘
              1 tab in 左                3 tab in 右
                ↑                          ↑
            缺少会话列表              工作区配置错位
```

**3 大问题**：

1. **会话列表缺位**——用户想切会话只能在 Chat 顶部的 dropdown，1 击切不到
2. **"工作区文件" Tab 错位**——这是工作区配置，不该在右侧"会话上下文"区
3. **"附加目录"入口不显**——SidePanel.tsx:288 的"附加文件夹"按钮藏在右侧 Tab 里，新用户找不到

#### 3.5.3 D 方案 v2：左侧并排两列（2026-06-06 拍板）

**重构后的布局**：

```
┌────────────────────────────────────────────────────────────┐
│ ┌──────────┬──────────┬─────────────────┬──────────────┐  │
│ │ Column 1 │ Column 2 │                  │              │  │
│ │ (60%)    │ (40%)    │                  │              │  │
│ │          │          │                  │              │  │
│ │ 工作区    │ 会话     │                  │ 会话文件     │  │
│ │ 管理     │ 列表     │  Chat / Agent    │ 文件改动     │  │
│ │          │          │                  │              │  │
│ │ ▼ MyGame │ 会话 A   │                  │ (仅当前     │  │
│ │   +附加   │  14:00   │                  │  会话相关)  │  │
│ │   D:/Game │ 会话 B   │                  │              │  │
│ │   +附加   │  昨天    │                  │              │  │
│ │   D:/Docs │ 会话 C   │                  │              │  │
│ │   ▼ Tree  │  上周    │                  │              │  │
│ │     plan  │ + 新建   │                  │              │  │
│ │ ▼ Tools  │          │                  │              │  │
│ │   +附加   │          │                  │              │  │
│ │          │          │                  │              │  │
│ │ [新建]   │          │                  │              │  │
│ └──────────┴──────────┴─────────────────┴──────────────┘  │
└────────────────────────────────────────────────────────────┘
```

**4 个区域职责清晰**：

| 区域                    | 内容                                                              | 作用域               |
| ----------------------- | ----------------------------------------------------------------- | -------------------- |
| **左侧 Column 1** (60%) | 工作区管理：列表 + 附加目录/文件 + workspace-files 树 + 新建/删除 | 工作区级（低频交互） |
| **左侧 Column 2** (40%) | 当前工作区的会话列表                                              | 会话级（高频交互）   |
| **中部**                | Chat / Agent 主交互区                                             | 当前会话             |
| **右侧**                | 会话文件 + 文件改动（**仅当前会话相关**）                         | 会话级（伴随）       |

**5 概念 → UI 区域映射**：

| 概念               | 落点                                    |
| ------------------ | --------------------------------------- |
| ① 工作区列表       | 左侧 Column 1                           |
| ② workspace-files/ | 左侧 Column 1 树视图（可展开）          |
| ③ 附加工作区目录   | 左侧 Column 1 "+附加" 按钮              |
| ④' 附加工作区文件  | 左侧 Column 1 "+附加文件" 按钮          |
| ⑤ 会话附加目录     | 右侧 Tab "会话文件"（保持现状，会话级） |

**命名清理**（顺手做）：**"附加工作区文件"** 重命名为 **"附加文件"**（避免和"工作区文件目录"混淆）；**右侧"工作区文件" Tab 删除**（配置已搬左侧）。

#### 3.5.4 与 hermes-desktop / Codex / Claude Code 对比

| 维度               | **TAgent D 方案 v2**      | hermes-desktop               | Codex CLI             | Claude Code           |
| ------------------ | ------------------------- | ---------------------------- | --------------------- | --------------------- |
| 工作区概念         | ✅ 多工作区（抽象容器）   | ❌ 无（用 profile）          | ❌ 单 cwd             | ❌ 单 cwd             |
| 工作区配置 UI      | 左侧 Column 1（专门区域） | ❌ 无                        | ❌ 无                 | ❌ 无                 |
| 会话列表           | 左侧 Column 2（专门区域） | 独立全屏 view                | ❌ 无                 | ❌ 无                 |
| 切换会话           | 1 击（左侧 1 选）         | 2 击（点 Sessions tab → 选） | `--resume` 命令       | `--continue` flag     |
| 附加多目录         | ✅ per-workspace          | ❌ 无                        | ❌ 单 cwd             | ❌ 单 cwd             |
| 跨 session 共享    | ✅（workspace-files/）    | ⚠️ 全局 memory 间接          | ❌ 无                 | ⚠️ CLAUDE.md 加载     |
| Agent 写自己的笔记 | ✅ workspace-files/       | ✅ memory 体系               | ❌ 无                 | ❌ 无                 |
| 文件面板           | 右侧（仅会话相关）        | ❌ 无                        | 内置 diff view        | 内置 diff view        |
| 配置触达成本       | 中（左侧 1 击）           | ❌ 配置分散                  | ❌ 无此概念           | ❌ 无此概念           |
| 学习曲线           | 中（多概念需解释）        | **低**（扁平 nav）           | **最低**（`cd` 就用） | **最低**（`cd` 就用） |

**核心 trade-off**：TAgent 用更高的学习曲线换 4 个独特能力（多工作区、附加多目录、跨 session 共享、Agent 内部笔记分离）。

#### 3.5.5 实现成本评估

| 改动                                             | 位置                          | 难度 | 工时   |
| ------------------------------------------------ | ----------------------------- | ---- | ------ |
| 左侧 Sidebar 拆成 2 列布局                       | `LeftSidebar.tsx`             | 🟡   | 1-2 天 |
| 新建"会话列表"组件（Column 2）                   | **新文件**                    | 🟡   | 2-3 天 |
| Column 1 加树视图（workspace-files/）            | 复用 FileBrowser 组件         | 🟢   | 1 天   |
| Column 1 加"+附加"按钮（3 个：目录/文件/工作区） | 复用 SidePanel 里 attach 逻辑 | 🟢   | 1 天   |
| 右侧"工作区文件" Tab 删除                        | `DiffPanelTabBar.tsx`         | 🟢   | 半天   |
| 右侧"会话文件" 重命名"会话文件/附加"             | UI 文本 + 类型                | 🟢   | 半天   |
| FileDropZone 4 个动作重新分配                    | 部分移到左侧 Column 1         | 🟢   | 1 天   |
| 会话列表 atom (per workspace session list)       | `agent-atoms.ts`              | 🟢   | 半天   |
| Onboarding 引导（"先创建工作区"）                | 新增                          | 🟡   | 1-2 天 |

**总成本 ~ 1.5-2 周**（纯 UI 重构 + 一个新组件"会话列表"）。**后端 API 0 改动**（`attachWorkspaceDirectory` / `attachWorkspaceFile` / `listAgentWorkspaces` 都不变）。

#### 3.5.6 与 §3.3 / §3.4 的关系

| 章节                 | 关注点                       | 本节关注点                       |
| -------------------- | ---------------------------- | -------------------------------- |
| §3.3 TA 模式数据布局 | **TA 模式**的 `ta/` 目录结构 | Agent 工作区数据（**通用模式**） |
| §3.4 缓存 + 目录规范 | 5 类缓存目录（C1-C5）        | UI 区域划分                      |
| §3.5 本节            | —                            | **5 概念 + UI 布局 + 重构决策**  |

3 节互补：§3.3 管 TA 数据，§3.4 管缓存，§3.5 管 Agent 工作区 UI。

---

## 4. 核心组件

### 4.1 组件清单

```
@tagent/electron main process
├── ModeManager (NEW) ─ 顶层 Tab 状态机
│   ├─ 当前 active mode（'general' | 'ta'）
│   ├─ 模式切换触发源：用户点击 | agent switch_mode 工具 | API
│   ├─ 长任务状态追踪（"切走后还在跑"）
│   └─ 互斥锁（防止并发 UI 交互）
│
├── ModeSpecificAgentRunner (NEW) ─ 模式化 agent 入口
│   ├─ 通用模式 runner: Provider Adapter + Claude Agent SDK + 通用 system prompt
│   ├─ TA 模式 runner: 同 Provider + Claude Agent SDK + TAgent system prompt
│   │                  + TAgent MCP server 连接（含 54 工具）
│   └─ switch_mode 伪工具内置在两个 runner
│
├── MCPManager (已有, 扩展) ─ 模式化启停
│   ├─ 通用模式启：context7 / sequential-thinking / github / playwright / tool-builder
│   ├─ TA 模式启：context7 / sequential-thinking + TAgent MCP server
│   └─ 模式切换时动态启/停
│
├── ChannelManager (已有, 扩展)
│   └─ 渠道配置全局共享；但 mode 各自记 lastSelectedChannelId
│
├── SkillManager (已有, 扩展)
│   └─ Skill 列表模式独立
│
├── DataPathManager (NEW) ─ 路径命名空间
│   ├─ %APPDATA%\TAgent\general\  (sessions / channels / skills)
│   ├─ %APPDATA%\TAgent\ta\       (sessions / channels / skills)
│   └─ %APPDATA%\TAgent\shared\   (MCP server 配置, 渠道凭证加密存储)
│
├── MemoryRunner (NEW) ─ 5 层 memory 编排
│   ├─ L0_user / L1_project / L2_facts / L3_corrections / L4_sessions(FTS5) / L5_insights
│   ├─ Periodic Nudges (hermes 思路)
│   ├─ Reflect Layer (GenericAgent 思路)
│   └─ Scheduled Cleanup
│
├── StreamingContextScrubber (NEW) ─ 流式隔离
│   └─ 借鉴 hermes `StreamingContextScrubber`，过滤 `<memory-context>` 块不泄露到 UI
│
└── TokenStats (NEW) ─ token 统计与缓存命中率
    ├─ cacheHitRateAtom (派生)
    ├─ costBreakdownAtom (派生)
    └─ cumulativeTokenStatsAtom (派生)

@tagent/electron renderer
├── TopBar (扩展) ─ 顶层 Tab 切换器（通用 / TA）
├── ModeSwitchIndicator (NEW) ─ 切走后红点提示长任务完成
├── GeneralModeUI (已有) ─ chat / agent / scratch 三 Tab
├── TAModeUI (NEW, 用 Proma 设计系统)
│   ├─ ChatPanel ─ TA 模式 system prompt + TAgent 工具集
│   ├─ AssetLibrary ─ 直读 tag_store/tags.db
│   ├─ ReviewQueue ─ 渲染中
│   ├─ PipelineEditor ─ 规划中
│   └─ ProjectConfig ─ 规划中
└── MemoryMonitor (NEW) ─ 借鉴 hermes memory_monitor，可视化每层条数

ta_agent MCP Server (Python, PyInstaller bundle)
├── mcp_server.py (NEW, ~300 行) ─ 暴露 54 工具
├── 54 工具（已有, from ta_agent/packages/tools/）
├── memory/ 扩展为 5 层
│   ├─ L0_user.py (NEW)
│   ├─ L4_session_log.py (NEW)
│   ├─ L5_insight.py (NEW)
│   ├─ fts5_index.py (NEW)
│   ├─ nudges.py (NEW)
│   ├─ reflect.py (NEW)
│   ├─ scheduled_cleanup.py (NEW)
│   └─ provider.py (扩展为 13 个 hook)
├── tag_store/tags.db (SQLite, 文件共享)
└── Blender / UE5 集成（保留）
```

### 4.2 关键组件：`switch_mode` 伪工具

```typescript
const switchModeTool: ToolDefinition = {
  name: 'switch_mode',
  description:
    '建议将当前对话切换到另一个模式继续。target_mode: "general" 用于代码/写工具/办公；"ta" 用于游戏资产/TA 工作流。',
  input_schema: {
    type: 'object',
    properties: {
      target_mode: { type: 'string', enum: ['general', 'ta'] },
      reason: { type: 'string', description: '为什么建议切换（1 句话）' },
      context_summary: { type: 'string', description: '到目前为止的关键上下文（3-5 句）' },
    },
    required: ['target_mode', 'reason', 'context_summary'],
  },
}
```

**调用流程**：

1. LLM 在 TA 模式调 `switch_mode({target_mode:'general', reason, context_summary})`
2. Renderer 捕获，弹 modal
3. 用户确认 → 序列化当前 session → 在 general 模式建新 session → 切 Tab → 新 session 自动开始
4. 取消 → 工具返回 `{cancelled:true}`，LLM 继续原任务

---

## 5. 数据流

### 5.1 应用启动

```
[App 启动]
  ├─→ Proma Main Process 启动
  │     ├─ 加载通用 mode 配置（默认）
  │     ├─ 启动 MCPManager：通用 MCP servers
  │     └─ 加载 appModeAtom = 'general'
  └─→ ta_agent MCP Server：未启动（等用户进 TA 模式）
```

### 5.2 模式切换（用户点 Tab）

```
[切到 TA]
  ├─→ ModeManager.setActiveMode('ta')
  │     ├─ 锁互斥（提示"X 任务在后台跑"）
  │     ├─ 启动 ta_agent MCP server 子进程
  │     ├─ MCPManager 加载 TA 模式 MCP 列表
  │     ├─ ChannelManager：恢复 TA 模式 lastSelectedChannelId
  │     ├─ SkillManager：加载 ta/skills/
  │     └─ DataPathManager：activePath 切到 %APPDATA%\TAgent\ta\
  └─→ Renderer 重渲染 TA 模式 UI
```

### 5.3 双模式互切换（LLM 调 switch_mode）

```
[LLM 调 switch_mode({target_mode, reason, summary})]
  ├─→ Renderer 捕获工具调用
  │     └─ 弹 modal：「Agent 建议切到 <target_mode>：<reason>」
  ├─→ 用户确认：
  │     ├─ 序列化当前 session：
  │     │   {
  │     │     mode, sdkSessionId, summary,
  │     │     originalUserMessage, artifacts
  │     │   }
  │     ├─ ModeManager.handoffToMode(target, serializedSession)
  │     │   ├─ 在 target 模式建新 session（首条 user msg = 原 msg + 模式标识 + summary）
  │     │   ├─ 切顶层 Tab
  │     │   └─ 启动 target runner
  │     └─ 旧 session 标记"已切走"，归档
  └─→ 取消：返回 {cancelled:true}
```

### 5.4 工具调用（TA 模式）

```
[LLM 调 tool_name(args)]
  ├─→ Agent Runner 收到工具调用
  │     ├─ 工具名匹配：tagent-mcp 列表？
  │     │     ├─ 是：通过 MCPManager 转发到 ta_agent MCP server
  │     │     └─ 否：本地工具（Claude Agent SDK 内置 / Skill）
  │     └─ 流式返回 progress（如"Analyzing 5/50"）
  └─→ 工具结果注入 LLM messages，继续循环
```

### 5.5 资产库读取（TA 模式 UI）

```
[TA 模式 UI 打开资产库]
  ├─→ Renderer: useAssetLibrary(...)
  │     ├─ better-sqlite3 打开 %APPDATA%\TAgent\ta\tag_store\tags.db
  │     ├─ 列表查询：SELECT * FROM assets ORDER BY updated_at DESC LIMIT 50
  │     └─ 全文搜索：MATCH query（FTS5 索引）
  └─→ 写入路径：只走 ta_agent MCP server（analyze_assets / save_* 工具）

并发安全：
  ├─ WAL 模式 + 短事务
  ├─ Proma 端用 readonly pragma
  └─ ta_agent 端串行写（内部队列）
```

### 5.6 Token 统计 + 缓存命中率

```
[Claude Agent SDK 发 usage 事件]
  ├─→ useGlobalAgentListeners 接收
  │     └─ 提取 input/output/cache 字段
  ├─→ 派生 atom：
  │     ├─ cacheHitRateAtom
  │     ├─ costBreakdownAtom
  │     └─ cumulativeTokenStatsAtom
  └─→ UI 展示：
        ├─ 通用模式：会话页底部"成本/缓存"卡片
        └─ TA 模式：暂不显示
```

### 5.7 错误处理边界

| 错误类型                     | 来源                    | 处理                                                                         |
| ---------------------------- | ----------------------- | ---------------------------------------------------------------------------- |
| ta_agent MCP 进程崩溃        | Python 崩溃 / OOM       | MCPManager 检测 stdio EOF → 自动重启一次 → 第二次失败弹"重试 / 切到通用模式" |
| MCP 工具调用超时             | Blender 渲染 / UE5 卡死 | 单工具 5 分钟硬超时，cancel tool_call，isError=true                          |
| SQLite 锁冲突                | ta_agent 写 + Proma 读  | Proma readonly pragma，ta_agent 队列化；冲突时 Proma 重试 1 次               |
| 模式切换时任务未完成         | 切到通用但 TA 有任务    | 任务保留在后台跑，完成后用 PushNotification 通知                             |
| OpenAI provider 缓存字段缺失 | 某些端点不发 cache      | `cacheReadTokens = null` → cacheHitRateAtom 返回 null，不显示不报错          |
| switch_mode 用户取消         | 用户点取消              | 工具返回 `{cancelled:true}`，LLM 据此调整                                    |

---

## 6. 记忆系统设计

### 6.1 5 层结构（融合 hermes-agent + GenericAgent）

```
%APPDATA%\TAgent\{mode}\memory\
│
├─ L0_user.md                    ⭐ NEW (from hermes Honcho)
│   用户画像：身份 / 语言 / 偏好 / 时区 / 工作节奏
│
├─ L1_project.md                 ← 源自 TAgent
│   项目画像：项目名 / 目录 / 命名规则 / 引擎类型
│
├─ L2_facts.md                   ← 源自 TAgent
│   稳定事实：路径别名 / 工具位置 / 快捷键 / 习惯
│
├─ L3_corrections/               ← 源自 TAgent，扩展
│   ├─ raw.jsonl                纠正记录（append-only）
│   └─ rules.json               压缩后的高置信规则（含 version 字段，可回滚）
│
├─ L4_sessions/                  ⭐ NEW (from GenericAgent + hermes FTS5)
│   ├─ 2026-06-05_xxx.jsonl     原始会话存档
│   └─ ...
├─ L4_index.fts5                 FTS5 全文索引（覆盖 L4_sessions/）
│
├─ L5_insights.md                ⭐ NEW (from GenericAgent global_mem_insight)
│   提炼的洞察：从 L2/L4 周期 LLM review 出的高级结论
│
├─ nudges/                       ⭐ NEW (from hermes)
│   ├─ pending_nudges.json      待确认的"我应该记点什么？"提示
│   └─ last_nudge_at.json       节流：每 N 轮才触发
│
├─ reflect/                      ⭐ NEW (from GenericAgent)
│   └─ last_review.json         上次 LLM 自我 review 的时间 + 摘要
│
├─ sops/                         ← 源自 TAgent
│   └─ *_sop.md                  开发者维护的操作说明书
│
├─ scheduled_tasks.json          ⭐ NEW (from GenericAgent)
│   └─ {task, last_run, next_run, status}
│
└─ providers/                    ⭐ NEW (from hermes)
    └─ builtin/                  内部实现的 provider（可挂 honcho/mem0/hindsight 等）
```

### 6.2 与 TAgent 现状对比

| 维度          | TAgent 现状           | 融合后                               | 主要借鉴                    | 改动量                      |
| ------------- | --------------------- | ------------------------------------ | --------------------------- | --------------------------- |
| 层数          | 3 层 (L0/L1/L2)       | **5 层 (L0-L4 + L5 insights)**       | GenericAgent L4 + hermes L0 | 新增 L0/L4/L5               |
| Provider 抽象 | 5 个方法 Protocol     | **13 个 hook（7 核心 + 6 可选）**    | hermes                      | 扩展 `provider.py`          |
| 激活方式      | 显式工具调用          | **显式 + Periodic Nudges**           | hermes                      | 新增 `nudges.py`            |
| 检索          | feature dict 子串匹配 | **FTS5 全文 + 语义**                 | hermes                      | 新增 FTS5                   |
| 跨 session    | ❌ 无                 | **✅ L4_sessions.fts5**              | hermes + GA                 | 新增 L4                     |
| 用户建模      | ❌ 无                 | **✅ L0_user.md（Honcho 思路）**     | hermes                      | 新增 L0                     |
| 事实 vs 洞察  | 单一 facts            | **L2 raw facts + L5 insights**       | GenericAgent                | 新增 L5                     |
| 反思          | ❌ 无                 | **✅ reflect/ 周期 LLM 自我 review** | GenericAgent                | 新增 `reflect.py`           |
| 自动维护      | ❌ 手动               | **✅ scheduled_tasks.json**          | GenericAgent                | 新增 `scheduled_cleanup.py` |
| 流式隔离      | 无                    | **✅ StreamingContextScrubber**      | hermes                      | 新增 scrubber               |
| Skill 标准    | 自定义                | **agentskills.io 兼容**              | hermes                      | 改 skill 格式               |
| 多 provider   | 仅 builtin            | **可挂 honcho/mem0/hindsight**       | hermes                      | 预留接口                    |
| Session 切换  | 重建                  | **on_session_switch 钩子**           | hermes                      | 新增钩子                    |

### 6.3 模式隔离下的 memory

```
%APPDATA%\TAgent\
├── general\memory\        ← 通用模式独立
└── ta\memory\             ← TA 模式独立
```

两套完全独立。**可选开关**："share user profile" 让 L0_user.md 双向同步（其他层不共享）。

### 6.4 代码改动定位

**ta_agent 端**（`F:\ta_agent\packages\tools\memory\`）：

| 新增/修改 | 路径                              | 行数 |
| --------- | --------------------------------- | ---- |
| 新增      | `L0_user.py`                      | ~120 |
| 新增      | `L4_session_log.py`               | ~200 |
| 新增      | `L5_insight.py`                   | ~80  |
| 新增      | `fts5_index.py`                   | ~150 |
| 新增      | `nudges.py`                       | ~100 |
| 新增      | `reflect.py`                      | ~120 |
| 新增      | `scheduled_cleanup.py`            | ~100 |
| 扩展      | `provider.py`（5→13 个方法）      | +60  |
| 扩展      | `file_provider.py`（接 L0/L4/L5） | +200 |
| 扩展      | `memory_tools.py`                 | +80  |

**Proma 端**：

| 新增                                                             | 路径        | 作用                       |
| ---------------------------------------------------------------- | ----------- | -------------------------- |
| `apps/electron/src/main/lib/memory/streaming-scrubber.ts`        | 借鉴 hermes | 过滤 `<memory-context>` 块 |
| `apps/electron/src/renderer/components/memory/MemoryMonitor.tsx` | 借鉴 hermes | 可视化 memory 状态         |

### 6.5 记忆自进化机制（2026-06-06 补）

§6.1-6.4 定义了"是什么"。本节定义"什么时候写/读/清/反思"——把 §6 从静态分层升级为**动态自进化系统**。**L0 保持双视图**（借鉴 Honcho），**自进化 4 机制**（Nudges / Reflect / Scheduled Cleanup / Self-Repair），**8 个生命周期事件**精确到桌面应用触发点。

#### 6.5.1 5 层 × 2 维度 全景表

每层定义：**写什么 / 写触发 / 读触发 / 上限 / 超限处理**。

| 层                 | 文件                                                | 写触发                         | 读触发                     | 上限                | 超限                                |
| ------------------ | --------------------------------------------------- | ------------------------------ | -------------------------- | ------------------- | ----------------------------------- |
| **L0** 用户画像    | `L0_user.md`（双视图 YAML）                         | 显式记 + Nudge 命中            | 每 turn system prompt 头部 | 50 条/视图          | LRU 淘汰最久未引用 + 询问用户       |
| **L1** 项目画像    | `L1_project.md`                                     | 创建/加载项目 + Nudge 命中     | TA 模式每 turn             | 100 条              | 标 stale，用户确认保留              |
| **L2** 稳定事实    | `L2_facts.md`                                       | 用户显式说 + 5+ 次出现自动建议 | 每 turn context            | 500 条              | LLM 摘要合并相似条目                |
| **L3** 纠错 + 规则 | `L3_corrections/raw.jsonl` + `rules.json`           | 每次纠错（自动，无询问）       | **优先于 L2 读**           | raw 1000 → 触发压缩 | 聚类生成新 rule                     |
| **L4** 历史会话    | `L4_sessions/{date}_{slug}.jsonl` + `L4_index.fts5` | session_end                    | 跨 session FTS5 搜索       | 30 天热             | > 30 天移 `archive/`，> 90 天标 old |
| **L5** 提炼洞察    | `L5_insights.md`                                    | 每日 Reflect                   | 高优先级 system prompt 节  | 20 条               | 最久未引用 + 反向引用失效则 archive |

#### 6.5.2 L0 双重表示（借鉴 Hermes Honcho）

```yaml
# ~/.tagent/memory/L0_user.md
---
schema_version: 2
last_updated: 2026-06-06T15:00:00+08:00
last_referenced_at: 2026-06-06T16:30:00+08:00
shared_with_ta_mode: true # 决策开关（默认 false）
---
# Global View (Honcho global_tier) — 客观事实
## 身份
- Frank Danny，3 年游戏 TA 经验，专攻写实风格
- 在北京，UTC+8 工作
- 母语中文，技术文档混用英文

## 设备 / 环境
- Windows 11 Pro, 双屏 4K
- Blender 4.2 装在 D:/Blender/
- UE5 5.4 装在 D:/UE5/

# Peer View (Honcho peer_tier, Agent 视角) — 主观判断
## 用户偏好
- 偏好简洁命名，不喜欢 emoji 后缀
- 经常搞混 SK_/SM_，需要主动提示
- 对 release notes 详细 changelog 感兴趣

## 沟通风格
- 直接给状态，不要客套
- 喜欢结构化表格 (A/B/C/D 选项)
- 不喜欢长篇大论
- 凌晨也干活，但 Agent 该在关键决策点主动提示休息
```

**为什么双视图？** 借鉴 Honcho：peer_view 是 Agent 视角的"用户是什么样的人"，global_view 是客观事实。TA 模式跑 Blender 时用 global_view（要客观路径），日常对话用 peer_view（要理解沟通风格）。

#### 6.5.3 8 个生命周期事件 — 桌面应用触发点

| 事件               | 触发时机                             | 桌面具体实现                          | 调用 hook                               | 数据流                                         |
| ------------------ | ------------------------------------ | ------------------------------------- | --------------------------------------- | ---------------------------------------------- |
| **turn_start**     | 每次 LLM 调用前                      | SDK 收到 user 消息                    | `nudge_check()` + `prefetch()`          | nudge 评估 + L0/L1/L2/L5 注入 system prompt    |
| **turn_end**       | assistant 消息后                     | SDK 收到 assistant 消息               | `sync_turn()`                           | L4 append + fact_capture 评估                  |
| **session_idle**   | 30 分钟无操作                        | setTimeout 检测最后活动               | `extract_facts()`                       | L2 自动评估新事实                              |
| **session_end**    | 窗口关闭 / app.quit() / 用户主动结束 | Electron `before-quit` + window close | `extract_facts()` + `summarize_to_L4()` | L2 + L4 写盘                                   |
| **session_switch** | 切通用 ↔ TA Tab                      | `ModeManager.setActiveMode()`         | `on_session_switch()`                   | 序列化当前 → 新 mode 建 session + 注入 summary |
| **pre_compress**   | context > 80k tokens                 | agent-orchestrator 检测 token 阈值    | `on_pre_compress()`                     | 抢救未入 L2/L3 的事实                          |
| **post_compress**  | 压缩后回调                           | 压缩完成事件                          | re-inject L0/L1/L2/L5                   | 重新注入 system prompt 头部                    |
| **subagent_done**  | TA 模式 subagent 任务完成            | Claude SDK Task tool 完成回调         | `on_delegation()`                       | 父子对话观察 → L2                              |

#### 6.5.4 自进化机制 #1: Nudges（每 5 turn 检查）

```
Nudge 评估管线（每次 turn_start 触发，每 5 turn 实际跑）：

input:  最近 5 turn 对话 + 现有 L0/L1/L2
  ↓
pattern_detector:
  - 同一 user 行为 ≥3 次 → 候选 L0 (peer_view)
  - 同一 user 表述 ≥2 次 → 候选 L2
  - 用户纠正 LLM ≥1 次 → 候选 L3（自动写，不问）
  - 加载项目 ≥2 次相似 → 候选 L1
  ↓
throttle_check（每层独立冷却）:
  - L0: 5 turn 冷却
  - L1: 10 turn 冷却
  - L2: 3 turn 冷却
  - L3: 20 turn 冷却
  ↓
candidate（≤3 条 / 批）
  ↓
LLM 改写成 user-friendly 提示:
  "我注意到你总是不要 emoji 后缀，要我记住吗？"
  ↓
UI 弹 Nudge 通知（不打断对话，5s 自动消失）
  ↓
用户点"记" / "不记" / "稍后"
  ↓
[记] → append 到对应层
[不记] → 写 "nudges/rejected.json"（防重复弹）
[稍后] → 写 "nudges/deferred.json"，下个 Nudge 周期再问
```

**Nudge 4 模式**：

| 模式     | 检测条件                 | 候选层         | 提示语模板                                     |
| -------- | ------------------------ | -------------- | ---------------------------------------------- |
| 行为重复 | 同一行为 ≥3 次 / 5 turn  | L0 (peer_view) | "我注意到你总是 X，要我记住吗？"               |
| 事实重复 | 同一事实 ≥2 次跨 session | L2             | "我看到你反复提到 X，要我存为长期事实吗？"     |
| 显式纠正 | "不是 X，是 Y" 类语句    | L3 raw         | "我把你这次的纠正记下来了"（**自动记，不问**） |
| 项目重复 | 加载项目 ≥2 次相似       | L1             | "我看到你做项目都用 X 结构，要存为模板吗？"    |

#### 6.5.5 自进化机制 #2: Reflect（每日 03:00）

```
每日 03:00（或启动时 if 距上次 >36h 触发）：

input:  最近 7 天 L2_facts + L4_sessions 摘要
  ↓
LLM 提炼（cheap 模型, max 500 tokens）:
  - 跨 session 共性
  - 抽象出"用户偏好 / 工作流规律 / 领域洞察"
  ↓
anti_echo_filter（防回音壁）:
  - 每条 insight 必须引用 ≥2 条 L2 facts 或 ≥1 条 L4 session
  - 无引用 → 丢弃
  - 与现有 L5 重复 → 合并而非新增
  ↓
contradiction_check:
  - 新 insight vs 现有 L5 矛盾？→ 写 L3 raw 而非 L5
  ↓
append L5_insights.md (max 20 条)
  ↓
通知用户（设置页红点）："提炼了 N 条新洞察"
```

**Anti-echo 算法**：

```python
def is_valid_insight(insight, l2_facts, l4_sessions, l5_existing):
    citations = insight.get("citations", [])
    l2_cites = [c for c in citations if c in l2_facts]
    l4_cites = [c for c in citations if c in l4_sessions]

    # 必须有 ≥2 个 L2 引用 OR ≥1 个 L4 引用
    if len(l2_cites) < 2 and len(l4_cites) < 1:
        return False, "insufficient_citations"

    # 不与现有 L5 重复
    if any(similar_to(c["text"], l5_existing) for c in citations):
        return False, "duplicate_of_existing_L5"

    # 不与现有 L5 矛盾
    if contradicts(c["text"], l5_existing):
        return False, "contradicts_existing_L5"

    return True, "ok"
```

#### 6.5.6 自进化机制 #3: Scheduled Cleanup（每周日 04:00）

```
每周日 04:00（或启动时 if 距上次 >8 天）：

1. L4 归档:
   - sessions > 30 天: 移到 L4_sessions/archive/
   - > 90 天: 标记 "old"（仍可搜，UI 加 "旧" 角标）

2. L3 压缩:
   - raw.jsonl > 1000 条 → 触发 LLM 聚类
   - 相似纠错 ≥3 条 → 合并成 1 条 rule
   - rules.json 版本号 +1

3. FTS5 重建:
   - DROP L4_index.fts5
   - 重新扫描 L4_sessions/ → 重建索引
   - 增量模式: 只扫新追加的文件

4. LRU 标记:
   - L0/L1/L2/L5 每条标 last_referenced_at
   - 启动时读 system prompt 时更新
   - 清理时优先删 last_referenced > 90 天的
```

#### 6.5.7 自进化机制 #4: Self-Repair（每月 1 日）

```
每月 1 日 04:00：

1. L3 规则命中率统计:
   - rules.json 每条 rule 在最近 30 天被引用次数
   - 命中率 <10% → flag "low_value"，下次 Nudge 周期问用户
   - 命中率 0% → 直接 archive（不删，标 stale）

2. L5 洞察验证:
   - 每条 L5 找原始 L2/L4 引用
   - 原始引用被删除 → L5 也 archive

3. L0 跨模式一致性:
   - 如果 L0 在通用和 TA 模式都有，问用户是否同步
   - 共享开关开了，对比两边，差异 >5 条 → 提示合并

4. 报告输出:
   - 写到 logs/reflect/monthly-{date}.log
   - 设置页 "记忆健康" 显示摘要
```

#### 6.5.8 跨模式隔离 — 精确 UX 行为

| 场景                    | 默认行为                                    | 共享开关开后               |
| ----------------------- | ------------------------------------------- | -------------------------- |
| 通用模式看到 TA 模式 L0 | ❌                                          | ✅（L0_user.md 双向 sync） |
| 通用模式搜到 TA 模式 L4 | ✅（FTS5 全文）                             | ✅                         |
| 通用模式看到 TA 模式 L2 | ❌                                          | ❌                         |
| 通用模式触发 L3 纠错    | ❌（TA 模式独有）                           | ❌                         |
| 切模式时 session        | 旧 session 归档 + summary 注入新 mode 的 L4 | 同                         |
| 跨模式 Nudge            | 独立 throttle                               | L0 共享时 Nudge 也共享     |

**切模式 modal UX**：

```
用户切到 TA Tab:
  ├─ 当前 session 序列化
  ├─ 弹 modal: "已切到 TA 模式, 通用模式的 'X 项目命名规则' 是否带到 TA 模式？"
  │   ├─ 用户选带 → copy L1 到 TA 的 L1
  │   └─ 用户选不带 → 独立
  └─ TA 模式启动新 session, 注入 summary
```

#### 6.5.9 TAgent vs Hermes — 触发时机对比

| 事件              | Hermes（CLI）          | TAgent（Electron）                   | 差异原因                              |
| ----------------- | ---------------------- | ------------------------------------ | ------------------------------------- |
| turn_start        | 每次 LLM call          | 每次 SDK message                     | 一致                                  |
| session_end       | CLI 退出 / `/reset`    | 窗口关闭 / app.quit() / 30 分钟 idle | 桌面无明显 session 边界，靠 idle 推断 |
| session_switch    | `/resume /branch /new` | 切通用 ↔ TA Tab                      | 桌面无 CLI 命令，靠 Tab UI            |
| pre_compress      | context 满 100k        | context > 80k                        | 桌面更保守（多模态附件占 token 多）   |
| nudge             | ❌ 无                  | ✅ 每 5 turn                         | TAgent 创新                           |
| reflect           | ❌ 无                  | ✅ 每日 03:00                        | TAgent 创新                           |
| scheduled cleanup | ⚠️ 间接（curator）     | ✅ 每周日 04:00                      | TAgent 显式化                         |
| self-repair       | ❌ 无                  | ✅ 每月 1 日                         | TAgent 创新                           |

#### 6.5.10 自进化能力总评

| 自进化维度 | TAgent 设计                  | Hermes 实际             |
| ---------- | ---------------------------- | ----------------------- |
| 写触发     | 显式 + 模式检测 + 跨 session | 显式 sync_turn          |
| 主动询问   | ✅ Nudge                     | ❌ 无                   |
| 反思       | ✅ Reflect (L2/L4 → L5)      | ❌                      |
| 压缩       | ✅ pre_compress hook         | ✅ on_pre_compress hook |
| 回滚       | ✅ L3 version                | ❌                      |
| 健康检查   | ✅ 每月 self-repair          | ❌                      |
| 跨模式     | ✅ 默认隔离 + L0 可选共享    | ❌ 单 profile           |

**TAgent 在 7 个维度中 6 个领先 Hermes**（除压缩外 Hermes 持平）。**全部是设计，0 实跑**——见 §6.4 1160 行待实现代码。

---

## 7. OpenAI 协议 + Token / 缓存

### 7.1 OpenAI 覆盖度

| 层级                | 现状                                                                                              | TAgent                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Chat（裸对话）      | ✅ Proma 12 Provider 含 OpenAI、Zhipu、Doubao、Qwen、custom                                       | 保留，零改造                                                      |
| Agent（自主循环）   | ⚠️ Claude Agent SDK 走 Anthropic 协议，但通过 `ANTHROPIC_BASE_URL` 指向 OpenAI 兼容端点**已跑通** | 通用 / TA 模式都能选 OpenAI provider；TAgent 54 工具通过 MCP 注入 |
| 真·OpenAI Agent SDK | ❌ 当前没接 `@openai/codex-sdk`                                                                   | **不进 MVP**；要做需 1-2 周独立工作                               |

### 7.2 Token / 缓存命中率

**Proma 现状**（已读代码确认）：

- `AgentStreamState` 已有：`inputTokens` / `outputTokens` / `cacheReadTokens` / `cacheCreationTokens`
- 数据源：`useGlobalAgentListeners.ts:202-211` 从 Anthropic SDK `usage` 事件抓
- **缺**：未计算 `cacheHitRate` 派生字段，未在 UI 显眼展示

**TAgent 设计**：

```typescript
export const cacheHitRateAtom = atom((get) => {
  const s = get(agentStreamStateAtom)
  if (!s) return null
  const cR = s.cacheReadTokens ?? 0
  const cC = s.cacheCreationTokens ?? 0
  if (cR + cC === 0) return null
  return cR / (cR + cC)
})

export const costBreakdownAtom = atom((get) => {
  // 基于 model pricing table 计算
  // inputCost / outputCost / cacheWriteCost / cacheReadCost / cacheSavings
})
```

**UI**：通用模式会话页底部加"成本/缓存"小卡片。TA 模式不显示。

**OpenAI 兼容端点的 cache**：

- Anthropic 原生：`cache_read_input_tokens` + `cache_creation_input_tokens` ✅
- OpenAI 原生：需读 `usage.cached_tokens`（OpenAI Responses API）— `openai-adapter.ts` MVP 后可加

---

## 8. 模式隔离设计

### 8.1 严格互斥 + 后台跑完

```
[切模式瞬间]
  ├─→ 互斥锁：UI 可交互的只有一个 mode
  ├─→ 切走时：
  │     ├─ 当前 mode 的 LLM 流式响应：暂停（保留 buffer）
  │     ├─ 当前 mode 的本地 tool 任务：暂停
  │     ├─ ta_agent MCP server：保留进程（按决策 4）
  │     └─ 目标 mode：UI 激活，可立即交互
  └─→ 切回时：
        ├─ 流式响应：从 buffer 恢复
        ├─ 后台任务完成：通过 PushNotification 通知
        └─ Tab 红点：通用模式切走时 TA 完成后红点提示
```

### 8.2 命名空间隔离

| 资源            | 通用模式                   | TA 模式                           | 共享               |
| --------------- | -------------------------- | --------------------------------- | ------------------ |
| System Prompt   | 通用                       | TAgent                            | ❌                 |
| 工具集          | Claude SDK 内置 + 通用 MCP | TAgent 54 工具 + 通用 MCP（部分） | 部分 MCP 共享      |
| 记忆 5 层       | general\memory\            | ta\memory\                        | ❌（L0 可选共享）  |
| 会话            | general\sessions\          | ta\sessions\                      | ❌                 |
| Skill 列表      | general\skills\            | ta\skills\                        | ❌                 |
| Channel 配置    | 全局                       | 全局                              | ✅                 |
| API Key         | 全局                       | 全局                              | ✅                 |
| Provider 选择   | lastSelected               | lastSelected                      | ✅（各自记忆）     |
| MCP server 配置 | 启用列表 A                 | 启用列表 B                        | ❌（各自启用列表） |

### 8.3 跨模式切换的限制

- ❌ 切模式瞬间强制取消"思考中的 tool call"（但结果已写进 history）
- ⚠️ 切模式时如果原模式有"长任务在后台跑"——冲突时弹"等 / 切 / 杀"
- ✅ 切走时如果原模式 MCP server 还没启动完——等到启动完才能切
- ✅ 同一时刻只有一个 mode 拥有 UI focus

### 8.4 Context 管理机制（2026-06-06 补）

排查 9120caac session（6.8MB / 2153 条消息）后，发现 TAgent 的 context 管理有 **4 个实际问题**。**注意**：9120caac 的报错 `400 (2013)` **不是** context 溢出（那是 `400 (2024)`），而是 model 名 `MiniMax-M3` 不被 `nengpa.com` 端点接受。**但 6.8MB 持久化历史怎么处理，是真问题**。

#### 8.4.1 现状评估

| 维度         | Chat 模式                         | Agent 模式                                           |
| ------------ | --------------------------------- | ---------------------------------------------------- |
| 裁剪单位     | **轮数**（user+assistant = 1 轮） | **消息条数**                                         |
| 配置入口     | 用户可设（ChatHeader 下拉）       | ❌ 硬编码 `MAX_CONTEXT_MESSAGES = 20`                |
| 模型窗口感知 | ❌ 不感知                         | ⚠️ 拿到 `contextWindow` 但**不参与决策**（只画圆环） |
| 工具结果截断 | 客户端按字符                      | `MAX_TOOL_SUMMARY_LENGTH = 200` 字符（**信息丢失**） |
| 图片附件     | 走协议原始 bytes                  | `buildContextPrompt` **只取 text 块，图片整块丢**    |
| Auto-compact | ❌ 无                             | ⚠️ 只靠 SDK（失败无 fallback）                       |
| 用户主动压缩 | `/compact`-like 工具              | ❌ 无                                                |

**核心问题**：

- 9120caac **6.8MB / 2153 条** JSONL 写到磁盘
- 用户重新打开 → `buildContextPrompt` 只取最后 20 条，**前 2133 条历史"消失"**
- Agent 不知道用户上周做了什么，行为类似"失忆"

#### 8.4.2 改进方案（7 项，按优先级）

##### 🔴 P0-1: `buildContextPrompt` 接 `contextWindow`（agent-orchestrator.ts:318）

**改前**（硬编码 20 条）：

```ts
const MAX_CONTEXT_MESSAGES = 20
const recent = history.slice(-MAX_CONTEXT_MESSAGES)
```

**改后**（按模型窗口动态算）：

```ts
function computeMaxContextMessages(
  contextWindow: number, // SDK 返回的窗口
  systemTokens: number, // system prompt 占的 token
  toolsTokens: number, // 工具定义占的 token
  reservedForOutput: number // 给模型留的 max_tokens
): number {
  const budget = contextWindow - systemTokens - toolsTokens - reservedForOutput
  // 平均每消息 ~500 token（保守估计, 含图片 1500-5000）
  return Math.max(5, Math.floor(budget / 500))
}
```

##### 🔴 P0-2: Model 名验证（启动时 ping 一次）

**场景**：用户在 channel 配置里写 `MiniMax-M3`，但端点只接受 `claude-3-5-sonnet-...`。

**改前**：直接发请求 → 400 (2013) → 死。

**改后**：ChannelManager 加 `validateChannel()`：

```ts
async function validateChannel(channel: Channel): Promise<ValidationResult> {
  try {
    const resp = await fetch(channel.baseUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${channel.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: channel.model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    })
    if (resp.status === 400) {
      const body = await resp.json().catch(() => ({}))
      return { ok: false, error: body.error?.message ?? 'model rejected' }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}
```

启动 App 时跑一遍，**model 不合法直接红字提示用户在设置里换**。

##### 🟡 P1-1: Tool result 大块截断（按 token 算）

**改前**（按字符，200 字符一刀切）：

```ts
const MAX_TOOL_SUMMARY_LENGTH = 200
if (joined.length > MAX_TOOL_SUMMARY_LENGTH) {
  return joined.slice(0, MAX_TOOL_SUMMARY_LENGTH) + '...'
}
```

**改后**（按 token 估算 + 保留头尾）：

```ts
function summarizeToolResult(content: string, budgetTokens: number = 500): string {
  const tokens = estimateTokens(content)
  if (tokens <= budgetTokens) return content

  // 保留头 40% + 尾 60%（通常 tail 含关键结果）
  const headRatio = 0.4
  const headChars = Math.floor(budgetTokens * headRatio * 4) // 粗估 1 token ≈ 4 chars
  const tailChars = Math.floor(budgetTokens * (1 - headRatio) * 4)
  return content.slice(0, headChars) + '\n... [truncated] ...\n' + content.slice(-tailChars)
}
```

##### 🟡 P1-2: 图片附件 placeholder 注入

**改前**（`buildContextPrompt` line 334-338 只取 text）：

```ts
const textParts = content.filter((b) => b.type === 'text' && b.text).map((b) => b.text!)
```

**改后**（图片注入 placeholder）：

```ts
const textParts: string[] = []
let imageCount = 0
for (const b of content) {
  if (b.type === 'text' && b.text) {
    textParts.push(b.text)
  } else if (b.type === 'image') {
    imageCount++
  }
}
if (imageCount > 0) {
  textParts.push(`[本消息含 ${imageCount} 张图片]`)
}
```

Agent 至少知道"那张图你看过"，不会再问"你之前发的图呢"。

##### 🟡 P1-3: 客户端手动 compact 工具（fallback 兜底）

**场景**：SDK 服务端 compaction 失败（9120caac 就是）。

**改**：新增 LLM tool `compact_session`：

```ts
const compactSessionTool: ToolDefinition = {
  name: 'compact_session',
  description: '主动压缩当前会话历史。SDK 压缩失败时用，生成摘要替换最早的消息。',
  input_schema: {
    type: 'object',
    properties: {
      strategy: { type: 'string', enum: ['summarize', 'drop_old_tool_results', 'keep_last_n'] },
      keepLastN: { type: 'number', default: 10 },
    },
  },
}
```

`strategy: 'drop_old_tool_results'` 是最便宜的——只丢老 tool_use/tool_result 对，保留 user/assistant 文本。

##### 🟢 P2-1: Nudges 提示"context 80% 满"

复用 §6.5.4 Nudges 机制——加 1 个模式：

| 模式             | 检测条件                                | 候选动作       | 提示语                            |
| ---------------- | --------------------------------------- | -------------- | --------------------------------- |
| context 接近上限 | `usage / contextWindow > 0.8` 且 < 0.95 | 主动 compact   | "上下文已用 80%，要 compact 吗？" |
| context 危险     | `usage / contextWindow > 0.95`          | 强制切 session | "上下文将满，建议新建会话"        |

##### 🟢 P2-2: 圆环颜色预警

`AgentView.tsx:1927` 的 context 圆环——按使用率换色：

| 使用率 | 颜色  | 含义               |
| ------ | ----- | ------------------ |
| < 70%  | 灰/绿 | 安全               |
| 70-90% | 黄    | 接近阈值           |
| > 90%  | 红    | 危险，建议 compact |

#### 8.4.3 与 Claude Code / Codex 对比（trade-off 诚实）

| 维度           | Claude Code        | Codex       | TAgent (P0+P1 后)              | TAgent (当前)          |
| -------------- | ------------------ | ----------- | ------------------------------ | ---------------------- |
| API 选型       | 真实 Anthropic     | 真实 OpenAI | **任意兼容端点**（需用户配对） | 同                     |
| Model 名       | **固定**           | **固定**    | **用户配置**（启动需验证）     | **未验证**（运行时炸） |
| Auto-compact   | ✅ 客户端 + 服务端 | ✅ 服务端   | ⚠️ 只靠 SDK                    | ⚠️ 只靠 SDK            |
| 手动 compact   | `/compact` slash   | 无 UI       | **`compact_session` tool**     | ❌ 无                  |
| Token 预算动态 | ✅ 实时            | ✅ 服务端   | ✅ P0-1 后                     | ❌ 硬编码 20           |
| Fallback 链    | haiku 自动切       | 无          | ❌ 仍无（可加）                | ❌                     |
| 图片历史       | 完整               | N/A         | ✅ P1-2 后 placeholder         | ❌ 整块丢              |
| Tool result    | 服务端截断         | 服务端      | ✅ P1-1 后按 token 截          | ❌ 200 字符硬截        |

**TAgent 接受"任意兼容端点"换更大的灵活性**——代价就是需要自己管 model 验证、compact fallback。**P0+P1 补完后，能 cover 90% Claude Code 的体验**。

#### 8.4.4 与 §6.5 记忆系统的关系

§6.5 谈的"记忆 5 层"是**长期跨 session 知识**。§8.4 谈的"context 管理"是**单 session 内 token 预算**。两者不冲突：

| 维度     | §6.5 记忆 5 层           | §8.4 Context 管理                     |
| -------- | ------------------------ | ------------------------------------- |
| 时间跨度 | 跨 session（数天-数月）  | 单 session（数小时）                  |
| 存储位置 | `~/.tagent/memory/L0-L5` | `~/.tagent/agent-sessions/{id}.jsonl` |
| 写入触发 | Nudges / Reflect / 显式  | 每个 turn 自动（SDK）                 |
| 读取触发 | system prompt 头部       | 直接进入 LLM 调用                     |
| 裁剪策略 | LRU + 上限               | **滚动窗口 + token 预算**（P0-1）     |
| 跨模式   | 默认隔离（L0 可选共享）  | 通用模式专用，TA 模式独立             |

**两者要协同**：§6.5 写的"prefetch" 内容（来自 L0/L1/L2/L5）会进 system prompt；§8.4 管的 conversation_history 进 user/assistant 消息区。**两者 token 总和必须 < contextWindow**——这就是为什么 P0-1 要算"系统 + 工具 + 历史 + 输出"的总预算。

#### 8.4.5 实施成本

| 优先级                   | 工时   | 风险                                  |
| ------------------------ | ------ | ------------------------------------- |
| 🔴 P0-1 动态预算         | 半天   | 🟢 低（加 fallback 到原 20）          |
| 🔴 P0-2 model 验证       | 半天   | 🟢 低（启动时多 1 个 fetch）          |
| 🟡 P1-1 tool 截断        | 半天   | 🟢 低（只是展示）                     |
| 🟡 P1-2 图片 placeholder | 1 天   | 🟢 低                                 |
| 🟡 P1-3 compact tool     | 2-3 天 | 🟡 中（要写 LLM tool + 实际压缩逻辑） |
| 🟢 P2-1 nudges           | 半天   | 🟢 低                                 |
| 🟢 P2-2 圆环颜色         | 1 小时 | 🟢 低                                 |

**总 ~ 1 周**。P0+P1 ~ 4 天，P2 ~ 半天。

#### 8.4.6 触发 9120caac 那次具体报错的根因

`400 (2013)` = `invalid_request_error`。

**不是** context 溢出（`400 (2024)`），是 **model 名 `MiniMax-M3` 不被 `nengpa.com` 端点接受**。

**P0-2 model 验证能 100% 防住**——启动时 ping 一次就知道这个 model 不能用，**用户根本进入不了会话**。

**P0-1 动态预算是 P0-2 的兜底**——如果 model 配对了但用户硬塞了大附件导致真溢出，至少能优雅降级（自动切到少取 N 条）而不是整个 session 死掉。

---

## 9. 品牌替换（Proma → TAgent）

### 9.1 替换范围（基于 Proma 现状 ~435 .ts/.tsx 文件）

| 类别             | 范围                                                   | 工作量         |
| ---------------- | ------------------------------------------------------ | -------------- |
| npm scope        | `@proma/*` → `@tagent/*`（5 个包）                     | codemod 跑一遍 |
| 类型前缀         | `PromaPermissionMode` → `TAgentPermissionMode` 等      | codemod 跑一遍 |
| 路径常量         | `~/.proma/` → `~/.tagent/`                             | 全局替换       |
| 环境变量         | `PROMA_*` → `TAGENT_*`                                 | 全局替换       |
| 用户可见字符串   | "Proma" → "TAgent"（设置面板、about 对话框、托盘菜单） | 手动 + codemod |
| electron-builder | `appId`、`productName`                                 | 手动           |
| 文档             | AGENTS.md、CLAUDE.md、README                           | 手动           |

### 9.2 替换策略

用 `jscodeshift` 分批跑：

1. 阶段 1：scope 替换（`@proma/` → `@tagent/`）+ 类型前缀（`Proma` → `TAgent`）
2. 阶段 2：路径常量 + 环境变量
3. 阶段 3：用户可见字符串 + electron-builder 配置
4. 阶段 4：文档

**保留不动**：`@anthropic-ai/claude-agent-sdk`、`@anthropic-ai/sdk`（上游 SDK scope，不属于"Proma 品牌"）。

---

## 10. 实施计划

### 10.1 阶段划分

| 阶段                                   | 内容                                   | 估时   | 状态      |
| -------------------------------------- | -------------------------------------- | ------ | --------- |
| **P0 品牌替换**                        | `@proma/*` → `@tagent/*` 等 codemod    | 3-5 天 | ✅ 已完成 |
| **P0 ta_agent 加 MCP server mode**     | mcp_server.py（~300 行）+ 5 个核心工具 | 1 周   | ✅ 已完成 |
| **P0 Proma 端 MCP 配置**               | IPC + Preload + UI 状态检测            | 2 天   | ✅ 已完成 |
| **P0 验证工具可调通**                  | 集成测试（手动安装 Python 环境）       | 3 天   | 🟡 待做   |
| **P1 ModeManager + 顶层 Tab**          | Jotai atoms + UI 切换                  | 1 周   | ✅ 已完成 |
| **P1 模式互斥 + 后台跑完**             | ModeManager 锁 + PushNotification      | 1 周   | 🟡 待做   |
| **P1 switch_mode 工具**                | 两个 runner 内置 + Modal               | 3 天   | 🟡 待做   |
| **P2 资产库 SQLite 直读 + UI**         | better-sqlite3 + 列表/详情/搜索        | 2-3 周 | 🟡 待做   |
| **P2 记忆 5 层 + FTS5**                | ta_agent memory/ 扩展                  | 2-3 周 | 🟡 待做   |
| **P2 StreamingContextScrubber**        | Proma + ta_agent                       | 3 天   | 🟡 待做   |
| **P2 审核队列 / 流水线 / 项目配置 UI** | Proma 设计系统重写                     | 4-6 周 | 🟡 待做   |
| **P3 Token 统计 / Cache 命中率 UI**    | 通用模式特有                           | 1 周   | 🟡 待做   |
| **P3 Memory Monitor UI**               | 借鉴 hermes                            | 1 周   | 🟡 待做   |
| **P3 反思 / Nudges / 清理**            | hermes + GA 思路                       | 2 周   | 🟡 待做   |

**设计变更（2026-06-07）**：

- ~~"P0 Python 嵌进打包"~~ 已删除，改为用户手动安装 Python + ta-agent-mcp
- 原因：用户选择"保持手动安装"方案，更灵活且避免打包体积膨胀
- 影响：P0 阶段减少 3 天工作量，但需要用户自行安装 Python 环境

**MVP = P0 全部 ≈ 1.5 周**（ta_agent MCP server 跑通 + Proma 端能调工具 + 模式可切换 + 严格互斥）

### 10.2 MVP 范围外的明确延后

- ❌ 真·OpenAI Agent SDK（`@openai/codex-sdk`）
- ❌ Honcho / Mem0 / Hindsight 外部 memory provider
- ❌ Autonomous skill creation（hermes 思路）
- ❌ Skill self-improve（hermes 思路）
- ❌ 跨模式 L0 共享开关（先默认独立）
- ❌ agentskills.io 兼容（MVP 后再说）
- ❌ **MCP 设置页面集成**（2026-06-07 用户提出：内置 MCP 分类展示 + 一键安装指引）
- ❌ **Agent 对话智能引导**（2026-06-07 用户提出：检测 TA 相关意图 + 主动提示安装）

---

## 11. 风险与缓解

| 风险                                            | 影响         | 缓解                                            |
| ----------------------------------------------- | ------------ | ----------------------------------------------- |
| ta_agent 54 工具的 schema 翻译到 MCP 协议有偏差 | 工具调用失败 | MVP 阶段跑通 5-10 个核心工具先验证              |
| better-sqlite3 + ta_agent sqlite3 并发写冲突    | 数据损坏     | Proma readonly pragma + ta_agent WAL + 队列化写 |
| 切模式时 task 状态丢失                          | 用户体验差   | 后台跑完 + 红点 + PushNotification              |
| Codemod 替换不彻底                              | 编译失败     | 全量 typecheck + grep 兜底验证                  |
| PyInstaller 打包后体积爆炸                      | 下载体验差   | UPX 关闭 + 评估 trimesh 等可选模块              |
| TAgent system prompt 注入太长                   | token 浪费   | 启动时分块 + 按需召回                           |
| TA 模式 54 工具 vs Claude SDK 内置工具的冲突    | 工具名冲突   | 工具命名空间化（`tagent__analyze_assets`）      |

---

## 12. 12 个开放问题（已全部拍板）

**2026-06-05 拍板 1-6, 2026-06-06 补拍 7-11**：

1. **TA 模式 54 工具的命名空间化**：✅ **加 `tagent__` 前缀**（如 `tagent__analyze_assets`）。避免与 Claude SDK 内置工具冲突，保留未来扩展空间。
2. **OpenAI provider 的 cache 字段**：✅ **MVP 支持**。Proma 已有实现零成本。OpenAI 下数字恒为 0（不报错不显示），但通用 + TA 模式行为一致。
3. **切模式时 Claude SDK session 续接**：✅ **新建**（§5.3 已定）。原 session 归档，target 模式新 session + summary。
4. **MVP 资产库是否支持写**：✅ **Proma 端只读，写走 ta_agent MCP**。避免并发冲突，Proma 不会有"脏写"。
5. **Pipeline Editor 的 UI 重写工作量**：✅ **MVP 不做**。M2+ 阶段单独做。节省 6 周 UI 工作量。
6. **记忆 5 层的存储格式**：✅ **混合方案**（md + JSONL + SQLite）。L0-L2 + L5 用 Markdown（人可读），L3 corrections 用 JSONL + rules.json（结构化 + 可回滚），L4 sessions 用 SQLite + FTS5（全文搜索）。
7. **TA 模式数据目录布局**（2026-06-06 补）：✅ **`~/.tagent/ta/` 统一根**（跨平台）。详见 §3.3。资产库 / 静态配置 / 5 层记忆 / UE5 桥接 / 会话 / 用量日志全在 `ta/` 子目录下；通用模式（chat/agent）继续在 `~/.tagent/` 根下不混。ta_agent 启动时通过 `TA_AGENT_DATA_DIR=~/.tagent/ta` env 指向（已有 env 支持, 见 `ta_agent/packages/core/project_config.py:363`）。
8. **缓存机制 + 目录规范**（2026-06-06 补）：✅ **A1 + B2 + C1 组合**。详见 §3.4。统一数据根在 `~/.tagent/`（现有数据保持位置，只新增 `cache/` `logs/` `tmp/` `electron-userdata/` 4 个子目录）；Electron userData 合并到 `~/.tagent[-dev]/electron-userdata/`（dev/prod 分别走 `~/.tagent-dev` / `~/.tagent`）；启动时 `cacheScanLRU()` 自动清理 1-7 天过期的派生缓存 + 临时文件。TA 模式与通用模式分账隔离（详见 §3.4.3 对照表），但都在同一个 `~/.tagent/` 根下。
9. **L 命名冲突解决**（2026-06-06 补）：✅ **记忆层保留 L0-L5**（与 hermes Honcho / GenericAgent 兼容），**§3.4 缓存分类改名 C1-C5**（C = Cache）。原因：§3.4 原本用 L1-L5 表示 5 类缓存目录（C1 持久数据 / C2 缓存 / C3 日志 / C4 临时 / C5 Electron 内部），与 §6 记忆层 L0-L5 同字母冲突（看到 "L1" 用户无法判断是缓存还是记忆）。改后 §3.4 树状图与 §3.4.3 对照表里的 L1-L5 全部改为 C1-C5；§6 全部不动。
10. **记忆自进化机制**（2026-06-06 补）：详见 §6.5。**L0 双重表示**（global_view + peer_view，借鉴 Hermes Honcho 双层结构）；**自进化 4 机制**（Nudges 每 5 turn / Reflect 每日 03:00 + anti-echo 算法 / Scheduled Cleanup 每周日 04:00 / Self-Repair 每月 1 日）；**8 个生命周期事件**精确到桌面应用触发点（turn_start / turn_end / session_idle / session_end / session_switch / pre_compress / post_compress / subagent_done）；**5 层上限**（L0 50 条/视图 / L1 100 / L2 500 / L3 raw 1000 → 压缩 / L4 30 天热 / L5 20）；**跨模式隔离 UX**（L0 默认独立 + 可选共享开关；切模式弹 modal 问 L1 是否带）。TAgent 在 7 个自进化维度中 6 个领先 Hermes（除压缩外持平），但**全部是设计，0 实跑**——见 §6.4 的 1160 行待实现代码 + 后续 M2 排期。
11. **Agent 工作区机制 + UI 重构**（2026-06-06 补）：详见 §3.5。**5 个核心概念**（工作区 / workspace-files / 附加工作区目录 / 附加工作区文件 / 会话附加目录）精确定义 + 读/写拆分的设计动机（不污染用户代码 + 跨会话共享）。**D 方案 v2 UI 布局**（左侧拆 2 列并排：Column 1 60% 工作区管理 + Column 2 40% 会话列表；中部 Chat/Agent；右侧 2 Tab 仅当前会话相关 = 会话文件 + 文件改动）。**删除**右侧"工作区文件" Tab（配置已搬左侧 Column 1）。**新增**"会话列表"组件（当前 TAgent 居然没有！用户只能从 Chat 顶部 dropdown 切）。**重命名**"附加工作区文件" → "附加文件"（避免和"工作区文件目录"混淆）。**实现成本** ~ 1.5-2 周（纯 UI 重构 + 1 个新组件，后端 API 0 改动）。**trade-off**：TAgent 用更高的学习曲线（5 个概念需解释）换 4 个独特能力（多工作区、附加多目录、跨 session 共享、Agent 内部笔记分离）。
12. **Context 管理机制**（2026-06-06 补）：详见 §8.4。**根因澄清**：`9120caac.jsonl` 6.8MB / 2153 条报错 `400 (2013)` 不是 context 溢出（`400 (2024)` 才是），而是 model 名 `MiniMax-M3` 不被 `nengpa.com` 兼容端点接受。但 6.8MB 历史怎么处理是真问题。**7 项改进**：P0-1 动态 token 预算（`buildContextPrompt` 接 `contextWindow` 替代硬编码 20 条）；P0-2 启动时 model 名验证（ping 一次测试请求）；P1-1 tool result 按 token 截断（替代 200 字符硬截）；P1-2 图片附件 placeholder 注入（避免 buildContextPrompt 整块丢图片）；P1-3 客户端 `compact_session` 工具（fallback 兜底 SDK 压缩失败）；P2-1 Nudges 提示 context 80% 满；P2-2 圆环颜色预警（70% 黄 / 90% 红）。**总工时 ~ 1 周**（P0+P1 ~ 4 天）。**trade-off**：TAgent 接受"任意兼容端点"换更大灵活性，代价是 model 验证 + compact fallback 都得自己管——P0+P1 补完后能 cover 90% Claude Code 体验。

---

## 13. 引用

- `F:\ta_agent\packages\tools\memory\` — TAgent 现有 memory 实现
- `F:\hermes-agent\agent\memory_manager.py` — hermes StreamingContextScrubber
- `F:\hermes-agent\agent\memory_provider.py` — hermes MemoryProvider ABC
- `F:\hermes-agent\plugins\memory/` — 8 个外部 memory provider
- `F:\GenericAgent\memory\L4_raw_sessions/compress_session.py` — GenericAgent L4 层
- `F:\GenericAgent\reflect/` — GenericAgent 反思层
- `F:\Proma\apps\electron\src\renderer\atoms\agent-atoms.ts:60-100` — Proma AgentStreamState（input/output/cache 字段）
- `F:\Proma\apps\electron\src\renderer\hooks\useGlobalAgentListeners.ts:202-211` — Token 数据源
- `F:\Proma\apps\electron\src\renderer\atoms\app-mode.ts` — Proma appModeAtom（chat/agent/scratch）
- `F:\Proma\packages\core\src\providers/` — Proma 12 Provider Adapter
- `.claude\CLAUDE.md` — 本工程 Agent 上下文
- `F:\ta_agent\packages\tools\registry.py:194-244` — 65 工具 schema 列表
- `F:\ta_agent\packages\tools\registry.py:152-175` — DEFAULT_TOOLSET（18 工具，通用模式白名单）
- `F:\ta_agent\packages\tools\extensions\ue5_bridge.py:534-549` — UE5 9 工具
- `F:\ta_agent\packages\tools\mcp_bridge.py:419-495` — MCP 6 工具

---

## 14. TA 模式工具粒度（20 LLM + 45 UI）

**核心问题**（2026-06-05 用户提出）：ta_agent 现有 65 个工具（47 core + 9 UE5 + 6 MCP + 3 plugin）全部作为 LLM tool 会：

- 污染 system prompt（每次带 ~3000 token 工具 schema）
- LLM 选择困难
- 大量"读/管理/单属性 setter"类工具本应是 UI 而非 LLM tool

**决策**：**压缩到 ~20 LLM 工具 + 45 UI 面板/按钮**。

### 14.1 LLM 工具集（20 个）

按"LLM 决策驱动的工作流节点"选取：

| #   | 工具名                   | 作用                      | 工作流位置 |
| --- | ------------------------ | ------------------------- | ---------- |
| 1   | `analyze_assets`         | 扫描 + 解析 + 推断 全流程 | **起点**   |
| 2   | `run_ai_inference`       | 单独跑 AI 推断            | 分析后     |
| 3   | `search_assets`          | 语义搜索资产库            | 任意时刻   |
| 4   | `check_naming`           | 命名规范检查              | 入库前     |
| 5   | `record_correction`      | 记录用户纠正              | 反馈       |
| 6   | `append_profile_fact`    | 追加事实到 L2             | 长期记忆   |
| 7   | `memory_read_facts`      | 读 L2 facts               | 上下文     |
| 8   | `memory_read_sop`        | 读 L2 SOP                 | 上下文     |
| 9   | `discover_conventions`   | 扫描项目规范              | 项目接入   |
| 10  | `load_conventions`       | 加载规范到上下文          | 项目接入   |
| 11  | `intake_approved`        | 一键入库已审核            | 终点       |
| 12  | `ue5_import_asset`       | 导入到 UE5                | 终点       |
| 13  | `ue5_configure_asset` ⭐ | 合并原 5 个 setter        | UE5 后处理 |
| 14  | `submit_review`          | 提交审核                  | 中间       |
| 15  | `batch_approve`          | 批量通过                  | 中间       |
| 16  | `check_fbx_info`         | 单文件深度解析            | 排查       |
| 17  | `check_texture_batch`    | 贴图批量检查              | 排查       |
| 18  | `check_mesh_budget`      | 面数预算                  | 排查       |
| 19  | `get_memory_stats`       | L0-L5 状态总览            | 调试       |
| 20  | `ue5_get_asset_info`     | 读 UE5 资产信息           | 调试       |

### 14.2 UI 直达的工具（45 个）

**MCP server 仍然暴露全部 65 个**（保留向后兼容），但 Proma 端只把上面 20 个注册为 LLM tool；剩下 45 个由 UI 直接调用，**不经过 LLM**。

| UI 类别         | 工具                                                                                                                                        | UI 形态                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **资产库**      | `list_assets` / `get_asset_detail` / `count_assets`                                                                                         | 资产列表/详情面板                                                                               |
| **审核**        | `get_pending_reviews` / `get_review_detail`                                                                                                 | 审核面板                                                                                        |
| **文件 / FS**   | `workspace_read_file` / `workspace_write_file` / `workspace_list_dir` / `scan_directory` / `check_file_info`                                | 文件浏览器（沿用 Proma 现有）                                                                   |
| **目录 / 命名** | `check_directory_structure` / `suggest_naming` / `suggest_rename` / `rename_asset` / `batch_rename` / `move_asset` / `create_directory`     | 命名 / 重命名对话框                                                                             |
| **资产编辑**    | `update_asset` / `update_asset_type`                                                                                                        | 资产属性编辑表单                                                                                |
| **预览 / 报告** | `render_asset_preview` / `generate_report`                                                                                                  | 预览图 + 报告生成按钮                                                                           |
| **项目配置**    | `check_project_config` / `list_project_configs` / `create_project_config` / `load_project_config` / `add_custom_rule`                       | 项目设置向导                                                                                    |
| **UE5 桥接**    | `ue5_ping` / `ue5_check_plugin` / `ue5_set_material` / `ue5_set_nanite` / `ue5_set_lod_group` / `ue5_set_metadata` / `ue5_create_collision` | UE5 桥接面板（含"测试连接""配置资产属性"等按钮；后 5 个 setter 在 UI 走 `ue5_configure_asset`） |
| **MCP 管理**    | `mcp_list_servers` / `mcp_add_server` / `mcp_remove_server` / `mcp_toggle_server` / `mcp_reload_servers` / `mcp_test_connection`            | MCP 管理面板                                                                                    |
| **环境检查**    | `check_blender`                                                                                                                             | 设置页状态卡片                                                                                  |

### 14.3 关键架构决策：UI 直达 MCP 的路径

```
[UI 按钮（如"批量重命名"被点击）]
  ├─→ Renderer: 调 useUiTool('batch_rename', {files, rule})
  │     └─→ IPC: ui:tool:call (via preload)
  │           └─→ Main process: UiToolExecutor.execute('batch_rename', args)
  │                 └─→ 直接调 MCPManager.client.callTool('batch_rename', args)
  │                       └─→ ta_agent MCP server 执行
  │                             └─→ 返回 JSON
  │           └─→ 返回 Promise 给 UI
  └─→ UI 更新
```

**关键点**：

- UI 工具调用**完全绕过 Claude Agent SDK**
- Main process 复用 MCPManager 的 client（不必新建连接）
- 错误处理：直接捕获异常 → 弹 toast
- 进度上报：长操作走 SSE / WebSocket（与 chat 流共用）

### 14.4 收益

| 维度                  | 数值                              |
| --------------------- | --------------------------------- |
| LLM tool schema token | 从 ~3000 → ~1500（节省 50%）      |
| LLM 选择准确度        | 提高（少即是多）                  |
| UI 响应               | 直接调，**0 LLM 延迟**            |
| 误操作风险            | UI 按钮 = 用户主动，避免 LLM 误调 |
| UI 工作量             | **+2-3 周**（45 个按钮/面板）     |

### 14.5 实施调整

| 阶段                   | 调整                                              |
| ---------------------- | ------------------------------------------------- |
| P0 `mcp_server.py`     | **不变**（仍暴露 65 函数）                        |
| P0 LLM tool 注册       | **新增** `ta_mode_llm_tools.json`（白名单 20 个） |
| P0 MCP 客户端          | **扩展**：增加 `UiToolExecutor` 类                |
| P1 UI 工具调用基础设施 | 新增 `useUiTool` hook + IPC channel               |
| P2 UI 工作量           | **从 4-6 周增到 7-9 周**（多出 45 个 UI 元素）    |

### 14.6 受影响的设计章节

- §4.1 组件清单：加 `UiToolExecutor`
- §10 实施计划：P2 时间 +2-3 周

---

## 15. 未来功能：轻量级 Agent 监控前端

**2026-06-05 拍板**：后加需求，**不进 MVP**。**不参考 hermes claw3d**（那个太重，3D 虚拟办公室不是我们要的）。

### 15.1 形态

- **内嵌 Tab** in TAgent Desktop（不是独立 web 应用）
- 复用现有 React + Jotai + Tailwind
- 加新 IPC channel: `monitor:stream`
- **只读**（监控，不改）

### 15.2 数据粒度：**按 session**

- 活跃 session 卡片网格（每个 session = 一张卡）
- 状态颜色：idle / running / error
- 显示：mode（通用/TA）、provider、model、当前 tool、运行时长
- 点击 → 展开看消息 log

### 15.3 MVP 监控页 4 个 widget

| Widget                | 数据源                                      | 更新频率 |
| --------------------- | ------------------------------------------- | -------- |
| 活跃 session 卡片网格 | `agentSessionsAtom`（已有）                 | 实时订阅 |
| 今日 cost 概览        | `useGlobalAgentListeners.ts:202` 已有 usage | 5s 聚合  |
| 工具调用 timeline     | tool call log（需 instrument）              | 实时滚动 |
| MCP server 状态       | 进程状态检测                                | 10s 轮询 |

### 15.4 数据流

```
[Proma main process]
  ├─ ta_agent MCP server 输出（已有 stderr）
  ├─ 工具调用日志（需 instrument）
  └─ Session 状态变化（agent runner 已有）
       ↓
   内存聚合（最近 5 分钟事件，rolling buffer）
       ↓
   新 IPC channel: monitor:stream
       ↓
   Renderer 监控 Tab
```

### 15.5 实施时机

- MVP 跑通后（M1+ 阶段）
- 工具调用日志先 instrument，监控 UI 后做
- 不写独立 web 应用，**全部进 Desktop**
- 估时：1 周（基础 4 个 widget）+ 后续按需扩展

### 15.6 不做的事

- ❌ 3D 虚拟办公场景（claw3d 思路）
- ❌ 多人 VR 互动
- ❌ 用户头像
- ❌ 写能力（监控 = 只读）
- ❌ 独立部署（嵌进 Desktop 即可）
- ❌ 引入 grafana / prometheus 等重型方案（Proma 规模不需要）

### 15.7 与借鉴清单的关系

- 与 hermes-desktop **claw3d 完全无关**（已 review 不借鉴）
- 与 hermes-agent **Kanban 概念部分相关**（如果未来要做"任务管理"才用）
- 当前阶段**只与 Proma 现有 instrumentation 复用**

---

## 17. ta_agent 老仓库遗漏的 5 个关键发现（2026-06-05 排查）

排查 `F:\ta_agent` 时漏扫的 5 个关键内容，**全部正式补进 TAgent 设计**：

### 17.1 三层权限模型（HARDLINE / DANGEROUS / SAFE）

**来源**：`F:\ta_agent\docs\decisions\general-mode-redesign.md`（2026-06-03）
**TAgent 之前漏提**，必须补：

```
HARDLINE（绝对禁止，内置不可绕过）
  rm -rf /, mkfs, shutdown, format, DROP DATABASE

DANGEROUS（每次询问，UI 弹窗）
  rm -r, chmod 777, git push --force, curl|sh, kill -9 -1

SAFE（自动放行，静默）
  Read, Glob, Grep, WebSearch
  ls, cat, git status/log/diff
```

- 通用 mode 必加
- TA mode 工具调用已天然限权（54 工具白名单），**TA mode 不强需此模型**
- 白名单粒度：
  - 本次会话 → 内存 Map（Proma 风格）
  - 永久 → 写到 `app-config.json`（hermes 风格）

### 17.2 3 角色 RBAC

**来源**：`F:\ta_agent\docs\decisions\user-auth-design.md`（2026-05-20）

TAgent Server 设计 §5 之前**只提 X-Username 简化鉴权**，**没提正式 RBAC**。补：

| 角色                    | 权限                                                 |
| ----------------------- | ---------------------------------------------------- |
| **普通用户**（美术）    | 查项目配置（只读）、提交分析、查自己审核、用本地记忆 |
| **管理者**（组长 / TA） | 改项目配置、审核资产、查所有用户的资产、编辑 L1 规则 |
| **超级管理员**          | 管用户权限、添加 / 移除管理员、系统设置              |

**MVP 阶段**：仅普通用户角色（因为 SSO appid 还没申请，正式角色管理延后）。
**SSO 集成后**：完整 RBAC 启用。

### 17.3 5 层记忆的 4 大设计原则

**来源**：`F:\ta_agent\docs\decisions\memory-system.md` + `docs/guides\memory-layout.md`

§6 之前只提"5 层结构"。补**设计原则**：

1. **无纠正不记忆**：只有用户显式纠正才写入，LLM 自己的推测永远不存
2. **最小充分**：只编码精简规则，不存原始对话
3. **按需注入**：根据当前资产特征匹配相关规则，不全量塞 prompt
4. **自压缩**：超过阈值自动合并，token 消耗始终可控

### 17.4 借鉴：TAgent Server ≈ ta_agent 老 distributed-architecture

**来源**：`F:\ta_agent\docs\decisions\distributed-architecture.md`（2026-05-20）

TAgent Server 设计与老设计 **80% 重叠**：
| 老设计 | TAgent Server 设计 | 一致度 |
|---|---|---|
| 资产/审核/项目配置 → 服务器 | ✅ 一样 | 100% |
| 会话/记忆 → 本地 | ✅ 一样 | 100% |
| 数据流：本地分析 → 同步服务器 | ✅ 一样 | 90% |
| 联机不取消本机 | ✅ 一样 | 100% |
| SSO 集成 (XSJSSO) | ⚠️ 延后（应用未申请） | 0% |
| 3 角色 RBAC | ⚠️ 延后（同上） | 0% |
| 多项目管理 | ❌ 没写 | 0% |
| 用量统计管理 | ⚠️ 部分（usage_log 已实现） | 50% |

**TAgent Server 文档应明确**："基于 2026-05-20 distributed-architecture 决策，吸收其 80% 设计，补 20% 缺失"。

---

## 18. ta_agent 排查完整清单

排查覆盖（2026-06-05 第二次扫）：

| 类别                  | 数量                                 | 状态                                                                     |
| --------------------- | ------------------------------------ | ------------------------------------------------------------------------ |
| ADRs (decisions/)     | 9 个                                 | ✅ 全扫（含 2 个新发现：general-mode-redesign, user-auth-design）        |
| Guides                | 2 个                                 | ✅ 扫完                                                                  |
| Reference             | 4 个                                 | ✅ 扫完（之前已读）                                                      |
| Experiments           | 14 个                                | ⚠️ 大部分扫完，**hidden-bugs-audit 和 deepseek-cache-optimization 需补** |
| Release notes         | 5 个                                 | ⚠️ v0.19-v0.23 标题扫完，**详细 changelog 没深读**                       |
| Business docs         | 3 个                                 | ❌ 未读（产品介绍 / 演示文稿，对工程无直接价值）                         |
| 关键源代码            | 50+ 文件                             | ✅ 80% 扫完                                                              |
| Plugins/TAAssetBridge | C++ 头                               | ✅ 扫完                                                                  |
| 运行时数据            | usage_log.jsonl, pipeline_runs.jsonl | ✅ 发现并吸收到 §19.10                                                   |

**未扫盲区**（不重要，可后续）：

- `tutorial/` 目录：不存在
- `.ta_agent/memory/{general,ta}/sops/`：TA 模式实际 SOP（**重要，待补**）
- `docs/sops/tagent_memory_sop.md`：用户专门写的记忆写入决策树（**重要，待补**）
- `apps/desktop/main.js`：Electron 主进程核心（**之前已读**）
- `apps/desktop/preload/index.js`：IPC 桥（**部分读**）

---

## 16. Hermes 形态确认 + ACP 借鉴（未来扩展）

**2026-06-05 确认**：hermes-agent 是**单 agent 主框架 + subagent / 背景 fork / ACP 扩展**，不是"群体智能"多 agent 协作。

### 16.1 Hermes 形态

```
AIAgent（主，常驻）
  ├─ Subagent 派生（临时，parallel workstreams）
  ├─ Background Fork（daemon thread，定期 review）
  ├─ ACP 适配（外部 peer 协议）
  ├─ Batch Runner（multiprocessing 批处理）
  └─ Multi-channel Gateway（Telegram/Discord/... 多前端）
```

### 16.2 TAgent 当前形态

- **单 agent per mode**（通用模式 1 个，TA 模式 1 个）
- **无 subagent**（MCP 工具可调，但 agent 不会派生子 agent）
- **ACP 集成暂无**（编辑器和 TAgent 通信靠 MCP / WebSocket）

### 16.3 ACP 集成（未来扩展，⭐ 高价值）

**借鉴 hermes 的 acp_adapter/ 实现，让 TAgent 作为 ACP peer 暴露**。

价值：

- VS Code / Cursor / Zed 编辑器原生 @-mention TAgent
- 编辑器里 inline ask / code action 直接调 TAgent
- TAgent 进入"专业开发者工具"层级

技术栈：

- 参考 `hermes-agent/acp_adapter/` 实现
- ACP 标准：[https://github.com/agentclientprotocol/agent-client-protocol](https://github.com/agentclientprotocol/agent-client-protocol)
- TAgent 端实现 `acp_server.py`（Python，复用 ta_agent 代码）
- 编辑器侧：主流编辑器已支持或正在支持 ACP

**不进 MVP**。M2+ 阶段实施。估时：2-3 周。

### 16.4 Subagent 派生（未来扩展，⭐ 高价值）

**借鉴 hermes 的 subagent 思路，让 TAgent TA 模式能并行处理多个资产**。

场景：

- 用户："分析 D:\Assets\Batch01 的 100 个 FBX"
- 主 agent 派生 8 个 subagent，并行处理（每 subagent 12-13 个文件）
- 完成后合并结果写入 SQLite

技术栈：

- 用 Python multiprocessing（hermes 用同款）
- subagent 用受限 tool set（只读 + 写特定 tag）
- 主 agent 收所有 subagent 结果，合并

**不进 MVP**。M1+ 阶段实施。估时：1-2 周。

### 16.4.1 Subagent 落地教训（来自 ta_agent 上一版实践）

**来源**：`F:\ta_agent-worktrees\subagent-impl`（commit 历史 30+ 个，4 个 fix + 3 个 debug + 1 个 revert）

TAgent 加 subagent 时必避 8 个坑：

1. **事件流是头号 bug 源**
   - 坑：曾有"两个 progress drain loop"互相抢事件，"raw progress loop 偷走 subagent 事件"
   - 修复：合并成 **一个** progress drain loop
   - TAgent 借鉴：**单例事件循环**，所有事件（普通 + subagent）走同一条管线

2. **多 session 隔离是 P0 需求**
   - 坑：SubAgentCard 没带 `parent_session_id`，结果 A session 看到 B session 的 subagent
   - 修复：每个事件**必带** `parent_session_id`，前端按 session 过滤
   - TAgent 借鉴：双模式本来就多 session，subagent 事件**强制带 session_id**

3. **生命周期事件必须显式**
   - 坑：只 emit 中间事件（tool 调用、progress），UI 永远不知道 subagent 何时完成
   - 修复：加 `subagent_start` + `subagent_done` 两个边界事件
   - TAgent 借鉴：6 个事件类型——start / tool / progress / text / done / log

4. **流式 LLM 输出需要专门通道**
   - 坑：subagent 跑时 UI 长时间黑屏（等所有 token 一起返回）
   - 修复：加 `stream_callback` 参数贯穿整个 pipeline
   - TAgent 借鉴：从一开始设计就支持 streaming，否则后改痛苦

5. **Import 路径是 silent killer**
   - 坑：用相对路径 `from ... import progress_hook` 与绝对路径 import 行为不一致
   - 修复：统一用 top-level import `from apps.web.server import progress_hook`
   - TAgent 借鉴：提前定**唯一**的 import 路径规范（codemod 跑一次）

6. **Debug 阶段必然有 3-5 个临时 commit**
   - 坑：发现事件丢了 → 加 console.log → 定位 → 改代码 → 删 log → commit
   - 模式：3-4 个 debug commit + 1 个 `chore: revert debug-only commits`
   - TAgent 借鉴：**接受这个**，不要一开始就追求"零临时 commit"

7. **UI v1 几乎必然要 v2 重做**
   - 坑：SubAgentCard v1 是独立卡片（与主消息流风格不一致）→ v2 改 Proma 折叠行风格
   - 修复：接受 v1 是占位、计划 v2 重构
   - TAgent 借鉴：MVP UI 走"能用就行"，P1 阶段按 Proma 风格统一

8. **工具白名单必须显式**
   - 坑：subagent 如果能用 `Agent` / `TaskOutput` / `TaskStop` 工具 → 递归
   - 修复：subagent 的 `allowed_tools` 是 schema 字段（`SubAgentSpec.allowed_tools`）
   - TAgent 借鉴：subagent schema 必含 `forbidden_tools` 字段

**5 类 TA 模式 subagent 候选**（未来实施时）：

| subagent_type | allowed_tools                                                                    | 用途               |
| ------------- | -------------------------------------------------------------------------------- | ------------------ |
| `analyzer`    | `tagent__check_fbx_info`, `tagent__check_texture_info`, `tagent__analyze_assets` | 单个资产深度分析   |
| `renderer`    | `tagent__render_asset_preview`                                                   | 单个资产预览图渲染 |
| `importer`    | `tagent__ue5_import_asset`                                                       | 单个资产导入 UE5   |
| `validator`   | `tagent__check_naming`, `tagent__check_mesh_budget`                              | 单个资产规范检查   |
| `renamer`     | `tagent__suggest_rename`, `tagent__rename_asset`                                 | 单个资产重命名     |

每个都是 read-only 或单一职责，**避免递归和相互依赖**。

### 16.5 不借鉴

- ❌ 群体智能多 agent 框架（AutoGen / CrewAI 范式）—— TAgent 单 agent 路线不需
- ❌ Multi-channel Gateway —— TAgent Desktop + WebSocket 已实现
- ❌ Batch Runner 独立工具 —— 可整合到 subagent 方案中

---

## 19. SOUL 机制 — Agent 人格定义系统

> **状态**：Draft v0.1  
> **日期**：2026-06-15  
> **决策**：2026-06-15 用户确认实施

### 19.1 背景与动机

**问题**：当前 TAgent Agent 的身份定义硬编码在 `agent-prompt-builder.ts` 第 205-207 行：

```typescript
sections.push(`# TAgent Agent

你是 TAgent Agent — 一个集成在 TAgent 桌面应用中的通用AI助手...`)
```

用户无法自定义 Agent 的：

- 性格和语气（严肃/友好/直接/委婉）
- 沟通风格（简洁/详细/技术性/通俗性）
- 应对不确定性的方式

**借鉴**：Hermes-agent 的 `SOUL.md` 机制（详见 `F:\hermes-agent\docker\SOUL.md`）

| 特性     | Hermes SOUL.md                              |
| -------- | ------------------------------------------- |
| 位置     | `~/.hermes/SOUL.md`（全局单文件）           |
| 用途     | 定义 Agent 的性格、语气、沟通风格           |
| 加载时机 | 每次 session 启动时，作为系统 prompt 第一条 |
| 热更新   | 编辑后下次 session 自动生效，无需重启       |

### 19.2 与现有系统的关系

| 组件                      | 用途                  | 与 SOUL.md 的区别                        |
| ------------------------- | --------------------- | ---------------------------------------- |
| **SOUL.md**               | Agent 身份/人格/风格  | "Agent 是谁，怎么说话"                   |
| **L0_user.md**            | 用户画像              | "用户是谁，有什么偏好"                   |
| **提示词管理**            | Chat 模式的系统提示词 | Chat 专用，可多条；SOUL.md 影响所有模式  |
| **AGENTS.md / CLAUDE.md** | 项目规则/编码规范     | "项目怎么做"；SOUL.md 是"Agent 怎么做人" |

**核心区别**：

- SOUL.md = **Agent 身份**（"你是怎样的助手"）
- L0_user.md = **用户画像**（"用户是谁"）
- 两者互补，不是替代

### 19.3 设计方案

#### 19.3.1 文件位置与优先级

采用**三层优先级**设计，支持未来扩展：

```
优先级 1（最高）：工作区级 SOUL.md
  ~/.tagent/agent-workspaces/{workspace-slug}/workspace-files/SOUL.md

优先级 2（中间）：模式级 SOUL.md
  ~/.tagent/SOUL.md           # 通用模式
  ~/.tagent/ta/SOUL.md        # TA 模式

优先级 3（最低）：内置默认
  硬编码在 agent-prompt-builder.ts
```

**MVP 范围**：只实现优先级 2（模式级），暂不实现工作区级。

#### 19.3.2 加载逻辑

```typescript
// agent-prompt-builder.ts 修改

function loadSoulMd(mode?: 'general' | 'ta'): string | null {
  // 1. 尝试模式级路径
  const modePath =
    mode === 'ta'
      ? path.join(getTAgentDataDir(), 'ta', 'SOUL.md')
      : path.join(getTAgentDataDir(), 'SOUL.md')

  if (fs.existsSync(modePath)) {
    const content = fs.readFileSync(modePath, 'utf-8').trim()
    if (content && !containsInjectionPattern(content)) {
      return content
    }
  }

  // 2. Fallback：内置默认
  return null // 调用方使用硬编码默认
}

export function buildSystemPrompt(ctx: SystemPromptContext): string {
  const sections: string[] = []

  // 替换原硬编码身份定义
  const soul = loadSoulMd(ctx.mode)
  if (soul) {
    sections.push(soul)
  } else {
    sections.push(DEFAULT_SOUL_MD) // 内置默认
  }

  // ... 后续 sections 不变
}
```

#### 19.3.3 默认 SOUL.md 内容

```markdown
# TAgent Agent

你是 TAgent Agent — 一个集成在 TAgent 桌面应用中的通用AI助手，由 Claude Agent SDK 驱动。你有极强的自主性和主观能动性，可以完成任何任务，尽最大努力帮助用户。

## 风格

- 使用中文回复和思考，保留必要的英文技术术语
- 简洁直接，避免冗余
- 发现问题直接指出，不要粉饰

## 避免

- 过度客套和废话
- 模棱两可的建议
- 炒作性语言
```

### 19.4 预设模板

提供 4-5 个快捷模板，用户可一键应用：

| 模板名         | 风格描述                         |
| -------------- | -------------------------------- |
| **务实工程师** | 直接、精准、不绕弯子             |
| **研究伙伴**   | 探索性、区分推测与证据           |
| **耐心老师**   | 解释清晰、用例子、不假设先验知识 |
| **严格评审**   | 直接指出问题、正确性优先         |
| **自定义**     | 用户完全自己写                   |

模板内容见实现时定义。

### 19.5 UI 设计

#### 19.5.1 入口位置

**设置面板新增独立 Tab**："人格设置"（放在"提示词管理"之后）

```typescript
// SettingsPanel.tsx
const SOUL_TAB: TabItem = {
  id: "soul",
  label: "人格设置",
  icon: <Sparkles size={16} />,
};
```

#### 19.5.2 界面布局

```
┌─────────────────────────────────────────────────────────────────┐
│ 人格设置                                                        │
│ 自定义 TAgent Agent 的性格、语气和沟通风格                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 什么是人格设置？                                             │ │
│ │ SOUL.md 定义了 Agent 的身份和风格...                        │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 人格定义                                           [重置]   │ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ [Textarea: 编辑 SOUL.md 内容]                           │ │ │
│ │ │                                                         │ │ │
│ │ │ 字数: 156 / 2000                                       │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ │                                             [保存]          │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 预设模板                                                    │ │
│ │ [务实工程师] [研究伙伴] [耐心老师] [严格评审]               │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 19.5.3 交互设计

| 操作         | 行为                                        |
| ------------ | ------------------------------------------- |
| **编辑**     | Textarea 实时编辑，显示字数统计             |
| **保存**     | 写入 `~/.tagent/SOUL.md`（或 `ta/SOUL.md`） |
| **重置**     | 恢复为内置默认内容                          |
| **应用模板** | 一键填充对应模板内容                        |
| **生效时机** | 保存后，下次新建会话生效（当前会话不变）    |

### 19.6 安全考虑

| 风险             | 缓解措施                                        |
| ---------------- | ----------------------------------------------- |
| Prompt injection | 扫描 `{{ }}`、`${ }`、`<%` 等模板模式，拒绝执行 |
| 文件过长截断     | 限制最大 2000 字符，超出时 UI 警告              |
| 编码问题         | 强制 UTF-8，读取时指定编码                      |

### 19.7 实现步骤

| #        | 任务                                    | 位置                      | 工时      |
| -------- | --------------------------------------- | ------------------------- | --------- |
| 1        | 添加 `getSoulPath()` 路径函数           | `config-paths.ts`         | 0.5h      |
| 2        | 修改 `buildSystemPrompt()` 加载 SOUL.md | `agent-prompt-builder.ts` | 1h        |
| 3        | 首次运行自动生成默认 SOUL.md            | `agent-prompt-builder.ts` | 0.5h      |
| 4        | 新增 IPC 接口（读写 SOUL.md）           | `ipc.ts` + preload        | 1h        |
| 5        | 新增 `SoulSettings.tsx` 组件            | 新文件                    | 2h        |
| 6        | 集成到设置面板 Tab                      | `SettingsPanel.tsx`       | 0.5h      |
| 7        | 单元测试                                | 新测试文件                | 1h        |
| **总计** |                                         |                           | **~1 天** |

### 19.8 未来扩展（不进 MVP）

| 扩展项           | 描述                           | 触发条件               |
| ---------------- | ------------------------------ | ---------------------- |
| 工作区级 SOUL.md | 每个工作区可独立定义人格       | 用户反馈需要项目级人格 |
| 模式分立 UI      | 设置页切换通用/TA 模式分别编辑 | TA 模式需要独立人格    |
| 人格预览         | 保存前预览效果（模拟对话）     | 用户反馈需要试看效果   |
| 人格分享         | 导出/导入 SOUL.md              | 社区需求               |

### 19.9 决策记录

| #   | 决策     | 选择                     | 拍板日期   |
| --- | -------- | ------------------------ | ---------- |
| 1   | MVP 范围 | 只做模式级，不做工作区级 | 2026-06-15 |
| 2   | UI 位置  | 设置面板独立 Tab         | 2026-06-15 |
| 3   | 预设模板 | 4-5 个快捷模板           | 2026-06-15 |
| 4   | 生效时机 | 下次新建会话生效         | 2026-06-15 |

### 19.10 usage_log.jsonl 格式（ta_agent 已经在写）

ta_agent 实际已经在 `~/.ta_agent/` 写 `usage_log.jsonl`：

```json
{
  "ts": "2026-05-28T15:03:38",
  "session": "f56af0a93e8a",
  "model": "glm-5",
  "input_tokens": 0,
  "output_tokens": 2094,
  "duration_ms": 16714,
  "success": true
}
```

**TAgent 应保持格式一致**（向后兼容 ta_agent 用户数据迁移）。§5 之后**没提**这个细节。
