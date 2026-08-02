/**
 * 重新编译原生模块为 Electron ABI
 *
 * 替代不可靠的 electron-rebuild（在部分环境下静默失败：输出 "Rebuild Complete"
 * 但 build/Release/ 目录为空，导致运行时 ABI 不匹配崩溃）。
 *
 * 直接调用 node-gyp 针对 Electron 头文件编译，并校验产物存在 + 大小。
 *
 * 当前覆盖：
 *   - better-sqlite3（资产库、内存层服务）
 *   - node-pty（内置终端 PTY）
 *
 * 用法：
 *   bun run scripts/rebuild-native.ts            # 编译全部
 *   bun run scripts/rebuild-native.ts --check    # 仅校验产物，不编译
 */

import { existsSync, statSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
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
  const candidates = [join(binDir, binName), join(binDir, 'node-gyp.exe')]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  // 兜底用 npx
  return process.platform === 'win32' ? 'npx.cmd' : 'npx'
}

/** 在 build/Release 下找主 .node 产物（取最大文件：主模块远大于测试扩展等附属产物） */
export function findNativeArtifact(moduleDir: string): string | null {
  const releaseDir = join(moduleDir, 'build/Release')
  if (!existsSync(releaseDir)) return null
  try {
    const files = readdirSync(releaseDir)
    const artifacts = files
      .filter((f) => f.endsWith('.node'))
      .map((f) => join(releaseDir, f))
      .filter((p) => statSync(p).size > 1000)
    return artifacts.sort((a, b) => statSync(b).size - statSync(a).size)[0] ?? null
  } catch {
    return null
  }
}

/** 校验编译产物：存在 + 大小合理 */
function verifyArtifact(moduleName: string, moduleDir: string): void {
  const nodeFile = findNativeArtifact(moduleDir)
  if (!nodeFile) {
    throw new Error(
      `[rebuild-native] ${moduleName} 编译产物不存在于 ${join(
        moduleDir,
        'build/Release'
      )}\n可能是 node-gyp 静默失败，请检查上方日志`
    )
  }
  const stat = statSync(nodeFile)
  if (stat.size < 50_000) {
    throw new Error(
      `[rebuild-native] ${moduleName} 编译产物异常：文件大小 ${stat.size} bytes，预期 > 50KB\n产物: ${nodeFile}`
    )
  }
  console.log(
    `[rebuild-native] ${moduleName} 校验通过: ${nodeFile} (${(stat.size / 1024).toFixed(0)} KB)`
  )
}

/** 编译单个原生模块（node-gyp rebuild for Electron） */
function rebuildModule(moduleName: string, moduleDir: string, electronVersion: string): void {
  console.log(`[rebuild-native] 编译 ${moduleName} for Electron ${electronVersion}`)
  const nodeGyp = getNodeGypBin()
  const args = [
    'rebuild',
    '--release',
    `--runtime=electron`,
    `--target=${electronVersion}`,
    '--disturl=https://electronjs.org/headers',
  ]
  const cmd =
    nodeGyp.endsWith('npx.cmd') || nodeGyp === 'npx'
      ? `${nodeGyp} node-gyp ${args.join(' ')}`
      : `"${nodeGyp}" ${args.join(' ')}`
  execSync(cmd, { cwd: moduleDir, stdio: 'inherit' })
}

/** 需编译的原生模块清单（模块名 + 是否必须存在） */
const NATIVE_MODULES: Array<{ name: string; required: boolean }> = [
  { name: 'better-sqlite3', required: true },
]

/**
 * 用 prebuilt N-API 二进制的原生模块（无需 node-gyp 编译）。
 * 只校验当前平台 prebuilds 目录存在。
 */
const PREBUILT_NATIVE_MODULES = ['node-pty']

function main(): void {
  const checkOnly = process.argv.includes('--check')
  const electronVersion = getElectronVersion()

  for (const { name, required } of NATIVE_MODULES) {
    const moduleDir = findModuleDir(name)
    if (!moduleDir) {
      if (required) {
        throw new Error(`找不到 ${name} 模块，请先 bun install`)
      }
      console.log(`[rebuild-native] 跳过可选模块 ${name}（未安装）`)
      continue
    }
    if (!existsSync(join(moduleDir, 'binding.gyp'))) {
      console.log(`[rebuild-native] 跳过 ${name}（无 binding.gyp，可能用 prebuilt）`)
      // 仍校验产物存在
      if (checkOnly) verifyArtifact(name, moduleDir)
      continue
    }

    if (checkOnly) {
      console.log(`[rebuild-native] 仅校验模式: ${name}`)
      verifyArtifact(name, moduleDir)
      continue
    }

    rebuildModule(name, moduleDir, electronVersion)
    verifyArtifact(name, moduleDir)
  }

  // 校验 prebuilt N-API 模块（node-pty 等）：只确认当前平台 prebuilds 存在
  for (const name of PREBUILT_NATIVE_MODULES) {
    const moduleDir = findModuleDir(name)
    if (!moduleDir) continue
    const prebuildDir = join(moduleDir, 'prebuilds', `${process.platform}-${process.arch}`)
    if (!existsSync(prebuildDir)) {
      console.warn(
        `[rebuild-native] 警告: ${name} 缺少当前平台 prebuilds (${prebuildDir})，终端可能不可用`
      )
    } else {
      console.log(`[rebuild-native] ${name} prebuilt 校验通过: ${prebuildDir}`)
    }
  }

  console.log('[rebuild-native] 完成')
}

// 直接运行时才执行编译（被 vitest 等 import 时跳过副作用）
const isEntry =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (isEntry) {
  try {
    main()
  } catch (err) {
    console.error(`[rebuild-native] 失败: ${err instanceof Error ? err.message : err}`)
    process.exit(1)
  }
}
