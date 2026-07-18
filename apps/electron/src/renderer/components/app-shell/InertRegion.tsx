import * as React from 'react'

export interface InertRegionProps extends React.HTMLAttributes<HTMLDivElement> {
  inactive: boolean
}

export function useInertElement<T extends HTMLElement>(inactive: boolean): React.RefObject<T> {
  const ref = React.useRef<T>(null)

  React.useLayoutEffect(() => {
    ref.current?.toggleAttribute('inert', inactive)
  }, [inactive])

  return ref
}

/**
 * React 18 类型尚未声明 inert；通过 DOM 属性确保隐藏区域无法被键盘或辅助技术聚焦。
 */
export function InertRegion({ inactive, ...props }: InertRegionProps): React.ReactElement {
  const ref = useInertElement<HTMLDivElement>(inactive)

  return <div {...props} ref={ref} aria-hidden={inactive || undefined} />
}
