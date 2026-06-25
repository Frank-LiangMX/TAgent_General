/**
 * Automation 调度器
 *
 * 核心设计（借鉴 Proma v0.13.3）：
 * - 用「下次触发时间戳 + 短 tick 轮询」而非长 setInterval，避免系统休眠导致的定时器漂移
 * - 子会话归属按 sessionMode 决定：
 *     · daily（默认）：同一自然日内的触发复用同一个子会话，跨日时自动新建
 *       叠加安全阀：同日若上次会话上下文占用率已达 DAILY_CONTEXT_ROLLOVER_THRESHOLD，本次也主动新建
 *     · reuse：始终复用同一个子会话（用户主动选择，长期 token 成本由用户承担）
 * - 强制 bypassPermissions，否则无人值守时写操作会因权限弹窗永久阻塞
 * - 来源会话忙时跳过本轮，不排队堆积
 * - 连续失败达上限自动暂停
 * - 启动时恢复：已过期的 nextRunAt 顺延到下一个完整间隔，避免重启雪崩触发
 * - 防递归：prompt 注入 automationContext 告诉 Agent 不要再创建定时任务
 * - 用户接管保护：automationGraduated 标记的会话不再注入定时任务消息
 * - 防休眠：任务执行期间调用 powerSaveBlocker 防止系统休眠
 */

import { BrowserWindow, powerSaveBlocker } from 'electron'
import {
  AUTOMATION_IPC_CHANNELS,
  AUTOMATION_DEFAULT_SESSION_MODE,
  DAILY_CONTEXT_ROLLOVER_THRESHOLD,
  type Automation,
  type AutomationRun,
} from '@tagent/shared'
import {
  listAutomations,
  getAutomation,
  appendRun,
  updateAfterRun,
  setNextRunAt,
  setLastSessionId,
  computeNextRunAt,
} from './automation-manager'
import { formatScheduleLabel, isSameLocalDay } from '@tagent/shared'
import { createAgentSession, updateAgentSessionMeta, getAgentSessionMeta } from './agent-session-manager'
import { getContextUsageCache } from './context-usage-cache'
import { runAgentHeadless, isAgentSessionActive } from './agent-service'
import { notifyAutomationRunFinished } from './automation-notification-service'

/** tick 周期：每 30s 检查一次到期任务（短轮询，抗休眠漂移） */
const TICK_INTERVAL_MS = 30_000

/** 单次任务执行的超时上限：2 小时。超时后强制标记为 error 并释放 runningAutomations 槽位 */
const RUN_TIMEOUT_MS = 2 * 60 * 60 * 1000

let tickTimer: NodeJS.Timeout | undefined
/** 正在执行中的 automation id 集合，防止同一任务重入 */
const runningAutomations = new Set<string>()

function dispatchRunNotification(automation: Automation, run: AutomationRun): void {
  void notifyAutomationRunFinished({ automation, run }).catch((err) => {
    console.error(`[定时任务] 发送完成通知失败: ${automation.name}`, err)
  })
}

/** 向所有渲染窗口广播任务列表变更，触发前端刷新 */
export function broadcastChanged(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(AUTOMATION_IPC_CHANNELS.CHANGED)
    }
  }
}

/**
 * 执行一次定时任务：新建子会话 + headless 运行
 *
 * @param automation 任务定义
 * @param manual 是否手动「立即运行」（手动运行也走同一路径，但不影响调度计时由 updateAfterRun 统一推进）
 */
