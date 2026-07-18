/**
 * 启动前清理上一轮残留的 Vite / Electron / esbuild watch 进程。
 * 必须在新的并行 dev 进程创建前运行，避免清理到本轮启动的子进程。
 */
import {
  killUnixByPattern,
  killUnixProjectElectron,
  killWinByImage,
  killWinByScopedCommandLine,
  killWinProjectElectron,
  rootMarkers,
  winRootPaths,
} from './dev-kill-shared'

const isWin = process.platform === 'win32'

function cleanupUnix(): void {
  killUnixByPattern('electronmon \\.')
  killUnixByPattern('electronmon/bin/cli')

  for (const marker of rootMarkers) {
    killUnixByPattern(`${marker}.*dist/main`)
    killUnixByPattern(`${marker}.*vite dev`)
    killUnixByPattern(`${marker}.*esbuild.*main\\.cjs`)
    killUnixByPattern(`${marker}.*esbuild.*preload\\.cjs`)
    killUnixByPattern(`${marker}.*concurrently`)
    killUnixByPattern(`${marker}.*run-electronmon`)
  }

  killUnixProjectElectron()
}

function cleanupWindows(): void {
  killWinByImage('electronmon.exe')
  killWinProjectElectron()

  for (const root of winRootPaths) {
    killWinByScopedCommandLine(root, 'dist\\main.cjs')
    killWinByScopedCommandLine(root, 'vite', 'dev')
    killWinByScopedCommandLine(root, 'esbuild', 'main.cjs')
    killWinByScopedCommandLine(root, 'esbuild', 'preload.cjs')
    killWinByScopedCommandLine(root, 'concurrently')
    killWinByScopedCommandLine(root, 'run-electronmon')
  }
}

if (isWin) {
  cleanupWindows()
} else {
  cleanupUnix()
}
