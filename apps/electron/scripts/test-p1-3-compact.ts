/**
 * P1-3 compactSession 集成测试
 *
 * 跑法: bun run apps/electron/scripts/test-p1-3-compact.ts
 *
 * 构造 4 种假 session.jsonl 场景, 调 compactSession() 验证:
 *   1. drop_old_tool_results: 丢老 tool_use/tool_result, 保留文本
 *   2. keep_last_n: 保留最近 N 条 user+assistant + 全部 system
 *   3. summarize: 返回 "未实现" 提示, 不改文件
 *   4. 边界: 文件不存在 / 空文件 / 损坏行
 *
 * 不启 Electron, 直接 mock config-paths 指向 temp dir
 */

// === mock module (必须在所有 import 之前) ===
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { mock } from 'bun:test'

// tempDir 必须在 mock 之前, 因为 mock 闭包引用
const tempDir = mkdtempSync(join(tmpdir(), 'tagent-p1-3-'))

mock.module('../src/main/lib/config-paths', () => ({
  getAgentSessionMessagesPath: (id: string) => join(tempDir, `${id}.jsonl`),
}))

// 现在 import (config-paths 已经被 mock 覆盖)
import { compactSession } from '../src/main/lib/agent-session-compactor'

// === 工具函数 ===
function writeSessionFile(sessionId: string, messages: object[]): string {
  const filePath = join(tempDir, `${sessionId}.jsonl`)
  writeFileSync(filePath, messages.map((m) => JSON.stringify(m)).join('\n') + '\n', 'utf-8')
  return filePath
}

function readSessionFile(sessionId: string): object[] {
  const filePath = join(tempDir, `${sessionId}.jsonl`)
  if (!existsSync(filePath)) return []
  const raw = readFileSync(filePath, 'utf-8')
  return raw.trim().split('\n').filter((l) => l.length > 0).map((l) => JSON.parse(l))
}

function cleanup(): void {
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

// === Test 1: drop_old_tool_results 混合会话 ===
async function test1DropOldToolResults(): Promise<void> {
  console.log('\n=== Test 1: drop_old_tool_results 混合会话 ===')

  const sessionId = 'integration-1'
  writeSessionFile(sessionId, [
    { type: 'system', subtype: 'init' },
    { type: 'user', message: { content: [{ type: 'text', text: 'Q1' }] } },
    { type: 'assistant', message: { content: [{ type: 'text', text: 'A1' }] } },
    { type: 'assistant', message: { content: [{ type: 'tool_use', id: 't1', name: 'Read', input: { file_path: '/x' } }] } },
    { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: 'file content' }] } },
    { type: 'assistant', message: { content: [{ type: 'text', text: 'A2' }] } },
  ])

  const result = await compactSession(sessionId, { strategy: 'drop_old_tool_results' })

  console.log('  before:', result.beforeCount, 'after:', result.afterCount, 'dropped:', result.droppedCount)
  console.log('  message:', result.message)

  // 断言
  if (result.success !== true) throw new Error('Expected success=true')
  if (result.beforeCount !== 6) throw new Error(`Expected beforeCount=6, got ${result.beforeCount}`)
  if (result.afterCount !== 4) throw new Error(`Expected afterCount=4, got ${result.afterCount}`)
  if (result.droppedCount !== 2) throw new Error(`Expected droppedCount=2, got ${result.droppedCount}`)

  // 验证文件被改对
  const newMsgs = readSessionFile(sessionId)
  if (newMsgs.length !== 4) throw new Error(`Expected 4 msgs in file, got ${newMsgs.length}`)

  const types = newMsgs.map((m: any) => m.type)
  const expected = ['system', 'user', 'assistant', 'assistant']
  if (JSON.stringify(types) !== JSON.stringify(expected)) {
    throw new Error(`Expected types ${JSON.stringify(expected)}, got ${JSON.stringify(types)}`)
  }

  console.log('  ✅ 断言全部通过')
}

