/**
 * 启动前清理上一轮残留的 Electron / esbuild watch 进程。
 * 不杀 Vite、concurrently、也不匹配「run dev」，避免误伤当前 dev 会话。
 */
import {
  killUnixByPattern,
  killUnixProjectElectron,
  killWinByCommandLine,
  killWinByImage,
  killWinProjectElectron,
  rootMarkers,
} from './dev-kill-shared'

const isWin = process.platform === 'win32'

function cleanupUnix(): void {
  killUnixByPattern('electronmon \\.')
  killUnixByPattern('electronmon/bin/cli')

  for (const marker of rootMarkers) {
    killUnixByPattern(`${marker}.*dist/main`)
    killUnixByPattern(`${marker}.*esbuild.*main\\.cjs`)
    killUnixByPattern(`${marker}.*esbuild.*preload\\.cjs`)
    killUnixByPattern(`${marker}.*run-electronmon`)
  }

  killUnixProjectElectron()
}

function cleanupWindows(): void {
  killWinByImage('electronmon.exe')
  killWinProjectElectron()

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
