#!/usr/bin/env bun
/**
 * TAgent 一键发布脚本
 *
 * 功能：
 * - 检查当前版本（从 package.json 读取）
 * - 确认版本号和发布内容
 * - 创建 git tag
 * - 推送 tag 到 GitHub
 * - 自动触发 CI 全平台打包（macOS/Windows/Linux）
 * - 输出 Release 页面链接
 *
 * 使用：
 * bun run scripts/release.ts                # 发布当前版本
 * bun run scripts/release.ts 1.2.0          # 指定版本号
 * bun run scripts/release.ts --dry-run      # 预演（不推送）
 * bun run scripts/release.ts --draft        # 创建 Draft Release
 * bun run scripts/release.ts --prerelease   # 创建 Pre-release（版本号含 - 如 1.0.0-beta）
 */

import { spawnSync } from 'child_process'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = join(__dirname, '..', '..', '..')
const ELECTRON_DIR = join(__dirname, '..')

// ============================================
// 颜色输出
// ============================================

const color = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
}

function log(msg: string): void {
  console.log(msg)
}

function success(msg: string): void {
  console.log(`${color.bgGreen}${color.bold} 成功 ${color.reset} ${msg}`)
}

function error(msg: string): void {
  console.log(`${color.bgRed}${color.bold} 错误 ${color.reset} ${msg}`)
}

function warn(msg: string): void {
  console.log(`${color.bgYellow}${color.bold} 警告 ${color.reset} ${msg}`)
}

function info(msg: string): void {
  console.log(`${color.cyan}${msg}${color.reset}`)
}

// ============================================
// Git 操作
// ============================================

function git(args: string[], options?: { cwd?: string; quiet?: boolean }): string {
  const result = spawnSync('git', args, {
    cwd: options?.cwd || ROOT_DIR,
    encoding: 'utf-8',
    stdio: options?.quiet ? 'pipe' : 'inherit',
  })
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} 失败: ${result.stderr}`)
  }
  return result.stdout?.trim() || ''
}

function gitQuiet(args: string[], cwd?: string): string {
  const result = spawnSync('git', args, {
    cwd: cwd || ROOT_DIR,
    encoding: 'utf-8',
    stdio: 'pipe',
  })
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} 失败: ${result.stderr}`)
  }
  return result.stdout.trim()
}

// ============================================
// 版本解析
// ============================================

function getCurrentVersion(): string {
  const pkg = JSON.parse(readFileSync(join(ELECTRON_DIR, 'package.json'), 'utf-8'))
  return pkg.version
}

function validateVersion(version: string): boolean {
  return /^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)
}

function isPrerelease(version: string): boolean {
  return version.includes('-')
}

// ============================================
// 主流程
// ============================================

interface ReleaseOptions {
  version?: string
  dryRun: boolean
  draft: boolean
  prerelease: boolean
}

function parseArgs(): ReleaseOptions {
  const args = process.argv.slice(2)
  const versionArg = args.find((a) => !a.startsWith('--'))

  return {
    version: versionArg,
    dryRun: args.includes('--dry-run'),
    draft: args.includes('--draft'),
    prerelease: args.includes('--prerelease') || (versionArg ? isPrerelease(versionArg) : false),
  }
}

