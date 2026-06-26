# TAgent 草稿模式重构 + Chat 残留清理

> **状态**：Draft v0.1
> **日期**：2026-06-25
> **目标**：清理 Chat 模式残留死代码；将草稿模式从孤立记事本重构为 AI 辅助的结构化需求草稿系统，打通"需求澄清 → Agent 执行 → 验收"完整链路
> **关联**：[`2026-06-13-ask-mode-unification-design.md`](2026-06-13-ask-mode-unification-design.md)（Chat 退役决策）、[`2026-06-24-upstream-feature-roadmap.md`](2026-06-24-upstream-feature-roadmap.md)
> **上游参考**：Kun SDD 系统（`F:\Kun\src\renderer\src\sdd\`）
> **分支建议**：`feature/draft-restructure`

---

## 0. Handoff 摘要

**你要做什么**：

1. 清理 Chat 模式退役后遗留的所有死代码（~1500+ 行）
2. 将草稿模式从"全局记事本"重构为"AI 辅助的结构化需求草稿"，使其成为 Agent 执行前的需求澄清环节

**核心参考**：

- **Kun SDD 系统**（`F:\Kun`）：需求块 `### R-n: title {status}` + 验收标准 + 5 阶段状态机 + AI 助手面板 + PM 技能框架 + 需求→计划升级 + 可追溯性 + 漂移检测
- **TAgent 当前草稿**（`F:\TAgent_General`）：单文件 `~/.tagent/scratch-pad.md`，TipTap 编辑器，和 Agent 零联动

**不要做的事**：

- 不要照搬 Kun 的全部 PM 框架（TAgent 不是软件开发工具，不需要 PRD/机会树/事前分析全套）
- 不要实现漂移检测和 trace.json（v1 不需要，Agent 执行周期短）
- 不要实现交互式 HTML 原型生成（Kun 的 proto/ 目录，TAgent 场景不同）
- 不要用 Zustand（TAgent 全项目用 Jotai，保持一致）
- 不要在草稿目录里放 chat/ 子目录（v1 不需要对话镜像，助手直接用 /btw IPC 通道）
- 不要引入 SQLite 或数据库（CLAUDE.md 规定本地存储优先 JSON 文件）

---

## 1. 背景与目标

### 1.1 现状

TAgent 的草稿模式（Scratch Pad）是一个基于 TipTap 的全局 Markdown 记事本，持久化到 `~/.tagent/scratch-pad.md`。它和 Agent 模式互斥（`AppMode = 'agent' | 'scratch'`），切换到其他功能区时草稿标签页关闭，侧边栏为空。**没有任何 AI 集成**——编辑器不会读也不会写 Agent 上下文。

用户反馈："想不到使用场景"——因为草稿确实是孤立的，和 Agent 之间没有数据流动。

同时，Chat 模式在 P3 阶段已退役，`AppMode` 已移除 `'chat'`，但后端仍保留大量死代码：
- `chat-service.ts`（651 行完全死代码）
- 15+ 死 IPC handler
- 18+ 死 Jotai atom
- 25+ 死 preload 方法
- Tray 仍保留"新建对话"入口

### 1.2 目标

重构后的草稿模式应成为 **Agent 执行前的需求澄清环节**：

```
模糊想法 → AI 辅助澄清 → 结构化草稿 → 交给 Agent → Agent 执行 → 验收
```

用户在草稿模式下：
1. 写下模糊想法
2. AI 助手提问帮用户想清楚"到底要什么"
3. 将自由文本组织为结构化需求块（R-n + 验收标准）
4. 一键"交给 Agent"，草稿上下文自动注入 Agent 初始消息
5. Agent 执行过程中，草稿面板可实时查看进度
6. 执行完成后用户验收

### 1.3 非目标（v1 不做）

- 需求漂移检测和 trace.json 追溯
- 交互式 HTML 原型生成
- 完整的 PM 技能框架（只做 3 个简化版：澄清/结构化/完整性检查）
- 对话历史镜像到草稿目录
- 草稿版本控制 / diff
- 需求块之间的依赖关系
- 多人协作草稿

---

## 2. 设计原则

### 2.1 草稿是 Agent 的上游

草稿不是独立工具，而是 Agent 执行的准备环节。所有设计决策围绕"如何帮用户把模糊想法变成 Agent 能准确执行的指令"。

