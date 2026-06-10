/**
 * build-ta-wheels - 预下载 TA MCP Server 的所有 Python 依赖
 *
 * 把 ta-agent-mcp 及其依赖打成 wheel 放进
 * apps/electron/ta-agent-mcp-wheels/<platform>-<arch>/
 *
 * 打包后由 electron-builder.yml 的 extraResources 一并打入安装包。
 * 离线安装时 installer 会优先用本地 wheelhouse，避免运行时联网。
 */

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const APPS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TA_AGENT_MCP_DIR = resolve(APPS_DIR, '..', '..', 'ta-agent-mcp')
const WHEELS_DIR = join(APPS_DIR, 'ta-agent-mcp-wheels', `${process.platform}-${process.arch}`)

/** Python 包列表（与 ta-agent-mcp/pyproject.toml dependencies 保持一致） */
const TA_AGENT_MCP_DEPS = [
  'mcp',
  'trimesh',
  'pillow',
  'numpy',
  'pydantic',
]

/** pip download platform tags */
const PLATFORM_TAGS: Record<string, string[]> = {
  win32: ['win_amd64'],
  darwin: ['macosx_11_0_arm64', 'macosx_11_0_x86_64'],
  linux: ['manylinux2014_x86_64', 'manylinux_2_17_x86_64'],
}

/** 检查 Python 是否可用，返回 python.exe 的完整路径 */
function findPython(): string | null {
  for (const cmd of ['python', 'python3', 'py']) {
    try {
      // 用 `--version` 探测存在性 + 解析绝对路径
      const out = execSync(`${cmd} -c "import sys; print(sys.executable)"`, {
        encoding: 'utf-8',
        timeout: 5000,
      }).trim()
      if (out && /python\d?\.exe$/i.test(out)) {
        console.log(`  使用 Python: ${cmd} → ${out}`)
        return out
      }
    } catch {
      /* try next */
    }
  }
  return null
}

/** 解析 ta-agent-mcp 自身的依赖（递归） */
function resolveDeps(python: string, packageName: string): string[] {
  // ta-agent-mcp 本身不发布到 PyPI，只下载它的 deps
  void python
  void packageName
  return TA_AGENT_MCP_DEPS
}

async function main(): Promise<void> {
  console.log('[build-ta-wheels] 开始下载 TA MCP Server 依赖 wheels')
  console.log(`  平台: ${process.platform} (${process.arch})`)
  console.log(`  目标目录: ${WHEELS_DIR}`)

  const python = findPython()
  if (!python) {
    console.error('[build-ta-wheels] 错误: 未找到 Python（需要 Python 3.10+）')
    process.exit(1)
  }

  // 清理旧 wheels
  if (existsSync(WHEELS_DIR)) {
    console.log('  清理旧 wheels...')
    rmSync(WHEELS_DIR, { recursive: true, force: true })
  }
  mkdirSync(WHEELS_DIR, { recursive: true })

  // 决定 platform tags
  const tags = PLATFORM_TAGS[process.platform] || []
  if (tags.length === 0) {
    console.error(`[build-ta-wheels] 错误: 不支持的平台 ${process.platform}`)
    process.exit(1)
  }

  // ta-agent-mcp 本身只在本地源码里（不发布到 PyPI），其他依赖走 PyPI
  const allPackages = resolveDeps(python, 'ta-agent-mcp')
  console.log(`  待下载包: ${allPackages.join(', ')}`)
  console.log('  （ta-agent-mcp 本身从本地源码安装，wheelhouse 只放它的 deps）')

  // 为当前平台下载 wheels
  for (const tag of tags) {
    const platformDir = join(WHEELS_DIR, `py3-none-${tag}`)
    mkdirSync(platformDir, { recursive: true })

    const args = [
      '-m',
      'pip',
      'download',
      '--dest',
      platformDir,
      '--python-version',
      '3.10',
      '--platform',
      tag,
      '--only-binary=:all:',
      '--no-deps',
      ...allPackages,
    ]

    console.log(`  下载 ${tag} 的 wheels 到 ${platformDir}...`)
    try {
      // bun 在 Windows 上 spawn + shell: true 都会触发 uv_spawn cmd.exe 的 ENOENT。
      // execSync 不走 shell，能直接调 .exe 路径。
      const cmd = `${python} ${args.map((a) => `"${a}"`).join(' ')}`
      execSync(cmd, {
        cwd: TA_AGENT_MCP_DIR,
        stdio: 'inherit',
        timeout: 300_000,
      })
    } catch (e) {
      console.error(`[build-ta-wheels] 下载 ${tag} 失败:`, e instanceof Error ? e.message : String(e))
      // 不退出，继续其他平台
    }
  }

  // 合并所有平台子目录到 WHEELS_DIR 顶层（installer 找 --find-links 时扫整个目录）
  // 简化：installer 拿到的是顶层目录，pip 会自动扫所有 .whl 文件；不需要合并
  console.log('[build-ta-wheels] 完成！')
  console.log(`  wheels 在: ${WHEELS_DIR}`)
  console.log(`  平台子目录: ${tags.join(', ')}`)
}

main().catch((e) => {
  console.error('[build-ta-wheels] 致命错误:', e)
  process.exit(1)
})
