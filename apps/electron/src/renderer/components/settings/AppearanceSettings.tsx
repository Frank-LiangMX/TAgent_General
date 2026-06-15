/**
 * AppearanceSettings - TAgent 视觉签名
 *
 * 布局：
 *   1. Slim 头部（logo + 标题 + 5 色色板内联）
 *   2. TAgent 皮肤（皮肤选择 + 5×2 风格库网格）
 *   3. 排版与材质（界面缩放 / 阅读字号滑杆 / 高级材质）
 *
 * 通过 Jotai atom 管理状态，持久化到 ~/.tagent/settings.json。
 */

import { useAtom, useAtomValue } from 'jotai'
import { Check } from 'lucide-react'
import * as React from 'react'

import {
  SettingsSection,
  SettingsCard,
  SettingsSegmentedControl,
} from './primitives'

import type { MarkdownFontSize, TAgentBrand, ThemeMode, ThemeStyle } from '../../../types'

import './appearance-overrides.css'

import {
  advancedMaterialEnabledAtom,
  updateAdvancedMaterialEnabled,
} from '@/atoms/advanced-material'
import {
  markdownFontSizeAtom,
  updateMarkdownFontSize,
} from '@/atoms/markdown-font-size'
import {
  tagentBrandAtom,
  updateTAgentBrand,
} from '@/atoms/tagent-brand'
import {
  themeModeAtom,
  themeStyleAtom,
  systemIsDarkAtom,
  updateThemeMode,
  updateThemeStyle,
  applyThemeToDOM,
} from '@/atoms/theme'
import { cn } from '@/lib/utils'

/** 皮肤选项 */
const SKIN_OPTIONS = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
  { value: 'system', label: '跟随系统' },
  { value: 'special', label: '风格库' },
]

/** 阅读字号选项 */
const READING_FONT_SIZE_OPTIONS = [
  { value: 'small', label: '小' },
  { value: 'medium', label: '中' },
  { value: 'large', label: '大' },
]

/** 品牌色板定义 */
interface BrandSwatch {
  id: TAgentBrand
  name: string
  solid: string
}

const BRAND_SWATCHES: readonly BrandSwatch[] = [
  { id: 'cyan',   name: '焕蓝', solid: 'hsl(195 90% 55%)' },
  { id: 'violet', name: '锐紫', solid: 'hsl(265 85% 65%)' },
  { id: 'amber',  name: '橙陶', solid: 'hsl(28 95% 55%)'  },
  { id: 'forest', name: '森绿', solid: 'hsl(150 60% 45%)' },
  { id: 'slate',  name: '晶灰', solid: 'hsl(220 15% 55%)' },
]

/** 特殊风格 ID（排除 default） */
type SpecialStyleId = Exclude<ThemeStyle, 'default'>

/** 特殊风格定义 */
interface SpecialStyle {
  id: SpecialStyleId
  name: string
  variant: 'light' | 'dark'
  tag: string
  previewClass: string
  deco: 'cloud' | 'wave' | 'leaf' | 'star' | 'moon' | 'gem' | 'sun' | 'flame' | 'flower' | 'orb'
}

