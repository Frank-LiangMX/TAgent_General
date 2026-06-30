/**
 * PostToolUse hooks 集合
 *
 * auto-check：Edit/Write 命中代码文件后，按项目配置文件智能识别语言，
 * 跑对应检查命令（typecheck / lint / cargo check / ruff 等），
 * 错误通过 additionalContext 回灌给 Agent，形成"改完即查"的闭环。
 *
 * 设计要点：
 * - 走 SDK 原生 JS 回调（query options 的 hooks 字段），不走 shell command
 * - 智能识别语言：检测 tsconfig.json / pyproject.toml / Cargo.toml / go.mod 等
 * - 命令查找优先级：项目自定义脚本 > 语言标准工具
 * - 编译型慢语言（C++/Java）默认跳过，避免卡 Agent
 * - 输出截断 8KB，避免 context 爆炸
 * - 同文件连续触发去重：5s 内同路径不重复跑
 * - 死循环防护：同文件连续失败 3 次自动停止
 */

import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'

import type { HookCallback, HookCallbackMatcher } from '@anthropic-ai/claude-agent-sdk'

// ===== 语言识别 =====

/** 各语言支持的文件后缀 */
const LANGUAGE_EXTENSIONS: Record<string, string[]> = {
  typescript: ['.ts', '.tsx', '.mts', '.cts'],
  javascript: ['.js', '.jsx', '.mjs', '.cjs'],
  python: ['.py'],
  rust: ['.rs'],
  go: ['.go'],
  lua: ['.lua'],
  // C++/Java 识别但默认跳过检查（编译慢）
  cpp: ['.cpp', '.cc', '.cxx', '.c', '.h', '.hpp', '.hh', '.hxx'],
  java: ['.java'],
}

/** 各语言的默认配置（enabled + 超时秒数） */
const LANGUAGE_DEFAULTS: Record<string, { enabled: boolean; timeoutSec: number }> = {
  typescript: { enabled: true, timeoutSec: 60 },
  javascript: { enabled: true, timeoutSec: 60 },
  python: { enabled: true, timeoutSec: 60 },
  rust: { enabled: true, timeoutSec: 120 },
  go: { enabled: true, timeoutSec: 60 },
  lua: { enabled: true, timeoutSec: 60 },
  // 编译型慢语言默认关闭，用户可手动启用
  cpp: { enabled: false, timeoutSec: 180 },
  java: { enabled: false, timeoutSec: 180 },
}

/** 识别文件所属语言 */
function detectLanguage(filePath: string): string | null {
  const lower = filePath.toLowerCase()
  for (const [lang, exts] of Object.entries(LANGUAGE_EXTENSIONS)) {
    if (exts.some((ext) => lower.endsWith(ext))) return lang
  }
  return null
}

// ===== 检查命令查找 =====

/** 检查命令候选 */
interface CheckCommand {
  /** 实际执行的命令（已拆分为 args 数组） */
  args: string[]
  /** 命令显示名（用于日志） */
  label: string
  /** 执行超时（ms） */
  timeoutMs: number
}

/** 读取 package.json scripts 字段 */
function readPackageScripts(pkgDir: string): Record<string, string> | null {
  const pkgPath = join(pkgDir, 'package.json')
  if (!existsSync(pkgPath)) return null
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    return pkg?.scripts && typeof pkg.scripts === 'object' ? pkg.scripts : null
  } catch {
    return null
  }
}

/** 读取 pyproject.toml 是否含 ruff/mypy 配置（粗略检测） */
function pythonProjectHasConfig(pyDir: string): boolean {
  return (
    existsSync(join(pyDir, 'pyproject.toml')) ||
    existsSync(join(pyDir, 'setup.py')) ||
    existsSync(join(pyDir, 'requirements.txt')) ||
    existsSync(join(pyDir, '.python-version'))
  )
}

/**
 * 从文件路径向上查找最近的含特定配置文件的目录
 * @param filePath 被编辑文件绝对路径
 * @param markerFile 要找的配置文件名（如 'package.json' / 'Cargo.toml'）
 * @returns 找到的目录绝对路径；找不到返回 null
 */
function findProjectRoot(filePath: string, markerFiles: string[]): string | null {
  let dir = dirname(filePath)
  for (let d = dir; d && d !== dirname(d); d = dirname(d)) {
    if (markerFiles.some((f) => existsSync(join(d, f)))) return d
  }
  return null
}

