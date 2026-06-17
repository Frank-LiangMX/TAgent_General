# Ask 档位统一 Composer 设计（替代独立 Chat 模式）

> **状态**：Accepted，待实施  
> **日期**：2026-06-13  
> **分支建议**：`feature/ask-mode-composer`  
> **ADR**：[`decisions/0002-ask-mode-composer.md`](decisions/0002-ask-mode-composer.md)  
> **关联设计**：[`2026-06-05-tagent-fusion-design.md`](2026-06-05-tagent-fusion-design.md) § Chat vs Agent

---

## 0. 新 Agent 接手必读（Handoff）

**你要做什么**：把 TAgent 从「Chat / Agent 双模式双 UI」收成 **单一 Agent 工作台 + 输入区 Ask / Agent 档位**。

**不要做什么**：

- 不要新建第二套 `ChatView` / 第二套侧栏列表。
- 不要让 Ask 写入 SDK `agent-sessions/{id}.jsonl`（避免污染 resume）。
- 不要在 Ask 下开放文件读写、MCP、TA 工具、自定义 HTTP 工具。
- 不要未经用户确认自动删除 `~/.tagent/conversations/` 用户数据。

**读完本文后按章节 8 的 PR 顺序实施**；每 PR 需 `bun run typecheck` + `bun test`，UI 改动附截图。

---

## 1. 背景与目标

### 1.1 问题

| 问题            | 说明                                                                          |
| --------------- | ----------------------------------------------------------------------------- |
| Chat 入口弱     | `appMode` 切换藏在欢迎页 / 设置 / `Cmd+Shift+M`，Rail「会话」与列表内容不一致 |
| 双轨成本高      | 两套 IPC、atoms、侧栏、Tab 类型、~9k 行 Chat 专用 UI                          |
| Chat 差异化不足 | 相对网页端 DeepSeek / 豆包等无独占理由                                        |
| 轻量问答割裂    | `/btw` 已支持无工具问答，但与主 Composer 分离                                 |

### 1.2 目标

1. **一个主界面**：`AgentView` + 统一会话侧栏 + `type: 'agent'` Tab（`scratch` / `preview` 保持）。
2. **输入区档位**：`ask` | `agent`，默认 `agent`。
3. **Ask 权限契约**：模型知晓能力边界；越界时引导切 Agent 档位。
4. **同会话上下文**：Ask 可读 Agent SDK 历史摘要；Agent 可读同会话 Ask 历史（用于续聊）。
5. **渐进退役 Chat 模式**（P0～P3），保留用户本地 Chat 数据。

### 1.3 非目标（本阶段）

- 不改 Agent SDK 权限模式语义（`auto` / `plan` / `bypassPermissions`）。
- 不改 Memory 五层 schema。
- 不强制批量迁移 Chat → Agent（仅提供单条/导出能力）。

---

## 2. 已确认产品决策

| #   | 决策                                                                                         |
| --- | -------------------------------------------------------------------------------------------- |
| D1  | Composer 档位对标 Cursor：**Ask = 只对话**，**Agent = 可动手**                               |
| D2  | 切换发生在 **输入区**，不在设置页、不作为全局 `appMode`                                      |
| D3  | 升级路径：**同 `agentSessionId` 切到 Agent 档位 + 预填 `suggestedPrompt`**，非新建 Chat 会话 |
| D4  | Ask 工具白名单：`suggest_agent_switch`（必开）+ 可选 `web-search`、`memory`；其余禁用        |
| D5  | Ask 消息存 **`{sessionId}.ask.jsonl`**，与 SDK JSONL 并列                                    |
| D6  | 侧栏 **单一 Agent 会话列表**；退役 Chat 列表主路径                                           |
| D7  | `/btw` 在 P2 与 Ask 收敛（合并为 Ask 展开态或 deprecate）                                    |

---

## 3. 架构总览

```
用户输入 (AgentView Composer)
        │
        ├─ composerMode === 'agent' ──► agent-orchestrator ──► SDK JSONL
        │
        └─ composerMode === 'ask' ───► ask-service ──► ask.jsonl
                                              │
                                              ├─ convertSDKMessagesToChatHistory (btw)
                                              ├─ getAdapter (@tagent/core)
                                              └─ ask-tool-policy (白名单工具)
```

**时间线 UI**：`AgentMessages` 合并渲染

- SDK 消息（`SDKMessageRenderer`）
- Ask 消息（轻量气泡组件，可新建 `AskMessageItem.tsx`）

