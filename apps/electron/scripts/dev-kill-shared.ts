/**
 * 开发环境进程清理的共享匹配规则。
 * dev-stop / dev-cleanup 共用，避免 electronmon 被杀后 Electron 子进程仍留在 Dock。
 */
import { execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const electronRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
export const repoRoot = join(electronRoot, '..', '..')

function escapeForPkill(pattern: string): string {
  return pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Unix pkill 用（已转义） */
export const rootMarkers = [electronRoot, repoRoot].map(escapeForPkill)

/** Windows 命令行匹配用（原始路径） */
export const winRootPaths = [electronRoot, repoRoot]

function escapePsLike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "''")
}

export function killUnixByPattern(pattern: string): void {
  try {
    execSync(`pkill -f '${pattern.replace(/'/g, "'\\''")}' 2>/dev/null`, { stdio: 'ignore' })
  } catch {
    // 无匹配进程
  }
}

/** 清理本仓库 Electron 主进程（Dock 里显示为 Electron） */
export function killUnixProjectElectron(): void {
  for (const marker of rootMarkers) {
    killUnixByPattern(
      `${marker}.*node_modules/electron/dist/Electron\\.app/Contents/MacOS/Electron`
    )
    killUnixByPattern(`${marker}.*electronmon/src/hook\\.js`)
  }
}

export function killWinByImage(name: string): void {
  try {
    execSync(`taskkill /F /IM ${name} 2>nul`, { stdio: 'ignore' })
  } catch {
    // 无匹配进程
  }
}

function getProtectedPids(): number[] {
  const pids = [process.pid]
  if (process.ppid) pids.push(process.ppid)
  return pids
}

function buildPidExclusionClause(): string {
  return getProtectedPids()
    .map((pid) => `$_.ProcessId -ne ${pid}`)
    .join(' -and ')
}

export function killWinByCommandLine(fragment: string): void {
  const escaped = escapePsLike(fragment)
  const pidExclusion = buildPidExclusionClause()
  const ps = [
    'Get-CimInstance Win32_Process |',
    `Where-Object { $_.CommandLine -like '*${escaped}*' -and ${pidExclusion} } |`,
    'ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }',
  ].join(' ')
  try {
    execSync(`powershell.exe -NoProfile -NonInteractive -Command "${ps}"`, { stdio: 'ignore' })
  } catch {
    // 无匹配进程
  }
}

/** Windows：命令行须同时包含项目路径与所有片段（避免误杀 Vite / 当前 dev 会话） */
export function killWinByScopedCommandLine(rootPath: string, ...fragments: string[]): void {
  const root = escapePsLike(rootPath.replace(/\//g, '\\'))
  const pidExclusion = buildPidExclusionClause()
  const conditions = [
    `$_.CommandLine -like '*${root}*'`,
    ...fragments.map((f) => `$_.CommandLine -like '*${escapePsLike(f.replace(/\//g, '\\'))}*'`),
    pidExclusion,
  ]
  const ps = [
    'Get-CimInstance Win32_Process |',
    `Where-Object { ${conditions.join(' -and ')} } |`,
    'ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }',
  ].join(' ')
  try {
    execSync(`powershell.exe -NoProfile -NonInteractive -Command "${ps}"`, { stdio: 'ignore' })
  } catch {
    // 无匹配进程
  }
}

/** Windows：按命令行清理本仓库 Electron（仅 electron / electronmon，不扫整个项目目录） */
export function killWinProjectElectron(): void {
  const electronFragments = [
    'node_modules\\electron\\dist\\electron.exe',
    'electronmon\\src\\hook.js',
  ]
  for (const root of winRootPaths) {
    for (const fragment of electronFragments) {
      killWinByScopedCommandLine(root, fragment)
    }
  }
}

/** 释放 Vite 开发端口（上一轮 dev 异常退出时常残留） */
export function killDevPort(port = 5173): void {
  if (process.platform === 'win32') {
    try {
      const out = execSync(`netstat -ano | findstr :${port}`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      const pids = new Set<string>()
      for (const line of out.split('\n')) {
        const parts = line.trim().split(/\s+/)
        const pid = parts[parts.length - 1]
        if (pid && /^\d+$/.test(pid) && pid !== '0') pids.add(pid)
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' })
        } catch {
          // ignore
        }
      }
    } catch {
      // 端口无监听
    }
    return
  }

  try {
    const pids = execSync(`lsof -ti:${port}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .trim()
      .split('\n')
      .filter(Boolean)
    for (const pid of pids) {
      try {
        execSync(`kill -9 ${pid}`, { stdio: 'ignore' })
      } catch {
        // ignore
      }
    }
  } catch {
    // 端口无监听
  }
}
