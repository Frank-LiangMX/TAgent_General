/**
 * Automation Intent Service - 定时任务意图检测服务
 *
 * 检测用户消息中的定时任务创建意图，
 * 支持三级 fallback：
 *   L1: SDK 内置意图识别（由 LLM 判断）
 *   L2: 正则匹配关键词（interval/daily/weekly/monthly）
 *   L3: 询问用户确认
 */

import type { AutomationScheduleType } from '@tagent/shared'

/** 时间表达式解析结果 */
export interface ParsedSchedule {
  scheduleType: AutomationScheduleType
  intervalMinutes?: number
  timeOfDay?: string
  dayOfWeek?: number
  dayOfMonth?: number
  scheduledAt?: number
  /** 解析置信度：high / medium / low */
  confidence: 'high' | 'medium' | 'low'
  /** 原始表达（用于 UI 展示） */
  rawExpression: string
}

/** 定时任务意图检测结果 */
export interface AutomationIntent {
  detected: boolean
  /** 意图类型：create / update / query */
  intentType?: 'create' | 'update' | 'query'
  /** 解析出的调度配置 */
  schedule?: ParsedSchedule
  /** 任务名称（从用户消息推断） */
  taskName?: string
  /** 任务描述（原始用户输入） */
  taskDescription?: string
  /** 置信度 */
  confidence: 'high' | 'medium' | 'low'
  /** 是否需要用户确认 */
  needsConfirmation: boolean
}

/** 频率关键词映射 */
const FREQUENCY_KEYWORDS: Record<
  string,
  { scheduleType: AutomationScheduleType; intervalMinutes?: number }
> = {
  // 分钟级
  每分钟: { scheduleType: 'interval', intervalMinutes: 1 },
  每隔一分钟: { scheduleType: 'interval', intervalMinutes: 1 },
  每5分钟: { scheduleType: 'interval', intervalMinutes: 5 },
  每隔5分钟: { scheduleType: 'interval', intervalMinutes: 5 },
  每10分钟: { scheduleType: 'interval', intervalMinutes: 10 },
  每隔10分钟: { scheduleType: 'interval', intervalMinutes: 10 },
  每15分钟: { scheduleType: 'interval', intervalMinutes: 15 },
  每30分钟: { scheduleType: 'interval', intervalMinutes: 30 },
  每半小时: { scheduleType: 'interval', intervalMinutes: 30 },
  每小时: { scheduleType: 'interval', intervalMinutes: 60 },
  每隔一小时: { scheduleType: 'interval', intervalMinutes: 60 },
  'every hour': { scheduleType: 'interval', intervalMinutes: 60 },
  每2小时: { scheduleType: 'interval', intervalMinutes: 120 },
  每3小时: { scheduleType: 'interval', intervalMinutes: 180 },
  每4小时: { scheduleType: 'interval', intervalMinutes: 240 },
  每6小时: { scheduleType: 'interval', intervalMinutes: 360 },
  每12小时: { scheduleType: 'interval', intervalMinutes: 720 },
  // 日级
  每天: { scheduleType: 'daily' },
  每日: { scheduleType: 'daily' },
  everyday: { scheduleType: 'daily' },
  'every day': { scheduleType: 'daily' },
  // 周级
  每周: { scheduleType: 'weekly' },
  每周一: { scheduleType: 'weekly' },
  每周二: { scheduleType: 'weekly' },
  每周三: { scheduleType: 'weekly' },
  每周四: { scheduleType: 'weekly' },
  每周五: { scheduleType: 'weekly' },
  每周六: { scheduleType: 'weekly' },
  每周日: { scheduleType: 'weekly' },
  每周天: { scheduleType: 'weekly' },
  'every week': { scheduleType: 'weekly' },
  // 月级
  每月: { scheduleType: 'monthly' },
  'every month': { scheduleType: 'monthly' },
}

