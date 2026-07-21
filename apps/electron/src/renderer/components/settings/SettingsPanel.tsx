/**
 * SettingsPanel - 设置主面板
 *
 * 顶栏 + 左导航 + 右内容；选项全集保留。
 * 视觉 / 动效由 settings-shell.css 统一。
 */

import { useAtom, useAtomValue } from 'jotai'
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
  Wand2,
} from 'lucide-react'
import * as React from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@tagent/ui'
import { AboutSettings } from './AboutSettings'
import { AppearanceSettings } from './AppearanceSettings'
import { BotHubSettings } from './BotHubSettings'
import { ChannelSettings } from './ChannelSettings'
import { GeneralSettings } from './GeneralSettings'
import { InsightsSettings } from './InsightsSettings'
import { PromptSettings } from './PromptSettings'
import { ProxySettings } from './ProxySettings'
import { SettingsSearch } from './SettingsSearch'
import { ShortcutSettings } from './ShortcutSettings'
import { VoiceInputSettings } from './VoiceInputSettings'
import { AgentPreferencesSettings } from './AgentBehaviorSettings'

import './settings-shell.css'

import type { SettingsTab } from '@/atoms/settings-tab'

import { hasEnvironmentIssuesAtom } from '@/atoms/environment'
import {
  settingsTabAtom,
  channelFormDirtyAtom,
  settingsCloseRequestedAtom,
} from '@/atoms/settings-tab'
import { hasUpdateAtom } from '@/atoms/updater'
import { cn } from '@/lib/utils'

interface TabItem {
  id: SettingsTab
  label: string
  description: string
  icon: React.ReactNode
  group: 'core' | 'integration' | 'advanced'
}

const TAB_GROUPS: Array<{ key: TabItem['group']; label: string }> = [
  { key: 'core', label: '核心' },
  { key: 'integration', label: '集成' },
  { key: 'advanced', label: '高级' },
]

const ALL_TABS: TabItem[] = [
  {
    id: 'general',
    label: '通用',
    description: '档案、语言、归档与通知等基础偏好',
    icon: <Settings size={15} strokeWidth={1.75} />,
    group: 'core',
  },
  {
    id: 'channels',
    label: 'AI 渠道',
    description: '模型供应商、密钥、连通与默认模型',
    icon: <Radio size={15} strokeWidth={1.75} />,
    group: 'core',
  },
  {
    id: 'prompts',
    label: '提示词',
    description: '系统提示与可复用模板',
    icon: <BookOpen size={15} strokeWidth={1.75} />,
    group: 'core',
  },
  {
    id: 'agent-preferences',
    label: 'Agent 偏好',
    description: '权限、委派与执行习惯',
    icon: <Wand2 size={15} strokeWidth={1.75} />,
    group: 'core',
  },
  {
    id: 'bots',
    label: '远程',
    description: '飞书 / 钉钉 / 微信等远程入口',
    icon: <Bot size={15} strokeWidth={1.75} />,
    group: 'integration',
  },
  {
    id: 'voice-input',
    label: '语音',
    description: '语音输入与听写相关选项',
    icon: <Mic size={15} strokeWidth={1.75} />,
    group: 'integration',
  },
  {
    id: 'proxy',
    label: '代理',
    description: '网络代理与出站配置',
    icon: <Globe size={15} strokeWidth={1.75} />,
    group: 'integration',
  },
  {
    id: 'shortcuts',
    label: '快捷键',
    description: '全局与编辑器快捷键',
    icon: <Keyboard size={15} strokeWidth={1.75} />,
    group: 'advanced',
  },
  {
    id: 'insights',
    label: '数据',
    description: '用量统计与洞察',
    icon: <BarChart3 size={15} strokeWidth={1.75} />,
    group: 'advanced',
  },
  {
    id: 'appearance',
    label: '外观',
    description: '主题、风格库、字号与材质',
    icon: <Palette size={15} strokeWidth={1.75} />,
    group: 'advanced',
  },
  {
    id: 'about',
    label: '关于',
    description: '版本、更新与环境信息',
    icon: <Info size={15} strokeWidth={1.75} />,
    group: 'advanced',
  },
]

function renderTabContent(tab: SettingsTab): React.ReactElement {
  switch (tab) {
    case 'general':
      return <GeneralSettings />
    case 'channels':
      return <ChannelSettings />
    case 'prompts':
      return <PromptSettings />
    case 'agent-preferences':
      return <AgentPreferencesSettings />
    case 'proxy':
      return <ProxySettings />
    case 'appearance':
      return <AppearanceSettings />
    case 'about':
      return <AboutSettings />
    case 'bots':
      return <BotHubSettings />
    case 'shortcuts':
      return <ShortcutSettings />
    case 'voice-input':
      return <VoiceInputSettings />
    case 'insights':
      return <InsightsSettings />
    case 'agent':
    case 'tutorial':
      return <GeneralSettings />
    default:
      return <GeneralSettings />
  }
}

interface SettingsPanelProps {
  onClose?: () => void
}

