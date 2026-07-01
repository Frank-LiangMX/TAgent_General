/**
 * 重新编译 better-sqlite3 为 Electron ABI
 *
 * 替代不可靠的 electron-rebuild（在部分环境下静默失败：输出 "Rebuild Complete"
 * 但 build/Release/ 目录为空，导致运行时 ABI 不匹配崩溃）。
 *
 * 直接调用 node-gyp 针对 Electron 头文件编译，并校验产物存在 + 大小。
 *
 * 用法：
 *   bun run scripts/rebuild-native.ts            # 编译
 *   bun run scripts/rebuild-native.ts --check    # 仅校验产物，不编译
 */

import { existsSync, statSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const electronPkgRoot = join(__dirname, '..')

/** 找模块根目录（monorepo hoist 时可能在根 node_modules） */
function findModuleDir(name: string): string | null {
  const candidates = [
    join(electronPkgRoot, 'node_modules', name),
    join(electronPkgRoot, '../../node_modules', name),
  ]
  for (const p of candidates) {
    if (existsSync(join(p, 'package.json'))) return p
  }
  return null
}

/** 读取 electron 版本（从已安装的 node_modules/electron/package.json） */
function getElectronVersion(): string {
  const electronDir = findModuleDir('electron')
  if (!electronDir) {
    throw new Error('找不到 electron 模块，请先 bun install')
  }
  const pkg = JSON.parse(readFileSync(join(electronDir, 'package.json'), 'utf8'))
  if (!pkg.version) {
    throw new Error(`electron package.json 无 version 字段: ${electronDir}`)
  }
  return pkg.version as string
}

/** 找 node-gyp 可执行文件路径 */
function getNodeGypBin(): string {
  const binDir = join(electronPkgRoot, '../../node_modules/.bin')
  const binName = process.platform === 'win32' ? 'node-gyp.cmd' : 'node-gyp'
  const candidates = [
    join(binDir, binName),
    join(binDir, 'node-gyp.exe'),
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  // 兜底用 npx
  return process.platform === 'win32' ? 'npx.cmd' : 'npx'
}

/** 校验编译产物：存在 + 大小合理 */
function verifyArtifact(bsqDir: string): void {
  const nodeFile = join(bsqDir, 'build/Release/better_sqlite3.node')
  if (!existsSync(nodeFile)) {
    throw new Error(`编译产物不存在: ${nodeFile}\n可能是 node-gyp 静默失败，请检查上方日志`)
  }
  const stat = statSync(nodeFile)
  if (stat.size < 100_000) {
    throw new Error(
      `编译产物异常：文件大小 ${stat.size} bytes，预期 > 100KB\n产物: ${nodeFile}`
    )
  }
  console.log(`[rebuild-native] 校验通过: ${nodeFile} (${(stat.size / 1024).toFixed(0)} KB)`)
}

function main(): void {
  const checkOnly = process.argv.includes('--check')

  // 1. 找 better-sqlite3
  const bsqDir = findModuleDir('better-sqlite3')
  if (!bsqDir) {
    throw new Error('找不到 better-sqlite3 模块，请先 bun install')
  }
  if (!existsSync(join(bsqDir, 'binding.gyp'))) {
    throw new Error(`better-sqlite3 缺少 binding.gyp: ${bsqDir}`)
  }

  // 2. 仅校验模式
  if (checkOnly) {
    console.log('[rebuild-native] 仅校验模式')
    verifyArtifact(bsqDir)
    return
  }

  // 3. 读 electron 版本
  const electronVersion = getElectronVersion()
  console.log(`[rebuild-native] 编译 better-sqlite3 for Electron ${electronVersion}`)

  // 4. 调用 node-gyp
  const nodeGyp = getNodeGypBin()
  const args = [
    'rebuild',
    '--release',
    `--runtime=electron`,
    `--target=${electronVersion}`,
    '--disturl=https://electronjs.org/headers',
  ]
  const cmd = nodeGyp.endsWith('npx.cmd') || nodeGyp === 'npx'
    ? `${nodeGyp} node-gyp ${args.join(' ')}`
    : `"${nodeGyp}" ${args.join(' ')}`

  execSync(cmd, { cwd: bsqDir, stdio: 'inherit' })

  // 5. 校验产物（防止静默失败）
  verifyArtifact(bsqDir)
  console.log('[rebuild-native] 完成')
}

try {
  main()
} catch (err) {
  console.error(`[rebuild-native] 失败: ${err instanceof Error ? err.message : err}`)
  process.exit(1)
}
