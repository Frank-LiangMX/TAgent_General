# TAgent 协作子会话（Collaboration）系统设计文档

> **状态**：Draft v0.1  
> **日期**：2026-06-24  
> **目标**：让用户能看到 Agent 在主会话中委派的子 Agent，形成可视化、可继续、可审计的协作体验  
> **关联**：[`2026-06-24-upstream-feature-roadmap.md`](2026-06-24-upstream-feature-roadmap.md) §2.3、[`2026-06-24-automation-design.md`](2026-06-24-automation-design.md) §12.1  
> **上游基线**：proma-ai/Proma #888 / #901 / #745 / #898  
> **分支建议**：`feature/collaboration-agents`

---

## 0. Handoff 摘要

**你要做什么**：在 TAgent Desktop 中实现协作子会话体系——主 Agent 在执行任务时可以委派子 Agent 跑独立子任务，子 Agent 在侧边栏可见、可继续、可回溯。

**核心参考**：

- 上游 Proma #888（visible agent delegation via built-in MCP）
- 上游 Proma #901（blocked event bubbling, continue delegation, GitBranch icon）
- 上游 Proma #898（自动任务会话归类到专属虚拟项目组）
- 上游 Proma #745（后台任务完成时自动唤醒 idle Agent）

**不要做的事**：

- 不要复用 `automation-` 命名空间（虽然有部分复用，但概念上独立）
- 不要让子会话污染父会话的 JSONL 历史
- 不要让协作机制跨模式（v1 只支持 general 模式内部协作）

---

## 1. 背景与目标

### 1.1 现状

TAgent 当前 `claude-agent-adapter.ts` 通过 Claude Agent SDK 跑会话，但：

- 没有 MCP 工具暴露协作能力
- 子 Agent 不可见
- 后台任务与前台会话解耦不清晰

Proma 在 #888 后实现了 `delegate_agent` / `delegate_agents` MCP 工具，配合 `list_delegations` / `get_delegation_results` / `continue_delegation` / `wait_for_delegations` / `answer_delegation_question` / `stop_delegation` 形成完整闭环。

### 1.2 用户价值

让用户感知到：

1. 主 Agent 在跑一个复杂任务时，会自动拆分给多个子 Agent 并行处理
2. 用户可以在侧边栏看到所有正在跑的子 Agent 及其进度
3. 子 Agent 完成时，主 Agent 继续工作（自动唤醒）
4. 用户可以主动介入某个子 Agent、回答它的问题、停止它
5. 整个协作过程形成可审计的 delegation 链

### 1.3 非目标

第一阶段不做：

- 跨工作区的协作
- 协作产物的可视化摘要（仅查看子会话流）
- 协作的权限隔离（子 Agent 继承父会话权限）

---

## 2. 设计原则

### 2.1 Visible by default

所有委派的子 Agent 必须默认可见，用户可关闭可见性。

### 2.2 Lossless context

子 Agent 完成时，结果**完整**回流到父 Agent（不是截断）。

### 2.3 Idempotent continue

子 Agent 可以被 `continue_delegation` 继续，多次继续累积上下文而非重置。

### 2.4 本地优先

- delegation 历史存 `~/.tagent[-dev]/delegations.json`
- 子会话仍走标准 SDK JSONL
- 不引入新的协作数据库

### 2.5 模式隔离

- v1 协作只支持 general 模式
- TA 模式会话**不能**作为协作发起方

---

## 3. 数据模型

### 3.1 Delegation（委派）

```typescript
// packages/shared/src/types/delegation.ts
export type DelegationStatus =
  | 'pending'           // 已创建，等待启动
  | 'running'           // 运行中
  | 'waiting-input'     // 等待用户输入（AskUserQuestion）
  | 'waiting-permission' // 等待权限
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export interface Delegation {
  id: string;                        // uuid
  parentSessionId: string;           // 父会话
  childSessionId: string;            // 子会话
  parentTurnId?: string;             // 父 turn 标识
  
  // 任务描述
  task: string;                      // 给子 Agent 的 prompt
  expectedOutput?: string;           // 期望的输出格式
  
  // 元数据
  status: DelegationStatus;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  
  // 结果
  result?: {
    summary: string;
    artifacts?: string[];            // 产物路径
  };
  
  error?: {
    code: string;
    message: string;
  };
  
  // 可见性
  visibility: 'visible' | 'hidden';  // 默认 visible
  
  // 阻塞事件
  blockedEvent?: BlockedEvent;
}

export type BlockedEvent =
  | { kind: 'ask-user-question'; question: AskUserQuestion }
  | { kind: 'permission-request'; tool: string; input: unknown };
```