按 `createdAt` 排序；Ask 轮次带 `kind: 'ask'` 视觉区分（图标 / 左侧色条）。

---

## 4. 数据模型

### 4.1 Composer 档位（per-session）

```typescript
/** Composer 档位：输入区 Ask / Agent */
export type ComposerMode = 'ask' | 'agent'

/** 默认 Agent */
export const DEFAULT_COMPOSER_MODE: ComposerMode = 'agent'
```

**持久化**（二选一，推荐 A）：

- **A**：`AgentSessionMeta.lastComposerMode?: ComposerMode`（写入 `agent-sessions.json`）
- **B**：仅 `composerModeMapAtom` + `atomWithStorage` per sessionId（不落盘索引）

推荐 **A**，便于 Bridge / 重启恢复。

### 4.2 Ask 消息（`packages/shared`）

在 `packages/shared/src/types/ask.ts`（**新建**）定义：

```typescript
export interface AskMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  reasoning?: string
  createdAt: number
  /** 使用的渠道 / 模型（展示用） */
  channelId?: string
  modelId?: string
  /** 用户附件（结构与 FileAttachment 对齐或复用） */
  attachments?: FileAttachment[]
  /** 是否为流式中断残留 */
  partial?: boolean
}

export interface AskSendInput {
  agentSessionId: string
  content: string
  channelId: string
  modelId: string
  attachments?: AttachmentSaveInput[]
  /** 注入 Ask 契约后的系统提示（主进程也可内置，此字段可选覆盖） */
  systemPromptOverride?: string
}
```

### 4.3 存储路径

| 资源           | 路径                                      | 说明                   |
| -------------- | ----------------------------------------- | ---------------------- |
| Agent SDK 消息 | `~/.tagent/agent-sessions/{id}.jsonl`     | 现有                   |
| Ask 消息       | `~/.tagent/agent-sessions/{id}.ask.jsonl` | **新增**               |
| Chat 遗留      | `~/.tagent/conversations/*`               | 只读 / 迁移，P3 前不删 |

**config-paths 新增**：

```typescript
export function getAgentSessionAskMessagesPath(id: string): string {
  return join(getAgentSessionsDir(), `${id}.ask.jsonl`)
}
```

### 4.4 升级引导 payload

复用 Chat 工具 JSON 结构，类型名调整：

```typescript
export interface AgentSwitchSuggestion {
  type: 'agent_switch_suggestion'
  reason: string
  suggestedPrompt: string
}
```

---

## 5. Ask 权限契约（系统提示）

主进程 `ask-prompt-builder.ts`（**新建**）组装，每次 Ask 请求附加。

**文件位置**：`apps/electron/src/main/lib/ask-prompt-builder.ts`

**契约要点**（实施时写完整中文/英文双语或仅中文，与产品一致）：

1. **当前模式**：Ask，不能读写文件、不能执行命令、不能 MCP/Skills。
2. **可以做**：解释、总结、基于上下文的建议、白名单工具（搜索/记忆）。
3. **不可以假装**：已完成文件修改或命令执行。
4. **越界时**：说明边界 → 调用 `suggest_agent_switch` → 仍可给文字思路并标注「未执行」。

**上下文注入**：

```typescript
import { convertSDKMessagesToChatHistory } from './btw-service'
import { getAgentSessionSDKMessages } from './agent-session-manager'

// history = convertSDKMessagesToChatHistory(sdkMessages, maxTurns)
// + 可选：最近 Ask jsonl 尾部 N 条
```

默认 `maxTurns` 与 BTW 对齐（`DEFAULT_BTW_CONTEXT_TURNS = 20`），可配置。

### 5.1 工具：`suggest_agent_switch`

自 `agent-recommend-tool.ts` 演进：

| 项                 | Chat 现状              | Ask 目标                                     |
| ------------------ | ---------------------- | -------------------------------------------- |
| 工具名             | `suggest_agent_mode`   | `suggest_agent_switch`（可保留别名兼容一期） |
| systemPromptAppend | Chat 导向              | Ask 权限边界 + 引导语                        |
| 执行结果           | `agent_recommendation` | `agent_switch_suggestion`                    |
| UI                 | 迁移到新 Agent 会话    | **切 Composer 为 agent + 预填 draft**        |

---

## 6. Ask 工具白名单

**文件**：`apps/electron/src/main/lib/ask-tool-policy.ts`（**新建**）

