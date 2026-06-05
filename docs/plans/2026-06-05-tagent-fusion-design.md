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

| # | 决策点 | 选择 |
|---|---|---|
| 1 | 顶层 Tab 切换 | **通用 / TA** 两 Tab；进"通用"后还是 Proma 现有 chat/agent/scratch |
| 2 | 模式互斥 | **严格互斥 + 后台跑完提示**（无并发 bug，长任务切走仍跑完，红点提示） |
| 3 | Provider 共享度 | **Provider/Channel/API Key 全局共享**，MCP/Skill 模式独立 |
| 4 | Python 进程生命周期 | **进 TA 启，退 TA 后台保留，App 退出杀** |
| 5 | Python 打包 | **ta_agent PyInstaller 后嵌进 Proma 安装包** |
| 6 | TA UI 优先级 | **资产库先**（直读 SQLite，列表/详情/搜索） |
| 7 | 跨模式切换 | **switch_mode 伪工具**：TA 模式 LLM 建议切到通用，反之亦然 |
| 8 | 品牌 | **TAgent**（替换所有 Proma 字样） |
| 9 | 前端 | **Proma 现有 React + 设计系统**（改底层逻辑） |
| 10 | 旧数据 | **不迁移** |
| 11 | 记忆结构 | **5 层 + 借鉴 hermes-agent / GenericAgent**（详见 §6） |
| 12 | OpenAI 协议 | **MVP 用现有 12 Provider**，TA 模式走 Anthropic 兼容层 |
| 13 | Token / 缓存 | **已有 input/output/cache 字段**，新增 cacheHitRate 派生 atom |
| 14 | 模式间 L0 共享 | **默认不共享**，可手动开启"share user profile"开关 |

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
  description: '建议将当前对话切换到另一个模式继续。target_mode: "general" 用于代码/写工具/办公；"ta" 用于游戏资产/TA 工作流。',
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

| 错误类型 | 来源 | 处理 |
|---|---|---|
| ta_agent MCP 进程崩溃 | Python 崩溃 / OOM | MCPManager 检测 stdio EOF → 自动重启一次 → 第二次失败弹"重试 / 切到通用模式" |
| MCP 工具调用超时 | Blender 渲染 / UE5 卡死 | 单工具 5 分钟硬超时，cancel tool_call，isError=true |
| SQLite 锁冲突 | ta_agent 写 + Proma 读 | Proma readonly pragma，ta_agent 队列化；冲突时 Proma 重试 1 次 |
| 模式切换时任务未完成 | 切到通用但 TA 有任务 | 任务保留在后台跑，完成后用 PushNotification 通知 |
| OpenAI provider 缓存字段缺失 | 某些端点不发 cache | `cacheReadTokens = null` → cacheHitRateAtom 返回 null，不显示不报错 |
| switch_mode 用户取消 | 用户点取消 | 工具返回 `{cancelled:true}`，LLM 据此调整 |

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

| 维度 | TAgent 现状 | 融合后 | 主要借鉴 | 改动量 |
|---|---|---|---|---|
| 层数 | 3 层 (L0/L1/L2) | **5 层 (L0-L4 + L5 insights)** | GenericAgent L4 + hermes L0 | 新增 L0/L4/L5 |
| Provider 抽象 | 5 个方法 Protocol | **13 个 hook（7 核心 + 6 可选）** | hermes | 扩展 `provider.py` |
| 激活方式 | 显式工具调用 | **显式 + Periodic Nudges** | hermes | 新增 `nudges.py` |
| 检索 | feature dict 子串匹配 | **FTS5 全文 + 语义** | hermes | 新增 FTS5 |
| 跨 session | ❌ 无 | **✅ L4_sessions.fts5** | hermes + GA | 新增 L4 |
| 用户建模 | ❌ 无 | **✅ L0_user.md（Honcho 思路）** | hermes | 新增 L0 |
| 事实 vs 洞察 | 单一 facts | **L2 raw facts + L5 insights** | GenericAgent | 新增 L5 |
| 反思 | ❌ 无 | **✅ reflect/ 周期 LLM 自我 review** | GenericAgent | 新增 `reflect.py` |
| 自动维护 | ❌ 手动 | **✅ scheduled_tasks.json** | GenericAgent | 新增 `scheduled_cleanup.py` |
| 流式隔离 | 无 | **✅ StreamingContextScrubber** | hermes | 新增 scrubber |
| Skill 标准 | 自定义 | **agentskills.io 兼容** | hermes | 改 skill 格式 |
| 多 provider | 仅 builtin | **可挂 honcho/mem0/hindsight** | hermes | 预留接口 |
| Session 切换 | 重建 | **on_session_switch 钩子** | hermes | 新增钩子 |

