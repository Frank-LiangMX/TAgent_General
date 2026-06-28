/**
 * KsccChannelForm — kscc 内网内置渠道配置页
 *
 * 从渠道列表进入的二级页，仅管理模型可见性与默认模型。
 */

import type { Channel, ChannelModel } from '@tagent/shared'
import { ArrowLeft, Loader2, Star } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { SettingsSection, SettingsCard } from './primitives'

import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const AUTO_SAVE_DELAY = 600

interface KsccChannelFormProps {
  channel: Channel
  onBack: () => void
  onUpdated: () => void | Promise<void>
  onInstallGuideOpen: () => void
}

/** 合并 kscc CLI 模型目录与用户已保存的启用状态 */
function mergeKsccCatalog(catalog: ChannelModel[], persisted: ChannelModel[]): ChannelModel[] {
  const persistedById = new Map(persisted.map((m) => [m.id, m]))
  return catalog.map((item) => {
    const existing = persistedById.get(item.id)
    return {
      id: item.id,
      name: item.name || existing?.name || item.id,
      enabled: existing?.enabled ?? item.enabled,
    }
  })
}

export function KsccChannelForm({
  channel,
  onBack,
  onUpdated,
  onInstallGuideOpen,
}: KsccChannelFormProps): React.ReactElement {
  const [models, setModels] = React.useState<ChannelModel[]>(channel.models)
  const [defaultModelId, setDefaultModelId] = React.useState<string | undefined>(
    channel.defaultModelId
  )
  const [ksccInstalled, setKsccInstalled] = React.useState<boolean | null>(null)
  const [syncingCatalog, setSyncingCatalog] = React.useState(false)
  const autoSaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const userEditedRef = React.useRef(false)

  React.useEffect(() => {
    setModels(channel.models)
    setDefaultModelId(channel.defaultModelId)
    userEditedRef.current = false
  }, [channel.id, channel.models, channel.defaultModelId])

  const syncCatalogFromCli = React.useCallback(async (): Promise<void> => {
    setSyncingCatalog(true)
    try {
      const status = await window.electronAPI.getKsccStatus()
      setKsccInstalled(status.installed)
      if (status.models.length === 0) return

      const merged = mergeKsccCatalog(status.models, channel.models)
      const catalogChanged =
        merged.length !== channel.models.length ||
        merged.some((m) => {
          const prev = channel.models.find((p) => p.id === m.id)
          return !prev || prev.name !== m.name
        }) ||
        channel.models.some((p) => !merged.some((m) => m.id === p.id))

      setModels(merged)

      if (catalogChanged) {
        await window.electronAPI.updateChannel(channel.id, {
          models: merged,
          defaultModelId: channel.defaultModelId,
        })
        await onUpdated()
      }
    } catch (error) {
      console.warn('[KsccChannelForm] 同步模型目录失败:', error)
    } finally {
      setSyncingCatalog(false)
    }
  }, [channel.defaultModelId, channel.id, channel.models, onUpdated])

  React.useEffect(() => {
    void syncCatalogFromCli()
  }, [syncCatalogFromCli])

  const persistChanges = React.useCallback(
    async (nextModels: ChannelModel[], nextDefaultModelId: string | undefined) => {
      try {
        await window.electronAPI.updateChannel(channel.id, {
          models: nextModels,
          defaultModelId: nextDefaultModelId,
        })
        await onUpdated()
        toast.success('已保存', { id: 'kscc-auto-save' })
      } catch (error) {
        console.error('[KsccChannelForm] 保存失败:', error)
        toast.error('保存失败，请重试', { id: 'kscc-auto-save-error' })
      }
    },
    [channel.id, onUpdated]
  )

  const scheduleAutoSave = React.useCallback(
    (nextModels: ChannelModel[], nextDefaultModelId: string | undefined) => {
      if (!userEditedRef.current) return
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = setTimeout(() => {
        void persistChanges(nextModels, nextDefaultModelId)
      }, AUTO_SAVE_DELAY)
    },
    [persistChanges]
  )

  React.useEffect(() => {
    scheduleAutoSave(models, defaultModelId)
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [models, defaultModelId, scheduleAutoSave])

  const handleToggleModel = (modelId: string, checked: boolean): void => {
    userEditedRef.current = true
    setModels((prev) => prev.map((m) => (m.id === modelId ? { ...m, enabled: checked } : m)))
    if (defaultModelId === modelId && !checked) {
      setDefaultModelId(undefined)
    }
  }

  const handleSetDefaultModel = (modelId: string): void => {
    userEditedRef.current = true
    setDefaultModelId(modelId)
    setModels((prev) => prev.map((m) => (m.id === modelId ? { ...m, enabled: true } : m)))
  }

  const enabledCount = models.filter((m) => m.enabled).length

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
          <ArrowLeft size={18} />
        </Button>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-medium text-foreground">配置 kscc 内网</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            认证由 kscc CLI 管理 · 修改会自动保存
          </p>
        </div>
        {syncingCatalog && <Loader2 size={16} className="animate-spin text-muted-foreground" />}
      </div>

      {ksccInstalled === false && (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 text-xs text-foreground/80">
          kscc CLI 尚未安装，Agent 无法使用该渠道。{' '}
          <button
            type="button"
            onClick={onInstallGuideOpen}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            查看安装引导
          </button>
        </div>
      )}

      {ksccInstalled === true && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 px-1">
          kscc CLI 已就绪 · {enabledCount}/{models.length} 个模型已启用
        </p>
      )}

      <SettingsSection
        title="模型"
        description="星标为 Agent 默认模型 · 开关控制是否在 Agent 模型选择器中显示"
      >
        <SettingsCard divided={false}>
          {models.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              {syncingCatalog ? '正在同步 kscc 模型…' : '暂无可用模型，请先完成 kscc 安装'}
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {models.map((model) => {
                const isDefault = defaultModelId === model.id
                return (
                  <div
                    key={model.id}
                    className={cn(
                      'flex items-center gap-3 px-4 py-2.5 transition-colors',
                      !model.enabled && 'opacity-60'
                    )}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => handleSetDefaultModel(model.id)}
                          disabled={!model.enabled && !isDefault}
                          className={cn(
                            'flex-shrink-0 p-0.5 transition-colors disabled:opacity-30',
                            isDefault
                              ? 'text-amber-500 dark:text-amber-400'
                              : 'text-muted-foreground/50 hover:text-amber-500 dark:hover:text-amber-400'
                          )}
                          aria-label={isDefault ? '当前为默认模型' : '设为默认模型'}
                        >
                          <Star size={14} className={isDefault ? 'fill-current' : undefined} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isDefault ? 'Agent 默认模型' : '设为 Agent 默认模型'}
                      </TooltipContent>
                    </Tooltip>

                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-foreground truncate">
                        {model.name}
                        {isDefault && (
                          <span className="ml-1.5 text-[10px] text-amber-600 dark:text-amber-400">
                            默认
                          </span>
                        )}
                      </div>
                      {model.name !== model.id && (
                        <div className="text-[11px] text-muted-foreground truncate">{model.id}</div>
                      )}
                    </div>

                    <Switch
                      checked={model.enabled}
                      onCheckedChange={(checked) => handleToggleModel(model.id, checked)}
                      aria-label={`${model.enabled ? '禁用' : '启用'} ${model.name}`}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </SettingsCard>
      </SettingsSection>
    </div>
  )
}
