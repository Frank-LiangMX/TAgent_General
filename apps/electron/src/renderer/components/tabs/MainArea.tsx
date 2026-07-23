/**
 * MainArea — 主内容区域
 *
 * 通用模式：组合 TabBar + TabContent，支持 Agent 模式下预览面板分屏
 * TA 模式：组合 TATabBar + TA 面板内容
 *
 * Agent 模式下若预览面板打开，则在同一个 Panel 内分屏：
 * 顶部一行：左侧 TabBar + 右侧预览顶栏（含文件名、复制按钮）
 * 主体：左侧 TabContent + 右侧预览内容
 */

import { useAtomValue, useSetAtom, useAtom } from 'jotai'
import * as React from 'react'

import { TabBar } from './TabBar'
import { TabContent } from './TabContent'
import { ContentWindowDragBand } from '@/components/app-shell/WindowDragStrip'

import { cn } from '@/lib/utils'

import {
  topLevelModeAtom,
  activeRailItemAtom,
  appModeAtom,
  type TARailItem,
} from '@/atoms/app-mode'
import { designImmersiveAtom } from '@/atoms/design-preview-atoms'
import {
  activeTabIdAtom,
  activeTabAtom,
  tabSwitchingAtom,
  tabsHydratedAtom,
  visibleSessionTabsAtom,
  visibleTabsAtom,
} from '@/atoms/tab-atoms'
import { SkillsMainView } from '@/components/agent/SkillsMainView'
import { AutomationMainView } from '@/components/automation/AutomationMainView'
import { Panel } from '@/components/app-shell/Panel'
import { KanbanMainView } from '@/components/kanban/KanbanMainView'
import { MemoryMonitorPanel } from '@/components/memory/MemoryMonitorPanel'
import { AssetLibraryPanel } from '@/components/ta/asset-library/AssetLibraryPanel'
import { TAConfigPanel } from '@/components/ta/config/TAConfigPanel'
import { PipelinePanel } from '@/components/ta/pipeline/PipelinePanel'
import { ReviewQueuePanel } from '@/components/ta/review/ReviewQueuePanel'
import { WelcomeView } from '@/components/welcome/WelcomeView'
import { useAppShellContext } from '@/contexts/AppShellContext'
import { useTrackSessionView } from '@/hooks/useTrackSessionView'

export function MainArea(): React.ReactElement {
  const topLevelMode = useAtomValue(topLevelModeAtom)
  const activeRailItem = useAtomValue(activeRailItemAtom)
  const setAppMode = useSetAtom(appModeAtom)
  const setTabSwitching = useSetAtom(tabSwitchingAtom)

  // 切换左侧 rail 时清掉 tab 切换蒙版，避免切回会话页时白屏遮罩残留
  React.useLayoutEffect(() => {
    setTabSwitching(false)
  }, [activeRailItem, setTabSwitching])

  // TA 模式 + 选中「会话」时，强制 appMode='agent' 让 TabContent 走 agent 渲染分支
  React.useEffect(() => {
    if (topLevelMode === 'ta' && activeRailItem === 'sessions') {
      setAppMode('agent')
    }
  }, [topLevelMode, activeRailItem, setAppMode])

  // 渲染当前 rail 对应的主区内容（不含淡入容器）
  const renderRailContent = (): React.ReactElement => {
    // TA 模式 + 选中「会话」→ 与通用模式完全一致的布局
    if (topLevelMode === 'ta' && activeRailItem === 'sessions') {
      return <GeneralMainArea />
    }

    // TA 模式其他模块（资产/审核/流水线/记忆/配置）使用独立渲染逻辑
    if (topLevelMode === 'ta') {
      return <TAMainArea />
    }

    if (activeRailItem === 'skills') {
      return <SkillsMainView />
    }

    if (activeRailItem === 'automation') {
      return <AutomationMainView />
    }

    if (activeRailItem === 'kanban') {
      return <KanbanMainView />
    }

    if (activeRailItem === 'memory') {
      return <MemoryMonitorPanel />
    }

    // 草稿是跨模式常驻入口，统一走通用 Tab 主区渲染
    return <GeneralMainArea />
  }

  // rail 切换时整体淡入（key 变化触发重挂）；会话页不做 fade-in，避免切回时整页发白
  return (
    <div
      key={`${topLevelMode}:${activeRailItem}`}
      className={cn(
        'h-full min-h-0',
        activeRailItem !== 'sessions' && 'animate-in fade-in duration-300'
      )}
    >
      {renderRailContent()}
    </div>
  )
}

/**
 * TA 模式主内容区域（仅处理 5 个模块面板；『会话』走 GeneralMainArea）
 */
function TAMainArea(): React.ReactElement {
  const activeTab = useAtomValue(activeRailItemAtom) as TARailItem

  const renderContent = () => {
    switch (activeTab) {
      case 'assets':
        return <AssetLibraryPanel />
      case 'review':
        return <ReviewQueuePanel />
      case 'pipeline':
        return <PipelinePanel />
      case 'memory':
        return <MemoryMonitorPanel />
      case 'config':
        return <TAConfigPanel />
      default:
        return <AssetLibraryPanel />
    }
  }

  return (
    <Panel variant="grow" className="app-main-layout">
      <div className="flex-1 min-h-0 overflow-hidden">{renderContent()}</div>
    </Panel>
  )
}

