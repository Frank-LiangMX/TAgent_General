/**
 * auto-check hook 逻辑验证（不调 LLM）
 *
 * 直接调用 buildPostToolUseHooks() 拿到 hook 回调，
 * 验证多语言场景下的语言识别 + 命令查找 + 触发逻辑。
 */

import { buildPostToolUseHooks } from '../apps/electron/src/main/lib/hooks/post-tool-use.js'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// 测试 7 用：传用户配置覆盖默认
const hooks = buildPostToolUseHooks()
const postToolUseMatchers = hooks.PostToolUse!
const callback = postToolUseMatchers[0]!.hooks[0]!

// 创建临时测试根目录
const testRoot = join(tmpdir(), `auto-check-test-${Date.now()}`)
mkdirSync(testRoot, { recursive: true })

console.log(`测试根目录: ${testRoot}\n`)

try {
  // ===== 测试 1: TS 项目（含 typecheck 脚本）=====
  console.log('=== 测试 1: TS 项目（package.json + typecheck 脚本）===')
  const tsDir = join(testRoot, 'ts-project')
  mkdirSync(tsDir, { recursive: true })
  writeFileSync(
    join(tsDir, 'package.json'),
    JSON.stringify({
      name: 'ts-test',
      scripts: { typecheck: 'tsc --noEmit' },
    })
  )
  writeFileSync(join(tsDir, 'tsconfig.json'), '{}')
  const tsFile = join(tsDir, 'src', 'bad.ts')
  mkdirSync(join(tsDir, 'src'), { recursive: true })
  writeFileSync(tsFile, 'const x: number = "bad"')

  const result1 = await callback(
    {
      hook_event_name: 'PostToolUse',
      tool_name: 'Write',
      tool_input: { file_path: tsFile },
      cwd: tsDir,
    } as any,
    undefined,
    {} as any
  )
  console.log('结果 keys:', Object.keys(result1 || {}))
  const ctx1 = (result1 as any)?.hookSpecificOutput?.additionalContext
  console.log('触发:', !!ctx1)
  console.log('包含 [auto-check]:', ctx1?.includes('[auto-check]'))
  console.log('预期: 触发，回灌 typecheck 错误\n')

  // ===== 测试 2: 非 TS 文件（README.md）=====
  console.log('=== 测试 2: 非代码文件（README.md）===')
  const result2 = await callback(
    {
      hook_event_name: 'PostToolUse',
      tool_name: 'Write',
      tool_input: { file_path: 'README.md' },
      cwd: tsDir,
    } as any,
    undefined,
    {} as any
  )
  console.log('结果:', JSON.stringify(result2))
  console.log('预期: {} （不触发）\n')

  // ===== 测试 3: Python 项目（pyproject.toml）=====
  console.log('=== 测试 3: Python 项目（pyproject.toml，但 ruff 未安装）===')
  const pyDir = join(testRoot, 'py-project')
  mkdirSync(pyDir, { recursive: true })
  writeFileSync(
    join(pyDir, 'pyproject.toml'),
    '[tool.ruff]\nline-length = 100\n'
  )
  const pyFile = join(pyDir, 'bad.py')
  writeFileSync(pyFile, 'x = "bad"  # type: ignore\n')

  const result3 = await callback(
    {
      hook_event_name: 'PostToolUse',
      tool_name: 'Write',
      tool_input: { file_path: pyFile },
      cwd: pyDir,
    } as any,
    undefined,
    {} as any
  )
  console.log('结果 keys:', Object.keys(result3 || {}))
  const ctx3 = (result3 as any)?.hookSpecificOutput?.additionalContext
  console.log('触发:', !!ctx3)
  console.log('回灌前 200 字符:', ctx3?.slice(0, 200))
  console.log('预期: 触发（ruff 可能未安装，回灌"执行失败"提示）\n')

  // ===== 测试 4: C++ 文件（应跳过）=====
  console.log('=== 测试 4: C++ 文件（默认跳过）===')
  const cppFile = join(testRoot, 'main.cpp')
  writeFileSync(cppFile, 'int main() { return 0; }')
  const result4 = await callback(
    {
      hook_event_name: 'PostToolUse',
      tool_name: 'Write',
      tool_input: { file_path: cppFile },
      cwd: testRoot,
    } as any,
    undefined,
    {} as any
  )
  console.log('结果:', JSON.stringify(result4))
  console.log('预期: {} （C++ 默认跳过）\n')

  // ===== 测试 5: 非代码工作区（无任何项目配置）=====
  console.log('=== 测试 5: 非代码工作区（TS 文件但无 package.json）===')
  const noPkgDir = join(testRoot, 'no-pkg')
  mkdirSync(noPkgDir, { recursive: true })
  const orphanTsFile = join(noPkgDir, 'orphan.ts')
  writeFileSync(orphanTsFile, 'const x: number = "bad"')
  const result5 = await callback(
    {
      hook_event_name: 'PostToolUse',
      tool_name: 'Write',
      tool_input: { file_path: orphanTsFile },
      cwd: noPkgDir,
    } as any,
    undefined,
    {} as any
  )
  console.log('结果:', JSON.stringify(result5))
  console.log('预期: {} （找不到项目配置，跳过）\n')

  // ===== 测试 6: hook_event_name 不是 PostToolUse =====
  console.log('=== 测试 6: 非 PostToolUse 事件（应早返回）===')
  const result6 = await callback(
    {
      hook_event_name: 'PreToolUse',
      tool_name: 'Write',
      tool_input: { file_path: tsFile },
      cwd: tsDir,
    } as any,
    undefined,
    {} as any
  )
  console.log('结果:', JSON.stringify(result6))
  console.log('预期: {} （非 PostToolUse）\n')

  // ===== 测试 7: 用户配置关闭 TS 后不触发 =====
  console.log('=== 测试 7: 用户配置关闭 TypeScript 后不触发 ===')
  const disabledHooks = buildPostToolUseHooks({
    typescript: { enabled: false },
  })
  const disabledCallback = disabledHooks.PostToolUse![0]!.hooks[0]!
  const result7 = await disabledCallback(
    {
      hook_event_name: 'PostToolUse',
      tool_name: 'Write',
      tool_input: { file_path: tsFile },
      cwd: tsDir,
    } as any,
    undefined,
    {} as any
  )
  console.log('结果:', JSON.stringify(result7))
  console.log('预期: {} （TS 被用户关闭，不触发）\n')

  // ===== 测试 8: 用户启用 C++ 后触发（找不到构建文件则跳过）=====
  console.log('=== 测试 8: 用户启用 C++ 后行为 ===')
  const cppHooks = buildPostToolUseHooks({
    cpp: { enabled: true, timeoutSec: 90 },
  })
  const cppCallback = cppHooks.PostToolUse![0]!.hooks[0]!
  const cppFile2 = join(testRoot, 'main2.cpp')
  writeFileSync(cppFile2, 'int main() { return 0; }')
  const result8 = await cppCallback(
    {
      hook_event_name: 'PostToolUse',
      tool_name: 'Write',
      tool_input: { file_path: cppFile2 },
      cwd: testRoot,
    } as any,
    undefined,
    {} as any
  )
  console.log('结果:', JSON.stringify(result8))
  console.log('预期: {} （C++ 启用但无 CMakeLists.txt/Makefile，找不到命令跳过）\n')

  console.log('========== 验证完成 ==========')
} finally {
  // 清理
  try {
    rmSync(testRoot, { recursive: true, force: true })
    console.log(`[清理] 已删除 ${testRoot}`)
  } catch (e) {
    console.warn('[清理] 失败:', e)
  }
}
