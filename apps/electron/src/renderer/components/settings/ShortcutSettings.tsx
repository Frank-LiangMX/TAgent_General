/**
 * ShortcutSettings — 快捷键设置面板
 *
 * 现代卡片网格布局：
 * - 发送消息单独展示
 * - 快捷键以卡片网格形式展示（每个快捷键一个独立卡片）
 * - 点击卡片录制，右侧开关控制启用/禁用
 */

import { useAtom } from 'jotai'
import { RotateCcw, Command, ArrowLeftRight, FileEdit, Globe2 } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import type { ShortcutCategory, ShortcutOverrides } from '@/lib/shortcut-defaults'

import { shortcutOverridesAtom, sendWithCmdEnterAtom } from '@/atoms/shortcut-atoms'
import { Switch } from '@/components/ui/switch'
import { DEFAULT_SHORTCUTS, SHORTCUT_CATEGORY_LABELS } from '@/lib/shortcut-defaults'
import { getActiveAccelerator, getAcceleratorDisplay, checkConflict, updateShortcutOverrides, isMac } from '@/lib/shortcut-registry'
import { cn } from '@/lib/utils'

// ===== 快捷键录制弹窗 =====

interface RecordingModalProps {
  shortcutId: string
  shortcutName: string
  onSave: (accelerator: string) => Promise<boolean>
  onCancel: () => void
}

