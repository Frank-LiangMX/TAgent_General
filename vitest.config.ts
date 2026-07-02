import { defineConfig } from 'vitest/config'
import path from 'path'

// 依赖 better-sqlite3 native module 的测试文件
// - CI（ubuntu）：node + vitest 跑，better-sqlite3 编译为 Node ABI，能加载
// - 本地 dev（Windows）：better-sqlite3 被 rebuild 为 Electron ABI，vitest (Node) 加载会 ABI 不匹配
//   本地 skip 这两个文件，CI 跑全量
const nativeModuleTests = [
  'apps/electron/src/main/lib/kanban-db.test.ts',
  'apps/electron/src/main/lib/kanban-dispatcher.test.ts',
]

const isCI = !!process.env.CI

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['apps/**/*.test.ts', 'packages/**/*.test.ts'],
    exclude: ['node_modules/**', ...(isCI ? [] : nativeModuleTests)],
  },
  resolve: {
    alias: {
      // 部分测试文件用 `import { describe, expect, test } from 'bun:test'`
      // (Bun 原生测试 API)。vitest API 兼容，直接 alias 过去，让 CI 用 vitest
      // 也能跑这些文件，本地 `bun test` 不受影响。
      'bun:test': 'vitest',
      '@': path.resolve(__dirname, './apps/electron/src/renderer'),
      '@tagent/shared': path.resolve(__dirname, './packages/shared/src'),
      '@tagent/core': path.resolve(__dirname, './packages/core/src'),
      '@tagent/ui': path.resolve(__dirname, './packages/ui/src'),
    },
  },
})
