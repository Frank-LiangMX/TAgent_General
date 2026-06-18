# Context Usage 分项面板设计（SDK `getContextUsage` 接入）

> **状态**：Draft v0.2（入口位置已确认）  
> **日期**：2026-06-13（2026-06-18 更新底栏入口）  
> **分支建议**：`feature/context-usage-breakdown`  
> **关联设计**：[`2026-06-05-tagent-fusion-design.md`](2026-06-05-tagent-fusion-design.md) §8.4 Context 管理、[`2026-06-09-agent-ui-optimization-plan.md`](2026-06-09-agent-ui-optimization-plan.md)  
> **路径**：`docs/plans/2026-06-13-context-usage-breakdown-design.md`

---

## 0. 新 Agent 接手必读（Handoff）

**你要做什么**：把 Claude Agent SDK 的 `Query.getContextUsage()` 接到 TAgent Desktop，在 Agent 会话中展示与 Claude Code `/context` 同源的分项 Context 占用（System prompt、Tools、MCP、Skills、Conversation 等），替代当前仅显示汇总 token 的 `ContextUsageBadge` Popover。

**不要做什么**：

- 不要客户端自行估算分项 token（除非 `getContextUsage()` 失败时的降级）。
- 不要改 Memory 五层 schema、Agent SDK 行为或 TA 工具 contract。
- 不要把 Ask 档位（`ask.jsonl`）的 token 混入 SDK context breakdown（数据源不同）。
- 不要未经用户确认删除现有圆环 + 汇总用量展示（先做增强，后做 UI 收敛）。

**读完本文后按章节 9 的 PR 顺序实施**；每 PR 需 `bun run typecheck` + `bun test`，UI 改动附截图。

---

## 1. 背景与问题

### 1.1 现状

| 能力         | 实现                                      | 局限                             |
| ------------ | ----------------------------------------- | -------------------------------- |
| 圆环占用比   | `ContextUsageBadge`                       | 仅 `inputTokens / contextWindow` |
| Popover 明细 | 输入 / 输出 / 缓存 / 总量                 | 无分项                           |
| 数据来源     | `assistant.message.usage`、`result.usage` | 流式消息里的**汇总**用量         |
| 会话累计     | `TokenStatsPanel`                         | 多轮累计，非当前 context 构成    |

主进程 `claude-agent-adapter.ts` 已保存活跃 `Query`（`activeQueries`），但**未调用** `getContextUsage()`。

### 1.2 SDK 已提供的能力

`@anthropic-ai/claude-agent-sdk@0.3.153`（项目当前版本）在 `Query` 上暴露：

```typescript
getContextUsage(): Promise<SDKControlGetContextUsageResponse>
```

与 CLI `/context` 同源（control request `get_context_usage`）。响应包含：

- `categories[]` — 分项名称、token、颜色（可直接驱动分段条）
- `totalTokens` / `maxTokens` / `percentage` / `model`
- `gridRows` — 格子可视化数据
- `systemPromptSections` / `systemTools` / `mcpTools` / `skills` / `agents` / `memoryFiles`
- `messageBreakdown` — 对话、tool call/result、附件等
- `isAutoCompactEnabled` / `autoCompactThreshold`
- `apiUsage` — 与现有汇总字段对齐

**结论**：截图级「Context Usage」面板在数据层**已具备官方来源**；缺的是 TAgent 侧的 IPC + UI 接入。

### 1.3 目标用户价值

1. 用户能看清 context 被谁吃掉（MCP 过大？历史对话？System prompt？）。
2. 接近压缩阈值时有据可依地决定：compact / 关 MCP / 新开会话。
3. 与 Claude Code 体验对齐，降低从 CLI 迁到 TAgent 的认知差。

### 1.4 非目标（本阶段）

- 不提供跨会话 context 报表（见 `usage-stats-service`，另一条产品线）。
- 不实现 CLI 的「View Report」外链（除非后续单独接 `get_session_cost` 等 control API）。
- 不为 Chat 遗留模式做分项（P3 已退役 Chat 主路径）。
- 不保证非 Anthropic 兼容端点返回完整 breakdown（见 §7 风险）。

---

## 2. 已确认 / 待确认产品决策

