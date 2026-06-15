/**
 * SettingsPanel - 设置面板
 *
 * 与主界面同源：复用 nav-island-glass 浮岛范式
 * - 同主题 token（hsl(var(--background)) / var(--foreground)）
 * - 同圆角、阴影、1px 弱边
 * - 左导航 + 右内容，两块浮岛并排
 *
 * 布局：
 * ┌─────────────┬─────────────────────┐
 * │ Settings    │ TabBar / Header     │
 * │  Rail+List  │  (与主区同壳)        │
 * │  (浮岛 1)   │  (浮岛 2)            │
 * └─────────────┴─────────────────────┘
 */

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  Settings,
  Radio,
  Palette,
  Info,
  Globe,
  BookOpen,
  Bot,
  X,
  Keyboard,
  Mic,
  BarChart3,
  Sparkles,
} from "lucide-react";
import * as React from "react";

import { AboutSettings } from "./AboutSettings";
import { AppearanceSettings } from "./AppearanceSettings";
import { BotHubSettings } from "./BotHubSettings";
import { ChannelSettings } from "./ChannelSettings";
import { GeneralSettings } from "./GeneralSettings";
import { InsightsSettings } from "./InsightsSettings";
import { PromptSettings } from "./PromptSettings";
import { ProxySettings } from "./ProxySettings";
import { SettingsSearch } from "./SettingsSearch";
import { ShortcutSettings } from "./ShortcutSettings";
import { SoulSettings } from "./SoulSettings";
import { VoiceInputSettings } from "./VoiceInputSettings";

import type { SettingsTab } from "@/atoms/settings-tab";

import { hasEnvironmentIssuesAtom } from "@/atoms/environment";
import { settingsTabAtom, channelFormDirtyAtom, settingsCloseRequestedAtom } from "@/atoms/settings-tab";
import { hasUpdateAtom } from "@/atoms/updater";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LIST_SLIDE_HOST_CLASS,
  LIST_SLIDE_INDICATOR_CLASS,
  LIST_SLIDE_INDICATOR_EXIT_CLASS,
  LIST_SLIDE_ITEM_GHOST_CLASS,
  LIST_SLIDE_ITEM_SELECTED_CLASS,
  LIST_SLIDE_TRANSITION,
} from "@/lib/list-slide-selection";
import { cn } from "@/lib/utils";

/** 设置 Tab 定义 */
interface TabItem {
  id: SettingsTab;
  label: string;
  icon: React.ReactNode;
  group: 'core' | 'integration' | 'advanced';
}

const TAB_GROUPS: Array<{ key: TabItem['group']; label: string }> = [
  { key: 'core', label: '核心' },
  { key: 'integration', label: '集成' },
  { key: 'advanced', label: '高级' },
]

const ALL_TABS: TabItem[] = [
  { id: "general", label: "通用", icon: <Settings size={15} />, group: 'core' },
  { id: "channels", label: "AI 渠道", icon: <Radio size={15} />, group: 'core' },
  { id: "prompts", label: "提示词", icon: <BookOpen size={15} />, group: 'core' },
  { id: "soul", label: "人格", icon: <Sparkles size={15} />, group: 'core' },
  { id: "bots", label: "远程", icon: <Bot size={15} />, group: 'integration' },
  { id: "voice-input", label: "语音", icon: <Mic size={15} />, group: 'integration' },
  { id: "proxy", label: "代理", icon: <Globe size={15} />, group: 'integration' },
  { id: "shortcuts", label: "快捷键", icon: <Keyboard size={15} />, group: 'advanced' },
  { id: "insights", label: "数据", icon: <BarChart3 size={15} />, group: 'advanced' },
  { id: "appearance", label: "外观", icon: <Palette size={15} />, group: 'advanced' },
  { id: "about", label: "关于", icon: <Info size={15} />, group: 'advanced' },
]

function renderTabContent(tab: SettingsTab): React.ReactElement {
  switch (tab) {
    case "general": return <GeneralSettings />;
    case "channels": return <ChannelSettings />;
    case "prompts": return <PromptSettings />;
    case "soul": return <SoulSettings />;
    case "proxy": return <ProxySettings />;
    case "appearance": return <AppearanceSettings />;
    case "about": return <AboutSettings />;
    case "bots": return <BotHubSettings />;
    case "shortcuts": return <ShortcutSettings />;
    case "voice-input": return <VoiceInputSettings />;
    case "insights": return <InsightsSettings />;
  }
}

function getTabGroup(tabId: SettingsTab): TabItem['group'] | null {
  return ALL_TABS.find((tab) => tab.id === tabId)?.group ?? null
}

