# Ask 模式重构设计：从同会话切换改为独立会话类型

> **状态**：Draft v1.0 — 待评审
> **日期**：2026-07-03
> **作者**：Frank + Claude
> **关联**：
> - 调研报告：见本文档 §1
> - 参考：Kun-master `src/renderer/src/components/chat/Sidebar.tsx`
> - 历史：v1.3.0 已完成 Chat 退役 + Ask 档位统一 Composer（详见 `docs/plans/2026-06-13-ask-mode-unification-design.md`）

---

## 0. TL;DR

**当前问题**：Ask 模式和 Agent 模式在同一会话内可任意切换，但底层是两套独立存储（`ask.jsonl` vs SDK `jsonl`），互不可见。UI 合并展示时间线，用户误以为"AI 记得之前对话"，实际不记得——设计歧义。

**修复方向**：借鉴 Kun-master，把 Ask 从"会话内档位"提升为"会话类型"。一个会话创建时就确定是 Ask 会话还是 Agent 会话，**不可切换**。升级走"新建 Agent 会话 + 上下文继承"。

**预估成本**：3-5 天（含数据迁移 + 测试）

---

## 1. 现状调研

### 1.1 数据层

| 项 | 路径 | 说明 |
|---|---|---|
| AskMessage 类型 | `packages/shared/src/types/ask.ts:29-52` | 与 ChatMessage 平行但更轻量 |
| 存储路径 | `{agentSessionId}.ask.jsonl` | 与 SDK JSONL 并列，**同一 sessionId** |
| ask-message-store | `apps/electron/src/main/lib/ask-message-store.ts:20-94` | JSONL append/rewrite/delete |
| 历史聚合 | `ask-service.ts:78-98` `collectAskHistory` | 读 SDK 摘要 + 最近 1 轮 ask，拼成 history |

**关键问题**：Ask 消息和 SDK 消息**共用 sessionId**，在同一会话内共存，但 SDK orchestrator/resume 完全看不到 `ask.jsonl`——Ask 上下文不进 Agent，Agent 上下文只是"摘要"进 Ask。

### 1.2 IPC 通道

- `packages/shared/src/types/ask.ts:162-187` — `ASK_IPC_CHANNELS` 共 11 个
- `apps/electron/src/main/ipc.ts:4305-4367` — handler 全部在此
- `SET_COMPOSER_MODE`（4356-4367）只写 `meta.lastComposerMode`，**不创建新会话**

### 1.3 服务层

- `ask-service.ts:131-457` — `sendAskMessage` 全流程
- `ask-tool-policy.ts:94-113` — `getAskEnabledTools` 当前只返回 `suggest_agent_switch` 一个工具
- `ask-prompt-builder.ts:27-62` — `ASK_PERMISSION_CONTRACT` 静态契约 + 最近 20 轮 SDK 历史摘要

### 1.4 渲染层

- `AgentView.tsx:1690-1713` — `composerMode === 'ask'` 分支：禁附件 + 启发式检测 + `performAskSend`
- `AgentMessages.tsx:760-816` — `mergedTimeline` 按 createdAt 合并 SDK group 与 Ask 消息（**视觉合并，逻辑隔离**）
- `ComposerModeSelector.tsx:41-69` — 单按钮 toggle，乐观更新 + IPC `setComposerMode`
- `AgentSwitchBanner.tsx:32-141` — 同会话升级：清 suggestion → setComposerMode('agent') → 预填 draft
- `ask-heuristic.ts:103-134` — `isLikelyAgentIntent` 字面关键词匹配

### 1.5 会话元数据

- `AgentSessionMeta.lastComposerMode?: ComposerMode`（`agent.ts:794`）
- `createAgentSession` **不预设** `lastComposerMode`（`agent-session-manager.ts:126-143`），由 `GET_COMPOSER_MODE` handler 回落到 `DEFAULT_COMPOSER_MODE = 'agent'`

### 1.6 侧边栏

- `LeftSidebar.tsx:82, 1335-1990` — 会话按 workspace + pinned 分组
- **完全不区分 Ask/Agent 会话**（grep 确认无 composerMode 引用）
- `AgentProjectGroupItem` 也不读 composer 模式

### 1.7 Kun-master 对比