### 6.3 模式隔离下的 memory

```
%APPDATA%\TAgent\
├── general\memory\        ← 通用模式独立
└── ta\memory\             ← TA 模式独立
```

两套完全独立。**可选开关**："share user profile" 让 L0_user.md 双向同步（其他层不共享）。

### 6.4 代码改动定位

**ta_agent 端**（`F:\ta_agent\packages\tools\memory\`）：

| 新增/修改 | 路径 | 行数 |
|---|---|---|
| 新增 | `L0_user.py` | ~120 |
| 新增 | `L4_session_log.py` | ~200 |
| 新增 | `L5_insight.py` | ~80 |
| 新增 | `fts5_index.py` | ~150 |
| 新增 | `nudges.py` | ~100 |
| 新增 | `reflect.py` | ~120 |
| 新增 | `scheduled_cleanup.py` | ~100 |
| 扩展 | `provider.py`（5→13 个方法） | +60 |
| 扩展 | `file_provider.py`（接 L0/L4/L5） | +200 |
| 扩展 | `memory_tools.py` | +80 |

**Proma 端**：

| 新增 | 路径 | 作用 |
|---|---|---|
| `apps/electron/src/main/lib/memory/streaming-scrubber.ts` | 借鉴 hermes | 过滤 `<memory-context>` 块 |
| `apps/electron/src/renderer/components/memory/MemoryMonitor.tsx` | 借鉴 hermes | 可视化 memory 状态 |

---

## 7. OpenAI 协议 + Token / 缓存

### 7.1 OpenAI 覆盖度

| 层级 | 现状 | TAgent |
|---|---|---|
| Chat（裸对话） | ✅ Proma 12 Provider 含 OpenAI、Zhipu、Doubao、Qwen、custom | 保留，零改造 |
| Agent（自主循环） | ⚠️ Claude Agent SDK 走 Anthropic 协议，但通过 `ANTHROPIC_BASE_URL` 指向 OpenAI 兼容端点**已跑通** | 通用 / TA 模式都能选 OpenAI provider；TAgent 54 工具通过 MCP 注入 |
| 真·OpenAI Agent SDK | ❌ 当前没接 `@openai/codex-sdk` | **不进 MVP**；要做需 1-2 周独立工作 |

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

| 资源 | 通用模式 | TA 模式 | 共享 |
|---|---|---|---|
| System Prompt | 通用 | TAgent | ❌ |
| 工具集 | Claude SDK 内置 + 通用 MCP | TAgent 54 工具 + 通用 MCP（部分） | 部分 MCP 共享 |
| 记忆 5 层 | general\memory\ | ta\memory\ | ❌（L0 可选共享） |
| 会话 | general\sessions\ | ta\sessions\ | ❌ |
| Skill 列表 | general\skills\ | ta\skills\ | ❌ |
| Channel 配置 | 全局 | 全局 | ✅ |
| API Key | 全局 | 全局 | ✅ |
| Provider 选择 | lastSelected | lastSelected | ✅（各自记忆） |
| MCP server 配置 | 启用列表 A | 启用列表 B | ❌（各自启用列表） |

### 8.3 跨模式切换的限制

- ❌ 切模式瞬间强制取消"思考中的 tool call"（但结果已写进 history）
- ⚠️ 切模式时如果原模式有"长任务在后台跑"——冲突时弹"等 / 切 / 杀"
- ✅ 切走时如果原模式 MCP server 还没启动完——等到启动完才能切
- ✅ 同一时刻只有一个 mode 拥有 UI focus

---

## 9. 品牌替换（Proma → TAgent）

### 9.1 替换范围（基于 Proma 现状 ~435 .ts/.tsx 文件）

| 类别 | 范围 | 工作量 |
|---|---|---|
| npm scope | `@proma/*` → `@tagent/*`（5 个包） | codemod 跑一遍 |
| 类型前缀 | `PromaPermissionMode` → `TAgentPermissionMode` 等 | codemod 跑一遍 |
| 路径常量 | `~/.proma/` → `~/.tagent/` | 全局替换 |
| 环境变量 | `PROMA_*` → `TAGENT_*` | 全局替换 |
| 用户可见字符串 | "Proma" → "TAgent"（设置面板、about 对话框、托盘菜单） | 手动 + codemod |
| electron-builder | `appId`、`productName` | 手动 |
| 文档 | AGENTS.md、CLAUDE.md、README | 手动 |

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

| 阶段 | 内容 | 估时 |
|---|---|---|
| **P0 品牌替换** | `@proma/*` → `@tagent/*` 等 codemod | 3-5 天 |
| **P0 ta_agent 加 MCP server mode** | mcp_server.py（~300 行）+ TAgent.spec 改 | 1 周 |
| **P0 Python 嵌进 Proma 打包** | PyInstaller + electron-builder extraResources | 3 天 |
| **P0 Proma 端 MCP 配置** | MCPManager 接 TAgent MCP server | 2 天 |
| **P0 验证 54 工具可调通** | 集成测试 | 3 天 |
| **P1 ModeManager + 顶层 Tab** | Jotai atoms + UI 切换 | 1 周 |
| **P1 模式互斥 + 后台跑完** | ModeManager 锁 + PushNotification | 1 周 |
| **P1 switch_mode 工具** | 两个 runner 内置 + Modal | 3 天 |
| **P2 资产库 SQLite 直读 + UI** | better-sqlite3 + 列表/详情/搜索 | 2-3 周 |
| **P2 记忆 5 层 + FTS5** | ta_agent memory/ 扩展 | 2-3 周 |
| **P2 StreamingContextScrubber** | Proma + ta_agent | 3 天 |
| **P2 审核队列 / 流水线 / 项目配置 UI** | Proma 设计系统重写 | 4-6 周 |
| **P3 Token 统计 / Cache 命中率 UI** | 通用模式特有 | 1 周 |
| **P3 Memory Monitor UI** | 借鉴 hermes | 1 周 |
| **P3 反思 / Nudges / 清理** | hermes + GA 思路 | 2 周 |

**MVP = P0 全部 ≈ 2 周**（ta_agent MCP server 跑通 + Proma 端能调 54 工具 + 模式可切换 + 严格互斥）

### 10.2 MVP 范围外的明确延后

- ❌ 真·OpenAI Agent SDK（`@openai/codex-sdk`）
- ❌ Honcho / Mem0 / Hindsight 外部 memory provider
- ❌ Autonomous skill creation（hermes 思路）
- ❌ Skill self-improve（hermes 思路）
- ❌ 跨模式 L0 共享开关（先默认独立）
- ❌ agentskills.io 兼容（MVP 后再说）

---

## 11. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| ta_agent 54 工具的 schema 翻译到 MCP 协议有偏差 | 工具调用失败 | MVP 阶段跑通 5-10 个核心工具先验证 |
| better-sqlite3 + ta_agent sqlite3 并发写冲突 | 数据损坏 | Proma readonly pragma + ta_agent WAL + 队列化写 |
| 切模式时 task 状态丢失 | 用户体验差 | 后台跑完 + 红点 + PushNotification |
| Codemod 替换不彻底 | 编译失败 | 全量 typecheck + grep 兜底验证 |
| PyInstaller 打包后体积爆炸 | 下载体验差 | UPX 关闭 + 评估 trimesh 等可选模块 |
| TAgent system prompt 注入太长 | token 浪费 | 启动时分块 + 按需召回 |
| TA 模式 54 工具 vs Claude SDK 内置工具的冲突 | 工具名冲突 | 工具命名空间化（`tagent__analyze_assets`） |

---

## 12. 6 个开放问题（已全部拍板）

**2026-06-05 全部拍板**：

1. **TA 模式 54 工具的命名空间化**：✅ **加 `tagent__` 前缀**（如 `tagent__analyze_assets`）。避免与 Claude SDK 内置工具冲突，保留未来扩展空间。
2. **OpenAI provider 的 cache 字段**：✅ **MVP 支持**。Proma 已有实现零成本。OpenAI 下数字恒为 0（不报错不显示），但通用 + TA 模式行为一致。
3. **切模式时 Claude SDK session 续接**：✅ **新建**（§5.3 已定）。原 session 归档，target 模式新 session + summary。
4. **MVP 资产库是否支持写**：✅ **Proma 端只读，写走 ta_agent MCP**。避免并发冲突，Proma 不会有"脏写"。
5. **Pipeline Editor 的 UI 重写工作量**：✅ **MVP 不做**。M2+ 阶段单独做。节省 6 周 UI 工作量。
6. **记忆 5 层的存储格式**：✅ **混合方案**（md + JSONL + SQLite）。L0-L2 + L5 用 Markdown（人可读），L3 corrections 用 JSONL + rules.json（结构化 + 可回滚），L4 sessions 用 SQLite + FTS5（全文搜索）。

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

| # | 工具名 | 作用 | 工作流位置 |
|---|---|---|---|
| 1 | `analyze_assets` | 扫描 + 解析 + 推断 全流程 | **起点** |
| 2 | `run_ai_inference` | 单独跑 AI 推断 | 分析后 |
| 3 | `search_assets` | 语义搜索资产库 | 任意时刻 |
| 4 | `check_naming` | 命名规范检查 | 入库前 |
| 5 | `record_correction` | 记录用户纠正 | 反馈 |
| 6 | `append_profile_fact` | 追加事实到 L2 | 长期记忆 |
| 7 | `memory_read_facts` | 读 L2 facts | 上下文 |
| 8 | `memory_read_sop` | 读 L2 SOP | 上下文 |
| 9 | `discover_conventions` | 扫描项目规范 | 项目接入 |
| 10 | `load_conventions` | 加载规范到上下文 | 项目接入 |
| 11 | `intake_approved` | 一键入库已审核 | 终点 |
| 12 | `ue5_import_asset` | 导入到 UE5 | 终点 |
| 13 | `ue5_configure_asset` ⭐ | 合并原 5 个 setter | UE5 后处理 |
| 14 | `submit_review` | 提交审核 | 中间 |
| 15 | `batch_approve` | 批量通过 | 中间 |
| 16 | `check_fbx_info` | 单文件深度解析 | 排查 |
| 17 | `check_texture_batch` | 贴图批量检查 | 排查 |
| 18 | `check_mesh_budget` | 面数预算 | 排查 |
| 19 | `get_memory_stats` | L0-L5 状态总览 | 调试 |
| 20 | `ue5_get_asset_info` | 读 UE5 资产信息 | 调试 |

### 14.2 UI 直达的工具（45 个）

**MCP server 仍然暴露全部 65 个**（保留向后兼容），但 Proma 端只把上面 20 个注册为 LLM tool；剩下 45 个由 UI 直接调用，**不经过 LLM**。

| UI 类别 | 工具 | UI 形态 |
|---|---|---|
| **资产库** | `list_assets` / `get_asset_detail` / `count_assets` | 资产列表/详情面板 |
| **审核** | `get_pending_reviews` / `get_review_detail` | 审核面板 |
| **文件 / FS** | `workspace_read_file` / `workspace_write_file` / `workspace_list_dir` / `scan_directory` / `check_file_info` | 文件浏览器（沿用 Proma 现有） |
| **目录 / 命名** | `check_directory_structure` / `suggest_naming` / `suggest_rename` / `rename_asset` / `batch_rename` / `move_asset` / `create_directory` | 命名 / 重命名对话框 |
| **资产编辑** | `update_asset` / `update_asset_type` | 资产属性编辑表单 |
| **预览 / 报告** | `render_asset_preview` / `generate_report` | 预览图 + 报告生成按钮 |
| **项目配置** | `check_project_config` / `list_project_configs` / `create_project_config` / `load_project_config` / `add_custom_rule` | 项目设置向导 |
| **UE5 桥接** | `ue5_ping` / `ue5_check_plugin` / `ue5_set_material` / `ue5_set_nanite` / `ue5_set_lod_group` / `ue5_set_metadata` / `ue5_create_collision` | UE5 桥接面板（含"测试连接""配置资产属性"等按钮；后 5 个 setter 在 UI 走 `ue5_configure_asset`） |
| **MCP 管理** | `mcp_list_servers` / `mcp_add_server` / `mcp_remove_server` / `mcp_toggle_server` / `mcp_reload_servers` / `mcp_test_connection` | MCP 管理面板 |
| **环境检查** | `check_blender` | 设置页状态卡片 |

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

| 维度 | 数值 |
|---|---|
| LLM tool schema token | 从 ~3000 → ~1500（节省 50%） |
| LLM 选择准确度 | 提高（少即是多） |
| UI 响应 | 直接调，**0 LLM 延迟** |
| 误操作风险 | UI 按钮 = 用户主动，避免 LLM 误调 |
| UI 工作量 | **+2-3 周**（45 个按钮/面板） |

### 14.5 实施调整

| 阶段 | 调整 |
|---|---|
| P0 `mcp_server.py` | **不变**（仍暴露 65 函数） |
| P0 LLM tool 注册 | **新增** `ta_mode_llm_tools.json`（白名单 20 个） |
| P0 MCP 客户端 | **扩展**：增加 `UiToolExecutor` 类 |
| P1 UI 工具调用基础设施 | 新增 `useUiTool` hook + IPC channel |
| P2 UI 工作量 | **从 4-6 周增到 7-9 周**（多出 45 个 UI 元素） |

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
| Widget | 数据源 | 更新频率 |
|---|---|---|
| 活跃 session 卡片网格 | `agentSessionsAtom`（已有） | 实时订阅 |
| 今日 cost 概览 | `useGlobalAgentListeners.ts:202` 已有 usage | 5s 聚合 |
| 工具调用 timeline | tool call log（需 instrument） | 实时滚动 |
| MCP server 状态 | 进程状态检测 | 10s 轮询 |

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

| subagent_type | allowed_tools | 用途 |
|---|---|---|
| `analyzer` | `tagent__check_fbx_info`, `tagent__check_texture_info`, `tagent__analyze_assets` | 单个资产深度分析 |
| `renderer` | `tagent__render_asset_preview` | 单个资产预览图渲染 |
| `importer` | `tagent__ue5_import_asset` | 单个资产导入 UE5 |
| `validator` | `tagent__check_naming`, `tagent__check_mesh_budget` | 单个资产规范检查 |
| `renamer` | `tagent__suggest_rename`, `tagent__rename_asset` | 单个资产重命名 |

每个都是 read-only 或单一职责，**避免递归和相互依赖**。

### 16.5 不借鉴
- ❌ 群体智能多 agent 框架（AutoGen / CrewAI 范式）—— TAgent 单 agent 路线不需
- ❌ Multi-channel Gateway —— TAgent Desktop + WebSocket 已实现
- ❌ Batch Runner 独立工具 —— 可整合到 subagent 方案中