function main(): void {
  const opts = parseArgs()

  log(`\n${color.bgBlue}${color.bold} TAgent 一键发布 ${color.reset}\n`)
  printSeparator()

  // 1. 检查 Git 状态
  log(`${color.bold}步骤 1: 检查 Git 状态${color.reset}`)
  printSeparator()

  const branch = gitQuiet(['rev-parse', '--abbrev-ref', 'HEAD'])
  const status = gitQuiet(['status', '--porcelain'])

  if (status) {
    warn('存在未提交的更改，请先提交或暂存')
    log(`${color.dim}${status}${color.reset}`)
    process.exit(1)
  }

  if (branch !== 'main' && branch !== 'master') {
    warn(`当前分支是 ${branch}，建议在 main/master 分支发布`)
    log(`${color.dim}如需在当前分支发布，请确认后继续${color.reset}`)
  }

  success(`Git 状态正常，当前分支: ${branch}`)

  // 2. 获取版本
  log(`\n${color.bold}步骤 2: 确认版本${color.reset}`)
  printSeparator()

  const currentVersion = getCurrentVersion()
  const releaseVersion = opts.version || currentVersion

  if (!validateVersion(releaseVersion)) {
    error(`版本号格式错误: ${releaseVersion}`)
    log(`${color.dim}正确格式: 1.0.0 或 1.0.0-beta${color.reset}`)
    process.exit(1)
  }

  info(`当前版本: ${currentVersion}`)
  info(`发布版本: ${releaseVersion}`)
  info(`发布类型: ${opts.prerelease ? 'Pre-release' : opts.draft ? 'Draft' : '正式发布'}`)

  if (opts.dryRun) {
    warn('预演模式：不会实际推送 tag')
  }

  // 3. 检查远程状态
  log(`\n${color.bold}步骤 3: 检查远程仓库${color.reset}`)
  printSeparator()

  const remoteUrl = gitQuiet(['remote', 'get-url', 'origin'])
  const repoMatch = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/)

  if (!repoMatch) {
    error('无法解析 GitHub 仓库信息')
    log(`${color.dim}Remote URL: ${remoteUrl}${color.reset}`)
    process.exit(1)
  }

  const [, owner, repo] = repoMatch
  info(`仓库: ${owner}/${repo}`)

  // 检查 tag 是否已存在
  const existingTags = gitQuiet(['tag', '-l', `v${releaseVersion}`])
  if (existingTags) {
    error(`Tag v${releaseVersion} 已存在`)
    log(`${color.dim}如需重新发布，请先删除旧 tag:${color.reset}`)
    log(`  git tag -d v${releaseVersion}`)
    log(`  git push origin --delete v${releaseVersion}`)
    process.exit(1)
  }

  success(`Tag v${releaseVersion} 不存在，可以创建`)

  // 4. 确认发布
  printSeparator()
  log(`\n${color.bold}即将执行以下操作:${color.reset}`)
  log(`  1. 创建 git tag: v${releaseVersion}`)
  log(`  2. 推送 tag 到 GitHub`)
  log(`  3. 触发 CI 全平台打包`)
  log(`  4. 创建 Release: https://github.com/${owner}/${repo}/releases/tag/v${releaseVersion}`)
  printSeparator()

  if (!opts.dryRun) {
    log(`\n${color.yellow}按 Enter 确认发布，Ctrl+C 取消...${color.reset}`)
    // 等待用户确认
    spawnSync('read', [], { stdio: ['inherit', 'pipe', 'pipe'] })
  }

  // 5. 创建并推送 Tag
  log(`\n${color.bold}步骤 4: 创建并推送 Tag${color.reset}`)
  printSeparator()

  if (opts.dryRun) {
    warn('预演：跳过创建 tag')
    warn('预演：跳过推送 tag')
  } else {
    // 创建 tag
    const tagMessage = opts.prerelease
      ? `Pre-release v${releaseVersion}`
      : `Release v${releaseVersion}`

    git(['tag', '-a', `v${releaseVersion}`, '-m', tagMessage])
    success(`创建 tag v${releaseVersion}`)

    // 推送 tag
    git(['push', 'origin', `v${releaseVersion}`])
    success(`推送 tag 到 GitHub`)
  }

  // 6. 输出结果
  printSeparator()
  log(`\n${color.bgGreen}${color.bold} 发布触发成功! ${color.reset}\n`)

  if (opts.dryRun) {
    warn('这是预演，没有实际推送')
  } else {
    info(`CI 已开始构建全平台版本...`)
    log(`\n  ${color.bold}查看构建进度:${color.reset}`)
    log(`  https://github.com/${owner}/${repo}/actions`)
    log(`\n  ${color.bold}Release 页面（构建完成后）:${color.reset}`)
    log(`  https://github.com/${owner}/${repo}/releases/tag/v${releaseVersion}`)
    log(`\n  ${color.bold}预计等待时间:${color.reset} 10-15 分钟`)
    log(`\n  ${color.dim}构建完成后会自动上传以下文件:${color.reset}`)
    log(`  ${color.dim}• macOS: DMG + ZIP (arm64/x64)${color.reset}`)
    log(`  ${color.dim}• Windows: EXE (x64)${color.reset}`)
    log(`  ${color.dim}• Linux: AppImage + deb (x64)${color.reset}`)
  }

  printSeparator()
}

function printSeparator(): void {
  console.log(`${color.dim}${'─'.repeat(60)}${color.reset}`)
}

main()
