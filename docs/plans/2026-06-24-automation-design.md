# TAgent Automation 系统设计文档

> **状态**：Draft v0.2（v0.1 基于 Proma 真实实现修订 + Kun/hermes 工程实践吸收）
> **日期**：2026-06-24
> **目标**：实现完整的定时任务（Automation）系统，让 TAgent 进入「proactive Agent」阶段
> **关联**：[`2026-06-24-upstream-feature-roadmap.md`](2026-06-24-upstream-feature-roadmap.md) §2.2、[`2026-06-16-upstream-upgrade-issues.md`](2026-06-16-upstream-upgrade-issues.md) Issue B/C/D/E、[`2026-06-16-upstream-upgrade-plan.md`](2026-06-16-upstream-upgrade-plan.md) M2/M3
> **上游基线**：proma-ai/Proma v0.12.0 ~ v0.13.3（真实实现，非设计文档）
> **分支建议**：`feature/automation-scheduler`（按子任务拆分）

---

## 0. Handoff 摘要

**你要做什么**：在 TAgent Desktop 中实现完整的 Automation 系统——用户能创建"每天帮我整理今天的会话"这类定时任务，由 TAgent 周期性自动执行。

**核心参考（三方实现调研）**：

- **Proma v0.13.3**（`F:\Proma`）：30s tick、daily/reuse 会话策略 + 70% 阈值 roll over、失败 5 次自动暂停、2 小时超时、飞书通知 + trigger 条件、MCP 工具 4 个、防递归 automationContext 注入、重启防雪崩、用户接管 protection（automationGraduated）、运行历史嵌在对象内截断 20 条
- **Kun**（`F:\Kun`）：30s tick、MAX_CONCURRENT=3 + priority 排队、dependsOn 任务依赖 + 环检测、useWorktree 池化隔离、powerSaveBlocker 防休眠、HTTP 内部 API（127.0.0.1:8788）、claw-scheduled-task-detector 自然语言检测
- **hermes-desktop**（`F:\hermes-desktop`）：Python 端调度引擎、UI 支持 minutes/hourly/daily/weekly + custom cron 表达式、16 种投递渠道（Telegram/Discord/Slack/WhatsApp/钉钉/飞书/微信/Email/Webhook 等）、cronjob toolset
- `docs/plans/2026-06-16-upstream-upgrade-plan.md` §M2/M3

**不要做的事**：

- 不要照搬 `~/.proma/automations.json`，统一用 `~/.tagent[-dev]/automations.json`
- 不要用 SQLite 存储 Automation 数据（CLAUDE.md 规定本地优先 JSON）
- 不要让 Automation 跨模式影响 TA 模式会话
- 不要引入云端 always-on agent
- 不要在 v1 实现 dependsOn 任务依赖（Kun 的做法，v2 再考虑）
- 不要在 v1 实现 16 种投递渠道（hermes 的做法，先做飞书 + 系统，预留接口扩展）

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

- 通用复杂 Cron 表达式编辑器（UI 提供 minutes/hourly/daily/weekly + custom cron 入口，参考 hermes）
- 云端 always-on agent
- 无需用户授权的自动写文件、自动执行 Bash、自动发消息
- 完整插件市场
- 跨设备常驻执行
- **TA 模式专属定时任务**（v1 阶段只支持 general 模式）
- **dependsOn 任务依赖**（Kun 的做法，v2 再考虑）
- **16 种投递渠道**（hermes 的做法，先做飞书 + 系统，预留接口扩展）

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

### 2.6 防休眠（借鉴 Kun）

