# TAgent Automation 系统设计文档

> **状态**：Draft v0.1  
> **日期**：2026-06-24  
> **目标**：实现完整的定时任务（Automation）系统，让 TAgent 进入「proactive Agent」阶段  
> **关联**：[`2026-06-24-upstream-feature-roadmap.md`](2026-06-24-upstream-feature-roadmap.md) §2.2、[`2026-06-16-upstream-upgrade-issues.md`](2026-06-16-upstream-upgrade-issues.md) Issue B/C/D/E、[`2026-06-16-upstream-upgrade-plan.md`](2026-06-16-upstream-upgrade-plan.md) M2/M3  
> **上游基线**：proma-ai/Proma v0.12.0 ~ v0.13.3  
> **分支建议**：`feature/automation-scheduler`（按子任务拆分）

---

## 0. Handoff 摘要

**你要做什么**：在 TAgent Desktop 中实现完整的 Automation 系统——用户能创建"每天帮我整理今天的会话"这类定时任务，由 TAgent 周期性自动执行。

**核心参考**：

- 上游 Proma v0.12.0 起的 Automation 系统（30s tick、失败退避、Markdown 编辑器、飞书通知）
- `docs/proactive-scheduler-monitor-design.md`（本地已写过的 proactive 设计探索）
- `docs/plans/2026-06-16-upstream-upgrade-plan.md` §M2/M3

**不要做的事**：

- 不要照搬 `~/.proma/automations.json`，统一用 `~/.tagent[-dev]/automations.json`
- 不要用 SQLite 存储 Automation 数据（CLAUDE.md 规定本地优先 JSON）
- 不要让 Automation 跨模式影响 TA 模式会话
- 不要引入云端 always-on agent（v0.13.3 也明确不做）

---

## 1. 背景与目标

### 1.1 现状

TAgent 当前的会话机制是「用户发起一次对话 → Agent 执行 → 结束」。即便有 `/btw` 旁注、上下文压缩、跨重启持久化等能力，仍是被动响应模式。

Proma v0.12.0 起的核心愿景是让 Agent **主动**关注、定期整理、持续跟进——这正是「proactive Agent」的含义。

### 1.2 目标用户价值

TAgent 应该让用户感知到：

1. TAgent 可以记住长期偏好和纠正
2. TAgent 可以定期整理日常对话和工作上下文
3. TAgent 可以在任务、文件变化、会话状态变化时主动跟进
4. TAgent 会解释为什么推荐某个主动功能，并让用户确认、调整、撤销
5. TAgent 的主动能力是**可审计、可暂停、可限制权限**的，不是黑盒自动化

### 1.3 非目标（第一阶段不做）

- 通用复杂 Cron 表达式编辑器
- 云端 always-on agent
- 无需用户授权的自动写文件、自动执行 Bash、自动发消息
- 完整插件市场
- 跨设备常驻执行
- **TA 模式专属定时任务**（v1 阶段只支持 general 模式）

---

## 2. 设计原则

### 2.1 Natural language first

主入口是自然语言：

- "每天晚上帮我整理今天的会话"
- "下周一提醒我继续这个任务"
- "如果 CI 失败，帮我分析原因"

TAgent 把自然语言转成可确认的 schedule。

### 2.2 Visible automation

主动任务必须可见：

- 为什么创建
- 什么时候运行
- 会读取什么
- 会修改什么
- 上次结果是什么
- 失败原因是什么
- 如何暂停、删除、调整

### 2.3 Least agency

默认只读。写入、执行命令、联网、通知外部系统都需要明确权限边界。

### 2.4 本地优先

- 持久化用 `~/.tagent[-dev]/automations.json`
- 通知默认走系统通知 + 可选飞书
- 不引入新数据库方案

### 2.5 模式隔离

- Automation 任务默认属于 general 模式
- 跨模式时**必须**显式声明
- TA 模式会话**不**自动接 Automation 通知

---

## 3. 数据模型

### 3.1 Automation（任务定义）