// ============================================================
// TabGroup：组内指示器（淡入/滑动）+ 跨组离开时淡出
// ============================================================

const FADE_OUT_MS = 480;
const FADE_IN_TRANSITION = 'opacity 0.5s ease-out, transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)';
const FADE_OUT_TRANSITION = 'opacity 0.45s ease-out';

interface TabGroupProps {
  groupLabel: string;
  tabs: TabItem[];
  activeTab: SettingsTab;
  /** 同组 slide，跨组 fade，首屏/无切换 idle */
  indicatorMotion: 'slide' | 'fade' | 'idle';
  /** 跨组切换当帧传入正在离开的 tab，由本组播放淡出 */
  exitTabId: SettingsTab | null;
  onTabChange: (tabId: SettingsTab) => void;
  hasUpdate: boolean;
  hasEnvironmentIssues: boolean;
}

function measureButtonInContainer(
  container: HTMLElement,
  button: HTMLButtonElement,
): React.CSSProperties {
  const containerRect = container.getBoundingClientRect();
  const buttonRect = button.getBoundingClientRect();

  return {
    display: 'block',
    position: 'absolute',
    left: 0,
    width: buttonRect.width,
    height: buttonRect.height,
    top: buttonRect.top - containerRect.top,
  };
}

function TabGroup({
  groupLabel,
  tabs,
  activeTab,
  indicatorMotion,
  exitTabId,
  onTabChange,
  hasUpdate,
  hasEnvironmentIssues,
}: TabGroupProps): React.ReactElement {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = React.useState<React.CSSProperties>({ display: 'none' });
  const [exitIndicatorStyle, setExitIndicatorStyle] = React.useState<React.CSSProperties | null>(null);
  /** 避免 fade→idle 重渲染时对同一 tab 再播一遍动画 */
  const lastSettledTabRef = React.useRef<SettingsTab | null>(null);

  // 当前组内选中项：滑动 / 淡入（相对容器定位，left:0 —— 原先效果好的实现）
  React.useLayoutEffect(() => {
    if (!containerRef.current) return;

    const activeIndex = tabs.findIndex((tab) => tab.id === activeTab);
    if (activeIndex === -1) {
      setIndicatorStyle({ display: 'none' });
      lastSettledTabRef.current = null;
      return;
    }

    const activeButton = containerRef.current.querySelector<HTMLButtonElement>(
      `[data-tab-id="${activeTab}"]`,
    );
    if (!activeButton) return;

    const baseStyle = measureButtonInContainer(containerRef.current, activeButton);
    const settledStyle: React.CSSProperties = {
      ...baseStyle,
      opacity: 1,
      transform: 'scale(1)',
      transition: 'none',
    };

    if (indicatorMotion === 'idle') {
      if (lastSettledTabRef.current === activeTab) return;
      setIndicatorStyle(settledStyle);
      lastSettledTabRef.current = activeTab;
      return;
    }

    if (indicatorMotion === 'slide') {
      setIndicatorStyle({
        ...baseStyle,
        opacity: 1,
        transform: 'scale(1)',
        transition: LIST_SLIDE_TRANSITION,
      });
      lastSettledTabRef.current = activeTab;
      return;
    }

    setIndicatorStyle({
      ...baseStyle,
      opacity: 0,
      transform: 'scale(0.85)',
      transition: 'none',
    });

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setIndicatorStyle({
          ...baseStyle,
          opacity: 1,
          transform: 'scale(1)',
          transition: FADE_IN_TRANSITION,
        });
        lastSettledTabRef.current = activeTab;
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [activeTab, tabs, indicatorMotion]);

  // 跨组离开：仅在本组 tab 上淡出（只改 opacity，避免 scale 错位）
  React.useLayoutEffect(() => {
    if (!exitTabId || !tabs.some((tab) => tab.id === exitTabId)) return;
    if (!containerRef.current) return;

    const exitButton = containerRef.current.querySelector<HTMLButtonElement>(
      `[data-tab-id="${exitTabId}"]`,
    );
    if (!exitButton) return;

    const baseStyle = measureButtonInContainer(containerRef.current, exitButton);
    setExitIndicatorStyle({
      ...baseStyle,
      opacity: 1,
      transition: 'none',
    });

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setExitIndicatorStyle({
          ...baseStyle,
          opacity: 0,
          transition: FADE_OUT_TRANSITION,
        });
      });
    });

    const timer = window.setTimeout(() => {
      setExitIndicatorStyle(null);
    }, FADE_OUT_MS);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      // 不在 cleanup 里清 timer，避免 exitTabId 到期时打断淡出
    };
  }, [exitTabId, tabs]);

  return (
    <div>
      <div className="px-2 pt-1 pb-0.5 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
        {groupLabel}
      </div>
      <div ref={containerRef} className={cn('relative', LIST_SLIDE_HOST_CLASS)}>
        {/* 指示器单独一层，避免占位触发 space-y 给首个按钮加 margin */}
        <div className="pointer-events-none absolute inset-0 z-[1]" aria-hidden>
          {exitIndicatorStyle && (
            <div
              className={cn(LIST_SLIDE_INDICATOR_CLASS, LIST_SLIDE_INDICATOR_EXIT_CLASS)}
              style={exitIndicatorStyle}
            />
          )}
          {indicatorStyle.display !== 'none' && indicatorStyle.width !== undefined && (
            <div className={LIST_SLIDE_INDICATOR_CLASS} style={indicatorStyle} />
          )}
        </div>
        <div className="relative z-10 space-y-0.5">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              data-tab-id={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded-[10px] text-[13px] font-medium transition-colors duration-150 cursor-pointer text-left relative z-10",
                isActive
                  ? cn(LIST_SLIDE_ITEM_SELECTED_CLASS, LIST_SLIDE_ITEM_GHOST_CLASS, "text-foreground")
                  : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]",
              )}
            >
              <span className="shrink-0">{tab.icon}</span>
              <span className="truncate flex-1">{tab.label}</span>
              {tab.id === "about" && (hasUpdate || hasEnvironmentIssues) && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
              )}
            </button>
          );
        })}
        </div>
      </div>
    </div>
  );
}