| 维度 | Kun | TAgent 当前 |
|---|---|---|
| 侧边栏分区 | `SidebarProjectsSection` + `SidebarConversationsSection` 两段 | 单段项目分组 |
| 工作区根 | `conversationWorkspaceRoot` vs `codeWorkspaceRoots` 物理隔离 | 单一 workspaceRoot |
| 模式切换 | `WorkspaceModeTabs` 切 code/write/design（看哪个工作区） | `ComposerModeSelector` 同会话切 ask/agent |
| 会话类型 | 一个 thread 要么是对话要么是 Agent 会话 | 同会话可切换 |
| 数据隔离 | 物理（不同 workspaceRoot） | 逻辑（同 sessionId 双存储） |

**结论**：Kun 是多工作区物理隔离，TAgent 是单会话内 per-session composerMode。两者架构正交。**本设计采纳 Kun 的物理隔离思路**。

---

## 2. 问题与目标

### 2.1 当前问题清单

1. **上下文不连续**：Ask 模式问 5 轮 → 切 Agent，Agent 看不到这 5 轮（`collectAskHistory` 只取最近 1 轮 ask 作为摘要）
2. **视觉歧义**：`mergedTimeline` 把两类消息合并在一个时间线展示，用户以为连续
3. **升级路径混乱**：`AgentSwitchBanner` 同会话切 Agent，但 Ask 上下文丢失；`AgentRecommendBanner` 走跨会话（创建新会话），两套逻辑并存
4. **会话元数据冗余**：`lastComposerMode` 字段记录"上次档位"，但会话本身没有"类型"概念
5. **侧边栏无区分**：Ask 会话和 Agent 会话混在同一列表，用户找不到"我刚问的那个问题"

### 2.2 目标

- **会话类型在创建时确定**：Ask 会话或 Agent 会话，二选一，不可切换
- **数据物理隔离**：Ask 会话只有 `ask.jsonl`，Agent 会话只有 SDK `jsonl`
- **侧边栏视觉区分**：Ask 会话和 Agent 会话在不同分组或带不同标识
- **升级走新建会话**：Ask 想升级 → 新建 Agent 会话 + 继承上下文（用户可选择是否带上 Ask 历史）
- **保留单会话切换的"快捷"路径**（可选）：通过 `AgentSwitchBanner` 同会话切换的旧路径作为"快捷升级"，**但明确告知用户上下文不继承**

### 2.3 非目标

- 不改 Ask 的工具白名单（仍只有 `suggest_agent_switch`）
- 不改 Ask 的 system prompt 契约
- 不改 Agent 的 SDK 编排逻辑
- 不实现联网搜索 / 记忆等 P1+ 功能（保持占位）

---

## 3. 设计方案

### 3.1 核心概念：会话类型 `sessionType`

引入新字段 `AgentSessionMeta.sessionType: 'ask' | 'agent'`，**创建时确定，不可变**。

```typescript
// packages/shared/src/types/agent.ts
export interface AgentSessionMeta {
  // ... 现有字段
  /** 会话类型，创建时确定，不可变。旧会话无此字段视为 'agent' */
  sessionType?: 'ask' | 'agent'
  /** 兼容字段：旧 lastComposerMode，迁移后废弃 */
  lastComposerMode?: ComposerMode  // 标记 @deprecated
}
```

**迁移规则**：
- 旧会话无 `sessionType` → 视为 `'agent'`（默认）
- 旧会话有 `lastComposerMode === 'ask'` 且无 `ask.jsonl` → 视为 `'agent'`（清理脏数据）
- 旧会话有 `lastComposerMode === 'ask'` 且有 `ask.jsonl` → 视为 `'ask'`

### 3.2 创建会话入口

| 入口 | sessionType | 说明 |
|---|---|---|
| 侧边栏"新建 Agent 会话"按钮 | `'agent'` | 现有行为 |
| 侧边栏"新建对话"按钮（新增） | `'ask'` | 新入口，不绑定项目 |
| Ask 会话升级到 Agent | `'agent'` | 新建会话，继承上下文 |
| 工作区下"新建会话" | `'agent'` | 默认 Agent，绑定项目 |

**新建对话按钮位置**：
- 侧边栏顶部"新建"按钮拆成两个：`新建 Agent 会话`（Plus 图标）+ `新建对话`（MessageSquare 图标）
- 或在"新建"按钮上加 Popover 让用户选类型

### 3.3 Ask 会话不绑定项目

Ask 会话的设计目的就是"纯对话"，不需要项目目录。

- `createAgentSession` 接收 `sessionType` 参数
- Ask 会话的 `workspaceSlug` 可选（不绑定项目）
- 侧边栏 Ask 会话归到"对话"分组（不挂项目下）