function RecordingModal({ shortcutId, shortcutName, onSave, onCancel }: RecordingModalProps): React.ReactElement {
  const [pendingKeys, setPendingKeys] = React.useState('')
  const [conflict, setConflict] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const pendingKeysRef = React.useRef('')

  const normalizeKey = React.useCallback((rawKey: string): string => {
    if (rawKey === ' ') return 'Space'
    if (rawKey === '+') return 'Plus'
    if (rawKey.length === 1) return rawKey.toUpperCase()
    const keyMap: Record<string, string> = {
      ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
      Escape: 'Esc', Backspace: 'Backspace', Delete: 'Delete', Enter: 'Enter', Tab: 'Tab',
    }
    return keyMap[rawKey] ?? rawKey
  }, [])

  const isStandaloneKeyAllowed = React.useCallback((key: string): boolean => /^F(?:[1-9]|1[0-9]|2[0-4])$/i.test(key), [])

  const finishCapture = React.useCallback((accelerator: string) => {
    if (!accelerator) return
    const conflictId = checkConflict(accelerator, shortcutId)
    if (conflictId) {
      const conflictDef = DEFAULT_SHORTCUTS.find((s) => s.id === conflictId)
      setConflict(conflictDef?.name ?? conflictId)
      setPendingKeys(accelerator)
      return
    }
    setPendingKeys(accelerator)
    setConflict(null)
  }, [shortcutId])

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      e.preventDefault()
      e.stopPropagation()

      const parts: string[] = []
      if (e.metaKey && isMac) parts.push('Cmd')
      if (e.ctrlKey) parts.push('Ctrl')
      if (e.shiftKey) parts.push('Shift')
      if (e.altKey) parts.push('Alt')

      if (['Meta', 'Control', 'Shift', 'Alt'].includes(e.key)) {
        pendingKeysRef.current = parts.join('+')
        setPendingKeys(parts.join('+'))
        return
      }

      const key = normalizeKey(e.key)
      if (parts.length === 0 && !isStandaloneKeyAllowed(key)) return

      parts.push(key)
      finishCapture(parts.join('+'))
    }

    const handleKeyUp = (e: KeyboardEvent): void => {
      if (!pendingKeysRef.current) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      e.preventDefault()
      finishCapture(pendingKeysRef.current)
    }

    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keyup', handleKeyUp, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keyup', handleKeyUp, true)
    }
  }, [normalizeKey, isStandaloneKeyAllowed, finishCapture])

  const handleSave = async (): void => {
    if (!pendingKeys || conflict || saving) return
    setSaving(true)
    try {
      await onSave(pendingKeys)
      onCancel()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-background rounded-xl border border-border p-5 w-[280px] shadow-xl animate-in zoom-in-95 duration-150">
        <div className="text-sm font-medium text-foreground mb-3">{shortcutName}</div>

        {/* 录制区域 */}
        <div className={cn(
          'rounded-lg p-4 text-center mb-4',
          conflict ? 'bg-red-500/10' : pendingKeys ? 'bg-muted' : 'bg-muted/50'
        )}>
          {conflict ? (
            <div className="text-red-600 text-xs">
              <span className="font-mono">{getAcceleratorDisplay(pendingKeys)}</span>
              <span className="ml-2">与「{conflict}」冲突</span>
            </div>
          ) : pendingKeys ? (
            <span className="font-mono text-sm text-foreground">{getAcceleratorDisplay(pendingKeys)}</span>
          ) : (
            <span className="text-xs text-muted-foreground">按下快捷键组合...</span>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded hover:bg-muted">
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!pendingKeys || conflict || saving}
            className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ===== 主组件 =====

export function ShortcutSettings(): React.ReactElement {
  const [overrides, setOverrides] = useAtom(shortcutOverridesAtom)
  const [sendWithCmdEnter, setSendWithCmdEnter] = useAtom(sendWithCmdEnterAtom)
  const [recordingShortcut, setRecordingShortcut] = React.useState<{ id: string; name: string } | null>(null)

  const grouped = React.useMemo(() => {
    const groups = new Map<ShortcutCategory, typeof DEFAULT_SHORTCUTS>()
    for (const def of DEFAULT_SHORTCUTS) {
      const list = groups.get(def.category) ?? []
      list.push(def)
      groups.set(def.category, list)
    }
    return groups
  }, [])

  const reregisterGlobalShortcut = React.useCallback(async (shortcutId: string): Promise<boolean> => {
    const def = DEFAULT_SHORTCUTS.find((s) => s.id === shortcutId)
    if (!def?.global) return true
    const results = await window.electronAPI.reregisterGlobalShortcuts()
    return results[shortcutId] !== false
  }, [])

  const handleSaveShortcut = React.useCallback(async (shortcutId: string, accelerator: string): Promise<boolean> => {
    const key = isMac ? 'mac' : 'win'
    const newOverrides: ShortcutOverrides = { ...overrides, [shortcutId]: { ...overrides[shortcutId], [key]: accelerator } }
    try {
      await window.electronAPI.updateSettings({ shortcutOverrides: newOverrides })
      setOverrides(newOverrides)
      updateShortcutOverrides(newOverrides)
      const def = DEFAULT_SHORTCUTS.find((s) => s.id === shortcutId)
      if (def?.global) await reregisterGlobalShortcut(shortcutId)
      toast.success('已保存')
      return true
    } catch {
      toast.error('保存失败')
      return false
    }
  }, [overrides, reregisterGlobalShortcut, setOverrides])

  const handleToggle = React.useCallback(async (shortcutId: string, enable: boolean) => {
    const key = isMac ? 'mac' : 'win'
    const newOverrides: ShortcutOverrides = enable
      ? { ...overrides, [shortcutId]: { ...overrides[shortcutId], [key]: undefined } }
      : { ...overrides, [shortcutId]: { ...overrides[shortcutId], [key]: null } }

    // 如果启用且没有默认值，删除整个 override
    if (enable && newOverrides[shortcutId]?.[key] === undefined) {
      const cleanOverrides = { ...newOverrides }
      delete cleanOverrides[shortcutId]
      try {
        await window.electronAPI.updateSettings({ shortcutOverrides: cleanOverrides })
        setOverrides(cleanOverrides)
        updateShortcutOverrides(cleanOverrides)
      } catch {
        toast.error('操作失败')
      }
    } else {
      try {
        await window.electronAPI.updateSettings({ shortcutOverrides: newOverrides })
        setOverrides(newOverrides)
        updateShortcutOverrides(newOverrides)
      } catch {
        toast.error('操作失败')
      }
    }
  }, [overrides, setOverrides])

  const handleToggleSendKey = React.useCallback(() => {
    const newValue = !sendWithCmdEnter
    setSendWithCmdEnter(newValue)
    window.electronAPI.updateSettings({ sendWithCmdEnter: newValue })
      .then(() => toast.success('已保存'))
      .catch(() => toast.error('保存失败'))
  }, [sendWithCmdEnter, setSendWithCmdEnter])

  const hasOverrides = Object.keys(overrides).length > 0
  const categoryOrder: ShortcutCategory[] = ['app', 'navigation', 'edit', 'global']
  const categoryIcons: Record<ShortcutCategory, React.ReactNode> = {
    app: <Command className="size-4" />,
    navigation: <ArrowLeftRight className="size-4" />,
    edit: <FileEdit className="size-4" />,
    global: <Globe2 className="size-4" />,
  }

  return (
    <div className="space-y-6">
      {/* 发送消息 */}
      <div className="grid grid-cols-2 gap-3">
        <ShortcutTile
          name="Enter 发送"
          active={!sendWithCmdEnter}
          onClick={() => sendWithCmdEnter && handleToggleSendKey()}
          readonly
        />
        <ShortcutTile
          name={`${isMac ? '⌘' : 'Ctrl'}+Enter`}
          active={sendWithCmdEnter}
          onClick={() => !sendWithCmdEnter && handleToggleSendKey()}
          readonly
        />
      </div>

      {/* 分类快捷键 */}
      {categoryOrder.map((category) => {
        const shortcuts = grouped.get(category)
        if (!shortcuts) return null

        return (
          <div key={category} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{categoryIcons[category]}</span>
              <span className="text-sm font-medium text-foreground">{SHORTCUT_CATEGORY_LABELS[category]}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {shortcuts
                .filter((def) => !def.readonly || (isMac ? def.defaultMac : def.defaultWin))
                .map((def) => {
                  const currentAccel = getActiveAccelerator(def.id)
                  const platformOverride = overrides[def.id]?.[isMac ? 'mac' : 'win']
                  const isDisabled = platformOverride === null

                  return (
                    <ShortcutTile
                      key={def.id}
                      name={def.name}
                      shortcut={def.readonly ? (isMac ? def.defaultMac : def.defaultWin) : currentAccel}
                      active={currentAccel !== null}
                      onClick={() => !def.readonly && setRecordingShortcut({ id: def.id, name: def.name })}
                      onToggle={() => !def.readonly && handleToggle(def.id, currentAccel === null)}
                      disabled={def.readonly}
                      global={def.global}
                    />
                  )
                })}
            </div>
          </div>
        )
      })}

      {/* 录制弹窗 */}
      {recordingShortcut && (
        <RecordingModal
          shortcutId={recordingShortcut.id}
          shortcutName={recordingShortcut.name}
          onSave={(accelerator) => handleSaveShortcut(recordingShortcut.id, accelerator)}
          onCancel={() => setRecordingShortcut(null)}
        />
      )}

      {/* 恢复全部 */}
      {hasOverrides && (
        <button
          onClick={async () => {
            try {
              await window.electronAPI.updateSettings({ shortcutOverrides: {} })
              setOverrides({})
              updateShortcutOverrides({})
              await window.electronAPI.reregisterGlobalShortcuts()
              toast.success('已恢复默认')
            } catch {
              toast.error('恢复失败')
            }
          }}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <RotateCcw className="size-3" />
          恢复全部默认
        </button>
      )}
    </div>
  )
}

// ===== 快捷键卡片组件 =====

interface ShortcutTileProps {
  name: string
  shortcut?: string | null
  active: boolean
  onClick?: () => void
  onToggle?: () => void
  disabled?: boolean
  readonly?: boolean
  global?: boolean
}

function ShortcutTile({ name, shortcut, active, onClick, onToggle, disabled, readonly, global }: ShortcutTileProps): React.ReactElement {
  return (
    <div
      onClick={disabled || readonly ? undefined : onClick}
      className={cn(
        'rounded-lg p-3 transition-colors cursor-pointer',
        active ? 'bg-muted/40 border border-border/50' : 'bg-muted/20 border border-transparent',
        disabled && 'opacity-50 cursor-default',
        !disabled && !readonly && 'hover:bg-muted/60 hover:border-border/30'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm text-foreground truncate">{name}</span>
          {global && <span className="text-xs text-muted-foreground/50 shrink-0">全局</span>}
        </div>

        {/* 快捷键显示 */}
        <div className="shrink-0">
          {shortcut ? (
            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground">
              {getAcceleratorDisplay(shortcut)}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/50 italic">禁用</span>
          )}
        </div>
      </div>

      {/* 开关（非 readonly 时显示） */}
      {!readonly && onToggle && (
        <div className="mt-2 flex justify-end">
          <Switch checked={active} onCheckedChange={onToggle} className="scale-75" />
        </div>
      )}
    </div>
  )
}