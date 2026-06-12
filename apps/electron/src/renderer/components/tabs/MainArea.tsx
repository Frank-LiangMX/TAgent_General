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

import {
  topLevelModeAtom,
  activeRailItemAtom,
  appModeAtom,
  selectedCapabilityAtom,
  type TARailItem,
} from '@/atoms/app-mode'
import {
  workspaceSelectedDirectoryAtom,
  workspaceSelectedFileAtom,
} from '@/atoms/workspace-explorer'
import { previewPanelOpenMapAtom, previewSplitRatioAtom } from '@/atoms/preview-atoms'
import {
  activeTabIdAtom,
  activeTabAtom,
  visibleSessionTabsAtom,
  visibleTabsAtom,
} from '@/atoms/tab-atoms'
import { WorkspaceFilesMainView } from '@/components/agent/WorkspaceFilesMainView'
import { SkillsMainView } from '@/components/agent/SkillsMainView'
import { Panel } from '@/components/app-shell/Panel'
import { PreviewPanel } from '@/components/diff/PreviewPanel'
import { MemoryMonitorPanel } from '@/components/memory/MemoryMonitorPanel'
import { AssetLibraryPanel } from '@/components/ta/asset-library/AssetLibraryPanel'
import { TAConfigPanel } from '@/components/ta/config/TAConfigPanel'
import { PipelinePanel } from '@/components/ta/pipeline/PipelinePanel'
import { ReviewQueuePanel } from '@/components/ta/review/ReviewQueuePanel'
import { WelcomeView } from '@/components/welcome/WelcomeView'
import { useTrackSessionView } from '@/hooks/useTrackSessionView'



export function MainArea(): React.ReactElement {
  const topLevelMode = useAtomValue(topLevelModeAtom)
  const activeRailItem = useAtomValue(activeRailItemAtom)
  const setAppMode = useSetAtom(appModeAtom)
  const setSelectedCapability = useSetAtom(selectedCapabilityAtom)
  const setSelectedFile = useSetAtom(workspaceSelectedFileAtom)
  const setSelectedDirectory = useSetAtom(workspaceSelectedDirectoryAtom)

  // TA 模式 + 选中「会话」时，强制 appMode='agent' 让 TabContent 走 agent 渲染分支
  React.useEffect(() => {
    if (topLevelMode === 'ta' && activeRailItem === 'sessions') {
      setAppMode('agent')
    }
  }, [topLevelMode, activeRailItem, setAppMode])

  // 离开 skills 功能区时清除选中
  React.useEffect(() => {
    if (activeRailItem !== 'skills') {
      setSelectedCapability(null)
    }
  }, [activeRailItem, setSelectedCapability])

  // 离开 files 功能区时清除文件检视选中
  React.useEffect(() => {
    if (activeRailItem !== 'files') {
      setSelectedFile(null)
      setSelectedDirectory(null)
    }
  }, [activeRailItem, setSelectedFile, setSelectedDirectory])

  // TA 模式 + 选中「会话」→ 与通用模式完全一致的布局
  if (topLevelMode === 'ta' && activeRailItem === 'sessions') {
    return <GeneralMainArea />
  }

  // TA 模式其他模块（资产/审核/流水线/记忆/配置）使用独立渲染逻辑
  if (topLevelMode === 'ta') {
    return <TAMainArea />
  }

  if (activeRailItem === 'files') {
    return <WorkspaceFilesMainView />
  }

  if (activeRailItem === 'skills') {
    return <SkillsMainView />
  }

  // 通用模式使用原有逻辑
  return <GeneralMainArea />
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
    <Panel
      variant="grow"
      className="content-glass"
    >
      <div className="flex-1 min-h-0 overflow-hidden">
        {renderContent()}
      </div>
    </Panel>
  )
}

/**
 * 通用模式主内容区域
 */