### 3.4 侧边栏重构

参考 Kun-master，侧边栏分两段：

```
侧边栏
├── 顶部：新建按钮（Agent 会话 / 对话）
├── 对话区（Ask 会话）
│   ├── 全部对话（不绑项目的 Ask 会话）
│   └── 项目下的对话（绑项目的 Ask 会话，可选）
└── 项目区（Agent 会话）
    ├── 项目 A
    │   ├── Agent 会话 1
    │   └── Agent 会话 2
    └── 项目 B
        └── Agent 会话 3
```

**简化版**（推荐，改动小）：
- 不分两段，会话列表统一展示
- Ask 会话用 MessageSquare 图标 + "对话"标签区分
- Agent 会话用 Bot 图标
- Ask 会话不挂项目分组（平铺在顶部"对话"分组下）

### 3.5 取消同会话模式切换

- `ComposerModeSelector` 组件**移除**（Ask 会话和 Agent 会话都不需要切换按钮）
- `setComposerMode` IPC 标记 `@deprecated`，保留兼容但不再调用
- `lastComposerMode` 字段保留但不再写入（旧数据用于迁移判断）

### 3.6 升级流程：Ask → Agent

**新流程**（参考现有 `AgentRecommendBanner` 跨会话升级）：

1. Ask 会话中，模型调 `suggest_agent_switch` 工具 → 弹 `AgentSwitchBanner`
2. 用户点"切换到 Agent" → **新建 Agent 会话**
3. 弹"继承上下文"确认框：
   - "带上 Ask 对话历史作为初始消息"（默认勾选）
   - "不带历史，从空白开始"
4. 创建新 Agent 会话：
   - `sessionType: 'agent'`
   - `workspaceSlug`: 继承 Ask 会话的项目（如果有）
   - 初始消息：把 Ask 历史摘要作为 user message 注入（或只把最后一条 user 消息传过去）
5. 切换到新会话 tab

**保留同会话切换的"快捷升级"路径**（可选，默认关闭）：
- 设置页加开关"允许同会话切换 Ask/Agent（不继承上下文）"
- 默认关闭，高级用户可开启
- 开启后 `ComposerModeSelector` 重新可见

### 3.7 数据迁移

**迁移脚本**（一次性，启动时检测）：
- `apps/electron/src/main/lib/session-type-migrator.ts`（新增）
- 启动时扫描所有会话，按 §3.1 规则填充 `sessionType`
- 写回 `agent-sessions.json` 索引

**旧 Ask 会话的处理**：
- 有 `ask.jsonl` 的会话 → 标记为 `sessionType: 'ask'`
- 同时有 SDK `jsonl` 和 `ask.jsonl` 的会话（用户切过模式）→ 标记为 `'agent'`（保留 SDK 消息），Ask 消息归档到 `archive/` 子目录

---

## 4. 改动清单

### 4.1 类型与共享

**`packages/shared/src/types/agent.ts`**
- `AgentSessionMeta` 加 `sessionType?: 'ask' | 'agent'`
- `lastComposerMode` 标记 `@deprecated`

**`packages/shared/src/types/ask.ts`**
- `ComposerMode` 类型保留（兼容），但 `DEFAULT_COMPOSER_MODE` 改为只在新建 Ask 会话时用
- `ASK_IPC_CHANNELS.SET_COMPOSER_MODE` / `GET_COMPOSER_MODE` 标记 `@deprecated`

### 4.2 主进程

**`apps/electron/src/main/lib/agent-session-manager.ts`**
- `createAgentSession` 接收 `sessionType: 'ask' | 'agent'` 参数
- 写入 `meta.sessionType`
- 不再写 `lastComposerMode`

**`apps/electron/src/main/lib/session-type-migrator.ts`**（新增）
- 启动时迁移旧会话的 `sessionType`

**`apps/electron/src/main/ipc.ts`**
- `SET_COMPOSER_MODE` handler 保留但标记废弃，记 warn 日志
- `GET_COMPOSER_MODE` 改为读 `meta.sessionType`，映射到 `ComposerMode`（兼容前端）

**`apps/electron/src/main/lib/ask-service.ts`**
- `sendAskMessage` 增加前置检查：`meta.sessionType === 'ask'` 才允许，否则拒绝
- `collectAskHistory` 不再读 SDK 摘要（Ask 会话不应该有 SDK 消息）

### 4.3 Preload

**`apps/electron/src/preload/index.ts`**
- `createAgentSession` API 接收 `sessionType` 参数
- `setComposerMode` / `getComposerMode` 保留但标记废弃

