/**
 * 停止本地开发环境：Vite、esbuild watch、electronmon、Electron 等残留进程。
 */
import { execSync } from 'node:child_process'

import {
  killUnixByPattern,
  killUnixProjectElectron,
  killWinByCommandLine,
  killWinByImage,
  killWinProjectElectron,
  repoRoot,
  rootMarkers,
} from './dev-kill-shared'

const isWin = process.platform === 'win32'

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

  // electronmon 退出后 Electron 主进程常会留在 Dock，必须单独清理
  killUnixProjectElectron()

  killDevPort()
}

function stopWindows(): void {
  killWinByImage('electronmon.exe')
  killWinProjectElectron()

  const fragments = [
    'dist\\main.cjs',
    'vite dev',
    'esbuild',
    'concurrently',
    'run-electronmon',
    'apps\\electron',
    repoRoot,
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
