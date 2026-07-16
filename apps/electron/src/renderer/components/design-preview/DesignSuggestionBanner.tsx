/**
 * DesignSuggestionBanner — Design Preview 开启建议横幅
 *
 * 当检测到用户在 Agent 对话中提到 UI 设计相关关键词，
 * 但 Design Preview 尚未启用时，显示此横幅建议用户开启。
 *
 * 设计来源：docs/plans/2026-07-13-design-preview-design.md §5.3
 */

import { useAtom, useSetAtom } from 'jotai'
import { Palette, Sparkles, X } from 'lucide-react'
import * as React from 'react'

import {
  designEnabledAtom,
  designSuggestionAtom,
  toggleDesignEnabledAtom,
  type DesignSuggestion,
} from '@/atoms/design-preview-atoms'
import { rightRailItemAtom } from '@/atoms/app-mode'
import { agentSidePanelOpenAtom } from '@/atoms/agent-atoms'
import { cn } from '@/lib/utils'

export interface DesignSuggestionBannerProps {
  /** 自定义类名 */
  className?: string
}

/** 置信度对应的颜色和文案 */
const CONFIDENCE_CONFIG: Record<
  DesignSuggestion['confidence'],
  { bg: string; iconBg: string; title: string }
> = {
  high: {
    bg: 'bg-primary/8',
    iconBg: 'bg-primary/15',
    title: '检测到你在设计 UI 界面',
  },
  medium: {
    bg: 'bg-blue-500/8',
    iconBg: 'bg-blue-500/15',
    title: '看起来你在做 UI 设计',
  },
  low: {
    bg: 'bg-muted/50',
    iconBg: 'bg-muted',
    title: '需要设计相关帮助吗？',
  },
}

export function DesignSuggestionBanner({
  className,
}: DesignSuggestionBannerProps): React.ReactElement | null {
  const [suggestion, setSuggestion] = useAtom(designSuggestionAtom)
  const setEnabled = useSetAtom(toggleDesignEnabledAtom)
  const setRightRail = useSetAtom(rightRailItemAtom)
  const setPanelOpen = useSetAtom(agentSidePanelOpenAtom)
  const [dismissed, setDismissed] = React.useState(false)

  // 如果已启用，不显示
  const enabled = useAtom(designEnabledAtom)[0]

  if (!suggestion || enabled || dismissed) return null

  const config = CONFIDENCE_CONFIG[suggestion.confidence]
  const isHighConfidence = suggestion.confidence === 'high'

  const handleEnable = () => {
    setEnabled(true)
    setRightRail('design')
    setPanelOpen(true)
    setSuggestion(null)
    setDismissed(true)
  }

  const handleDismiss = () => {
    setDismissed(true)
    setSuggestion(null)
  }

  return (
    <div
      className={cn(
        'mx-3 mb-1 flex items-start gap-3 rounded-lg border border-border/50 p-3 shadow-sm',
        config.bg,
        isHighConfidence && 'border-primary/20',
        className
      )}
    >
      {/* 图标 */}
      <div
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full',
          config.iconBg
        )}
      >
        <Palette
          className={cn('size-4', isHighConfidence ? 'text-primary' : 'text-muted-foreground')}
        />
      </div>

      {/* 文案 */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{config.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {isHighConfidence
            ? `检测到关键词「${suggestion.label}」，是否开启 Design Preview 实时预览？`
            : `启用 Design Preview 后，你可以在右侧面板实时查看并框选反馈`}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={handleEnable}
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              isHighConfidence
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            )}
          >
            <Sparkles className="size-3" />
            开启 Design Preview
          </button>
          {!isHighConfidence && (
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              暂时不用
            </button>
          )}
        </div>
      </div>

      {/* 关闭按钮 */}
      <button
        type="button"
        onClick={handleDismiss}
        className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}