| 工具 ID                                         | Ask       | Agent          |
| ----------------------------------------------- | --------- | -------------- |
| `agent-mode-recommend` / `suggest_agent_switch` | ✅ 必开   | ❌             |
| `web-search`                                    | ✅ 可配置 | Agent/MCP      |
| `memory`                                        | ✅ 可配置 | Agent 记忆体系 |
| `nano-banana`                                   | ❌ 默认   | 产品后续       |
| `ta-*`                                          | ❌        | TA Agent       |
| 自定义 HTTP                                     | ❌        | 视配置         |

实现：`getAskEnabledTools()` 返回 `ToolDefinition[]` + `systemPromptAppend`，内部调用 `chat-tool-registry` 子集，**不**走 Chat 全量 `getEnabledTools`。

---

## 7. IPC 设计（四件套）

遵循项目 IPC 模式：类型 → `ipc.ts` → `preload` → renderer。

### 7.1 通道常量（`packages/shared/src/types/ask.ts`）

```typescript
export const ASK_IPC_CHANNELS = {
  /** 获取 Ask 消息列表 */
  GET_MESSAGES: 'ask:get-messages',
  /** 发送 Ask 消息（触发流式） */
  SEND_MESSAGE: 'ask:send-message',
  /** 中止当前会话 Ask 生成 */
  STOP_GENERATION: 'ask:stop-generation',
  /** 删除单条 Ask 消息（可选 P1） */
  DELETE_MESSAGE: 'ask:delete-message',

  // 主进程 → 渲染进程
  STREAM_CHUNK: 'ask:stream:chunk',
  STREAM_REASONING: 'ask:stream:reasoning',
  STREAM_COMPLETE: 'ask:stream:complete',
  STREAM_ERROR: 'ask:stream:error',
  STREAM_TOOL_ACTIVITY: 'ask:stream:tool-activity',
  /** 升级引导（解析自 suggest_agent_switch） */
  STREAM_SWITCH_SUGGESTION: 'ask:stream:switch-suggestion',
} as const
```

流式 payload 必须带 **`agentSessionId`**，与 Chat 的 `conversationId` 区分。

### 7.2 Preload API（`window.electronAPI`）

```typescript
getAskMessages(agentSessionId: string): Promise<AskMessage[]>
sendAskMessage(input: AskSendInput): Promise<void>
stopAskGeneration(agentSessionId: string): Promise<void>
onAskStreamChunk(listener): () => void
// ... 其余 stream 监听与 Chat 对称
```

### 7.3 与 `CHAT_IPC_CHANNELS` 关系

| 阶段   | 策略                                                 |
| ------ | ---------------------------------------------------- |
| P0～P1 | Ask 用 `ASK_IPC_*`；Chat IPC 保留给遗留 / Quick Task |
| P2     | Quick Task 默认 Agent；Ask 走 `ASK_IPC`              |
| P3     | 删除 `CHAT_IPC` 发送类；只读类可保留一季             |

---

## 8. 实施阶段与 PR 拆分

### Phase P0 — 核心 Ask 链路（MVP，约 2～3 天）

**目标**：Agent 输入区可切 Ask，能发、能流式、能展示，带权限契约。

| PR   | 内容                                                                                                           |
| ---- | -------------------------------------------------------------------------------------------------------------- |
| P0-1 | `packages/shared`：`ask.ts` 类型 + `ASK_IPC_CHANNELS`；`config-paths` + `AgentSessionMeta.lastComposerMode`    |
| P0-2 | 主进程：`ask-message-store.ts`、`ask-service.ts`、`ask-prompt-builder.ts`、`ask-tool-policy.ts`；注册 `ipc.ts` |
| P0-3 | `preload/index.ts` + `ask-service.test.ts`（流式 mock）                                                        |
| P0-4 | 渲染：`composerModeMapAtom` / 持久化；`ComposerModeSelector.tsx`；`AgentView` 发送分支                         |
| P0-5 | `AskMessageItem` + `AgentMessages` 时间线合并；`useGlobalAskListeners.ts`                                      |

**P0 验收**：

- [ ] 同会话切换 Ask/Agent，Agent 消息与 Ask 消息按时间混排
- [ ] Ask 不触发 SDK 写文件
- [ ] `bun run typecheck` / `bun test` 通过

### Phase P1 — 引导升级 + 体验（约 1.5～2 天）

