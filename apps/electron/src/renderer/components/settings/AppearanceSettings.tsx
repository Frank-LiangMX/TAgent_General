/**
 * AppearanceSettings - 外观与材质
 *
 * 布局：
 *   1. 皮肤（浅/深/系统/风格库）
 *   2. 排版与材质
 *
 * 强调色跟随主题 --primary，无独立签名色选项。
 */

import { useAtom, useAtomValue } from 'jotai'
import * as React from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@tagent/ui'
import type {
  AdvancedMaterialOnMode,
  AssistantPresenceStyle,
  MarkdownFontSize,
  ThemeMode,
  ThemeStyle,
} from '../../../types'
import { SettingsSection, SettingsCard, SettingsSegmentedControl } from './primitives'

import './appearance-overrides.css'

import {
  advancedMaterialEnabledAtom,
  advancedMaterialOnModeAtom,
  updateAdvancedMaterialEnabled,
  updateAdvancedMaterialOnMode,
} from '@/atoms/advanced-material'
import {
  assistantPresenceStyleAtom,
  updateAssistantPresenceStyle,
} from '@/atoms/assistant-presence'
import { markdownFontSizeAtom, updateMarkdownFontSize } from '@/atoms/markdown-font-size'
import { previewModePreferenceAtom, type PreviewModePreference } from '@/atoms/preview-atoms'
import { officeMotionModeAtom, type OfficeMotionMode } from '@/atoms/session-presentation-atoms'
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

/** Agent 预览默认展开方式 */
const PREVIEW_MODE_OPTIONS: { value: PreviewModePreference; label: string }[] = [
  { value: 'tab', label: '标签页' },
  { value: 'split', label: '侧边分屏' },
]

const OFFICE_MOTION_OPTIONS: { value: OfficeMotionMode; label: string }[] = [
  { value: 'full', label: '完整动效' },
  { value: 'reduced', label: '精简动效' },
]

