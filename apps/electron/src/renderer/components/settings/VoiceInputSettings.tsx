/**
 * VoiceInputSettings — 语音输入设置
 *
 * 紧凑布局设计：
 * - 顶部：状态卡片（权限 + 开关）
 * - 中部：凭证配置（折叠式）
 * - 底部：高级选项
 */

import { ExternalLink, Loader2, TestTube2, Mic, MicOff, CheckCircle2, XCircle } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import type { VoiceDictationSettings, MicPermissionResult } from '../../../types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
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
      {/* 状态卡片 */}
      <div className="rounded-xl border border-border/50 p-4 space-y-4">
        {/* 权限状态 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {micGranted ? (
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Mic className="size-4 text-emerald-600" />
              </div>
            ) : micPermission?.status === 'denied' ? (
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                <MicOff className="size-4 text-red-600" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Mic className="size-4 text-amber-600" />
              </div>
            )}
            <div>
              <div className="text-sm font-medium text-foreground">麦克风权限</div>
              <div className="text-xs text-muted-foreground">
                {micGranted ? '已授权' : micPermission?.status === 'denied' ? '已被拒绝' : '未授权'}
              </div>
            </div>
          </div>
          {!micGranted && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRequestMicPermission}
              disabled={requestingPermission}
            >
              {requestingPermission ? <Loader2 className="size-3 animate-spin" /> : '授权'}
            </Button>
          )}
        </div>

        {/* 启用开关 */}
        <div className="flex items-center justify-between pt-3 border-t border-border/50">
          <div>
            <div className="text-sm font-medium text-foreground">启用语音输入</div>
            <div className="text-xs text-muted-foreground">Ctrl+～ 呼起浮窗</div>
          </div>
          <Switch checked={settings.enabled} onCheckedChange={(enabled) => update({ enabled })} />
        </div>
      </div>

      {/* 凭证配置 */}
      <div className="space-y-3">
        <div className="text-sm font-medium text-foreground flex items-center justify-between">
          火山引擎凭证
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={testing || !settings.appId || !settings.accessToken || !settings.resourceId}
          >
            {testing ? (
              <Loader2 className="size-3 animate-spin mr-1" />
            ) : (
              <TestTube2 className="size-3 mr-1" />
            )}
            测试
          </Button>
        </div>
        <div className="rounded-xl border border-border/50 p-4 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">App ID</label>
            <Input
              value={settings.appId}
              onChange={(e) => update({ appId: e.target.value })}
              placeholder="填写火山引擎 APP ID"
              className="h-9"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">Access Token</label>
            <Input
              value={settings.accessToken}
              onChange={(e) => update({ accessToken: e.target.value })}
              placeholder="填写 Access Token"
              type="password"
              className="h-9"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">Resource ID</label>
            <Input
              value={settings.resourceId}
              onChange={(e) => update({ resourceId: e.target.value })}
              placeholder="volc.seedasr.sauc.duration"
              className="h-9"
            />
          </div>
        </div>

        {/* 配置引导 */}
        <div className="text-xs text-muted-foreground rounded-lg bg-muted/30 px-3 py-2.5">
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
      </div>

      {/* 高级选项 */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          <span className={cn('transition-transform', showAdvanced && 'rotate-90')}>▸</span>
          高级选项
        </button>
        {showAdvanced && (
          <div className="rounded-xl border border-border/50 divide-y divide-border/50 animate-in slide-in-from-top-2 duration-200">
            {/* 连接模式 */}
            <div className="flex items-center justify-between px-4 py-3">
              <div className="text-sm text-muted-foreground">连接模式</div>
              <Select
                value={settings.endpointMode}
                onValueChange={(v) =>
                  update({ endpointMode: v as VoiceDictationSettings['endpointMode'] })
                }
              >
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENDPOINT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 识别语言 */}
            <div className="flex items-center justify-between px-4 py-3">
              <div className="text-sm text-muted-foreground">识别语言</div>
              <Select
                value={settings.language || 'auto'}
                onValueChange={(v) => update({ language: v === 'auto' ? '' : v })}
              >
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 输出方式 */}
            <div className="flex items-center justify-between px-4 py-3">
              <div className="text-sm text-muted-foreground">输出方式</div>
              <Select
                value={settings.outputMode}
                onValueChange={(v) =>
                  update({ outputMode: v as VoiceDictationSettings['outputMode'] })
                }
              >
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OUTPUT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 自定义热词 */}
            <div className="px-4 py-3">
              <div className="text-sm text-muted-foreground mb-2">自定义热词</div>
              <Textarea
                value={settings.customHotwords}
                onChange={(e) => update({ customHotwords: e.target.value })}
                placeholder="每行一个词，用于改善产品名、技术词识别"
                className="min-h-[80px] text-xs"
              />
            </div>
          </div>
        )}
      </div>

      {saving && <p className="text-xs text-muted-foreground">正在保存...</p>}
    </div>
  )
}