### 3.2 与上游 Proma MCP 工具对齐

```typescript
// 主 Agent 可调用的 MCP 工具（暴露给 Agent）
const tools = [
  {
    name: 'delegate_agent',
    description: 'Delegate a task to a new background agent session. Returns immediately.',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'The task to delegate' },
        expectedOutput: { type: 'string' },
        visibility: { enum: ['visible', 'hidden'], default: 'visible' },
      },
      required: ['task'],
    },
  },
  {
    name: 'delegate_agents',
    description: 'Delegate multiple tasks to background agents in parallel',
    inputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              task: { type: 'string' },
              expectedOutput: { type: 'string' },
            },
          },
        },
      },
    },
  },
  {
    name: 'list_delegations',
    description: 'List delegations (in-flight and recent)',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_delegation_results',
    description: 'Get results of one or more delegations by ID',
    inputSchema: {
      type: 'object',
      properties: {
        delegationIds: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  {
    name: 'wait_for_delegations',
    description: 'Wait for one or more delegations to complete',
    inputSchema: {
      type: 'object',
      properties: {
        delegationIds: { type: 'array' },
        mode: { enum: ['all', 'any'], default: 'all' },
        timeoutSeconds: { type: 'number', default: 1800 },
      },
    },
  },
  {
    name: 'continue_delegation',
    description: 'Continue a delegation with additional instructions',
    inputSchema: {
      type: 'object',
      properties: {
        delegationId: { type: 'string' },
        message: { type: 'string' },
      },
      required: ['delegationId', 'message'],
    },
  },
  {
    name: 'stop_delegation',
    description: 'Stop a running delegation',
    inputSchema: {
      type: 'object',
      properties: { delegationId: { type: 'string' } },
      required: ['delegationId'],
    },
  },
];
```

### 3.3 持久化

**位置**：`~/.tagent[-dev]/delegations.json`

```typescript
interface DelegationStore {
  version: 1;
  delegations: Delegation[];
}
```

只保留最近 100 条历史 delegation。

---

## 4. 系统架构

### 4.1 模块清单

```
apps/electron/src/main/lib/
├── agent-collaboration-tools.ts        # MCP 工具实现
├── agent-collaboration-utils.ts        # 上下文处理工具
├── agent-headless-runner-registry.ts   # 后台 runner 注册表
├── delegation-manager.ts               # CRUD + 状态机
├── delegation-history-store.ts         # 持久化
└── delegation-notification-service.ts  # 完成时通知父会话

apps/electron/src/renderer/components/collaboration/
├── DelegationPanel.tsx                 # 侧边栏面板
├── DelegationCard.tsx                  # 单卡片
├── DelegationTreeView.tsx              # GitBranch 树形视图
└── DelegationDetailDialog.tsx          # 详情弹窗

apps/electron/src/main/lib/builtin-mcp/
├── catalog.ts                          # 注册 delegation MCP
├── registry.ts                         # 注册表
└── settings.ts                         # MCP 配置
```

### 4.2 Runner Registry

