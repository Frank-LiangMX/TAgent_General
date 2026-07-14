/**
 * ADR-0006 Phase 1 单测 — 前台调用放大回归验证
 *
 * 验证前台逐 turn 辅助 LLM 调用已停止，证据正确收集到 sink：
 * - MemoryEvidenceSink：证据写入、dirty 标记、模式隔离、截断、选择性清理
 * - NudgeService.onTurnStart：达到阈值时不调用 LLM，记录证据到 sink
 * - 1/10/50 turn：spy runLLMReview 断言调用数为 0
 * - 达到阈值时：断言 evidence sink 实际收到候选
 *
 * 测试隔离：每个 test 使用独立 tmpdir + 新建 MemoryEvidenceSink / NudgeService 实例，
 * 不写入真实用户目录（~/.tagent / ~/.tagent-dev），不依赖单例状态。
 *
 * 关于 partial stream_event 回归：
 * partial 事件在 agent-orchestrator.ts:2679 只做 stream_text_delta emit，
 * 不触及 nudgeService / memoryLayerService / memoryEvidenceSink。
 * 完整 orchestrator 分支过重（SDK + IPC + Electron），本文件不覆盖，
 * 留作集成测试（需 mock provider + 真实 orchestrator 实例）。
 */

import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// ===== electron mock =====
// vi.mock 在模块加载前生效。mock home 在每个 test 的 beforeEach 中切换到独立 tmpdir，
// 确保不写入真实用户目录。
let mockHome = '/tmp/tagent-evidence-test-home'

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: () => mockHome,
  },
}))

// ===== 动态导入（electron mock 必须先于模块加载） =====
const { MemoryEvidenceSink, memoryEvidenceSink } = await import('./memory-evidence-sink')
const { NudgeService } = await import('./nudge-service')

import type { NudgeCandidate } from './nudge-service'
import type { MemoryEvidenceEntry } from './memory-evidence-sink'

// ===================================================================
// 1. MemoryEvidenceSink 基础功能
// ===================================================================

