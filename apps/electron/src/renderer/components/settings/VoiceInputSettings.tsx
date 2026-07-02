/**
 * VoiceInputSettings — 语音输入设置
 *
 * 紧凑布局设计：
 * - 顶部：状态卡片（权限 + 开关）
 * - 中部：凭证配置（折叠式）
 * - 底部：高级选项
 */

import { ChevronRight, ExternalLink, Loader2, TestTube2, Mic, MicOff } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { Button } from '@tagent/ui'
import {
  SettingsCard,
  SettingsInput,
  SettingsRow,
  SettingsSection,
  SettingsSelect,
  SettingsTextarea,
  SettingsToggle,
} from './primitives'
import type { VoiceDictationSettings, MicPermissionResult } from '../../../types'
import { cn } from '@/lib/utils'

const ENDPOINT_OPTIONS = [
  { value: 'async', label: '优化版（推荐）' },
  { value: 'duplex', label: '标准版' },
]

const OUTPUT_OPTIONS = [
  { value: 'auto', label: '自动' },
  { value: 'clipboard', label: '仅剪贴板' },
  { value: 'tagent-input', label: '仅输入框' },
]

const LANGUAGE_OPTIONS = [
  { value: 'auto', label: '自动识别' },
  { value: 'zh-CN', label: '中文' },
  { value: 'en-US', label: '英语' },
  { value: 'yue-CN', label: '粤语' },
  { value: 'ja-JP', label: '日语' },
  { value: 'ko-KR', label: '韩语' },
]

const VOLCENGINE_SPEECH_SERVICE_URL = 'https://console.volcengine.com/speech/service/'