```typescript
// agent-headless-runner-registry.ts
interface RunnerHandle {
  id: string;
  status: DelegationStatus;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  continue: (message: string) => Promise<void>;
  getStatus: () => DelegationStatus;
}

class HeadlessRunnerRegistry {
  private runners = new Map<string, RunnerHandle>();
  private maxConcurrent = 10;
  
  async register(delegation: Delegation): Promise<RunnerHandle> {
    if (this.runners.size >= this.maxConcurrent) {
      throw new Error(`Max concurrent runners reached: ${this.maxConcurrent}`);
    }
    
    const handle = this.createRunner(delegation);
    this.runners.set(delegation.id, handle);
    return handle;
  }
  
  async unregister(id: string): Promise<void> {
    const runner = this.runners.get(id);
    if (runner) {
      await runner.stop();
      this.runners.delete(id);
    }
  }
  
  private createRunner(delegation: Delegation): RunnerHandle {
    return {
      id: delegation.id,
      status: 'pending',
      start: async () => {
        // 启动子 Agent SDK session
        const childSession = await this.agentSessionManager.createSession({
          parentSessionId: delegation.parentSessionId,
          isDelegationChild: true,
        });
        delegation.childSessionId = childSession.id;
        delegation.status = 'running';
        delegation.startedAt = new Date().toISOString();
        
        // 启动后台执行
        await this.executeInBackground(delegation);
      },
      stop: async () => {
        await this.agentSessionManager.stopSession(delegation.childSessionId);
        delegation.status = 'cancelled';
        delegation.finishedAt = new Date().toISOString();
      },
      continue: async (message: string) => {
        await this.agentSessionManager.sendMessage(delegation.childSessionId, message);
      },
      getStatus: () => delegation.status,
    };
  }
}
```

### 4.3 Delegate Agent MCP 工具

```typescript
// agent-collaboration-tools.ts
async function delegateAgent(input: DelegateAgentInput): Promise<DelegateAgentResult> {
  const { task, expectedOutput, visibility = 'visible' } = input;
  
  // 1. 获取父会话
  const parentSession = await getCurrentSession();
  
  // 2. 创建 delegation 记录
  const delegation: Delegation = {
    id: uuid(),
    parentSessionId: parentSession.id,
    childSessionId: '',  // 启动后填入
    task,
    expectedOutput,
    status: 'pending',
    visibility,
    createdAt: new Date().toISOString(),
  };
  
  // 3. 注册 runner
  const runner = await runnerRegistry.register(delegation);
  
  // 4. 启动（异步，不阻塞 MCP 调用）
  runner.start().catch(err => {
    delegation.status = 'failed';
    delegation.error = { code: err.code, message: err.message };
  });
  
  // 5. 持久化
  await historyStore.append(delegation);
  
  // 6. 通知 UI
  eventBus.emit('delegation:created', delegation);
  
  return {
    delegationId: delegation.id,
    status: 'pending',
    message: 'Delegation accepted. Use wait_for_delegations or check delegation_results later.',
  };
}
```

### 4.4 阻塞事件传递

```typescript
// delegation-manager.ts
async handleBlockedEvent(delegationId: string, event: BlockedEvent): Promise<void> {
  const delegation = await this.get(delegationId);
  delegation.status = event.kind === 'ask-user-question' ? 'waiting-input' : 'waiting-permission';
  delegation.blockedEvent = event;
  
  // 冒泡到父会话
  const parentSession = await this.agentSessionManager.getSession(delegation.parentSessionId);
  if (parentSession.status === 'idle') {
    // 父会话空闲：自动唤醒
    await this.wakeParent(delegation);
  } else {
    // 父会话活跃：排队通知
    this.notificationService.notifyParent(delegation);
  }
  
  await this.persist(delegation);
}

async wakeParent(delegation: Delegation): Promise<void> {
  const parentSession = await this.agentSessionManager.getSession(delegation.parentSessionId);
  await this.agentSessionManager.sendMessage(
    parentSession.id,
    `[子 Agent ${delegation.id} 等待输入] ${formatBlockedEvent(delegation.blockedEvent)}`
  );
}
```

---

## 5. UI 设计

### 5.1 入口

侧边栏 Agent 项目下新增「协作者」分组：

```
左侧会话列表：
  ▼ General
    • 主会话 A
    • 主会话 B
  ▼ 协作者（2）
    • 🔀 子任务: 整理文档结构    [running]
    • 🔀 子任务: 搜索相关 issue   [waiting-input]
  ▼ TA 模式
    • 材质检查会话
```

### 5.2 Delegation Panel

