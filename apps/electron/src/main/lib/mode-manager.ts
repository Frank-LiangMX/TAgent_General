/**
 * ModeManager - 模式管理服务
 *
 * 负责：
 * - 模式切换互斥锁
 * - 后台任务状态追踪
 * - 切换时的暂停/恢复逻辑
 * - 完成后的 PushNotification 通知
 */

import { BrowserWindow, Notification } from 'electron'
import { EventEmitter } from 'events'

/** 顶层模式 */
export type TopLevelMode = 'general' | 'ta'

/** 后台任务状态 */
export interface BackgroundTask {
  /** 任务 ID（通常是 sessionId） */
  id: string
  /** 所属模式 */
  mode: TopLevelMode
  /** 任务描述 */
  description: string
  /** 开始时间 */
  startTime: number
  /** 是否已完成 */
  completed: boolean
}

/** 模式切换请求 */
export interface ModeSwitchRequest {
  /** 目标模式 */
  targetMode: TopLevelMode
  /** 触发源 */
  source: 'user-click' | 'switch-tool' | 'api'
  /** 是否强制切换（忽略后台任务） */
  force?: boolean
  /** 切换原因（switch_tool 时提供） */
  reason?: string
  /** 上下文摘要（switch_tool 时提供） */
  contextSummary?: string
}

/** 模式切换结果 */
export interface ModeSwitchResult {
  /** 是否成功 */
  success: boolean
  /** 当前模式 */
  currentMode: TopLevelMode
  /** 被暂停的任务 */
  pausedTasks: BackgroundTask[]
  /** 错误信息 */
  error?: string
}

class ModeManagerImpl extends EventEmitter {
  /** 当前活跃模式 */
  private activeMode: TopLevelMode = 'general'

  /** 互斥锁 - 是否正在切换中 */
  private isSwitching = false

  /** 后台任务 Map - mode -> tasks */
  private backgroundTasks: Map<TopLevelMode, BackgroundTask[]> = new Map([
    ['general', []],
    ['ta', []],
  ])

  /** 暂停状态 Map - mode -> isPaused */
  private pausedModes: Map<TopLevelMode, boolean> = new Map([
    ['general', false],
    ['ta', false],
  ])

  /** 切换锁超时（ms） */
  private readonly SWITCH_LOCK_TIMEOUT = 5000

  /** 后台任务超时（ms）- 超过此时间的任务视为过期 */
  private readonly TASK_EXPIRY = 30 * 60 * 1000 // 30 分钟

  /**
   * 获取当前活跃模式
   */
  getActiveMode(): TopLevelMode {
    return this.activeMode
  }

  /**
   * 设置活跃模式（仅内部使用，不检查锁）
   */
  setActiveMode(mode: TopLevelMode): void {
    const previousMode = this.activeMode
    this.activeMode = mode
    this.emit('mode-changed', { previousMode, currentMode: mode })
  }

  /**
   * 检查是否可以切换模式
   */
  canSwitchMode(request: ModeSwitchRequest): { canSwitch: boolean; reason?: string } {
    // 检查是否正在切换中
    if (this.isSwitching) {
      return { canSwitch: false, reason: '正在切换模式中，请稍候' }
    }

    // 检查是否是同一个模式
    if (this.activeMode === request.targetMode) {
      return { canSwitch: false, reason: '已经在目标模式中' }
    }

    // 检查后台任务（非强制切换时）
    if (!request.force) {
      const currentTasks = this.getActiveBackgroundTasks()
      if (currentTasks.length > 0) {
        return {
          canSwitch: false,
          reason: `当前有 ${currentTasks.length} 个后台任务正在运行`,
        }
      }
    }

    return { canSwitch: true }
  }

  /**
   * 切换模式
   */
  async switchMode(request: ModeSwitchRequest): Promise<ModeSwitchResult> {
    const check = this.canSwitchMode(request)
    if (!check.canSwitch) {
      return {
        success: false,
        currentMode: this.activeMode,
        pausedTasks: [],
        error: check.reason,
      }
    }

    // 获取锁
    this.isSwitching = true
    const lockTimer = setTimeout(() => {
      this.isSwitching = false
    }, this.SWITCH_LOCK_TIMEOUT)

    try {
      const previousMode = this.activeMode
      const pausedTasks = request.force ? this.getActiveBackgroundTasks() : []

      // 暂停当前模式的任务
      if (request.force && pausedTasks.length > 0) {
        this.pauseMode(previousMode)
      }

      // 切换模式
      this.activeMode = request.targetMode

      // 恢复目标模式（如果之前被暂停）
      this.resumeMode(request.targetMode)

      // 发送事件
      this.emit('mode-switched', {
        previousMode,
        currentMode: request.targetMode,
        pausedTasks,
        source: request.source,
      })

      return {
        success: true,
        currentMode: request.targetMode,
        pausedTasks,
      }
    } finally {
      clearTimeout(lockTimer)
      this.isSwitching = false
    }
  }

