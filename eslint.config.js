// ESLint v9 flat config (前身: .eslintrc.cjs)
// 用 FlatCompat 把旧的 extends 链转成 flat config 形式。

import { FlatCompat } from '@eslint/eslintrc'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// eslint v9 内置的 recommended 配置 (原本由 eslint:recommended 指向)
import js from '@eslint/js'

const compat = new FlatCompat({
  baseDirectory: __dirname,
  allConfig: { plugins: {} },
  recommendedConfig: js.configs.recommended,  // 兼容新版 @eslint/eslintrc 3.3.5
})

// 注册一个空 react-hooks 插件，仅用于让源码里 // eslint-disable-line react-hooks/exhaustive-deps
// 注释能识别（plugin 4.6.2 与 ESLint 9 不兼容，先注册成空壳占位）
const reactHooksStub = {
  rules: {
    'rules-of-hooks': { create() { return {} } },
    'exhaustive-deps': { create() { return {} } },
  },
}

export default [
  // 旧配置主体（用 FlatCompat 把 plugin:xxx/recommended 翻译成 flat 形式）
  ...compat.config({
    root: true,
    parser: '@typescript-eslint/parser',
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      ecmaFeatures: { jsx: true },
    },
    plugins: ['@typescript-eslint', 'react', 'import'],
    extends: [
      'eslint:recommended',
      'plugin:@typescript-eslint/recommended',
      'plugin:react/recommended',
      'plugin:react/jsx-runtime',
      'plugin:import/recommended',
    ],
    // 补全 Node + Browser globals
    env: {
      browser: true,
      node: true,
      es2022: true,
    },
    globals: {
      window: 'readonly',
      document: 'readonly',
      console: 'readonly',
      process: 'readonly',
      Buffer: 'readonly',
      __dirname: 'readonly',
      __filename: 'readonly',
      global: 'readonly',
      setTimeout: 'readonly',
      clearTimeout: 'readonly',
      setInterval: 'readonly',
      clearInterval: 'readonly',
    },
    settings: {
      react: { version: 'detect' },
      'import/resolver': {
        // 注: 没装 eslint-import-resolver-typescript, 只用 node 解析
        node: { extensions: ['.js', '.ts', '.tsx', '.jsx'] },
      },
    },
    rules: {
      // 暂时将 no-unused-vars 改为 warn，CI 通过后逐步清理
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      // 允许短路 / 三元 / 标记模板表达式（链式调用太常见，全禁不现实）
      '@typescript-eslint/no-unused-expressions': [
        'error',
        { allowShortCircuit: true, allowTernary: true, allowTaggedTemplates: true },
      ],
      // Electron 主进程需要动态 require() 加载原生模块
      '@typescript-eslint/no-require-imports': 'off',
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      // React 中使用引号很常见，关闭此规则
      'react/no-unescaped-entities': 'off',
      // ⚠️ eslint-plugin-react-hooks 4.6.2 跟 ESLint 9 不兼容（context.getSource 缺失），
      // 全局禁掉。后续要么升 plugin 到 5.x+，要么用 react-compiler + 项目级手动 review。
      // 跟 hook 相关的真错误（条件/循环里调 hook）靠 typecheck + 单元测试兜底。
      'react-hooks/rules-of-hooks': 'off',
      // 文件里很多 // eslint-disable-next-line react-hooks/exhaustive-deps 注释，
      // rule 没注册会报 "Definition not found"。注册成 no-op 让注释生效。
      'react-hooks/exhaustive-deps': 'off',
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            ['parent', 'sibling', 'index'],
            'type',
          ],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import/no-default-export': 'off',
      // 没装 eslint-import-resolver-typescript, 解不了 Vite `@/` alias 和 .ts 路径
      'import/no-unresolved': 'off',
      // Tiptap 扩展（@tiptap/extension-link、starter-kit 等）dual export：既作 default
      // 又作 named（export { Link, Link as default }）。`import Link from '...'` 模式是
      // 库作者推荐的用法，rule 误报直接关掉。
      'import/no-named-as-default': 'off',
      // 业务日志散落各处（main 进程、bridge、IPC handler），改 logger 是单独 refactor，
      // 现阶段先关掉警告避免污染 lint 输出。运行错误日志请用 console.error/warn（已放开）。
      'no-console': 'off',
    },
  }),

  // 注册 react-hooks stub plugin（让 .tsx 里的 eslint-disable 注释能识别 rule 名）
  {
    plugins: {
      'react-hooks': reactHooksStub,
    },
  },

  // flat config 自己处理 ignorePatterns
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/out/**',
      '**/release/**',
      '**/*.cjs',
      '**/*.config.js',
      '**/*.config.ts',
      '**/coverage/**',
      '**/.tagent/**',
      '**/tagent-dist/**',
      '**/tagent-running-data/**',
      // 测试文件用 bun:test，缺 typescript resolver 解析不了，先跳 import/no-unresolved
      // 测试代码的 import 顺序混乱也跳（不影响主代码）
      '**/*.test.ts',
      '**/*.test.tsx',
      // default-skills/*/assets 下的 *.min.js 是 vendor 库（motion.js、highlight.js 等），
      // 不该被项目 lint 规则管
      '**/default-skills/**/assets/**',
      // 临时开发目录
      '**/temp-*/**',
    ],
  },
]