### 2.2 结构化但不过度

Kun 的 `### R-n: title {status}` 块适合软件开发。TAgent 的场景更通用，需求块应该更轻量：标题 + 描述 + 验收标准即可，不需要 INVEST/3C 等专业框架。

### 2.3 AI 辅助而非 AI 主导

AI 助手帮助澄清和完善，但最终决策权在用户。AI 不能自动修改草稿内容——只能建议，用户手动确认或通过明确的"应用建议"操作。

### 2.4 与现有基础设施复用

- AI 助手面板复用 `/btw` 的流式 IPC 通道（`BTW_IPC_CHANNELS.SEND_BTW`）
- TipTap 编辑器复用 ScratchPadView 已有的扩展集
- 工作区概念复用 Agent 已有的 workspaceId
- 文件存储遵循 `~/.tagent/` 目录规范

---

## 3. 第一部分：Chat 残留清理

### 3.1 迁移共享 atom

`chat-atoms.ts` 中 7 个 atom 仍被 Agent 代码使用，需先移出再删整个文件：

| Atom | 目标位置 |
|------|----------|
| `channelsAtom` | 新建 `renderer/atoms/model-atoms.ts` |
| `channelsLoadedAtom` | `model-atoms.ts` |
| `selectedModelAtom` | `model-atoms.ts` |
| `thinkingExpandedAtom` | `model-atoms.ts` |
| `conversationsAtom` | 合入 `agent-atoms.ts` |
| `streamingConversationIdsAtom` | 合入 `agent-atoms.ts` |
| `currentConversationIdAtom` | 删除（始终为 null，所有写入点都是 `set(xxx, null)`） |

修改所有导入这些 atom 的文件，改为从新位置导入。

### 3.2 删除文件

| 文件 | 行数 | 说明 |
|------|------|------|
| `main/lib/chat-service.ts` | ~651 | 完全死代码 |
| `main/lib/chat-service.test.ts` | - | 死测试 |
| `renderer/hooks/useConversationSettings.ts` | ~122 | 无消费者 |
| `renderer/contexts/session-context.tsx` 中 ConversationProvider 部分 | ~26 | 无消费者 |

### 3.3 删除 chat-atoms.ts 中的死 atom

删除以下所有导出后，`chat-atoms.ts` 为空，直接删除：

- `INITIAL_MESSAGE_LIMIT`, `CONTEXT_LENGTH_OPTIONS`
- `currentMessagesAtom`, `streamingAtom`, `streamingStatesAtom`, `streamingContentAtom`, `streamingReasoningAtom`, `streamingModelAtom`, `streamingToolActivitiesAtom`
- `currentConversationAtom`, `contextLengthAtom`, `parallelModeAtom`, `thinkingEnabledAtom`, `contextDividersAtom`, `pendingAttachmentsAtom`, `hasMoreMessagesAtom`
- `chatStreamErrorsAtom`, `currentChatErrorAtom`, `conversationDraftsAtom`, `currentConversationDraftAtom`
- `ChatPendingMessage`, `chatPendingMessageAtom`, `chatMessageRefreshAtom`
- `AgentRecommendation`, `pendingAgentRecommendationAtom`
- `conversationModelsAtom`, `conversationContextLengthAtom`, `conversationThinkingEnabledAtom`, `conversationParallelModeAtom`

### 3.4 删除 ipc.ts 中的死 Chat IPC handler

删除以下 handler 注册（约 200+ 行）：

- `CREATE_CONVERSATION`, `GET_MESSAGES`, `GET_RECENT_MESSAGES`, `UPDATE_TITLE`, `UPDATE_MODEL`
- `TOGGLE_PIN`, `TOGGLE_ARCHIVE`, `SEARCH_MESSAGES`
- `GET_TUTORIAL_CONTENT`, `CREATE_WELCOME_CONVERSATION`
- `DELETE_MESSAGE`, `TRUNCATE_MESSAGES_FROM`, `UPDATE_CONTEXT_DIVIDERS`
- `SAVE_ATTACHMENT`, `SAVE_RESOURCE_FILE_AS`, `DELETE_ATTACHMENT`, `EXTRACT_ATTACHMENT_TEXT`
- `CHAT_TOOL_IPC_CHANNELS` 整块（GET_ALL_TOOLS ~ TEST_TOOL，约 70 行）