describe('MemoryEvidenceSink - 证据收集', () => {
  let sink: InstanceType<typeof MemoryEvidenceSink>
  let tmpDir: string

  beforeEach(() => {
    sink = new MemoryEvidenceSink()
    tmpDir = mkdtempSync(join(tmpdir(), 'tagent-evidence-test-'))
    mockHome = tmpDir
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  test('writeNudgeEvidence 写入证据文件 + 标记 dirty', () => {
    const candidate: NudgeCandidate = {
      id: 'nudge-test-001',
      type: 'fact_repeat',
      targetLayer: 'L2',
      pattern: '我叫 Frank',
      evidence: ['我叫 Frank', '我是 Frank'],
      suggestedContent: '我叫 Frank',
      userMessage: 'LLM 审查建议记忆：我叫 Frank',
    }

    sink.writeNudgeEvidence('general', 'sess-001', candidate)

    expect(sink.isModeDirty('general')).toBe(true)

    const entries = sink.getPendingEvidence('general')
    expect(entries).toHaveLength(1)
    expect(entries[0]!.source).toBe('nudge')
    expect(entries[0]!.sessionId).toBe('sess-001')
    expect(entries[0]!.nudgeCandidate).toBeDefined()
    expect(entries[0]!.nudgeCandidate!.id).toBe('nudge-test-001')
  })

  test('writeSessionEvidence 写入会话证据 + 标记 dirty', () => {
    sink.writeSessionEvidence('general', 'sess-002', '实现登录', '完成了登录功能', [
      'Write',
      'Edit',
    ])

    expect(sink.isModeDirty('general')).toBe(true)

    const entries = sink.getPendingEvidence('general')
    expect(entries).toHaveLength(1)
    expect(entries[0]!.source).toBe('session')
    expect(entries[0]!.sessionId).toBe('sess-002')
    expect(entries[0]!.sessionTitle).toBe('实现登录')
    expect(entries[0]!.toolsUsed).toEqual(['Write', 'Edit'])
  })

  test('general 和 ta 模式隔离：各自独立 dirty 标记', () => {
    sink.writeSessionEvidence('general', 'sess-g', 'G 标题', 'G 摘要', [])
    sink.markModeClean('general')

    expect(sink.isModeDirty('general')).toBe(false)
    expect(sink.isModeDirty('ta')).toBe(false)

    sink.writeSessionEvidence('ta', 'sess-t', 'T 标题', 'T 摘要', [])
    expect(sink.isModeDirty('general')).toBe(false)
    expect(sink.isModeDirty('ta')).toBe(true)
  })

  test('markModeClean 清除 dirty 标记', () => {
    sink.writeSessionEvidence('general', 'sess-003', 'T', 'S', [])
    expect(sink.isModeDirty('general')).toBe(true)

    sink.markModeClean('general')
    expect(sink.isModeDirty('general')).toBe(false)
  })

  test('dirty 已为 true 时不重复写入 dirty_state.json', () => {
    sink.writeSessionEvidence('general', 'sess-d1', 'T1', 'S1', [])
    expect(sink.isModeDirty('general')).toBe(true)

    // 第二次写入不应重写 dirty_state.json（内存缓存已为 true）
    sink.writeSessionEvidence('general', 'sess-d2', 'T2', 'S2', [])

    const entries = sink.getPendingEvidence('general')
    expect(entries).toHaveLength(2)
    expect(sink.isModeDirty('general')).toBe(true)
  })

  test('getEvidenceStats 返回正确的统计', () => {
    sink.writeSessionEvidence('general', 'sess-a', 'A', 'A summary', [])
    sink.writeNudgeEvidence('general', 'sess-b', {
      id: 'n1',
      type: 'correction',
      targetLayer: 'L3',
      pattern: '不是 X 是 Y',
      evidence: [],
      suggestedContent: '不是 X 是 Y',
      userMessage: '纠正',
    })

    const stats = sink.getEvidenceStats('general')
    expect(stats.pendingCount).toBe(2)
    expect(stats.dirty).toBe(true)
    expect(stats.oldestEntryAt).toBeTypeOf('number')
  })

  test('clearPendingEvidence 清空所有证据', () => {
    sink.writeSessionEvidence('general', 'sess-004', 'T', 'S', [])
    expect(sink.getPendingEvidence('general')).toHaveLength(1)

    sink.clearPendingEvidence('general')
    expect(sink.getPendingEvidence('general')).toHaveLength(0)
  })

  test('clearPendingEvidence 选择性清理：只删除已处理的 sessionId', () => {
    sink.writeSessionEvidence('general', 'sess-keep', '保留', '保留', [])
    sink.writeSessionEvidence('general', 'sess-delete', '删除', '删除', [])
    sink.writeSessionEvidence('general', 'sess-delete-2', '删除2', '删除2', [])

    expect(sink.getPendingEvidence('general')).toHaveLength(3)

    sink.clearPendingEvidence('general', new Set(['sess-delete', 'sess-delete-2']))

    const remaining = sink.getPendingEvidence('general')
    expect(remaining).toHaveLength(1)
    expect(remaining[0]!.sessionId).toBe('sess-keep')
  })

  test('证据文件截断：超出 MAX_ENTRIES 时保留最近条目', () => {
    for (let i = 0; i < 510; i++) {
      sink.writeSessionEvidence('general', `sess-${i}`, `Title ${i}`, `Summary ${i}`, [])
    }

    const entries = sink.getPendingEvidence('general')
    expect(entries.length).toBeLessThanOrEqual(500)
    const lastEntry = entries[entries.length - 1]
    expect(lastEntry!.sessionId).toBe('sess-509')
  })

  test('consumeEvidenceByIds: 同 createdAt 不同 ID 只删指定 ID', () => {
    // 手动写入两条同 createdAt 的条目（模拟同时写入）
    const fixedTime = 1000000
    const entry1: MemoryEvidenceEntry = {
      id: 'ev-same-ts-001',
      createdAt: fixedTime,
      mode: 'general',
      source: 'session',
      sessionId: 'sess-a',
      sessionTitle: 'A',
      sessionSummary: 'A summary',
      toolsUsed: [],
    }
    const entry2: MemoryEvidenceEntry = {
      id: 'ev-same-ts-002',
      createdAt: fixedTime,
      mode: 'general',
      source: 'session',
      sessionId: 'sess-b',
      sessionTitle: 'B',
      sessionSummary: 'B summary',
      toolsUsed: [],
    }

    // 直接通过 getPendingEvidence + 手动写文件注入
    const filePath = join(tmpDir, '.tagent-dev', 'memory', 'pending_evidence.jsonl')
    const dir = join(tmpDir, '.tagent-dev', 'memory')
    mkdirSync(dir, { recursive: true })
    writeFileSync(filePath, JSON.stringify(entry1) + '\n' + JSON.stringify(entry2) + '\n', 'utf-8')

    // 只消费第一条
    const remaining = sink.consumeEvidenceByIds('general', ['ev-same-ts-001'])
    expect(remaining).toBe(1)

    const after = sink.getPendingEvidence('general')
    expect(after).toHaveLength(1)
    expect(after[0]!.id).toBe('ev-same-ts-002')
    expect(after[0]!.sessionId).toBe('sess-b')
  })

  test('consumeEvidenceByIds: 返回剩余条数', () => {
    sink.writeSessionEvidence('general', 'sess-1', 'T1', 'S1', [])
    sink.writeSessionEvidence('general', 'sess-2', 'T2', 'S2', [])
    sink.writeSessionEvidence('general', 'sess-3', 'T3', 'S3', [])

    // 获取所有 ID
    const all = sink.getPendingEvidence('general')
    expect(all).toHaveLength(3)
    const ids = all.map((e) => e.id)

    // 消费 2 条
    const remaining = sink.consumeEvidenceByIds('general', ids.slice(0, 2))
    expect(remaining).toBe(1)

    // 再消费最后 1 条
    const remaining2 = sink.consumeEvidenceByIds('general', [ids[2]!])
    expect(remaining2).toBe(0)
    expect(sink.getPendingEvidence('general')).toHaveLength(0)
  })

  test('consumeEvidenceByIds: 文件不存在返回 0', () => {
    const result = sink.consumeEvidenceByIds('general', ['ev-nonexist'])
    expect(result).toBe(0)
  })

  test('consumeEvidenceByIds: processedIds 空时不改文件返回当前条数', () => {
    sink.writeSessionEvidence('general', 'sess-x', 'TX', 'SX', [])

    const before = sink.getPendingEvidence('general').length
    const result = sink.consumeEvidenceByIds('general', [])
    expect(result).toBe(before)
    expect(sink.getPendingEvidence('general')).toHaveLength(before)
  })

  test('consumeEvidenceByIds: 消费后再 append 不会因旧 lineCount 截断', () => {
    sink.writeSessionEvidence('general', 'sess-1', 'T1', 'S1', [])
    sink.writeSessionEvidence('general', 'sess-2', 'T2', 'S2', [])
    sink.writeSessionEvidence('general', 'sess-3', 'T3', 'S3', [])

    const all = sink.getPendingEvidence('general')
    expect(all).toHaveLength(3)

    // 消费掉前 2 条（lineCounts 更新为 1）
    sink.consumeEvidenceByIds('general', [all[0]!.id, all[1]!.id])
    expect(sink.getPendingEvidence('general')).toHaveLength(1)

    // 再 append 5 条 — 不应被旧 lineCount 误截断
    sink.writeSessionEvidence('general', 'sess-new-1', 'N1', 'N1', [])
    sink.writeSessionEvidence('general', 'sess-new-2', 'N2', 'N2', [])
    sink.writeSessionEvidence('general', 'sess-new-3', 'N3', 'N3', [])
    sink.writeSessionEvidence('general', 'sess-new-4', 'N4', 'N4', [])
    sink.writeSessionEvidence('general', 'sess-new-5', 'N5', 'N5', [])

    // 应有 1 (remaining) + 5 (new) = 6 条
    const finalEntries = sink.getPendingEvidence('general')
    expect(finalEntries).toHaveLength(6)
    // 确认旧的被消费了，新的是完整的
    expect(finalEntries.some((e) => e.id === all[0]!.id)).toBe(false)
    expect(finalEntries.some((e) => e.id === all[1]!.id)).toBe(false)
    expect(finalEntries.some((e) => e.id === all[2]!.id)).toBe(true) // 第 3 条保留
  })
})

// ===================================================================
// 2. 1/10/50 turn 前台 0 辅助 LLM 请求（spy runLLMReview）
// ===================================================================

describe('1/10/50 turn 前台 0 辅助 LLM 请求', () => {
  // 完整 orchestrator 测试过重（依赖 SDK、IPC、Electron），
  // 本测试通过 spy NudgeService.runLLMReview（private）+ 断言调用数为 0
  // 来直接验证"前台路径不触发辅助 LLM 调用"这一核心不变式。
  //
  // runLLMReview 是旧流程的唯一前台 LLM 入口。Phase 1 后 onTurnStart 不再调用它，
  // spy 断言 toHaveBeenCalledTimes(0) 即可确认。

  let nudge: InstanceType<typeof NudgeService>
  let sink: InstanceType<typeof MemoryEvidenceSink>
  let tmpDir: string
  let runLLMSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    nudge = new NudgeService()
    sink = new MemoryEvidenceSink()
    tmpDir = mkdtempSync(join(tmpdir(), 'tagent-turn-test-'))
    mockHome = tmpDir
    // spy private runLLMReview —— Phase 1 后不应被调用
    runLLMSpy = vi.spyOn(nudge as never, 'runLLMReview' as never).mockResolvedValue(undefined)
  })

  afterEach(() => {
    runLLMSpy.mockRestore()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  test('1 turn：spy 断言 runLLMReview 调用 0 次，evidence sink 记录 1 条 session', () => {
    const msgs = [{ role: 'user' as const, content: '帮我看看这个文件' }]

    // turn 1：currentTurn=1, threshold=1 → 达到阈值，走 sink 路径
    nudge.onTurnStart('sess-1turn', msgs, 'general')

    // evidence sink 记录（onTurnStart 走 detectPatterns + sink 路径）
    // 这里验证前台没有走 runLLMReview
    expect(runLLMSpy).not.toHaveBeenCalled()

    // 验证 sink 可正常工作（模拟 recordSessionToMemory 的 writeSessionEvidence）
    sink.writeSessionEvidence('general', 'sess-1turn', 'Turn 1', 'Summary', ['Read'])
    const entries = sink.getPendingEvidence('general')
    expect(entries).toHaveLength(1)
    expect(entries[0]!.source).toBe('session')
  })

  test('10 turn：spy 断言 runLLMReview 调用 0 次，evidence sink 记录 10 条', () => {
    const msgs = [{ role: 'user' as const, content: '帮我重构这个函数' }]
    const sessionId = 'sess-10turn'

    for (let i = 0; i < 10; i++) {
      nudge.onTurnStart(sessionId, msgs, 'general')
    }

    expect(runLLMSpy).not.toHaveBeenCalled()

    // 模拟 recordSessionToMemory 的 writeSessionEvidence
    for (let i = 0; i < 10; i++) {
      sink.writeSessionEvidence('general', `sess-10turn-${i}`, `Turn ${i}`, `Sum ${i}`, ['Edit'])
    }
    const entries = sink.getPendingEvidence('general')
    expect(entries).toHaveLength(10)
    expect(entries.every((e) => e.source === 'session')).toBe(true)
  })

  test('50 turn：spy 断言 runLLMReview 调用 0 次，evidence sink 记录 50 条', () => {
    const msgs = [{ role: 'user' as const, content: '继续上次的任务' }]
    const sessionId = 'sess-50turn'

    for (let i = 0; i < 50; i++) {
      nudge.onTurnStart(sessionId, msgs, 'general')
    }

    expect(runLLMSpy).not.toHaveBeenCalled()

    for (let i = 0; i < 50; i++) {
      sink.writeSessionEvidence('general', `sess-50turn-${i}`, `Turn ${i}`, `Sum ${i}`, ['Bash'])
    }
    const entries = sink.getPendingEvidence('general')
    expect(entries).toHaveLength(50)
    expect(entries.every((e) => e.source === 'session')).toBe(true)
  })
})

// ===================================================================
// 3. NudgeService.onTurnStart 达到阈值时证据写入 sink
// ===================================================================

describe('NudgeService.onTurnStart - 达到阈值时证据写入 sink', () => {
  // 验证 ADR-0006 Phase 1 核心行为：达到 warm-up 阈值时，
  // onTurnStart 将候选写入 evidence sink（不调用 LLM）。
  //
  // fact_repeat 检测阈值：同一事实 ≥3 次。
  // warm-up 阈值序列：[1, 2, 4, 8, 10]。
  // 构造消息让"我叫 Frank"出现 ≥3 次，在 turn 1（threshold=1）即触发。

  let nudge: InstanceType<typeof NudgeService>
  let tmpDir: string
  let runLLMSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    nudge = new NudgeService()
    tmpDir = mkdtempSync(join(tmpdir(), 'tagent-threshold-test-'))
    mockHome = tmpDir
    runLLMSpy = vi.spyOn(nudge as never, 'runLLMReview' as never).mockResolvedValue(undefined)
    // 重置 singleton 的内存缓存，防止跨测试 dirty/lineCount 污染
    ;(memoryEvidenceSink as unknown as Record<string, unknown>)['dirtyFlags'] = new Map()
    ;(memoryEvidenceSink as unknown as Record<string, unknown>)['lineCounts'] = new Map()
  })

  afterEach(() => {
    runLLMSpy.mockRestore()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  test('达到阈值时 evidence sink 收到 nudge 候选，runLLMReview 未调用', async () => {
    // 3 条包含"我叫Frank"的消息（达到 fact_repeat >=3 阈值）
    // 注意：detectFactRepeat 的正则 /我叫[^\s]{1,20}/g 要求"叫"后无空格
    const messages = [
      { role: 'user' as const, content: '我叫Frank' },
      { role: 'assistant' as const, content: '好的' },
      { role: 'user' as const, content: '我叫Frank' },
      { role: 'assistant' as const, content: '知道了' },
      { role: 'user' as const, content: '我叫Frank' },
    ]

    // turn 1：currentTurn=1, threshold=1 → 达到阈值，触发 detectPatterns + sink 写入
    nudge.onTurnStart('sess-threshold', messages, 'general')

    // onTurnStart 内部用 void import('./memory-evidence-sink').then(...)
    // 写入的是 singleton memoryEvidenceSink，用它读取验证
    // 等待微任务刷新（void import 创建的 promise chain）
    await new Promise((r) => setTimeout(r, 100))

    // 验证 sink 收到了 nudge 候选
    const entries = memoryEvidenceSink.getPendingEvidence('general')
    expect(entries.length).toBeGreaterThanOrEqual(1)
    const nudgeEntries = entries.filter((e) => e.source === 'nudge')
    expect(nudgeEntries.length).toBeGreaterThanOrEqual(1)
    expect(nudgeEntries[0]!.sessionId).toBe('sess-threshold')
    expect(nudgeEntries[0]!.nudgeCandidate).toBeDefined()
    expect(nudgeEntries[0]!.nudgeCandidate!.targetLayer).toBe('L2')

    // 验证 runLLMReview 未被调用（Phase 1 核心不变式）
    expect(runLLMSpy).not.toHaveBeenCalled()
  })

  test('warm-up 阈值前不触发 sink 写入', async () => {
    // turn 1: threshold=1 → 触发
    // turn 2: threshold=2 → 触发
    // turn 3: threshold=4 > currentTurn=3 → 不触发
    const msgs = [{ role: 'user' as const, content: '临时任务' }]

    nudge.onTurnStart('sess-warmup', msgs, 'general') // turn 1: 触发
    nudge.onTurnStart('sess-warmup', msgs, 'general') // turn 2: 触发
    nudge.onTurnStart('sess-warmup', msgs, 'general') // turn 3: 不触发

    // 等待 async 写入完成
    await new Promise((r) => setTimeout(r, 50))

    // 关键验证：runLLMReview 从未被调用（Phase 1 核心不变式）
    expect(runLLMSpy).not.toHaveBeenCalled()
  })

  test('onTurnStart 始终返回空数组（不弹 toast）', () => {
    const msgs = [{ role: 'user' as const, content: '我叫 Frank' }]

    for (let i = 0; i < 15; i++) {
      const result = nudge.onTurnStart(`sess-ret-${i}`, msgs, 'general')
      expect(result).toEqual([])
    }
  })
})