```typescript
// packages/shared/src/types/automation.ts
export type ScheduleType = 'interval' | 'daily' | 'weekly' | 'monthly' | 'once';

export interface Automation {
  id: string;                          // uuid v4
  name: string;                        // 用户友好名称
  description?: string;                // 自然语言描述
  mode: 'general';                     // v1 固定 general
  
  // 调度配置
  schedule: ScheduleConfig;
  
  // 执行配置
  prompt: string;                      // 触发时发送给 Agent 的指令
  sessionRef?: {                       // 可选：关联到现有会话
    sessionId: string;
    projectId?: string;
  };
  
  // 元数据
  enabled: boolean;                    // 启用/暂停
  maxRuns?: number;                    // 运行次数上限
  runCount: number;                    // 已运行次数（成功 + 失败）
  consecutiveFailures: number;         // 连续失败次数
  
  // 时间戳
  createdAt: string;                   // ISO 8601
  updatedAt: string;
  lastRunAt?: string;
  nextRunAt?: string;
  completedAt?: string;                // maxRuns 达到后置位
  
  // 通知
  notification: NotificationConfig;
  
  // 权限边界
  permissions: AutomationPermissions;
}

export type ScheduleConfig =
  | { type: 'interval'; intervalMinutes: number }
  | { type: 'daily'; timeOfDay: string }              // HH:MM
  | { type: 'weekly'; dayOfWeek: number; timeOfDay: string }  // 0=Sun, 6=Sat
  | { type: 'monthly'; dayOfMonth: number; timeOfDay: string }  // 1-31
  | { type: 'once'; scheduledAt: string };           // ISO 8601

export interface NotificationConfig {
  system: boolean;                    // 系统通知
  feishu?: { enabled: boolean; chatId?: string };
  channels?: ('system' | 'feishu' | 'dingtalk' | 'wechat' | 'wps')[];
}

export interface AutomationPermissions {
  readFiles: boolean;                 // 读取文件
  writeFiles: boolean;                // 写入文件
  executeBash: boolean;               // 执行命令
  networkAccess: boolean;             // 联网
  bridgeAccess: boolean;              // 飞书/钉钉/微信/WPS 调用
}
```

### 3.2 AutomationRun（运行历史）

```typescript
export type RunStatus = 'running' | 'succeeded' | 'failed' | 'skipped' | 'cancelled';

export interface AutomationRun {
  id: string;
  automationId: string;
  sessionId?: string;                  // 触发的会话 ID
  status: RunStatus;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  
  // 结果
  result?: {
    summary: string;                  // 任务执行摘要
    messageCount: number;
    tokensUsed: number;
  };
  
  // 失败信息
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
  
  // 上下文安全阀
  contextGuardTriggered?: boolean;
  newSessionReason?: string;
}
```

### 3.3 持久化

**位置**：`~/.tagent[-dev]/automations.json`

```typescript
// 持久化文件结构
interface AutomationStore {
  version: 1;                         // 迁移版本号
  automations: Automation[];
  runs: AutomationRun[];              // 最近 1000 条
}
```

**版本化迁移策略**：

- 仅追加字段
- 删除字段前先 deprecate 一个版本
- 迁移失败时降级为只读模式
- 失败时记录到 `~/.tagent[-dev]/migration-errors.log`

---

## 4. 系统架构

### 4.1 模块清单

```
apps/electron/src/main/lib/
├── automation-scheduler.ts          # 30s tick 后台调度器
├── automation-manager.ts            # CRUD + 启停 + 手动运行
├── automation-runner.ts             # 单次执行：prompt → session → run
├── automation-context-guard.ts      # 上下文安全阀
├── automation-notification-service.ts  # 系统/飞书/钉钉/微信通知
├── automation-notification-format.ts   # 通知 Markdown 渲染
├── automation-agent-tools.ts        # MCP 工具（Agent 创建任务用）
└── automation-history-store.ts      # 运行历史持久化

apps/electron/src/renderer/components/automation/
├── AutomationManagerView.tsx        # 容器：全屏管理视图
├── AutomationsListView.tsx          # 列表：按「启用中/已暂停/已完成」分组
├── AutomationFormView.tsx           # 编辑器：Markdown 富文本
├── AutomationCard.tsx               # 单卡片：名称 + 状态 + hover 操作
├── ScheduleEditor.tsx               # 调度类型选择器
└── RunHistoryPanel.tsx              # 运行历史时间线

apps/electron/src/main/ipc.ts        # 新增 IPC 通道
apps/electron/src/preload/index.ts   # 新增 bridge
apps/electron/src/renderer/atoms/
└── automation-atoms.ts              # Jotai atoms
```

### 4.2 调度循环