export function VoiceInputSettings(): React.ReactElement {
  const [settings, setSettings] = React.useState<VoiceDictationSettings | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [testing, setTesting] = React.useState(false)
  const [micPermission, setMicPermission] = React.useState<MicPermissionResult | null>(null)
  const [requestingPermission, setRequestingPermission] = React.useState(false)
  const [showAdvanced, setShowAdvanced] = React.useState(false)

  const refreshMicPermission = React.useCallback(async () => {
    try {
      const result = await window.electronAPI.checkMicrophonePermission()
      setMicPermission(result)
    } catch (error) {
      console.error('[语音输入] 检查麦克风权限失败:', error)
    }
  }, [])

  React.useEffect(() => {
    window.electronAPI
      .getVoiceDictationSettings()
      .then(setSettings)
      .catch((error) => {
        console.error('[语音输入] 加载设置失败:', error)
        toast.error('加载语音输入设置失败')
      })
    refreshMicPermission()
  }, [refreshMicPermission])

  const handleRequestMicPermission = React.useCallback(async () => {
    setRequestingPermission(true)
    try {
      const result = await window.electronAPI.requestMicrophonePermission()
      setMicPermission(result)
      if (result.status === 'granted') {
        toast.success('麦克风权限已授权')
      } else if (result.status === 'denied') {
        toast.error('麦克风权限已被拒绝，请在系统设置中允许')
      }
    } catch (error) {
      console.error('[语音输入] 请求麦克风权限失败:', error)
      toast.error('请求麦克风权限失败')
    } finally {
      setRequestingPermission(false)
    }
  }, [])

  const update = React.useCallback(
    async (updates: Partial<VoiceDictationSettings>) => {
      if (!settings) return
      const optimistic = { ...settings, ...updates, provider: 'doubao' as const }
      setSettings(optimistic)
      setSaving(true)
      try {
        const saved = await window.electronAPI.updateVoiceDictationSettings(optimistic)
        setSettings(saved)
        window.electronAPI.reregisterGlobalShortcuts().catch(console.error)
      } catch (error) {
        console.error('[语音输入] 保存设置失败:', error)
        toast.error('保存语音输入设置失败')
      } finally {
        setSaving(false)
      }
    },
    [settings]
  )

  const handleTest = React.useCallback(async () => {
    if (!settings) return
    setTesting(true)
    try {
      const result = await window.electronAPI.testVoiceDictationConnection(settings)
      if (result.success) {
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      toast.error(`测试连接失败: ${message}`)
    } finally {
      setTesting(false)
    }
  }, [settings])

  if (!settings) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
        <Loader2 className="size-4 animate-spin" />
        正在加载...
      </div>
    )
  }

  const micGranted = micPermission?.status === 'granted'

  return (
    <div className="space-y-6">
      {/* 启用 + 权限 */}
      <SettingsSection title="语音输入" description="Ctrl+～ 呼起浮窗，按住说话实时转写为文本。">
        <SettingsCard>
          <SettingsToggle
            label="启用语音输入"
            description="开启后可用全局快捷键呼起语音浮窗。"
            checked={settings.enabled}
            onCheckedChange={(enabled) => update({ enabled })}
          />
        </SettingsCard>
        <SettingsCard>
          <SettingsRow
            label="麦克风权限"
            icon={micGranted ? <Mic className="size-4" /> : <MicOff className="size-4" />}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'text-xs',
                  micGranted
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : micPermission?.status === 'denied'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-amber-600 dark:text-amber-400'
                )}
              >
                {micGranted ? '已授权' : micPermission?.status === 'denied' ? '已被拒绝' : '未授权'}
              </span>
              {!micGranted && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRequestMicPermission}
                  disabled={requestingPermission}
                  className="h-7 text-xs"
                >
                  {requestingPermission ? <Loader2 className="size-3 animate-spin" /> : '授权'}
                </Button>
              )}
            </div>
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>

      {/* 火山引擎凭证 */}
      <SettingsSection
        title="火山引擎凭证"
        description="豆包语音识别 2.0，在控制台创建应用后填写凭证。"
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={testing || !settings.appId || !settings.accessToken || !settings.resourceId}
            className="h-8 text-xs"
          >
            {testing ? (
              <Loader2 className="size-3 animate-spin mr-1" />
            ) : (
              <TestTube2 className="size-3 mr-1" />
            )}
            测试
          </Button>
        }
      >
        <SettingsCard>
          <SettingsInput
            label="App ID"
            value={settings.appId}
            onChange={(v) => update({ appId: v })}
            placeholder="填写火山引擎 APP ID"
          />
          <SettingsInput
            label="Access Token"
            type="password"
            value={settings.accessToken}
            onChange={(v) => update({ accessToken: v })}
            placeholder="填写 Access Token"
          />
          <SettingsInput
            label="Resource ID"
            value={settings.resourceId}
            onChange={(v) => update({ resourceId: v })}
            placeholder="volc.seedasr.sauc.duration"
          />
        </SettingsCard>
        <div className="text-xs text-muted-foreground rounded-md bg-muted/30 px-3 py-2.5">
          打开
          <a
            href={VOLCENGINE_SPEECH_SERVICE_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 text-primary hover:underline mx-1"
          >
            火山引擎控制台
            <ExternalLink className="size-2.5" />
          </a>
          ，选择豆包语音识别 2.0，填写对应凭证
        </div>
      </SettingsSection>

      {/* 高级选项 */}
      <SettingsSection title="高级选项">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex w-full items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight
            className={cn('size-3 transition-transform', showAdvanced && 'rotate-90')}
          />
          连接模式 / 识别语言 / 输出方式 / 自定义热词
        </button>
        {showAdvanced && (
          <SettingsCard>
            <SettingsSelect
              label="连接模式"
              description="优化版推荐；标准版兼容性更好但延迟略高。"
              value={settings.endpointMode}
              onValueChange={(v) =>
                update({ endpointMode: v as VoiceDictationSettings['endpointMode'] })
              }
              options={ENDPOINT_OPTIONS}
            />
            <SettingsSelect
              label="识别语言"
              description="自动识别会根据内容判断语言。"
              value={settings.language || 'auto'}
              onValueChange={(v) => update({ language: v === 'auto' ? '' : v })}
              options={LANGUAGE_OPTIONS}
            />
            <SettingsSelect
              label="输出方式"
              description="自动：识别后同时写入剪贴板和输入框。"
              value={settings.outputMode}
              onValueChange={(v) =>
                update({ outputMode: v as VoiceDictationSettings['outputMode'] })
              }
              options={OUTPUT_OPTIONS}
            />
            <SettingsTextarea
              label="自定义热词"
              description="每行一个词，用于改善产品名、技术词识别准确率。"
              value={settings.customHotwords}
              onChange={(v) => update({ customHotwords: v })}
              placeholder="每行一个词，用于改善产品名、技术词识别"
              minHeight={80}
            />
          </SettingsCard>
        )}
      </SettingsSection>

      {saving && <p className="text-xs text-muted-foreground">正在保存...</p>}
    </div>
  )
}
