/**
 * BotHubSettings - 远程平台集成 Hub
 *
 * 采用卡片网格布局设计：
 * - 顶部：标题 + 已连接状态
 * - 中部：平台状态卡片网格（点击切换）
 * - 底部：选中平台的详细配置内容
 */

import { useAtomValue } from 'jotai'
import { Bot, Cable, Settings, Diamond } from 'lucide-react'
import * as React from 'react'

import { DingTalkSettings } from './DingTalkSettings'
import { FeishuSettings } from './FeishuSettings'
import { WeChatSettings } from './WeChatSettings'
import { BotDefaultSettings } from './BotDefaultSettings'
import { WpsSettings } from './WpsSettings'

import dingtalkLogo from '@/assets/bots/dingding.png'
import feishuLogo from '@/assets/bots/feishu.png'
import wechatLogo from '@/assets/bots/wechat.png'
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
    iconBgClass: 'bg-violet-500/10',
    accentColor: 'text-violet-600 dark:text-violet-400',
    Icon: Diamond,
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
  waiting_scan: { color: 'bg-amber-400', label: '等待扫码', dotClass: 'bg-amber-400 animate-pulse' },
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

// ===== 子组件 =====

/** 平台状态卡片 */
function PlatformCard({
  platform,
  status,
  onClick,
  isActive,
}: {
  platform: PlatformDef
  status?: string
  onClick: () => void
  isActive: boolean
}): React.ReactElement {
  const statusConfig = status ? (STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.disconnected) : null
  const isConnected = status === 'connected'

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex flex-col items-center justify-center p-4 rounded-xl transition-all duration-200 text-center cursor-pointer',
        'border border-transparent',
        isActive
          ? 'bg-muted/60 border-border/50 shadow-sm'
          : 'bg-muted/30 hover:bg-muted/50 hover:border-border/30',
      )}
    >
      {/* 状态指示点（仅平台卡片） */}
      {statusConfig && (
        <div className="absolute top-2.5 right-2.5">
          <span className={cn('w-2 h-2 rounded-full block', statusConfig.dotClass)} />
        </div>
      )}

      {/* 图标 */}
      <div className={cn('flex items-center justify-center w-11 h-11 rounded-xl mb-2.5', platform.iconBgClass)}>
        {platform.iconSrc ? (
          <img src={platform.iconSrc} alt={platform.name} className="w-7 h-7 object-contain" />
        ) : platform.Icon ? (
          <platform.Icon className="w-5 h-5 text-muted-foreground" />
        ) : (
          <Bot className="w-5 h-5 text-muted-foreground" />
        )}
      </div>

      {/* 平台名称 */}
      <div className="text-sm font-medium text-foreground">{platform.name}</div>

      {/* 描述或状态 */}
      <div className={cn('text-xs mt-0.5', isConnected ? platform.accentColor : 'text-muted-foreground')}>
        {statusConfig ? statusConfig.label : platform.description}
      </div>
    </button>
  )
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

  const platformStatuses = React.useMemo(() => ({
    feishu: getPlatformStatus(feishuBotStates),
    dingtalk: getPlatformStatus(dingtalkBotStates),
    wechat: wechatState.status,
    wps: wpsState.status,
  }), [feishuBotStates, dingtalkBotStates, wechatState.status, wpsState.status])

  const connectedCount = Object.values(platformStatuses).filter((s) => s === 'connected').length

  return (
    <div className="space-y-6 -mx-6 -my-4 px-6 py-4">
      {/* 标题区 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Cable className="w-5 h-5" />
            远程平台
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            连接第三方平台，在飞书、微信、钉钉中使用 TAgent
          </p>
        </div>
        {connectedCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {connectedCount} 个平台已连接
          </div>
        )}
      </div>

      {/* 平台卡片网格 */}
      <div className="grid grid-cols-5 gap-3">
        {PLATFORMS.map((platform) => (
          <PlatformCard
            key={platform.id}
            platform={platform}
            status={platformStatuses[platform.id as 'feishu' | 'dingtalk' | 'wechat' | 'wps']}
            onClick={() => setSelectedPlatform(platform.id)}
            isActive={selectedPlatform === platform.id}
          />
        ))}
        {OTHER_CARDS.map((card) => (
          <PlatformCard
            key={card.id}
            platform={card}
            onClick={() => setSelectedPlatform(card.id)}
            isActive={selectedPlatform === card.id}
          />
        ))}
      </div>

      {/* 分隔线 */}
      <div className="border-t border-border/50" />

      {/* 内容面板 */}
      <div className="min-h-[400px]">
        {renderPlatformPanel(selectedPlatform)}
      </div>
    </div>
  )
}