- 任务执行期间调用 Electron `powerSaveBlocker.start('prevent-app-suspension')` 防止系统休眠
- 任务完成后 `powerSaveBlocker.stop(blockerId)` 释放
- 避免长任务（如每小时执行一次的 CI 监控）在系统息屏时被中断

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
  channelId: string;                   // AI 渠道 ID（必填）
  modelId?: string;                    // 模型 ID（可选，继承来源会话或渠道默认）
  workspaceId?: string;                // 工作区 ID（可选，决定子会话 cwd）
  
  // 会话策略（借鉴 Proma daily/reuse 双模式）
  sessionMode: 'daily' | 'reuse';     // daily=同日复用+70%阈值roll over；reuse=始终复用
  sourceSessionId?: string;            // 创建来源会话 ID（作为模板，运行时复用或新建子会话）
  lastSessionId?: string;              // 最近一次运行创建的会话 ID（用于复用判断和跳转）
  automationGraduated?: boolean;       // 用户接管标记（true=不再注入定时任务消息，避免污染用户私人会话）
  
  // 权限模式（借鉴 Proma auto/bypassPermissions，替代细粒度权限位）
  permissionMode: 'auto' | 'bypassPermissions';  // bypassPermissions=无人值守必须
  
  // 元数据
  enabled: boolean;                    // 启用/暂停
  maxRuns?: number;                    // 运行次数上限（实际执行次数：成功+失败，不含 skipped）
  runCount: number;                    // 已运行次数
  consecutiveFailures: number;         // 连续失败次数（≥5 自动暂停）
  
  // 时间戳
  createdAt: number;                   // Unix timestamp
  updatedAt: number;
  lastRunAt?: number;
  nextRunAt: number;                   // 下次应触发的绝对时间戳（调度核心，避免长 interval 漂移）
  completedAt?: number;                // maxRuns 达到后置位（区别于用户手动暂停）
  
  // 通知
  notification: NotificationConfig;
  
  // 运行历史（借鉴 Proma 嵌在对象内截断 20 条，避免独立 1000 条历史的 JSON 膨胀）
  runHistory: AutomationRun[];
}

/** 运行历史最大保留条数 */
export const AUTOMATION_MAX_HISTORY = 20;
/** 连续失败达到此次数自动暂停任务 */
export const AUTOMATION_MAX_CONSECUTIVE_FAILURES = 5;

export type ScheduleConfig =
  | { type: 'interval'; intervalMinutes: number }
  | { type: 'daily'; timeOfDay: string }              // HH:MM
  | { type: 'weekly'; dayOfWeek: number; timeOfDay: string }  // 0=Sun, 6=Sat
  | { type: 'monthly'; dayOfMonth: number; timeOfDay: string }  // 1-31
  | { type: 'once'; scheduledAt: string };           // ISO 8601

export interface NotificationConfig {
  system: boolean;                    // 系统通知
  feishu?: { enabled: boolean; chatId?: string };
  /** 通知触发条件：默认 always */
  trigger?: 'always' | 'success' | 'error';
}
```

### 3.2 AutomationRun（运行历史）

```typescript
export type RunStatus = 'running' | 'succeeded' | 'failed' | 'skipped' | 'cancelled';