保留：
- `LIST_CONVERSATIONS`（LeftSidebar 加载用）
- `DELETE_CONVERSATION`（LeftSidebar 删除用）
- `READ_ATTACHMENT`, `SAVE_IMAGE_AS`（SDKMessageRenderer 用）
- `OPEN_FILE_DIALOG`（AgentView 用）

### 3.5 删除 preload 死方法

删除以下 `window.electronAPI` 方法声明和实现（约 200 行）：

- `createConversation`, `getConversationMessages`, `getRecentMessages`
- `updateConversationTitle`, `updateConversationModel`
- `togglePinConversation`, `toggleArchiveConversation`
- `searchMessages`, `getTutorialContent`, `createWelcomeConversation`
- `deleteMessage`, `truncateMessagesFrom`, `updateContextDividers`
- `saveAttachment`, `saveResourceFileAs`, `deleteAttachment`, `extractAttachmentText`
- 流式监听器：`onStreamChunk`, `onStreamReasoning`, `onStreamComplete`, `onStreamError`, `onStreamToolActivity`
- ChatTool API：`getChatTools`, `getChatToolCredentials`, `updateChatToolState`, `updateChatToolCredentials`, `createCustomChatTool`, `deleteCustomChatTool`, `onCustomToolChanged`, `testChatTool`

### 3.6 Tray 和 main/index.ts 清理

- `tray.ts`：删除 `createChatSession` 方法声明和默认实现（第 16、47 行）
- `tray.ts`：删除"新建对话"菜单项（第 90-93 行），保留"新建 Agent 会话"
- `main/index.ts`：删除 `createChatSession` handler（第 509-511 行）
- `main/index.ts`：删除 `stopAllGenerations` 导入和调用（第 14、650 行）

### 3.7 类型清理

- `types/settings.ts`：将 `mode: 'chat' | 'agent'` 改为 `mode: 'agent'`（第 391、407、423 行）
- `packages/shared/src/types/chat.ts`：删除 `ChatSendInput`, `GenerateTitleInput` 及所有 Stream 事件类型；从 `CHAT_IPC_CHANNELS` 中删除死通道名，保留 `LIST_CONVERSATIONS`, `DELETE_CONVERSATION`, `READ_ATTACHMENT`, `SAVE_IMAGE_AS`, `OPEN_FILE_DIALOG`

### 3.8 重命名（去 chat 前缀）

| 旧名 | 新名 |
|------|------|
| `chat-tools-watcher.ts` | `tool-config-watcher.ts` |
| `chat-tool-config.ts` | `tool-config.ts` |
| `chat-tool-registry.ts` | `tool-registry.ts` |
| `chat-tool-executor.ts` | 评估后删除（仅被死 chat-service.ts 调用） |
| `chat-tools/` 目录 | `tools/` |

同步更新所有导入路径。

---

## 4. 第二部分：草稿模式重构

### 4.1 数据模型

新增 `packages/shared/src/types/draft.ts`：

```typescript
/** 草稿生命周期：draft → ready → executing → done → verified */
export type DraftStatus = 'draft' | 'ready' | 'executing' | 'done' | 'verified'

/** 需求块 — 比 Kun 的 R-n 块更轻量 */
export interface RequirementBlock {
  id: string
  label: string             // "R-1", "R-2" 自增
  title: string
  description: string
  acceptanceCriteria: Array<{
    id: string
    text: string
    checked: boolean
  }>
  status?: DraftStatus     // 块级状态覆盖
}

/** 完整草稿文档 */
export interface DraftDocument {
  id: string
  title: string
  workspaceId?: string     // 关联工作区
  mode?: 'general' | 'ta'
  context: string          // 自由形式背景（TipTap HTML）
  requirements: RequirementBlock[]
  status: DraftStatus
  agentSessionId?: string  // 升级后关联的 Agent 会话
  createdAt: number
  updatedAt: number
}

export const DRAFT_IPC_CHANNELS = {
  LIST: 'draft:list',
  GET: 'draft:get',
  CREATE: 'draft:create',
  UPDATE: 'draft:update',
  DELETE: 'draft:delete',
  MIGRATE_LEGACY: 'draft:migrate-legacy',
} as const
```

### 4.2 持久化

新增 `main/lib/draft-manager.ts`：