```typescript
// automation-scheduler.ts
class AutomationScheduler {
  private tickInterval = 30_000;       // 30 秒
  private running = false;
  
  start() {
    if (this.running) return;
    this.running = true;
    this.scheduleNext();
  }
  
  private scheduleNext() {
    setTimeout(() => this.tick(), this.tickInterval);
  }
  
  private async tick() {
    if (!this.running) return;
    
    const now = new Date();
    const dueAutomations = await this.manager.getDueAutomations(now);
    
    for (const automation of dueAutomations) {
      // 并发限制：最多 3 个并发
      if (this.activeRuns.size >= 3) {
        await this.queue.push(automation);
        continue;
      }
      
      this.executeAutomation(automation).catch(err => {
        logger.error(`[automation] tick failed: ${err.message}`);
      });
    }
    
    this.scheduleNext();
  }
  
  private async executeAutomation(automation: Automation) {
    const run: AutomationRun = {
      id: uuid(),
      automationId: automation.id,
      status: 'running',
      startedAt: new Date().toISOString(),
    };
    
    try {
      // 1. 上下文安全阀检查
      const guard = new AutomationContextGuard(automation);
      const shouldFork = await guard.shouldFork();
      
      // 2. 获取或创建会话
      const session = shouldFork
        ? await this.manager.forkSession(automation, run, guard.reason)
        : await this.manager.getOrCreateSession(automation);
      
      run.sessionId = session.id;
      
      // 3. 发送 prompt
      await this.runner.runPrompt(session, automation.prompt);
      
      // 4. 等待完成（带超时）
      const result = await this.runner.waitForCompletion(session, {
        timeoutMs: 30 * 60_000,  // 30 分钟
      });
      
      run.status = 'succeeded';
      run.result = result;
      run.contextGuardTriggered = shouldFork;
      run.newSessionReason = guard.reason;
    } catch (err) {
      run.status = 'failed';
      run.error = { code: err.code, message: err.message };
    } finally {
      run.finishedAt = new Date().toISOString();
      run.durationMs = Date.parse(run.finishedAt) - Date.parse(run.startedAt);
      
      // 5. 持久化运行历史
      await this.historyStore.append(run);
      
      // 6. 更新 automation 状态
      await this.manager.updateAfterRun(automation.id, run);
      
      // 7. 发送通知
      await this.notificationService.notify(automation, run);
    }
  }
}
```

### 4.3 调度时间计算

```typescript
// automation-scheduler.ts
export function computeNextRunAt(automation: Automation, now: Date): Date | null {
  if (!automation.enabled) return null;
  if (automation.maxRuns && automation.runCount >= automation.maxRuns) {
    return null;  // 已达上限
  }
  
  switch (automation.schedule.type) {
    case 'interval': {
      const last = automation.lastRunAt ? new Date(automation.lastRunAt) : now;
      return new Date(last.getTime() + automation.schedule.intervalMinutes * 60_000);
    }
    case 'daily': {
      return nextTimeOfDay(now, automation.schedule.timeOfDay);
    }
    case 'weekly': {
      return nextWeeklyTime(now, automation.schedule.dayOfWeek, automation.schedule.timeOfDay);
    }
    case 'monthly': {
      return nextMonthlyTime(now, automation.schedule.dayOfMonth, automation.schedule.timeOfDay);
    }
    case 'once': {
      // 一次性：返回 scheduledAt，到点后由 manager 置为 completed
      return new Date(automation.schedule.scheduledAt);
    }
  }
}

// 月度调度短月策略
function nextMonthlyTime(now: Date, dayOfMonth: number, timeOfDay: string): Date {
  const next = new Date(now);
  next.setMonth(next.getMonth() + 1);
  next.setDate(Math.min(dayOfMonth, daysInMonth(next.getFullYear(), next.getMonth() + 1)));
  const [h, m] = timeOfDay.split(':').map(Number);
  next.setHours(h, m, 0, 0);
  return next;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}
```

### 4.4 失败退避

