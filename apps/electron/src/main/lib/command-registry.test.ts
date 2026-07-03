/**
 * command-registry 单测
 *
 * 覆盖：registerCommand / getCommand / unregisterCommand / listCommands / runCommand
 * 内置命令 agent.compact 注册成功（handler 不实际调用 compactSession，避免文件 IO）
 */

import { beforeEach, describe, expect, test } from 'vitest'

import {
  registerCommand,
  unregisterCommand,
  getCommand,
  listCommands,
  runCommand,
  registerBuiltinCommands,
} from './command-registry'

// ============================================
// 基础 API
// ============================================

describe('command-registry 基础 API', () => {
  test('registerCommand + getCommand 正常', () => {
    registerCommand({
      id: 'test.echo',
      name: '回显',
      description: '测试用',
      category: 'desktop',
      handler: () => 'ok',
    })
    const cmd = getCommand('test.echo')
    expect(cmd).toBeDefined()
    expect(cmd?.name).toBe('回显')
    expect(cmd?.category).toBe('desktop')
    unregisterCommand('test.echo')
  })

  test('重复 id 抛错', () => {
    registerCommand({
      id: 'test.dup',
      name: 'dup',
      description: 'dup',
      category: 'agent',
      handler: () => null,
    })
    expect(() =>
      registerCommand({
        id: 'test.dup',
        name: 'dup2',
        description: 'dup2',
        category: 'agent',
        handler: () => null,
      })
    ).toThrow('命令已注册: test.dup')
    unregisterCommand('test.dup')
  })

  test('unregisterCommand 后 getCommand 返回 undefined', () => {
    registerCommand({
      id: 'test.temp',
      name: 'temp',
      description: 'temp',
      category: 'model',
      handler: () => null,
    })
    expect(getCommand('test.temp')).toBeDefined()
    unregisterCommand('test.temp')
    expect(getCommand('test.temp')).toBeUndefined()
  })

  test('未注册 id 调 getCommand 返回 undefined', () => {
    expect(getCommand('not.exist')).toBeUndefined()
  })
})

// ============================================
// listCommands
// ============================================

describe('listCommands 按 category 过滤', () => {
  test('无过滤返回全部已注册命令', () => {
    registerCommand({
      id: 'list.all1',
      name: 'a1',
      description: 'a1',
      category: 'desktop',
      handler: () => null,
    })
    registerCommand({
      id: 'list.all2',
      name: 'a2',
      description: 'a2',
      category: 'agent',
      handler: () => null,
    })
    const all = listCommands()
    expect(all.some((c) => c.id === 'list.all1')).toBe(true)
    expect(all.some((c) => c.id === 'list.all2')).toBe(true)
    unregisterCommand('list.all1')
    unregisterCommand('list.all2')
  })

  test('按 category 过滤', () => {
    registerCommand({
      id: 'list.desktop1',
      name: 'd1',
      description: 'd1',
      category: 'desktop',
      handler: () => null,
    })
    registerCommand({
      id: 'list.agent1',
      name: 'ag1',
      description: 'ag1',
      category: 'agent',
      handler: () => null,
    })
    const desktops = listCommands('desktop')
    expect(desktops.every((c) => c.category === 'desktop')).toBe(true)
    expect(desktops.some((c) => c.id === 'list.desktop1')).toBe(true)
    expect(desktops.some((c) => c.id === 'list.agent1')).toBe(false)
    unregisterCommand('list.desktop1')
    unregisterCommand('list.agent1')
  })

  test('返回的是 CommandMeta 不含 handler', () => {
    registerCommand({
      id: 'list.meta',
      name: 'meta',
      description: 'meta',
      category: 'model',
      handler: () => 'secret',
    })
    const metas = listCommands()
    const target = metas.find((c) => c.id === 'list.meta')
    expect(target).toBeDefined()
    expect(target).not.toHaveProperty('handler')
    unregisterCommand('list.meta')
  })
})

// ============================================
// runCommand
// ============================================

describe('runCommand', () => {
  test('未注册 id 抛错', async () => {
    await expect(runCommand('run.not.exist', {})).rejects.toThrow('命令未注册')
  })

  test('sync handler 返回值正常透传', async () => {
    registerCommand({
      id: 'run.sync',
      name: 'sync',
      description: 'sync',
      category: 'desktop',
      handler: (ctx) => ({ echo: ctx.args }),
    })
    const result = await runCommand('run.sync', { args: 'hello' })
    expect(result).toEqual({ echo: 'hello' })
    unregisterCommand('run.sync')
  })

  test('async handler 返回值正常透传', async () => {
    registerCommand({
      id: 'run.async',
      name: 'async',
      description: 'async',
      category: 'desktop',
      handler: async (ctx) => {
        await new Promise((r) => setTimeout(r, 10))
        return { sessionId: ctx.sessionId }
      },
    })
    const result = await runCommand('run.async', { sessionId: 'sess-1' })
    expect(result).toEqual({ sessionId: 'sess-1' })
    unregisterCommand('run.async')
  })
})

// ============================================
// 内置命令
// ============================================

describe('registerBuiltinCommands', () => {
  beforeEach(() => {
    // 清理可能残留的内置命令
    unregisterCommand('agent.compact')
  })

  test('注册后 agent.compact 命令存在', () => {
    registerBuiltinCommands()
    const cmd = getCommand('agent.compact')
    expect(cmd).toBeDefined()
    expect(cmd?.category).toBe('agent')
    expect(cmd?.name).toBe('压缩会话')
  })

  test('重复调用 registerBuiltinCommands 抛错（已注册）', () => {
    registerBuiltinCommands()
    expect(() => registerBuiltinCommands()).toThrow('命令已注册: agent.compact')
  })

  test('agent.compact handler 缺 sessionId 抛错', async () => {
    registerBuiltinCommands()
    await expect(runCommand('agent.compact', {})).rejects.toThrow('sessionId')
  })
})