- 索引文件：`~/.tagent/drafts.json` — `DraftDocument[]`（轻量元数据数组）
- 内容文件：`~/.tagent/drafts/{id}.json` — 完整 `DraftDocument`
- 接口：
  - `listDrafts()` — 读索引
  - `getDraft(id)` — 读内容文件
  - `createDraft(opts)` — 生成 UUID，初始化空 `DraftDocument`，写索引+内容
  - `updateDraft(id, partial)` — 深合并，写内容+更新索引中 updatedAt
  - `deleteDraft(id)` — 删内容文件，更新索引
  - `migrateLegacy()` — 读 `~/.tagent/scratch-pad.md`，创建默认草稿，context 放入迁移内容

路径辅助加入 `main/lib/config-paths.ts`：
- `getDraftsIndexPath()` → `~/.tagent/drafts.json`
- `getDraftsDir()` → `~/.tagent/drafts/`
- `getDraftPath(id)` → `~/.tagent/drafts/{id}.json`

### 4.3 IPC 层

在 `main/ipc.ts` 注册 `DRAFT_IPC_CHANNELS` handler，替换 `SCRATCH_PAD_IPC_CHANNELS` 块。

在 `preload/index.ts` 暴露 `draftList` / `draftGet` / `draftCreate` / `draftUpdate` / `draftDelete` / `draftMigrateLegacy`，替换旧的 `loadScratchPad` / `saveScratchPad` / `saveScratchPadSync` / `exportScratchPad` / `chooseExportPath`。

### 4.4 Jotai Atoms

新增 `renderer/atoms/draft-atoms.ts`：

```typescript
// 核心状态
export const draftsAtom = atom<DraftDocument[]>([])
export const draftsLoadedAtom = atom(false)
export const currentDraftIdAtom = atom<string | null>(null)

// 当前草稿（派生）
export const currentDraftAtom = atom((get) =>
  get(draftsAtom).find(d => d.id === get(currentDraftIdAtom)) ?? null
)

// 需求块读写
export const currentDraftRequirementsAtom = atom(
  (get) => get(currentDraftAtom)?.requirements ?? [],
  (get, set, update) => { /* 就地编辑 + IPC 持久化 */ }
)

// 背景上下文读写
export const currentDraftContextAtom = atom(
  (get) => get(currentDraftAtom)?.context ?? '',
  (get, set, newContext) => { /* 就地编辑 + IPC 持久化 */ }
)

// 创建草稿
export const createDraftAtom = atom(null, async (get, set, opts) => {
  const doc = await window.electronAPI.draftCreate(opts)
  set(draftsAtom, prev => [...prev, doc])
  set(currentDraftIdAtom, doc.id)
  return doc
})

// 状态推进
export const upgradeToReadyAtom = atom(null, async (get, set) => { ... })
export const upgradeToAgentAtom = atom(null, async (get, set) => { ... })
```

删除 `tab-atoms.ts` 中的 `scratchPadContentAtom`, `scratchPadLoadedAtom`, `SCRATCH_PAD_ID`, `SCRATCH_PAD_TITLE`。

修改 `TabType`：`'agent' | 'scratch' | 'preview'` → `'agent' | 'draft' | 'preview'`

修改 `openTab`：draft 类型用 `draft.id` 作为 tab ID

修改 `app-mode.ts`：`AppMode = 'agent' | 'draft'`，`GeneralRailItem` 中 `'scratch'` → `'draft'`

### 4.5 UI 组件

**删除**：`renderer/components/scratch-pad/ScratchPadView.tsx`

**新增**：

| 组件 | 文件 | 职责 |
|------|------|------|
| DraftView | `draft/DraftView.tsx` | 主容器，左右分栏布局 |
| DraftEditor | `draft/DraftEditor.tsx` | TipTap 富文本编辑器，复用现有扩展 |
| RequirementBlockCard | `draft/RequirementBlockCard.tsx` | 单个需求块卡片 |
| RequirementList | `draft/RequirementList.tsx` | 需求块列表，添加/删除/拖拽排序 |
| DraftAssistantPanel | `draft/DraftAssistantPanel.tsx` | AI 助手侧边栏 |
| DraftStatusBar | `draft/DraftStatusBar.tsx` | 底部状态栏 + "交给 Agent"按钮 |
| DraftListPanel | `draft/DraftListPanel.tsx` | 左侧边栏草稿列表 |

