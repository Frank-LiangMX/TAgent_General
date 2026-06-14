/**
 * AgentModelSelector - Agent 模型选择器
 *
 * 从 ModelSelector 简化而来，仅用于 Agent 模式。
 * P3: Chat 模式已退役，移除 Chat 相关依赖。
 */

import { useAtomValue, useSetAtom } from 'jotai'
import { ChevronDown, Cpu, Search } from 'lucide-react'
import * as React from 'react'

import type { Channel, ModelOption } from '@tagent/shared'

import {
  agentChannelIdAtom,
  agentModelIdAtom,
} from '@/atoms/agent-atoms'
import { channelsAtom, channelsLoadedAtom } from '@/atoms/chat-atoms'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getModelLogo, getChannelLogo, DefaultLogo } from '@/lib/model-logo'
import { cn } from '@/lib/utils'


/** 从渠道列表构建扁平化的模型选项 */
function buildModelOptions(channels: Channel[], filterChannelId?: string, filterChannelIds?: string[]): ModelOption[] {
  const options: ModelOption[] = []

  for (const channel of channels) {
    if (!channel.enabled) continue
    if (filterChannelId && channel.id !== filterChannelId) continue
    if (filterChannelIds && filterChannelIds.length > 0 && !filterChannelIds.includes(channel.id)) continue

    for (const model of channel.models) {
      if (!model.enabled) continue

      options.push({
        channelId: channel.id,
        channelName: channel.name,
        modelId: model.id,
        modelName: model.name,
        provider: channel.provider,
      })
    }
  }

  return options
}

/** 按渠道分组模型选项 */
function groupByChannel(options: ModelOption[]): Map<string, ModelOption[]> {
  const groups = new Map<string, ModelOption[]>()

  for (const option of options) {
    const key = option.channelId
    const group = groups.get(key) ?? []
    group.push(option)
    groups.set(key, group)
  }

  return groups
}

/** AgentModelSelector 属性 */
interface AgentModelSelectorProps {
  /** 仅显示此渠道的模型 */
  filterChannelId?: string
  /** 仅显示这些渠道的模型（多渠道过滤） */
  filterChannelIds?: string[]
  /** 外部选中模型（不传则用内部 atom） */
  externalSelectedModel?: { channelId: string; modelId: string } | null
  /** 外部选择回调 */
  onModelSelect?: (option: ModelOption) => void
  /** 隐藏触发按钮中的模型 logo，只显示文字 */
  hideLogo?: boolean
  /** 紧凑模式：Cpu 图标 + 模型名 pill，用于嵌入 trailing 区域 */
  compact?: boolean
}