```typescript
// automation-manager.ts
async updateAfterRun(automationId: string, run: AutomationRun): Promise<void> {
  const automation = await this.get(automationId);
  if (!automation) return;
  
  automation.runCount += 1;
  automation.lastRunAt = run.startedAt;
  automation.nextRunAt = computeNextRunAt(automation, new Date())?.toISOString();
  
  if (run.status === 'failed') {
    automation.consecutiveFailures += 1;
    
    // 退避：连续失败时按指数退避
    if (automation.consecutiveFailures >= 3) {
      // 暂停 + 指数退避
      automation.enabled = false;
      await this.notificationService.notify({
        title: 'Automation auto-paused',
        body: `${automation.name} 连续失败 ${automation.consecutiveFailures} 次，已自动暂停`,
      });
    }
  } else {
    automation.consecutiveFailures = 0;
  }
  
  // maxRuns 检查
  if (automation.maxRuns && automation.runCount >= automation.maxRuns) {
    automation.enabled = false;
    automation.completedAt = new Date().toISOString();
  }
  
  automation.updatedAt = new Date().toISOString();
  await this.persist();
}
```

---

## 5. 上下文安全阀

### 5.1 阈值策略

```typescript
// automation-context-guard.ts
const DEFAULT_CONTEXT_THRESHOLD = 0.7;  // 70%

interface GuardResult {
  shouldFork: boolean;
  reason?: string;
  usagePercent?: number;
}

class AutomationContextGuard {
  constructor(private automation: Automation) {}
  
  async shouldFork(): Promise<GuardResult> {
    const threshold = await this.getThreshold();
    const usage = await this.getSessionContextUsage();
    
    if (usage.percentage >= threshold) {
      return {
        shouldFork: true,
        reason: `Context usage ${(usage.percentage * 100).toFixed(1)}% >= threshold ${(threshold * 100).toFixed(0)}%`,
        usagePercent: usage.percentage,
      };
    }
    
    return { shouldFork: false, usagePercent: usage.percentage };
  }
  
  private async getThreshold(): Promise<number> {
    // 从设置中读取，默认 70%
    const settings = await this.settingsStore.get();
    return settings.automation?.contextThreshold ?? DEFAULT_CONTEXT_THRESHOLD;
  }
  
  private async getSessionContextUsage() {
    if (!this.automation.sessionRef) {
      return { percentage: 0 };  // 新会话，无历史
    }
    return await this.contextUsageCache.get(this.automation.sessionRef.sessionId);
  }
}
```

### 5.2 边界用例

- 69%：低占用，复用会话
- 70%：达阈值，**新建子会话**（>= 触发，< 不触发）
- 71%+：新建子会话，记录原因
- 边缘：会话首次运行（无历史）→ 视为 0%，必不切

### 5.3 配置

```typescript
// settings store
interface AutomationSettings {
  contextThreshold: number;          // 默认 0.7
  maxConcurrent: number;             // 默认 3
  defaultTimeoutMs: number;          // 默认 30 * 60_000
  enableContextGuard: boolean;       // 默认 true
}
```

---

## 6. IPC 接口

### 6.1 主进程 → 渲染层

```typescript
// packages/shared/src/ipc/automation-channels.ts
export const AUTOMATION_IPC_CHANNELS = {
  LIST: 'automation:list',
  GET: 'automation:get',
  CREATE: 'automation:create',
  UPDATE: 'automation:update',
  DELETE: 'automation:delete',
  TOGGLE: 'automation:toggle',
  RUN_NOW: 'automation:run-now',
  LIST_RUNS: 'automation:list-runs',
  GET_RUN: 'automation:get-run',
  
  // 实时通知
  ON_RUN_STARTED: 'automation:run-started',
  ON_RUN_FINISHED: 'automation:run-finished',
  ON_STATE_CHANGED: 'automation:state-changed',
} as const;
```

### 6.2 MCP 工具（Agent 创建任务用）

```typescript
// automation-agent-tools.ts
const tools = [
  {
    name: 'create_automation',
    description: 'Create a new scheduled automation task',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        schedule: { /* ScheduleConfig */ },
        prompt: { type: 'string' },
        permissions: { /* AutomationPermissions */ },
      },
    },
  },
  {
    name: 'list_automations',
    description: 'List all automations',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'pause_automation',
    description: 'Pause a running automation',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'resume_automation',
    description: 'Resume a paused automation',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'delete_automation',
    description: 'Delete an automation',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'get_automation_runs',
    description: 'Get recent run history of an automation',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, limit: { type: 'number' } },
      required: ['id'],
    },
  },
];
```

---

## 7. UI 设计

### 7.1 入口位置

- 侧边栏底部「自动任务」按钮（替换当前 `🕙` 按钮描述）
- 入口描述改为「自动任务按钮」（修复 #746）
- 深色主题下选中态可见性优化（修复 #750）

### 7.2 主管理视图

