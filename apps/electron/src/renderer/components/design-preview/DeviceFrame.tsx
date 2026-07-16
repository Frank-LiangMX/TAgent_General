/**
 * DeviceFrame — 设备框架包装组件
 *
 * 为 iframe 内容提供设备外壳：
 * - Mobile：手机样式边框 + 顶部刘海 + 底部 Home Indicator
 * - Tablet：平板样式边框
 * - Desktop：桌面浏览器外壳（地址栏 + 控件按钮）
 *
 * 注意：本组件不应用缩放，缩放由父级 DesignCanvas 控制。
 *
 * 设计来源：docs/plans/2026-07-13-design-preview-design.md §5.1
 */

import { Monitor, Smartphone, Tablet } from 'lucide-react'
import * as React from 'react'

import { DEVICE_PRESETS, type DeviceType } from '@/atoms/design-preview-atoms'
import { cn } from '@/lib/utils'

export interface DeviceFrameProps {
  /** 设备类型 */
  device: DeviceType
  /** 子元素（通常是 HtmlRenderer） */
  children: React.ReactNode
  /** 自定义类名 */
  className?: string
}

/** Mobile 框架 */
function MobileFrame({
  size,
  children,
}: {
  size: { width: number; height: number }
  children: React.ReactNode
}): React.ReactElement {
  const frameWidth = size.width + 16
  const frameHeight = size.height + 36 // 顶部刘海 + 底部 Home Indicator

  return (
    <div
      className="relative rounded-[36px] bg-zinc-900 p-2 shadow-xl ring-1 ring-zinc-800/50"
      style={{
        width: frameWidth,
        height: frameHeight,
      }}
    >
      {/* 顶部刘海 */}
      <div className="absolute left-1/2 top-1 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-zinc-900" />
      {/* 内容区域 */}
      <div className="h-full w-full overflow-hidden rounded-[28px] bg-white">{children}</div>
      {/* 底部 Home Indicator */}
      <div className="absolute bottom-1 left-1/2 h-1 w-28 -translate-x-1/2 rounded-full bg-zinc-700" />
    </div>
  )
}

/** Tablet 框架 */
function TabletFrame({
  size,
  children,
}: {
  size: { width: number; height: number }
  children: React.ReactNode
}): React.ReactElement {
  const frameWidth = size.width + 24
  const frameHeight = size.height + 24

  return (
    <div
      className="relative rounded-[20px] bg-zinc-900 p-3 shadow-xl ring-1 ring-zinc-800/50"
      style={{
        width: frameWidth,
        height: frameHeight,
      }}
    >
      <div className="h-full w-full overflow-hidden rounded-[8px] bg-white">{children}</div>
    </div>
  )
}

/** Desktop 浏览器框架 */
function DesktopFrame({
  size,
  children,
}: {
  size: { width: number; height: number }
  children: React.ReactNode
}): React.ReactElement {
  const frameWidth = size.width + 8
  const frameHeight = size.height + 36 // 标题栏 + 地址栏

  return (
    <div
      className="relative rounded-lg bg-zinc-200 shadow-xl ring-1 ring-zinc-300"
      style={{
        width: frameWidth,
        height: frameHeight,
      }}
    >
      {/* 标题栏 */}
      <div className="flex h-8 items-center gap-1.5 rounded-t-lg bg-zinc-100 px-3">
        <span className="size-2.5 rounded-full bg-red-400" />
        <span className="size-2.5 rounded-full bg-yellow-400" />
        <span className="size-2.5 rounded-full bg-green-400" />
      </div>
      {/* 地址栏 */}
      <div className="flex h-5 items-center bg-zinc-50 px-3">
        <div className="h-3 w-full rounded bg-zinc-200" />
      </div>
      {/* 内容区域 */}
      <div className="overflow-hidden bg-white" style={{ height: size.height }}>
        {children}
      </div>
    </div>
  )
}

export function DeviceFrame({ device, children, className }: DeviceFrameProps): React.ReactElement {
  const size = DEVICE_PRESETS[device]

  return (
    <div className={cn('inline-block', className)}>
      {device === 'mobile' && <MobileFrame size={size}>{children}</MobileFrame>}
      {device === 'tablet' && <TabletFrame size={size}>{children}</TabletFrame>}
      {device === 'desktop' && <DesktopFrame size={size}>{children}</DesktopFrame>}
    </div>
  )
}

/** 设备图标组件 */
export function DeviceIcon({
  device,
  className,
}: {
  device: DeviceType
  className?: string
}): React.ReactElement {
  if (device === 'mobile') return <Smartphone className={className} />
  if (device === 'tablet') return <Tablet className={className} />
  return <Monitor className={className} />
}