export function AgentModelSelector({
  filterChannelId,
  filterChannelIds,
  externalSelectedModel,
  onModelSelect,
  hideLogo = false,
  compact = false,
}: AgentModelSelectorProps = {}): React.ReactElement {
  const channelId = useAtomValue(agentChannelIdAtom)
  const modelId = useAtomValue(agentModelIdAtom)
  const setChannelId = useSetAtom(agentChannelIdAtom)
  const setModelId = useSetAtom(agentModelIdAtom)
  const channels = useAtomValue(channelsAtom)
  const channelsLoaded = useAtomValue(channelsLoadedAtom)
  const setChannels = useSetAtom(channelsAtom)
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')

  // 外部模型优先
  const selectedModel = externalSelectedModel !== undefined ? externalSelectedModel : { channelId, modelId }

  // 每次打开 Dialog 时刷新渠道列表，确保最新
  React.useEffect(() => {
    if (open) {
      window.electronAPI.listChannels().then(setChannels).catch(console.error)
      setSearch('')
    }
  }, [open, setChannels])

  const modelOptions = React.useMemo(() => buildModelOptions(channels, filterChannelId, filterChannelIds), [channels, filterChannelId, filterChannelIds])
  const grouped = React.useMemo(() => groupByChannel(modelOptions), [modelOptions])

  // 搜索过滤
  const filteredGrouped = React.useMemo(() => {
    if (!search.trim()) return grouped

    const query = search.toLowerCase()
    const filtered = new Map<string, ModelOption[]>()

    for (const [chId, options] of grouped.entries()) {
      const matchedOptions = options.filter(
        (o) =>
          o.modelName.toLowerCase().includes(query) ||
          o.channelName.toLowerCase().includes(query)
      )
      if (matchedOptions.length > 0) {
        filtered.set(chId, matchedOptions)
      }
    }

    return filtered
  }, [grouped, search])

  // 扁平化过滤后的模型列表，用于键盘导航
  const flatOptions = React.useMemo(() => {
    const result: ModelOption[] = []
    for (const options of filteredGrouped.values()) {
      result.push(...options)
    }
    return result
  }, [filteredGrouped])

  // 键盘高亮索引
  const [highlightIndex, setHighlightIndex] = React.useState(-1)
  const itemRefs = React.useRef<Map<number, HTMLButtonElement>>(new Map())

  // 搜索变化时重置高亮
  React.useEffect(() => {
    setHighlightIndex(-1)
  }, [search])

  // 高亮项变化时滚动到可见区域
  React.useEffect(() => {
    if (highlightIndex < 0) return
    const el = itemRefs.current.get(highlightIndex)
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlightIndex])

  // 查找当前选中的模型信息
  const currentModelInfo = React.useMemo(() => {
    if (!selectedModel?.channelId || !selectedModel?.modelId) return null
    return modelOptions.find(
      (o) => o.channelId === selectedModel.channelId && o.modelId === selectedModel.modelId
    ) ?? null
  }, [selectedModel, modelOptions])

  // 保持上次有效的模型信息，避免渠道未加载时闪烁"选择模型"
  const stableModelInfoRef = React.useRef(currentModelInfo)
  if (currentModelInfo) stableModelInfoRef.current = currentModelInfo
  const displayModelInfo = currentModelInfo ?? stableModelInfoRef.current

  /** 选择模型 */
  const handleSelect = (option: ModelOption): void => {
    if (onModelSelect) {
      onModelSelect(option)
      setOpen(false)
      return
    }
    setChannelId(option.channelId)
    setModelId(option.modelId)
    setOpen(false)
  }

  /** 搜索框键盘导航 */
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (flatOptions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex((prev) => (prev < flatOptions.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex((prev) => (prev > 0 ? prev - 1 : flatOptions.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const target = flatOptions[highlightIndex >= 0 ? highlightIndex : 0]
      if (target) handleSelect(target)
    }
  }

  if (channelsLoaded && modelOptions.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-2 py-1">
        <Cpu className="size-3.5" />
        <span>暂无可用模型</span>
      </div>
    )
  }

  return (
    <>
      {/* 触发按钮 */}
      {compact ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <Cpu className="size-3.5" />
          <span className="max-w-[120px] truncate">
            {displayModelInfo ? displayModelInfo.modelName : '模型'}
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          {!hideLogo && (
            displayModelInfo ? (
              <img
                src={getModelLogo(displayModelInfo.modelId, displayModelInfo.provider)}
                alt={displayModelInfo.modelName}
                className="size-4 rounded object-cover"
              />
            ) : (
              <Cpu className="size-3.5" />
            )
          )}
          <span className="max-w-[200px] truncate">
            {displayModelInfo ? displayModelInfo.modelName : '选择模型'}
          </span>
          <ChevronDown className="size-3" />
        </button>
      )}

      {/* 模型选择 Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 gap-0 max-w-lg" aria-describedby={undefined}>
          <DialogHeader className="sr-only">
            <DialogTitle>选择模型</DialogTitle>
          </DialogHeader>

          {/* 搜索栏 */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/60">
            <Search className="size-5 text-muted-foreground/60 flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="搜索模型..."
              className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/50"
              autoFocus
            />
          </div>

          {/* 模型列表 */}
          <div className="max-h-[420px] overflow-y-auto">
            {filteredGrouped.size === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                未找到模型
              </div>
            ) : (
              (() => {
                let flatIndex = 0
                return Array.from(filteredGrouped.entries()).map(([chId, options]) => {
                const first = options[0]
                if (!first) return null

                return (
                  <div key={chId}>
                    {/* 供应商标题行 - 灰色背景 */}
                    <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b border-border/30">
                      <img
                        src={(() => {
                          const ch = channels.find((c) => c.id === chId)
                          return ch ? getChannelLogo(ch) : DefaultLogo
                        })()}
                        alt={first.channelName}
                        className="size-5 rounded object-cover"
                      />
                      <span className="text-sm font-medium text-muted-foreground">
                        {first.channelName}
                      </span>
                    </div>

                    {/* 该渠道下的模型列表 */}
                    {options.map((option) => {
                      const isSelected =
                        selectedModel?.channelId === option.channelId &&
                        selectedModel?.modelId === option.modelId
                      const currentFlatIndex = flatIndex++
                      const isHighlighted = currentFlatIndex === highlightIndex

                      return (
                        <button
                          key={`${option.channelId}:${option.modelId}`}
                          ref={(el) => {
                            if (el) itemRefs.current.set(currentFlatIndex, el)
                            else itemRefs.current.delete(currentFlatIndex)
                          }}
                          type="button"
                          onClick={() => handleSelect(option)}
                          onMouseEnter={() => setHighlightIndex(currentFlatIndex)}
                          className={cn(
                            'flex items-center gap-3 w-[calc(100%-1rem)] px-4 py-1.5 mx-2 rounded-lg text-left transition-colors',
                            'hover:bg-accent',
                            isHighlighted && 'bg-accent',
                            isSelected && 'bg-foreground/10 border-l-3 border-l-primary'
                          )}
                        >
                          <img
                            src={getModelLogo(option.modelId, option.provider)}
                            alt={option.modelName}
                            className="size-5 rounded object-cover flex-shrink-0"
                          />
                          <span className={cn(
                            'flex-1 text-sm truncate',
                            isSelected ? 'font-medium text-foreground' : 'text-foreground/80'
                          )}>
                            {option.modelName}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )
              })
              })()
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
