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
} from 'lucide-react'
import * as React from 'react'

import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@tagent/ui'
import {
  SettingsCard,
  SettingsRow,
  SettingsSection,
  SettingsSelect,
  SettingsToggle,
} from './primitives'
import { UserAvatar } from '../shared/UserAvatar'

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
    <div className="space-y-6">
      {/* 用户档案 */}
      <SettingsSection title="用户档案" description="头像与昵称，用于会话中显示你的身份。">
        <div className="settings-card flex items-center gap-4 p-4">
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
      </SettingsSection>

      {/* 通用设置 */}
      <SettingsSection title="通用" description="语言、归档、通知等基础偏好。">
        <SettingsCard>
          <SettingsRow label="语言" icon={<Globe className="size-4" />}>
            <span className="text-xs text-muted-foreground">简体中文</span>
          </SettingsRow>
          <SettingsSelect
            label="自动归档"
            icon={<Clock className="size-4" />}
            description="会话超过指定天数未活动时自动归档，0 表示禁用。"
            value={String(archiveAfterDays)}
            onValueChange={handleArchiveDaysChange}
            options={[
              { value: '0', label: '禁用' },
              { value: '7', label: '7 天' },
              { value: '14', label: '14 天' },
              { value: '30', label: '30 天' },
              { value: '60', label: '60 天' },
            ]}
          />
          <SettingsToggle
            label="桌面通知"
            icon={<BellRing className="size-4" />}
            description="任务完成、权限审批等事件触发系统通知。"
            checked={notificationsEnabled}
            onCheckedChange={(checked) => {
              setNotificationsEnabled(checked)
              updateNotificationsEnabled(checked)
            }}
          />
          <SettingsToggle
            label="消息置顶条"
            icon={<StickyNote className="size-4" />}
            description="将指定用户消息置顶显示，方便对照需求写代码。"
            checked={stickyUserMessageEnabled}
            onCheckedChange={(checked) => {
              setStickyUserMessageEnabled(checked)
              updateStickyUserMessageEnabled(checked)
            }}
          />
        </SettingsCard>
      </SettingsSection>

      {/* 通知提示音 */}
      <SettingsSection
        title={
          <span className="flex items-center gap-2">
            <Volume2 className="size-4" />
            通知提示音
          </span>
        }
        description="为不同事件选择提示音，点击喇叭试听。"
      >
        <SettingsCard>
          <SettingsToggle
            label="启用提示音"
            description="开启后任务完成、权限审批等事件会播放提示音。"
            checked={notificationSoundEnabled}
            onCheckedChange={(checked) => {
              setNotificationSoundEnabled(checked)
              updateNotificationSoundEnabled(checked)
            }}
            disabled={!notificationsEnabled}
          />
        </SettingsCard>
        <SettingsCard>
          <SoundRow
            label="任务完成"
            type="taskComplete"
            sounds={notificationSounds}
            disabled={!notificationsEnabled || !notificationSoundEnabled}
            onSoundChange={async (type, soundId) => {
              const newSounds = await updateNotificationSound(type, soundId, notificationSounds)
              setNotificationSounds(newSounds)
            }}
          />
          <SoundRow
            label="权限审批"
            type="permissionRequest"
            sounds={notificationSounds}
            disabled={!notificationsEnabled || !notificationSoundEnabled}
            onSoundChange={async (type, soundId) => {
              const newSounds = await updateNotificationSound(type, soundId, notificationSounds)
              setNotificationSounds(newSounds)
            }}
          />
          <SoundRow
            label="计划审批"
            type="exitPlanMode"
            sounds={notificationSounds}
            disabled={!notificationsEnabled || !notificationSoundEnabled}
            onSoundChange={async (type, soundId) => {
              const newSounds = await updateNotificationSound(type, soundId, notificationSounds)
              setNotificationSounds(newSounds)
            }}
          />
        </SettingsCard>
      </SettingsSection>
    </div>
  )
}

// ===== 子组件 =====

interface SoundRowProps {
  label: string
  type: NotificationSoundType
  sounds: NotificationSoundSettings
  disabled?: boolean
  onSoundChange: (type: NotificationSoundType, soundId: NotificationSoundId) => void
}

function SoundRow({
  label,
  type,
  sounds,
  disabled,
  onSoundChange,
}: SoundRowProps): React.ReactElement {
  const currentId = sounds[type] ?? DEFAULT_NOTIFICATION_SOUNDS[type]

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-3',
        disabled && 'opacity-50 pointer-events-none'
      )}
    >
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <Select
          value={currentId}
          onValueChange={(v) => onSoundChange(type, v as NotificationSoundId)}
        >
          <SelectTrigger className="w-[120px] h-8 text-xs bg-transparent border-border/50">
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
          className="p-1.5 rounded hover:bg-muted disabled:opacity-50"
        >
          <Volume2 className="size-3.5 text-muted-foreground" />
        </button>
      </div>
    </div>
  )
}
