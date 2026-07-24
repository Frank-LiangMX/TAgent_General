import type { AppMode, RailItem, RightRailItem, TopLevelMode } from '@/atoms/app-mode'
import type { TabType } from '@/atoms/tab-atoms'

export type ShellScene = 'standard' | 'focus' | 'canvas' | 'office'
export type PanelPresence = 'hidden' | 'collapsed' | 'open'
export type ComposerPlacement = 'default' | 'expanded' | 'dock'
export type CanvasPresentation = 'none' | 'immersive'
export type OfficePresentation = 'inactive' | 'loading' | 'ready'

export interface ShellLayoutInput {
  topLevelMode: TopLevelMode
  appMode: AppMode
  activeRailItem: RailItem
  activeTabType: TabType | null
  hasCurrentSession: boolean
  sidebarRequestedOpen: boolean
  rightPanelRequestedOpen: boolean
  rightRailItem: RightRailItem
  globalOfficeMode: boolean
  hasOfficeSession: boolean
  designEnabled: boolean
  designImmersive: boolean
}

export interface ShellLayout {
  scene: ShellScene
  navigation: PanelPresence
  sidebar: PanelPresence
  inspector: PanelPresence
  composer: ComposerPlacement
  canvas: CanvasPresentation
  office: OfficePresentation
}

export interface RailSelectionState {
  activeRailItem: RailItem
  sidebarOpen: boolean
}

const GENERAL_SIDEBAR_ITEMS = new Set<RailItem>(['sessions', 'skills', 'draft', 'kanban'])

/** 仅 rail + main 的功能页（不占左侧 sidebar） */
const GENERAL_RAIL_ONLY_ITEMS = new Set<RailItem>(['automation', 'memory', 'terminal'])

const TA_SIDEBAR_ITEMS = new Set<RailItem>([
  'sessions',
  'assets',
  'review',
  'pipeline',
  'config',
  'kanban',
])

/** TA 模式同样走 rail-only 的页 */
const TA_RAIL_ONLY_ITEMS = new Set<RailItem>(['memory'])

export function railItemSupportsSidebar(
  topLevelMode: TopLevelMode,
  activeRailItem: RailItem
): boolean {
  if (topLevelMode === 'general' && GENERAL_RAIL_ONLY_ITEMS.has(activeRailItem)) {
    return false
  }
  if (topLevelMode === 'ta' && TA_RAIL_ONLY_ITEMS.has(activeRailItem)) {
    return false
  }
  return topLevelMode === 'general'
    ? GENERAL_SIDEBAR_ITEMS.has(activeRailItem)
    : TA_SIDEBAR_ITEMS.has(activeRailItem)
}

/** 再次点击当前 Rail 项折叠 Sidebar；切换项目时展开并保留同一面板位置。 */
export function deriveRailSelection(
  current: RailSelectionState,
  nextRailItem: RailItem,
  topLevelMode: TopLevelMode = 'general'
): RailSelectionState {
  const supportsSidebar = railItemSupportsSidebar(topLevelMode, nextRailItem)

  if (current.activeRailItem === nextRailItem) {
    // rail-only 页没有 sidebar，再点不切换侧栏状态
    if (!supportsSidebar) {
      return { activeRailItem: nextRailItem, sidebarOpen: false }
    }
    return { activeRailItem: nextRailItem, sidebarOpen: !current.sidebarOpen }
  }

  return { activeRailItem: nextRailItem, sidebarOpen: supportsSidebar }
}

export function deriveShellLayout(input: ShellLayoutInput): ShellLayout {
  if (input.globalOfficeMode) {
    return {
      scene: 'office',
      navigation: 'hidden',
      sidebar: 'hidden',
      inspector: 'hidden',
      composer: 'dock',
      canvas: 'none',
      office: input.hasOfficeSession ? 'ready' : 'loading',
    }
  }

  const sidebar: PanelPresence =
    input.sidebarRequestedOpen && railItemSupportsSidebar(input.topLevelMode, input.activeRailItem)
      ? 'open'
      : 'collapsed'

  // 会话父标签及其 preview 附属标签共享同一会话上下文，
  // 因此切到预览标签后仍保留 RightRail / RightSidebar。
  const activeTabHasSessionContext =
    input.activeTabType === 'agent' || input.activeTabType === 'preview'
  const inspectorAvailable =
    input.appMode === 'agent' &&
    activeTabHasSessionContext &&
    input.hasCurrentSession &&
    input.activeRailItem === 'sessions'

  const inspector: PanelPresence = inspectorAvailable
    ? input.rightPanelRequestedOpen
      ? 'open'
      : 'collapsed'
    : 'hidden'

  if (input.designEnabled && input.designImmersive) {
    return {
      scene: 'canvas',
      navigation: 'hidden',
      sidebar: 'hidden',
      inspector: 'hidden',
      composer: 'dock',
      canvas: 'immersive',
      office: 'inactive',
    }
  }

  return {
    scene: sidebar !== 'open' && inspector !== 'open' ? 'focus' : 'standard',
    navigation: 'open',
    sidebar,
    inspector,
    composer: 'default',
    canvas: 'none',
    office: 'inactive',
  }
}
