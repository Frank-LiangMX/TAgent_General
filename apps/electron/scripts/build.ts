#!/usr/bin/env bun
/**
 * TAgent 统一打包脚本
 *
 * 功能：
 * - 跨平台支持：macOS / Windows / Linux
 * - 自动检测平台，切换正确的工程目录
 * - 使用 npx 调用 electron-builder（解决 bun 兼容性问题）
 * - 支持多种输出格式
 * - 分步执行，带计时和状态指示
 *
 * 使用：
 * bun run scripts/build.ts                    # 当前平台打包
 * bun run scripts/build.ts --mac              # macOS 打包
 * bun run scripts/build.ts --win              # Windows 打包
 * bun run scripts/build.ts --linux            # Linux 打包
 * bun run scripts/build.ts --mac --arm64      # macOS arm64 架构
 * bun run scripts/build.ts --mac --dmg        # 只构建 DMG
 * bun run scripts/build.ts --linux --appimage # Linux AppImage
 * bun run scripts/build.ts --no-sign          # 跳过代码签名
 * bun run scripts/build.ts --skip-build       # 跳过构建步骤（仅打包）
 * bun run scripts/build.ts --verbose          # 详细日志
 */

import { spawnSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// ============================================
// 类型定义
// ============================================

interface StepResult {
  name: string
  duration: number
  success: boolean
  skipped: boolean
}

interface BuildOptions {
  platform: 'mac' | 'win' | 'linux' | 'auto'
  arch: 'arm64' | 'x64' | 'auto'
  format: string
  noSign: boolean
  skipBuild: boolean
  verbose: boolean
}

// ============================================
// 常量
// ============================================

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = join(__dirname, '..')
const ELECTRON_DIR = ROOT_DIR

// 平台特定格式映射
const PLATFORM_FORMATS: Record<string, string[]> = {
  mac: ['dmg', 'zip', 'dir'],
  win: ['nsis', 'portable', 'dir'],
  linux: ['AppImage', 'deb', 'rpm', 'tar.gz', 'dir'],
}

// ============================================
// 工具函数
// ============================================

const color = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const min = Math.floor(ms / 60000)
  const sec = ((ms % 60000) / 1000).toFixed(0)
  return `${min}m${sec}s`
}

function printSeparator(): void {
  console.log(`${color.dim}${'─'.repeat(60)}${color.reset}`)
}

function printStepStart(step: number, total: number, name: string): void {
  console.log(
    `\n${color.bgBlue}${color.bold} 步骤 ${step}/${total} ${color.reset} ${color.cyan}${name}${color.reset}`
  )
  printSeparator()
}

function printStepResult(result: StepResult): void {
  if (result.skipped) {
    console.log(
      `${color.bgYellow}${color.bold} 跳过 ${color.reset} ${result.name} ${color.dim}(已跳过)${color.reset}`
    )
    return
  }
  const icon = result.success
    ? `${color.bgGreen}${color.bold} 完成 ${color.reset}`
    : `${color.bgRed}${color.bold} 失败 ${color.reset}`
  const time = `${color.dim}(${formatDuration(result.duration)})${color.reset}`
  console.log(`${icon} ${result.name} ${time}`)
}

function detectCurrentPlatform(): 'mac' | 'win' | 'linux' {
  switch (process.platform) {
    case 'darwin':
      return 'mac'
    case 'win32':
      return 'win'
    case 'linux':
      return 'linux'
    default:
      throw new Error(`不支持的平台: ${process.platform}`)
  }
}

function getWorkDir(_platform: 'mac' | 'win' | 'linux'): string {
  return ELECTRON_DIR
}