/**
 * 为指定文件查找检查命令。
 *
 * 优先级：
 * 1. 项目自定义脚本（package.json 的 typecheck/check/lint）
 * 2. 语言标准工具（tsc / ruff / cargo check / go vet / luacheck 等）
 *
 * @param timeoutSec 该语言配置的超时秒数（来自 LANGUAGE_DEFAULTS + 用户覆盖）
 * @returns 命令 + 执行目录；找不到时返回 null
 */
function resolveCheckCommand(
  filePath: string,
  language: string,
  timeoutSec: number
): { command: CheckCommand; cwd: string } | null {
  const timeoutMs = timeoutSec * 1000

  // 1. TS/JS：优先 package.json 脚本
  if (language === 'typescript' || language === 'javascript') {
    const pkgRoot = findProjectRoot(filePath, ['package.json'])
    if (pkgRoot) {
      const scripts = readPackageScripts(pkgRoot)
      if (scripts) {
        // 优先 typecheck > check > lint
        const scriptName =
          typeof scripts.typecheck === 'string'
            ? 'typecheck'
            : typeof scripts.check === 'string'
              ? 'check'
              : typeof scripts.lint === 'string'
                ? 'lint'
                : null

        if (scriptName) {
          // bun 优先，npm 兜底
          const runner = existsSync(join(pkgRoot, 'bun.lockb')) ? 'bun' : 'npm'
          return {
            command: {
              args: [runner, 'run', scriptName],
              label: `${runner} run ${scriptName}`,
              timeoutMs,
            },
            cwd: pkgRoot,
          }
        }
      }
    }
    // 没有自定义脚本：JS 项目无标准工具，跳过；TS 项目用 tsc
    if (language === 'typescript') {
      const tsconfigRoot = findProjectRoot(filePath, ['tsconfig.json'])
      if (tsconfigRoot) {
        return {
          command: {
            args: ['npx', 'tsc', '--noEmit'],
            label: 'tsc --noEmit',
            timeoutMs,
          },
          cwd: tsconfigRoot,
        }
      }
    }
    return null
  }

  // 2. Python：优先 ruff，其次 mypy
  if (language === 'python') {
    const pyRoot = findProjectRoot(filePath, [
      'pyproject.toml',
      'setup.py',
      'requirements.txt',
      '.python-version',
    ])
    if (!pyRoot || !pythonProjectHasConfig(pyRoot)) return null
    // ruff 优先（快），mypy 兜底
    const pyprojectPath = join(pyRoot, 'pyproject.toml')
    let useMypy = false
    if (existsSync(pyprojectPath)) {
      try {
        const content = readFileSync(pyprojectPath, 'utf-8')
        useMypy = content.includes('mypy') && !content.includes('ruff')
      } catch {
        // 忽略读取失败
      }
    }
    return {
      command: useMypy
        ? { args: ['mypy', '.'], label: 'mypy .', timeoutMs }
        : { args: ['ruff', 'check', '.'], label: 'ruff check .', timeoutMs },
      cwd: pyRoot,
    }
  }

  // 3. Rust：cargo check
  if (language === 'rust') {
    const cargoRoot = findProjectRoot(filePath, ['Cargo.toml'])
    if (!cargoRoot) return null
    return {
      command: {
        args: ['cargo', 'check'],
        label: 'cargo check',
        timeoutMs,
      },
      cwd: cargoRoot,
    }
  }

  // 4. Go：go vet
  if (language === 'go') {
    const goRoot = findProjectRoot(filePath, ['go.mod'])
    if (!goRoot) return null
    return {
      command: {
        args: ['go', 'vet', './...'],
        label: 'go vet ./...',
        timeoutMs,
      },
      cwd: goRoot,
    }
  }

  // 5. Lua：luacheck
  if (language === 'lua') {
    const luaRoot = findProjectRoot(filePath, ['.luacheckrc'])
    if (!luaRoot) return null
    return {
      command: {
        args: ['luacheck', '.'],
        label: 'luacheck .',
        timeoutMs,
      },
      cwd: luaRoot,
    }
  }

  // 6. C++：cmake --build 或 make（需用户手动启用，默认关闭）
  if (language === 'cpp') {
    const cmakeRoot = findProjectRoot(filePath, ['CMakeLists.txt'])
    if (cmakeRoot) {
      return {
        command: {
          args: ['cmake', '--build', '.'],
          label: 'cmake --build .',
          timeoutMs,
        },
        cwd: cmakeRoot,
      }
    }
    const makeRoot = findProjectRoot(filePath, ['Makefile'])
    if (makeRoot) {
      return {
        command: {
          args: ['make'],
          label: 'make',
          timeoutMs,
        },
        cwd: makeRoot,
      }
    }
    return null
  }

  // 7. Java：mvn compile 或 gradle（需用户手动启用，默认关闭）
  if (language === 'java') {
    const mvnRoot = findProjectRoot(filePath, ['pom.xml'])
    if (mvnRoot) {
      return {
        command: {
          args: ['mvn', 'compile', '-q'],
          label: 'mvn compile',
          timeoutMs,
        },
        cwd: mvnRoot,
      }
    }
    const gradleRoot = findProjectRoot(filePath, ['build.gradle', 'build.gradle.kts'])
    if (gradleRoot) {
      return {
        command: {
          args: ['gradle', 'compileJava'],
          label: 'gradle compileJava',
          timeoutMs,
        },
        cwd: gradleRoot,
      }
    }
    return null
  }

  return null
}