```
┌──────────────────────────────────────────────────────────┐
│  自动任务                                            +   │
├──────────────────────────────────────────────────────────┤
│  启用中（3）                                              │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 📋 每天整理今日会话             每天 20:00    [运行][⏸][⋯] │
│  │ 📊 周报自动生成                 每周五 18:00  [运行][⏸][⋯] │
│  │ 🔔 CI 失败提醒                 每 30 分钟     [运行][⏸][⋯] │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  已暂停（1）                                              │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 📁 备份项目文件                 每周日 02:00  [▶][⋯]   │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  已完成（5）                       [查看运行历史]         │
└──────────────────────────────────────────────────────────┘
```

### 7.3 编辑器

- Markdown 富文本（基于 TipTap，可看渲染效果）
- 调度类型切换：interval / daily / weekly / monthly / once
- maxRuns 输入框
- 权限边界复选框
- 运行预览（nextRunAt 计算结果）
- 「保存」按钮五态反馈：idle / dirty / saving / saved / error

### 7.4 运行历史

时间线视图，每条 run 展示：

- 触发时间
- 状态（succeeded / failed / skipped）
- 耗时
- 摘要
- 失败原因（如有）
- 「跳转到该次会话」按钮（#`75cddc2`）

---

## 8. 通知集成

### 8.1 系统通知

```typescript
// automation-notification-service.ts
import { Notification } from 'electron';

async function sendSystemNotification(automation: Automation, run: AutomationRun) {
  const status = run.status === 'succeeded' ? '✅' : '❌';
  new Notification({
    title: `${status} ${automation.name}`,
    body: run.result?.summary ?? run.error?.message ?? '',
  }).show();
}
```

### 8.2 飞书通知

复用 `feishu-bridge.ts` 的 sendMessage：

```typescript
async function sendFeishuNotification(automation: Automation, run: AutomationRun) {
  if (!automation.notification.feishu?.enabled) return;
  if (!automation.notification.feishu.chatId) return;
  
  const markdown = formatAutomationRun(automation, run);
  await this.feishuBridge.sendMessage({
    chatId: automation.notification.feishu.chatId,
    content: markdown,
    contentType: 'markdown',
  });
}
```

### 8.3 通知格式

```typescript
// automation-notification-format.ts
function formatAutomationRun(automation: Automation, run: AutomationRun): string {
  const statusEmoji = {
    succeeded: '✅',
    failed: '❌',
    skipped: '⏭️',
    cancelled: '🚫',
  }[run.status];
  
  return `${statusEmoji} **${automation.name}**

⏱️ 开始：${formatTime(run.startedAt)}
⏱️ 耗时：${formatDuration(run.durationMs)}
📊 消息数：${run.result?.messageCount ?? '-'}
🪙 Tokens：${run.result?.tokensUsed ?? '-'}
${run.contextGuardTriggered ? '🔀 **上下文安全阀触发** — 已新建子会话' : ''}
${run.error ? `❌ **错误**：${run.error.message}` : ''}
${run.result?.summary ? `\n> ${run.result.summary}` : ''}`;
}
```

---

## 9. 里程碑

### M1：调度内核 + 持久化

**交付物**：

- `Automation` / `AutomationRun` 数据模型
- `automation-scheduler.ts` 30s tick
- `automation-manager.ts` CRUD + 启停
- `automations.json` 持久化（带版本化迁移）
- 基础 IPC 通道
- 失败退避

**验收**：

- 任务可创建 / 暂停 / 恢复 / 删除 / 手动运行
- 应用重启后状态与 nextRunAt 正确恢复
- 连续失败自动暂停

### M2：UI + IPC 完整闭环

**交付物**：

- 侧边栏入口
- 全屏管理视图
- Markdown 富文本编辑器
- 运行历史时间线
- 编辑器五态反馈

**验收**：

- 完整生命周期 UI 可用
- 编辑保存后状态与持久化一致
- 错误态有可理解反馈

### M3：上下文安全阀

**交付物**：

- 阈值检查逻辑
- 临界值 69 / 70 / 71 单测覆盖
- 配置可关闭

**验收**：

- 高占用任务不堆叠同一会话
- 运行记录可追踪切换原因
- 关闭后行为退化为 v0

### M4：扩展 + 通知

**交付物**：

- monthly 调度 + 短月策略
- once + maxRuns
- 飞书通知
- MCP 工具暴露给 Agent
- 自然语言创建任务（三级 fallback 意图识别）

