/**
 * 启动前清理上一轮残留的 Electron / esbuild watch 进程。
 * 不杀 Vite、concurrently、也不匹配「run dev」，避免误伤当前 dev 会话。
 */
import { execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const isWin = process.platform === 'win32'
const electronRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = join(electronRoot, '..', '..')

function escapeForPkill(pattern: string): string {
  return pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const rootMarkers = [electronRoot, repoRoot].map(escapeForPkill)

function killUnixByPattern(pattern: string): void {
  try {
    execSync(`pkill -f '${pattern.replace(/'/g, "'\\''")}' 2>/dev/null`, { stdio: 'ignore' })
  } catch {
    // 无匹配进程
  }
}

function killWinByImage(name: string): void {
  try {
    execSync(`taskkill /F /IM ${name} 2>nul`, { stdio: 'ignore' })
  } catch {
    // 无匹配进程
  }
}

function killWinByCommandLine(fragment: string): void {
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

function cleanupUnix(): void {
  killUnixByPattern('electronmon \\.')
  killUnixByPattern('electronmon/bin/cli')

  for (const marker of rootMarkers) {
    killUnixByPattern(`${marker}.*dist/main`)
    killUnixByPattern(`${marker}.*esbuild.*main\\.cjs`)
    killUnixByPattern(`${marker}.*esbuild.*preload\\.cjs`)
    killUnixByPattern(`${marker}.*run-electronmon`)
  }
}

function cleanupWindows(): void {
  killWinByImage('electronmon.exe')
  killWinByImage('electron.exe')

  const fragments = ['dist\\main.cjs', 'run-electronmon', 'esbuild']
  for (const fragment of fragments) {
    killWinByCommandLine(fragment)
  }
}

if (isWin) {
  cleanupWindows()
} else {
  cleanupUnix()
}