export function SettingsPanel({ onClose }: SettingsPanelProps): React.ReactElement {
  const [activeTab, setActiveTab] = useAtom(settingsTabAtom)
  const channelFormDirty = useAtomValue(channelFormDirtyAtom)
  const [closeRequested, setCloseRequested] = useAtom(settingsCloseRequestedAtom)
  const hasUpdate = useAtomValue(hasUpdateAtom)
  const hasEnvironmentIssues = useAtomValue(hasEnvironmentIssuesAtom)

  const contentRef = React.useRef<HTMLDivElement>(null)
  const [paneKey, setPaneKey] = React.useState(0)

  type PendingAction = { type: 'tab'; tabId: SettingsTab } | { type: 'close' } | null
  const [pendingAction, setPendingAction] = React.useState<PendingAction>(null)
  const showNavDialog = pendingAction !== null

  const activeTabItem = ALL_TABS.find((t) => t.id === activeTab) ?? ALL_TABS[0]!
  const activeGroupLabel =
    TAB_GROUPS.find((g) => g.key === activeTabItem.group)?.label ?? activeTabItem.group

  const bumpPane = React.useCallback(() => {
    setPaneKey((k) => k + 1)
  }, [])

  const executePendingAction = (): void => {
    if (!pendingAction) return
    if (pendingAction.type === 'tab') {
      setActiveTab(pendingAction.tabId)
      bumpPane()
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
    setActiveTab(tabId)
    bumpPane()
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
        return
      }
      setActiveTab(tab)
      bumpPane()
    }
    if (itemId) {
      window.setTimeout(() => {
        const el = contentRef.current?.querySelector(`[data-search-id="${itemId}"]`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          el.classList.add('ring-2', 'ring-primary/40', 'ring-offset-2', 'ring-offset-background')
          window.setTimeout(() => {
            el.classList.remove(
              'ring-2',
              'ring-primary/40',
              'ring-offset-2',
              'ring-offset-background'
            )
          }, 2000)
        }
      }, 140)
    }
  }

  React.useEffect(() => {
    if (closeRequested && activeTab === 'channels') {
      setPendingAction({ type: 'close' })
      setCloseRequested(false)
    }
  }, [closeRequested, activeTab, setCloseRequested])

  return (
    <div className="settings-shell">
      {/* 全宽顶栏 */}
      <header className="settings-shell-topbar">
        <div className="settings-shell-topbar-brand">
          <span className="settings-shell-topbar-mark" aria-hidden>
            S
          </span>
          <div className="settings-shell-topbar-copy">
            <span className="settings-shell-kicker">PREFERENCES</span>
            <span className="settings-shell-title">设置</span>
          </div>
        </div>
        <div className="settings-shell-topbar-actions">
          <SettingsSearch onNavigate={handleSearchNavigate} />
          {onClose ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleClose}
                  className="settings-shell-close titlebar-no-drag"
                  aria-label="关闭设置"
                >
                  <X size={15} strokeWidth={2} />
                </button>
              </TooltipTrigger>
              <TooltipContent>关闭</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </header>

      <div className="settings-shell-body">
        <aside className="settings-shell-nav">
          <nav className="settings-shell-nav-scroll" aria-label="设置分类">
            {TAB_GROUPS.map((group) => {
              const groupTabs = ALL_TABS.filter((t) => t.group === group.key)
              if (groupTabs.length === 0) return null
              return (
                <div key={group.key} className="settings-shell-group">
                  <div className="settings-shell-group-label">{group.label}</div>
                  {groupTabs.map((tab) => {
                    const isActive = activeTab === tab.id
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        data-tab-id={tab.id}
                        data-active={isActive || undefined}
                        onClick={() => handleTabChange(tab.id)}
                        className="settings-shell-nav-item"
                      >
                        <span className="settings-shell-nav-item-icon">{tab.icon}</span>
                        <span className="settings-shell-nav-item-label">{tab.label}</span>
                        {tab.id === 'about' && (hasUpdate || hasEnvironmentIssues) ? (
                          <span className="settings-shell-nav-dot" aria-label="有更新或环境问题" />
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </nav>
        </aside>

        <section className="settings-shell-main">
          <div className="settings-shell-pagehead">
            <div className="min-w-0">
              <span className="settings-shell-pagehead-kicker">{activeGroupLabel}</span>
              <h2 className="settings-shell-pagehead-title">{activeTabItem.label}</h2>
              <p className="settings-shell-pagehead-desc">{activeTabItem.description}</p>
            </div>
          </div>

          <div className="settings-shell-scroll">
            <div
              ref={contentRef}
              key={`${activeTab}-${paneKey}`}
              className={cn('settings-shell-content', 'settings-shell-pane')}
            >
              {renderTabContent(activeTab)}
            </div>
          </div>
        </section>
      </div>

      <AlertDialog
        open={showNavDialog}
        onOpenChange={(open) => {
          if (!open) cancelPendingAction()
        }}
      >
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
            <AlertDialogAction
              onClick={executePendingAction}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              放弃并离开
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