```
┌──────────────────────────────────────────────────────────┐
│  协作子会话                                       [刷新] │
├──────────────────────────────────────────────────────────┤
│  🔀 整理文档结构                          [succeeded] 1m  │
│  📋 任务：扫描 docs/ 目录，重命名所有 .md 文件...       │
│  📊 结果：已重命名 47 个文件                              │
│  [查看详情] [查看子会话]                                  │
│                                                          │
│  🔀 搜索相关 issue                      [waiting-input]   │
│  📋 任务：在 GitHub 搜索 tagent 标签的 open issue...    │
│  ❓ 等待输入：选择搜索关键词 [A] [B] [C]                  │
│  [回答] [停止] [查看子会话]                              │
└──────────────────────────────────────────────────────────┘
```

### 5.3 树形视图（GitBranch icon）

```
主会话 A
  ├─ 🔀 整理文档结构       [succeeded]
  │    └─ 💬 1 turn, 0.5K tokens
  └─ 🔀 搜索相关 issue      [waiting-input]
       └─ ❓ 等待用户回答
```

### 5.4 详情弹窗

- 完整任务描述
- 全部子会话消息
- 持续追问历史
- 中止 / 继续操作

---

## 6. 与 Automation 的协作

### 6.1 区别

| 维度 | Automation | Collaboration |
|---|---|---|
| 触发方 | 后台调度器（系统） | 主 Agent（MCP 工具） |
| 用户预期 | "我配置了任务" | "Agent 在拆解任务" |
| 持久化 | `automations.json` | `delegations.json` |
| 会话命名 | `automation-{id}-{runId}` | `delegation-{id}` |
| UI 分组 | 「自动任务」按钮 | 「协作者」侧边栏分组 |
| 可见性 | 默认可见 | 默认可见 |

### 6.2 共用基础

两者共用：

- `agent-session-manager.ts` 创建会话
- `context-usage-cache.ts` 查询占用
- `feishu-bridge.ts` 通知
- MCP 工具注册框架（`builtin-mcp/`）

### 6.3 自动任务会话归类

当 Automation 任务的 session 被创建时，`session.projectId` 设为 `__automation__`，UI 把这些会话归到专属虚拟项目组（#898）。

```typescript
// automation-runner.ts
async createAutomationSession(automation: Automation): Promise<string> {
  const session = await this.agentSessionManager.createSession({
    name: `自动化: ${automation.name}`,
    mode: 'general',
    projectId: '__automation__',  // 🆕 专属虚拟项目
    isAutomationChild: true,
  });
  return session.id;
}
```

---

## 7. 与 Bridge 的协作

### 7.1 后台任务完成时唤醒父会话

```typescript
// delegation-notification-service.ts
async onDelegationFinished(delegation: Delegation): Promise<void> {
  // 1. 通知 UI
  this.eventBus.emit('delegation:finished', delegation);
  
  // 2. 检查父会话状态
  const parentSession = await this.agentSessionManager.getSession(delegation.parentSessionId);
  
  if (parentSession.status === 'idle') {
    // 🆕 父会话空闲：自动唤醒（#745）
    await this.wakeParentWithResult(delegation);
  }
  
  // 3. 可选：飞书通知
  if (delegation.visibility === 'visible') {
    await this.feishuNotification.send(delegation);
  }
}

async wakeParentWithResult(delegation: Delegation): Promise<void> {
  const summary = formatDelegationResult(delegation);
  await this.agentSessionManager.sendMessage(
    delegation.parentSessionId,
    `[子 Agent ${delegation.id} 已完成]\n${summary}`
  );
}
```

### 7.2 飞书通知

复用 `feishu-bridge.ts` 的 sendMessage：

```typescript
async send(delegation: Delegation): Promise<void> {
  const parentSession = await this.agentSessionManager.getSession(delegation.parentSessionId);
  const markdown = formatDelegationForBridge(delegation);
  await this.feishuBridge.sendMessage({
    chatId: parentSession.originChatId,  // 🆕 从父会话继承
    content: markdown,
    contentType: 'markdown',
  });
}
```

---

## 8. 后台任务自动唤醒（#745）

```typescript
// apps/electron/src/main/lib/agent-task-monitor.ts
class AgentTaskMonitor {
  private idleSessions = new Set<string>();
  
  registerIdle(sessionId: string): void {
    this.idleSessions.add(sessionId);
  }
  
  unregisterIdle(sessionId: string): void {
    this.idleSessions.delete(sessionId);
  }
  
  async onTaskCompleted(task: { ownerSessionId: string }): Promise<void> {
    if (this.idleSessions.has(task.ownerSessionId)) {
      // 🆕 后台任务完成时唤醒 idle 父会话
      await this.agentSessionManager.sendMessage(
        task.ownerSessionId,
        `[后台任务已完成] ${task.summary}`
      );
    }
  }
}
```