/** 时间点关键词 */
const TIME_KEYWORDS: Record<string, string> = {
  早上: '08:00',
  上午: '09:00',
  中午: '12:00',
  下午: '14:00',
  傍晚: '18:00',
  晚上: '20:00',
  夜里: '22:00',
  深夜: '23:00',
  morning: '08:00',
  noon: '12:00',
  afternoon: '14:00',
  evening: '18:00',
  night: '20:00',
}

/** 星期映射 */
const WEEKDAY_MAP: Record<string, number> = {
  周日: 0,
  周天: 0,
  周一: 1,
  周二: 2,
  周三: 3,
  周四: 4,
  周五: 5,
  周六: 6,
  星期日: 0,
  星期天: 0,
  星期一: 1,
  星期二: 2,
  星期三: 3,
  星期四: 4,
  星期五: 5,
  星期六: 6,
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

/** 创建任务动作关键词 */
const CREATE_ACTION_KEYWORDS = [
  '创建',
  '建立',
  '添加',
  '设置',
  '定时',
  '定期',
  '自动',
  '每天',
  '每周',
  '每月',
  '每小时',
  '每分钟',
  '每半小时',
  '提醒我',
  '帮我',
  '检查',
]

/** 检测用户消息中的定时任务创建意图 */
export function detectAutomationIntent(userMessage: string): AutomationIntent {
  const normalizedMsg = userMessage.toLowerCase().trim()

  // 快速排除：不包含任何创建关键词
  const hasCreateIntent = CREATE_ACTION_KEYWORDS.some((kw) => normalizedMsg.includes(kw))
  if (!hasCreateIntent) {
    return { detected: false, confidence: 'high', needsConfirmation: false }
  }

  // 尝试解析调度配置
  const schedule = parseScheduleExpression(normalizedMsg)
  if (!schedule) {
    return {
      detected: true,
      intentType: 'query',
      confidence: 'low',
      needsConfirmation: true,
      taskDescription: userMessage,
    }
  }

  // 推断任务名称
  const taskName = inferTaskName(userMessage, schedule)

  return {
    detected: true,
    intentType: 'create',
    schedule,
    taskName,
    taskDescription: userMessage,
    confidence: schedule.confidence,
    needsConfirmation: schedule.confidence !== 'high',
  }
}

/** 解析时间表达式 */
function parseScheduleExpression(message: string): ParsedSchedule | null {
  // 0. 先尝试匹配相对时间（明天、下周等）- 优先级最高
  const relativeMatch = message.match(/(明天|后天|下周|下个月)/i)
  if (relativeMatch) {
    const baseDate = new Date()

    switch (relativeMatch[1]) {
      case '明天':
        baseDate.setDate(baseDate.getDate() + 1)
        break
      case '后天':
        baseDate.setDate(baseDate.getDate() + 2)
        break
      case '下周':
        baseDate.setDate(baseDate.getDate() + 7)
        break
      case '下个月':
        baseDate.setMonth(baseDate.getMonth() + 1)
        break
    }

    // 解析时间点
    const timeOfDay = parseTimeOfDay(message)
    if (timeOfDay) {
      const [h, m] = timeOfDay.split(':').map(Number) as [number, number]
      baseDate.setHours(h, m, 0, 0)
    } else {
      baseDate.setHours(9, 0, 0, 0) // 默认上午 9 点
    }

    return {
      scheduleType: 'once',
      scheduledAt: baseDate.getTime(),
      confidence: 'high',
      rawExpression: relativeMatch[1]!,
    }
  }

  // 1. 尝试匹配频率关键词
  for (const [keyword, config] of Object.entries(FREQUENCY_KEYWORDS)) {
    if (message.includes(keyword.toLowerCase())) {
      const result: ParsedSchedule = {
        scheduleType: config.scheduleType,
        confidence: 'high',
        rawExpression: keyword,
      }

      if (config.intervalMinutes) {
        result.intervalMinutes = config.intervalMinutes
      }

      // 解析时间点
      const timeOfDay = parseTimeOfDay(message)
      if (timeOfDay) {
        result.timeOfDay = timeOfDay
      }

      // 解析星期（仅 weekly）
      if (config.scheduleType === 'weekly') {
        result.dayOfWeek = parseDayOfWeek(message)
      }

      return result
    }
  }

  // 2. 尝试匹配 HH:MM 时间格式
  const timeMatch = message.match(/(\d{1,2}):(\d{2})/)
  if (timeMatch) {
    const hours = parseInt(timeMatch[1]!, 10)
    const minutes = parseInt(timeMatch[2]!, 10)
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      // 根据上下文判断是 daily 还是 once
      const isRecurring =
        message.includes('每天') || message.includes('每日') || message.includes('everyday')
      return {
        scheduleType: isRecurring ? 'daily' : 'once',
        timeOfDay: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
        confidence: 'medium',
        rawExpression: timeMatch[0],
      }
    }
  }

  return null
}