/**
 * 通用模式主内容区域
 */
function GeneralMainArea(): React.ReactElement {
  // 记录每个会话上次停留的视图（对话 / 预览），供切回时重建预览 Tab
  useTrackSessionView()

  const { shellChromeCollapsed = false } = useAppShellContext()

  const tabs = useAtomValue(visibleTabsAtom)
  const sessionTabs = useAtomValue(visibleSessionTabsAtom)
  const tabsHydrated = useAtomValue(tabsHydratedAtom)
  const activeTabId = useAtomValue(activeTabIdAtom)
  const setActiveTabId = useSetAtom(activeTabIdAtom)
  const activeTab = useAtomValue(activeTabAtom)
  const appMode = useAtomValue(appModeAtom)
  const activeRailItem = useAtomValue(activeRailItemAtom)

  // Skills rail → 主区域显示能力详情/空态，由详情视图内部决定是否有选中项

  // Tab 内容渲染降级为非紧急：TabBar 立即高亮新 tab，主区域昂贵渲染（含 PreviewPanel 中
  // DiffTabContent → ProseMirror editor mount + Shiki tokenize）让出主线程，避免点击 tab
  // 后必须等主区域渲染完才能看到 tab 切换效果
  const contentTabId = activeTab?.id ?? null
  const deferredActiveTabId = React.useDeferredValue(contentTabId)

  // 会话切换蒙版：TabBar 点击瞬间同步设 tabSwitchingAtom=true（赶在 React 首次重渲染前），
  // 这里订阅它显示蒙版；deferredActiveTabId 追上后设 false（新内容渲染完，蒙版淡出）。
  // 强制蒙版至少显示 300ms，避免会话渲染太快时蒙版一闪而过用户感知不到"加载中"。
  const [switching, setSwitching] = useAtom(tabSwitchingAtom)

  // 挂载/卸载时强制清蒙版，避免从其他 rail 切回会话页时白屏遮罩残留
  React.useLayoutEffect(() => {
    setSwitching(false)
    return () => setSwitching(false)
  }, [setSwitching])

  const switchingSinceRef = React.useRef<number>(0)
  React.useEffect(() => {
    if (switching) {
      switchingSinceRef.current = Date.now()
      return
    }
  }, [switching])
  React.useEffect(() => {
    if (!switching) return
    if (contentTabId !== deferredActiveTabId) return
    // 内容已渲染完，但确保蒙版至少显示 300ms
    const elapsed = Date.now() - switchingSinceRef.current
    const minDuration = 300
    if (elapsed >= minDuration) {
      setSwitching(false)
    } else {
      const timer = setTimeout(() => setSwitching(false), minDuration - elapsed)
      return () => clearTimeout(timer)
    }
  }, [switching, contentTabId, deferredActiveTabId, setSwitching])

  const designImmersive = useAtomValue(designImmersiveAtom)

  // 启动恢复完成前不算「无会话」，避免 Welcome 引导页闪现
  const showSessionWelcome = tabsHydrated && appMode !== 'draft' && sessionTabs.length === 0
  const showWelcomeShell = showSessionWelcome || (tabsHydrated && tabs.length === 0)

  React.useEffect(() => {
    if (showSessionWelcome) return
    if (tabs.length > 0 && (!activeTabId || !activeTab)) {
      setActiveTabId(tabs[0]!.id)
    }
  }, [showSessionWelcome, tabs, activeTabId, activeTab, setActiveTabId])

  return (
    <Panel variant="grow" className="app-main-layout">
      <div className="flex flex-1 min-h-0 relative">
        <div className="flex flex-col min-w-0 h-full relative flex-1">
          {!showWelcomeShell &&
            !designImmersive &&
            (shellChromeCollapsed ? <ContentWindowDragBand /> : <TabBar />)}
          <div className="content-main-body flex flex-col min-w-0 min-h-0 flex-1 relative">
            {!tabsHydrated ? (
              <>
                <ContentWindowDragBand />
                <div className="flex-1 min-h-0" aria-hidden />
              </>
            ) : showWelcomeShell ? (
              <>
                <ContentWindowDragBand />
                <WelcomeView />
              </>
            ) : deferredActiveTabId ? (
              <div className="flex-1 min-h-0 titlebar-no-drag">
                <TabContent tabId={deferredActiveTabId} />
              </div>
            ) : null}

            {/* 会话切换蒙版：盖住内容区，淡入淡出不阻塞主线程渲染 */}
            <div
              aria-hidden
              className={cn(
                'pointer-events-none absolute inset-0 z-[50] flex items-center justify-center',
                'bg-background/60 backdrop-blur-[2px] transition-opacity duration-200',
                switching ? 'opacity-100' : 'opacity-0'
              )}
            >
              <div className="size-5 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground/60" />
            </div>
          </div>
        </div>
      </div>
    </Panel>
  )
}
