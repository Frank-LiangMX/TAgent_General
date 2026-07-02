/**
 * 停止本地开发环境：Vite、esbuild watch、electronmon、Electron 等残留进程。
 */
import {
  killDevPort,
  killUnixByPattern,
  killUnixProjectElectron,
  killWinByCommandLine,
  killWinByImage,
  killWinProjectElectron,
  rootMarkers,
} from './dev-kill-shared'

const isWin = process.platform === 'win32'

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

  killUnixProjectElectron()
  killDevPort()
}

function stopWindows(): void {
  killWinByImage('electronmon.exe')
  killWinProjectElectron()

  // 勿用 repoRoot / apps\electron 等过宽片段，会误杀正在执行 dev-stop 的 bun 父进程
  const fragments = [
    'dist\\main.cjs',
    'vite dev',
    'esbuild',
    'concurrently',
    'run-electronmon',
  ]
  for (const fragment of fragments) {
    killWinByCommandLine(fragment)
  }

  killDevPort()
}

console.log('[dev-stop] 正在停止 TAgent 开发进程...')

try {
  if (isWin) {
    stopWindows()
  } else {
    stopUnix()
  }
  console.log('[dev-stop] 完成')
} catch (error) {
  console.warn('[dev-stop] 部分清理失败（可忽略）:', error)
}
