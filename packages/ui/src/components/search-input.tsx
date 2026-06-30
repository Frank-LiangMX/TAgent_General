import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2, Search, X } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

/** 搜索框统一圆角（与插件侧栏原 rounded-xl 一致） */
const SEARCH_INPUT_RADIUS = 'rounded-glass-rail'

const searchInputVariants = cva(
  'ui-search-input flex w-full items-center gap-2 transition-colors',
  {
    variants: {
      variant: {
        /** 设置页 / 表单内标准搜索框 */
        default: cn(
          SEARCH_INPUT_RADIUS,
          'border border-border/60 bg-muted/40 focus-within:border-primary/40 focus-within:bg-background focus-within:ring-1 focus-within:ring-primary/20'
        ),
        /** 侧栏 / 列表面板紧凑搜索 */
        muted: cn(
          SEARCH_INPUT_RADIUS,
          'border border-transparent bg-muted/40 focus-within:border-primary/40 focus-within:bg-muted/70'
        ),
        /** 插件面板 / 模型选择器等玻璃浮层 */
        glass: cn(SEARCH_INPUT_RADIUS, 'ui-search-input--glass border border-transparent'),
        /** 对话框顶栏：无容器背景，仅图标 + 输入 */
        plain: 'rounded-none border-0 bg-transparent p-0 shadow-none ring-0 focus-within:ring-0',
      },
      size: {
        sm: 'h-7 px-2',
        md: 'h-8 px-2.5',
        lg: 'h-9 px-3',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

const searchInputFieldVariants = cva(
  'min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground/50 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      size: {
        sm: 'text-[11px]',
        md: 'text-sm',
        lg: 'text-sm',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
)

const SEARCH_ICON_SIZE = {
  sm: 13,
  md: 14,
  lg: 16,
} as const satisfies Record<NonNullable<VariantProps<typeof searchInputVariants>['size']>, number>

export interface SearchInputProps
  extends
    Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof searchInputVariants> {
  /** 外层容器 class */
  containerClassName?: string
  /** 显示加载中图标（替代搜索图标） */
  loading?: boolean
  /** 是否显示清空按钮；默认有 value 且提供 onClear 时显示 */
  showClear?: boolean
  /** 点击清空按钮 */
  onClear?: () => void
  /** 右侧附加内容（快捷键提示、计数等） */
  trailing?: React.ReactNode
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      className,
      containerClassName,
      variant,
      size = 'md',
      loading = false,
      showClear,
      onClear,
      trailing,
      value,
      disabled,
      ...props
    },
    ref
  ) => {
    const resolvedSize = size ?? 'md'
    const iconSize = SEARCH_ICON_SIZE[resolvedSize]
    const stringValue = typeof value === 'string' ? value : undefined
    const showClearButton =
      showClear ?? (onClear !== undefined && !!stringValue && stringValue.length > 0)

    return (
      <div className={cn(searchInputVariants({ variant, size: resolvedSize }), containerClassName)}>
        {loading ? (
          <Loader2
            size={iconSize}
            className="shrink-0 animate-spin text-muted-foreground"
            aria-hidden
          />
        ) : (
          <Search
            size={iconSize}
            className="shrink-0 text-muted-foreground/65"
            strokeWidth={2}
            aria-hidden
          />
        )}
        <input
          ref={ref}
          type="text"
          disabled={disabled}
          value={value}
          className={cn(searchInputFieldVariants({ size: resolvedSize }), className)}
          {...props}
        />
        {(showClearButton || trailing) && (
          <div className="flex shrink-0 items-center gap-1">
            {showClearButton && onClear ? (
              <button
                type="button"
                tabIndex={-1}
                onClick={onClear}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="清空"
              >
                <X size={resolvedSize === 'sm' ? 12 : 13} />
              </button>
            ) : null}
            {trailing}
          </div>
        )}
      </div>
    )
  }
)
SearchInput.displayName = 'SearchInput'

export { SearchInput, searchInputFieldVariants, searchInputVariants }