| PR   | 内容                                                                              |
| ---- | --------------------------------------------------------------------------------- |
| P1-1 | `suggest_agent_switch` 工具 + `STREAM_SWITCH_SUGGESTION`                          |
| P1-2 | `AgentSwitchBanner.tsx`（自 `AgentRecommendBanner` 改造，放 `components/agent/`） |
| P1-3 | Ask 下灰掉 Permission / 工作区附件；模型选择器支持全渠道                          |
| P1-4 | 输入区弱提示文案：`仅对话，不修改文件或执行命令`                                  |
| P1-5 | 可选：发送前启发式提示（改文件/运行命令关键词）                                   |

**P1 验收**：

- [ ] 用户问「帮我改 login.ts」→ 横幅 + 一键切 Agent 并预填 prompt
- [ ] 不创建新会话、不调用 `migrateChatToAgent`

### Phase P2 — 导航统一 + Chat 藏入口（约 1.5～2 天）

| PR   | 内容                                                                 |
| ---- | -------------------------------------------------------------------- |
| P2-1 | 侧栏移除 `appMode === 'chat'` 列表分支；Rail 文案改为「会话」        |
| P2-2 | 删除/隐藏欢迎页 Chat Tab、`SettingsPanel` Chat/Agent 切换            |
| P2-3 | `TabSwitcher` / `SearchDialog` 仅 Agent（Chat 结果可选保留只读一季） |
| P2-4 | 快捷键：`Cmd+Shift+M` 改为切换 Composer 档位（非 appMode）           |
| P2-5 | `/btw` 标记 deprecated 或映射到 Ask 展开面板                         |

### Phase P3 — Chat 栈退役（约 2～3 天）

| PR   | 内容                                                                                |
| ---- | ----------------------------------------------------------------------------------- |
| P3-1 | 删 `ChatView` 及 `components/chat/`（先搬迁共享组件到 `components/shared/`）        |
| P3-2 | 删 `chat-service` 发送路径 / `useGlobalChatListeners`（保留附件 API 若 Agent 仍用） |
| P3-3 | `migration-service` 调整；设置里 Chat 历史「导出」                                  |
| P3-4 | 删 `appMode: 'chat'`、`TabType: 'chat'`                                             |

---

## 9. 底层（Main / Shared）任务清单

### 9.1 `packages/shared`

| 任务                    | 文件                       | 说明                                          |
| ----------------------- | -------------------------- | --------------------------------------------- |
| [ ] 新增 Ask 类型与 IPC | `src/types/ask.ts`         | 导出至 `src/index.ts`                         |
| [ ] 扩展会话元数据      | `src/types/agent.ts`       | `AgentSessionMeta.lastComposerMode?`          |
| [ ] 流式事件类型        | `ask.ts`                   | `AskStreamChunkEvent` 等，带 `agentSessionId` |
| [ ] 升级引导类型        | `ask.ts` 或 `chat-tool.ts` | `AgentSwitchSuggestion`                       |

### 9.2 `apps/electron/src/main/lib`

| 任务               | 文件                                 | 说明                                                |
| ------------------ | ------------------------------------ | --------------------------------------------------- |
| [ ] Ask 消息路径   | `config-paths.ts`                    | `getAgentSessionAskMessagesPath`                    |
| [ ] Ask JSONL CRUD | `ask-message-store.ts`               | **新建**，参考 `conversation-manager` 简化版        |
| [ ] Ask 流式服务   | `ask-service.ts`                     | **新建**，参考 `chat-service.ts` + `btw-service.ts` |
| [ ] 权限契约       | `ask-prompt-builder.ts`              | **新建**，`buildAskSystemPrompt(sessionId)`         |
| [ ] 工具白名单     | `ask-tool-policy.ts`                 | **新建**                                            |
| [ ] 升级工具       | `chat-tools/agent-recommend-tool.ts` | 改 prompt / 工具名 / 返回 type                      |
| [ ] IPC 注册       | `ipc.ts`                             | `ASK_IPC_CHANNELS` handlers                         |
| [ ] 会话 CRUD      | `agent-session-manager.ts`           | 读写 `lastComposerMode`                             |
| [ ] 测试           | `ask-service.test.ts`                | 契约注入、工具白名单、mock adapter                  |

**可复用、少改**：

- `btw-service.ts` — `convertSDKMessagesToChatHistory` 导出给 Ask 用
- `channel-manager.ts` — 解密 API Key
- `chat-tool-executor.ts` — Ask 工具执行（过滤后）

**暂缓删除（P3）**：

- `chat-service.ts`、`conversation-manager.ts`

