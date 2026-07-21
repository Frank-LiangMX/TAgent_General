/**
 * BotHubSettings - 远程平台集成 Hub
 *
 * SettingsPage + 平台 Section（网格选择）+ 下方平台详情面板。
 */

import { useAtomValue } from 'jotai'
import { Bot, Settings } from 'lucide-react'
import * as React from 'react'

import { BotDefaultSettings } from './BotDefaultSettings'
import { DingTalkSettings } from './DingTalkSettings'
import { FeishuSettings } from './FeishuSettings'
import { WeChatSettings } from './WeChatSettings'
import { WpsSettings } from './WpsSettings'
import { SettingsPage } from './SettingsPage'
import { SettingsPageIntro } from './SettingsPageIntro'

import dingtalkLogo from '@/assets/bots/dingding.png'
import feishuLogo from '@/assets/bots/feishu.png'
import wechatLogo from '@/assets/bots/wechat.png'
import wpsLogo from '@/assets/bots/wps.png'
import { dingtalkBotStatesAtom } from '@/atoms/dingtalk-atoms'
import { feishuBotStatesAtom } from '@/atoms/feishu-atoms'
import { wechatBridgeStateAtom } from '@/atoms/wechat-atoms'
import { wpsBridgeStateAtom } from '@/atoms/wps-atoms'
import { cn } from '@/lib/utils'

// ===== 类型 =====

type PlatformId = 'feishu' | 'wechat' | 'dingtalk' | 'wps' | 'defaults'

interface PlatformDef {
  id: PlatformId
  name: string
  description: string
  iconSrc?: string
  iconBgClass: string
  accentColor: string
  Icon?: typeof Bot
}

// ===== 平台定义 =====

const PLATFORMS: readonly PlatformDef[] = [
  {
    id: 'feishu',
    name: '飞书',
    description: '企业协作平台',
    iconSrc: feishuLogo,
    iconBgClass: 'bg-blue-500/10',
    accentColor: 'text-blue-600 dark:text-blue-400',
  },
  {
    id: 'wechat',
    name: '微信',
    description: '扫码登录控制',
    iconSrc: wechatLogo,
    iconBgClass: 'bg-green-500/10',
    accentColor: 'text-green-600 dark:text-green-400',
  },
  {
    id: 'dingtalk',
    name: '钉钉',
    description: '多 Bot 管理',
    iconSrc: dingtalkLogo,
    iconBgClass: 'bg-orange-500/10',
    accentColor: 'text-orange-600 dark:text-orange-400',
  },
  {
    id: 'wps',
    name: 'WPS 协作',
    description: 'WPS365 远程连通',
    iconSrc: wpsLogo,
    iconBgClass: 'bg-violet-500/10',
    accentColor: 'text-violet-600 dark:text-violet-400',
  },
]

const OTHER_CARDS: readonly PlatformDef[] = [
  {
    id: 'defaults',
    name: '用法设置',
    description: '默认行为配置',
    iconBgClass: 'bg-muted',
    accentColor: 'text-muted-foreground',
    Icon: Settings,
  },
]

/** 连接状态配置 */
const STATUS_CONFIG = {
  disconnected: { color: 'bg-slate-400', label: '未连接', dotClass: 'bg-slate-400' },
  connecting: { color: 'bg-amber-400', label: '连接中', dotClass: 'bg-amber-400 animate-pulse' },
  connected: { color: 'bg-emerald-500', label: '已连接', dotClass: 'bg-emerald-500' },
  error: { color: 'bg-red-500', label: '错误', dotClass: 'bg-red-500' },
  waiting_scan: {
    color: 'bg-amber-400',
    label: '等待扫码',
    dotClass: 'bg-amber-400 animate-pulse',
  },
  scanned: { color: 'bg-blue-400', label: '已扫码', dotClass: 'bg-blue-400 animate-pulse' },
} as const

// ===== 工具函数 =====

/** 从多 Bot 状态推导平台级状态 */
function getPlatformStatus(states: Record<string, { status: string }>): string {
  const values = Object.values(states)
  if (values.length === 0) return 'disconnected'
  if (values.some((s) => s.status === 'connected')) return 'connected'
  if (values.some((s) => s.status === 'error')) return 'error'
  if (values.some((s) => s.status === 'connecting')) return 'connecting'
  return 'disconnected'
}

/** 根据平台 ID 渲染对应设置组件 */
function renderPlatformPanel(id: PlatformId): React.ReactElement {
  switch (id) {
    case 'feishu':
      return <FeishuSettings />
    case 'wechat':
      return <WeChatSettings />
    case 'dingtalk':
      return <DingTalkSettings />
    case 'wps':
      return <WpsSettings />
    case 'defaults':
      return <BotDefaultSettings />
  }
}

// ===== 主组件 =====

export function BotHubSettings(): React.ReactElement {
  const [selectedPlatform, setSelectedPlatform] = React.useState<PlatformId>('feishu')

  // 获取各平台状态
  const feishuBotStates = useAtomValue(feishuBotStatesAtom)
  const dingtalkBotStates = useAtomValue(dingtalkBotStatesAtom)
  const wechatState = useAtomValue(wechatBridgeStateAtom)
  const wpsState = useAtomValue(wpsBridgeStateAtom)

  const platformStatuses = React.useMemo(
    () => ({
      feishu: getPlatformStatus(feishuBotStates),
      dingtalk: getPlatformStatus(dingtalkBotStates),
      wechat: wechatState.status,
      wps: wpsState.status,
    }),
    [feishuBotStates, dingtalkBotStates, wechatState.status, wpsState.status]
  )

  const connectedCount = Object.values(platformStatuses).filter((s) => s === 'connected').length
  const switcherItems = [...PLATFORMS, ...OTHER_CARDS]

  return (
    <SettingsPage>
      <SettingsPageIntro
        title="远程"
        description="连接飞书、微信、钉钉与 WPS，让 TAgent 在协作平台中保持在线。"
        action={
          connectedCount > 0 ? (
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              {connectedCount} 个平台已连接
            </div>
          ) : undefined
        }
      />

      <div className="settings-platform-switcher" role="tablist" aria-label="远程平台">
        {switcherItems.map((platform) => {
          const status =
            platform.id === 'defaults'
              ? undefined
              : platformStatuses[platform.id as keyof typeof platformStatuses]
          const statusConfig = status
            ? (STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.disconnected)
            : null
          const PlatformIcon = platform.Icon ?? Bot

          return (
            <button
              key={platform.id}
              type="button"
              role="tab"
              aria-selected={selectedPlatform === platform.id}
              data-active={selectedPlatform === platform.id}
              onClick={() => setSelectedPlatform(platform.id)}
              className="settings-platform-chip"
            >
              <span
                className={cn('grid size-6 place-items-center rounded-md', platform.iconBgClass)}
              >
                {platform.iconSrc ? (
                  <img src={platform.iconSrc} alt="" className="size-4 rounded object-contain" />
                ) : (
                  <PlatformIcon className="size-3.5" />
                )}
              </span>
              <span>{platform.name}</span>
              {statusConfig ? (
                <span
                  className={cn('settings-platform-chip-dot', statusConfig.dotClass)}
                  title={statusConfig.label}
                />
              ) : null}
            </button>
          )
        })}
      </div>

      <div className="settings-platform-panel">{renderPlatformPanel(selectedPlatform)}</div>
    </SettingsPage>
  )
}