| #   | 决策                                                                                               | 状态     |
| --- | -------------------------------------------------------------------------------------------------- | -------- |
| D1  | 分项数据**以 SDK `getContextUsage()` 为唯一事实源**；失败时降级为现有汇总 Popover                  | 建议采纳 |
| D2  | 入口位于会话**底栏 token 统计行左侧**（`TokenStatsPanel`）；点击 Context 行打开分项面板（Popover 向上展开） | **已确认** |
| D3  | 面板标题与截图对齐：**「Context Usage」** + 占用百分比 + `totalTokens / maxTokens`                 | 待评审   |
| D4  | 主视图展示 `categories` 分段条 + 列表；**二级明细**（MCP 逐工具、memory 逐文件）默认折叠，可展开   | 建议采纳 |
| D5  | 保留圆环预警色（70% 黄 / 90% 红，见 fusion §8.4 P2-2）与手动压缩按钮                               | 建议采纳 |
| D6  | **Ask 档位**无活跃 SDK Query 时：底栏圆环仍可按 Provider usage 显示；分项面板显示「仅 Agent 档位可用」 | **已确认** |
| D7  | 刷新策略：**打开面板时拉取** + 每轮 `complete` 事件后后台刷新缓存（防抖 500ms）                    | 建议采纳 |

---

## 3. 架构总览

```
用户点击底栏 Context 行（TokenStatsPanel 左侧）
        │
        ▼
renderer: contextUsageAtom / fetchContextUsage(sessionId)
        │
        ▼ IPC  agent:get-context-usage
        │
main: agent-orchestrator 或 adapter 门面
        │
        ▼ activeQueries.get(sessionId)?.getContextUsage()
        │
Claude Agent SDK (CLI 子进程)
        │
        ▼ SDKControlGetContextUsageResponse
        │
renderer: ContextUsagePanel 渲染 categories + 明细
```

**与现有流的关系**：

- 圆环**继续**用 `usage_update` / `complete` 的汇总 token（低延迟）。
- 分项面板**按需**调 `getContextUsage()`（准确但多一次 control round-trip）。

---

## 4. 数据模型（`packages/shared`）

### 4.1 新建类型文件

建议：`packages/shared/src/types/context-usage.ts`（从 SDK 响应映射，避免 renderer 直接依赖 SDK 类型）。

```typescript
/** Context 分项（与 SDK categories 对齐） */
export interface ContextUsageCategory {
  name: string
  tokens: number
  color: string
  isDeferred?: boolean
}

/** Context Usage 完整快照（SDK getContextUsage 映射） */
export interface ContextUsageSnapshot {
  categories: ContextUsageCategory[]
  totalTokens: number
  maxTokens: number
  rawMaxTokens: number
  percentage: number
  model: string
  isAutoCompactEnabled: boolean
  autoCompactThreshold?: number
  memoryFiles: Array<{ path: string; type: string; tokens: number }>
  mcpTools: Array<{ name: string; serverName: string; tokens: number; isLoaded?: boolean }>
  systemTools?: Array<{ name: string; tokens: number }>
  systemPromptSections?: Array<{ name: string; tokens: number }>
  agents: Array<{ agentType: string; source: string; tokens: number }>
  skills?: {
    totalSkills: number
    includedSkills: number
    tokens: number
    skillFrontmatter: Array<{ name: string; source: string; tokens: number }>
  }
  messageBreakdown?: {
    toolCallTokens: number
    toolResultTokens: number
    attachmentTokens: number
    assistantMessageTokens: number
    userMessageTokens: number
    toolCallsByType: Array<{ name: string; callTokens: number; resultTokens: number }>
  }
  apiUsage: {
    inputTokens: number
    outputTokens: number
    cacheReadTokens: number
    cacheCreationTokens: number
  } | null
  /** 拉取时间戳（客户端填入） */
  fetchedAt: number
}

export interface GetContextUsageInput {
  sessionId: string
}

export interface GetContextUsageResult {
  ok: true
  snapshot: ContextUsageSnapshot
}

export interface GetContextUsageError {
  ok: false
  code: 'NO_ACTIVE_QUERY' | 'SDK_ERROR' | 'SESSION_NOT_FOUND' | 'UNSUPPORTED'
  message: string
}

export type GetContextUsageResponse = GetContextUsageResult | GetContextUsageError
```

### 4.2 IPC 通道

在 `AGENT_IPC_CHANNELS` 追加：

