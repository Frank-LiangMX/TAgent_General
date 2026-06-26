/**
 * GlobalShortcuts — 全局快捷键注册 + 初始化组件
 *
 * 在 main.tsx 顶层挂载（类似 AgentListenersInitializer），永不销毁。
 * 负责：
 * 1. 初始化快捷键注册表
 * 2. 从 settings 加载用户自定义配置
 * 3. 注册所有应用级快捷键的 handler
 * 4. 监听菜单 IPC 事件（Cmd+W 关闭标签）
 */

import { useAtomValue, useSetAtom, useAtom, useStore } from 'jotai'
import { useEffect, useCallback } from 'react'

import { activeViewAtom } from '@/atoms/active-view'
import {
  agentPendingPromptAtom,
  agentSessionDraftHtmlAtom,
  agentSessionDraftsAtom,
  agentSessionsAtom,
  currentAgentSessionIdAtom,
  agentChannelIdAtom,
  currentAgentWorkspaceIdAtom,
  agentWorkspacesAtom,
  agentAttachedFilesMapAtom,
} from '@/atoms/agent-atoms'
import { appModeAtom } from '@/atoms/app-mode'
import { conversationsAtom } from '@/atoms/agent-atoms'
import { selectedModelAtom } from '@/atoms/model-atoms'
import { currentComposerModeAtom, composerModeMapAtom } from '@/atoms/composer-atoms'
import { searchDialogOpenAtom } from '@/atoms/search-atoms'
import {
  settingsOpenAtom,
  channelFormDirtyAtom,
  settingsCloseRequestedAtom,
} from '@/atoms/settings-tab'
import { shortcutOverridesAtom, sendWithCmdEnterAtom } from '@/atoms/shortcut-atoms'
import {
  tabsAtom,
  activeTabIdAtom,
  openTab,
  buildOpenTabRestore,
  sessionViewStateMapAtom,
} from '@/atoms/tab-atoms'
import { previewFileMapAtom } from '@/atoms/preview-atoms'
import { useCloseTab } from '@/hooks/useCloseTab'
import { useCreateSession } from '@/hooks/useCreateSession'
import { useShortcut } from '@/hooks/useShortcut'
import { getFileParentPath } from '@/lib/file-utils'
import { initShortcutRegistry, updateShortcutOverrides } from '@/lib/shortcut-registry'

/**
 * 快捷键初始化 + 全局 Handler 注册
 *
 * 挂载后从 settings 加载自定义配置，并注册所有应用级快捷键。
 */