/** 解析时间点 */
function parseTimeOfDay(message: string): string | undefined {
  // 1. 匹配 HH:MM 格式
  const timeMatch = message.match(/(\d{1,2}):(\d{2})/)
  if (timeMatch) {
    const hours = parseInt(timeMatch[1]!, 10)
    const minutes = parseInt(timeMatch[2]!, 10)
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
    }
  }

  // 2. 匹配时间点关键词
  for (const [keyword, time] of Object.entries(TIME_KEYWORDS)) {
    if (message.includes(keyword)) {
      return time
    }
  }

  // 3. 匹配数字 + 点/点钟
  const hourMatch = message.match(/(\d{1,2})\s*点(?:钟)?/)
  if (hourMatch) {
    const hours = parseInt(hourMatch[1]!, 10)
    if (hours >= 0 && hours <= 23) {
      return `${hours.toString().padStart(2, '0')}:00`
    }
  }

  return undefined
}

/** 解析星期 */
function parseDayOfWeek(message: string): number | undefined {
  for (const [keyword, day] of Object.entries(WEEKDAY_MAP)) {
    if (message.includes(keyword)) {
      return day
    }
  }
  return undefined
}

/** 推断任务名称 */
function inferTaskName(message: string, schedule: ParsedSchedule): string {
  // 移除时间相关词汇，提取核心任务
  let name = message
    .replace(/(每天|每周|每月|每小时|每分钟|每隔|定时|定期|自动|帮我|创建|设置|提醒我)/gi, '')
    .replace(/(\d{1,2}:\d{2}|\d{1,2}点)/g, '')
    .replace(/(早上|上午|中午|下午|晚上|夜里|深夜|morning|noon|afternoon|evening|night)/gi, '')
    .trim()

  // 截断到合理长度
  if (name.length > 50) {
    name = name.substring(0, 50) + '...'
  }

  // 如果提取后为空，使用默认名称
  if (!name) {
    const typeLabel: Record<AutomationScheduleType, string> = {
      interval: '定时任务',
      daily: '每日任务',
      weekly: '每周任务',
      monthly: '每月任务',
      once: '一次性提醒',
    }
    name = typeLabel[schedule.scheduleType] || '定时任务'
  }

  return name
}

/** 格式化调度配置为人类可读字符串 */
export function formatScheduleHuman(schedule: ParsedSchedule): string {
  switch (schedule.scheduleType) {
    case 'interval': {
      const minutes = schedule.intervalMinutes ?? 10
      if (minutes < 60) {
        return `每 ${minutes} 分钟`
      } else if (minutes === 60) {
        return '每小时'
      } else {
        return `每 ${minutes / 60} 小时`
      }
    }
    case 'daily':
      return `每天 ${schedule.timeOfDay ?? '09:00'}`
    case 'weekly': {
      const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
      const day = dayNames[schedule.dayOfWeek ?? 1]
      return `每${day} ${schedule.timeOfDay ?? '09:00'}`
    }
    case 'monthly':
      return `每月 ${schedule.dayOfMonth ?? 1} 号 ${schedule.timeOfDay ?? '09:00'}`
    case 'once':
      if (schedule.scheduledAt) {
        const date = new Date(schedule.scheduledAt)
        return date.toLocaleString('zh-CN', {
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      }
      return '一次性任务'
  }
}
