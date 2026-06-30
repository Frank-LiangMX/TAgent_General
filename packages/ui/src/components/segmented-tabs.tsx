import * as React from 'react'

import { cn } from '@/lib/utils'

interface SegmentedTabsContextValue {
  value: string
  onValueChange: (value: string) => void
}

const SegmentedTabsContext = React.createContext<SegmentedTabsContextValue | null>(null)

function useSegmentedTabsContext(component: string): SegmentedTabsContextValue {
  const context = React.useContext(SegmentedTabsContext)
  if (!context) {
    throw new Error(`${component} 必须在 SegmentedTabs 内使用`)
  }
  return context
}

function getSegmentedTabItems(
  children: React.ReactNode
): React.ReactElement<SegmentedTabsItemProps>[] {
  return React.Children.toArray(children).filter(
    (child): child is React.ReactElement<SegmentedTabsItemProps> =>
      React.isValidElement(child) && child.type === SegmentedTabsItem
  )
}

export interface SegmentedTabsProps {
  value: string
  onValueChange: (value: string) => void
  className?: string
  children: React.ReactNode
}

/** 横向分段 Tab 容器（插件页 MCP/Skill 同款滑动指示器） */
function SegmentedTabs({
  value,
  onValueChange,
  className,
  children,
}: SegmentedTabsProps): React.ReactElement {
  const items = getSegmentedTabItems(children)
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.props.value === value)
  )

  return (
    <SegmentedTabsContext.Provider value={{ value, onValueChange }}>
      <div
        className={cn('ui-segmented-tabs', className)}
        style={{ '--ui-segmented-count': items.length || 1 } as React.CSSProperties}
        role="tablist"
      >
        <div
          className="ui-segmented-tabs-indicator"
          style={{ transform: `translateX(${activeIndex * 100}%)` }}
          aria-hidden
        />
        {children}
      </div>
    </SegmentedTabsContext.Provider>
  )
}

export interface SegmentedTabsItemProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'value'
> {
  value: string
}

/** 单个分段 Tab 选项 */
const SegmentedTabsItem = React.forwardRef<HTMLButtonElement, SegmentedTabsItemProps>(
  ({ value, className, children, disabled, onClick, ...props }, ref) => {
    const { value: activeValue, onValueChange } = useSegmentedTabsContext('SegmentedTabsItem')
    const active = activeValue === value

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={active}
        disabled={disabled}
        onClick={(event) => {
          onClick?.(event)
          if (event.defaultPrevented || disabled) return
          onValueChange(value)
        }}
        className={cn(
          'ui-segmented-tabs-item',
          active && 'ui-segmented-tabs-item--active',
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)
SegmentedTabsItem.displayName = 'SegmentedTabsItem'

export { SegmentedTabs, SegmentedTabsItem }