### 9.3 `apps/electron/src/preload`

| 任务                           | 文件             |
| ------------------------------ | ---------------- |
| [ ] 暴露 Ask API + stream 监听 | `index.ts`       |
| [ ] 更新 `ElectronAPI` 接口    | 同文件或 `types` |

### 9.4 主进程入口

| 任务                  | 文件            | 说明                                 |
| --------------------- | --------------- | ------------------------------------ |
| [ ] 托盘「新建 Chat」 | `main/index.ts` | 改为新建 Agent 会话 + Ask 档位（P2） |

---

## 10. 前端（Renderer）任务清单

### 10.1 Atoms

| 任务                  | 文件                      | 说明                                        |
| --------------------- | ------------------------- | ------------------------------------------- |
| [ ] Composer 档位 Map | `atoms/composer-atoms.ts` | **新建** `composerModeMapAtom`              |
| [ ] Ask 消息 / 流式   | `atoms/ask-atoms.ts`      | **新建**，结构参考 `chat-atoms` 简化        |
| [ ] 升级引导          | 迁自 `chat-atoms`         | `pendingAgentSwitchSuggestionAtom`          |
| [ ] 拆渠道 atom       | `atoms/channel-atoms.ts`  | **新建**，从 `chat-atoms` 迁 `channelsAtom` |
| [ ] 弱化 appMode      | `atoms/app-mode.ts`       | P2 移除 `'chat'`，保留 `scratch`            |

### 10.2 Hooks

| 任务               | 文件                                          |
| ------------------ | --------------------------------------------- |
| [ ] Ask IPC 监听   | `hooks/useGlobalAskListeners.ts`              |
| [ ] 挂载监听       | `main.tsx`（与 Agent 监听并列）               |
| [ ] 发送逻辑       | `AgentView.tsx` 或 `hooks/useComposerSend.ts` |
| [ ] 清理 Chat 监听 | P3 删 `useGlobalChatListeners.ts`             |

### 10.3 组件

| 任务            | 文件                                        | 说明                                                                 |
| --------------- | ------------------------------------------- | -------------------------------------------------------------------- |
| [ ] 档位切换器  | `components/agent/ComposerModeSelector.tsx` | 参考 `PermissionModeSelector` 36px 圆形                              |
| [ ] Ask 气泡    | `components/agent/AskMessageItem.tsx`       | **新建**                                                             |
| [ ] 升级横幅    | `components/agent/AgentSwitchBanner.tsx`    | 自 `AgentRecommendBanner` 改                                         |
| [ ] 时间线合并  | `AgentMessages.tsx`                         | 拉 Ask + SDK，按时间排序                                             |
| [ ] 输入区分支  | `AgentView.tsx`                             | Ask 时隐藏/禁用 Agent 专属控件                                       |
| [ ] 搬迁共享 UI | `components/shared/`                        | `UserAvatar`、`CopyButton`、`AttachmentPreviewItem`、`ModelSelector` |

### 10.4 App Shell

| 任务           | 文件                    | 说明                 |
| -------------- | ----------------------- | -------------------- |
| [ ] 侧栏单列表 | `LeftSidebar.tsx`       | 删 Chat 分支（P2）   |
| [ ] Rail 文案  | `FunctionalRail.tsx`    | 「会话」             |
| [ ] Tab        | `TabContent.tsx`        | 删 `chat` 分支（P3） |
| [ ] 搜索       | `SearchDialog.tsx`      | Agent only（P2）     |
| [ ] 快捷键     | `GlobalShortcuts.tsx`   | Composer 档位（P2）  |
| [ ] 欢迎页     | `WelcomeEmptyState.tsx` | 删 Chat Tab（P2）    |

### 10.5 设置

| 任务                   | 文件                                          |
| ---------------------- | --------------------------------------------- |
| [ ] 删 Chat/Agent 切换 | `SettingsPanel.tsx`                           |
| [ ] Prompt 文案        | `PromptSettings.tsx` — 区分 Agent 系统提示    |
| [ ] Tool 设置          | `ToolSettings.tsx` — 标注「Ask 白名单」或拆分 |

---

## 11. 与现有模块关系