export interface AutomationRun {
  /** 本次触发的时间戳 */
  runAt: number;
  /** 本轮新建/复用的子会话 ID（可点进去查看执行详情） */
  sessionId: string;
  /** 运行结果 */
  status: RunStatus;
  /** 耗时（毫秒） */
  durationMs?: number;
  /** 失败原因（status === 'failed' 时） */
  error?: string;
  /** 跳过原因（status === 'skipped' 时，如来源会话忙） */
  skipReason?: string;
}
```

### 3.3 持久化

**位置**：`~/.tagent[-dev]/automations.json`

```typescript
// 持久化文件结构
interface AutomationStore {
  version: number;                     // 迁移版本号（当前 2）
  automations: Automation[];           // runHistory 嵌在每个 automation 对象内
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
├── automation-scheduler.ts          # 30s tick 后台调度器（含会话策略、上下文安全阀、重启防雪崩）
├── automation-manager.ts            # CRUD + 启停 + 手动运行 + 运行历史追加
├── automation-notification-service.ts  # 系统/飞书通知（含 trigger 条件过滤）
├── automation-notification-format.ts   # 通知 Markdown 渲染
└── automation-agent-tools.ts        # MCP 工具（Agent 创建任务用）

apps/electron/src/renderer/components/automation/
├── AutomationManagerView.tsx        # 容器：全屏管理视图
├── AutomationsListView.tsx          # 列表：按「启用中/已暂停/已完成」分组
├── AutomationFormView.tsx           # 编辑器：Markdown 富文本 + 调度类型选择器 + 会话模式 + 权限模式
├── AutomationCard.tsx               # 单卡片：名称 + 状态 + hover 操作
├── ScheduleEditor.tsx               # 调度类型选择器（interval/daily/weekly/monthly/once + custom cron）
└── RunHistoryPanel.tsx              # 运行历史时间线

apps/electron/src/main/ipc.ts        # 新增 IPC 通道
apps/electron/src/preload/index.ts   # 新增 bridge
apps/electron/src/renderer/atoms/
└── automation-atoms.ts              # Jotai atoms
```

### 4.2 调度循环

```typescript
// automation-scheduler.ts
import { powerSaveBlocker } from 'electron'

const TICK_INTERVAL_MS = 30_000;       // 30 秒
const RUN_TIMEOUT_MS = 2 * 60 * 60 * 1000;  // 2 小时（Proma 的合理超时）
const DAILY_CONTEXT_ROLLOVER_THRESHOLD = 0.7;  // 同日复用会话上下文占用率阈值

let tickTimer: NodeJS.Timeout | undefined;
/** 正在执行中的 automation id 集合，防止同一任务重入 */
const runningAutomations = new Set<string>();

/** 一个 tick：扫描所有 active 且到期的任务并触发 */
function tick(): void {
  const now = Date.now();
  for (const automation of listAutomations()) {
    if (!automation.enabled) continue;
    // 完整度兜底：缺 channelId / workspaceId 的跳过
    if (!automation.channelId || !automation.workspaceId) continue;
    if (now < automation.nextRunAt) continue;
    if (runningAutomations.has(automation.id)) continue;
    // 来源会话忙时跳过（Proma 的额外保险，主要靠新建子会话规避）
    if (automation.sourceSessionId && isAgentSessionActive(automation.sourceSessionId)) {
      continue;
    }
    // 不 await，让多个任务可以并行触发；各自有 runningAutomations 重入保护
    void runAutomation(automation);
  }
}

/**
 * 执行一次定时任务
 *
 * 会话策略（借鉴 Proma daily/reuse 双模式）：
 *  - reuse：lastSessionId 存在且会话还活着就复用，否则新建
 *  - daily：再叠加一层「同一自然日」+「上下文占用率 < 阈值」双重判断
 *
 * 用户接管保护（Proma）：
 *  - automationGraduated 标记的会话不再注入定时任务消息
 *
 * 防递归（Proma）：
 *  - prompt 注入 automationContext，告诉 Agent 这本身是定时任务，别再创建定时任务
 */
async function runAutomation(automation: Automation, manual = false): Promise<void> {
  if (runningAutomations.has(automation.id)) {
    console.log(`[定时任务] ${automation.name} 上一轮尚未结束，跳过本轮`);
    appendRun(automation.id, { runAt: Date.now(), sessionId: '', status: 'skipped', skipReason: '上一轮尚未结束' });
    broadcastChanged();
    return;
  }

  runningAutomations.add(automation.id);
  const runAt = Date.now();

  // 防休眠（借鉴 Kun）
  const blockerId = powerSaveBlocker.start('prevent-app-suspension');

  try {
    // 1. 会话策略：daily/reuse 双模式
    const sessionMode = automation.sessionMode ?? 'daily';
    let reuseSessionId: string | undefined;
    const lastSessionMeta = automation.lastSessionId ? getAgentSessionMeta(automation.lastSessionId) : undefined;

    // 用户接管过的会话不再复用（Proma automationGraduated）
    if (lastSessionMeta?.automationGraduated) {
      console.log(`[定时任务] ${automation.name} 上次会话已被用户接管，本次自动开新会话`);
    } else if (automation.lastSessionId && lastSessionMeta) {
      if (sessionMode === 'reuse') {
        reuseSessionId = automation.lastSessionId;
      } else if (sessionMode === 'daily' && automation.lastRunAt && isSameLocalDay(automation.lastRunAt, runAt)) {
        const usageRatio = getSessionContextUsageRatio(automation.lastSessionId);
        if (usageRatio === undefined || usageRatio < DAILY_CONTEXT_ROLLOVER_THRESHOLD) {
          reuseSessionId = automation.lastSessionId;
        } else {
          console.log(`[定时任务] ${automation.name} 上下文占用 ${(usageRatio * 100).toFixed(1)}% 已达阈值 70%，本次自动开新会话`);
        }
      }
    }

    // 2. 创建或复用子会话
    let targetSessionId: string;
    if (reuseSessionId) {
      targetSessionId = reuseSessionId;
    } else {
      const created = createAgentSession(automation.name, automation.channelId, automation.workspaceId, automation.modelId);
      updateAgentSessionMeta(created.id, { sourceAutomationId: automation.id });
      targetSessionId = created.id;
      setLastSessionId(automation.id, created.id);
    }

    // 3. 发送 prompt（防递归：注入 automationContext 告诉 Agent 不要再创建定时任务）
    const automationContext = `这是定时任务「${automation.name}」的自动执行（ID: ${automation.id}，${formatScheduleLabel(automation)}）。这本身就是定时任务，不要建议用户再创建定时任务。直接执行任务即可。如发现本任务连续失败、输出价值低、频率不合适或提示词不完整，可以使用 automation 工具读取并更新当前任务。`;

    // 4. 等待完成（带超时）
    const result = await runPromptAndWait(targetSessionId, automation.prompt + '\n<!--TAGENT_SCHEDULED_RUN-->', {
      automationContext,
      channelId: automation.channelId,
      modelId: automation.modelId,
      workspaceId: automation.workspaceId,
      permissionModeOverride: automation.permissionMode ?? 'bypassPermissions',
      timeoutMs: RUN_TIMEOUT_MS,
    });

    // 5. 追加运行历史（截断 AUTOMATION_MAX_HISTORY）
    appendRun(automation.id, {
      runAt,
      sessionId: targetSessionId,
      status: 'succeeded',
      durationMs: Date.now() - runAt,
    });

    // 6. 更新状态 + 失败退避 + maxRuns 检查
    updateAfterRun(automation.id, { status: 'succeeded' });

  } catch (err) {
    appendRun(automation.id, {
      runAt,
      sessionId: '',
      status: 'failed',
      durationMs: Date.now() - runAt,
      error: err instanceof Error ? err.message : '未知错误',
    });
    updateAfterRun(automation.id, { status: 'failed' });
  } finally {
    runningAutomations.delete(automation.id);
    if (powerSaveBlocker.isStarted(blockerId)) powerSaveBlocker.stop(blockerId);
    broadcastChanged();
  }
}

/**
 * 启动调度器
 *
 * 恢复策略（Proma 重启防雪崩）：把已过期的 nextRunAt 顺延到「现在 + 一个完整间隔」，
 * 避免应用重启后一堆历史任务在同一 tick 内雪崩触发。
 */
export function startScheduler(): void {
  if (tickTimer) return;
  const now = Date.now();
  for (const automation of listAutomations()) {
    if (automation.enabled && automation.nextRunAt <= now) {
      setNextRunAt(automation.id, computeNextRunAt(automation, now));
    }
  }
  tickTimer = setInterval(tick, TICK_INTERVAL_MS);
}

/** 停止调度器（before-quit 调用） */
export function stopScheduler(): void {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = undefined;
  }
}

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
async function updateAfterRun(automationId: string, run: { status: RunStatus; error?: string }): Promise<void> {
  const automation = getAutomation(automationId);
  if (!automation) return;

  automation.runCount += 1;
  automation.lastRunAt = runAt;
  automation.nextRunAt = computeNextRunAt(automation, new Date());

  if (run.status === 'failed') {
    automation.consecutiveFailures += 1;

    // 退避：连续失败达上限自动暂停（借鉴 Proma 的 5 次阈值）
    if (automation.consecutiveFailures >= AUTOMATION_MAX_CONSECUTIVE_FAILURES) {
      automation.enabled = false;
      console.warn(`[定时任务] ${automation.name} 连续失败 ${automation.consecutiveFailures} 次，已自动暂停`);
      // 发送自动暂停通知
      notifyAutomationRunFinished({
        automation,
        run: { runAt, sessionId: '', status: 'failed', error: `连续失败 ${automation.consecutiveFailures} 次，已自动暂停` },
      });
    }
  } else {
    automation.consecutiveFailures = 0;
  }

  // maxRuns 检查（once 模式语义上等价于 maxRuns=1）
  if (automation.maxRuns && automation.runCount >= automation.maxRuns) {
    automation.enabled = false;
    automation.completedAt = Date.now();
  }

  automation.updatedAt = Date.now();
  persist();
}
```

---

## 5. 上下文安全阀（已融入 4.2）

上下文安全阀逻辑已融入 `runAutomation()` 的 daily 模式会话策略中，不再作为独立模块。

**阈值**：`DAILY_CONTEXT_ROLLOVER_THRESHOLD = 0.7`（70%）

**为什么是 0.7**（Proma 的理由）：SDK 自动压缩阈值约 77.5%，留出 7.5% 安全余量，避免本次运行刚开始就被 SDK 自动压缩。

**边界用例**：

- 69%：低占用，复用会话
- 70%：达阈值，**新建子会话**（>= 触发，< 不触发）
- 71%+：新建子会话，记录原因
- 边缘：会话首次运行（无历史）→ 视为 0%，必不切
- reuse 模式：忽略阈值，始终复用（用户主动选择，token 成本由用户承担）

### 5.1 配置

```typescript
// settings store
interface AutomationSettings {
  defaultTimeoutMs: number;          // 默认 2 * 60 * 60_000（2 小时）
  enableContextGuard: boolean;       // 默认 true（仅影响 daily 模式）
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
        channelId: { type: 'string' },
        modelId: { type: 'string' },
        workspaceId: { type: 'string' },
        sessionMode: { type: 'string', enum: ['daily', 'reuse'] },
        permissionMode: { type: 'string', enum: ['auto', 'bypassPermissions'] },
      },
      required: ['name', 'prompt', 'channelId'],
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
- 调度类型切换：interval / daily / weekly / monthly / once + custom cron 入口
- 会话模式选择器：daily（同日复用，默认）/ reuse（始终复用）
- 权限模式选择器：auto（SDK 内置审批器）/ bypassPermissions（无人值守，默认）
- 渠道 + 模型选择器（复用通用模式的 ChannelSelector / ModelSelector）
- 工作区选择器（复用通用模式的 WorkspaceSelector）
- maxRuns 输入框（选填，不限次 = 默认）
- 通知配置：飞书开关 + chatId + trigger 条件（always/success/error）
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

