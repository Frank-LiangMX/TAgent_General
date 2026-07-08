import { useAtom } from 'jotai'
import { Loader2, Save, Play, Square, TestTube2, ExternalLink, Copy } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import type { WpsConfigInput, WpsUserAuthState } from '@tagent/shared'
import { Button } from '@tagent/ui'
import { SettingsCard, SettingsInput, SettingsRow, SettingsSection } from './primitives'

import { wpsBridgeStateAtom } from '@/atoms/wps-atoms'

const STATUS_META: Record<string, { label: string; dot: string }> = {
  disconnected: { label: '未连接', dot: 'bg-slate-400' },
  connecting: { label: '连接中', dot: 'bg-amber-400 animate-pulse' },
  connected: { label: '已连接', dot: 'bg-emerald-500' },
  error: { label: '错误', dot: 'bg-red-500' },
}

function getStatusMeta(status: string): { label: string; dot: string } {
  return STATUS_META[status] ?? { label: '未连接', dot: 'bg-slate-400' }
}

export function WpsSettings(): React.ReactElement {
  const [bridgeState, setBridgeState] = useAtom(wpsBridgeStateAtom)
  const [loaded, setLoaded] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [testing, setTesting] = React.useState(false)
  const [userAuth, setUserAuth] = React.useState<WpsUserAuthState>({ loggedIn: false })
  const [loggingIn, setLoggingIn] = React.useState(false)
  const [form, setForm] = React.useState<WpsConfigInput>({
    enabled: false,
    appId: '',
    secretKey: '',
    encryptKey: '',
    apiUrl: 'https://openapi.wps.cn',
    callbackPort: 19086,
    callbackPath: '/open/receive',
    defaultWorkspaceId: '',
  })

  React.useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const [config, status, auth] = await Promise.all([
          window.electronAPI.getWpsConfig(),
          window.electronAPI.getWpsStatus(),
          window.electronAPI.getWpsUserAuth(),
        ])
        if (!mounted) return
        setForm({
          enabled: config.enabled,
          appId: config.appId,
          secretKey: '',
          encryptKey: '',
          apiUrl: config.apiUrl,
          callbackPort: config.callbackPort,
          callbackPath: config.callbackPath,
          defaultWorkspaceId: config.defaultWorkspaceId ?? '',
        })
        setBridgeState(status)
        setUserAuth(auth)
        setLoaded(true)
      } catch (error: unknown) {
        console.error('[WPS 设置] 加载配置失败:', error)
        toast.error(`加载 WPS 配置失败: ${error instanceof Error ? error.message : String(error)}`)
        if (mounted) setLoaded(true)
      }
    })()
    return () => {
      mounted = false
    }
  }, [setBridgeState])

  React.useEffect(() => {
    const off = window.electronAPI.onWpsStatusChanged((state) => setBridgeState(state))
    return off
  }, [setBridgeState])

  // 登录状态变化推送监听（后端主动推送）
  React.useEffect(() => {
    const off = window.electronAPI.onWpsUserAuthChanged((auth) => {
      setUserAuth(auth)
      if (!auth.loggedIn) {
        toast.warning('WPS 登录已失效（可能在其他设备登录），请重新登录')
      }
    })
    return off
  }, [])

  // 定期健康检查（每 5 分钟检测 token 是否被踢）
  React.useEffect(() => {
    // 页面加载时先检测一次（直接从后端读状态）
    ;(async () => {
      const auth = await window.electronAPI.getWpsUserAuth()
      if (auth.loggedIn) {
        const stillValid = await window.electronAPI.checkWpsUserAuth()
        if (!stillValid) {
          setUserAuth({ loggedIn: false })
          toast.warning('WPS 登录已失效（可能在其他设备登录），请重新登录')
        }
      }
    })()

    const interval = setInterval(async () => {
      // 先读本地状态，如果已显示未登录就不重复检查
      const auth = await window.electronAPI.getWpsUserAuth()
      if (auth.loggedIn) {
        const stillValid = await window.electronAPI.checkWpsUserAuth()
        if (!stillValid) {
          setUserAuth({ loggedIn: false })
          toast.warning('WPS 登录已失效（可能在其他设备登录），请重新登录')
        }
      }
    }, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  const handleSave = React.useCallback(async () => {
    setSaving(true)
    try {
      await window.electronAPI.saveWpsConfig(form)
      toast.success('WPS 配置已保存')
    } catch (error) {
      toast.error(`保存失败: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setSaving(false)
    }
  }, [form])

  const handleTest = React.useCallback(async () => {
    if (!form.appId.trim()) {
      toast.error('请先填写 App ID')
      return
    }
    if (!form.secretKey.trim()) {
      toast.error('请先填写 Secret Key（用于测试，不会明文保存）')
      return
    }
    setTesting(true)
    try {
      const result = await window.electronAPI.testWpsConnection(
        form.appId.trim(),
        form.secretKey,
        form.apiUrl.trim()
      )
      if (result.success) toast.success(result.message)
      else toast.error(result.message)
    } finally {
      setTesting(false)
    }
  }, [form])

  const handleStart = React.useCallback(async () => {
    try {
      await window.electronAPI.startWpsBridge()
      toast.success('WPS Bridge 已启动')
    } catch (error) {
      toast.error(`启动失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }, [])

  const handleStop = React.useCallback(async () => {
    await window.electronAPI.stopWpsBridge()
    toast.info('WPS Bridge 已停止')
  }, [])

  const handleUserLogin = React.useCallback(async () => {
    setLoggingIn(true)
    try {
      const result = await window.electronAPI.wpsUserLogin()
      if (result.loading) {
        toast.info('请在浏览器中完成 WPS 登录授权')
      }
      // 轮询检查登录状态
      const check = setInterval(async () => {
        const auth = await window.electronAPI.getWpsUserAuth()
        if (auth.loggedIn || (auth.errorMessage && !auth.loading)) {
          clearInterval(check)
          setUserAuth(auth)
          setLoggingIn(false)
          if (auth.loggedIn) {
            toast.success(`WPS 登录成功: ${auth.userName}`)
          } else if (auth.errorMessage) {
            toast.error(`登录失败: ${auth.errorMessage}`)
          }
        }
      }, 1000)
      // 5 分钟超时
      setTimeout(() => {
        clearInterval(check)
        if (loggingIn) setLoggingIn(false)
      }, 5 * 60 * 1000)
    } catch (error) {
      setLoggingIn(false)
      toast.error(`登录失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }, [])

  const handleUserLogout = React.useCallback(async () => {
    try {
      await window.electronAPI.wpsUserLogout()
      setUserAuth({ loggedIn: false })
      toast.success('WPS 已退出登录')
    } catch (error) {
      toast.error(`退出登录失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }, [])

  const callbackUrl = React.useMemo(() => {
    const path = form.callbackPath.startsWith('/') ? form.callbackPath : `/${form.callbackPath}`
    return bridgeState.callbackUrl ?? `http://127.0.0.1:${form.callbackPort}${path}`
  }, [bridgeState.callbackUrl, form.callbackPort, form.callbackPath])

  const handleCopyCallbackUrl = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(callbackUrl)
      toast.success('回调地址已复制')
    } catch (error) {
      toast.error(`复制失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }, [callbackUrl])

  if (!loaded) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        正在加载 WPS 配置...
      </div>
    )
  }

  const statusMeta = getStatusMeta(bridgeState.status)

  return (
    <div className="space-y-8" data-search-id="wps-config">
      <SettingsSection title="WPS 协作" description="接入 WPS365 消息回调，作为远程连通入口">
        <SettingsCard>
          <SettingsRow label="Bridge 状态">
            <div className="flex items-center gap-3">
              <span className={`h-2 w-2 rounded-full ${statusMeta.dot}`} />
              <span className="text-sm text-muted-foreground">{statusMeta.label}</span>
              {bridgeState.callbackUrl && (
                <span className="text-xs text-muted-foreground/80">
                  监听地址: {bridgeState.callbackUrl}
                </span>
              )}
            </div>
          </SettingsRow>

          <SettingsRow label="启用">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
            />
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="用户登录" description="登录 WPS 账号以操作个人日历、文档">
        <SettingsCard>
          <SettingsRow label="登录状态">
            <div className="flex items-center gap-3">
              {userAuth.loggedIn ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-sm text-muted-foreground">
                    已登录: {userAuth.userName}{userAuth.userEmail ? ` (${userAuth.userEmail})` : ''}
                  </span>
                  {userAuth.expiresAt && (
                    <span className="text-xs text-muted-foreground/60">
                      Token 过期: {new Date(userAuth.expiresAt).toLocaleString('zh-CN')}
                    </span>
                  )}
                  <Button variant="outline" size="sm" onClick={handleUserLogout}>
                    退出登录
                  </Button>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  <span className="text-sm text-muted-foreground">未登录</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUserLogin}
                    disabled={loggingIn || !form.appId.trim()}
                  >
                    {loggingIn ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    {loggingIn ? '登录中...' : '登录 WPS'}
                  </Button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground underline"
                    onClick={() =>
                      window.electronAPI.openExternal('https://open.wps.cn/')
                    }
                  >
                    开放平台
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </>
              )}
            </div>
          </SettingsRow>
          {userAuth.errorMessage && (
            <SettingsRow label="错误信息">
              <span className="text-sm text-red-500">{userAuth.errorMessage}</span>
            </SettingsRow>
          )}
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="连接配置" description="来自 WPS 开放平台应用配置">
        <SettingsCard data-search-id="wps-credentials">
          <SettingsRow label="App ID">
            <SettingsInput
              label="App ID"
              value={form.appId}
              onChange={(value) => setForm((prev) => ({ ...prev, appId: value }))}
              placeholder="请输入 WPS App ID"
            />
          </SettingsRow>

          <SettingsRow label="Secret Key">
            <SettingsInput
              label="Secret Key"
              type="password"
              value={form.secretKey}
              onChange={(value) => setForm((prev) => ({ ...prev, secretKey: value }))}
              placeholder="留空则不修改"
            />
          </SettingsRow>

          <SettingsRow label="Encrypt Key">
            <SettingsInput
              label="Encrypt Key"
              type="password"
              value={form.encryptKey ?? ''}
              onChange={(value) => setForm((prev) => ({ ...prev, encryptKey: value }))}
              placeholder="可选，留空沿用 Secret Key；填空字符串将清空"
            />
          </SettingsRow>

          <SettingsRow label="API URL">
            <SettingsInput
              label="API URL"
              value={form.apiUrl}
              onChange={(value) => setForm((prev) => ({ ...prev, apiUrl: value }))}
            />
          </SettingsRow>

          <SettingsRow label="回调端口">
            <SettingsInput
              label="回调端口"
              type="number"
              value={String(form.callbackPort)}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, callbackPort: Number(value || '19086') }))
              }
            />
          </SettingsRow>

          <SettingsRow label="回调路径">
            <SettingsInput
              label="回调路径"
              value={form.callbackPath}
              onChange={(value) => setForm((prev) => ({ ...prev, callbackPath: value }))}
            />
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="操作" description="保存后可直接测试与启停">
        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-4 w-4" />
            )}
            保存
          </Button>
          <Button variant="outline" onClick={handleTest} disabled={testing}>
            {testing ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <TestTube2 className="mr-1.5 h-4 w-4" />
            )}
            测试连接
          </Button>
          <Button variant="outline" onClick={handleStart}>
            <Play className="mr-1.5 h-4 w-4" />
            启动
          </Button>
          <Button variant="outline" onClick={handleStop}>
            <Square className="mr-1.5 h-4 w-4" />
            停止
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection title="部署提示" description="WPS 开放平台回调地址配置">
        <SettingsCard divided={false}>
          <div className="space-y-2 px-4 py-4 text-sm text-muted-foreground">
            <p>1) 回调地址需要指向可公网访问的服务（开发阶段可先用内网穿透）。</p>
            <p>
              2) 本地监听地址：<code>{callbackUrl}</code>
            </p>
            <p>
              3) 回调路径默认是 <code>/open/receive</code>，需与你在开放平台配置保持一致。
            </p>
            <p>4) 当前实现为文本消息链路，图片/文件会在下一迭代补齐。</p>
            <Button variant="outline" size="sm" onClick={handleCopyCallbackUrl}>
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              复制回调地址
            </Button>
            <button
              type="button"
              className="inline-flex items-center gap-1 underline"
              onClick={() => window.electronAPI.openExternal('https://open.wps.cn/')}
            >
              打开 WPS 开放平台
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        </SettingsCard>
      </SettingsSection>
    </div>
  )
}