**DraftView 布局**：

```
+----------------------------------------------------+
|  标题（可编辑）              [AI 助手 ▼]            |
+------------------------------+---------------------+
|  背景编辑器                  |  AI 助手面板         |
|  (TipTap 富文本)             |                     |
|                              |  ┌── 框架按钮 ──┐   |
|  ─── 需求 ───               |  │ 🔍 澄清需求   │   |
|  [R-1] 标题 {draft}        |  │ 📋 结构化     │   |
|       描述                   |  │ 🛡️ 完整性检查 │   |
|       [ ] 标准 1             |  └───────────────┘   |
|       [ ] 标准 2             |                     |
|                              |  对话历史...         |
|  [R-2] 标题 {draft}        |                     |
|       ...                    |  [输入框]            |
+------------------------------+---------------------+
|  ● draft  已保存  [交给 Agent ▶]                   |
+----------------------------------------------------+
```

### 4.6 AI 助手面板

**简化版 PM 框架**（3 组，5 个按钮）：

| 阶段 | 按钮 | 触发行为 |
|------|------|----------|
| 澄清 | 澄清需求 | 注入提示词"请分析我的草稿，指出不清晰的地方并提出开放性问题" → AI 分析草稿全文 |
| 澄清 | 研究 | 注入"请搜索与以下需求相关的背景信息" → AI 补充知识 |
| 结构 | 结构化 | 注入"请将以下自由文本整理为结构化的需求块（R-n 标题 + 验收标准）" → AI 提取结构 |
| 结构 | 润色 | 注入"请检查草稿的语法、逻辑一致性，提出改进建议" → AI 润色 |
| 检查 | 完整性检查 | 注入"请识别草稿中的隐性假设和缺失的验收标准" → AI 风险检查 |

**AI 通信路径**：复用 `BTW_IPC_CHANNELS.SEND_BTW`，注入完整草稿 markdown 作为上下文，以助文人设发送。

**关键限制**：AI 只能建议，不能直接修改草稿。用户看到 AI 回复后手动编辑，或通过明确的"应用建议"操作。

### 4.7 草稿 → Agent 升级流程

1. 用户点击"交给 Agent"，`draft.status` 须为 `'ready'`
2. `upgradeToAgentAtom` 触发：
   - 调用 `window.electronAPI.createAgentSession(draft.title, draft.workspaceId, draft.mode)`
   - 调用 `buildAgentPrompt(draft)` 组装初始消息
   - 通过 `AGENT_IPC_CHANNELS.SEND_MESSAGE` 发送给新 Agent 会话
   - 更新 `draft.status` 为 `'executing'`，设置 `draft.agentSessionId`
   - 切换到新 Agent 会话标签页
3. Agent 会话完成 → 监听 `AGENT_IPC_CHANNELS.STREAM_COMPLETE`，更新 `draft.status` 为 `'done'`
4. 用户在草稿面板确认验收 → `draft.status` = `'verified'`

新增 `renderer/lib/draft-prompt-builder.ts`：

