import { describe, expect, test } from 'bun:test'

import {
  isAutoModeAutoAllowTool,
  isProjectLocalReadOnlyBash,
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

describe('isProjectLocalReadOnlyBash', () => {
  const cwd = 'F:/TAgent_General'

  test('cwd 内 cat 相对路径 → 放行', () => {
    expect(isProjectLocalReadOnlyBash('cat README.md', cwd)).toBe(true)
    expect(isProjectLocalReadOnlyBash('cat src/index.ts', cwd)).toBe(true)
  })

  test('cwd 内 cat 绝对路径（cwd 前缀）→ 放行', () => {
    expect(isProjectLocalReadOnlyBash('cat F:/TAgent_General/CLAUDE.md', cwd)).toBe(true)
    expect(isProjectLocalReadOnlyBash('cat F:\\TAgent_General\\package.json', cwd)).toBe(true)
  })

  test('cwd 外 cat 绝对路径 → 拒绝', () => {
    expect(isProjectLocalReadOnlyBash('cat /etc/passwd', cwd)).toBe(false)
    expect(isProjectLocalReadOnlyBash('cat ~/.ssh/id_rsa', cwd)).toBe(false)
    expect(isProjectLocalReadOnlyBash('cat C:/Windows/System32/drivers/etc/hosts', cwd)).toBe(false)
  })

  test('父目录路径 → 拒绝（保守，避免越界）', () => {
    expect(isProjectLocalReadOnlyBash('cat ../package.json', cwd)).toBe(false)
    expect(isProjectLocalReadOnlyBash('find .. -name foo', cwd)).toBe(false)
  })

  test('find cwd 内 → 放行', () => {
    expect(isProjectLocalReadOnlyBash('find . -name "*.ts"', cwd)).toBe(true)
    expect(isProjectLocalReadOnlyBash('find src -type f', cwd)).toBe(true)
  })

  test('find cwd 外 → 拒绝', () => {
    expect(isProjectLocalReadOnlyBash('find / -name "*.env"', cwd)).toBe(false)
    expect(isProjectLocalReadOnlyBash('find ~ -name ".ssh"', cwd)).toBe(false)
  })

  test('危险结构 → 拒绝（即使路径在 cwd 内）', () => {
    expect(isProjectLocalReadOnlyBash('cat README.md > /tmp/out', cwd)).toBe(false)
    expect(isProjectLocalReadOnlyBash('find . -exec rm {} \\;', cwd)).toBe(false)
    expect(isProjectLocalReadOnlyBash('find . -delete', cwd)).toBe(false)
    expect(isProjectLocalReadOnlyBash('cat file | tee /tmp/x', cwd)).toBe(false)
  })

  test('echo 无重定向 → 放行', () => {
    expect(isProjectLocalReadOnlyBash('echo hello', cwd)).toBe(true)
    expect(isProjectLocalReadOnlyBash('echo "foo bar"', cwd)).toBe(true)
  })

  test('echo 带重定向 → 拒绝（危险结构）', () => {
    expect(isProjectLocalReadOnlyBash('echo x > file.txt', cwd)).toBe(false)
    expect(isProjectLocalReadOnlyBash('echo y >> log.txt', cwd)).toBe(false)
  })

  test('sed -n 只读模式 → 放行', () => {
    expect(isProjectLocalReadOnlyBash('sed -n "1,10p" README.md', cwd)).toBe(true)
  })

  test('sed -i 原地编辑 → 拒绝（不匹配只读模式）', () => {
    expect(isProjectLocalReadOnlyBash('sed -i "s/foo/bar/g" file.ts', cwd)).toBe(false)
  })

  test('未提供 cwd → 保守拒绝（无法判断路径边界）', () => {
    expect(isProjectLocalReadOnlyBash('cat README.md')).toBe(false)
    expect(isProjectLocalReadOnlyBash('find . -name "*.ts"')).toBe(false)
  })

  test('写命令（rm/mv/cp）→ 拒绝（不匹配只读模式）', () => {
    expect(isProjectLocalReadOnlyBash('rm file.txt', cwd)).toBe(false)
    expect(isProjectLocalReadOnlyBash('mv a b', cwd)).toBe(false)
    expect(isProjectLocalReadOnlyBash('mkdir newdir', cwd)).toBe(false)
  })
})

describe('isAutoModeAutoAllowTool（带 cwd）', () => {
  const cwd = 'F:/TAgent_General'

  test('Bash cat cwd 内文件 → 静默放行', () => {
    expect(isAutoModeAutoAllowTool('Bash', { command: 'cat README.md' }, cwd)).toBe(true)
    expect(isAutoModeAutoAllowTool('Bash', { command: 'cat F:/TAgent_General/x.ts' }, cwd)).toBe(true)
  })

  test('Bash cat cwd 外文件 → 需确认', () => {
    expect(isAutoModeAutoAllowTool('Bash', { command: 'cat /etc/passwd' }, cwd)).toBe(false)
    expect(isAutoModeAutoAllowTool('Bash', { command: 'cat ~/.ssh/id_rsa' }, cwd)).toBe(false)
  })

  test('不传 cwd 时保持原有行为（cat 需确认）', () => {
    expect(isAutoModeAutoAllowTool('Bash', { command: 'cat README.md' })).toBe(false)
  })

  test('Write 即使在 cwd 内也需确认（设计如此，避免误改代码）', () => {
    expect(isAutoModeAutoAllowTool('Write', { file_path: 'F:/TAgent_General/x.ts' }, cwd)).toBe(
      false
    )
  })
})

describe('requiresAutoModeConfirmation', () => {
  test('与 isAutoModeAutoAllowTool 互斥', () => {
    expect(requiresAutoModeConfirmation('Read', {})).toBe(false)
    expect(requiresAutoModeConfirmation('Write', { file_path: 'a.ts' })).toBe(true)
    expect(requiresAutoModeConfirmation('AskUserQuestion', {})).toBe(false)
  })
})
