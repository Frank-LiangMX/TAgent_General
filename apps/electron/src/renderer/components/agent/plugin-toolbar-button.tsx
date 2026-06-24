/**
 * PluginToolbarButton - 插件页工具栏按钮（参考 Kun PluginMarketplace 胶囊样式）
 */

import { Loader2 } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export type PluginToolbarButtonVariant = 'subtle' | 'primary' | 'outline'

interface PluginToolbarButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PluginToolbarButtonVariant
  loading?: boolean
  icon?: React.ReactNode
}

const VARIANT_CLASS: Record<PluginToolbarButtonVariant, string> = {
  subtle:
    'bg-muted/45 text-foreground/85 hover:bg-muted/70 dark:bg-muted/30 dark:hover:bg-muted/45',
  primary: 'bg-primary text-primary-foreground shadow-sm hover:opacity-90',
  outline:
    'border border-border/60 bg-card/80 text-foreground shadow-sm hover:bg-muted/40 dark:bg-card/60',
}

export function PluginToolbarButton({
  variant = 'subtle',
  loading = false,
  icon,
  children,
  className,
  disabled,
  ...props
}: PluginToolbarButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        'inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl px-3 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-55',
        VARIANT_CLASS[variant],
        className
      )}
      {...props}
    >
      {loading ? <Loader2 size={14} className="animate-spin" strokeWidth={2} /> : icon}
      {children}
    </button>
  )
}
