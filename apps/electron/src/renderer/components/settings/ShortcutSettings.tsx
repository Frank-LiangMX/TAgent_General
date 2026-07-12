/**
 * ShortcutSettings — 快捷键设置
 *
 * 与其他设置页统一：SettingsSection + SettingsCard + SettingsRow。
 * 点击右侧键位胶囊可录制；开关控制启用。
 */

import { useAtom } from 'jotai'
import { RotateCcw } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import {
  Button,
  Switch,
  SettingsCard,
  SettingsRow,
  SettingsSection,
  SettingsSegmentedControl,
} from '@tagent/ui'
import type { ShortcutCategory, ShortcutOverrides } from '@/lib/shortcut-defaults'

import { shortcutOverridesAtom, sendWithCmdEnterAtom } from '@/atoms/shortcut-atoms'
import { DEFAULT_SHORTCUTS, SHORTCUT_CATEGORY_LABELS } from '@/lib/shortcut-defaults'
import {
  getActiveAccelerator,
  getAcceleratorDisplay,
  checkConflict,
  updateShortcutOverrides,
  isMac,
} from '@/lib/shortcut-registry'
import { cn } from '@/lib/utils'

// ===== 快捷键录制弹窗 =====

interface RecordingModalProps {
  shortcutId: string
  shortcutName: string
  onSave: (accelerator: string) => Promise<boolean>
  onCancel: () => void
}

