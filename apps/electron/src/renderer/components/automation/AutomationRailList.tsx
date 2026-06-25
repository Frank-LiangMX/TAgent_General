/**
 * AutomationRailList - 侧栏任务列表
 */

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { Loader2, Plus } from 'lucide-react'
import * as React from 'react'

import type { Automation } from '@tagent/shared'
import { formatScheduleLabel } from '@tagent/shared'

import {
  automationsAtom,
  automationsGroupedAtom,
  automationsLoadingAtom,
  automationEditorModeAtom,
  loadAutomations,
  selectedAutomationIdAtom,
} from '@/atoms/automation-atoms'
import { WindowDragStrip } from '@/components/app-shell/WindowDragStrip'
import { Button } from '@/components/ui/button'
import { ScrollProgressContainer } from '@/components/ui/scroll-progress-container'
import { cn } from '@/lib/utils'

export function AutomationRailList(): React.ReactElement {
  const [loading, setLoading] = useAtom(automationsLoadingAtom)
  const [automations, setAutomations] = useAtom(automationsAtom)
  const grouped = useAtomValue(automationsGroupedAtom)
  const [selectedId, setSelectedId] = useAtom(selectedAutomationIdAtom)
  const setEditorMode = useSetAtom(automationEditorModeAtom)

  const refresh = React.useCallback(async () => {
    setLoading(true)
    try {
      const data = await loadAutomations()
      setAutomations(data)
    } finally {
      setLoading(false)
    }
  }, [setAutomations, setLoading])

  React.useEffect(() => {
    void refresh()
    const cleanup = window.electronAPI.automation.onChanged(() => {
      void refresh()
    })
    return cleanup
  }, [refresh])

  const handleCreate = (): void => {
    setSelectedId(null)
    setEditorMode('create')
  }

  const handleSelect = (id: string): void => {
    setSelectedId(id)
    setEditorMode('edit')
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <WindowDragStrip withSpacer />

      <div className="titlebar-no-drag flex shrink-0 items-center justify-between gap-2 border-b border-border/40 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">自动任务</p>
          <p className="text-[10px] text-muted-foreground">{automations.length} 个任务</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-[36px] shrink-0 rounded-full p-0 text-foreground/60 hover:text-foreground"
          onClick={handleCreate}
          title="新建任务"
        >
          <Plus size={16} />
        </Button>
      </div>

      <ScrollProgressContainer className="min-h-0 flex-1" contentClassName="px-2 py-2">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={18} className="animate-spin text-muted-foreground" />
          </div>
        ) : automations.length === 0 ? (
          <div className="px-2 py-8 text-center text-xs text-muted-foreground">
            <p>还没有定时任务</p>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="mt-2 h-auto p-0 text-xs"
              onClick={handleCreate}
            >
              创建第一个
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <AutomationGroup
              title={`启用中 (${grouped.enabled.length})`}
              items={grouped.enabled}
              selectedId={selectedId}
              onSelect={handleSelect}
            />
            <AutomationGroup
              title={`已暂停 (${grouped.paused.length})`}
              items={grouped.paused}
              selectedId={selectedId}
              onSelect={handleSelect}
            />
            <AutomationGroup
              title={`已完成 (${grouped.completed.length})`}
              items={grouped.completed}
              selectedId={selectedId}
              onSelect={handleSelect}
            />
          </div>
        )}
      </ScrollProgressContainer>
    </div>
  )
}

function AutomationGroup({
  title,
  items,
  selectedId,
  onSelect,
}: {
  title: string
  items: Automation[]
  selectedId: string | null
  onSelect: (id: string) => void
}): React.ReactElement | null {
  if (items.length === 0) return null

  return (
    <section>
      <h3 className="mb-1.5 px-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-0.5">
        {items.map((item) => {
          const active = selectedId === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={cn(
                'titlebar-no-drag w-full rounded-lg px-2.5 py-2 text-left transition-colors',
                active
                  ? 'bg-primary/10 text-foreground shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]'
                  : 'text-foreground/70 hover:bg-primary/5 hover:text-foreground'
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    item.enabled ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                  )}
                />
                <span className="truncate text-xs font-medium">{item.name}</span>
              </div>
              <p className="mt-0.5 truncate pl-3.5 text-[10px] text-muted-foreground">
                {formatScheduleLabel(item)}
              </p>
            </button>
          )
        })}
      </div>
    </section>
  )
}