// === Test 2: keep_last_n ===
async function test2KeepLastN(): Promise<void> {
  console.log('\n=== Test 2: keep_last_n=2 ===')

  const sessionId = 'integration-2'
  writeSessionFile(sessionId, [
    { type: 'system' },
    { type: 'user', message: { content: [{ type: 'text', text: 'Q1' }] } },
    { type: 'assistant', message: { content: [{ type: 'text', text: 'A1' }] } },
    { type: 'user', message: { content: [{ type: 'text', text: 'Q2' }] } },
    { type: 'assistant', message: { content: [{ type: 'text', text: 'A2' }] } },
  ])

  const result = await compactSession(sessionId, { strategy: 'keep_last_n', keepLastN: 2 })

  console.log('  before:', result.beforeCount, 'after:', result.afterCount, 'dropped:', result.droppedCount)
  console.log('  message:', result.message)

  if (result.success !== true) throw new Error('Expected success=true')
  if (result.beforeCount !== 5) throw new Error(`Expected beforeCount=5, got ${result.beforeCount}`)
  if (result.afterCount !== 3) throw new Error(`Expected afterCount=3 (system+Q2+A2), got ${result.afterCount}`)
  if (result.droppedCount !== 2) throw new Error(`Expected droppedCount=2 (Q1+A1), got ${result.droppedCount}`)

  const newMsgs = readSessionFile(sessionId)
  if (newMsgs.length !== 3) throw new Error(`Expected 3 msgs in file, got ${newMsgs.length}`)

  // 第一个应该是 system, 然后是最后 2 条 (Q2, A2)
  if ((newMsgs[0] as any).type !== 'system') throw new Error('First msg should be system')
  if ((newMsgs[1] as any).message.content[0].text !== 'Q2') throw new Error('Second should be Q2')
  if ((newMsgs[2] as any).message.content[0].text !== 'A2') throw new Error('Third should be A2')

  console.log('  ✅ 断言全部通过')
}

// === Test 3: summarize 策略 (未实现) ===
async function test3Summarize(): Promise<void> {
  console.log('\n=== Test 3: summarize 策略 (本期未实现) ===')

  const sessionId = 'integration-3'
  writeSessionFile(sessionId, [
    { type: 'user', message: { content: [{ type: 'text', text: 'Q1' }] } },
  ])

  const result = await compactSession(sessionId, { strategy: 'summarize' })

  console.log('  message:', result.message)

  if (result.success !== false) throw new Error('Expected success=false for summarize')
  if (!result.message.includes('未实现')) throw new Error(`Expected "未实现" in message, got: ${result.message}`)

  console.log('  ✅ 断言全部通过')
}

// === Test 4: 边界 - 文件不存在 ===
async function test4FileNotFound(): Promise<void> {
  console.log('\n=== Test 4: 文件不存在 ===')

  const result = await compactSession('nonexistent-session', { strategy: 'drop_old_tool_results' })

  console.log('  message:', result.message)

  if (result.success !== false) throw new Error('Expected success=false for missing file')
  if (result.beforeCount !== 0) throw new Error('Expected beforeCount=0')

  console.log('  ✅ 断言全部通过')
}

// === Test 5: 边界 - 损坏行 ===
async function test5CorruptedLines(): Promise<void> {
  console.log('\n=== Test 5: 损坏行应跳过 ===')

  const sessionId = 'integration-5'
  const filePath = join(tempDir, `${sessionId}.jsonl`)
  // 故意写损坏 JSON 行
  const content = [
    JSON.stringify({ type: 'system' }),
    '{ this is not valid JSON',
    JSON.stringify({ type: 'user', message: { content: [{ type: 'text', text: 'valid' }] } }),
    'another bad line',
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 't1' }] } }),
  ].join('\n') + '\n'
  writeFileSync(filePath, content, 'utf-8')

  const result = await compactSession(sessionId, { strategy: 'drop_old_tool_results' })

  console.log('  before:', result.beforeCount, 'after:', result.afterCount, 'dropped:', result.droppedCount)

  // 3 valid: system + user + assistant(tool_use)
  if (result.beforeCount !== 3) throw new Error(`Expected beforeCount=3, got ${result.beforeCount}`)
  if (result.afterCount !== 2) throw new Error(`Expected afterCount=2 (system+user), got ${result.afterCount}`)
  if (result.droppedCount !== 1) throw new Error(`Expected droppedCount=1 (tool_use), got ${result.droppedCount}`)

  console.log('  ✅ 断言全部通过 (2 损坏行被跳过)')
}

// === 主入口 ===
async function main(): Promise<void> {
  let passed = 0
  let failed = 0
  const tests = [
    { name: 'Test 1: drop_old_tool_results', fn: test1DropOldToolResults },
    { name: 'Test 2: keep_last_n', fn: test2KeepLastN },
    { name: 'Test 3: summarize', fn: test3Summarize },
    { name: 'Test 4: 文件不存在', fn: test4FileNotFound },
    { name: 'Test 5: 损坏行', fn: test5CorruptedLines },
  ]

  for (const test of tests) {
    try {
      await test.fn()
      passed++
    } catch (err) {
      console.error(`  ❌ ${test.name} 失败:`, err instanceof Error ? err.message : err)
      failed++
    }
  }

  console.log(`\n=== 总计: ${passed} 通过, ${failed} 失败 ===`)
  cleanup()
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  cleanup()
  process.exit(1)
})