**验收**：

- monthly 在 2/4/6/9/11 月行为正确
- once 任务完成后自动停用
- maxRuns 达到上限自动停用
- Agent 可通过 MCP 工具创建/管理任务

---

## 10. 风险与应对

| 风险 | 应对 |
|---|---|
| 调度任务导致资源泄漏 | 后台 Runner 生命周期管理；超时与并发上限；退出清理 |
| 模式状态串线 | Automation 默认只属于 general；命名空间隔离 |
| 持久化迁移失败 | 索引版本化；只追加；失败时只读降级 |
| 后台调度静默失败 | 每次运行写入结构化历史；UI 暴露最近错误 |
| 自然语言意图识别误判 | 三级 fallback；用户最终确认才创建 |
| 飞书通知被滥用 | 默认不开启；显式配置后才发送 |

---

## 11. 测试要求

### 11.1 必做单测

- `computeNextRunAt` 各种调度类型 + 短月 + 跨年
- `shouldFork` 临界值 69 / 70 / 71
- 失败退避算法
- 暂停 / 恢复 / 删除 CRUD
- Markdown 通知格式
- IPC 通道 mock

### 11.2 集成测试

- 创建任务 → 等待触发 → 检查执行 → 检查历史
- 手动运行立即触发
- 重启后状态恢复
- 飞书通知 mock 发送

### 11.3 端到端手工

- 自然语言输入「每天晚上 8 点整理会话」→ Agent 创建任务 → UI 可见
- 编辑调度时间 → nextRunAt 自动更新
- 删除任务 → 历史保留

---

## 12. 与其他模块的关系

### 12.1 协作子会话

Automation 任务执行时**默认创建一个普通会话**（`automation-{id}-{runId}`），可选通过 `sessionRef` 关联到现有会话。**不**与协作子会话体系冲突，因为：

- 协作子会话是「用户在主会话中委派子任务」
- Automation 是「后台定时器主动触发」

两者复用 `agent-session-manager` 但走不同入口。

### 12.2 上下文管理

复用 `packages/shared/src/utils/context-window.ts` 的 `inferContextWindow` 和 `apps/electron/src/main/lib/context-usage-cache.ts` 的查询能力。

### 12.3 飞书 Bridge

复用 `feishu-bridge.ts` 的 `sendMessage`，增加 markdown contentType 支持。

### 12.4 Memory 系统

Automation 任务**不**自动写 Memory。Agent 在执行 prompt 时可主动调用 memory 工具，但这是 Agent 行为不是 Automation 行为。

### 12.5 Skill 系统

`automation-agent-tools.ts` 作为一个新 skill 注册到 `proma-built-in` 分组。

---

## 13. PR 拆分建议

每个里程碑一个 PR：

```
PR-1（M1 内核）：feature/automation-scheduler-core
PR-2（M2 UI）：  feature/automation-management-ui
PR-3（M3 阀）：  feature/automation-context-guard
PR-4（M4 扩展）：feature/automation-extensions
```

每个 PR 单独可验证，单独可回滚。

---

## 14. 完成定义（DoD）

- P0 + P1 全部 PR 合并并通过测试
- 至少完成 1 轮真实任务演练（创建 → 执行 → 结果检查 → 通知）
- 文档已更新（PROGRESS.md + CHANGELOG.md）
- 飞书通知真实发送过至少一次
- 性能：后台调度对主进程 CPU 占用 < 1%
- 启动时间不增加超过 200ms

---

## 15. 相关文档

- [`2026-06-24-upstream-feature-roadmap.md`](2026-06-24-upstream-feature-roadmap.md) — 总路线图
- [`2026-06-24-collaboration-design.md`](2026-06-24-collaboration-design.md) — 协作子会话设计
- [`2026-06-16-upstream-upgrade-issues.md`](2026-06-16-upstream-upgrade-issues.md) Issue B/C/D/E
- [`2026-06-16-upstream-upgrade-plan.md`](2026-06-16-upstream-upgrade-plan.md) M2/M3
- [`proactive-scheduler-monitor-design.md`](../../proactive-scheduler-monitor-design.md) — 旧 proactive 设计
- [`2026-06-13-context-usage-breakdown-design.md`](2026-06-13-context-usage-breakdown-design.md) — Context 用量
- [`CLAUDE.md`](../../../CLAUDE.md) — 项目级约束