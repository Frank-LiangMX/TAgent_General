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
      '@': path.resolve(__dirname, './apps/electron/src/renderer'),
      '@tagent/shared': path.resolve(__dirname, './packages/shared/src'),
      '@tagent/core': path.resolve(__dirname, './packages/core/src'),
      '@tagent/ui': path.resolve(__dirname, './packages/ui/src'),
    },
  },
})