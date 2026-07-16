import * as React from 'react'

import type {
  SDKContentBlock,
  SDKMessage,
  SDKToolResultBlock,
  SDKToolUseBlock,
  SDKUserMessage,
} from '@tagent/shared'
import { SessionChevronRight } from './session-icons'
import { getToolDisplayName, getToolIcon } from './tool-utils'

import { cn } from '@/lib/utils'

interface ProcessBlockGroupProps {
  blocks: SDKContentBlock[]
  isStreaming?: boolean
  keepExpandedAfterComplete: boolean
  children: React.ReactNode
}

const MAX_PROCESS_GROUP_ICONS = 4
const PROCESS_GROUP_COLLAPSE_DURATION_MS = 700
const PROCESS_GROUP_AUTO_COLLAPSE_SOUND_DELAY_MS = 900
const PROCESS_GROUP_AUTO_COLLAPSE_COUNTDOWN_SECONDS = 3

interface IndexedContentBlock {
  block: SDKContentBlock
  index: number
}

export type AssistantTurnRenderItem =
  | { type: 'block'; item: IndexedContentBlock }
  | { type: 'process-group'; items: IndexedContentBlock[] }

interface BuildAssistantTurnRenderItemsOptions {
  isStreaming?: boolean
  completedToolResultIds?: Set<string>
}

export function buildCompletedToolResultIds(turnMessages: SDKMessage[]): Set<string> {
  const ids = new Set<string>()
  for (const msg of turnMessages) {
    if (msg.type !== 'user') continue
    const userMsg = msg as SDKUserMessage
    const blocks = userMsg.message?.content
    if (!Array.isArray(blocks)) continue
    for (const b of blocks) {
      if (b.type !== 'tool_result') continue
      const rb = b as SDKToolResultBlock
      ids.add(rb.tool_use_id)
    }
  }
  return ids
}

function getTrailingBlockRunStart(
  blocks: SDKContentBlock[],
  blockType: 'text' | 'thinking'
): number {
  let index = blocks.length
  while (index > 0 && blocks[index - 1]?.type === blockType) {
    index -= 1
  }
  return index
}

interface MergeStreamingContentOptions {
  streamingText?: string
  streamingThinking?: string
  parseStreamingText: (text: string) => SDKContentBlock[]
}

/**
 * 将实时流式 text/thinking 合并进 SDK 块序列，保持时间顺序：
 * - 已落盘的 thinking 块不会被后续 text 流覆盖
 * - 仅替换末尾滞后的 text，或更新/追加 thinking
 */
export function mergeStreamingContentIntoBlocks(
  blocks: SDKContentBlock[],
  options: MergeStreamingContentOptions
): SDKContentBlock[] {
  const { streamingText, streamingThinking, parseStreamingText } = options
  if (!streamingText && !streamingThinking) return blocks

  let result = [...blocks]

  const applyThinkingContent = (thinking: string): void => {
    const trimmed = thinking.trim()
    if (!trimmed) return

    const trailingTextStart = getTrailingBlockRunStart(result, 'text')
    const trailingThinkingStart = getTrailingBlockRunStart(result, 'thinking')

    if (trailingThinkingStart < result.length && trailingThinkingStart >= trailingTextStart) {
      result.splice(trailingThinkingStart, result.length - trailingThinkingStart, {
        type: 'thinking',
        thinking: trimmed,
      })
      return
    }

    if (result[result.length - 1]?.type === 'thinking') {
      result[result.length - 1] = { type: 'thinking', thinking: trimmed }
      return
    }

    result.push({ type: 'thinking', thinking: trimmed })
  }

  if (streamingThinking) {
    applyThinkingContent(streamingThinking)
  }

  if (streamingText) {
    const parsed = parseStreamingText(streamingText)
    if (parsed.length > 0) {
      const parsedThinking = parsed
        .filter((block) => block.type === 'thinking')
        .map((block) => (block as { thinking: string }).thinking)
        .join('\n\n')
      const parsedNonThinking = parsed.filter((block) => block.type !== 'thinking')

      if (!streamingThinking && parsedThinking) {
        applyThinkingContent(parsedThinking)
      }

      if (parsedNonThinking.length > 0) {
        const trailingTextStart = getTrailingBlockRunStart(result, 'text')
        if (trailingTextStart < result.length) {
          result.splice(trailingTextStart, result.length - trailingTextStart, ...parsedNonThinking)
        } else {
          result.push(...parsedNonThinking)
        }
      }
    }
  }

  return result
}

/** @deprecated 使用 mergeStreamingContentIntoBlocks */
export function mergeStreamingTextIntoBlocks(
  blocks: SDKContentBlock[],
  streamingText: string,
  parseStreamingText: (text: string) => SDKContentBlock[]
): SDKContentBlock[] {
  return mergeStreamingContentIntoBlocks(blocks, { streamingText, parseStreamingText })
}