### 8.1 通知触发条件（借鉴 Proma）

```typescript
// automation-notification-service.ts
export async function notifyAutomationRunFinished(params: {
  automation: Automation;
  run: AutomationRun;
}): Promise<void> {
  const { automation, run } = params;
  const trigger = automation.notification.trigger ?? 'always';

  // 按 trigger 条件过滤
  if (trigger === 'success' && run.status !== 'succeeded') return;
  if (trigger === 'error' && run.status !== 'failed') return;

  // 系统通知
  if (automation.notification.system) {
    sendSystemNotification(automation, run);
  }

  // 飞书通知
  if (automation.notification.feishu?.enabled && automation.notification.feishu.chatId) {
    await sendFeishuNotification(automation, run);
  }
}
```

### 8.2 系统通知

```typescript
import { Notification } from 'electron';

function sendSystemNotification(automation: Automation, run: AutomationRun) {
  const status = run.status === 'succeeded' ? '✅' : '❌';
  new Notification({
    title: `${status} ${automation.name}`,
    body: run.error ?? '任务已完成',
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

⏱️ 耗时：${formatDuration(run.durationMs)}
${run.status === 'skipped' ? `⏭️ **跳过**：${run.skipReason}` : ''}
${run.error ? `❌ **错误**：${run.error}` : ''}`;
}
```

---

## 9. 里程碑

### M1：调度内核 + 持久化

**交付物**：

- `Automation` / `AutomationRun` 数据模型（v0.2 修订版）
- `automation-scheduler.ts` 30s tick + 会话策略（daily/reuse）+ 上下文安全阀 + 重启防雪崩
- `automation-manager.ts` CRUD + 启停 + 运行历史追加（截断 20 条）
- `automations.json` 持久化（带版本化迁移）
- 基础 IPC 通道
- 失败退避（5 次自动暂停）+ maxRuns 检查
- 用户接管保护（automationGraduated）
- 防递归（automationContext 注入）
- 防休眠（powerSaveBlocker）

**验收**：

- 任务可创建 / 暂停 / 恢复 / 删除 / 手动运行
- 应用重启后状态与 nextRunAt 正确恢复（无雪崩）
- 连续失败 5 次自动暂停
- daily 模式同日复用 + 70% 阈值 roll over
- 用户接管过的会话不再注入定时任务消息

### M2：UI + IPC 完整闭环

**交付物**：

- 侧边栏入口
- 全屏管理视图
- Markdown 富文本编辑器 + 会话模式选择器 + 权限模式选择器 + 渠道/模型/工作区选择器
- 运行历史时间线（嵌在 automation 对象内，截断 20 条）
- 编辑器五态反馈

**验收**：

- 完整生命周期 UI 可用
- 编辑保存后状态与持久化一致
- 错误态有可理解反馈
- daily/reuse 模式切换生效

### M3：通知 + trigger 条件

**交付物**：

- 系统通知 + 飞书通知
- trigger 条件过滤（always/success/error）
- 通知格式化（Markdown）

**验收**：

- 飞书通知真实发送过至少一次
- trigger 条件生效（如 error-only 只在失败时通知）

### M4：扩展 + 自然语言 + MCP 工具

**交付物**：

- custom cron 表达式入口（UI 提供 minutes/hourly/daily/weekly + custom cron）
- once + maxRuns
- MCP 工具暴露给 Agent（list/create/update/delete 4 个核心）
- 自然语言创建任务（三级 fallback 意图识别）

**验收**：

- custom cron 表达式正确触发
- once 任务完成后自动停用
- maxRuns 达到上限自动停用
- Agent 可通过 MCP 工具创建/管理任务

---

## 10. 风险与应对

| 风险 | 应对 |
|---|---|
| 调度任务导致资源泄漏 | 后台 Runner 生命周期管理；2 小时超时与并发上限；退出清理 + 防休眠 |
| 模式状态串线 | Automation 默认只属于 general；命名空间隔离 |
| 持久化迁移失败 | 索引版本化；只追加；失败时只读降级 |
| 后台调度静默失败 | 每次运行写入结构化历史（嵌在 automation 对象内，截断 20 条）；UI 暴露最近错误 |
| 自然语言意图识别误判 | 三级 fallback；用户最终确认才创建 |
| 飞书通知被滥用 | 默认不开启；显式配置后才发送；trigger 条件过滤 |
| 用户接管后定时任务继续注入 | automationGraduated 标记；用户接管过的会话不再注入 |
| 定时任务递归创建定时任务 | prompt 注入 automationContext 告诉 Agent 不要再创建 |
| 重启雪崩触发 | 过期 nextRunAt 顺延一个完整间隔 |

---

## 11. 测试要求

### 11.1 必做单测

- `computeNextRunAt` 各种调度类型 + 短月 + 跨年
- daily 模式同日复用 + 70% 阈值 roll over 临界值 69 / 70 / 71
- 失败退避算法（5 次自动暂停）
- 暂停 / 恢复 / 删除 CRUD
- Markdown 通知格式
- IPC 通道 mock
- 用户接管保护（automationGraduated）
- 防递归（automationContext 注入）
- 重启防雪崩（过期 nextRunAt 顺延）

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

Automation 任务执行时**默认创建一个普通会话**（`automation-{id}-{runId}`），通过 `sessionMode` 决定是否复用。**不**与协作子会话体系冲突，因为：

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

`automation-agent-tools.ts` 作为一个新 skill 注册到 `tagent-built-in` 分组。

---

## 13. PR 拆分建议

每个里程碑一个 PR：

```
PR-1（M1 内核）：feature/automation-scheduler-core
PR-2（M2 UI）：  feature/automation-management-ui
PR-3（M3 通知）：feature/automation-notification
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