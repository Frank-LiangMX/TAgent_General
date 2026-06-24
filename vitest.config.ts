import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['apps/**/*.test.ts', 'packages/**/*.test.ts'],
    exclude: ['node_modules/**'],
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