function runStep(
  name: string,
  command: string,
  args: string[],
  options: { verbose: boolean; env?: Record<string, string>; skip?: boolean; cwd?: string }
): StepResult {
  if (options.skip) {
    return { name, duration: 0, success: true, skipped: true }
  }

  const start = Date.now()
  const stdio = options.verbose ? 'inherit' : 'pipe'
  const cwd = options.cwd || ROOT_DIR

  const result = spawnSync(command, args, {
    stdio: [stdio, stdio, 'inherit'],
    cwd,
    env: { ...process.env, ...options.env },
    shell: true,
  })

  const duration = Date.now() - start

  if (result.status !== 0 && !options.verbose && result.stdout) {
    console.log(result.stdout.toString())
  }

  return { name, duration, success: result.status === 0, skipped: false }
}

// ============================================
// 参数解析
// ============================================

function parseArgs(): BuildOptions {
  const args = process.argv.slice(2)

  let platform: 'mac' | 'win' | 'linux' | 'auto' = 'auto'
  let arch: 'arm64' | 'x64' | 'auto' = 'auto'
  let format = ''

  for (const arg of args) {
    if (arg === '--mac') platform = 'mac'
    else if (arg === '--win') platform = 'win'
    else if (arg === '--linux') platform = 'linux'
    else if (arg === '--arm64') arch = 'arm64'
    else if (arg === '--x64') arch = 'x64'
    else if (arg === '--dmg') format = 'dmg'
    else if (arg === '--zip') format = 'zip'
    else if (arg === '--nsis') format = 'nsis'
    else if (arg === '--portable') format = 'portable'
    else if (arg === '--appimage') format = 'AppImage'
    else if (arg === '--deb') format = 'deb'
    else if (arg === '--rpm') format = 'rpm'
    else if (arg === '--tar.gz') format = 'tar.gz'
    else if (arg === '--dir') format = 'dir'
  }

  return {
    platform,
    arch,
    format,
    noSign: args.includes('--no-sign'),
    skipBuild: args.includes('--skip-build'),
    verbose: args.includes('--verbose'),
  }
}

// ============================================
// 主流程
// ============================================

