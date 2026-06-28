/**
 * GeneralSettings - 通用设置页
 *
 * TAgent 风格设计：
 * - 顶部：用户档案（紧凑卡片）
 * - 中部：设置网格布局（2列）
 * - 信息密度更高，去除冗余描述
 */

import data from '@emoji-mart/data'
import Picker from '@emoji-mart/react'
import { useAtom } from 'jotai'
import {
  Camera,
  ImagePlus,
  Volume2,
  BellRing,
  Clock,
  StickyNote,
  Globe,
  Check,
  X,
  XIcon,
} from 'lucide-react'
import * as React from 'react'

import { UserAvatar } from '../shared/UserAvatar'
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Switch } from '../ui/switch'

import type {
  NotificationSoundId,
  NotificationSoundType,
  NotificationSoundSettings,
} from '@/types/settings'

import {
  notificationsEnabledAtom,
  notificationSoundEnabledAtom,
  notificationSoundsAtom,
  updateNotificationsEnabled,
  updateNotificationSoundEnabled,
  updateNotificationSound,
  playNotificationSound,
  NOTIFICATION_SOUNDS,
  DEFAULT_NOTIFICATION_SOUNDS,
} from '@/atoms/notifications'
import {
  stickyUserMessageEnabledAtom,
  updateStickyUserMessageEnabled,
} from '@/atoms/ui-preferences'
import { userProfileAtom } from '@/atoms/user-profile'
import { cn } from '@/lib/utils'

interface EmojiMartEmoji {
  id: string
  name: string
  native: string
}