### 4.4 渲染层

**`apps/electron/src/renderer/atoms/agent-atoms.ts`**
- 新增 `sessionTypeMapAtom`（sessionId → sessionType）
- `createSession` action 接收 `sessionType`

**`apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx`**
- 会话列表区分 Ask 会话和 Agent 会话
- 顶部"新建"按钮拆成"新建 Agent 会话"+"新建对话"

**`apps/electron/src/renderer/components/agent/AgentView.tsx`**
- 移除 `composerMode === 'ask'` 分支，改为 `sessionType === 'ask'` 判断
- 移除 `ComposerModeSelector` 组件挂载
- Ask 会话不渲染权限模式选择器、附件按钮（保留只读展示）

**`apps/electron/src/renderer/components/agent/AgentMessages.tsx`**
- `mergedTimeline` 移除 Ask 消息合并逻辑（Ask 会话只展示 Ask 消息，Agent 会话只展示 SDK 消息）
- 简化为单类型 timeline

**`apps/electron/src/renderer/components/agent/ComposerModeSelector.tsx`**
- **删除**（或保留为废弃组件，后续清理）

**`apps/electron/src/renderer/components/agent/AgentSwitchBanner.tsx`**
- 改为"新建 Agent 会话"流程（不再同会话切换）
- 弹"继承上下文"确认框

**`apps/electron/src/renderer/components/agent/AgentRecommendBanner.tsx`**
- 与 `AgentSwitchBanner` 合并，统一升级路径

### 4.5 数据迁移

**`apps/electron/src/main/lib/session-type-migrator.ts`**（新增）
- 扫描所有会话，按 §3.1 规则填充 `sessionType`
- 启动时 `app.whenReady` 后调用一次

---

## 5. UI/UX 设计

### 5.1 侧边栏布局

```
┌─────────────────────────────┐
│ [+ 新建 Agent 会话]          │
│ [+ 新建对话]                 │
├─────────────────────────────┤
│ 💬 对话                      │  ← Ask 会话分组
│   ├─ 关于 React 的问题        │
│   ├─ 翻译一段中文             │
│   └─ 讨论 API 设计            │
├─────────────────────────────┤
│ 📁 项目: TAgent_General      │  ← Agent 会话分组
│   ├─ 修复附件卡片抖动         │
│   ├─ 实现 FTS5 搜索           │
│   └─ 重构权限服务             │
└─────────────────────────────┘
```

- Ask 会话用 MessageSquare 图标
- Agent 会话用 Bot 图标
- Ask 会话默认不绑项目（平铺在"对话"分组下）
- 用户也可以在项目下创建 Ask 会话（罕见场景）

### 5.2 Ask 会话视图

- 不渲染 `ComposerModeSelector`（无切换按钮）
- 不渲染 `PermissionModeSelector`（Ask 无权限概念）
- 不渲染附件按钮（Ask 暂不支持附件，P1 完善）
- 输入框 placeholder："提问或讨论问题（不修改文件，不执行命令）"
- 顶部可加一个"对话"标签徽章，提示这是 Ask 会话

### 5.3 升级流程 UI

```
Ask 会话中，模型调 suggest_agent_switch
  ↓
顶部弹横幅："建议切换到 Agent 模式"
  ├─ [切换到 Agent] → 弹确认框
  │   ├─ ☑ 带上对话历史作为初始消息
  │   └─ [继续] [取消]
  ├─ [继续在 Ask 模式]
  └─ [关闭]
```

切换后：
- 创建新 Agent 会话
- 如果勾选"带上对话历史"，把 Ask 历史最后 N 轮拼成 user message 注入
- 切换到新会话 tab
- 原 Ask 会话保留在"对话"分组下

---

## 6. 实施步骤

### 6.1 Phase 1：类型与数据层（1 天）

1. `AgentSessionMeta` 加 `sessionType` 字段
2. `createAgentSession` 接收 `sessionType` 参数
3. 写 `session-type-migrator.ts`，启动时迁移旧会话
4. 单元测试覆盖迁移逻辑

### 6.2 Phase 2：主进程改造（1 天）

1. `ask-service.sendAskMessage` 加 `sessionType === 'ask'` 前置检查
2. `collectAskHistory` 移除 SDK 摘要读取
3. `SET_COMPOSER_MODE` / `GET_COMPOSER_MODE` 标记废弃
4. IPC 测试

### 6.3 Phase 3：渲染层改造（1.5 天）

