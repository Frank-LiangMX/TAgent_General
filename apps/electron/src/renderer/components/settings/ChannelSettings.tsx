/**
 * ChannelSettings - 渠道配置页
 *
 * kscc 内网内置渠道单独区块；其余 AI 供应商配置在下方列表管理。
 */

import { PROVIDER_LABELS, isAgentCompatibleProvider } from '@tagent/shared'
import { useAtom, useSetAtom } from 'jotai'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import * as React from 'react'

import { ChannelForm } from './ChannelForm'
import { KsccChannelForm } from './KsccChannelForm'
import { SettingsSection, SettingsCard, SettingsRow } from './primitives'

import type { Channel } from '@tagent/shared'

import { agentChannelIdAtom, agentModelIdAtom, agentChannelIdsAtom } from '@/atoms/agent-atoms'
import { channelsAtom } from '@/atoms/model-atoms'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { KsccInstallGuide } from '@/components/agent/KsccInstallGuide'
import { getChannelLogo } from '@/lib/model-logo'

/** 组件视图模式 */
type ViewMode = 'list' | 'create' | 'edit' | 'edit-kscc'

export function ChannelSettings(): React.ReactElement {
  const [channels, setChannels] = React.useState<Channel[]>([])
  const [viewMode, setViewMode] = React.useState<ViewMode>('list')
  const [editingChannel, setEditingChannel] = React.useState<Channel | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [agentChannelId, setAgentChannelId] = useAtom(agentChannelIdAtom)
  const [, setAgentModelId] = useAtom(agentModelIdAtom)
  const [agentChannelIds, setAgentChannelIds] = useAtom(agentChannelIdsAtom)
  const setGlobalChannels = useSetAtom(channelsAtom)
  const [deleteTarget, setDeleteTarget] = React.useState<Channel | null>(null)
  const [ksccGuideOpen, setKsccGuideOpen] = React.useState(false)
  const agentChannelIdsRef = React.useRef(agentChannelIds)
  const agentChannelIdRef = React.useRef(agentChannelId)

  React.useEffect(() => {
    agentChannelIdsRef.current = agentChannelIds
  }, [agentChannelIds])

  React.useEffect(() => {
    agentChannelIdRef.current = agentChannelId
  }, [agentChannelId])

  const ksccChannel = React.useMemo(
    () => channels.find((c) => c.provider === 'kscc-internal'),
    [channels]
  )
  const otherChannels = React.useMemo(
    () => channels.filter((c) => c.provider !== 'kscc-internal'),
    [channels]
  )

  const loadChannels = React.useCallback(async (): Promise<Channel[]> => {
    try {
      const list = await window.electronAPI.listChannels()
      setChannels(list)
      setGlobalChannels(list)
      return list
    } catch (error) {
      console.error('[渠道设置] 加载渠道列表失败:', error)
      return []
    } finally {
      setLoading(false)
    }
  }, [setGlobalChannels])

  React.useEffect(() => {
    loadChannels()
  }, [loadChannels])

  const syncAgentChannelEligibility = React.useCallback(
    async (channel: Channel, eligible: boolean): Promise<void> => {
      const currentIds = agentChannelIdsRef.current

      if (eligible) {
        if (currentIds.includes(channel.id)) return
        const newIds = [...currentIds, channel.id]
        agentChannelIdsRef.current = newIds
        setAgentChannelIds(newIds)
        await window.electronAPI.updateSettings({ agentChannelIds: newIds }).catch(console.error)
        return
      }

      if (!currentIds.includes(channel.id)) return
      const newIds = currentIds.filter((id) => id !== channel.id)
      agentChannelIdsRef.current = newIds
      setAgentChannelIds(newIds)

      const updates: Parameters<typeof window.electronAPI.updateSettings>[0] = {
        agentChannelIds: newIds,
      }
      if (agentChannelIdRef.current === channel.id) {
        agentChannelIdRef.current = null
        setAgentChannelId(null)
        setAgentModelId(null)
        updates.agentChannelId = undefined
        updates.agentModelId = undefined
      }

      await window.electronAPI.updateSettings(updates).catch(console.error)
    },
    [setAgentChannelIds, setAgentChannelId, setAgentModelId]
  )

  const handleDeleteRequest = (channel: Channel): void => {
    setDeleteTarget(channel)
  }

  const handleDeleteConfirm = async (): Promise<void> => {
    if (!deleteTarget) return
    const target = deleteTarget
    try {
      await window.electronAPI.deleteChannel(target.id)

      const newIds = agentChannelIds.filter((id) => id !== target.id)
      setAgentChannelIds(newIds)

      if (agentChannelId === target.id) {
        setAgentChannelId(null)
        setAgentModelId(null)
      }

      await window.electronAPI.updateSettings({
        agentChannelIds: newIds,
        ...(agentChannelId === target.id && { agentChannelId: undefined, agentModelId: undefined }),
      })

      await loadChannels()
      setDeleteTarget(null)
    } catch (error) {
      console.error('[渠道设置] 删除渠道失败:', error)
    }
  }

  const handleKsccToggle = async (channel: Channel): Promise<void> => {
    if (!channel.enabled) {
      try {
        const status = await window.electronAPI.getKsccStatus()
        if (status.installed) {
          const savedChannel = await window.electronAPI.updateChannel(channel.id, { enabled: true })
          const settings = await window.electronAPI.getSettings()
          const currentIds: string[] = settings.agentChannelIds ?? []
          if (!currentIds.includes(channel.id)) {
            await window.electronAPI.updateSettings({
              agentChannelIds: [channel.id, ...currentIds],
            })
          }
          await syncAgentChannelEligibility(savedChannel, true)
          await loadChannels()
          return
        }
      } catch {
        /* fallthrough */
      }
      setKsccGuideOpen(true)
      return
    }

    try {
      const savedChannel = await window.electronAPI.updateChannel(channel.id, { enabled: false })
      await syncAgentChannelEligibility(savedChannel, false)
      await loadChannels()
    } catch (error) {
      console.error('[渠道设置] 切换 kscc 渠道状态失败:', error)
    }
  }

  const handleToggle = async (channel: Channel): Promise<void> => {
    try {
      const savedChannel = await window.electronAPI.updateChannel(channel.id, {
        enabled: !channel.enabled,
      })
      await syncAgentChannelEligibility(
        savedChannel,
        savedChannel.enabled && isAgentCompatibleProvider(savedChannel.provider)
      )
      await loadChannels()
    } catch (error) {
      console.error('[渠道设置] 切换渠道状态失败:', error)
    }
  }

  const handleFormSaved = async (): Promise<void> => {
    setViewMode('list')
    setEditingChannel(null)
    await loadChannels()
  }

  const handleFormCancel = (): void => {
    setViewMode('list')
    setEditingChannel(null)
  }

  const handleKsccBack = async (): Promise<void> => {
    setViewMode('list')
    await loadChannels()
  }

  if (viewMode === 'edit-kscc' && ksccChannel) {
    return (
      <>
        <KsccChannelForm
          channel={ksccChannel}
          onBack={() => void handleKsccBack()}
          onUpdated={() => void loadChannels()}
          onInstallGuideOpen={() => setKsccGuideOpen(true)}
        />
        <KsccInstallGuide
          open={ksccGuideOpen}
          onOpenChange={setKsccGuideOpen}
          onComplete={(installed) => {
            if (installed) loadChannels()
          }}
        />
      </>
    )
  }

  if (viewMode === 'create' || viewMode === 'edit') {
    return (
      <ChannelForm
        channel={editingChannel}
        onSaved={handleFormSaved}
        onAgentEligibilityChange={syncAgentChannelEligibility}
        onCancel={handleFormCancel}
      />
    )
  }

  return (
    <div className="space-y-8">
      <SettingsSection
        title="金山云内网"
        description="公司内网 Agent 渠道，由 kscc CLI 提供认证与模型能力"
      >
        {loading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">加载中...</div>
        ) : ksccChannel ? (
          <SettingsCard divided={false}>
            <KsccChannelRow
              channel={ksccChannel}
              onConfigure={() => setViewMode('edit-kscc')}
              onToggle={() => void handleKsccToggle(ksccChannel)}
            />
          </SettingsCard>
        ) : (
          <SettingsCard divided={false}>
            <div className="text-sm text-muted-foreground py-8 text-center px-4">
              未找到 kscc 内网渠道，请重启应用或检查安装
            </div>
          </SettingsCard>
        )}
      </SettingsSection>

      <SettingsSection
        title="模型配置"
        description="管理外部 AI 供应商连接，配置 API Key 和可用模型"
        action={
          <Button size="sm" className="h-9 rounded-xl gap-1.5" onClick={() => setViewMode('create')}>
            <Plus size={16} />
            添加配置
          </Button>
        }
      >
        {loading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">加载中...</div>
        ) : otherChannels.length === 0 ? (
          <SettingsCard divided={false}>
            <div className="text-sm text-muted-foreground py-12 text-center">
              还没有配置外部供应商，点击上方「添加配置」开始
            </div>
          </SettingsCard>
        ) : (
          <SettingsCard>
            {otherChannels.map((channel) => (
              <ChannelRow
                key={channel.id}
                channel={channel}
                onEdit={() => {
                  setEditingChannel(channel)
                  setViewMode('edit')
                }}
                onDelete={() => handleDeleteRequest(channel)}
                onToggle={() => void handleToggle(channel)}
              />
            ))}
          </SettingsCard>
        )}
      </SettingsSection>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定删除渠道？</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除渠道「{deleteTarget?.name}」？此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>确认删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <KsccInstallGuide
        open={ksccGuideOpen}
        onOpenChange={setKsccGuideOpen}
        onComplete={(installed) => {
          if (installed) loadChannels()
        }}
      />
    </div>
  )
}