export function GlobalShortcuts(): null {
  const currentComposerMode = useAtomValue(currentComposerModeAtom)
  const setComposerModeMap = useSetAtom(composerModeMapAtom)
  const currentAgentSessionId = useAtomValue(currentAgentSessionIdAtom)
  const [settingsOpen, setSettingsOpen] = useAtom(settingsOpenAtom)
  const channelFormDirty = useAtomValue(channelFormDirtyAtom)
  const setSettingsCloseRequested = useSetAtom(settingsCloseRequestedAtom)
  const [searchOpen, setSearchOpen] = useAtom(searchDialogOpenAtom)
  const setShortcutOverrides = useSetAtom(shortcutOverridesAtom)
  const shortcutOverrides = useAtomValue(shortcutOverridesAtom)
  const setSendWithCmdEnter = useSetAtom(sendWithCmdEnterAtom)
  const { createAgent } = useCreateSession()

  // Tab 管理（用于关闭标签页）
  const activeTabId = useAtomValue(activeTabIdAtom)

  // 统一关闭逻辑：与 TabBar.handleClose 共用
  // 含 Agent 子进程 stop + 流式中的确认对话框（修复 Issue #357）
  const { requestClose } = useCloseTab()

  // 初始化：挂载注册表 + 加载用户配置
  useEffect(() => {
    initShortcutRegistry()

    window.electronAPI
      .getSettings()
      .then((settings) => {
        if (settings.shortcutOverrides) {
          setShortcutOverrides(settings.shortcutOverrides)
          updateShortcutOverrides(settings.shortcutOverrides)
        }
        setSendWithCmdEnter(settings.sendWithCmdEnter ?? false)
      })
      .catch(console.error)
  }, [setShortcutOverrides, setSendWithCmdEnter])

  // 配置变更时同步到注册表
  useEffect(() => {
    updateShortcutOverrides(shortcutOverrides)
  }, [shortcutOverrides])

  // ===== 关闭标签页逻辑 =====

  const handleCloseTab = useCallback(() => {
    // 浮窗优先：有浮窗打开时 Cmd+W 先关闭浮窗而非 tab
    if (settingsOpen) {
      // 渠道表单有未保存内容时，通知 SettingsPanel 弹出确认对话框
      if (channelFormDirty) {
        setSettingsCloseRequested(true)
        return
      }
      setSettingsOpen(false)
      return
    }
    if (searchOpen) {
      setSearchOpen(false)
      return
    }

    if (!activeTabId) return
    requestClose(activeTabId)
  }, [
    settingsOpen,
    setSettingsOpen,
    channelFormDirty,
    setSettingsCloseRequested,
    searchOpen,
    setSearchOpen,
    activeTabId,
    requestClose,
  ])

  // 监听菜单 IPC 事件（Cmd+W 被 Electron 菜单拦截后通过 IPC 转发）
  useEffect(() => {
    const cleanup = window.electronAPI.onMenuCloseTab(handleCloseTab)
    return cleanup
  }, [handleCloseTab])

  // 同时注册到快捷键系统（用于设置面板展示和自定义，实际触发走 IPC）
  useShortcut('close-tab', handleCloseTab)

  // ===== 快捷键 Handler =====

  // Cmd+, → 打开设置
  useShortcut(
    'open-settings',
    useCallback(() => setSettingsOpen(true), [setSettingsOpen])
  )

  // Cmd+Shift+F / Ctrl+Shift+F → 全局搜索
  useShortcut(
    'global-search',
    useCallback(() => setSearchOpen(true), [setSearchOpen])
  )

  // Cmd+N → 新建 Agent 会话
  useShortcut(
    'new-session',
    useCallback(() => {
      createAgent({ draft: true })
    }, [createAgent])
  )

  // Cmd+Shift+M → 切换 Composer 档位
  useShortcut(
    'toggle-mode',
    useCallback(async () => {
      const sessionId = currentAgentSessionId
      if (!sessionId) return

      const nextMode = currentComposerMode === 'ask' ? 'agent' : 'ask'
      try {
        await window.electronAPI.setComposerMode(sessionId, nextMode)
        setComposerModeMap((prev) => {
          const map = new Map(prev)
          map.set(sessionId, nextMode)
          return map
        })
      } catch (error) {
        console.error('[GlobalShortcuts] 切换 Composer 档位失败:', error)
      }
    }, [currentComposerMode, currentAgentSessionId, setComposerModeMap])
  )

  // Cmd+K → 清除上下文（通过 CustomEvent 分发到 ChatInput）
  useShortcut(
    'clear-context',
    useCallback(() => {
      window.dispatchEvent(new CustomEvent('tagent:clear-context'))
    }, [])
  )

  // Cmd+L → 聚焦输入框（通过 CustomEvent 分发到 ChatInput/AgentView）
  useShortcut(
    'focus-input',
    useCallback(() => {
      window.dispatchEvent(new CustomEvent('tagent:focus-input'))
    }, [])
  )

  // Cmd+Shift+Backspace → 停止 Agent（通过 CustomEvent 分发到 ChatView/AgentView）
  useShortcut(
    'stop-generation',
    useCallback(() => {
      window.dispatchEvent(new CustomEvent('tagent:stop-generation'))
    }, [])
  )

  // ===== 快速任务窗口 → 创建会话并自动发送 =====

  const store = useStore()

  useEffect(() => {
    const cleanup = window.electronAPI.onQuickTaskOpenSession(async (data) => {
      try {
        // P3: Quick Task 仅支持 Agent 模式
        store.set(appModeAtom, 'agent')
        store.set(activeViewAtom, 'conversations')

        // Agent 模式：创建会话 + 保存附件到 session 目录
        const channelId = store.get(agentChannelIdAtom) || undefined
        const workspaceId = store.get(currentAgentWorkspaceIdAtom) || undefined
        const meta = await window.electronAPI.createAgentSession(undefined, channelId, workspaceId)
        // 更新 atom 状态
        store.set(agentSessionsAtom, (prev) => [meta, ...prev])
        store.set(currentAgentSessionIdAtom, meta.id)

        // 处理附件：保存到 session 目录，构建 file references
        let fileReferences = ''
        const additionalDirectories = new Set<string>()
        if (data.files && data.files.length > 0 && workspaceId) {
          const workspaces = store.get(agentWorkspacesAtom)
          const workspace = workspaces.find((w) => w.id === workspaceId)
          if (workspace) {
            try {
              const allRefs: Array<{ filename: string; targetPath: string }> = []
              for (const file of data.files) {
                if (!file.sourcePath) continue
                const attachedFiles = await window.electronAPI.attachFile({
                  sessionId: meta.id,
                  filePath: file.sourcePath,
                })
                store.set(agentAttachedFilesMapAtom, (prev) => {
                  const map = new Map(prev)
                  map.set(meta.id, attachedFiles)
                  return map
                })
                allRefs.push({ filename: file.filename, targetPath: file.sourcePath })
                const parentPath = getFileParentPath(file.sourcePath)
                if (parentPath) additionalDirectories.add(parentPath)
              }

              const filesToSave = data.files
                .filter((f) => f.base64)
                .map((f) => ({
                  filename: f.filename,
                  data: f.base64!,
                }))
              if (filesToSave.length > 0) {
                const saved = await window.electronAPI.saveFilesToAgentSession({
                  workspaceSlug: workspace.slug,
                  sessionId: meta.id,
                  files: filesToSave,
                })
                allRefs.push(...saved)
              }

              if (allRefs.length > 0) {
                const refs = allRefs.map((f) => `- ${f.filename}: ${f.targetPath}`).join('\n')
                fileReferences = `<attached_files>\n${refs}\n</attached_files>\n\n`
              }
            } catch (error) {
              console.error('[快速任务] 保存 Agent 附件失败:', error)
            }
          }
        }

        // 打开新标签页
        const currentTabs = store.get(tabsAtom)
        const result = openTab(currentTabs, {
          type: 'agent',
          sessionId: meta.id,
          title: data.text.slice(0, 30),
        })
        store.set(tabsAtom, result.tabs)
        store.set(activeTabIdAtom, result.activeTabId)

        // 设置待发送消息（附件引用已内联到消息文本中）
        store.set(agentPendingPromptAtom, {
          sessionId: meta.id,
          message: fileReferences + data.text,
          ...(additionalDirectories.size > 0 && {
            additionalDirectories: Array.from(additionalDirectories),
          }),
        })
      } catch (error) {
        console.error('[快速任务] 创建会话失败:', error)
      }
    })
    return cleanup
  }, [store])

  // ===== 语音输入 → 写入当前 TAgent 输入框 =====

  useEffect(() => {
    const cleanup = window.electronAPI.onVoiceDictationInsertText(({ text }) => {
      const trimmed = text.trim()
      if (!trimmed) return

      const insertedAtCursor = !window.dispatchEvent(
        new CustomEvent('tagent:insert-voice-dictation-text', {
          cancelable: true,
          detail: { text: trimmed },
        })
      )
      if (insertedAtCursor) {
        window.dispatchEvent(new CustomEvent('tagent:focus-input'))
        return
      }

      const tabs = store.get(tabsAtom)
      const activeTabId = store.get(activeTabIdAtom)
      const activeTab = tabs.find((tab) => tab.id === activeTabId)
      // P3: chat 已退役，fallback 永远是 agent
      const fallbackTarget = {
        type: 'agent' as const,
        sessionId: store.get(currentAgentSessionIdAtom),
      }
      const target = activeTab ?? fallbackTarget

      if (!target.sessionId) return

      store.set(activeViewAtom, 'conversations')

      // P3: 仅处理 agent 类型
      if (target.type === 'agent' || target.type === 'preview') {
        const sessionId = target.sessionId
        store.set(appModeAtom, 'agent')
        store.set(currentAgentSessionIdAtom, sessionId)
        store.set(agentSessionDraftsAtom, (prev) => {
          const map = new Map(prev)
          const current = map.get(sessionId) ?? ''
          map.set(sessionId, current ? `${current}\n${trimmed}` : trimmed)
          return map
        })
        store.set(agentSessionDraftHtmlAtom, (prev) => {
          const map = new Map(prev)
          map.delete(sessionId)
          return map
        })
        window.dispatchEvent(new CustomEvent('tagent:focus-input'))
      }
    })
    return cleanup
  }, [store])

  // ===== 菜单栏 → 打开 / 创建会话 =====

  useEffect(() => {
    const cleanupOpen = window.electronAPI.onTrayOpenAgentSession(async (data) => {
      try {
        const sessions = await window.electronAPI.listAgentSessions()
        const session = sessions.find((item) => item.id === data.sessionId)
        if (!session) return

        store.set(agentSessionsAtom, sessions)

        // 走 openTab 统一入口，保留已有标签页并处理 restore
        const restore = buildOpenTabRestore(
          session.id,
          store.get(sessionViewStateMapAtom),
          store.get(previewFileMapAtom)
        )
        const currentTabs = store.get(tabsAtom)
        const result = openTab(
          currentTabs,
          {
            type: 'agent',
            sessionId: session.id,
            title: session.title || data.title,
          },
          restore
        )
        store.set(tabsAtom, result.tabs)
        store.set(activeTabIdAtom, result.activeTabId)
      } catch (error) {
        console.error('[菜单栏] 打开 Agent 会话失败:', error)
      }
    })

    const cleanupCreate = window.electronAPI.onTrayCreateSession(async (data) => {
      // P3: chat 已退役，仅支持 agent
      store.set(appModeAtom, 'agent')
      store.set(activeViewAtom, 'conversations')
      await createAgent()
    })

    return () => {
      cleanupOpen()
      cleanupCreate()
    }
  }, [store, createAgent])
  return null
}
