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

export const rootMarkers = [electronRoot, repoRoot].map(escapeForPkill)

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
    killUnixByPattern(`${marker}.*node_modules/electron/dist/Electron\\.app/Contents/MacOS/Electron`)
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

export function killWinByCommandLine(fragment: string): void {
  const escaped = fragment.replace(/\\/g, '\\\\').replace(/'/g, "''")
  const ps = [
    'Get-CimInstance Win32_Process |',
    `Where-Object { $_.CommandLine -like '*${escaped}*' } |`,
    'ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }',
  ].join(' ')
  try {
    execSync(`powershell.exe -NoProfile -NonInteractive -Command "${ps}"`, { stdio: 'ignore' })
  } catch {
    // 无匹配进程
  }
}

/** Windows：按命令行清理本仓库 Electron */
export function killWinProjectElectron(): void {
  const fragments = [
    'node_modules\\electron\\dist\\electron.exe',
    'electronmon\\src\\hook.js',
    'TAgent_General',
  ]
  for (const fragment of fragments) {
    killWinByCommandLine(fragment)
  }
}
