import { useAtom } from 'jotai'
import { Building2, MessagesSquare } from 'lucide-react'
import * as React from 'react'

import {
  sessionPresentationAtomFamily,
  type SessionPresentation,
} from '@/atoms/session-presentation-atoms'
import { cn } from '@/lib/utils'

interface SessionPresentationToggleProps {
  sessionId: string
  className?: string
  compact?: boolean
}

const OPTIONS: Array<{
  value: SessionPresentation
  label: string
  icon: typeof MessagesSquare
}> = [
  { value: 'classic', label: '经典', icon: MessagesSquare },
  { value: 'office', label: 'Office', icon: Building2 },
]

export function SessionPresentationToggle({
  sessionId,
  className,
  compact = false,
}: SessionPresentationToggleProps): React.ReactElement {
  const [presentation, setPresentation] = useAtom(sessionPresentationAtomFamily(sessionId))

  return (
    <div
      role="group"
      aria-label="会话展示模式"
      className={cn(
        'inline-flex shrink-0 items-center rounded-lg border border-border/55 bg-background/72 p-0.5 shadow-sm backdrop-blur-md',
        className
      )}
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon
        const selected = option.value === presentation
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            aria-label={`${option.label}展示模式`}
            title={option.value === 'classic' ? '切换到经典工作台' : '进入 AI Office'}
            onClick={() => setPresentation(option.value)}
            className={cn(
              'flex h-7 items-center justify-center gap-1.5 rounded-md px-2 text-[11px] font-medium transition-[background-color,color,box-shadow] duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
              selected
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
              compact && 'w-8 px-0'
            )}
          >
            <Icon className="size-3.5" strokeWidth={1.8} aria-hidden />
            {!compact ? <span>{option.label}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
