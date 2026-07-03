/**
 * MemoryLayerService 单测
 *
 * 验证 L4 sessions.db 写入路径：
 * - 不存在时自动创建 + 建 schema（含 FTS5 索引 + 触发器）
 * - recordSession 写入后能通过 searchSessions 搜到
 * - FTS5 全文搜索能匹配 title / summary / key_facts
 *
 * 通过 vi.mock('electron') 绕过 electron 主进程依赖，
 * 用临时文件路径注入（dbPathOverride），测试结束清理。
 */

import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest'

// memory-layer-service.ts 顶部 import { app } from 'electron'，
// 测试运行时（非 Electron 主进程）加载不出来，所以先 mock 掉。
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    // 返回临时目录，initialize 内部会创建 memory/ 子目录
    getPath: () => '/tmp/tagent-memory-test-home',
  },
}))

const { MemoryLayerService } = await import('./memory-layer-service')

import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('MemoryLayerService - L4 sessions.db 写入路径', () => {
  let svc: InstanceType<typeof MemoryLayerService>
  let tmpDir: string
  let generalDbPath: string
  let taDbPath: string

  beforeEach(() => {
    svc = new MemoryLayerService()
    tmpDir = mkdtempSync(join(tmpdir(), 'tagent-memory-test-'))
    generalDbPath = join(tmpDir, 'general.db')
    taDbPath = join(tmpDir, 'ta.db')
    const result = svc.initialize({
      dbPathOverride: { general: generalDbPath, ta: taDbPath },
    })
    expect(result.success).toBe(true)
  })

  afterEach(() => {
    svc.close()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  test('L4 sessions.db 不存在时自动创建 + 建 schema', () => {
    // initialize 已经触发自动建库
    expect(existsSync(generalDbPath)).toBe(true)
    expect(existsSync(taDbPath)).toBe(true)

    // sessions 表存在 + 行数为 0
    const stats = svc.getStats('general')
    expect(stats.l4.sessions).toBe(0)

    // FTS5 表 + 触发器已建（通过写入 + 搜索间接验证）
    // 详见下一个测试
  })

  test('recordSession 写入后能通过 listRecentSessions / searchSessions 查到', async () => {
    await svc.recordSession({
      sessionId: 'sess-uuid-001',
      title: '实现登录功能',
      summary: '调用了 Write 修改 auth.ts，调用 Edit 修改 router.ts',
      keyFacts: ['用户偏好 TypeScript', '使用 better-sqlite3'],
      toolsUsed: ['Write', 'Edit', 'Read'],
      mode: 'general',
      workspaceSlug: 'my-project',
    })

    // listRecentSessions 应返回 1 条
    const recent = svc.listRecentSessions('general', 10)
    expect(recent).toHaveLength(1)
    expect(recent[0]!.session_slug).toBe('sess-uuid-001')
    expect(recent[0]!.title).toBe('实现登录功能')
    expect(recent[0]!.workspace_slug).toBe('my-project')
    expect(recent[0]!.mode).toBe('general')

    // tools_used / key_facts 是 JSON 序列化字符串
    const toolsUsed = JSON.parse(recent[0]!.tools_used) as string[]
    expect(toolsUsed).toEqual(['Write', 'Edit', 'Read'])
    const keyFacts = JSON.parse(recent[0]!.key_facts) as string[]
    expect(keyFacts).toEqual(['用户偏好 TypeScript', '使用 better-sqlite3'])

    // getStats 的 l4.sessions 计数应 +1
    const stats = svc.getStats('general')
    expect(stats.l4.sessions).toBe(1)
  })

  test('FTS5 全文搜索能匹配 title / summary / key_facts', async () => {
    // 写入 3 条会话，覆盖不同字段命中
    await svc.recordSession({
      sessionId: 'sess-uuid-a',
      title: 'React 组件重构',
      summary: '把 class 组件改成 hooks',
      keyFacts: [],
      toolsUsed: ['Edit'],
      mode: 'general',
      workspaceSlug: '',
    })
    await svc.recordSession({
      sessionId: 'sess-uuid-b',
      title: '数据库迁移',
      summary: '使用 better-sqlite3 重构 kanban-db',
      keyFacts: ['FTS5 索引配置'],
      toolsUsed: ['Write'],
      mode: 'general',
      workspaceSlug: '',
    })
    await svc.recordSession({
      sessionId: 'sess-uuid-c',
      title: '文档更新',
      summary: '补充 README',
      keyFacts: ['用户偏好中文文档'],
      toolsUsed: [],
      mode: 'general',
      workspaceSlug: '',
    })

    // 1. title 命中：搜索 "React"
    const reactResults = svc.searchSessions('general', 'React', 10)
    expect(reactResults.length).toBeGreaterThanOrEqual(1)
    expect(reactResults.some((r) => r.session_slug === 'sess-uuid-a')).toBe(true)

    // 2. summary 命中：搜索 "better-sqlite3"
    const sqliteResults = svc.searchSessions('general', 'better-sqlite3', 10)
    expect(sqliteResults.length).toBeGreaterThanOrEqual(1)
    expect(sqliteResults.some((r) => r.session_slug === 'sess-uuid-b')).toBe(true)

    // 3. key_facts 命中：搜索 "FTS5"
    const ftsResults = svc.searchSessions('general', 'FTS5', 10)
    expect(ftsResults.length).toBeGreaterThanOrEqual(1)
    expect(ftsResults.some((r) => r.session_slug === 'sess-uuid-b')).toBe(true)

    // 4. 中文 key_facts 命中：搜索 "中文"
    const chineseResults = svc.searchSessions('general', '中文', 10)
    expect(chineseResults.length).toBeGreaterThanOrEqual(1)
    expect(chineseResults.some((r) => r.session_slug === 'sess-uuid-c')).toBe(true)
  })

  test('TA 模式独立写入 ta.db，与 general 隔离', async () => {
    await svc.recordSession({
      sessionId: 'sess-ta-001',
      title: 'TA 模式任务',
      summary: '执行自动化任务',
      keyFacts: [],
      toolsUsed: ['Bash'],
      mode: 'ta',
      workspaceSlug: 'ta-workspace',
    })

    // general 模式查不到 ta 写入
    const generalRecent = svc.listRecentSessions('general', 10)
    expect(generalRecent).toHaveLength(0)

    // ta 模式能查到
    const taRecent = svc.listRecentSessions('ta', 10)
    expect(taRecent).toHaveLength(1)
    expect(taRecent[0]!.session_slug).toBe('sess-ta-001')
    expect(taRecent[0]!.mode).toBe('ta')
  })

  test('recordSession 失败不抛异常（仅打印 warn），不影响主流程', async () => {
    // 关闭数据库后调 recordSession，应静默失败
    svc.close()
    await expect(
      svc.recordSession({
        sessionId: 'sess-after-close',
        title: '关闭后写入',
        summary: '',
        keyFacts: [],
        toolsUsed: [],
        mode: 'general',
        workspaceSlug: '',
      })
    ).resolves.toBeUndefined()
  })
})