const SPECIAL_STYLES: readonly SpecialStyle[] = [
  // 第一行：亮色（按列对应：col 1 slate, col 2 ocean, col 3 forest, col 4 orange, col 5 purple）
  { id: 'slate-light',  name: '云絮悠然', tag: 'Clay',     variant: 'light', previewClass: 'tagent-theme-cloud-dancer',     deco: 'cloud' },
  { id: 'ocean-light',  name: '碧海晴空', tag: 'Toon',     variant: 'light', previewClass: 'tagent-theme-ocean-light',      deco: 'wave'  },
  { id: 'forest-light', name: '翠林晨光', tag: 'Foliage',  variant: 'light', previewClass: 'tagent-theme-forest-light',     deco: 'leaf'  },
  { id: 'orange-light', name: '琥珀晨曦', tag: 'Albedo',   variant: 'light', previewClass: 'tagent-theme-terracotta-dawn', deco: 'sun'   },
  { id: 'purple-light', name: '紫藤晓露', tag: 'Sheen',    variant: 'light', previewClass: 'tagent-theme-wisteria-dawn',  deco: 'flower'},
  // 第二行：暗色（与第一行同列对应）
  { id: 'slate-dark',   name: '石板暮霭', tag: 'PBR',      variant: 'dark',  previewClass: 'tagent-theme-morandi-night',    deco: 'gem'   },
  { id: 'ocean-dark',   name: '深海夜潮', tag: 'Volume',   variant: 'dark',  previewClass: 'tagent-theme-ocean-dark',       deco: 'star'  },
  { id: 'forest-dark',  name: '青苔夜语', tag: 'SSS',      variant: 'dark',  previewClass: 'tagent-theme-forest-dark',      deco: 'moon'  },
  { id: 'orange-dark',  name: '熔金夜韵', tag: 'Burn',     variant: 'dark',  previewClass: 'tagent-theme-terracotta-night', deco: 'flame' },
  { id: 'purple-dark',  name: '幽兰梦语', tag: 'Velvet',   variant: 'dark',  previewClass: 'tagent-theme-wisteria-night',  deco: 'orb'   },
]

/** 根据平台返回缩放快捷键提示 */
const isMac = navigator.userAgent.includes('Mac')
const ZOOM_HINT = isMac
  ? '使用 ⌘+ 放大、⌘- 缩小、⌘0 恢复默认大小'
  : '使用 Ctrl++ 放大、Ctrl+- 缩小、Ctrl+0 恢复默认大小'

