/**
 * AgentModelSelector - Agent 模型选择器
 *
 * 紧凑面板：当前模型头图 + 按渠道分组列表（无搜索 / 无思考设置）。
 * 材质对齐全局 session-glass-popover，不另造一套浮层光学。
 */

import { isAgentCompatibleProvider } from '@tagent/shared'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { ChevronDown, Cpu } from 'lucide-react'
import * as React from 'react'

import type { Channel, ModelOption, KsccInstallReadiness } from '@tagent/shared'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@tagent/ui'
import { channelsAtom, channelsLoadedAtom } from '@/atoms/model-atoms'
import {
  agentChannelIdAtom,
  agentChannelIdsAtom,
  agentModelIdAtom,
} from '@/atoms/agent-atoms'
import { getModelLogo, getChannelLogo, DefaultLogo } from '@/lib/model-logo'
import { cn } from '@/lib/utils'

/** 从渠道列表构建扁平化的模型选项 */
function buildModelOptions(
  channels: Channel[],
  filterChannelId?: string,
  filterChannelIds?: string[],
  ksccReadiness?: KsccInstallReadiness | null,
  lockedProvider?: string
): ModelOption[] {
  const options: ModelOption[] = []

  for (const channel of channels) {
    if (!channel.enabled) continue
    if (filterChannelId && channel.id !== filterChannelId) continue
    if (filterChannelIds && filterChannelIds.length > 0 && !filterChannelIds.includes(channel.id))
      continue

    // 渠道互斥：kscc 开始的会话不显示外部渠道，外部渠道开始的不显示 kscc
    if (lockedProvider) {
      const isKsccChannel = channel.provider === 'kscc-internal'
      if (lockedProvider === 'kscc-internal' && !isKsccChannel) continue
      if (lockedProvider !== 'kscc-internal' && isKsccChannel) continue
    }

    // kscc 渠道特殊处理：未安装时灰显
    const isKscc = channel.provider === 'kscc-internal'
    const ksccDisabled = isKscc && ksccReadiness && !ksccReadiness.kscc.installed
    const ksccDisabledReason =
      isKscc && ksccReadiness && !ksccReadiness.kscc.installed ? '请先安装 kscc' : undefined

    for (const model of channel.models) {
      if (!model.enabled) continue

      options.push({
        channelId: channel.id,
        channelName: channel.name,
        modelId: model.id,
        modelName: model.name,
        provider: channel.provider,
        ...(ksccDisabled && { disabled: true, disabledReason: ksccDisabledReason }),
        ...(isKscc && !ksccDisabled && { badge: '金山云' }),
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

interface AgentModelSelectorProps {
  /** 仅显示此渠道的模型 */
  filterChannelId?: string
  /** 仅显示这些渠道的模型（多渠道过滤） */
  filterChannelIds?: string[]
  /** 会话锁定的渠道类型，互斥过滤（'kscc-internal' 则只显示 kscc，其他值则隐藏 kscc） */
  lockedProvider?: string
  /** 外部选中模型（不传则用内部 atom） */
  externalSelectedModel?: { channelId: string; modelId: string } | null
  /** 外部选择回调 */
  onModelSelect?: (option: ModelOption) => void
  /** 隐藏触发按钮中的模型 logo，只显示文字 */
  hideLogo?: boolean
  /** 紧凑模式：Cpu 图标 + 模型名 pill，用于嵌入 trailing 区域 */
  compact?: boolean
  /** kscc 未安装时点击灰显模型的回调 */
  onInstallGuideOpen?: () => void
}

export function AgentModelSelector({
  filterChannelId,
  filterChannelIds,
  lockedProvider,
  externalSelectedModel,
  onModelSelect,
  hideLogo = false,
  compact = false,
  onInstallGuideOpen,
}: AgentModelSelectorProps = {}): React.ReactElement {
  const channelId = useAtomValue(agentChannelIdAtom)
  const modelId = useAtomValue(agentModelIdAtom)
  const setChannelId = useSetAtom(agentChannelIdAtom)
  const setModelId = useSetAtom(agentModelIdAtom)
  const channels = useAtomValue(channelsAtom)
  const channelsLoaded = useAtomValue(channelsLoadedAtom)
  const setChannels = useSetAtom(channelsAtom)
  const [agentChannelIds, setAgentChannelIds] = useAtom(agentChannelIdsAtom)
  const [open, setOpen] = React.useState(false)
  const [ksccReadiness, setKsccReadiness] = React.useState<KsccInstallReadiness | null>(null)

  const selectedModel =
    externalSelectedModel !== undefined ? externalSelectedModel : { channelId, modelId }

  // 打开时刷新渠道 + 同步 Agent 兼容白名单
  React.useEffect(() => {
    if (!open) return
    window.electronAPI
      .listChannels()
      .then((ch) => {
        setChannels(ch)
        const currentIds = new Set(agentChannelIds)
        const missingIds = ch
          .filter(
            (c) => c.enabled && isAgentCompatibleProvider(c.provider) && !currentIds.has(c.id)
          )
          .map((c) => c.id)
        if (missingIds.length > 0) {
          const merged = [...missingIds, ...agentChannelIds]
          setAgentChannelIds(merged)
          window.electronAPI.updateSettings({ agentChannelIds: merged }).catch(console.error)
        }
      })
      .catch(console.error)
  }, [open, setChannels, agentChannelIds, setAgentChannelIds])

  React.useEffect(() => {
    if (!open) return
    window.electronAPI
      .checkKsccReadiness()
      .then(setKsccReadiness)
      .catch(() => setKsccReadiness(null))
  }, [open])

  const modelOptions = React.useMemo(
    () =>
      buildModelOptions(channels, filterChannelId, filterChannelIds, ksccReadiness, lockedProvider),
    [channels, filterChannelId, filterChannelIds, ksccReadiness, lockedProvider]
  )
  const grouped = React.useMemo(() => groupByChannel(modelOptions), [modelOptions])

  const currentModelInfo = React.useMemo(() => {
    if (!selectedModel?.channelId || !selectedModel?.modelId) return null
    return (
      modelOptions.find(
        (o) => o.channelId === selectedModel.channelId && o.modelId === selectedModel.modelId
      ) ?? null
    )
  }, [selectedModel, modelOptions])

  // 保持上次有效的模型信息，避免渠道未加载时闪烁「选择模型」
  const stableModelInfoRef = React.useRef(currentModelInfo)
  if (currentModelInfo) stableModelInfoRef.current = currentModelInfo
  const displayModelInfo = currentModelInfo ?? stableModelInfoRef.current

  const handleSelect = (option: ModelOption): void => {
    if (onModelSelect) {
      onModelSelect(option)
    } else {
      setChannelId(option.channelId)
      setModelId(option.modelId)
    }
    setOpen(false)
  }

  if (channelsLoaded && modelOptions.length === 0) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground">
        <Cpu className="size-3.5" />
        <span>暂无可用模型</span>
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {compact ? (
          <button
            type="button"
            className="agent-toolbar-pill-btn flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
        className="agent-model-popover w-[320px] overflow-hidden p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* 当前模型大头 */}
        <div className="agent-model-popover-header px-3.5 pt-3 pb-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-muted-foreground">当前模型</div>
              <div className="mt-1.5 flex min-w-0 items-center gap-2.5">
                {displayModelInfo ? (
                  <img
                    src={getModelLogo(displayModelInfo.modelId, displayModelInfo.provider)}
                    alt={displayModelInfo.modelName}
                    className="size-7 shrink-0 rounded-glass-chip object-cover"
                  />
                ) : (
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-glass-chip bg-foreground/8">
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
            <span className="session-glass-chip shrink-0 px-2 py-0.5 text-[10px] text-muted-foreground">
              {modelOptions.length} 个可用
            </span>
          </div>
        </div>

        <div className="agent-model-popover-divider" role="separator" aria-hidden />

        <div className="px-3.5 pb-1 pt-2">
          <div className="text-[11px] font-medium text-muted-foreground">可选模型</div>
        </div>

        <div className="max-h-[280px] overflow-y-auto px-1.5 pb-1.5 scrollbar-thin">
          {Array.from(grouped.entries()).map(([chId, options]) => {
            const first = options[0]
            if (!first) return null
            const channel = channels.find((c) => c.id === chId)

            return (
              <div key={chId} className="mb-1.5 last:mb-0">
                <div className="mb-1 flex items-center gap-2.5 px-2 py-1">
                  <img
                    src={channel ? getChannelLogo(channel) : DefaultLogo}
                    alt={first.channelName}
                    className="size-6 shrink-0 rounded-md object-cover"
                  />
                  <span className="truncate text-xs font-medium text-foreground/75">
                    {first.channelName}
                  </span>
                </div>

                <div className="flex flex-col gap-0.5 pl-1">
                  {options.map((option) => {
                    const isSelected =
                      selectedModel?.channelId === option.channelId &&
                      selectedModel?.modelId === option.modelId

                    const modelButton = (
                      <button
                        type="button"
                        aria-selected={isSelected}
                        disabled={option.disabled}
                        onClick={() => {
                          if (option.disabled) {
                            onInstallGuideOpen?.()
                            return
                          }
                          handleSelect(option)
                        }}
                        className={cn(
                          'session-list-row relative flex w-full items-center gap-2 rounded-glass-sidebar px-2.5 py-1.5 text-left',
                          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                          option.disabled && 'cursor-not-allowed opacity-50',
                          !option.disabled && !isSelected && 'text-foreground/78',
                          isSelected && 'session-list-item-active'
                        )}
                      >
                        <img
                          src={getModelLogo(option.modelId, option.provider)}
                          alt={option.modelName}
                          className="size-4 shrink-0 rounded object-cover"
                        />
                        <span className="min-w-0 flex-1 truncate text-xs font-medium">
                          {option.modelName}
                        </span>
                        {option.badge && !option.disabled && (
                          <span className="session-glass-chip ml-1 shrink-0 px-1.5 py-0.5 text-[10px] font-medium text-orange-600 dark:text-orange-400">
                            {option.badge}
                          </span>
                        )}
                      </button>
                    )

                    if (option.disabled && option.disabledReason) {
                      return (
                        <Tooltip key={`${option.channelId}:${option.modelId}`}>
                          <TooltipTrigger asChild>{modelButton}</TooltipTrigger>
                          <TooltipContent>{option.disabledReason}</TooltipContent>
                        </Tooltip>
                      )
                    }

                    return (
                      <React.Fragment key={`${option.channelId}:${option.modelId}`}>
                        {modelButton}
                      </React.Fragment>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