interface SettingsPanelProps {
  onClose?: () => void;
}

export function SettingsPanel({
  onClose,
}: SettingsPanelProps): React.ReactElement {
  const [activeTab, setActiveTab] = useAtom(settingsTabAtom);
  const channelFormDirty = useAtomValue(channelFormDirtyAtom);
  const [closeRequested, setCloseRequested] = useAtom(settingsCloseRequestedAtom);
  const hasUpdate = useAtomValue(hasUpdateAtom);
  const hasEnvironmentIssues = useAtomValue(hasEnvironmentIssuesAtom);

  const [highlightItemId, setHighlightItemId] = React.useState<string | null>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const prevActiveTabRef = React.useRef<SettingsTab | null>(null)
  const [exitTabId, setExitTabId] = React.useState<SettingsTab | null>(null)
  const exitClearTimerRef = React.useRef<number | null>(null)

  const prevTab = prevActiveTabRef.current
  const prevGroup = prevTab ? getTabGroup(prevTab) : null
  const activeGroup = getTabGroup(activeTab)
  const isTabChange = prevTab !== null && prevTab !== activeTab
  const isIntraGroupSwitch =
    isTabChange &&
    prevGroup === activeGroup
  const indicatorMotion: 'slide' | 'fade' | 'idle' = !isTabChange
    ? 'idle'
    : isIntraGroupSwitch
      ? 'slide'
      : 'fade'

  const scheduleExitFade = React.useCallback((leavingTab: SettingsTab, nextTab: SettingsTab) => {
    const leavingGroup = getTabGroup(leavingTab)
    const nextGroup = getTabGroup(nextTab)
    if (!leavingGroup || !nextGroup || leavingGroup === nextGroup) return

    if (exitClearTimerRef.current !== null) {
      window.clearTimeout(exitClearTimerRef.current)
    }
    setExitTabId(leavingTab)
    exitClearTimerRef.current = window.setTimeout(() => {
      setExitTabId(null)
      exitClearTimerRef.current = null
    }, FADE_OUT_MS)
  }, [])

  React.useEffect(() => {
    prevActiveTabRef.current = activeTab
  }, [activeTab])

  React.useEffect(() => {
    return () => {
      if (exitClearTimerRef.current !== null) {
        window.clearTimeout(exitClearTimerRef.current)
      }
    }
  }, [])

  type PendingAction = { type: 'tab'; tabId: SettingsTab } | { type: 'close' } | null
  const [pendingAction, setPendingAction] = React.useState<PendingAction>(null)
  const showNavDialog = pendingAction !== null

  const executePendingAction = (): void => {
    if (!pendingAction) return
    if (pendingAction.type === 'tab') {
      scheduleExitFade(activeTab, pendingAction.tabId)
      setActiveTab(pendingAction.tabId)
    } else {
      onClose?.()
    }
    setPendingAction(null)
  }

  const cancelPendingAction = (): void => {
    setPendingAction(null)
  }

  const handleTabChange = (tabId: SettingsTab): void => {
    if (tabId === activeTab) return
    if (activeTab === 'channels' && channelFormDirty) {
      setPendingAction({ type: 'tab', tabId })
      return
    }
    scheduleExitFade(activeTab, tabId)
    setActiveTab(tabId)
    setHighlightItemId(null)
  }

  const handleClose = (): void => {
    if (activeTab === 'channels' && channelFormDirty) {
      setPendingAction({ type: 'close' })
      return
    }
    onClose?.()
  }

  const handleSearchNavigate = (tab: SettingsTab, itemId?: string): void => {
    if (tab !== activeTab) {
      if (activeTab === 'channels' && channelFormDirty) {
        setPendingAction({ type: 'tab', tabId: tab })
        setHighlightItemId(itemId ?? null)
        return
      }
      scheduleExitFade(activeTab, tab)
      setActiveTab(tab)
    }
    if (itemId) {
      setTimeout(() => {
        const el = contentRef.current?.querySelector(`[data-search-id="${itemId}"]`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          el.classList.add('ring-2', 'ring-primary/50', 'ring-offset-2', 'ring-offset-background')
          setTimeout(() => {
            el.classList.remove('ring-2', 'ring-primary/50', 'ring-offset-2', 'ring-offset-background')
          }, 2000)
        }
        setHighlightItemId(itemId)
      }, 100)
    }
  }

  React.useEffect(() => {
    if (closeRequested && activeTab === 'channels') {
      setPendingAction({ type: 'close' })
      setCloseRequested(false)
    }
  }, [closeRequested, activeTab, setCloseRequested])

  const activeTabItem = ALL_TABS.find((t) => t.id === activeTab)

  return (
    // 与主界面 shell-glass 同套：p-2 留底板边距，左浮岛 + 右开放区
    <div className="shell-glass h-full w-full flex overflow-hidden">
      <div className="flex-1 min-w-0 p-2 flex gap-2 min-h-0">
        {/* 左侧浮岛 - 导航（settings-glass 玻璃态） */}
        <aside
          className="settings-glass relative flex flex-col overflow-hidden flex-shrink-0"
          style={{ width: 232 }}
        >
          {/* 浮岛顶部：极简标题 + 关闭按钮 */}
          <div className="flex items-center justify-between px-3 h-9 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Settings className="size-3.5 text-muted-foreground shrink-0" />
              <span className="text-[13px] font-semibold tracking-tight truncate">设置</span>
            </div>
          </div>

          {/* 列表 */}
          <ScrollArea className="flex-1 min-h-0">
            <nav className="px-1.5 py-1.5 space-y-2.5">
              {TAB_GROUPS.map((group) => {
                const groupTabs = ALL_TABS.filter(t => t.group === group.key)
                if (groupTabs.length === 0) return null
                return (
                  <TabGroup
                    key={group.key}
                    groupLabel={group.label}
                    tabs={groupTabs}
                    activeTab={activeTab}
                    indicatorMotion={indicatorMotion}
                    exitTabId={exitTabId}
                    onTabChange={handleTabChange}
                    hasUpdate={hasUpdate}
                    hasEnvironmentIssues={hasEnvironmentIssues}
                  />
                )
              })}
            </nav>
          </ScrollArea>
        </aside>

        {/* 右侧 - 开放页面（玻璃感内容区） */}
        <section className="settings-content-glass relative flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
          {/* 顶部栏：左侧搜索（铺满）+ 右侧关闭按钮 */}
          <div className="flex items-center gap-2 h-9 px-4 shrink-0">
            <SettingsSearch onNavigate={handleSearchNavigate} fullWidth />
            {onClose && (
              <button
                onClick={handleClose}
                className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-foreground/[0.06] active:scale-95 transition-all"
                title="关闭"
              >
                <X size={13} strokeWidth={2} />
              </button>
            )}
          </div>

          {/* 内容区 */}
          <ScrollArea className="flex-1 min-h-0">
            <div
              ref={contentRef}
              key={activeTab}
              className="px-6 py-4 max-w-2xl animate-settings-content-in"
            >
              {renderTabContent(activeTab)}
            </div>
          </ScrollArea>
        </section>
      </div>

      {/* 退出拦截弹窗 */}
      <AlertDialog open={showNavDialog} onOpenChange={(open) => { if (!open) cancelPendingAction() }}>
        <AlertDialogContent className="border-border/50 shadow-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">放弃未保存的更改？</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              当前渠道配置尚未保存，确定要离开吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelPendingAction} className="border-border/50">
              留在当前页
            </AlertDialogCancel>
            <AlertDialogAction onClick={executePendingAction} className="bg-primary text-primary-foreground hover:bg-primary/90">
              放弃并离开
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}