export async function runAutomation(automation: Automation, manual = false): Promise<void> {
  if (runningAutomations.has(automation.id)) {
    console.log(`[定时任务] ${automation.name} 上一轮尚未结束，跳过本轮`)
    appendRun(automation.id, {
      runAt: Date.now(),
      sessionId: '',
      status: 'skipped',
      skipReason: '上一轮尚未结束',
    })
    broadcastChanged()
    return
  }

  runningAutomations.add(automation.id)
  const runAt = Date.now()

  // 防休眠（借鉴 Kun 的 powerSaveBlocker）
  const blockerId = powerSaveBlocker.start('prevent-app-suspension')

  try {
    // 根据 sessionMode 决定新建或复用子会话
    //  - reuse：lastSessionId 存在且会话还活着就复用，否则新建
    //  - daily：再叠加一层「同一自然日」+「上下文占用率 < 阈值」双重判断
    //    （基于 automation.lastRunAt 排除 skipped 运行；占用率读不到时按"未知"保守复用）
    const sessionMode = automation.sessionMode ?? AUTOMATION_DEFAULT_SESSION_MODE

    let reuseSessionId: string | undefined
    const lastSessionMeta = automation.lastSessionId ? getAgentSessionMeta(automation.lastSessionId) : undefined
    // 已被用户手动接管（毕业）的会话不再复用，强制新建，避免把定时任务消息注入用户的私人会话
    if (lastSessionMeta?.automationGraduated) {
      console.log(`[定时任务] ${automation.name} 上次会话已被用户接管，本次自动开新会话`)
    }
    if (automation.lastSessionId && lastSessionMeta && !lastSessionMeta.automationGraduated) {
      if (sessionMode === 'reuse') {
        reuseSessionId = automation.lastSessionId
      } else if (
        sessionMode === 'daily' &&
        automation.lastRunAt &&
        isSameLocalDay(automation.lastRunAt, runAt)
      ) {
        const usageSnapshot = getContextUsageCache(automation.lastSessionId)
        const usageRatio = usageSnapshot ? usageSnapshot.percentage / 100 : undefined
        if (usageRatio === undefined || usageRatio < DAILY_CONTEXT_ROLLOVER_THRESHOLD) {
          reuseSessionId = automation.lastSessionId
        } else {
          console.log(
            `[定时任务] ${automation.name} 上下文占用 ${(usageRatio * 100).toFixed(1)}% 已达阈值 ${DAILY_CONTEXT_ROLLOVER_THRESHOLD * 100}%，本次自动开新会话`
          )
        }
      }
    }

    let targetSessionId: string
    if (reuseSessionId) {
      targetSessionId = reuseSessionId
    } else {
      const created = createAgentSession(automation.name, automation.channelId, automation.workspaceId)
      updateAgentSessionMeta(created.id, { sourceAutomationId: automation.id })
      targetSessionId = created.id
      setLastSessionId(automation.id, created.id)
    }

    await new Promise<void>((resolveRun) => {
      let settled = false
      const finish = (status: 'succeeded' | 'failed', error?: string): void => {
        if (settled) return
        settled = true
        if (timeoutTimer) clearTimeout(timeoutTimer)
        const run: AutomationRun = {
          runAt,
          sessionId: targetSessionId,
          status,
          durationMs: Date.now() - runAt,
          error,
        }
        appendRun(automation.id, run)
        broadcastChanged()
        updateAfterRun(automation.id, { status, error })
        dispatchRunNotification(automation, run)
        resolveRun()
      }

      // 超时保护：防止 runAgentHeadless 永远不回调导致 automation 永久卡死
      const timeoutTimer = setTimeout(() => {
        finish('failed', `执行超时（超过 ${RUN_TIMEOUT_MS / 3600_000} 小时）`)
        console.warn(`[定时任务] ${automation.name} 执行超时，强制结束`)
      }, RUN_TIMEOUT_MS)

      // 防递归：注入 automationContext 告诉 Agent 不要再创建定时任务
      const automationContext = `这是定时任务「${automation.name}」的自动执行（ID: ${automation.id}，${formatScheduleLabel(automation)}）。这本身就是定时任务，不要建议用户再创建定时任务。直接执行任务即可。如发现本任务连续失败、输出价值低、频率不合适或提示词不完整，可以使用 automation 工具读取并更新当前任务。`

      runAgentHeadless(
        {
          sessionId: targetSessionId,
          userMessage: automation.prompt + '\n<!--TAGENT_SCHEDULED_RUN-->',
          automationContext,
          channelId: automation.channelId,
          modelId: automation.modelId,
          workspaceId: automation.workspaceId,
          permissionModeOverride: automation.permissionMode ?? 'bypassPermissions',
          triggeredBy: 'automation',
          startedAt: runAt,
        },
        {
          source: 'bridge',
          onError: (error) => finish('failed', error),
          onComplete: () => finish('succeeded'),
          onTitleUpdated: () => { /* 子会话标题不需要特殊处理 */ },
        },
      ).catch((err) => {
        finish('failed', err instanceof Error ? err.message : '未知错误')
      })
    })
  } catch (err) {
    console.error(`[定时任务] ${automation.name} 执行异常:`, err)
    const run: AutomationRun = {
      runAt,
      sessionId: '',
      status: 'failed',
      durationMs: Date.now() - runAt,
      error: err instanceof Error ? err.message : '未知错误',
    }
    appendRun(automation.id, run)
    broadcastChanged()
    updateAfterRun(automation.id, { status: 'failed', error: run.error })
    dispatchRunNotification(automation, run)
  } finally {
    runningAutomations.delete(automation.id)
    if (powerSaveBlocker.isStarted(blockerId)) powerSaveBlocker.stop(blockerId)
  }
}

/** 立即运行一次（手动触发，不影响调度计时之外的逻辑） */
export async function runAutomationNow(id: string): Promise<void> {
  const automation = getAutomation(id)
  if (!automation) throw new Error(`定时任务不存在: ${id}`)
  // 草稿态（缺 channelId / workspaceId）拒绝运行，兜底前端 disabled 防止 IPC 绕过
  if (!automation.channelId || !automation.workspaceId) {
    throw new Error('请先为该任务配置模型与工作区')
  }
  await runAutomation(automation, true)
}

/** 一个 tick：扫描所有 active 且到期的任务并触发 */
function tick(): void {
  const now = Date.now()
  for (const automation of listAutomations()) {
    if (!automation.enabled) continue
    // 完整度兜底：老用户可能存在「enabled=true 但缺工作区 / 渠道」的历史数据，跳过避免运行时崩溃
    if (!automation.channelId || !automation.workspaceId) continue
    if (now < automation.nextRunAt) continue
    if (runningAutomations.has(automation.id)) continue
    // 来源会话忙时跳过（极端情况下的额外保险，主要靠新建子会话规避）
    if (automation.sourceSessionId && isAgentSessionActive(automation.sourceSessionId)) {
      continue
    }
    // 不 await，让多个任务可以并行触发；各自有 runningAutomations 重入保护
    void runAutomation(automation)
  }
}

/**
 * 启动调度器
 *
 * 恢复策略：把已过期的 nextRunAt 顺延到「现在 + 一个完整间隔」，
 * 避免应用重启后一堆历史任务在同一 tick 内雪崩触发。
 */
export function startScheduler(): void {
  if (tickTimer) return
  const now = Date.now()
  for (const automation of listAutomations()) {
    if (automation.enabled && automation.nextRunAt <= now) {
      setNextRunAt(automation.id, computeNextRunAt(automation, now))
    }
  }
  tickTimer = setInterval(tick, TICK_INTERVAL_MS)
  console.log(`[定时任务] 调度器已启动，tick 周期 ${TICK_INTERVAL_MS / 1000}s`)
}

/** 停止调度器（before-quit 调用） */
export function stopScheduler(): void {
  if (tickTimer) {
    clearInterval(tickTimer)
    tickTimer = undefined
    console.log('[定时任务] 调度器已停止')
  }
}
