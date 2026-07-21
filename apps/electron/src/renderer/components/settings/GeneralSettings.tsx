/**
 * GeneralSettings - 通用设置页
 *
 * 档案卡片 + SettingsSection / Card / Row 标准栈。
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
} from '@tagent/ui'
import { UserAvatar } from '../shared/UserAvatar'
import {
  SettingsCard,
  SettingsRow,
  SettingsSection,
  SettingsSelect,
  SettingsToggle,
} from './primitives'
import { SettingsPage } from './SettingsPage'
import { SettingsPageIntro } from './SettingsPageIntro'

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
  const [showTokenPlanWarning, setShowTokenPlanWarning] = React.useState(true)
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
        setShowTokenPlanWarning(settings.showTokenPlanWarning ?? true)
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

  const handleTokenPlanWarningChange = async (checked: boolean): Promise<void> => {
    setShowTokenPlanWarning(checked)
    try {
      await window.electronAPI.updateSettings({ showTokenPlanWarning: checked })
    } catch (error) {
      console.error('[通用设置] 更新 Token Plan 提醒开关失败:', error)
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
    <SettingsPage>
      <SettingsPageIntro title="通用" description="档案、语言、归档与通知偏好" />

      <div className="settings-card settings-card-surface settings-identity-band">
        <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
          <PopoverTrigger asChild>
            <div className="settings-profile-avatar group/avatar relative shrink-0 cursor-pointer">
              <UserAvatar avatar={userProfile.avatar} size={48} />
              <div className="absolute inset-0 flex items-center justify-center rounded-[20%] bg-black/40 opacity-0 transition-opacity group-hover/avatar:opacity-100">
                <Camera className="size-4 text-white" />
              </div>
            </div>
          </PopoverTrigger>
          <PopoverContent
            side="right"
            align="start"
            sideOffset={8}
            className="settings-profile-popover w-auto overflow-hidden border-none p-0 shadow-xl"
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
              className="settings-profile-upload-btn flex w-full items-center justify-center gap-1.5 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
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

        <div className="settings-identity-copy">
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
                className="settings-profile-name-input w-[176px] text-base font-medium outline-none"
              />
              <button
                onClick={handleSaveName}
                className="settings-profile-action-btn settings-profile-action-btn--confirm"
              >
                <Check className="size-3.5 text-primary" />
              </button>
              <button
                onClick={() => {
                  setNameInput(userProfile.userName)
                  setIsEditingName(false)
                }}
                className="settings-profile-action-btn"
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
              className="settings-identity-name settings-profile-name-button transition-colors"
            >
              {userProfile.userName}
            </button>
          )}
          <p className="settings-identity-meta">点击头像或昵称，更新你的会话身份</p>
        </div>
        <div className="settings-identity-actions" aria-hidden="true" />
      </div>

      <SettingsSection title="偏好">
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
          <SettingsToggle
            label="Token Plan 消费提醒"
            icon={<Volume2 className="size-4" />}
            description="选择 Token Plan（按次计费）供应商时，提示 Agent 模式多轮调用会消耗大量配额。"
            checked={showTokenPlanWarning}
            onCheckedChange={handleTokenPlanWarningChange}
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="提示音" description="为不同事件选择提示音，点击喇叭试听。">
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
    </SettingsPage>
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
    <SettingsRow label={label} className={cn(disabled && 'opacity-50 pointer-events-none')}>
      <div className="flex items-center gap-1.5">
        <Select
          value={currentId}
          onValueChange={(v) => onSoundChange(type, v as NotificationSoundId)}
        >
          <SelectTrigger className="h-8 w-[120px] rounded-glass-popover border-border/50 bg-transparent text-xs">
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
          className="settings-profile-action-btn p-1.5 disabled:opacity-50"
        >
          <Volume2 className="size-3.5 text-muted-foreground" />
        </button>
      </div>
    </SettingsRow>
  )
}