export function GeneralSettings(): React.ReactElement {
  const [userProfile, setUserProfile] = useAtom(userProfileAtom)
  const [notificationsEnabled, setNotificationsEnabled] = useAtom(notificationsEnabledAtom)
  const [notificationSoundEnabled, setNotificationSoundEnabled] = useAtom(
    notificationSoundEnabledAtom
  )
  const [notificationSounds, setNotificationSounds] = useAtom(notificationSoundsAtom)
  const [stickyUserMessageEnabled, setStickyUserMessageEnabled] = useAtom(
    stickyUserMessageEnabledAtom
  )
  const [isEditingName, setIsEditingName] = React.useState(false)
  const [nameInput, setNameInput] = React.useState(userProfile.userName)
  const [showEmojiPicker, setShowEmojiPicker] = React.useState(false)
  const [archiveAfterDays, setArchiveAfterDays] = React.useState<number>(7)
  const [closeAction, setCloseAction] = React.useState<string>('ask')
  const [isDarkMode, setIsDarkMode] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // 监听主题变化
  React.useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'))
    }
    checkDarkMode()

    // 监听 class 变化
    const observer = new MutationObserver(checkDarkMode)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  React.useEffect(() => {
    window.electronAPI
      .getSettings()
      .then((settings) => {
        setArchiveAfterDays(settings.archiveAfterDays ?? 7)
        setCloseAction(settings.closeAction ?? 'ask')
      })
      .catch(console.error)
  }, [])

  const handleArchiveDaysChange = async (value: string): Promise<void> => {
    const days = parseInt(value, 10)
    setArchiveAfterDays(days)
    try {
      await window.electronAPI.updateSettings({ archiveAfterDays: days })
    } catch (error) {
      console.error('[通用设置] 更新归档天数失败:', error)
    }
  }

  const handleCloseActionChange = async (value: string): Promise<void> => {
    setCloseAction(value)
    try {
      await window.electronAPI.updateSettings({
        closeAction: value === 'ask' ? undefined : (value as 'minimize-to-tray' | 'quit'),
      })
    } catch (error) {
      console.error('[通用设置] 更新关闭行为失败:', error)
    }
  }

  const handleAvatarChange = async (avatar: string): Promise<void> => {
    try {
      const updated = await window.electronAPI.updateUserProfile({ avatar })
      setUserProfile(updated)
      setShowEmojiPicker(false)
    } catch (error) {
      console.error('[通用设置] 更新头像失败:', error)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result as string
      await handleAvatarChange(dataUrl)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleSaveName = async (): Promise<void> => {
    const trimmed = nameInput.trim()
    if (!trimmed) return
    try {
      const updated = await window.electronAPI.updateUserProfile({ userName: trimmed })
      setUserProfile(updated)
      setIsEditingName(false)
    } catch (error) {
      console.error('[通用设置] 更新用户名失败:', error)
    }
  }

  return (
    <div className="space-y-5">
      {/* 用户档案 - 紧凑行 */}
      <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/40 border border-border/30">
        <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
          <PopoverTrigger asChild>
            <div className="relative group/avatar cursor-pointer shrink-0">
              <UserAvatar avatar={userProfile.avatar} size={48} />
              <div className="absolute inset-0 rounded-[20%] flex items-center justify-center bg-black/40 opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                <Camera className="size-4 text-white" />
              </div>
            </div>
          </PopoverTrigger>
          <PopoverContent
            side="right"
            align="start"
            sideOffset={8}
            className="w-auto p-0 border-none shadow-xl overflow-hidden"
            onWheel={(e) => e.stopPropagation()}
          >
            <Picker
              data={data}
              onEmojiSelect={(emoji: EmojiMartEmoji) => handleAvatarChange(emoji.native)}
              locale="zh"
              theme={isDarkMode ? 'dark' : 'light'}
              previewPosition="none"
              skinTonePosition="none"
              perLine={8}
              maxFrequentRows={2}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <ImagePlus className="size-3.5" />
              上传图片
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              className="hidden"
              onChange={handleImageUpload}
            />
          </PopoverContent>
        </Popover>

        <div className="flex-1 min-w-0">
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName()
                  if (e.key === 'Escape') {
                    setNameInput(userProfile.userName)
                    setIsEditingName(false)
                  }
                }}
                maxLength={30}
                autoFocus
                className="text-base font-medium bg-transparent border-b border-primary outline-none w-[140px]"
              />
              <button onClick={handleSaveName} className="p-1 hover:bg-muted rounded">
                <Check className="size-3.5 text-primary" />
              </button>
              <button
                onClick={() => {
                  setNameInput(userProfile.userName)
                  setIsEditingName(false)
                }}
                className="p-1 hover:bg-muted rounded"
              >
                <X className="size-3.5 text-muted-foreground" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setNameInput(userProfile.userName)
                setIsEditingName(true)
              }}
              className="text-base font-medium text-foreground hover:text-primary transition-colors"
            >
              {userProfile.userName}
            </button>
          )}
        </div>
      </div>

      {/* 设置网格 - 2列布局 */}
      <div className="grid grid-cols-2 gap-3">
        {/* 语言 */}
        <SettingTile icon={<Globe className="size-4" />} label="语言" value="简体中文" />

        {/* 自动归档 */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
            <Clock className="size-4 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground">自动归档</div>
          </div>
          <Select value={String(archiveAfterDays)} onValueChange={handleArchiveDaysChange}>
            <SelectTrigger className="w-[80px] h-7 text-xs bg-transparent border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">禁用</SelectItem>
              <SelectItem value="7">7天</SelectItem>
              <SelectItem value="14">14天</SelectItem>
              <SelectItem value="30">30天</SelectItem>
              <SelectItem value="60">60天</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 关闭窗口行为 */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0">
            <XIcon className="size-4 text-rose-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground">关闭窗口</div>
          </div>
          <Select value={closeAction} onValueChange={handleCloseActionChange}>
            <SelectTrigger className="w-[110px] h-7 text-xs bg-transparent border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ask">每次询问</SelectItem>
              <SelectItem value="minimize-to-tray">最小化到托盘</SelectItem>
              <SelectItem value="quit">退出程序</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 桌面通知 */}
        <SettingToggleTile
          icon={<BellRing className="size-4" />}
          label="桌面通知"
          checked={notificationsEnabled}
          onToggle={(checked) => {
            setNotificationsEnabled(checked)
            updateNotificationsEnabled(checked)
          }}
        />

        {/* 消息置顶条 */}
        <SettingToggleTile
          icon={<StickyNote className="size-4" />}
          label="消息置顶条"
          checked={stickyUserMessageEnabled}
          onToggle={(checked) => {
            setStickyUserMessageEnabled(checked)
            updateStickyUserMessageEnabled(checked)
          }}
        />
      </div>

      {/* 通知音效 - 展开 */}
      <div className="rounded-lg bg-muted/30 border border-border/30 overflow-hidden">
        {/* 音效开关 */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Volume2 className="size-4 text-purple-600" />
            </div>
            <div className="text-sm font-medium text-foreground">通知提示音</div>
          </div>
          <Switch
            checked={notificationSoundEnabled}
            disabled={!notificationsEnabled}
            onCheckedChange={(checked) => {
              setNotificationSoundEnabled(checked)
              updateNotificationSoundEnabled(checked)
            }}
          />
        </div>

        {/* 音效选择器 */}
        <div
          className={cn(
            'px-3 py-2 space-y-2',
            (!notificationsEnabled || !notificationSoundEnabled) && 'opacity-50 pointer-events-none'
          )}
        >
          <SoundRow
            label="任务完成"
            type="taskComplete"
            sounds={notificationSounds}
            onSoundChange={async (type, soundId) => {
              const newSounds = await updateNotificationSound(type, soundId, notificationSounds)
              setNotificationSounds(newSounds)
            }}
          />
          <SoundRow
            label="权限审批"
            type="permissionRequest"
            sounds={notificationSounds}
            onSoundChange={async (type, soundId) => {
              const newSounds = await updateNotificationSound(type, soundId, notificationSounds)
              setNotificationSounds(newSounds)
            }}
          />
          <SoundRow
            label="计划审批"
            type="exitPlanMode"
            sounds={notificationSounds}
            onSoundChange={async (type, soundId) => {
              const newSounds = await updateNotificationSound(type, soundId, notificationSounds)
              setNotificationSounds(newSounds)
            }}
          />
        </div>
      </div>
    </div>
  )
}