| 模块                          | 关系                                         |
| ----------------------------- | -------------------------------------------- |
| `btw-service` / `BtwPanel`    | P2 收敛；上下文抽取逻辑 **复用**             |
| `chat-service`                | P0～P1 Ask 平行实现；P3 评估删除或剩附件工具 |
| `AgentRecommendBanner`        | P1 迁至 Agent，行为改为切档位                |
| `QuickTaskApp`                | P2 仅 Agent + 可选 Ask                       |
| Feishu/DingTalk/WeChat Bridge | **无改动**（已走 Agent 会话）                |
| `packages/core` providers     | **保留**，Ask 与 Agent 共用                  |

---

## 12. BDD 场景（测试用例来源）

```gherkin
Feature: Composer Ask 档位

  Scenario: 默认 Agent 档位发送走 SDK
    Given 用户打开 Agent 会话
    And Composer 档位为 agent
    When 用户发送「列出 src 目录」
    Then 应调用 agent-orchestrator
    And 不应写入 ask.jsonl

  Scenario: Ask 档位不执行文件操作
    Given Composer 档位为 ask
    When 用户发送「帮我把 README 改成中文」
    Then 应调用 ask-service
    And 响应应说明无法改文件或触发 suggest_agent_switch
    And 不应调用 agent-orchestrator

  Scenario: 一键升级到 Agent
    Given Ask 档位下出现升级横幅
    When 用户点击「切换到 Agent 并继续」
    Then Composer 档位变为 agent
    And 输入框预填 suggestedPrompt
    And 会话 ID 不变

  Scenario: 时间线混排
    Given 会话中已有 Agent 工具执行记录
    And 用户用 Ask 追问「上一步做了什么」
    Then 时间线应按时间展示 SDK 消息与 Ask 消息
```

**单元测试重点**：

- `ask-prompt-builder.test.ts` — 契约包含边界关键词
- `ask-tool-policy.test.ts` — TA 工具不在白名单
- `ask-message-store.test.ts` — JSONL 读写

---

## 13. 用户数据与迁移

| 数据                   | 策略                                               |
| ---------------------- | -------------------------------------------------- |
| `conversations/*`      | P2 后 UI 不展示；设置页「导出 Chat 历史」          |
| 单条迁移               | 保留 `migrateChatToAgent` IPC，入口移到导出/历史页 |
| `appMode` localStorage | P2 迁移脚本：`chat` → 删除 key，默认 agent         |
| Tab `type: 'chat'`     | 启动时清理或提示「已归档」                         |

---

## 14. UI 规范（与现有风格一致）

- **ComposerModeSelector**：`size-[36px] rounded-full`，`variant="ghost"`，图标颜色区分状态（Ask：`text-blue-500`，Agent：默认 `text-foreground/60`）。
- **Tooltip**：Ask —「只对话，不修改文件」；Agent —「工具、工作区、MCP」。
- **Ask 消息**：比 Agent 工具块更轻，无 ProcessBlock；用户气泡样式可与 Chat 对齐。
- **横幅**：与 `AskUserBanner` 同位置层级，不挡 Permission 请求。

---

## 15. 工时估算

| 阶段     | 人天          |
| -------- | ------------- |
| P0       | 2.5～3.5      |
| P1       | 1.5～2        |
| P2       | 1.5～2        |
| P3       | 2～3          |
| **合计** | **7.5～10.5** |

---

## 16. 实施检查表（复制到 PR Description）

```markdown
## Ask Mode Composer

- [ ] shared: ask types + ASK_IPC_CHANNELS
- [ ] main: ask-service + ask-message-store + ask-prompt-builder
- [ ] ipc + preload 四件套
- [ ] ComposerModeSelector + AgentView 发送分支
- [ ] AgentMessages 时间线合并
- [ ] suggest_agent_switch + AgentSwitchBanner
- [ ] 侧栏/Rail/设置 去 Chat 主路径
- [ ] typecheck + test + UI 截图
```

---

## 17. 变更日志建议

合并 P0+P1 后更新 `CHANGELOG.md`：

```markdown
### Added

- desktop: Agent 输入区 Ask 档位（轻量对话，权限边界 + 引导切换 Agent）
```

P3 合并后：

```markdown
### Removed

- desktop: 独立 Chat 模式 UI（历史对话可导出）
```

---

## 18. 文档维护

| 文档                                       | 动作                                  |
| ------------------------------------------ | ------------------------------------- |
| 本文                                       | 实施中更新 PR 链接 / 状态             |
| `docs/PROGRESS.md`                         | 标记阶段完成                          |
| `docs/decisions/0002-ask-mode-composer.md` | Status → Implemented                  |
| `CLAUDE.md` / `README.md`                  | **需用户允许后** 更新架构图与模式说明 |