// ===== 执行 + 状态管理 =====

/** 回灌内容上限（字符数），超出截断 */
const MAX_OUTPUT_CHARS = 8_000

/** 同路径去重窗口（ms） */
const DEDUP_WINDOW_MS = 5_000

/** 同文件连续失败上限 */
const MAX_CONSECUTIVE_FAILURES = 3

interface FileTriggerState {
  lastRunAt: number
  consecutiveFailures: number
  halted: boolean
}

const triggerStateMap = new Map<string, FileTriggerState>()

/** 判断工具调用是否命中代码文件 */
function extractEditedFilePath(toolName: string, toolInput: unknown): string | null {
  if (typeof toolInput !== 'object' || toolInput === null) return null
  const fp = (toolInput as { file_path?: unknown }).file_path
  if (typeof fp !== 'string' || fp.length === 0) return null
  if (toolName !== 'Write' && toolName !== 'Edit' && toolName !== 'MultiEdit') return null
  return fp
}

/** 执行检查命令，返回合并输出 + exit code */
function runCheckCommand(
  args: string[],
  cwd: string,
  timeoutMs: number
): Promise<{ output: string; exitCode: number | null }> {
  return new Promise((resolve) => {
    const child = spawn(args[0]!, args.slice(1), {
      cwd,
      shell: process.platform === 'win32',
      windowsHide: true,
    })

    let output = ''
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      output += `\n[检查超时，已终止]`
      resolve({ output, exitCode: null })
    }, timeoutMs)

    child.stdout.on('data', (d) => {
      output += d.toString()
    })
    child.stderr.on('data', (d) => {
      output += d.toString()
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ output, exitCode: code })
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      resolve({
        output: output + `\n[执行失败: ${err.message}]\n（可能工具未安装）`,
        exitCode: null,
      })
    })
  })
}

function truncateOutput(s: string): string {
  if (s.length <= MAX_OUTPUT_CHARS) return s
  return s.slice(0, MAX_OUTPUT_CHARS) + `\n\n[输出过长，已截断。完整输出 ${s.length} 字符]`
}

// ===== hook 回调 =====

/**
 * 合并用户配置和默认值，得到实际使用的语言配置。
 * 用户配置覆盖默认（enabled / timeoutSec 都是）。
 */
function resolveLanguageConfig(
  language: string,
  userConfig: Partial<Record<string, { enabled?: boolean; timeoutSec?: number }>> | undefined
): { enabled: boolean; timeoutSec: number } {
  const defaults = LANGUAGE_DEFAULTS[language] ?? { enabled: true, timeoutSec: 60 }
  const user = userConfig?.[language]
  return {
    enabled: user?.enabled ?? defaults.enabled,
    timeoutSec: user?.timeoutSec ?? defaults.timeoutSec,
  }
}

/**
 * 创建 auto-check 钩子回调。
 *
 * @param languagesConfig 用户配置的语言开关 + 超时（来自 settings.hooks.languages）
 */