1. 新增 `sessionTypeMapAtom`
2. `LeftSidebar` 区分 Ask / Agent 会话，"新建"按钮拆分
3. `AgentView` 用 `sessionType` 替代 `composerMode` 判断
4. `AgentMessages` 简化 timeline（移除合并逻辑）
5. 删除 `ComposerModeSelector`（或隐藏）

### 6.4 Phase 4：升级流程重构（0.5 天）

1. `AgentSwitchBanner` 改为新建会话流程
2. 加"继承上下文"确认框
3. 合并 `AgentRecommendBanner` 逻辑

### 6.5 Phase 5：测试与打磨（1 天）

1. E2E 测试：新建 Ask / Agent 会话、升级流程、迁移旧会话
2. 视觉抽查：侧边栏分组、图标、徽章
3. typecheck + lint + format
4. 文档更新：CLAUDE.md / PROGRESS.md

**总成本**：约 5 天

---

## 7. 风险与依赖

### 7.1 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| 旧会话迁移误判 | 用户看到的会话类型不对 | 迁移规则保守（默认 agent），加日志可追溯 |
| 升级流程用户习惯改变 | 老用户找不到同会话切换 | 设置页保留"同会话切换"开关（默认关） |
| Ask 会话不绑项目 | 侧边栏分组逻辑变化 | 简化版：Ask 会话平铺在"对话"分组 |
| `mergedTimeline` 简化 | 旧混合会话展示不全 | 迁移时归档混合会话的 Ask 部分 |

### 7.2 依赖

- 无外部依赖
- 不影响 SDK 升级（v0.13.4 已合入）
- 不影响看板 / Automation / 协作 Bridge

---

## 8. 验收标准

### 8.1 BDD 场景

```gherkin
Feature: Ask 会话与 Agent 会话隔离

  Scenario: 新建 Ask 会话
    Given 用户在侧边栏点"新建对话"
    When 创建会话
    Then 会话 meta.sessionType === 'ask'
    And 会话出现在"对话"分组下
    And 输入框无 ComposerModeSelector 切换按钮
    And 输入框无 PermissionModeSelector
    And Ask 会话只展示 ask.jsonl 消息

  Scenario: 新建 Agent 会话
    Given 用户在侧边栏点"新建 Agent 会话"
    When 创建会话
    Then 会话 meta.sessionType === 'agent'
    And 会话出现在项目分组下
    And 输入框有 PermissionModeSelector

  Scenario: Ask 升级到 Agent
    Given 一个 Ask 会话
    When 模型调 suggest_agent_switch
    Then 顶部弹"建议切换到 Agent"横幅
    When 用户点"切换到 Agent"
    Then 弹"继承上下文"确认框
    When 用户勾选"带上对话历史"并继续
    Then 新建一个 Agent 会话
    And 新会话的初始消息包含 Ask 历史摘要
    And 切换到新会话 tab
    And 原 Ask 会话保留在"对话"分组

  Scenario: 旧会话迁移
    Given 一个旧会话无 sessionType 字段
    When 应用启动
    Then 迁移脚本扫描该会话
    And 根据 ask.jsonl 存在性填充 sessionType
    And 写回 agent-sessions.json

  Scenario: 同会话切换已废弃
    Given 一个 Ask 会话
    Then 输入框无 ComposerModeSelector
    And 调用 setComposerMode IPC 返回废弃警告
```

### 8.2 验证步骤

1. `bun run typecheck` 4 包全过
2. `bun test` 覆盖迁移逻辑、sessionType 判断
3. 手动验证：
   - 新建 Ask 会话 → 在"对话"分组
   - 新建 Agent 会话 → 在项目分组
   - Ask 会话无切换按钮
   - 升级流程弹确认框 + 新建会话
   - 旧会话迁移后类型正确
4. CI 全绿

---

## 9. 不在本次范围

- Ask 模式支持附件（P1 完善，单独 issue）
- Ask 模式联网搜索 / 记忆工具（P1+，单独 issue）
- 同会话切换开关的设置项（默认关闭，后续按用户反馈加）
- `ComposerModeSelector` 组件的彻底删除（先隐藏，下个大版本清理）

---

## 10. 后续规划

- v1.5：Ask 模式支持附件 + 联网搜索
- v1.6：Ask 会话归档 / 搜索
- v2.0：彻底移除 `lastComposerMode` / `ComposerModeSelector` / `setComposerMode` IPC

---

**文档状态**：Draft v1.0，等待评审。
