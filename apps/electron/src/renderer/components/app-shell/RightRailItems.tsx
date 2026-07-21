/**
 * RightRailItems — 右侧上下文入口按钮组
 *
 * 折叠态：竖向图标列（胶囊内）
 * 展开态：顶栏 tabs（inspector 顶部，对齐 layout-direction-study）
 */

import { useAtom, useAtomValue, useSetAtom, useStore } from 'jotai'
import {
  FolderOpen,
  Maximize2,
  MessageCircle,
  Globe2,
  Palette,
  Users,
  type LucideIcon,
} from 'lucide-react'
import * as React from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@tagent/ui'
import {
  agentDiffUnseenChangesAtom,
  agentDiffUnseenFilesAtom,
  agentSidePanelOpenAtom,
  currentAgentSessionIdAtom,
} from '@/atoms/agent-atoms'
import { btwChannelIdAtom, btwModelIdAtom, btwSourceSessionIdAtom } from '@/atoms/btw-atoms'
import { channelsAtom } from '@/atoms/model-atoms'
import { rightRailItemAtom, type RightRailItem } from '@/atoms/app-mode'
import { topLevelModeAtom } from '@/atoms/app-mode'
import {
  activeTabIdAtom,
  createRailTabId,
  openTab,
  promotedRailItemsBySessionAtom,
  syncedTabsAtom,
  tabsAtom,
} from '@/atoms/tab-atoms'
import { useSyncActiveTabSideEffects } from '@/hooks/useSyncActiveTabSideEffects'
import { flyRailGhost } from '@/lib/rail-tab-flight'
import { sessionCrewBoardIdAtomFamily, useKanbanBoardById } from '@/atoms/kanban-atoms'
import { useAgentSessionChannelModel } from '@/hooks/useAgentSessionChannelModel'
import { registerShortcut } from '@/lib/shortcut-registry'
import { cn } from '@/lib/utils'

export type RightRailOrientation = 'vertical' | 'tabs'

interface RightRailItemsProps {
  /** 面板当前是否展开（控制 active 高亮） */
  panelOpen: boolean
  orientation?: RightRailOrientation
  className?: string
}

interface RailEntry {
  id: RightRailItem
  label: string
  description?: string
  icon: LucideIcon
  visible: boolean
  onClick: () => void
  ariaLabel?: string
  badge?: React.ReactNode
}

