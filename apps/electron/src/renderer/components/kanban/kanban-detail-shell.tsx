/**
 * 看板详情弹窗共用壳 — Worker 任务详情 / 角色库详情
 *
 * 统一：无 padding Dialog + 头栏 + 可选左栏 + 主区滚动 + 底栏
 */

import * as React from 'react'

import { DialogContent, DialogDescription, DialogHeader, DialogTitle, ScrollArea } from '@tagent/ui'
import { cn } from '@/lib/utils'

export function KanbanDetailContent({
  className,
  children,
  onOpenAutoFocus,
}: {
  className?: string
  children: React.ReactNode
  onOpenAutoFocus?: (e: Event) => void
}): React.ReactElement {
  return (
    <DialogContent
      className={cn('flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0', className)}
      onOpenAutoFocus={onOpenAutoFocus}
    >
      {children}
    </DialogContent>
  )
}

export function KanbanDetailHeader({
  icon,
  title,
  description,
  meta,
  actions,
}: {
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  meta?: React.ReactNode
  actions?: React.ReactNode
}): React.ReactElement {
  return (
    <div className="flex shrink-0 items-start gap-3 border-b border-foreground/[0.06] px-5 py-4 pr-12">
      {icon ? <div className="shrink-0">{icon}</div> : null}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate text-[15px] font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          {meta}
        </div>
        {description ? (
          <div className="mt-0.5 text-[12px] leading-relaxed text-foreground/55">{description}</div>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
    </div>
  )
}

/** a11y 标题（视觉头用 KanbanDetailHeader） */
export function KanbanDetailA11yTitle({
  title,
  description,
}: {
  title: string
  description?: string
}): React.ReactElement {
  return (
    <DialogHeader className="sr-only">
      <DialogTitle>{title}</DialogTitle>
      {description ? <DialogDescription>{description}</DialogDescription> : null}
    </DialogHeader>
  )
}

export function KanbanDetailBody({
  aside,
  children,
}: {
  aside?: React.ReactNode
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {aside ? (
        <aside className="flex w-[240px] shrink-0 flex-col overflow-hidden border-r border-foreground/[0.06]">
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-4 p-4">{aside}</div>
          </ScrollArea>
        </aside>
      ) : null}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  )
}

export function KanbanDetailMain({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}): React.ReactElement {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className={cn('space-y-4 p-5', className)}>{children}</div>
    </ScrollArea>
  )
}

export function KanbanDetailFooter({
  left,
  right,
}: {
  left?: React.ReactNode
  right?: React.ReactNode
}): React.ReactElement {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-t border-foreground/[0.06] px-5 py-3">
      <div className="flex min-w-0 items-center gap-2">{left}</div>
      <div className="flex shrink-0 items-center gap-2">{right}</div>
    </div>
  )
}

export function KanbanDetailSection({
  kicker,
  trailing,
  children,
  tone = 'neutral',
}: {
  kicker: string
  trailing?: React.ReactNode
  children: React.ReactNode
  tone?: 'neutral' | 'success' | 'danger' | 'violet' | 'amber'
}): React.ReactElement {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-500/15 bg-emerald-500/[0.04]'
      : tone === 'danger'
        ? 'border-red-500/15 bg-red-500/[0.04]'
        : tone === 'violet'
          ? 'border-violet-500/15 bg-violet-500/[0.04]'
          : tone === 'amber'
            ? 'border-amber-500/15 bg-amber-500/[0.04]'
            : 'border-foreground/[0.06] bg-foreground/[0.025]'

  return (
    <section className={cn('rounded-[14px] border px-3.5 py-3', toneClass)}>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-foreground/45">
          {kicker}
        </span>
        {trailing ? <div className="ml-auto">{trailing}</div> : null}
      </div>
      {children}
    </section>
  )
}

export function KanbanDetailMetaItem({
  label,
  value,
  mono,
  action,
}: {
  label: string
  value?: React.ReactNode
  mono?: boolean
  action?: React.ReactNode
}): React.ReactElement {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-foreground/40">
        {label}
      </div>
      <div
        className={cn(
          'flex min-w-0 items-center gap-1 text-[12px] text-foreground/85',
          mono && 'font-mono text-[11px]'
        )}
      >
        {value != null && value !== '' ? (
          <>
            <span className="min-w-0 truncate">{value}</span>
            {action}
          </>
        ) : (
          <span className="text-foreground/30">—</span>
        )}
      </div>
    </div>
  )
}

export function KanbanDetailField({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[10px] font-medium uppercase tracking-[0.06em] text-foreground/45">
          {label}
        </label>
        {hint ? <span className="text-[10px] text-foreground/35">{hint}</span> : null}
      </div>
      {children}
    </div>
  )
}