```typescript
/** 获取当前会话 Context 分项占用（SDK getContextUsage） */
GET_CONTEXT_USAGE: 'agent:get-context-usage',
```

遵循现有四件套：`packages/shared` 类型 → `main/ipc.ts` → `preload/index.ts` → `window.electronAPI`。

### 4.3 映射函数

主进程：`mapSdkContextUsageResponse(sdk: SDKControlGetContextUsageResponse): ContextUsageSnapshot`

- 字段 1:1 拷贝，snake_case → camelCase 仅在 `apiUsage`。
- 单元测试覆盖：空 categories、deferred tools、`messageBreakdown` 缺失。

---

## 5. 主进程实现

### 5.1 Adapter 层

文件：`apps/electron/src/main/lib/adapters/claude-agent-adapter.ts`

```typescript
async getContextUsage(sessionId: string): Promise<SDKControlGetContextUsageResponse> {
  const query = activeQueries.get(sessionId)
  if (!query) throw new ContextUsageError('NO_ACTIVE_QUERY', '...')
  return query.getContextUsage()
}
```

**注意**：

- `result` 后若 channel 仍 open（`CONTINUABLE_TERMINAL_REASONS`），Query 仍在，`getContextUsage()` 应可用。
- 会话从未发过消息 / Query 已销毁 → `NO_ACTIVE_QUERY`。

### 5.2 Orchestrator 门面

`agent-orchestrator.ts` 暴露 `getContextUsage(sessionId)`，供 IPC 调用；内部委托 adapter。

可选：内存缓存 `Map<sessionId, { snapshot, expiresAt }>`，TTL 与 D7 防抖一致，避免 Popover hover 频繁打 SDK。

### 5.3 与 `inferContextWindow` 的关系

- 分项面板以 `snapshot.maxTokens` 为准。
- 圆环在 `contextWindow` 缺失时仍可用 `inferContextWindow(model)` fallback（现有逻辑保留）。
- 长期：Issue A（upstream plan）统一窗口推断后，圆环与面板共用 `maxTokens`。

---

## 6. 渲染进程实现

### 6.1 状态（Jotai）

文件建议：`apps/electron/src/renderer/atoms/context-usage-atoms.ts`

```typescript
/** 按 sessionId 缓存最近一次分项快照 */
export const contextUsageBySessionAtom = atom<Map<string, ContextUsageSnapshot>>(new Map())

/** 当前会话分项加载状态 */
export const contextUsageLoadingAtom = atom<boolean>(false)
```

`useContextUsage(sessionId)` hook：

1. 打开面板 → `GET_CONTEXT_USAGE` IPC。
2. 错误码 `NO_ACTIVE_QUERY` → 展示降级 UI（见 §6.3）。
3. `complete` 事件监听（`useGlobalAgentListeners`）→ 防抖刷新缓存。

### 6.2 UI 组件

| 组件                          | 职责                                                      |
| ----------------------------- | --------------------------------------------------------- |
| `TokenStatsPanel.tsx`         | **底栏容器**：左侧 Context 占用 + 右侧累计 token 统计     |
| `ContextUsageBadge.tsx`       | `variant="inline"` 底栏内联圆环；点击打开分项 / 汇总面板  |
| `ContextUsagePanel.tsx`       | **新建**：分段条 + 分类列表 + 可折叠明细                  |
| `ContextUsageSegmentBar.tsx`  | **新建**：按 `categories[].color` 渲染水平条              |
| `ContextUsageCategoryRow.tsx` | **新建**：色块 + 标签 + token 数                          |

**入口位置（已落地 v0.2）**：

- 从输入框工具栏移除 `context-usage` 项。
- Context 标识与累计 token 统计合并为同一条底栏：`TokenStatsPanel`。
- 左侧：`Context` + 圆环 + `60.1k/200k (30%)`；右侧：输入 / 输出 / 缓存 / 费用 / 轮数。

**UI 规范**（对齐 `CLAUDE.md` §UI 风格）：

- 底栏 Context 触发器为**内联可点击行**（非 36px 工具栏圆钮）。
- Popover：`side="top"`、`align="start"`，`min-w-[280px] max-w-[360px]`。
- 分项行：`text-xs`，描述 `text-[10px] text-muted-foreground`。
- 颜色：优先用 SDK 返回的 `category.color`（CSS 变量或 inline），不硬编码主题色表。
- 分类名：SDK 为英文；UI 层提供 `CONTEXT_USAGE_LABELS: Record<string, string>` 可选中文映射，未映射则显示原文。