function GeneralMainArea(): React.ReactElement {
  // 记录每个会话上次停留的视图（对话 / 预览），供切回时重建预览 Tab
  useTrackSessionView()

  const tabs = useAtomValue(visibleTabsAtom)
  const sessionTabs = useAtomValue(visibleSessionTabsAtom)
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

  const previewOpenMap = useAtomValue(previewPanelOpenMapAtom)
  const [splitRatio, setSplitRatio] = useAtom(previewSplitRatioAtom)
  const previewDragging = React.useRef(false)

  const previewOpen =
    activeTab?.type === 'agent' && (previewOpenMap.get(activeTab.sessionId) ?? false)
  const previewSessionId = activeTab?.type === 'agent' ? activeTab.sessionId : null
  const showSessionWelcome = appMode !== 'scratch' && sessionTabs.length === 0

  // 关闭动画状态：当 previewOpen 从 true → false 时，播放退出动画再移除 DOM
  // 在 render 阶段同步派生 closing，避免中间帧出现 flex: 1 1 auto 导致左侧瞬间跳到 100% 宽
  // （flex-basis: auto 与 calc() 之间无法插值，transition 不生效，视觉上会被解读为"重新渲染"）
  const [closingState, setClosingState] = React.useState(false)
  const prevPreviewStateRef = React.useRef({ open: previewOpen, sessionId: previewSessionId })

  let closing = closingState
  const prev = prevPreviewStateRef.current
  if (prev.open && !previewOpen && prev.sessionId === previewSessionId) {
    closing = true
  }
  if (previewOpen || prev.sessionId !== previewSessionId) {
    closing = false
  }
  if (closing !== closingState) {
    setClosingState(closing)
  }

  React.useEffect(() => {
    prevPreviewStateRef.current = { open: previewOpen, sessionId: previewSessionId }
  }, [previewOpen, previewSessionId])

  const showPreview = (previewOpen || closing) && previewSessionId

  const handlePreviewDragStart = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    previewDragging.current = true
    const startX = e.clientX
    const startRatio = splitRatio
    const containerEl = (e.currentTarget as HTMLElement).closest('[data-split-container]') as HTMLElement | null
    const containerWidth = containerEl?.clientWidth ?? 1
    let rafId = 0

    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    document.querySelectorAll('iframe').forEach((f) => { (f as HTMLElement).style.pointerEvents = 'none' })

    const onMouseMove = (ev: MouseEvent) => {
      if (!previewDragging.current) return
      if (rafId) return
      rafId = requestAnimationFrame(() => {
        rafId = 0
        const delta = ev.clientX - startX
        const newRatio = Math.max(0.3, Math.min(0.8, startRatio + delta / containerWidth))
        setSplitRatio(newRatio)
      })
    }
    const onMouseUp = () => {
      previewDragging.current = false
      if (rafId) cancelAnimationFrame(rafId)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      document.querySelectorAll('iframe').forEach((f) => { (f as HTMLElement).style.pointerEvents = '' })
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [splitRatio, setSplitRatio])

  React.useEffect(() => {
    if (showSessionWelcome) return
    if (tabs.length > 0 && (!activeTabId || !activeTab)) {
      setActiveTabId(tabs[0]!.id)
    }
  }, [showSessionWelcome, tabs, activeTabId, activeTab, setActiveTabId])

  // 关闭动画期间右侧面板的定位样式（脱离 flex 流，保持原宽度，translateX 向右滑出）
  const closingOverlayStyle: React.CSSProperties | undefined = closing
    ? {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: `${splitRatio * 100}%`,
        width: `${(1 - splitRatio) * 100}%`,
        zIndex: 1,
        display: 'flex',
        pointerEvents: 'none',
      }
    : undefined

  // 左侧容器宽度：预览打开时固定占 splitRatio；其他情况（含 closing 动画期间）
  // 直接 1 1 auto 占满——closing 时右侧 absolute 脱离 flex 流，所以左侧自然占 100%。
  const leftFlexStyle: React.CSSProperties = (previewOpen && previewSessionId)
    ? { flex: `0 0 calc(${splitRatio * 100}% - 4px)` }
    : { flex: '1 1 auto' }

  return (
    <Panel
      variant="grow"
      className="content-glass"
    >
      <div className="flex flex-1 min-h-0 relative overflow-hidden" data-split-container>
        {/* 左侧：TabBar + TabContent（始终保持在同一 DOM 位置，避免 Tab 切换时 unmount）
            注：宽度变化不用 transition——文字逐帧 reflow 会导致行末字符抖动，
            视觉上像"内容从右向左推送"。让左侧瞬间变宽，由右侧 absolute 滑出动画
            覆盖期内呈现"被剥离"的视觉效果。 */}
        <div
          className="flex flex-col min-w-0 h-full"
          style={leftFlexStyle}
        >
          {!showSessionWelcome && <TabBar />}
          {showSessionWelcome || tabs.length === 0 ? (
            <WelcomeView />
          ) : deferredActiveTabId ? (
            <div className="flex-1 min-h-0 titlebar-no-drag">
              <TabContent tabId={deferredActiveTabId} />
            </div>
          ) : null}
        </div>

        {/* 右侧：预览面板。关闭动画期间脱离 flex 流，向右滑出 */}
        {showPreview && (
          <div
            className={closing ? 'animate-preview-slide-out' : 'flex flex-1 min-w-0'}
            style={closingOverlayStyle}
            onAnimationEnd={(e) => {
              if (closing && e.target === e.currentTarget) setClosingState(false)
            }}
          >
            {!closing && (
              <div
                className="w-[8px] cursor-col-resize bg-border/40 hover:bg-primary/30 active:bg-primary/50 transition-colors flex-shrink-0 self-stretch"
                onMouseDown={handlePreviewDragStart}
              />
            )}
            <div className="flex-1 min-w-0 h-full overflow-hidden">
              <PreviewPanel sessionId={previewSessionId} />
            </div>
          </div>
        )}
      </div>
    </Panel>
  )
}