interface KsccChannelRowProps {
  channel: Channel
  onConfigure: () => void
  onToggle: () => void
}

function KsccChannelRow({
  channel,
  onConfigure,
  onToggle,
}: KsccChannelRowProps): React.ReactElement {
  const enabledCount = channel.models.filter((m) => m.enabled).length
  const description = [
    '内置渠道 · 金山云',
    enabledCount > 0 ? `${enabledCount} 个模型已启用` : '尚未启用模型',
    '可用于 Agent',
  ].join(' · ')

  return (
    <SettingsRow
      label={channel.name}
      icon={<img src={getChannelLogo(channel)} alt="" className="w-8 h-8 rounded" />}
      description={description}
      className="group"
    >
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onConfigure}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors opacity-0 group-hover:opacity-100"
            >
              <Pencil size={14} />
            </button>
          </TooltipTrigger>
          <TooltipContent>配置模型</TooltipContent>
        </Tooltip>
        <Switch checked={channel.enabled} onCheckedChange={onToggle} />
      </div>
    </SettingsRow>
  )
}

interface ChannelRowProps {
  channel: Channel
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}

function ChannelRow({ channel, onEdit, onDelete, onToggle }: ChannelRowProps): React.ReactElement {
  const enabledCount = channel.models.filter((m) => m.enabled).length
  const isAgentCapable = isAgentCompatibleProvider(channel.provider)
  const description = [
    PROVIDER_LABELS[channel.provider],
    enabledCount > 0 ? `${enabledCount} 个模型已启用` : undefined,
    isAgentCapable ? '可用于 Agent' : undefined,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <SettingsRow
      label={channel.name}
      icon={<img src={getChannelLogo(channel)} alt="" className="w-8 h-8 rounded" />}
      description={description}
      className="group"
    >
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onEdit}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors opacity-0 group-hover:opacity-100"
            >
              <Pencil size={14} />
            </button>
          </TooltipTrigger>
          <TooltipContent>编辑</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onDelete}
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
            >
              <Trash2 size={14} />
            </button>
          </TooltipTrigger>
          <TooltipContent>删除</TooltipContent>
        </Tooltip>
        <Switch checked={channel.enabled} onCheckedChange={onToggle} />
      </div>
    </SettingsRow>
  )
}
