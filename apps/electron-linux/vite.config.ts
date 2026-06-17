import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

const sharedElectronRoot = resolve(__dirname, '../electron')
const sharedRendererRoot = resolve(sharedElectronRoot, 'src/renderer')

// 与主工程共享的 vite 配置
export default defineConfig({
  root: sharedRendererRoot,
  publicDir: resolve(sharedRendererRoot, 'public'),
  base: './',
  resolve: {
    alias: {
      // @/* 指向 src/renderer/*（与 apps/electron 一致）
      '@': sharedRendererRoot,
      '@tagent/shared': resolve(__dirname, '../../packages/shared/src'),
      '@tagent/core': resolve(__dirname, '../../packages/core/src'),
      '@tagent/ui': resolve(__dirname, '../../packages/ui/src'),
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        index: resolve(sharedRendererRoot, 'index.html'),
        detached: resolve(sharedRendererRoot, 'detached-preview.html'),
      },
    },
  },
  css: {
    postcss: {
      plugins: [
        tailwindcss({ config: resolve(sharedElectronRoot, 'tailwind.config.js') }),
        autoprefixer(),
      ],
    },
  },
  plugins: [react()],
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
})
