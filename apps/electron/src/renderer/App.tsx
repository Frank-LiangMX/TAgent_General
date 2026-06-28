import { useAtom, useStore } from 'jotai'
import * as React from 'react'

import { agentSessionsAtom } from './atoms/agent-atoms'
import { environmentCheckDialogOpenAtom } from './atoms/environment'
import { tabsAtom, activeTabIdAtom, openTab } from './atoms/tab-atoms'
import { AppShell } from './components/app-shell/AppShell'
import { EnvironmentCheckDialog } from './components/environment/EnvironmentCheckDialog'
import { OnboardingView } from './components/onboarding/OnboardingView'
import { SettingsDialog } from './components/settings/SettingsDialog'
import { TutorialBanner } from './components/tutorial/TutorialBanner'
import { TooltipProvider } from './components/ui/tooltip'
import { WindowCloseConfirmDialog } from './components/WindowCloseConfirmDialog'

import type { AppShellContextType } from './contexts/AppShellContext'

export default function App(): React.ReactElement {
  // [FLASH-DEBUG] 监控 App 组件重渲染（如果看到频繁日志，说明根组件被频繁重渲染）
  const appRenderCountRef = React.useRef(0)
  appRenderCountRef.current++
  if (appRenderCountRef.current > 1) {
    console.warn(
      `[FLASH-DEBUG] App re-render #${appRenderCountRef.current}, isLoading/showOnboarding may have changed`
    )
  }

  const store = useStore()
  const [isLoading, setIsLoading] = React.useState(true)
  const [showOnboarding, setShowOnboarding] = React.useState(false)

  // 初始化：检查是否需要显示 Onboarding
  // macOS/Linux 上 SDK 自带 claude native binary 不依赖宿主 Node/Git；
  // Windows 上仍需 Git Bash/WSL，由 Onboarding Step 2 与聊天错误卡片引导用户安装。
  React.useEffect(() => {
    const initialize = async () => {
      try {
        const settings = await window.electronAPI.getSettings()
        if (!settings.onboardingCompleted) {
          setShowOnboarding(true)
        }
      } catch (error) {
        console.error('[App] 初始化失败:', error)
      } finally {
        setIsLoading(false)
      }
    }

    initialize()
  }, [])

  // 完成 onboarding 回调：创建欢迎 Agent 会话（P3: Chat 已退役）
  const handleOnboardingComplete = async () => {
    setShowOnboarding(false)

    try {
      const meta = await window.electronAPI.createAgentSession()
      if (meta) {
        // 添加到 Agent 会话列表
        const sessions = store.get(agentSessionsAtom)
        store.set(agentSessionsAtom, [meta, ...sessions])

        // 打开 Agent 标签页
        const tabs = store.get(tabsAtom)
        const result = openTab(tabs, {
          type: 'agent',
          sessionId: meta.id,
          title: meta.title,
        })
        store.set(tabsAtom, result.tabs)
        store.set(activeTabIdAtom, result.activeTabId)
      }
    } catch (error) {
      console.error('[App] 创建欢迎会话失败:', error)
    }
  }

  // 加载中状态
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">正在初始化...</p>
        </div>
      </div>
    )
  }

  // 显示 onboarding 界面
  if (showOnboarding) {
    return (
      <TooltipProvider delayDuration={200}>
        <OnboardingView onComplete={handleOnboardingComplete} />
      </TooltipProvider>
    )
  }

  // Placeholder context value
  const contextValue: AppShellContextType = {}

  // 显示主界面
  return (
    <TooltipProvider delayDuration={200}>
      <AppShell contextValue={contextValue} />
      <SettingsDialog />
      <TutorialBanner />
      <GlobalEnvironmentCheckDialog />
      <GlobalWindowCloseConfirmDialog />
    </TooltipProvider>
  )
}

/**
 * 全局环境检测 Dialog，由错误卡片的 recovery action 按钮打开。
 */
function GlobalEnvironmentCheckDialog(): React.ReactElement {
  const [open, setOpen] = useAtom(environmentCheckDialogOpenAtom)
  return <EnvironmentCheckDialog open={open} onOpenChange={setOpen} />
}

/**
 * 全局窗口关闭确认对话框，由主进程 WINDOW_CLOSE_IPC_CHANNELS.REQUEST 触发。
 */
function GlobalWindowCloseConfirmDialog(): React.ReactElement {
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const cleanup = window.electronAPI.onWindowCloseRequest(() => {
      console.info('[GlobalWindowCloseConfirmDialog] 收到 close-request')
      setOpen(true)
    })
    return cleanup
  }, [])

  return <WindowCloseConfirmDialog open={open} onOpenChange={setOpen} />
}