function RecordingModal({
  shortcutId,
  shortcutName,
  onSave,
  onCancel,
}: RecordingModalProps): React.ReactElement {
  const [pendingKeys, setPendingKeys] = React.useState('')
  const [conflict, setConflict] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const pendingKeysRef = React.useRef('')

  const normalizeKey = React.useCallback((rawKey: string): string => {
    if (rawKey === ' ') return 'Space'
    if (rawKey === '+') return 'Plus'
    if (rawKey.length === 1) return rawKey.toUpperCase()
    const keyMap: Record<string, string> = {
      ArrowUp: 'Up',
      ArrowDown: 'Down',
      ArrowLeft: 'Left',
      ArrowRight: 'Right',
      Escape: 'Esc',
      Backspace: 'Backspace',
      Delete: 'Delete',
      Enter: 'Enter',
      Tab: 'Tab',
    }
    return keyMap[rawKey] ?? rawKey
  }, [])

  const isStandaloneKeyAllowed = React.useCallback(
    (key: string): boolean => /^F(?:[1-9]|1[0-9]|2[0-4])$/i.test(key),
    []
  )

  const finishCapture = React.useCallback(
    (accelerator: string) => {
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
    },
    [shortcutId]
  )

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

  const handleSave = async (): Promise<void> => {
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
      <div className="session-glass-surface session-glass-modal relative w-[min(320px,90vw)] p-5 animate-in zoom-in-95 duration-150">
        <div className="text-sm font-medium md-text mb-3">{shortcutName}</div>

        <div
          className={cn(
            'rounded-xl px-3 py-4 text-center mb-4 border',
            conflict
              ? 'bg-destructive/8 border-destructive/20'
              : pendingKeys
                ? 'bg-muted/50 border-border/50'
                : 'bg-muted/30 border-border/40'
          )}
        >
          {conflict ? (
            <div className="text-destructive text-xs leading-relaxed">
              <span className="font-mono">{getAcceleratorDisplay(pendingKeys)}</span>
              <span className="ml-1.5">与「{conflict}」冲突</span>
            </div>
          ) : pendingKeys ? (
            <span className="font-mono text-sm md-text">
              {getAcceleratorDisplay(pendingKeys)}
            </span>
          ) : (
            <span className="text-xs md-text-faint">按下快捷键组合…</span>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" className="rounded-xl" onClick={onCancel}>
            取消
          </Button>
          <Button
            type="button"
            size="sm"
            className="rounded-xl"
            onClick={() => void handleSave()}
            disabled={!!(!pendingKeys || conflict || saving)}
          >
            {saving ? '保存中…' : '保存'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ===== 键位胶囊 =====

function ShortcutKeycap({
  label,
  muted,
  onClick,
  disabled,
}: {
  label: string
  muted?: boolean
  onClick?: () => void
  disabled?: boolean
}): React.ReactElement {
  const Comp = onClick && !disabled ? 'button' : 'span'
  return (
    <Comp
      type={onClick && !disabled ? 'button' : undefined}
      onClick={disabled ? undefined : onClick}
      className={cn(
        'inline-flex items-center justify-center min-w-[3.5rem] h-7 px-2.5 rounded-lg text-[11px] font-mono tabular-nums border transition-colors',
        muted
          ? 'border-transparent bg-muted/40 md-text-faint italic'
          : 'border-border/50 bg-muted/45 md-text-variant',
        onClick &&
          !disabled &&
          'cursor-pointer hover:bg-accent hover:border-border/70 hover:text-foreground',
        disabled && 'cursor-default opacity-70'
      )}
    >
      {label}
    </Comp>
  )
}

// ===== 主组件 =====

export function ShortcutSettings(): React.ReactElement {
  const [overrides, setOverrides] = useAtom(shortcutOverridesAtom)
  const [sendWithCmdEnter, setSendWithCmdEnter] = useAtom(sendWithCmdEnterAtom)
  const [recordingShortcut, setRecordingShortcut] = React.useState<{
    id: string
    name: string
  } | null>(null)

  const grouped = React.useMemo(() => {
    const groups = new Map<ShortcutCategory, typeof DEFAULT_SHORTCUTS>()
    for (const def of DEFAULT_SHORTCUTS) {
      const list = groups.get(def.category) ?? []
      list.push(def)
      groups.set(def.category, list)
    }
    return groups
  }, [])

  const reregisterGlobalShortcut = React.useCallback(
    async (shortcutId: string): Promise<boolean> => {
      const def = DEFAULT_SHORTCUTS.find((s) => s.id === shortcutId)
      if (!def?.global) return true
      const results = await window.electronAPI.reregisterGlobalShortcuts()
      return results[shortcutId] !== false
    },
    []
  )

  const handleSaveShortcut = React.useCallback(
    async (shortcutId: string, accelerator: string): Promise<boolean> => {
      const key = isMac ? 'mac' : 'win'
      const newOverrides: ShortcutOverrides = {
        ...overrides,
        [shortcutId]: { ...overrides[shortcutId], [key]: accelerator },
      }
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
    },
    [overrides, reregisterGlobalShortcut, setOverrides]
  )

  const handleToggle = React.useCallback(
    async (shortcutId: string, enable: boolean) => {
      const key = isMac ? 'mac' : 'win'
      const newOverrides: ShortcutOverrides = enable
        ? { ...overrides, [shortcutId]: { ...overrides[shortcutId], [key]: undefined } }
        : { ...overrides, [shortcutId]: { ...overrides[shortcutId], [key]: null } }

      if (enable && newOverrides[shortcutId]?.[key] === undefined) {
        const cleanOverrides = { ...newOverrides }
        delete cleanOverrides[shortcutId]
        try {
          await window.electronAPI.updateSettings({ shortcutOverrides: cleanOverrides })
          setOverrides(cleanOverrides)
          updateShortcutOverrides(cleanOverrides)
          const def = DEFAULT_SHORTCUTS.find((s) => s.id === shortcutId)
          if (def?.global) await reregisterGlobalShortcut(shortcutId)
        } catch {
          toast.error('操作失败')
        }
      } else {
        try {
          await window.electronAPI.updateSettings({ shortcutOverrides: newOverrides })
          setOverrides(newOverrides)
          updateShortcutOverrides(newOverrides)
          const def = DEFAULT_SHORTCUTS.find((s) => s.id === shortcutId)
          if (def?.global) await reregisterGlobalShortcut(shortcutId)
        } catch {
          toast.error('操作失败')
        }
      }
    },
    [overrides, reregisterGlobalShortcut, setOverrides]
  )

  const handleSendKeyChange = React.useCallback(
    (value: string) => {
      const next = value === 'cmd-enter'
      setSendWithCmdEnter(next)
      window.electronAPI
        .updateSettings({ sendWithCmdEnter: next })
        .then(() => toast.success('已保存'))
        .catch(() => toast.error('保存失败'))
    },
    [setSendWithCmdEnter]
  )

  const hasOverrides = Object.keys(overrides).length > 0
  const categoryOrder: ShortcutCategory[] = ['app', 'navigation', 'edit', 'global']

  return (
    <div className="space-y-6">
      <SettingsSection
        title="发送消息"
        description="选择在输入框中发送消息的快捷键"
      >
        <SettingsCard>
          <SettingsSegmentedControl
            label="发送快捷键"
            description="Enter 直接发送，或使用修饰键+Enter"
            value={sendWithCmdEnter ? 'cmd-enter' : 'enter'}
            onValueChange={handleSendKeyChange}
            options={[
              { value: 'enter', label: 'Enter' },
              { value: 'cmd-enter', label: `${isMac ? '⌘' : 'Ctrl'}+Enter` },
            ]}
          />
        </SettingsCard>
      </SettingsSection>

      {categoryOrder.map((category) => {
        const shortcuts = grouped.get(category)
        if (!shortcuts) return null

        const visible = shortcuts.filter(
          (def) => !def.readonly || (isMac ? def.defaultMac : def.defaultWin)
        )
        if (visible.length === 0) return null

        return (
          <SettingsSection key={category} title={SHORTCUT_CATEGORY_LABELS[category]}>
            <SettingsCard>
              {visible.map((def) => {
                const currentAccel = getActiveAccelerator(def.id)
                const platformOverride = overrides[def.id]?.[isMac ? 'mac' : 'win']
                const isDisabled = platformOverride === null
                const display =
                  def.readonly
                    ? (isMac ? def.defaultMac : def.defaultWin)
                    : currentAccel

                return (
                  <SettingsRow
                    key={def.id}
                    label={def.name}
                    description={
                      def.global
                        ? '全局快捷键，应用未聚焦时也可触发'
                        : def.readonly
                          ? '系统保留，不可修改'
                          : undefined
                    }
                  >
                    <div className="flex items-center gap-2.5">
                      <ShortcutKeycap
                        label={
                          display
                            ? getAcceleratorDisplay(display)
                            : isDisabled
                              ? '已禁用'
                              : '点击设置'
                        }
                        muted={!display}
                        disabled={def.readonly}
                        onClick={
                          def.readonly
                            ? undefined
                            : () => setRecordingShortcut({ id: def.id, name: def.name })
                        }
                      />
                      {!def.readonly && (
                        <Switch
                          checked={currentAccel !== null}
                          onCheckedChange={(checked) => void handleToggle(def.id, checked)}
                        />
                      )}
                    </div>
                  </SettingsRow>
                )
              })}
            </SettingsCard>
          </SettingsSection>
        )
      })}

      {recordingShortcut && (
        <RecordingModal
          shortcutId={recordingShortcut.id}
          shortcutName={recordingShortcut.name}
          onSave={(accelerator) => handleSaveShortcut(recordingShortcut.id, accelerator)}
          onCancel={() => setRecordingShortcut(null)}
        />
      )}

      {hasOverrides && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-xl text-muted-foreground"
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
          >
            <RotateCcw className="size-3.5" />
            恢复全部默认
          </Button>
        </div>
      )}
    </div>
  )
}