function getTrailingTextStartIndex(blocks: SDKContentBlock[]): number | null {
  const lastBlock = blocks[blocks.length - 1]
  if (lastBlock?.type !== 'text') return null

  let finalStartIndex = blocks.length - 1
  while (finalStartIndex > 0 && blocks[finalStartIndex - 1]?.type === 'text') {
    finalStartIndex -= 1
  }
  return finalStartIndex
}

function areToolsBeforeIndexCompleted(
  blocks: SDKContentBlock[],
  endIndex: number,
  completedToolResultIds: Set<string> | undefined
): boolean {
  if (!completedToolResultIds) return false

  let hasToolUse = false
  for (let index = 0; index < endIndex; index++) {
    const block = blocks[index]
    if (block?.type !== 'tool_use') continue
    hasToolUse = true
    const toolBlock = block as SDKToolUseBlock
    if (!completedToolResultIds.has(toolBlock.id)) return false
  }

  // 没有 tool_use 时不认为"工具已完成"——避免流式中只有 thinking + 尾部 text
  // 时把还可能变成中间过程的 text 提前外置。
  return hasToolUse
}

export function buildAssistantTurnRenderItems(
  blocks: SDKContentBlock[],
  options: BuildAssistantTurnRenderItemsOptions = {}
): AssistantTurnRenderItem[] {
  if (blocks.length === 0) return []

  // 流式阶段最后的 text 还不稳定，后续工具调用可能会把它变成中间过程。
  // 只有当前面所有工具都有结果时，才把尾部 text 视作交付输出提前外置，降低完成瞬间的跳动。
  const hasProcessBlock = blocks.some(
    (block) => block.type === 'tool_use' || block.type === 'thinking'
  )
  const trailingTextStartIndex = getTrailingTextStartIndex(blocks)
  const canSplitStreamingFinalOutput =
    options.isStreaming &&
    hasProcessBlock &&
    trailingTextStartIndex !== null &&
    trailingTextStartIndex > 0 &&
    areToolsBeforeIndexCompleted(blocks, trailingTextStartIndex, options.completedToolResultIds)

  if (options.isStreaming && hasProcessBlock && !canSplitStreamingFinalOutput) {
    return [
      {
        type: 'process-group',
        items: blocks.map((block, index) => ({ block, index })),
      },
    ]
  }

  if (trailingTextStartIndex === null) {
    return [
      {
        type: 'process-group',
        items: blocks.map((block, index) => ({ block, index })),
      },
    ]
  }

  const items: AssistantTurnRenderItem[] = []
  if (trailingTextStartIndex > 0) {
    items.push({
      type: 'process-group',
      items: blocks.slice(0, trailingTextStartIndex).map((block, index) => ({ block, index })),
    })
  }

  for (let index = trailingTextStartIndex; index < blocks.length; index++) {
    const block = blocks[index]
    if (!block) continue
    items.push({ type: 'block', item: { block, index } })
  }

  return items
}

function buildProcessGroupSummary(blocks: SDKContentBlock[]): string {
  let toolCount = 0
  let messageCount = 0

  for (const block of blocks) {
    if (block.type === 'tool_use') {
      toolCount += 1
    } else if (block.type === 'thinking' || block.type === 'text') {
      messageCount += 1
    }
  }

  const parts: string[] = []
  if (toolCount > 0) parts.push(`${toolCount} 次工具调用`)
  if (messageCount > 0) parts.push(`${messageCount} 条消息`)
  const summary = parts.join('，') || '过程'
  return `执行过程：${summary}`
}

export function buildProcessGroupToolNames(blocks: SDKContentBlock[]): string[] {
  const toolNames: string[] = []
  const seen = new Set<string>()

  for (const block of blocks) {
    if (block.type !== 'tool_use') continue
    const toolBlock = block as SDKToolUseBlock
    if (seen.has(toolBlock.name)) continue
    seen.add(toolBlock.name)
    toolNames.push(toolBlock.name)
  }

  return toolNames
}