function main(): void {
  const opts = parseArgs()
  const platform = opts.platform === 'auto' ? detectCurrentPlatform() : opts.platform
  const arch = opts.arch === 'auto' ? process.arch : opts.arch
  const workDir = getWorkDir(platform)
  const results: StepResult[] = []

  // 打印配置信息
  console.log(`\n${color.bgBlue}${color.bold} TAgent 打包工具 ${color.reset}\n`)
  console.log(
    `  ${color.bold}平台${color.reset}:       ${color.cyan}${platform}${color.reset}${opts.platform === 'auto' ? ' (自动检测)' : ''}`
  )
  console.log(
    `  ${color.bold}架构${color.reset}:       ${color.cyan}${arch}${color.reset}${opts.arch === 'auto' ? ' (自动检测)' : ''}`
  )
  console.log(`  ${color.bold}工作目录${color.reset}:   ${color.dim}${workDir}${color.reset}`)
  console.log(`  ${color.bold}输出格式${color.reset}:   ${opts.format || '默认'}`)
  console.log(`  ${color.bold}代码签名${color.reset}:   ${opts.noSign ? '跳过' : '启用'}`)
  console.log(`  ${color.bold}构建步骤${color.reset}:   ${opts.skipBuild ? '跳过' : '执行'}`)
  console.log(`  ${color.bold}详细日志${color.reset}:   ${opts.verbose ? '开启' : '关闭'}`)
  printSeparator()

  const totalSteps = opts.skipBuild ? 1 : 5
  let step = 0

  // ── 构建步骤（可选跳过）──
  if (!opts.skipBuild) {
    // 步骤 1: 构建主进程
    step++
    printStepStart(step, totalSteps, '构建主进程 (esbuild)')
    results.push(
      runStep('构建主进程', 'bun', ['run', 'build:main'], { verbose: opts.verbose, cwd: workDir })
    )
    printStepResult(results[results.length - 1])
    if (!results[results.length - 1].success) return printSummary(results)

    // 步骤 2: 构建 Preload
    step++
    printStepStart(step, totalSteps, '构建 Preload (esbuild)')
    results.push(
      runStep('构建 Preload', 'bun', ['run', 'build:preload'], {
        verbose: opts.verbose,
        cwd: workDir,
      })
    )
    printStepResult(results[results.length - 1])
    if (!results[results.length - 1].success) return printSummary(results)

    // 步骤 3: 构建渲染进程
    step++
    printStepStart(step, totalSteps, '构建渲染进程 (Vite)')
    results.push(
      runStep('构建渲染进程', 'bun', ['run', 'build:renderer'], {
        verbose: opts.verbose,
        cwd: workDir,
      })
    )
    printStepResult(results[results.length - 1])
    if (!results[results.length - 1].success) return printSummary(results)

    // 步骤 4: 复制资源文件
    step++
    printStepStart(step, totalSteps, '复制资源文件')
    results.push(
      runStep('复制资源文件', 'bun', ['run', 'build:resources'], {
        verbose: opts.verbose,
        cwd: workDir,
      })
    )
    printStepResult(results[results.length - 1])
  }

  // 步骤 5: electron-builder 打包
  step++
  printStepStart(step, totalSteps, 'Electron Builder 打包')

  const builderArgs = ['electron-builder', `--${platform}`, `--${arch}`]

  // 指定输出格式
  if (opts.format && opts.format !== 'dir') {
    if (platform === 'mac') {
      builderArgs.push(`--config.mac.target=${opts.format}`)
    } else if (platform === 'win') {
      // win.target 数组形式：nsis / portable
      builderArgs.push(`--config.win.target=${opts.format}`)
    } else if (platform === 'linux') {
      builderArgs.push('--' + opts.format.toLowerCase())
    }
  } else if (opts.format === 'dir') {
    builderArgs.push('--dir')
  }

  // 签名环境变量
  const builderEnv: Record<string, string> = {}
  if (opts.noSign) {
    builderEnv['CSC_IDENTITY_AUTO_DISCOVERY'] = 'false'
  }
  if (opts.verbose) {
    builderEnv['DEBUG'] = 'electron-builder,electron-builder:*'
  }

  results.push(
    runStep('Electron Builder', 'npx', builderArgs, {
      verbose: true,
      env: builderEnv,
      cwd: workDir,
    })
  )
  printStepResult(results[results.length - 1])

  printSummary(results, workDir)
}

function printSummary(results: StepResult[], workDir?: string): void {
  console.log(`\n${color.bgBlue}${color.bold} 打包汇总 ${color.reset}\n`)

  const totalTime = results.reduce((sum, r) => sum + r.duration, 0)
  const allSuccess = results.every((r) => r.success)

  for (const r of results) {
    if (r.skipped) {
      console.log(
        `  ${color.dim}○${color.reset} ${r.name.padEnd(20)} ${color.dim}跳过${color.reset}`
      )
      continue
    }
    const icon = r.success ? `${color.green}●${color.reset}` : `${color.red}●${color.reset}`
    const bar = r.duration > 0 ? '█'.repeat(Math.min(Math.ceil(r.duration / 1000), 30)) : ''
    const barColor =
      r.duration > 30000 ? color.red : r.duration > 10000 ? color.yellow : color.green
    console.log(
      `  ${icon} ${r.name.padEnd(20)} ${barColor}${bar}${color.reset} ${formatDuration(r.duration)}`
    )
  }

  printSeparator()

  if (allSuccess && workDir) {
    const outDir = join(workDir, 'out')
    console.log(`\n  ${color.bold}产物目录${color.reset}: ${color.cyan}${outDir}${color.reset}\n`)
  }

  const statusIcon = allSuccess
    ? `${color.bgGreen}${color.bold} 成功 ${color.reset}`
    : `${color.bgRed}${color.bold} 失败 ${color.reset}`
  console.log(`  ${statusIcon}  总耗时: ${color.bold}${formatDuration(totalTime)}${color.reset}\n`)

  process.exit(allSuccess ? 0 : 1)
}

main()
