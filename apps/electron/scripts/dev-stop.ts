/**
 * 停止本地开发环境：Vite、esbuild watch、electronmon、Electron 等残留进程。
 * 跨平台实现，替代 pkill / 手动 killall。
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

function killDevPort(): void {
  if (isWin) {
    try {
      const out = execSync('netstat -ano | findstr :5173', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      const pids = new Set<string>()
      for (const line of out.split('\n')) {
        const parts = line.trim().split(/\s+/)
        const pid = parts[parts.length - 1]
        if (pid && /^\d+$/.test(pid) && pid !== '0') pids.add(pid)
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /F /PID ${pid} 2>nul`, { stdio: 'ignore' })
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
    const pids = execSync('lsof -ti:5173', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .trim()
      .split('\n')
      .filter(Boolean)
    for (const pid of pids) {
      try {
        execSync(`kill -9 ${pid} 2>/dev/null`, { stdio: 'ignore' })
      } catch {
        // ignore
      }
    }
  } catch {
    // 端口无监听
  }
}

function stopUnix(): void {
  killUnixByPattern('electronmon \\.')
  killUnixByPattern('electronmon/bin/cli')

  for (const marker of rootMarkers) {
    killUnixByPattern(`${marker}.*dist/main`)
    killUnixByPattern(`${marker}.*vite dev`)
    killUnixByPattern(`${marker}.*esbuild.*main\\.cjs`)
    killUnixByPattern(`${marker}.*esbuild.*preload\\.cjs`)
    killUnixByPattern(`${marker}.*concurrently`)
    killUnixByPattern(`${marker}.*run-electronmon`)
    killUnixByPattern(`${marker}.*run dev`)
  }

  killDevPort()
}

function stopWindows(): void {
  killWinByImage('electronmon.exe')
  killWinByImage('electron.exe')

  const fragments = [
    'dist\\main.cjs',
    'vite dev',
    'esbuild',
    'concurrently',
    'run-electronmon',
    'apps\\electron',
  ]
  for (const fragment of fragments) {
    killWinByCommandLine(fragment)
  }

  killDevPort()
}

console.log('[dev-stop] 正在停止 TAgent 开发进程...')

if (isWin) {
  stopWindows()
} else {
  stopUnix()
}

console.log('[dev-stop] 完成')