**面板结构（建议）**：

```
┌ Context Usage ──────────────── 30% Full ┐
│ [=========分段条=========···············] │
│ ~60.1K / 200K Tokens                      │
├───────────────────────────────────────────┤
│ ■ System prompt              503          │
│ ■ Tool definitions          9.0K          │
│ ■ Rules                     6.1K          │
│ ...                                       │
├───────────────────────────────────────────┤
│ ▸ MCP tools (12)                          │
│ ▸ Memory files (3)                        │
├───────────────────────────────────────────┤
│ [手动压缩]  [客户端压缩]                    │
└───────────────────────────────────────────┘
```

### 6.3 降级策略

| 条件              | UI 行为                                                                  |
| ----------------- | ------------------------------------------------------------------------ |
| `NO_ACTIVE_QUERY` | 显示汇总行（现有 Popover 内容）+ 提示「发送一条 Agent 消息后可查看分项」 |
| `SDK_ERROR`       | Toast + 汇总降级                                                         |
| `UNSUPPORTED`     | 第三方端点可能无 breakdown；仅圆环                                       |
| Ask 档位          | 同 `NO_ACTIVE_QUERY` 或隐藏分项入口（依 D6）                             |

---

## 7. 风险与边界

| 风险                 | 影响                        | 缓解                                                                                   |
| -------------------- | --------------------------- | -------------------------------------------------------------------------------------- |
| 无活跃 Query         | 面板无数据                  | 降级 + 文案说明                                                                        |
| 兼容端点非官方 CLI   | `getContextUsage` 可能失败  | `UNSUPPORTED` + 保留汇总圆环                                                           |
| Control 调用延迟     | 打开面板 100–500ms          | Loading skeleton；缓存上次快照                                                         |
| SDK 版本漂移         | 字段增减                    | shared 类型 `?` 可选 + 映射层单测                                                      |
| 分项与圆环总数不一致 | 用户困惑                    | 面板注明「分项为 SDK 估算，圆环为 API usage」；以 `totalTokens/maxTokens` 为面板主数字 |
| 模式隔离             | TA / general 共用 Agent SDK | 按 `sessionId` 隔离即可，无额外分支                                                    |

---

## 8. 与现有模块关系

| 模块                      | 关系                                          |
| ------------------------- | --------------------------------------------- |
| `ContextUsageBadge`       | **扩展**，非替换                              |
| `TokenStatsPanel`         | 不变（累计统计）                              |
| `agent-context-utils.ts`  | 不变；动态历史条数预算仍用汇总逻辑            |
| `useGlobalAgentListeners` | 增加 `complete` 后触发 context usage 缓存刷新 |
| `claude-agent-adapter`    | 新增 `getContextUsage` 封装                   |
| Ask 档位                  | 不写入 SDK JSONL；分项仅 Agent 档位           |
| Insights 设置页           | 无交集                                        |

---

## 9. 实施分期（PR 顺序）

### P0 — 数据管线（1～1.5 天）

| 任务                      | 文件                                                                 |
| ------------------------- | -------------------------------------------------------------------- |
| shared 类型 + IPC 常量    | `packages/shared/src/types/context-usage.ts`、`agent.ts`             |
| SDK 映射 + adapter 方法   | `claude-agent-adapter.ts`                                            |
| IPC handler               | `main/ipc.ts`                                                        |
| Preload 桥接              | `preload/index.ts`                                                   |
| 单测：映射、无 Query 错误 | `claude-agent-adapter.test.ts` 或新建 `context-usage-mapper.test.ts` |

**验收**：DevTools 可 `window.electronAPI.getContextUsage(sessionId)` 返回 JSON。

### P1 — 分项面板 MVP（1.5～2 天）

| 任务                     | 文件                                                       |
| ------------------------ | ---------------------------------------------------------- |
| Jotai atoms + hook       | `atoms/context-usage-atoms.ts`、`hooks/useContextUsage.ts` |
| 分段条 + 分类列表        | `ContextUsagePanel.tsx` 等                                 |
| 接入底栏 Context 行        | `TokenStatsPanel.tsx`、`ContextUsageBadge.tsx`（`variant="inline"`） |
| `complete` 后防抖刷新    | `useGlobalAgentListeners.ts`                               |