export function RightRailItems({
  panelOpen,
  orientation = 'vertical',
  className,
}: RightRailItemsProps): React.ReactElement {
  const currentSessionId = useAtomValue(currentAgentSessionIdAtom)
  const setPanelOpen = useSetAtom(agentSidePanelOpenAtom)
  const unseenChangesMap = useAtomValue(agentDiffUnseenChangesAtom)
  const unseenFilesMap = useAtomValue(agentDiffUnseenFilesAtom)

  const unseenChanges = currentSessionId ? (unseenChangesMap.get(currentSessionId) ?? false) : false
  const unseenFilesCount = currentSessionId ? (unseenFilesMap.get(currentSessionId)?.size ?? 0) : 0
  const showBadge = !panelOpen && (unseenChanges || unseenFilesCount > 0)

  const [rightRailItem, setRightRailItem] = useAtom(rightRailItemAtom)
  const setBtwChannelId = useSetAtom(btwChannelIdAtom)
  const setBtwModelId = useSetAtom(btwModelIdAtom)
  const setBtwSourceSessionId = useSetAtom(btwSourceSessionIdAtom)
  const channels = useAtomValue(channelsAtom)

  const { channelId, modelId } = useAgentSessionChannelModel(currentSessionId ?? '')

  const crewBoardId = useAtomValue(sessionCrewBoardIdAtomFamily(currentSessionId ?? ''))
  const { tasks: crewTasks } = useKanbanBoardById(crewBoardId)
  const crewSummary = React.useMemo(() => {
    const total = crewTasks.length
    const done = crewTasks.filter((t) => t.status === 'done').length
    const running = crewTasks.filter((t) => t.status === 'running').length
    const blocked = crewTasks.filter((t) => t.status === 'blocked').length
    return { total, done, running, blocked }
  }, [crewTasks])
  const isCrewActive = panelOpen && rightRailItem === 'crew'
  const showCrewCount = !!crewBoardId && !isCrewActive && crewSummary.total > 0
  const crewBusy = crewSummary.running > 0 || crewSummary.blocked > 0
  const crewAriaLabel = showCrewCount
    ? `班组 ${crewSummary.done}/${crewSummary.total}${crewSummary.running > 0 ? `，运行中 ${crewSummary.running}` : ''}${crewSummary.blocked > 0 ? `，受阻 ${crewSummary.blocked}` : ''}`
    : '班组'

  const hasChannel = React.useMemo(() => {
    if (!channelId) return false
    const ch = channels.find((c) => c.id === channelId)
    return ch?.enabled && ch.models.some((m) => m.enabled)
  }, [channels, channelId])

  const store = useStore()
  const syncSideEffects = useSyncActiveTabSideEffects()

  const activateOrCollapse = React.useCallback(
    (item: RightRailItem, prepare?: () => void) => {
      // 已晋升为主区标签的项（快捷键等入口仍可触达）：聚焦对应标签页而不是开侧栏，
      // 避免同一内容（尤其 webview）双实例
      const promoted = currentSessionId
        ? store.get(promotedRailItemsBySessionAtom).get(currentSessionId)
        : undefined
      if (currentSessionId && promoted?.has(item)) {
        const railTabId = createRailTabId(currentSessionId, item)
        store.set(activeTabIdAtom, railTabId)
        syncSideEffects(store.get(syncedTabsAtom).find((t) => t.id === railTabId) ?? null)
        return
      }
      if (panelOpen && rightRailItem === item) {
        setPanelOpen(false)
        return
      }
      prepare?.()
      setRightRailItem(item)
      setPanelOpen(true)
    },
    [
      currentSessionId,
      panelOpen,
      rightRailItem,
      setPanelOpen,
      setRightRailItem,
      store,
      syncSideEffects,
    ]
  )

  const toggleFiles = React.useCallback(() => {
    activateOrCollapse('files')
  }, [activateOrCollapse])

  React.useEffect(() => {
    return registerShortcut('toggle-right-panel', toggleFiles)
  }, [toggleFiles])

  const entries: RailEntry[] = [
    {
      id: 'files',
      label: '文件',
      description: '项目文件面板',
      icon: FolderOpen,
      visible: true,
      onClick: toggleFiles,
      ariaLabel: '文件面板',
      badge: showBadge ? (
        <span className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-primary ring-1 ring-background" />
      ) : null,
    },
    {
      id: 'btw',
      label: '旁注',
      description: '快速提问，不进入主对话历史',
      icon: MessageCircle,
      visible: Boolean(hasChannel),
      onClick: () =>
        activateOrCollapse('btw', () => {
          if (channelId) setBtwChannelId(channelId)
          if (modelId) setBtwModelId(modelId)
          if (currentSessionId) setBtwSourceSessionId(currentSessionId)
        }),
    },
    {
      id: 'browser',
      label: '预览',
      description: '预览 WPS 文档或网页',
      icon: Globe2,
      visible: true,
      onClick: () => activateOrCollapse('browser'),
      ariaLabel: '浏览器预览',
    },
    {
      id: 'design',
      label: '设计',
      description: 'AI 生成 UI 原型的即时预览',
      icon: Palette,
      visible: true,
      onClick: () => activateOrCollapse('design'),
      ariaLabel: 'Design Preview',
    },
    {
      id: 'crew',
      label: '班组',
      description: showCrewCount
        ? `进度 ${crewSummary.done}/${crewSummary.total}${crewSummary.running > 0 ? ` · 运行 ${crewSummary.running}` : ''}${crewSummary.blocked > 0 ? ` · 受阻 ${crewSummary.blocked}` : ''}`
        : '本会话数字员工与派活进度',
      icon: Users,
      visible: true,
      onClick: () => activateOrCollapse('crew'),
      ariaLabel: crewAriaLabel,
      badge: showCrewCount ? (
        <span
          className={cn(
            'absolute -right-1 -top-1 z-[3] min-w-[18px] rounded-full px-0.5 text-center text-[8px] font-semibold leading-[12px] tabular-nums ring-1 ring-background',
            crewBusy ? 'bg-amber-500 text-white' : 'bg-primary text-primary-foreground'
          )}
        >
          {crewSummary.done}/{crewSummary.total}
        </span>
      ) : null,
    },
  ]

  // 已晋升为主区标签的项从 rail / tabs 隐藏，关掉对应标签页后回归
  const promotedBySession = useAtomValue(promotedRailItemsBySessionAtom)
  const promotedItems = currentSessionId
    ? (promotedBySession.get(currentSessionId) ?? new Set<RightRailItem>())
    : new Set<RightRailItem>()
  const visibleEntries = entries.filter((entry) => entry.visible && !promotedItems.has(entry.id))
  const isTabs = orientation === 'tabs'
  const tooltipSide = isTabs ? 'bottom' : 'left'
  const topLevelMode = useAtomValue(topLevelModeAtom)

  /**
   * 把某个分页晋升为主区标签页（全屏模式）。
   * 只动被晋升的分页：侧栏保持打开并切到下一个可用分页；没有剩余分页才收起。
   */
  const promoteToTab = (entry: RailEntry, sourceEl: HTMLElement): void => {
    if (!currentSessionId) return
    // ghost 起点：晋升的是当前正在显示的分页 → 整个检查器面板；否则用分页按钮自身
    const frameEl = sourceEl.closest<HTMLElement>('.app-inspector-frame')
    const fromEl = panelOpen && rightRailItem === entry.id && frameEl ? frameEl : sourceEl
    const fromRect = fromEl.getBoundingClientRect()

    const result = openTab(store.get(tabsAtom), {
      type: 'rail',
      sessionId: currentSessionId,
      title: entry.label,
      railItem: entry.id,
      mode: topLevelMode,
    })
    store.set(tabsAtom, result.tabs)
    store.set(activeTabIdAtom, result.activeTabId)
    syncSideEffects(result.tabs.find((t) => t.id === result.activeTabId) ?? null)

    // 被晋升的正是当前显示的分页：切到下一个未晋升分页，侧栏其他页照常可用
    if (rightRailItem === entry.id) {
      const remaining = visibleEntries.find((e) => e.id !== entry.id)
      if (remaining) {
        setRightRailItem(remaining.id)
      } else {
        setPanelOpen(false)
      }
    }

    const railTabId = createRailTabId(currentSessionId, entry.id)
    flyRailGhost(fromRect, () =>
      document.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(railTabId)}"]`)
    )
  }

  return (
    <div
      className={cn(
        isTabs
          ? 'app-inspector-tabs'
          : 'rail-slide-host relative flex w-full flex-col items-center gap-1',
        className
      )}
      role={isTabs ? 'tablist' : undefined}
      aria-label={isTabs ? '检查器功能' : undefined}
    >
      {visibleEntries.map((entry) => {
        const Icon = entry.icon
        const active = panelOpen && rightRailItem === entry.id
        const title =
          entry.id === 'files' ? '文件面板' : entry.id === 'design' ? 'Design Preview' : entry.label

        const tabButton = (
          <Tooltip key={isTabs ? undefined : entry.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                role={isTabs ? 'tab' : undefined}
                aria-selected={isTabs ? active : undefined}
                aria-pressed={!isTabs ? active : undefined}
                aria-label={entry.ariaLabel ?? entry.label}
                data-rail-item={entry.id}
                onClick={entry.onClick}
                className={cn(
                  isTabs
                    ? 'app-inspector-tab titlebar-no-drag relative'
                    : 'rail-island-btn right-rail-btn relative z-[2] flex size-8 items-center justify-center titlebar-no-drag',
                  active && (isTabs ? 'app-inspector-tab--active' : 'rail-island-btn--active')
                )}
              >
                <Icon size={isTabs ? 15 : 14} strokeWidth={1.75} aria-hidden />
                {isTabs ? <span className="sr-only">{entry.label}</span> : null}
                {entry.badge}
              </button>
            </TooltipTrigger>
            <TooltipContent side={tooltipSide}>
              <div className="text-xs">
                <div className="font-medium">{title}</div>
                {entry.description && entry.id !== 'files' ? (
                  <div className="text-muted-foreground">{entry.description}</div>
                ) : null}
              </div>
            </TooltipContent>
          </Tooltip>
        )

        if (!isTabs) return tabButton

        // tabs 形态：每个分页外包一层，hover 浮出「转为主区标签页」小按钮
        return (
          <div key={entry.id} className="app-inspector-tab-wrap relative min-w-0 flex-1">
            {tabButton}
            <button
              type="button"
              className="app-inspector-tab-promote titlebar-no-drag"
              aria-label={`${entry.label}：转为主区标签页`}
              title="转为主区标签页"
              onClick={(e) => {
                e.stopPropagation()
                promoteToTab(entry, e.currentTarget)
              }}
            >
              <Maximize2 size={8} strokeWidth={2.25} aria-hidden />
            </button>
          </div>
        )
      })}
    </div>
  )
}
