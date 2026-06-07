/**
 * agent-tool-input-validator 单测
 *
 * 工具参数校验：拦截 canUseTool 阶段的缺参调用。
 */

import { describe, expect, test } from 'bun:test'
import {
  validateToolInput,
  TOOL_REQUIRED_PARAMS,
} from './agent-tool-input-validator'

// ============================================
// 常量 sanity
// ============================================

describe('TOOL_REQUIRED_PARAMS', () => {
  test('Given 常量 When 读 Then 包含 7 个已知工具', () => {
    expect(TOOL_REQUIRED_PARAMS.size).toBe(7)
  })

  test('Given 已知工具名 When 查 Then 返回对应必需参数', () => {
    expect(TOOL_REQUIRED_PARAMS.get('Write')).toEqual(['file_path', 'content'])
    expect(TOOL_REQUIRED_PARAMS.get('Edit')).toEqual(['file_path', 'old_string', 'new_string'])
    expect(TOOL_REQUIRED_PARAMS.get('Bash')).toEqual(['command'])
    expect(TOOL_REQUIRED_PARAMS.get('Read')).toEqual(['file_path'])
    expect(TOOL_REQUIRED_PARAMS.get('Glob')).toEqual(['pattern'])
    expect(TOOL_REQUIRED_PARAMS.get('Grep')).toEqual(['pattern'])
    expect(TOOL_REQUIRED_PARAMS.get('Agent')).toEqual(['prompt', 'description'])
  })
})

// ============================================
// validateToolInput - 未知工具
// ============================================

describe('validateToolInput - 未知工具', () => {
  test('Given 未知工具名 When validate Then 返回 null (不拦截)', () => {
    expect(validateToolInput('UnknownTool', {})).toBeNull()
  })

  test('Given 未知工具名 + 任意 input When validate Then 返回 null', () => {
    expect(validateToolInput('Foo', { bar: 'baz' })).toBeNull()
  })
})

// ============================================
// validateToolInput - 参数完整
// ============================================

describe('validateToolInput - 参数完整', () => {
  test('Given Write + 全部参数 When validate Then 返回 null', () => {
    expect(validateToolInput('Write', { file_path: '/tmp/a.ts', content: 'hello' })).toBeNull()
  })

  test('Given Bash + command When validate Then 返回 null', () => {
    expect(validateToolInput('Bash', { command: 'ls' })).toBeNull()
  })

  test('Given Agent + 全部参数 When validate Then 返回 null', () => {
    expect(validateToolInput('Agent', { prompt: 'do x', description: 'helper' })).toBeNull()
  })
})

// ============================================
// validateToolInput - 缺单个参数
// ============================================

describe('validateToolInput - 缺单个参数', () => {
  test('Given Write 缺 file_path When validate Then 返回 deny + 提示 file_path', () => {
    const r = validateToolInput('Write', { content: 'hello' })
    expect(r).not.toBeNull()
    expect(r!.behavior).toBe('deny')
    expect(r!.message).toContain('"file_path"')
    expect(r!.message).toContain('Write')
    expect(r!.message).not.toContain('"content"')  // content 不缺
  })

  test('Given Write 缺 content When validate Then 返回 deny + 提示 content', () => {
    const r = validateToolInput('Write', { file_path: '/tmp/a.ts' })
    expect(r).not.toBeNull()
    expect(r!.message).toContain('"content"')
    expect(r!.message).not.toContain('"file_path"')
  })

  test('Given Bash 缺 command When validate Then 返回 deny + 提示 command (单数 message)', () => {
    const r = validateToolInput('Bash', {})
    expect(r).not.toBeNull()
    expect(r!.message).toMatch(/missing required parameter "command"/)
    // 单数形式 (不应该是 "parameters:")
    expect(r!.message).not.toMatch(/parameters:/)
  })
})

// ============================================
// validateToolInput - 缺多个参数
// ============================================

describe('validateToolInput - 缺多个参数', () => {
  test('Given Write 缺 file_path + content When validate Then 提示 2 个参数 (复数 message)', () => {
    const r = validateToolInput('Write', {})
    expect(r).not.toBeNull()
    expect(r!.message).toContain('"file_path"')
    expect(r!.message).toContain('"content"')
    // 复数形式
    expect(r!.message).toMatch(/parameters:/)
  })

  test('Given Edit 缺 3 个参数 When validate Then 提示全部 3 个', () => {
    const r = validateToolInput('Edit', {})
    expect(r).not.toBeNull()
    expect(r!.message).toContain('"file_path"')
    expect(r!.message).toContain('"old_string"')
    expect(r!.message).toContain('"new_string"')
  })

  test('Given Agent 缺 prompt When validate Then 提示 prompt (其他字段不强制)', () => {
    const r = validateToolInput('Agent', { description: 'desc' })
    expect(r).not.toBeNull()
    expect(r!.message).toContain('"prompt"')
    expect(r!.message).not.toContain('"description"')
  })
})

// ============================================
// validateToolInput - 边界值（undefined / null / 空字符串）
// ============================================

describe('validateToolInput - 边界值', () => {
  test('Given 参数值是 undefined When validate Then 视为缺失', () => {
    const r = validateToolInput('Bash', { command: undefined })
    expect(r).not.toBeNull()
    expect(r!.message).toContain('"command"')
  })

  test('Given 参数值是 null When validate Then 视为缺失', () => {
    const r = validateToolInput('Bash', { command: null as unknown as string })
    expect(r).not.toBeNull()
    expect(r!.message).toContain('"command"')
  })

  test('Given 参数值是空字符串 When validate Then 视为缺失', () => {
    const r = validateToolInput('Bash', { command: '' })
    expect(r).not.toBeNull()
    expect(r!.message).toContain('"command"')
  })

  test('Given 参数值是 0 (falsy 但有效) When validate Then 视为完整 (但实际不会用 0 当参数)', () => {
    // 0 不在 undefined/null/'' 之列, 所以通过校验
    // 这里主要是确认算法不会把 0 当成缺失
    const r = validateToolInput('Bash', { command: 0 as unknown as string })
    expect(r).toBeNull()
  })

  test('Given 参数值是 false (falsy 但有效) When validate Then 视为完整', () => {
    const r = validateToolInput('Bash', { command: false as unknown as string })
    expect(r).toBeNull()
  })

  test('Given 多参数混合（部分 undefined 部分有值） When validate Then 只报缺失的', () => {
    const r = validateToolInput('Edit', {
      file_path: '/tmp/a.ts',
      old_string: undefined,
      new_string: 'new',
    })
    expect(r).not.toBeNull()
    expect(r!.message).toContain('"old_string"')
    expect(r!.message).not.toContain('"file_path"')
    expect(r!.message).not.toContain('"new_string"')
  })
})

// ============================================
// validateToolInput - 额外字段
// ============================================

describe('validateToolInput - 额外字段不影响校验', () => {
  test('Given 工具调用带额外字段 + 必需字段完整 When validate Then 返回 null', () => {
    const r = validateToolInput('Bash', {
      command: 'ls',
      description: 'list files',  // 非必需, 不报错
      timeout: 5000,
    })
    expect(r).toBeNull()
  })
})

// ============================================
// 集成：与 PermissionResult 形状一致
// ============================================

describe('validateToolInput - 返回形状', () => {
  test('Given 失败时 When 返回 Then shape 是 { behavior: "deny", message: string }', () => {
    const r = validateToolInput('Bash', {})
    expect(r).toEqual({
      behavior: 'deny',
      message: expect.any(String),
    })
  })
})
