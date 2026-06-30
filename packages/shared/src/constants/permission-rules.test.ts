import { describe, expect, test } from 'bun:test'

import {
  isAutoModeAutoAllowTool,
  requiresAutoModeConfirmation,
  resolveSdkPermissionModeForTAgent,
} from './permission-rules'

describe('resolveSdkPermissionModeForTAgent', () => {
  test('auto 映射为 default，由 TAgent canUseTool 审批', () => {
    expect(resolveSdkPermissionModeForTAgent('auto')).toBe('default')
  })

  test('bypassPermissions 映射为 default，避免 SDK classifier 硬拒', () => {
    expect(resolveSdkPermissionModeForTAgent('bypassPermissions')).toBe('default')
  })

  test('plan 保持 plan', () => {
    expect(resolveSdkPermissionModeForTAgent('plan')).toBe('plan')
  })
})

describe('isAutoModeAutoAllowTool', () => {
  test('Read 静默放行', () => {
    expect(isAutoModeAutoAllowTool('Read', { file_path: '/tmp/a.txt' })).toBe(true)
  })

  test('list_automations 静默放行', () => {
    expect(isAutoModeAutoAllowTool('mcp__automation__list_automations', {})).toBe(true)
  })

  test('create_automation 需确认', () => {
    expect(isAutoModeAutoAllowTool('mcp__automation__create_automation', { name: 'x' })).toBe(
      false
    )
  })

  test('Write 需确认', () => {
    expect(isAutoModeAutoAllowTool('Write', { file_path: '/tmp/a.txt' })).toBe(false)
  })

  test('Task 需确认', () => {
    expect(isAutoModeAutoAllowTool('Task', { description: '子任务' })).toBe(false)
  })

  test('安全 Bash 静默放行', () => {
    expect(isAutoModeAutoAllowTool('Bash', { command: 'git status' })).toBe(true)
  })

  test('危险 Bash 需确认', () => {
    expect(isAutoModeAutoAllowTool('Bash', { command: 'rm -rf /tmp/x' })).toBe(false)
  })
})

describe('requiresAutoModeConfirmation', () => {
  test('与 isAutoModeAutoAllowTool 互斥', () => {
    expect(requiresAutoModeConfirmation('Read', {})).toBe(false)
    expect(requiresAutoModeConfirmation('Write', { file_path: 'a.ts' })).toBe(true)
    expect(requiresAutoModeConfirmation('AskUserQuestion', {})).toBe(false)
  })
})