**验收**：Agent 会话发消息后，点击圆环可见与 `/context` 同结构的分项；截图附 PR。

### P2 — 体验打磨（0.5～1 天）

| 任务                    | 说明                           |
| ----------------------- | ------------------------------ |
| 二级明细折叠            | MCP / memory / skills / agents |
| 中文标签映射            | `context-usage-labels.ts`      |
| `messageBreakdown` 展示 | Conversation 子项              |
| Auto-compact 状态行     | `isAutoCompactEnabled`         |
| 加载 / 错误 / 空态      | Skeleton、降级文案             |

### P3 — 可选增强（后续）

- 「View Report」→ 接 `get_session_cost` 或导出 Markdown。
- 设置页 Insights 增加「会话 context 峰值」统计（需持久化 snapshot）。
- 分项接近阈值时与 P2-1 Nudges 联动（例如 MCP > 30% 提示关服务器）。

---

## 10. BDD 场景（测试用例来源）

```gherkin
Feature: Context Usage 分项面板

  Scenario: Agent 会话活跃时可查看分项
    Given 用户处于 Agent 档位
    And 当前会话已至少完成一轮 SDK 查询
    When 用户打开 Context Usage 面板
    Then 应调用 agent:get-context-usage
    And 面板应展示 categories 列表与占用百分比
    And 分段条颜色应与 categories 一致

  Scenario: 无活跃 Query 时降级
    Given 用户刚新建会话且尚未发送消息
    When 用户打开 Context Usage 面板
    Then 应显示汇总 token 信息
    And 应提示需要 Agent 消息后才能查看分项

  Scenario: 一轮对话结束后缓存刷新
    Given Context Usage 面板曾打开过
    When 当前轮次收到 complete 事件
    Then 应在 500ms 防抖后更新分项缓存

  Scenario: 手动压缩入口保留
    Given Context Usage 面板已打开
    When 用户点击「手动压缩」
    Then 应触发既有 compact 流程
    And 面板应关闭或进入 compacting 状态
```

**单元测试重点**（PR 必含，覆盖率门槛见 `AGENTS.md` §3.3）：

- `mapSdkContextUsageResponse` — 完整字段、缺省字段、空数组。
- `getContextUsage` — 无 `activeQueries` 时错误码。
- `ContextUsageSegmentBar` — 0 token、单分类、多分类宽度比例（可选 RTL 快照）。

---

## 11. 工时估算

| 阶段                 | 人天       |
| -------------------- | ---------- |
| P0 数据管线          | 1～1.5     |
| P1 MVP UI            | 1.5～2     |
| P2 打磨              | 0.5～1     |
| **合计（至可发布）** | **3～4.5** |
| P3 可选              | +1～2      |

---

## 12. 实施检查表（复制到 PR Description）

- [ ] `packages/shared` 类型与 IPC 常量已添加
- [ ] 主进程 / Preload / 渲染进程四件套已同步
- [ ] `getContextUsage` 失败有降级，不吞错（logger 中文）
- [ ] 未使用 `any`；`import type` 优先
- [ ] `bun run typecheck` 0 error
- [ ] `bun test` 通过，核心映射逻辑有单测
- [ ] UI 截图：分项面板 + 降级态
- [ ] 未改动 Memory schema / TA 工具 registry
- [ ] 品牌字符串仍为 **TAgent**

---

## 13. 参考资料

- SDK 类型：`node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts` — `getContextUsage`、`SDKControlGetContextUsageResponse`
- 现有 UI：`apps/electron/src/renderer/components/agent/ContextUsageBadge.tsx`
- Adapter Query 缓存：`apps/electron/src/main/lib/adapters/claude-agent-adapter.ts` — `activeQueries`
- Claude Code 文档：[Explore the context window](https://code.claude.com/docs/en/context-window)
- Python SDK 对齐 PR：[anthropics/claude-agent-sdk-python#764](https://github.com/anthropics/claude-agent-sdk-python/pull/764)（`get_context_usage` 说明）

---

## 14. 评审后待更新

- [x] D2：入口位于底栏 token 行（`TokenStatsPanel` 左侧），非输入工具栏
- [x] D6：Ask 档位下底栏仍显示圆环，分项面板降级提示
- [ ] SDK `getContextUsage` 分项面板（P0–P2）实现与验收