export function ProcessBlockGroup({
  blocks,
  isStreaming,
  keepExpandedAfterComplete,
  children,
}: ProcessBlockGroupProps): React.ReactElement {
  const shouldExpandByDefault = !!isStreaming || keepExpandedAfterComplete
  const [expanded, setExpanded] = React.useState(shouldExpandByDefault)
  const [shouldRenderContent, setShouldRenderContent] = React.useState(shouldExpandByDefault)
  const [collapseCountdown, setCollapseCountdown] = React.useState<number | null>(null)
  const userToggledRef = React.useRef(false)
  const wasStreamingRef = React.useRef(!!isStreaming)
  const autoCollapseTimersRef = React.useRef<number[]>([])

  const clearAutoCollapseTimers = React.useCallback(() => {
    for (const timer of autoCollapseTimersRef.current) window.clearTimeout(timer)
    autoCollapseTimersRef.current = []
  }, [])

  React.useEffect(() => {
    clearAutoCollapseTimers()

    if (isStreaming || keepExpandedAfterComplete) {
      setCollapseCountdown(null)
      // 新一轮流式开始时复位用户手动 toggle 状态，使本轮完成后仍能走自动收起。
      if (isStreaming && !wasStreamingRef.current) {
        userToggledRef.current = false
      }
      if (!userToggledRef.current) {
        setExpanded(true)
      }
      wasStreamingRef.current = !!isStreaming
      return
    }

    const shouldAutoCollapseAfterCompletion = wasStreamingRef.current && !userToggledRef.current
    wasStreamingRef.current = false

    if (!shouldAutoCollapseAfterCompletion) {
      if (!userToggledRef.current) {
        setExpanded(false)
      }
      return
    }

    const soundDelayTimer = window.setTimeout(() => {
      setCollapseCountdown(PROCESS_GROUP_AUTO_COLLAPSE_COUNTDOWN_SECONDS)

      for (let second = PROCESS_GROUP_AUTO_COLLAPSE_COUNTDOWN_SECONDS - 1; second >= 1; second--) {
        const elapsed = (PROCESS_GROUP_AUTO_COLLAPSE_COUNTDOWN_SECONDS - second) * 1000
        autoCollapseTimersRef.current.push(
          window.setTimeout(() => setCollapseCountdown(second), elapsed)
        )
      }

      autoCollapseTimersRef.current.push(
        window.setTimeout(() => {
          setCollapseCountdown(null)
          setExpanded(false)
        }, PROCESS_GROUP_AUTO_COLLAPSE_COUNTDOWN_SECONDS * 1000)
      )
    }, PROCESS_GROUP_AUTO_COLLAPSE_SOUND_DELAY_MS)
    autoCollapseTimersRef.current.push(soundDelayTimer)

    return clearAutoCollapseTimers
  }, [clearAutoCollapseTimers, isStreaming, keepExpandedAfterComplete])

  React.useEffect(() => {
    if (expanded) {
      setShouldRenderContent(true)
      return
    }

    const timer = window.setTimeout(
      () => setShouldRenderContent(false),
      PROCESS_GROUP_COLLAPSE_DURATION_MS
    )
    return () => window.clearTimeout(timer)
  }, [expanded])

  const summary = React.useMemo(() => buildProcessGroupSummary(blocks), [blocks])
  const toolNames = React.useMemo(() => buildProcessGroupToolNames(blocks), [blocks])
  const visibleToolNames = toolNames.slice(0, MAX_PROCESS_GROUP_ICONS)
  const hiddenToolCount = Math.max(0, toolNames.length - visibleToolNames.length)

  return (
    <div className="agent-process-group">
      <button
        type="button"
        className={cn(
          'agent-process-group__toggle group flex w-full max-w-full items-center gap-2 text-left'
        )}
        onClick={() => {
          userToggledRef.current = true
          clearAutoCollapseTimers()
          setCollapseCountdown(null)
          setExpanded((prev) => !prev)
        }}
      >
        <SessionChevronRight
          className={cn(
            'size-3 shrink-0 text-muted-foreground/50 transition-transform duration-150',
            expanded && 'rotate-90'
          )}
        />
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-[12.5px] font-medium text-muted-foreground',
            isStreaming && 'agent-shiny-text'
          )}
        >
          {summary}
        </span>
        {collapseCountdown !== null && (
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/50">
            {collapseCountdown}s
          </span>
        )}
        {visibleToolNames.length > 0 && (
          <span className="flex shrink-0 items-center gap-1 text-muted-foreground/55">
            {visibleToolNames.map((toolName) => {
              const ToolIcon = getToolIcon(toolName)
              return (
                <ToolIcon
                  key={toolName}
                  className="size-3.5"
                  aria-label={getToolDisplayName(toolName)}
                />
              )
            })}
            {hiddenToolCount > 0 && (
              <span className="text-[11px] tabular-nums text-muted-foreground/55">
                +{hiddenToolCount}
              </span>
            )}
          </span>
        )}
      </button>

      {shouldRenderContent && (
        <div
          className="grid transition-[grid-template-rows,opacity] duration-700 ease-in-out"
          style={{
            gridTemplateRows: expanded ? '1fr' : '0fr',
            opacity: expanded ? 1 : 0,
          }}
        >
          <div className="agent-process-stack min-h-0 overflow-hidden space-y-1.5">
            {children}
            <button
              type="button"
              className="agent-process-group__collapse flex items-center gap-1 text-[11px] text-muted-foreground/50 transition-colors hover:text-muted-foreground"
              onClick={() => {
                userToggledRef.current = true
                clearAutoCollapseTimers()
                setCollapseCountdown(null)
                setExpanded(false)
              }}
            >
              <SessionChevronRight className="size-3 -rotate-90" />
              <span>收起</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