---

## 9. 里程碑

### M1：核心 MCP 工具

**交付物**：

- `delegate_agent` / `delegate_agents` / `list_delegations` / `get_delegation_results` / `wait_for_delegations` / `continue_delegation` / `stop_delegation` 全部 MCP 工具
- `HeadlessRunnerRegistry` 后台 runner
- `delegations.json` 持久化

**验收**：

- 主 Agent 可通过 MCP 创建委派
- 并发委派正常运行
- 历史正确保存

### M2：UI 集成

**交付物**：

- 侧边栏协作者分组
- Delegation Panel
- GitBranch 树形视图
- 详情弹窗

**验收**：

- 委派可视、可继续、可中止
- 状态实时更新
- 阻塞事件可视化

### M3：与 Automation / Bridge 集成

**交付物**：

- Automation 任务归类到虚拟项目
- 后台任务完成时唤醒父会话
- 飞书通知可选

**验收**：

- Automation 会话在 UI 中正确分组
- 后台任务完成触发父会话继续
- 飞书通知按预期工作

### M4：阻塞事件冒泡

**交付物**：

- `handleBlockedEvent` 状态机
- 父会话空闲时自动唤醒
- 父会话活跃时排队通知
- `answer_delegation_question` 用户回答工具

**验收**：

- 子 Agent 等待输入时，父会话被唤醒并展示问题
- 用户回答后子 Agent 继续
- 权限请求冒泡工作

---

## 10. 风险与应对

| 风险 | 应对 |
|---|---|
| 资源泄漏（runner 不释放） | Registry 统一管理；退出清理；超时机制 |
| 上下文失控（递归委派） | 限制委派深度（最多 3 层）；token 上限 |
| 父会话唤醒风暴 | 批量唤醒；防抖 |
| 飞书通知被滥用 | 默认仅系统通知；显式开启才发送 |
| 子会话污染父会话 JSONL | `isDelegationChild: true` 标记；独立路径 |

---

## 11. 测试要求

### 11.1 必做单测

- `delegateAgent` 创建委派流程
- `waitForDelegations` 模式：all / any
- `continueDelegation` 上下文累积
- `stopDelegation` 状态机
- 阻塞事件冒泡
- 树形视图构建

### 11.2 集成测试

- 主 Agent 创建 3 个委派 → 并行执行 → 全部完成
- 子 Agent 等待输入 → 父会话被唤醒 → 用户回答 → 子 Agent 继续
- 子 Agent 中止 → 状态正确更新

### 11.3 端到端手工

- 在主会话输入「帮我并行搜索 A 和 B」→ 看到 2 个子 Agent 在协作者分组
- 子 Agent 完成 → 主会话自动继续
- 点击子 Agent → 看到完整消息流

---

## 12. 完成定义（DoD）

- 7 个 MCP 工具全部可用且测试通过
- UI 协作者分组可见、可交互
- 后台任务自动唤醒工作
- 飞书通知真实发送过至少一次
- 文档已更新（PROGRESS.md + CHANGELOG.md）
- 性能：并发 10 个委派时主进程 CPU 占用 < 5%

---

## 13. 相关文档

- [`2026-06-24-upstream-feature-roadmap.md`](2026-06-24-upstream-feature-roadmap.md) — 总路线图
- [`2026-06-24-automation-design.md`](2026-06-24-automation-design.md) — Automation 设计（共用基础）
- [`2026-06-24-p0-stability-patches.md`](2026-06-24-p0-stability-patches.md) — P0 稳定性
- [`2026-06-13-context-usage-breakdown-design.md`](2026-06-13-context-usage-breakdown-design.md) — Context 用量
- [`proactive-scheduler-monitor-design.md`](../../proactive-scheduler-monitor-design.md) — 旧 proactive 设计
- [`CLAUDE.md`](../../../CLAUDE.md) — 项目级约束