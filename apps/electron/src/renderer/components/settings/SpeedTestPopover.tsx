/**
 * SpeedTestPopover — 批量测速触发器
 *
 * 点击 Gauge 图标弹出 Popover：
 * - 标题 + 全选按钮
 * - 按渠道分组列表（Checkbox + modelId，max-h-[320px] 滚动）
 * - 开始测速按钮（显示已选数，0 个 disabled）
 *
 * 测速结果写入 speedTestResultsAtom，由 SpeedTestBadge 在每行模型后展示。
 */
import { useAtom, useSetAtom } from 'jotai'
import { Gauge, Loader2, Zap } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { Channel } from '@tagent/shared'

import { Button } from '@tagent/ui'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'

import { speedTestResultsAtom, speedTestRunningAtom } from '@/atoms/model-atoms'

interface SpeedTestPopoverProps {
  channels: Channel[]
}

interface SelectedItem {
  channelId: string
  modelId: string
}

function itemKey(channelId: string, modelId: string): string {
  return `${channelId}:${modelId}`
}

export function SpeedTestPopover({ channels }: SpeedTestPopoverProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [running, setRunning] = useAtom(speedTestRunningAtom)
  const setResults = useSetAtom(speedTestResultsAtom)

  // 只展示已启用渠道的已启用模型
  const enabledChannels = useMemo(
    () => channels.filter((c) => c.enabled && c.models.some((m) => m.enabled)),
    [channels]
  )

  const allItems: SelectedItem[] = useMemo(() => {
    const arr: SelectedItem[] = []
    for (const c of enabledChannels) {
      for (const m of c.models) {
        if (m.enabled) arr.push({ channelId: c.id, modelId: m.id })
      }
    }
    return arr
  }, [enabledChannels])

  const allKeys = useMemo(
    () => new Set(allItems.map((i) => itemKey(i.channelId, i.modelId))),
    [allItems]
  )
  const allSelected =
    selected.size > 0 && allKeys.size > 0 && [...allKeys].every((k) => selected.has(k))

  const toggleItem = (channelId: string, modelId: string) => {
    const key = itemKey(channelId, modelId)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(allKeys))
    }
  }

  const handleStart = async () => {
    if (selected.size === 0 || running) return
    const items: Array<{ channelId: string; modelId: string }> = []
    for (const k of selected) {
      const sepIdx = k.indexOf(':')
      if (sepIdx < 0) continue
      const channelId = k.slice(0, sepIdx)
      const modelId = k.slice(sepIdx + 1)
      if (!channelId || !modelId) continue
      items.push({ channelId, modelId })
    }
    if (items.length === 0) return
    setRunning(true)
    setOpen(false)
    try {
      const result = await window.electronAPI.speedTestModels({ items })
      setResults((prev) => ({ ...prev, ...result.results }))
    } catch (error) {
      console.error('speedTestModels failed:', error)
    } finally {
      setRunning(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-xl text-foreground/60 hover:text-foreground"
          disabled={running}
          title={running ? '测速中...' : '测速（TTFB）'}
        >
          {running ? <Loader2 size={16} className="animate-spin" /> : <Gauge size={16} />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto min-w-[260px] p-0 border-none shadow-xl">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
          <span className="text-xs font-medium text-foreground/80">测速（首字延迟）</span>
          <button
            type="button"
            onClick={toggleAll}
            disabled={allItems.length === 0}
            className="text-[10px] text-blue-500 hover:text-blue-600 dark:text-blue-400 disabled:opacity-40"
          >
            {allSelected ? '取消全选' : '全选'}
          </button>
        </div>

        <div className="max-h-[320px] overflow-y-auto py-1">
          {enabledChannels.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              没有已启用的渠道/模型
            </div>
          ) : (
            enabledChannels.map((channel) => (
              <div key={channel.id} className="px-1.5 py-1">
                <div className="px-1.5 py-0.5 text-[10px] font-medium text-foreground/50 truncate">
                  {channel.name}
                </div>
                {channel.models
                  .filter((m) => m.enabled)
                  .map((model) => {
                    const key = itemKey(channel.id, model.id)
                    const checked = selected.has(key)
                    return (
                      <label
                        key={key}
                        className="flex items-center gap-2 px-1.5 py-1 rounded-md hover:bg-muted/50 cursor-pointer text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleItem(channel.id, model.id)}
                          className="size-3 accent-blue-500"
                        />
                        <span className="truncate flex-1">{model.id}</span>
                      </label>
                    )
                  })}
              </div>
            ))
          )}
        </div>

        <div className="px-3 py-2 border-t border-border/40">
          <Button
            size="sm"
            className="w-full h-8 gap-1.5"
            disabled={selected.size === 0 || running}
            onClick={handleStart}
          >
            <Zap size={14} />
            开始测速{selected.size > 0 ? ` (${selected.size})` : ''}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