// ===== 子组件 =====

interface SettingTileProps {
  icon: React.ReactNode
  label: string
  value: string
}

function SettingTile({ icon, label, value }: SettingTileProps): React.ReactElement {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground">{label}</div>
      </div>
      <span className="text-xs text-muted-foreground">{value}</span>
    </div>
  )
}

interface SettingToggleTileProps {
  icon: React.ReactNode
  label: string
  checked: boolean
  onToggle: (checked: boolean) => void
}

function SettingToggleTile({
  icon,
  label,
  checked,
  onToggle,
}: SettingToggleTileProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={() => onToggle(!checked)}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg transition-colors text-left w-full',
        checked ? 'bg-muted/50 border border-border/50' : 'bg-muted/30 hover:bg-muted/50'
      )}
    >
      <div
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
          checked ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'
        )}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground">{label}</div>
      </div>
      <div
        className={cn(
          'w-4 h-4 rounded-full flex items-center justify-center shrink-0',
          checked ? 'bg-emerald-500' : 'bg-muted-foreground/30'
        )}
      >
        {checked && <Check className="size-2.5 text-white" />}
      </div>
    </button>
  )
}

interface SoundRowProps {
  label: string
  type: NotificationSoundType
  sounds: NotificationSoundSettings
  onSoundChange: (type: NotificationSoundType, soundId: NotificationSoundId) => void
}

function SoundRow({ label, type, sounds, onSoundChange }: SoundRowProps): React.ReactElement {
  const currentId = sounds[type] ?? DEFAULT_NOTIFICATION_SOUNDS[type]

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <Select
          value={currentId}
          onValueChange={(v) => onSoundChange(type, v as NotificationSoundId)}
        >
          <SelectTrigger className="w-[90px] h-6 text-xs bg-transparent border-border/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {NOTIFICATION_SOUNDS.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
              </SelectItem>
            ))}
            <SelectItem value="none">无</SelectItem>
          </SelectContent>
        </Select>
        <button
          type="button"
          onClick={() => playNotificationSound(currentId)}
          disabled={currentId === 'none'}
          className="p-1 rounded hover:bg-muted disabled:opacity-50"
        >
          <Volume2 className="size-3 text-muted-foreground" />
        </button>
      </div>
    </div>
  )
}
