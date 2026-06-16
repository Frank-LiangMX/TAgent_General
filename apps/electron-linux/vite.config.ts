import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 与主工程共享的 vite 配置
export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  publicDir: resolve(__dirname, 'src/renderer/public'),
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
      '@tagent/shared': resolve(__dirname, '../../packages/shared/src'),
      '@tagent/core': resolve(__dirname, '../../packages/core/src'),
      '@tagent/ui': resolve(__dirname, '../../packages/ui/src'),
    },
  },
  build: {
    outDir: resolve(__dirname, '../../dist/renderer'),
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/renderer/index.html'),
        detached: resolve(__dirname, 'src/renderer/detached-preview.html'),
      },
    },
  },
  plugins: [react()],
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
})