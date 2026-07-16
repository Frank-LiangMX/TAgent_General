import { describe, expect, it } from 'vitest'
import { detectAutomationIntent, formatScheduleHuman } from './automation-intent-detector'

describe('automation-intent-detector', () => {
  describe('detectAutomationIntent', () => {
    it('should detect daily schedule with time', () => {
      const result = detectAutomationIntent('每天晚上8点帮我整理会话')
      expect(result.detected).toBe(true)
      expect(result.intentType).toBe('create')
      expect(result.schedule?.scheduleType).toBe('daily')
      expect(result.schedule?.timeOfDay).toBe('20:00')
      expect(result.confidence).toBe('high')
    })

    it('should detect interval schedule', () => {
      const result = detectAutomationIntent('每30分钟检查一次')
      expect(result.detected).toBe(true)
      expect(result.schedule?.scheduleType).toBe('interval')
      expect(result.schedule?.intervalMinutes).toBe(30)
    })

    it('should detect weekly schedule', () => {
      const result = detectAutomationIntent('每周一早上提醒我开会')
      expect(result.detected).toBe(true)
      expect(result.schedule?.scheduleType).toBe('weekly')
      expect(result.schedule?.dayOfWeek).toBe(1)
      expect(result.schedule?.timeOfDay).toBe('08:00')
    })

    it('should detect once schedule with relative time', () => {
      const result = detectAutomationIntent('明天提醒我提交报告')
      expect(result.detected).toBe(true)
      expect(result.schedule?.scheduleType).toBe('once')
      expect(result.schedule?.scheduledAt).toBeDefined()
      expect(result.schedule?.scheduledAt!).toBeGreaterThan(Date.now())
    })

    it('should return false for non-schedule messages', () => {
      const result = detectAutomationIntent('今天天气怎么样')
      expect(result.detected).toBe(false)
    })

    it('should parse HH:MM time format', () => {
      const result = detectAutomationIntent('每天 20:30 执行任务')
      expect(result.detected).toBe(true)
      expect(result.schedule?.timeOfDay).toBe('20:30')
    })

    it('should infer task name from message', () => {
      const result = detectAutomationIntent('每天晚上整理会话')
      expect(result.taskName).toContain('整理会话')
    })
  })

  describe('formatScheduleHuman', () => {
    it('should format interval schedule', () => {
      const s1 = {
        scheduleType: 'interval' as const,
        intervalMinutes: 30,
        confidence: 'high' as const,
        rawExpression: '每30分钟',
      }
      expect(formatScheduleHuman(s1)).toBe('每 30 分钟')

      const s2 = {
        scheduleType: 'interval' as const,
        intervalMinutes: 60,
        confidence: 'high' as const,
        rawExpression: '每小时',
      }
      expect(formatScheduleHuman(s2)).toBe('每小时')

      const s3 = {
        scheduleType: 'interval' as const,
        intervalMinutes: 120,
        confidence: 'high' as const,
        rawExpression: '每2小时',
      }
      expect(formatScheduleHuman(s3)).toBe('每 2 小时')
    })

    it('should format daily schedule', () => {
      const s = {
        scheduleType: 'daily' as const,
        timeOfDay: '20:00',
        confidence: 'high' as const,
        rawExpression: '每天',
      }
      expect(formatScheduleHuman(s)).toBe('每天 20:00')
    })

    it('should format weekly schedule', () => {
      const s = {
        scheduleType: 'weekly' as const,
        dayOfWeek: 1,
        timeOfDay: '09:00',
        confidence: 'high' as const,
        rawExpression: '每周一',
      }
      expect(formatScheduleHuman(s)).toBe('每周一 09:00')
    })

    it('should format once schedule', () => {
      const scheduledAt = Date.now() + 86400000 // 明天
      const s = {
        scheduleType: 'once' as const,
        scheduledAt,
        confidence: 'high' as const,
        rawExpression: '明天',
      }
      const result = formatScheduleHuman(s)
      expect(result).toContain('月')
    })
  })
})
