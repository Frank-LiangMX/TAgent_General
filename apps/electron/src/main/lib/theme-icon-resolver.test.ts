/**
 * theme-icon-resolver 单测
 *
 * 验证主题设置（ThemeMode + ThemeStyle + 系统明暗）→ 图标 key 的解析矩阵。
 * 解析逻辑必须与 titlebar-overlay 的颜色解析一致，保证图标和标题栏颜色同步。
 *
 * 注意：只测 resolveLogoKey（纯函数）。getThemeIconPath 依赖 electron app，
 * 用 vi.mock 把 electron 模块整体 stub 掉以避免加载失败。
 */

import { describe, expect, test, vi } from 'vitest'

// theme-icon-resolver.ts 在模块顶部 import { app } from 'electron'，
// electron 在测试运行时（非 Electron 主进程）加载不出来，所以先 mock 掉。
vi.mock('electron', () => ({
  app: { isPackaged: false },
}))

const { resolveLogoKey, resolveNativeThemeSource } = await import('./theme-icon-resolver')

import type { ThemeMode, ThemeStyle } from '../../types'

// ============================================
// 基础模式：light / dark / system
// ============================================

describe('resolveLogoKey - 基础模式', () => {
  test('Given mode=light When 解析 Then 返回 default-light', () => {
    expect(resolveLogoKey('light', undefined, true)).toBe('default-light')
  })

  test('Given mode=light When systemIsDark=false Then 仍是 default-light（不受系统影响）', () => {
    expect(resolveLogoKey('light', undefined, false)).toBe('default-light')
  })

  test('Given mode=dark When 解析 Then 返回 default-dark', () => {
    expect(resolveLogoKey('dark', undefined, false)).toBe('default-dark')
  })

  test('Given mode=dark When systemIsDark=true Then 仍是 default-dark（不受系统影响）', () => {
    expect(resolveLogoKey('dark', undefined, true)).toBe('default-dark')
  })

  test('Given mode=system When systemIsDark=true Then 返回 default-dark', () => {
    expect(resolveLogoKey('system', undefined, true)).toBe('default-dark')
  })

  test('Given mode=system When systemIsDark=false Then 返回 default-light', () => {
    expect(resolveLogoKey('system', undefined, false)).toBe('default-light')
  })
})

// ============================================
// 特殊主题：special + 非 default 风格 → 直接用 themeStyle
// ============================================

describe('resolveLogoKey - 特殊主题（非 default 风格）', () => {
  const specialStyles: ThemeStyle[] = [
    'ocean-light',
    'ocean-dark',
    'forest-light',
    'forest-dark',
    'slate-light',
    'slate-dark',
    'orange-light',
    'orange-dark',
    'purple-light',
    'purple-dark',
  ]

  for (const style of specialStyles) {
    test(`Given mode=special + style=${style} When 解析 Then 返回 ${style}`, () => {
      // 特殊主题不依赖系统明暗
      expect(resolveLogoKey('special', style, true)).toBe(style)
      expect(resolveLogoKey('special', style, false)).toBe(style)
    })
  }
})

// ============================================
// 特殊主题 fallback：special + default → 按系统明暗
// ============================================

describe('resolveLogoKey - special + default 风格 fallback', () => {
  test('Given mode=special + style=default When systemIsDark=true Then 返回 default-dark', () => {
    expect(resolveLogoKey('special', 'default', true)).toBe('default-dark')
  })

  test('Given mode=special + style=default When systemIsDark=false Then 返回 default-light', () => {
    expect(resolveLogoKey('special', 'default', false)).toBe('default-light')
  })

  test('Given mode=special + style=undefined When systemIsDark=true Then fallback 到 default-dark', () => {
    expect(resolveLogoKey('special', undefined, true)).toBe('default-dark')
  })

  test('Given mode=special + style=undefined When systemIsDark=false Then fallback 到 default-light', () => {
    expect(resolveLogoKey('special', undefined, false)).toBe('default-light')
  })
})

// ============================================
// 与 titlebar-overlay 行为一致性
// ============================================

describe('resolveLogoKey - 与 titlebar-overlay 行为一致', () => {
  // 覆盖所有 (mode, style, systemIsDark) 组合的关键路径
  const cases: Array<{
    mode: ThemeMode
    style: ThemeStyle | undefined
    sysDark: boolean
    expected: string
  }> = [
    { mode: 'light', style: undefined, sysDark: true, expected: 'default-light' },
    { mode: 'light', style: 'ocean-dark', sysDark: true, expected: 'default-light' },
    { mode: 'dark', style: undefined, sysDark: false, expected: 'default-dark' },
    { mode: 'dark', style: 'forest-light', sysDark: false, expected: 'default-dark' },
    { mode: 'system', style: undefined, sysDark: true, expected: 'default-dark' },
    { mode: 'system', style: undefined, sysDark: false, expected: 'default-light' },
    { mode: 'special', style: 'default', sysDark: true, expected: 'default-dark' },
    { mode: 'special', style: 'default', sysDark: false, expected: 'default-light' },
    { mode: 'special', style: 'ocean-light', sysDark: true, expected: 'ocean-light' },
    { mode: 'special', style: 'ocean-dark', sysDark: false, expected: 'ocean-dark' },
  ]

  for (const { mode, style, sysDark, expected } of cases) {
    test(`Given (${mode}, ${style}, sys=${sysDark}) When 解析 Then 返回 ${expected}`, () => {
      expect(resolveLogoKey(mode, style, sysDark)).toBe(expected)
    })
  }
})

// ============================================
// nativeTheme.themeSource 解析（原生菜单明暗跟随）
// ============================================

describe('resolveNativeThemeSource - 基础模式', () => {
  test('Given mode=light When 解析 Then 返回 light', () => {
    expect(resolveNativeThemeSource('light', undefined)).toBe('light')
  })

  test('Given mode=dark When 解析 Then 返回 dark', () => {
    expect(resolveNativeThemeSource('dark', undefined)).toBe('dark')
  })

  test('Given mode=system When 解析 Then 返回 system（跟随系统）', () => {
    expect(resolveNativeThemeSource('system', undefined)).toBe('system')
  })
})

describe('resolveNativeThemeSource - 特殊主题（非 default 风格）', () => {
  const lightStyles: ThemeStyle[] = [
    'ocean-light',
    'forest-light',
    'slate-light',
    'orange-light',
    'purple-light',
  ]
  const darkStyles: ThemeStyle[] = [
    'ocean-dark',
    'forest-dark',
    'slate-dark',
    'orange-dark',
    'purple-dark',
  ]

  for (const style of lightStyles) {
    test(`Given mode=special + style=${style} When 解析 Then 返回 light`, () => {
      expect(resolveNativeThemeSource('special', style)).toBe('light')
    })
  }

  for (const style of darkStyles) {
    test(`Given mode=special + style=${style} When 解析 Then 返回 dark`, () => {
      expect(resolveNativeThemeSource('special', style)).toBe('dark')
    })
  }
})

describe('resolveNativeThemeSource - special + default fallback', () => {
  test('Given mode=special + style=default When 解析 Then 返回 system（跟随系统）', () => {
    expect(resolveNativeThemeSource('special', 'default')).toBe('system')
  })

  test('Given mode=special + style=undefined When 解析 Then 返回 system（跟随系统）', () => {
    expect(resolveNativeThemeSource('special', undefined)).toBe('system')
  })
})
