/**
 * AgentModelSelector - Agent 模型选择器
 *
 * 从 ModelSelector 简化而来，仅用于 Agent 模式。
 * P3: Chat 模式已退役，移除 Chat 相关依赖。
 */

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { ChevronDown, Cpu, Search } from 'lucide-react'
import * as React from 'react'

import type { AgentEffort, Channel, ModelOption } from '@tagent/shared'

import {
  agentChannelIdAtom,
  agentEffortAtom,
  agentModelIdAtom,
  agentThinkingAtom,
} from '@/atoms/agent-atoms'
import { channelsAtom, channelsLoadedAtom, thinkingExpandedAtom } from '@/atoms/chat-atoms'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { getModelLogo, getChannelLogo, DefaultLogo } from '@/lib/model-logo'
import { cn } from '@/lib/utils'

/** 从渠道列表构建扁平化的模型选项 */
function buildModelOptions(
  channels: Channel[],
  filterChannelId?: string,
  filterChannelIds?: string[]
): ModelOption[] {
  const options: ModelOption[] = []

  for (const channel of channels) {
    if (!channel.enabled) continue
    if (filterChannelId && channel.id !== filterChannelId) continue
    if (filterChannelIds && filterChannelIds.length > 0 && !filterChannelIds.includes(channel.id))
      continue

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

const EFFORT_OPTIONS: Array<{
  value: AgentEffort
  label: string
  desc: string
}> = [
  { value: 'low', label: '轻量', desc: '更快' },
  { value: 'medium', label: '均衡', desc: '适中' },
  { value: 'high', label: '深度', desc: '默认' },
  { value: 'max', label: '最大', desc: '最强' },
]

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
  const [agentThinking, setAgentThinking] = useAtom(agentThinkingAtom)
  const [agentEffort, setAgentEffort] = useAtom(agentEffortAtom)
  const [thinkingExpanded, setThinkingExpanded] = useAtom(thinkingExpandedAtom)
  const channels = useAtomValue(channelsAtom)
  const channelsLoaded = useAtomValue(channelsLoadedAtom)
  const setChannels = useSetAtom(channelsAtom)
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const listContentRef = React.useRef<HTMLDivElement>(null)
  const [modelSelectionStyle, setModelSelectionStyle] = React.useState<React.CSSProperties | null>(
    null
  )

  // 外部模型优先
  const selectedModel =
    externalSelectedModel !== undefined ? externalSelectedModel : { channelId, modelId }

  // 每次打开选择浮窗时刷新渠道列表，确保最新
  React.useEffect(() => {
    if (open) {
      window.electronAPI.listChannels().then(setChannels).catch(console.error)
      setSearch('')
    }
  }, [open, setChannels])

  const modelOptions = React.useMemo(
    () => buildModelOptions(channels, filterChannelId, filterChannelIds),
    [channels, filterChannelId, filterChannelIds]
  )
  const grouped = React.useMemo(() => groupByChannel(modelOptions), [modelOptions])

  // 搜索过滤
  const filteredGrouped = React.useMemo(() => {
    if (!search.trim()) return grouped

    const query = search.toLowerCase()
    const filtered = new Map<string, ModelOption[]>()

    for (const [chId, options] of grouped.entries()) {
      const matchedOptions = options.filter(
        (o) =>
          o.modelName.toLowerCase().includes(query) || o.channelName.toLowerCase().includes(query)
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
    return (
      modelOptions.find(
        (o) => o.channelId === selectedModel.channelId && o.modelId === selectedModel.modelId
      ) ?? null
    )
  }, [selectedModel, modelOptions])

  // 保持上次有效的模型信息，避免渠道未加载时闪烁"选择模型"
  const stableModelInfoRef = React.useRef(currentModelInfo)
  if (currentModelInfo) stableModelInfoRef.current = currentModelInfo
  const displayModelInfo = currentModelInfo ?? stableModelInfoRef.current
  const thinkingEnabled = agentThinking?.type === 'adaptive'
  const effectiveEffort = agentEffort ?? 'high'
  const effortIndex = EFFORT_OPTIONS.findIndex((option) => option.value === effectiveEffort)
  const selectedModelIndex = React.useMemo(() => {
    if (!selectedModel?.channelId || !selectedModel?.modelId) return -1
    return flatOptions.findIndex(
      (option) =>
        option.channelId === selectedModel.channelId && option.modelId === selectedModel.modelId
    )
  }, [flatOptions, selectedModel])

  React.useLayoutEffect(() => {
    if (!open || selectedModelIndex < 0) {
      setModelSelectionStyle(null)
      return
    }

    const listEl = listContentRef.current
    const itemEl = itemRefs.current.get(selectedModelIndex)
    if (!listEl || !itemEl) {
      setModelSelectionStyle(null)
      return
    }

    setModelSelectionStyle({
      transform: `translate3d(${itemEl.offsetLeft}px, ${itemEl.offsetTop}px, 0)`,
      width: itemEl.offsetWidth,
      height: itemEl.offsetHeight,
    })
  }, [open, selectedModelIndex, filteredGrouped])

  /** 选择模型 */
  const handleSelect = (option: ModelOption): void => {
    if (onModelSelect) {
      onModelSelect(option)
      return
    }
    setChannelId(option.channelId)
    setModelId(option.modelId)
  }

  /** 切换 Agent 思考模式：写入设置后由下一次 SDK query 生效 */
  const handleThinkingSelect = (enabled: boolean): void => {
    const next = enabled ? { type: 'adaptive' as const } : { type: 'disabled' as const }
    setAgentThinking(next)
    window.electronAPI.updateSettings({ agentThinking: next }).catch(console.error)
  }

  /** 切换 Agent 思考强度：写入设置后由下一次 SDK query 生效 */
  const handleEffortSelect = (nextEffort: AgentEffort): void => {
    setAgentEffort(nextEffort)
    window.electronAPI.updateSettings({ agentEffort: nextEffort }).catch(console.error)
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
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {compact ? (
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Cpu className="size-3.5" />
              <span className="max-w-[120px] truncate">
                {displayModelInfo ? displayModelInfo.modelName : '模型'}
              </span>
              <ChevronDown className="size-3 opacity-70" />
            </button>
          ) : (
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {!hideLogo &&
                (displayModelInfo ? (
                  <img
                    src={getModelLogo(displayModelInfo.modelId, displayModelInfo.provider)}
                    alt={displayModelInfo.modelName}
                    className="size-4 rounded object-cover"
                  />
                ) : (
                  <Cpu className="size-3.5" />
                ))}
              <span className="max-w-[200px] truncate">
                {displayModelInfo ? displayModelInfo.modelName : '选择模型'}
              </span>
              <ChevronDown className="size-3 opacity-70" />
            </button>
          )}
        </PopoverTrigger>

        <PopoverContent
          side="top"
          align="end"
          sideOffset={10}
          className="agent-model-popover w-[360px] overflow-hidden p-0"
        >
          <div className="agent-model-popover-header border-b border-border/30 px-3.5 py-3">
            <div className="mb-2.5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-muted-foreground">当前模型</div>
                <div className="mt-1 flex min-w-0 items-center gap-2">
                  {displayModelInfo ? (
                    <img
                      src={getModelLogo(displayModelInfo.modelId, displayModelInfo.provider)}
                      alt={displayModelInfo.modelName}
                      className="size-6 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-foreground/8">
                      <Cpu className="size-3.5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">
                      {displayModelInfo ? displayModelInfo.modelName : '未选择模型'}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {displayModelInfo ? displayModelInfo.channelName : '选择一个可用渠道模型'}
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-md bg-foreground/6 px-2 py-1 text-[10px] text-muted-foreground ring-1 ring-foreground/6">
                {flatOptions.length} 个可用
              </div>
            </div>

            <div className="mb-2.5 space-y-2">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-muted-foreground">思考设置</span>
                <span className="text-[10px] text-muted-foreground/70">下次发送生效</span>
              </div>

              <div className="agent-model-segmented agent-model-segmented--2">
                <div
                  className="agent-model-segmented-indicator"
                  style={{ transform: `translateX(${thinkingEnabled ? 100 : 0}%)` }}
                />
                <button
                  type="button"
                  onClick={() => handleThinkingSelect(false)}
                  className={cn(
                    'agent-model-segmented-option',
                    !thinkingEnabled && 'agent-model-segmented-option--active'
                  )}
                >
                  关闭思考
                </button>
                <button
                  type="button"
                  onClick={() => handleThinkingSelect(true)}
                  className={cn(
                    'agent-model-segmented-option',
                    thinkingEnabled && 'agent-model-segmented-option--active'
                  )}
                >
                  自适应思考
                </button>
              </div>

              {thinkingEnabled ? (
                <div className="space-y-2">
                  <div className="flex w-full items-center justify-between rounded-xl bg-background/18 px-2.5 py-1.5 text-[11px] text-muted-foreground shadow-[inset_0_1px_0_hsl(var(--glass-shine)/0.16)]">
                    <span>消息中展开思考内容</span>
                    <Switch
                      checked={thinkingExpanded}
                      onCheckedChange={setThinkingExpanded}
                      className={cn(
                        'h-5 w-9 border-0 focus-visible:ring-0 focus-visible:ring-offset-0',
                        'data-[state=unchecked]:bg-foreground/10 dark:data-[state=unchecked]:bg-foreground/18',
                        'data-[state=checked]:!bg-foreground/18 dark:data-[state=checked]:!bg-foreground/24',
                        'shadow-[inset_0_1px_0_hsl(var(--glass-shine)/0.24),0_0_0_1px_hsl(var(--foreground)/0.08)]'
                      )}
                    />
                  </div>

                  <div className="agent-model-segmented agent-model-segmented--4">
                    <div
                      className="agent-model-segmented-indicator"
                      style={{
                        transform: `translateX(${(effortIndex >= 0 ? effortIndex : 2) * 100}%)`,
                      }}
                    />
                    {EFFORT_OPTIONS.map((option) => {
                      const selected = effectiveEffort === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleEffortSelect(option.value)}
                          className={cn(
                            'agent-model-segmented-option flex-col items-start',
                            selected && 'agent-model-segmented-option--active'
                          )}
                        >
                          <span className="block text-[11px] font-medium leading-none">
                            {option.label}
                          </span>
                          <span className="mt-1 block text-[10px] leading-none opacity-70">
                            {option.desc}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-background/14 px-2.5 py-2 text-[11px] text-muted-foreground ring-1 ring-foreground/6">
                  当前不会请求模型输出思考内容。
                </div>
              )}
            </div>

            <div className="agent-model-popover-search flex items-center gap-2 rounded-xl px-3 py-1.5">
              <Search className="size-4 shrink-0 text-muted-foreground/70" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="搜索模型或渠道"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-[340px] overflow-y-auto p-1.5 scrollbar-thin">
            {filteredGrouped.size === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                <div className="mb-2 flex size-9 items-center justify-center rounded-xl bg-foreground/6">
                  <Search className="size-4 text-muted-foreground" />
                </div>
                <div className="text-sm font-medium text-foreground">未找到模型</div>
                <div className="mt-1 text-xs text-muted-foreground">换个关键词再试试</div>
              </div>
            ) : (
              (() => {
                let flatIndex = 0
                return (
                  <div ref={listContentRef} className="relative">
                    {modelSelectionStyle && (
                      <div
                        className="agent-model-list-selection session-item-selected session-glass session-glass-sidebar"
                        style={modelSelectionStyle}
                      />
                    )}
                    {Array.from(filteredGrouped.entries()).map(([chId, options]) => {
                      const first = options[0]
                      if (!first) return null

                      return (
                        <div key={chId} className="mb-1.5 last:mb-0">
                          <div className="mb-1 flex items-center justify-between gap-2 px-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <img
                                src={(() => {
                                  const ch = channels.find((c) => c.id === chId)
                                  return ch ? getChannelLogo(ch) : DefaultLogo
                                })()}
                                alt={first.channelName}
                                className="size-4 shrink-0 rounded object-cover"
                              />
                              <span className="truncate text-[11px] font-medium text-muted-foreground">
                                {first.channelName}
                              </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground/70">
                              {options.length}
                            </span>
                          </div>

                          <div className="space-y-0.5">
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
                                  aria-selected={isSelected}
                                  onClick={() => handleSelect(option)}
                                  onMouseEnter={() => setHighlightIndex(currentFlatIndex)}
                                  className={cn(
                                    'relative z-10 flex w-full items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-left transition-colors',
                                    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                                    isSelected
                                      ? 'text-foreground'
                                      : 'hover:bg-primary/5 text-foreground/78',
                                    isHighlighted && !isSelected && 'bg-foreground/6'
                                  )}
                                >
                                  <img
                                    src={getModelLogo(option.modelId, option.provider)}
                                    alt={option.modelName}
                                    className="size-5 shrink-0 rounded object-cover"
                                  />
                                  <span
                                    className={cn(
                                      'min-w-0 flex-1 truncate text-xs',
                                      isSelected ? 'font-medium' : 'font-medium'
                                    )}
                                  >
                                    {option.modelName}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()
            )}
          </div>
        </PopoverContent>
      </Popover>
    </>
  )
}