export function AppearanceSettings(): React.ReactElement {
  const [themeMode, setThemeMode] = useAtom(themeModeAtom)
  const [themeStyle, setThemeStyle] = useAtom(themeStyleAtom)
  const systemIsDark = useAtomValue(systemIsDarkAtom)
  const [markdownFontSize, setMarkdownFontSize] = useAtom(markdownFontSizeAtom)
  const [advancedMaterialEnabled, setAdvancedMaterialEnabled] = useAtom(advancedMaterialEnabledAtom)
  const [tagentBrand, setTagentBrand] = useAtom(tagentBrandAtom)

  /** 切换皮肤 */
  const handleThemeChange = React.useCallback((value: string) => {
    const mode = value as ThemeMode
    setThemeMode(mode)
    updateThemeMode(mode)
    if (mode !== 'special') {
      setThemeStyle('default')
      updateThemeStyle('default')
      applyThemeToDOM(mode, 'default', systemIsDark)
    }
  }, [setThemeMode, setThemeStyle, systemIsDark])

  /** 选择风格库中的风格（自动联动签名色） */
  const handleStyleSelect = React.useCallback((style: ThemeStyle) => {
    setThemeMode('special')
    setThemeStyle(style)
    updateThemeMode('special')
    updateThemeStyle(style)
    applyThemeToDOM('special', style, systemIsDark)

    // 根据主题色系自动联动签名色
    const styleToBrand: Record<string, TAgentBrand> = {
      'slate-light': 'slate',
      'slate-dark': 'slate',
      'ocean-light': 'cyan',
      'ocean-dark': 'cyan',
      'forest-light': 'forest',
      'forest-dark': 'forest',
      'orange-light': 'amber',
      'orange-dark': 'amber',
      'purple-light': 'violet',
      'purple-dark': 'violet',
    }
    const matchedBrand = styleToBrand[style]
    if (matchedBrand && matchedBrand !== tagentBrand) {
      setTagentBrand(matchedBrand)
      void updateTAgentBrand(matchedBrand)
    }
  }, [setThemeMode, setThemeStyle, systemIsDark, tagentBrand, setTagentBrand])

  /** 切换阅读字号 */
  const handleMarkdownFontSizeChange = React.useCallback((value: string) => {
    const size = value as MarkdownFontSize
    setMarkdownFontSize(size)
    updateMarkdownFontSize(size)
  }, [setMarkdownFontSize])

  /** 切换高级材质 */
  const handleAdvancedMaterialChange = React.useCallback((checked: boolean) => {
    setAdvancedMaterialEnabled(checked)
    void updateAdvancedMaterialEnabled(checked)
  }, [setAdvancedMaterialEnabled])

  /** 切换品牌色 */
  const handleBrandChange = React.useCallback((brand: TAgentBrand) => {
    setTagentBrand(brand)
    void updateTAgentBrand(brand)
  }, [setTagentBrand])

  return (
    <div className="space-y-4">
      {/* Slim 头部：logo + 标题 + 5 色色板内联 */}
      <TAgentSlimHeader
        brand={tagentBrand}
        onBrandChange={handleBrandChange}
      />

      {/* TAgent 皮肤 + 风格库 */}
      <SettingsSection
        title="TAgent 皮肤"
        description="浅色 / 深色 / 跟随系统 / 风格库 6 选 1"
      >
        <SettingsCard>
          <SettingsSegmentedControl
            label="皮肤模式"
            description="选「风格库」即可在下方挑一套 TA 风味皮肤"
            value={themeMode}
            onValueChange={handleThemeChange}
            options={SKIN_OPTIONS}
          />

          {themeMode === 'special' && (
            <div className="px-4 pb-4 pt-1 space-y-2">
              <div className="tagent-style-grid">
                {SPECIAL_STYLES.map((style) => (
                  <StyleCard
                    key={style.id}
                    style={style}
                    isSelected={themeStyle === style.id}
                    onSelect={() => handleStyleSelect(style.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </SettingsCard>
      </SettingsSection>

      {/* 排版与材质 */}
      <SettingsSection
        title="排版与材质"
        description="字号、缩放、玻璃质感"
      >
        <SettingsCard>
          {/* 界面缩放 */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex-1 min-w-0 mr-4">
              <div className="text-sm font-medium text-foreground">界面缩放</div>
              <div className="text-xs text-muted-foreground mt-0.5">{ZOOM_HINT}</div>
            </div>
            <ZoomKeycapHint />
          </div>

          {/* 阅读字号 */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex-1 min-w-0 mr-4">
              <div className="text-sm font-medium text-foreground">阅读字号</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                调整 AI 回复与 Markdown 编辑器的正文字号
              </div>
            </div>
            <FontSizeSlider
              value={markdownFontSize}
              onChange={handleMarkdownFontSizeChange}
            />
          </div>

          {/* 高级材质 */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex-1 min-w-0 mr-4">
              <div className="text-sm font-medium text-foreground">高级材质</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {advancedMaterialEnabled
                  ? '当前：高透玻璃 · backdrop-filter + 折射伪元素'
                  : '当前：轻量磨砂 · 适度模糊 + 半透明，无折射'}
              </div>
            </div>
            <MaterialPreview
              enabled={advancedMaterialEnabled}
              onToggle={handleAdvancedMaterialChange}
            />
          </div>
        </SettingsCard>
      </SettingsSection>
    </div>
  )
}

// =====================================================================
// Slim 头部（紧凑、含内联色板）
// =====================================================================

interface TAgentSlimHeaderProps {
  brand: TAgentBrand
  onBrandChange: (brand: TAgentBrand) => void
}

/** 紧凑头部：左侧 logo+标题，右侧签名色行内选择 */
function TAgentSlimHeader({ brand, onBrandChange }: TAgentSlimHeaderProps): React.ReactElement {
  return (
    <div className="tagent-slim-header">
      <div className="tagent-slim-header-left">
        <div className="tagent-slim-header-logo" aria-hidden="true">TA</div>
        <div className="tagent-slim-header-text">
          <div className="tagent-slim-header-title">
            TAgent 视觉签名
            <span className="tagent-slim-header-tag">v1 · TA Skin</span>
          </div>
          <div className="tagent-slim-header-subtitle">
            为双模式通用 + 游戏 TA 工作台定制的视觉皮肤系统
          </div>
        </div>
      </div>

      <div className="tagent-brand-palette" role="radiogroup" aria-label="品牌签名色">
        {BRAND_SWATCHES.map((swatch) => (
          <BrandChip
            key={swatch.id}
            swatch={swatch}
            isSelected={brand === swatch.id}
            onSelect={() => onBrandChange(swatch.id)}
          />
        ))}
      </div>
    </div>
  )
}

interface BrandChipProps {
  swatch: BrandSwatch
  isSelected: boolean
  onSelect: () => void
}

/** 签名色 chip：纯色圆点 + 名称，选中态仅边框 */
function BrandChip({ swatch, isSelected, onSelect }: BrandChipProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={swatch.name}
      aria-pressed={isSelected}
      data-selected={isSelected}
      className="tagent-brand-chip"
    >
      <span
        className="tagent-brand-chip-dot"
        style={{ background: swatch.solid }}
      />
      <span className="tagent-brand-chip-label">{swatch.name}</span>
    </button>
  )
}

// =====================================================================
// 主题风格卡（紧凑、主题色 hover/selected + 一次性角标+脉冲）
// =====================================================================

interface StyleCardProps {
  style: SpecialStyle
  isSelected: boolean
  onSelect: () => void
}

/** 单个主题风格卡：紧凑横向比例 + 主题色 hover/selected + 一次性旋转光环 */
function StyleCard({ style, isSelected, onSelect }: StyleCardProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      data-style={style.id}
      data-selected={isSelected}
      className={cn(
        'tagent-style-card',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
        isSelected ? 'focus-visible:ring-2' : 'focus-visible:ring-1'
      )}
      style={isSelected
        ? { '--tw-ring-color': 'var(--theme-glow)' } as React.CSSProperties
        : { '--tw-ring-color': 'var(--theme-soft)' } as React.CSSProperties
      }
    >
      <div className="tagent-style-preview-wrap">
        <ThemePreview previewClass={style.previewClass} deco={style.deco} />

        {isSelected && (
          <>
            <span className="tagent-corner tagent-corner-tl" aria-hidden="true" />
            <span className="tagent-corner tagent-corner-tr" aria-hidden="true" />
            <span className="tagent-corner tagent-corner-bl" aria-hidden="true" />
            <span className="tagent-corner tagent-corner-br" aria-hidden="true" />
          </>
        )}

        {isSelected && (
          <>
            <div className="tagent-card-pulse" aria-hidden="true" />
            <div className="tagent-card-pulse tagent-card-pulse-2" aria-hidden="true" />
          </>
        )}

        <div className="tagent-theme-watermark">{style.tag}</div>
      </div>

      <div className="tagent-style-card-label">
        <span>{style.name}</span>
        <span className="tagent-style-card-label-tag">{style.variant === 'light' ? '亮' : '暗'}</span>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------
// 主题预览装饰符号
// ---------------------------------------------------------------------

/** 8 种 TA 风味装饰符号的 SVG path */
const DECO_PATHS: Record<SpecialStyle['deco'], React.ReactElement> = {
  cloud: (
    <path
      d="M10 28 Q4 28 4 22 Q4 16 10 16 Q11 8 20 8 Q28 8 30 16 Q38 16 38 22 Q38 28 32 28 Z"
      fill="currentColor"
    />
  ),
  wave: (
    <path
      d="M4 22 Q12 14 20 22 T36 22 M4 30 Q12 22 20 30 T36 30"
      stroke="currentColor"
      strokeWidth="3"
      fill="none"
      strokeLinecap="round"
    />
  ),
  leaf: (
    <path
      d="M20 6 C30 10 34 22 30 32 C20 30 12 22 14 12 C16 8 18 6 20 6 Z M16 14 L24 26"
      stroke="currentColor"
      strokeWidth="2"
      fill="currentColor"
      fillOpacity="0.4"
    />
  ),
  star: (
    <g fill="currentColor">
      <circle cx="12" cy="14" r="1.5" />
      <circle cx="28" cy="12" r="1" />
      <circle cx="20" cy="22" r="2" />
      <circle cx="32" cy="26" r="1" />
      <circle cx="10" cy="30" r="1" />
      <circle cx="24" cy="32" r="1.2" />
    </g>
  ),
  moon: (
    <path
      d="M28 8 A14 14 0 1 0 28 32 A10 10 0 1 1 28 8 Z"
      fill="currentColor"
    />
  ),
  gem: (
    <path
      d="M20 6 L32 16 L20 34 L8 16 Z M20 6 L20 34 M8 16 L32 16"
      stroke="currentColor"
      strokeWidth="2"
      fill="currentColor"
      fillOpacity="0.3"
    />
  ),
  sun: (
    <g fill="currentColor">
      <circle cx="20" cy="20" r="6" />
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <line x1="20" y1="6" x2="20" y2="10" />
        <line x1="20" y1="30" x2="20" y2="34" />
        <line x1="6" y1="20" x2="10" y2="20" />
        <line x1="30" y1="20" x2="34" y2="20" />
        <line x1="10" y1="10" x2="13" y2="13" />
        <line x1="27" y1="27" x2="30" y2="30" />
        <line x1="10" y1="30" x2="13" y2="27" />
        <line x1="27" y1="13" x2="30" y2="10" />
      </g>
    </g>
  ),
  flame: (
    <path
      d="M20 4 C22 10 26 12 27 18 C28 24 25 30 20 32 C15 30 12 24 13 18 C14 14 16 14 17 16 C18 13 17 9 20 4 Z"
      fill="currentColor"
      fillOpacity="0.85"
    />
  ),
  flower: (
    <g fill="currentColor">
      <ellipse cx="20" cy="10" rx="3.5" ry="5.5" />
      <ellipse cx="30" cy="20" rx="5.5" ry="3.5" />
      <ellipse cx="20" cy="30" rx="3.5" ry="5.5" />
      <ellipse cx="10" cy="20" rx="5.5" ry="3.5" />
      <circle cx="20" cy="20" r="2.2" fillOpacity="0.5" />
    </g>
  ),
  orb: (
    <g>
      <circle cx="20" cy="20" r="11" stroke="currentColor" strokeWidth="1.8" fill="none" opacity="0.7" />
      <circle cx="20" cy="20" r="4" fill="currentColor" />
    </g>
  ),
}

interface ThemePreviewProps {
  previewClass: string
  deco: SpecialStyle['deco']
}

/** 单个主题预览：纯 CSS 渐变 + 噪点 + 中央装饰符号 */
function ThemePreview({ previewClass, deco }: ThemePreviewProps): React.ReactElement {
  return (
    <div className={cn('tagent-theme-preview', previewClass)}>
      <div className="tagent-theme-deco">
        <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
          {DECO_PATHS[deco]}
        </svg>
      </div>
    </div>
  )
}

// =====================================================================
// 排版与材质 - 可视化控件
// =====================================================================

/** 界面缩放 keycap 提示 */
function ZoomKeycapHint(): React.ReactElement {
  const prefix = isMac
    ? [{ label: '⌘' }]
    : [{ label: 'Ctrl' }]

  const steps = [
    { op: '+', desc: '放大' },
    { op: '-', desc: '缩小' },
    { op: '0', desc: '重置' },
  ]

  return (
    <div className="flex items-center gap-2.5">
      {steps.map((s) => (
        <div key={s.op} className="tagent-keycaps">
          {prefix.map((k, i) => (
            <React.Fragment key={i}>
              <span className="tagent-keycap">{k.label}</span>
              <span className="tagent-keycap-sep">+</span>
            </React.Fragment>
          ))}
          <span className="tagent-keycap">{s.op}</span>
        </div>
      ))}
    </div>
  )
}

interface FontSizePreviewProps {
  value: MarkdownFontSize
  onChange: (value: string) => void
}

/** 阅读字号：自定义滑杆 + live 预览文本 + 3 档刻度 */
function FontSizeSlider({ value, onChange }: FontSizePreviewProps): React.ReactElement {
  const trackRef = React.useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = React.useState(false)

  const index = READING_FONT_SIZE_OPTIONS.findIndex((o) => o.value === value)
  const safeIndex = index < 0 ? 1 : index
  const valueCount = READING_FONT_SIZE_OPTIONS.length
  const positionPct = (safeIndex / (valueCount - 1)) * 100

  const samplePx = value === 'small' ? 13 : value === 'large' ? 17 : 15
  const activeLabel = READING_FONT_SIZE_OPTIONS[safeIndex]?.label ?? '中'

  const pickByClientX = React.useCallback((clientX: number): void => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    const nearest = Math.round(ratio * (valueCount - 1))
    const target = READING_FONT_SIZE_OPTIONS[nearest]
    if (target && target.value !== value) {
      onChange(target.value)
    }
  }, [onChange, value, valueCount])

  React.useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent): void => pickByClientX(e.clientX)
    const onUp = (): void => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging, pickByClientX])

  return (
    <div
      className={cn('tagent-font-slider', dragging && 'dragging')}
      data-testid="tagent-font-slider"
    >
      <div className="tagent-font-slider-preview" style={{ fontSize: `${samplePx}px` }}>
        <span>你好，世界</span>
        <span className="tagent-font-slider-preview-label">{activeLabel}</span>
      </div>

      <div
        ref={trackRef}
        className="tagent-font-slider-track"
        onMouseDown={(e) => {
          setDragging(true)
          pickByClientX(e.clientX)
        }}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={valueCount - 1}
        aria-valuenow={safeIndex}
        aria-label="阅读字号"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' && safeIndex > 0) {
            onChange(READING_FONT_SIZE_OPTIONS[safeIndex - 1]!.value)
          } else if (e.key === 'ArrowRight' && safeIndex < valueCount - 1) {
            onChange(READING_FONT_SIZE_OPTIONS[safeIndex + 1]!.value)
          }
        }}
      >
        <div className="tagent-font-slider-rail" />
        <div className="tagent-font-slider-fill" style={{ width: `${positionPct}%` }} />
        {READING_FONT_SIZE_OPTIONS.map((opt, i) => (
          <div
            key={opt.value}
            className="tagent-font-slider-stop"
            data-active={i === safeIndex}
            style={{ left: `${(i / (valueCount - 1)) * 100}%` }}
          />
        ))}
        <div className="tagent-font-slider-thumb" style={{ left: `${positionPct}%` }} />
      </div>

      <div className="tagent-font-slider-labels">
        {READING_FONT_SIZE_OPTIONS.map((opt, i) => (
          <span key={opt.value} data-active={i === safeIndex}>
            {opt.label}
          </span>
        ))}
      </div>
    </div>
  )
}

interface MaterialPreviewProps {
  enabled: boolean
  onToggle: (enabled: boolean) => void
}

/** 高级材质：玻璃/磨砂 二选一预览 */
function MaterialPreview({ enabled, onToggle }: MaterialPreviewProps): React.ReactElement {
  return (
    <div className="tagent-material-pair">
      <button
        type="button"
        onClick={() => onToggle(true)}
        aria-pressed={enabled}
        data-selected={enabled}
        className="tagent-material-tile"
        title="高透玻璃"
      >
        <div className="tagent-material-preview tagent-material-preview-glass" />
        <div className="tagent-material-name">高透</div>
        <div className="tagent-material-tag">Glass</div>
      </button>
      <button
        type="button"
        onClick={() => onToggle(false)}
        aria-pressed={!enabled}
        data-selected={!enabled}
        className="tagent-material-tile"
        title="轻量磨砂"
      >
        <div className="tagent-material-preview tagent-material-preview-frosted" />
        <div className="tagent-material-name">磨砂</div>
        <div className="tagent-material-tag">Frosted</div>
      </button>
    </div>
  )
}