```typescript
export function buildAgentPrompt(draft: DraftDocument): string {
  let prompt = `## 背景\n\n${htmlToMarkdown(draft.context)}\n\n`
  prompt += `## 需求\n\n`
  for (const req of draft.requirements) {
    prompt += `### ${req.label}: ${req.title}\n`
    if (req.description) prompt += `${req.description}\n`
    if (req.acceptanceCriteria.length > 0) {
      prompt += `\n验收标准:\n`
      for (const ac of req.acceptanceCriteria) {
        prompt += `- [${ac.checked ? 'x' : ' '}] ${ac.text}\n`
      }
    }
    prompt += '\n'
  }
  prompt += `请根据以上背景和需求执行任务。`
  return prompt
}
```

### 4.8 导航集成

**FunctionalRail**：
- Rail item ID `'scratch'` → `'draft'`
- 描述改为"需求草稿"
- 点击行为：创建新草稿 OR 切换到草稿列表（左侧边栏）+ 最后活跃草稿

**LeftSidebar**：
- `case 'draft'`: 渲染 `<DraftListPanel />`（替换 `return null`）

**TabBar/TabBarItem**：
- draft 类型标签页显示草稿标题 + StickyNote 图标

**TabContent**：
- `tab.type === 'draft'` → `<DraftView draftId={tab.sessionId} />`

**MainArea**：
- `showSessionWelcome` 条件：`appMode !== 'draft'`

### 4.9 旧版迁移

- `ScratchPadPersistence` 组件替换为 `DraftPersistence`
- `DraftPersistence` 首次 mount：调用 `draftList()` IPC
- 若列表为空且 `~/.tagent/scratch-pad.md` 存在 → 调用 `draftMigrateLegacy()` IPC，内容迁入默认草稿的 `context` 字段
- 旧 `scratch-pad.md` 保留在磁盘，不自动删除

### 4.10 删除旧 Scratch Pad 代码

| 文件 | 操作 |
|------|------|
| `main/ipc.ts` 中 `SCRATCH_PAD_IPC_CHANNELS` handler 块（第 1577-1654 行） | 删除 |
| `preload/index.ts` 中 `loadScratchPad` / `saveScratchPad` / `saveScratchPadSync` / `exportScratchPad` / `chooseExportPath` | 删除 |
| `renderer/atoms/tab-atoms.ts` 中 `scratchPadContentAtom` / `scratchPadLoadedAtom` / `SCRATCH_PAD_ID` / `SCRATCH_PAD_TITLE` | 删除 |
| `renderer/components/scratch-pad/ScratchPadView.tsx` | 删除整个文件 |
| `renderer/main.tsx` 中 `ScratchPadPersistence` 组件（第 817-905 行） | 替换为 `DraftPersistence` |
| `types/settings.ts` 中 `scratchPadActive` 设置字段 | 改为 `draftActive`（或删除） |

---

## 5. 实施顺序

```
Phase 1: Chat 清理
  1a. 迁移共享 atom → model-atoms.ts / agent-atoms.ts
  1b. 删除 chat-atoms.ts 中死 atom → 删除整个文件
  1c. 删除 chat-service.ts 及测试
  1d. 删除 ipc.ts 中死 handler
  1e. 删除 preload 中死方法
  1f. 删除 tray chat 入口 + main/index.ts 清理
  1g. 类型清理 + 重命名 chat-tools → tools
  → 验证: bun run typecheck + bun run dev 正常

Phase 2: Draft 数据层
  2a. 新增 packages/shared/src/types/draft.ts
  2b. 新增 main/lib/draft-manager.ts
  2c. 新增 config-paths 路径辅助
  2d. 注册 DRAFT_IPC_CHANNELS handler
  2e. 暴露 preload draft API
  → 验证: 主进程 CRUD 通过 IPC 调用正常

Phase 3: Draft Atoms + 导航
  3a. 新增 draft-atoms.ts
  3b. 修改 tab-atoms.ts（TabType, openTab, 常量）
  3c. 修改 app-mode.ts（AppMode, RailItem）
  3d. 修改 FunctionalRail, LeftSidebar, TabBar, TabBarItem, TabContent, MainArea
  → 验证: bun run typecheck 通过，导航可切换

Phase 4: Draft UI
  4a. 新增 DraftView, DraftEditor, RequirementBlockCard, RequirementList
  4b. 新增 DraftAssistantPanel
  4c. 新增 DraftStatusBar
  4d. 新增 DraftListPanel
  4e. 替换 ScratchPadPersistence → DraftPersistence
  → 验证: bun run dev，草稿创建/编辑/AI 辅助可用

Phase 5: Agent 升级
  5a. 新增 draft-prompt-builder.ts
  5b. 实现 upgradeToAgentAtom
  5c. 状态跟踪（executing → done → verified）
  5d. 旧版 scratch-pad.md 迁移
  → 验证: 完整流程：新建草稿 → AI 澄清 → 结构化 → 交给 Agent → Agent 执行 → 验收

Phase 6: 收尾
  6a. 删除 scratch-pad 相关全部代码
  6b. 清理 settings.ts 中 scratchPadActive
  6c. 更新 CLAUDE.md / PROGRESS.md
```

---

## 6. 验证方式

1. `bun run typecheck` — 每个阶段完成后必须通过
2. `bun run dev` — 手动测试核心流程
3. Chat 清理后：Agent 会话创建、消息发送、模型切换正常
4. Draft 完成后：新建 → 编辑 → AI 辅助 → 交给 Agent → 执行 → 验收 完整流程跑通
5. 旧数据迁移：`scratch-pad.md` 有内容时首次打开自动迁移为草稿