const ASSISTANT_PRESENCE_STYLE_OPTIONS: {
  value: AssistantPresenceStyle
  label: string
}[] = [
  { value: 'ribbon', label: '流光' },
  { value: 'fluid', label: '柔液' },
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
  {
    id: 'slate-light',
    name: '云絮悠然',
    tag: 'Clay',
    variant: 'light',
    previewClass: 'tagent-theme-cloud-dancer',
    deco: 'cloud',
  },
  {
    id: 'ocean-light',
    name: '碧海晴空',
    tag: 'Toon',
    variant: 'light',
    previewClass: 'tagent-theme-ocean-light',
    deco: 'wave',
  },
  {
    id: 'forest-light',
    name: '翠林晨光',
    tag: 'Foliage',
    variant: 'light',
    previewClass: 'tagent-theme-forest-light',
    deco: 'leaf',
  },
  {
    id: 'orange-light',
    name: '琥珀晨曦',
    tag: 'Albedo',
    variant: 'light',
    previewClass: 'tagent-theme-terracotta-dawn',
    deco: 'sun',
  },
  {
    id: 'purple-light',
    name: '紫藤晓露',
    tag: 'Sheen',
    variant: 'light',
    previewClass: 'tagent-theme-wisteria-dawn',
    deco: 'flower',
  },
  // 第二行：暗色（与第一行同列对应）
  {
    id: 'slate-dark',
    name: '石板暮霭',
    tag: 'PBR',
    variant: 'dark',
    previewClass: 'tagent-theme-morandi-night',
    deco: 'gem',
  },
  {
    id: 'ocean-dark',
    name: '深海夜潮',
    tag: 'Volume',
    variant: 'dark',
    previewClass: 'tagent-theme-ocean-dark',
    deco: 'star',
  },
  {
    id: 'forest-dark',
    name: '青苔夜语',
    tag: 'SSS',
    variant: 'dark',
    previewClass: 'tagent-theme-forest-dark',
    deco: 'moon',
  },
  {
    id: 'orange-dark',
    name: '熔金夜韵',
    tag: 'Burn',
    variant: 'dark',
    previewClass: 'tagent-theme-terracotta-night',
    deco: 'flame',
  },
  {
    id: 'purple-dark',
    name: '幽兰梦语',
    tag: 'Velvet',
    variant: 'dark',
    previewClass: 'tagent-theme-wisteria-night',
    deco: 'orb',
  },
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
  const [previewModePref, setPreviewModePref] = useAtom(previewModePreferenceAtom)
  const [advancedMaterialEnabled, setAdvancedMaterialEnabled] = useAtom(advancedMaterialEnabledAtom)
  const [advancedMaterialOnMode, setAdvancedMaterialOnMode] = useAtom(advancedMaterialOnModeAtom)
  const [officeMotionMode, setOfficeMotionMode] = useAtom(officeMotionModeAtom)
  const [assistantPresenceStyle, setAssistantPresenceStyle] = useAtom(assistantPresenceStyleAtom)

  /** 切换皮肤 */
  const handleThemeChange = React.useCallback(
    (value: string) => {
      const mode = value as ThemeMode
      setThemeMode(mode)
      updateThemeMode(mode)
      if (mode !== 'special') {
        setThemeStyle('default')
        updateThemeStyle('default')
        applyThemeToDOM(mode, 'default', systemIsDark)
      }
    },
    [setThemeMode, setThemeStyle, systemIsDark]
  )

  /** 选择风格库中的风格（强调色自动随主题 primary） */
  const handleStyleSelect = React.useCallback(
    (style: ThemeStyle) => {
      setThemeMode('special')
      setThemeStyle(style)
      updateThemeMode('special')
      updateThemeStyle(style)
      applyThemeToDOM('special', style, systemIsDark)
    },
    [setThemeMode, setThemeStyle, systemIsDark]
  )

  /** 切换阅读字号 */
  const handleMarkdownFontSizeChange = React.useCallback(
    (value: string) => {
      const size = value as MarkdownFontSize
      setMarkdownFontSize(size)
      updateMarkdownFontSize(size)
    },
    [setMarkdownFontSize]
  )

  /** 切换高级材质开关 */
  const handleAdvancedMaterialEnabledChange = React.useCallback(
    (enabled: boolean) => {
      setAdvancedMaterialEnabled(enabled)
      // 开启时沿用当前 onMode（glass / soft），关闭时强制 frosted
      void updateAdvancedMaterialEnabled(enabled, advancedMaterialOnMode)
    },
    [setAdvancedMaterialEnabled, advancedMaterialOnMode]
  )

  /** 切换高级材质模式（仅开关开启时调用） */
  const handleAdvancedMaterialOnModeChange = React.useCallback(
    (onMode: AdvancedMaterialOnMode) => {
      setAdvancedMaterialOnMode(onMode)
      void updateAdvancedMaterialOnMode(onMode)
    },
    [setAdvancedMaterialOnMode]
  )

  const handleAssistantPresenceStyleChange = React.useCallback(
    (value: string) => {
      const style = value as AssistantPresenceStyle
      setAssistantPresenceStyle(style)
      void updateAssistantPresenceStyle(style)
    },
    [setAssistantPresenceStyle]
  )

  return (
    <div className="space-y-4">
      <SettingsSection title="主题皮肤" description="浅色 / 深色 / 跟随系统 / 风格库">
        <SettingsCard>
          <SettingsSegmentedControl
            label="皮肤模式"
            description="选「风格库」即可在下方挑一套 TA 风味皮肤"
            value={themeMode}
            onValueChange={handleThemeChange}
            options={SKIN_OPTIONS}
          />

          {themeMode === 'special' && (
            <div className="px-4 pb-3.5 pt-0.5">
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

      <SettingsSection title="Agent 形象" description="欢迎页实时角色的视觉形态">
        <SettingsCard>
          <SettingsSegmentedControl
            label="角色形态"
            description="流光保留现有光带与粒子；柔液使用更圆润的液态轮廓和柔和切面"
            value={assistantPresenceStyle}
            onValueChange={handleAssistantPresenceStyleChange}
            options={ASSISTANT_PRESENCE_STYLE_OPTIONS}
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="AI Office" description="沉浸式办公室与角色动效">
        <SettingsCard>
          <SettingsSegmentedControl
            label="办公室角色动效"
            description="精简动效保留行走与交接连续性，但加快移动并关闭摸鱼等装饰行为"
            value={officeMotionMode}
            onValueChange={(value) => setOfficeMotionMode(value as OfficeMotionMode)}
            options={OFFICE_MOTION_OPTIONS}
          />
        </SettingsCard>
      </SettingsSection>

      {/* 排版与材质 */}
      <SettingsSection title="排版与材质" description="字号、缩放、玻璃质感">
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
            <FontSizeSlider value={markdownFontSize} onChange={handleMarkdownFontSizeChange} />
          </div>

          {/* 高级材质：打包版暂未完成，仅开发模式露出入口 */}
          {import.meta.env.DEV ? (
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex-1 min-w-0 mr-4">
                <div className="text-sm font-medium text-foreground">高级材质</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {advancedMaterialEnabled
                    ? advancedMaterialOnMode === 'glass'
                      ? '高透玻璃：强调通透、折射和悬浮感'
                      : '轻拟态：柔和玻璃质感，边缘高光与阴影'
                    : '磨砂玻璃：更内敛、更稳的玻璃层次'}
                </div>
              </div>
              <MaterialToggle
                enabled={advancedMaterialEnabled}
                onMode={advancedMaterialOnMode}
                onEnabledChange={handleAdvancedMaterialEnabledChange}
                onModeChange={handleAdvancedMaterialOnModeChange}
              />
            </div>
          ) : null}

          <SettingsSegmentedControl
            label="Agent 预览展开方式"
            description="点击文件、工具结果「预览」时的默认位置；拖拽预览 Tab 出标签栏可即时切换为侧边分屏"
            value={previewModePref}
            onValueChange={(v) => setPreviewModePref(v as PreviewModePreference)}
            options={PREVIEW_MODE_OPTIONS}
          />
        </SettingsCard>
      </SettingsSection>
    </div>
  )
}

// =====================================================================
// 主题风格卡
// =====================================================================

interface StyleCardProps {
  style: SpecialStyle
  isSelected: boolean
  onSelect: () => void
}

/** 单个主题风格卡：轻预览 + 名称，选中用 primary 描边 */
function StyleCard({ style, isSelected, onSelect }: StyleCardProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      data-style={style.id}
      data-selected={isSelected || undefined}
      className="tagent-style-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
    >
      <div className="tagent-style-preview-wrap">
        <ThemePreview previewClass={style.previewClass} deco={style.deco} />
        {isSelected && (
          <span className="tagent-style-check" aria-hidden="true">
            ✓
          </span>
        )}
      </div>
      <div className="tagent-style-card-label">
        <span className="tagent-style-card-name">{style.name}</span>
        <span className="tagent-style-card-label-tag">
          {style.variant === 'light' ? '亮' : '暗'}
        </span>
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
  moon: <path d="M28 8 A14 14 0 1 0 28 32 A10 10 0 1 1 28 8 Z" fill="currentColor" />,
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
      <circle
        cx="20"
        cy="20"
        r="11"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        opacity="0.7"
      />
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
  const prefix = isMac ? [{ label: '⌘' }] : [{ label: 'Ctrl' }]

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

  const pickByClientX = React.useCallback(
    (clientX: number): void => {
      const rect = trackRef.current?.getBoundingClientRect()
      if (!rect) return
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
      const nearest = Math.round(ratio * (valueCount - 1))
      const target = READING_FONT_SIZE_OPTIONS[nearest]
      if (target && target.value !== value) {
        onChange(target.value)
      }
    },
    [onChange, value, valueCount]
  )

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

interface MaterialToggleProps {
  enabled: boolean
  onMode: AdvancedMaterialOnMode
  onEnabledChange: (enabled: boolean) => void
  onModeChange: (onMode: AdvancedMaterialOnMode) => void
}

/**
 * 高级材质控制组件
 * - 开关：控制是否启用高级材质
 * - 开关关闭时：显示磨砂玻璃状态
 * - 开关打开时：显示 glass 和 soft 两个选项
 */
function MaterialToggle({
  enabled,
  onMode,
  onEnabledChange,
  onModeChange,
}: MaterialToggleProps): React.ReactElement {
  return (
    <div className="flex items-center gap-3">
      {/* 开关 */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => onEnabledChange(!enabled)}
            className={cn('tagent-material-switch', enabled && 'tagent-material-switch--on')}
          >
            <span className="tagent-material-switch-thumb" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {enabled ? '点击关闭高级材质，恢复磨砂玻璃' : '点击开启高级材质'}
        </TooltipContent>
      </Tooltip>

      {/* 材质选择（仅开关打开时显示） */}
      {enabled && (
        <div className="flex gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onModeChange('glass')}
                aria-pressed={onMode === 'glass'}
                data-selected={onMode === 'glass'}
                className="tagent-material-tile tagent-material-tile--compact"
              >
                <div className="tagent-material-preview tagent-material-preview-glass" />
                <div className="tagent-material-name">高透玻璃</div>
              </button>
            </TooltipTrigger>
            <TooltipContent>透明感最强，悬浮和高光最明显</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onModeChange('soft')}
                aria-pressed={onMode === 'soft'}
                data-selected={onMode === 'soft'}
                className="tagent-material-tile tagent-material-tile--compact"
              >
                <div className="tagent-material-preview tagent-material-preview-soft" />
                <div className="tagent-material-name">轻拟态</div>
              </button>
            </TooltipTrigger>
            <TooltipContent>柔和玻璃质感，边缘高光与阴影</TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  )
}