function createAutoCheckCallback(
  languagesConfig: Partial<Record<string, { enabled?: boolean; timeoutSec?: number }>> | undefined
): HookCallback {
  return async (rawInput) => {
    const input = rawInput as {
      hook_event_name: string
      tool_name: string
      tool_input: unknown
      cwd: string
    }

    if (input.hook_event_name !== 'PostToolUse') return {}

    const filePath = extractEditedFilePath(input.tool_name, input.tool_input)
    if (!filePath) return {}

    const language = detectLanguage(filePath)
    if (!language) return {}

    // 合并用户配置 + 默认值
    const langConfig = resolveLanguageConfig(language, languagesConfig)
    if (!langConfig.enabled) {
      // 该语言被用户或默认关闭，不触发
      return {}
    }

    // 死循环防护：已停止则提示 Agent 向用户说明
    const now = Date.now()
    const state = triggerStateMap.get(filePath) ?? {
      lastRunAt: 0,
      consecutiveFailures: 0,
      halted: false,
    }

    if (state.halted) {
      return {
        hookSpecificOutput: {
          hookEventName: 'PostToolUse' as const,
          additionalContext: `[auto-check] 已停止自动验证：${filePath} 连续修复 ${MAX_CONSECUTIVE_FAILURES} 次仍有检查错误。请向用户说明剩余问题，不要继续盲目修改。`,
        },
      }
    }

    // 去重：同路径 5s 内不重复跑
    if (now - state.lastRunAt < DEDUP_WINDOW_MS) {
      return {}
    }

    // 查找检查命令
    const resolved = resolveCheckCommand(filePath, language, langConfig.timeoutSec)
    if (!resolved) {
      // 找不到项目配置，不触发
      return {}
    }

    state.lastRunAt = now
    triggerStateMap.set(filePath, state)

    console.log(
      `[hooks] auto-check 触发: ${filePath} (${language}, cmd=${resolved.command.label}, cwd=${resolved.cwd})`
    )

    const { output, exitCode } = await runCheckCommand(
      resolved.command.args,
      resolved.cwd,
      resolved.command.timeoutMs
    )

    // exitCode === 0 表示通过：清零失败计数，不回灌
    if (exitCode === 0) {
      state.consecutiveFailures = 0
      console.log(`[hooks] auto-check 通过 (${resolved.command.label})`)
      return {}
    }

    // 失败：累加计数，达上限则 halt
    state.consecutiveFailures += 1
    const reachedLimit = state.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES
    if (reachedLimit) {
      state.halted = true
    }
    triggerStateMap.set(filePath, state)

    const truncated = truncateOutput(output.trim())
    console.log(
      `[hooks] auto-check 失败 (cmd=${resolved.command.label}, exit=${exitCode}, 第 ${state.consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES} 次)${reachedLimit ? '，已停止' : ''}，回灌 ${truncated.length} 字符`
    )

    const haltNote = reachedLimit
      ? `\n\n[注意] 该文件已连续修复 ${MAX_CONSECUTIVE_FAILURES} 次仍有错误，系统已停止自动验证。请向用户说明剩余问题。`
      : ''

    return {
      hookSpecificOutput: {
        hookEventName: 'PostToolUse' as const,
        additionalContext: `[auto-check] 检测到检查错误（${resolved.command.label}，exit=${exitCode}，第 ${state.consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES} 次）。请修复后再继续：\n\n${truncated}${haltNote}`,
      },
    }
  }
}

/**
 * 构造 PostToolUse hook matcher 数组，供 query options 使用。
 *
 * @param languagesConfig 用户配置的语言开关 + 超时（来自 settings.hooks.languages）
 */
export function buildPostToolUseHooks(
  languagesConfig?: Partial<Record<string, { enabled?: boolean; timeoutSec?: number }>>
): Partial<Record<string, HookCallbackMatcher[]>> {
  // 计算最大超时用于 hook matcher 的 timeout 字段
  const maxTimeoutSec = Object.entries(LANGUAGE_DEFAULTS).reduce((max, [lang, def]) => {
    const user = languagesConfig?.[lang]
    const sec = user?.timeoutSec ?? def.timeoutSec
    return Math.max(max, sec)
  }, 60)

  return {
    PostToolUse: [
      {
        matcher: 'Write|Edit|MultiEdit',
        hooks: [createAutoCheckCallback(languagesConfig)],
        timeout: maxTimeoutSec + 5,
      },
    ],
  }
}