  /**
   * 注册后台任务
   */
  registerBackgroundTask(task: Omit<BackgroundTask, 'startTime' | 'completed'>): void {
    const fullTask: BackgroundTask = {
      ...task,
      startTime: Date.now(),
      completed: false,
    }
    const tasks = this.backgroundTasks.get(task.mode) || []
    tasks.push(fullTask)
    this.backgroundTasks.set(task.mode, tasks)
    this.emit('task-registered', fullTask)
  }

  /**
   * 完成后台任务
   */
  completeBackgroundTask(taskId: string, mode: TopLevelMode): void {
    const tasks = this.backgroundTasks.get(mode) || []
    const task = tasks.find((t) => t.id === taskId)
    if (task) {
      task.completed = true
      this.emit('task-completed', task)

      // 如果当前不在该模式，发送通知
      if (this.activeMode !== mode) {
        this.sendTaskCompletionNotification(task)
      }

      // 清理已完成的任务
      this.cleanupCompletedTasks(mode)
    }
  }

  /**
   * 获取活跃的后台任务
   */
  getActiveBackgroundTasks(): BackgroundTask[] {
    const tasks = this.backgroundTasks.get(this.activeMode) || []
    const now = Date.now()
    return tasks.filter((t) => !t.completed && now - t.startTime < this.TASK_EXPIRY)
  }

  /**
   * 获取指定模式的后台任务
   */
  getBackgroundTasksForMode(mode: TopLevelMode): BackgroundTask[] {
    const tasks = this.backgroundTasks.get(mode) || []
    const now = Date.now()
    return tasks.filter((t) => !t.completed && now - t.startTime < this.TASK_EXPIRY)
  }

  /**
   * 检查模式是否被暂停
   */
  isModePaused(mode: TopLevelMode): boolean {
    return this.pausedModes.get(mode) || false
  }

  /**
   * 暂停模式
   */
  private pauseMode(mode: TopLevelMode): void {
    this.pausedModes.set(mode, true)
    this.emit('mode-paused', mode)
  }

  /**
   * 恢复模式
   */
  private resumeMode(mode: TopLevelMode): void {
    this.pausedModes.set(mode, false)
    this.emit('mode-resumed', mode)
  }

  /**
   * 清理已完成的任务
   */
  private cleanupCompletedTasks(mode: TopLevelMode): void {
    const tasks = this.backgroundTasks.get(mode) || []
    const activeTasks = tasks.filter((t) => !t.completed)
    this.backgroundTasks.set(mode, activeTasks)
  }

  /**
   * 发送任务完成通知
   */
  private sendTaskCompletionNotification(task: BackgroundTask): void {
    const modeLabel = task.mode === 'general' ? '通用模式' : 'TA 模式'

    // 发送 Electron Notification
    const notification = new Notification({
      title: `${modeLabel}任务完成`,
      body: task.description,
      silent: false,
    })

    notification.on('click', () => {
      // 点击通知时，切换到对应模式
      this.switchMode({
        targetMode: task.mode,
        source: 'user-click',
        force: true,
      }).catch((err) => {
        console.error('[ModeManager] 切换模式失败:', err)
      })

      // 聚焦窗口
      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (mainWindow) {
        mainWindow.focus()
      }
    })

    notification.show()

    // 同时发送事件给 Renderer
    this.emit('task-notification', {
      mode: task.mode,
      message: `${modeLabel}任务完成: ${task.description}`,
    })
  }

  /**
   * 获取状态摘要（供 Renderer 使用）
   */
  getStatusSummary(): {
    activeMode: TopLevelMode
    isSwitching: boolean
    generalTasks: number
    taTasks: number
    generalPaused: boolean
    taPaused: boolean
  } {
    return {
      activeMode: this.activeMode,
      isSwitching: this.isSwitching,
      generalTasks: this.getBackgroundTasksForMode('general').length,
      taTasks: this.getBackgroundTasksForMode('ta').length,
      generalPaused: this.isModePaused('general'),
      taPaused: this.isModePaused('ta'),
    }
  }
}

// 单例导出
export const ModeManager = new ModeManagerImpl()
