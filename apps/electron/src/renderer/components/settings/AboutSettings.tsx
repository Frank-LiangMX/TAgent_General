/**
 * AboutSettings - 关于页面
 *
 * 三段式布局：
 * 1. Identity Band - 品牌 Logo + 版本信息 + 快捷操作（教程/更新）
 * 2. Update Section - 紧凑的更新状态卡片
 * 3. Environment Section - 状态网格 + 一键检测
 * 4. Footer - 开源协议和仓库链接
 */

import { useAtomValue, useSetAtom } from 'jotai'
import {
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RotateCw,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Terminal,
  Github,
  FolderOpen,
} from 'lucide-react'
import * as React from 'react'

import type { EnvironmentCheckResult, RuntimeStatus } from '@tagent/shared'
import { Alert, AlertDescription, Badge, Button } from '@tagent/ui'
import tagentLogo from '../../../../resources/icon.png'
import tagentLogoDefaultLight from '../../../../resources/tagent-logo-proposals-v2/tagent-default-light.png'
import tagentLogoDefaultDark from '../../../../resources/tagent-logo-proposals-v2/tagent-default-dark.png'
import tagentLogoSlateLight from '../../../../resources/tagent-logo-proposals-v2/tagent-slate-light.png'
import tagentLogoSlateDark from '../../../../resources/tagent-logo-proposals-v2/tagent-slate-dark.png'
import tagentLogoOceanLight from '../../../../resources/tagent-logo-proposals-v2/tagent-ocean-light.png'
import tagentLogoOceanDark from '../../../../resources/tagent-logo-proposals-v2/tagent-ocean-dark.png'
import tagentLogoForestLight from '../../../../resources/tagent-logo-proposals-v2/tagent-forest-light.png'
import tagentLogoForestDark from '../../../../resources/tagent-logo-proposals-v2/tagent-forest-dark.png'
import tagentLogoOrangeLight from '../../../../resources/tagent-logo-proposals-v2/tagent-orange-light.png'
import tagentLogoOrangeDark from '../../../../resources/tagent-logo-proposals-v2/tagent-orange-dark.png'
import tagentLogoPurpleLight from '../../../../resources/tagent-logo-proposals-v2/tagent-purple-light.png'
import tagentLogoPurpleDark from '../../../../resources/tagent-logo-proposals-v2/tagent-purple-dark.png'

import { SettingsCard } from './primitives'
import { ReleaseNotesViewer } from './ReleaseNotesViewer'
import { SettingsPage } from './SettingsPage'

import { environmentCheckResultAtom, hasEnvironmentIssuesAtom } from '@/atoms/environment'
import {
  updateStatusAtom,
  updaterAvailableAtom,
  isPortableBuildAtom,
  checkForUpdates,
  type DownloadProgress,
} from '@/atoms/updater'
import { themeLogoKeyAtom } from '@/atoms/theme'
import { EnvironmentCheckCard } from '@/components/environment/EnvironmentCheckCard'
import { formatBytes } from '@/lib/format-bytes'

/** 主题 logo key → 资源 映射表，随 themeLogoKeyAtom 切换 */
const THEME_LOGOS: Record<string, string> = {
  'default-light': tagentLogoDefaultLight,
  'default-dark': tagentLogoDefaultDark,
  'slate-light': tagentLogoSlateLight,
  'slate-dark': tagentLogoSlateDark,
  'ocean-light': tagentLogoOceanLight,
  'ocean-dark': tagentLogoOceanDark,
  'forest-light': tagentLogoForestLight,
  'forest-dark': tagentLogoForestDark,
  'orange-light': tagentLogoOrangeLight,
  'orange-dark': tagentLogoOrangeDark,
  'purple-light': tagentLogoPurpleLight,
  'purple-dark': tagentLogoPurpleDark,
}

/** 从 package.json 构建时由 Vite define 注入 */
declare const __APP_VERSION__: string
const APP_VERSION = __APP_VERSION__

const GITHUB_RELEASES_URL = 'https://github.com/Frank-LiangMX/TAgent_General/releases'

export function AboutSettings(): React.ReactElement {
  return (
    <SettingsPage>
      {/* ===== Identity Band ===== */}
      <HeroSection />

      {/* ===== Update Section ===== */}
      <UpdateSection />

      {/* ===== Environment Section ===== */}
      <EnvironmentSection />

      {/* ===== Footer ===== */}
      <FooterLinks />
    </SettingsPage>
  )
}

// ===== Hero Section =====

function HeroSection(): React.ReactElement {
  const [openingTutorial, setOpeningTutorial] = React.useState(false)
  const [tutorialError, setTutorialError] = React.useState<string | null>(null)
  const [latestRelease, setLatestRelease] = React.useState<
    import('@tagent/shared').GitHubRelease | null
  >(null)
  const [loadingLatest, setLoadingLatest] = React.useState(true)
  const isPortable = useAtomValue(isPortableBuildAtom)
  // 主题切换时自动换 logo（找不到对应变体时回退到默认 icon.png）
  const themeLogoKey = useAtomValue(themeLogoKeyAtom)
  const themedLogo = THEME_LOGOS[themeLogoKey] ?? tagentLogo

  // 获取最新发布版本
  React.useEffect(() => {
    setLoadingLatest(true)
    window.electronAPI
      .getLatestRelease()
      .then((release) => {
        setLatestRelease(release)
      })
      .catch(console.error)
      .finally(() => setLoadingLatest(false))
  }, [])

  // 判断是否有新版本
  const latestVersion = latestRelease?.tag_name?.replace(/^v/, '') || ''
  const currentVersion = APP_VERSION
  const hasNewVersion =
    latestVersion && latestVersion !== currentVersion && latestVersion !== '0.0.0-dev'

  const handleOpenTutorial = async (): Promise<void> => {
    setOpeningTutorial(true)
    setTutorialError(null)
    try {
      const result = (await window.electronAPI.openExternal('tutorial://')) as
        | { opened: boolean; reason?: string }
        | undefined
      if (result && result.opened === false) {
        setTutorialError(result.reason ?? '打开失败')
      }
    } catch (err) {
      console.error('[About] 打开教程失败:', err)
      setTutorialError(err instanceof Error ? err.message : '未知错误')
    } finally {
      setOpeningTutorial(false)
    }
  }

  return (
    <div className="settings-card settings-card-surface settings-identity-band settings-identity-band--compact">
      <div className="size-14 overflow-hidden rounded-[var(--app-shell-composer-radius,16px)]">
        <img
          src={themedLogo}
          alt=""
          width={56}
          height={56}
          className="h-full w-full object-cover"
          draggable={false}
        />
      </div>

      <div className="settings-identity-copy">
        <h1 className="settings-identity-name">TAgent</h1>
        <p className="settings-identity-meta">集成通用 AI Agent 的下一代人工智能软件</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">v{APP_VERSION}</span>
          {isPortable ? (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              Portable
            </Badge>
          ) : (
            <span>Electron + React</span>
          )}
          {loadingLatest ? (
            <span>正在检查最新版本...</span>
          ) : hasNewVersion ? (
            <Badge variant="default" className="gap-1 text-xs">
              <ExternalLink size={10} />
              新版本 v{latestVersion} 可用
            </Badge>
          ) : latestRelease ? (
            <span>当前已是最新版本</span>
          ) : null}
          {isPortable && hasNewVersion ? <span>请下载 Portable 包手动替换</span> : null}
        </div>
        {tutorialError ? (
          <p className="mt-2 rounded-md bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
            教程打开失败：{tutorialError}
          </p>
        ) : null}
      </div>

      <div className="settings-identity-actions">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={handleOpenTutorial}
          disabled={openingTutorial}
        >
          <BookOpen size={14} />
          {openingTutorial ? '正在打开…' : '教程'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => window.electronAPI.openDataDir()}
        >
          <FolderOpen size={14} />
          数据目录
        </Button>
        <CheckUpdateButton />
      </div>
    </div>
  )
}

// ===== Check Update Button (Inline) =====

function CheckUpdateButton(): React.ReactElement | null {
  const available = useAtomValue(updaterAvailableAtom)
  const status = useAtomValue(updateStatusAtom)
  const isPortable = useAtomValue(isPortableBuildAtom)
  const [checking, setChecking] = React.useState(false)

  if (!available) return null

  const handleGoToDownload = (): void => {
    window.electronAPI.openExternal(GITHUB_RELEASES_URL)
  }

  // Portable：引导去 Release 下载 Portable 包，不触发自动更新检查
  if (isPortable || status.status === 'portable') {
    return (
      <Button size="sm" className="gap-1.5" onClick={handleGoToDownload}>
        <ExternalLink size={14} />
        下载 Portable 包
      </Button>
    )
  }

  const handleCheck = async (): Promise<void> => {
    setChecking(true)
    try {
      await checkForUpdates()
    } finally {
      setTimeout(() => setChecking(false), 1000)
    }
  }

  const handleQuitAndInstall = (): void => {
    window.electronAPI.updater?.quitAndInstall()
  }

  const isChecking = checking || status.status === 'checking' || status.status === 'downloading'

  if (status.status === 'downloaded') {
    return (
      <Button size="sm" className="gap-1.5" onClick={handleQuitAndInstall}>
        <RotateCw size={14} />
        立即重启
      </Button>
    )
  }

  if (status.status === 'available') {
    return (
      <Button size="sm" className="gap-1.5" onClick={handleGoToDownload}>
        <ExternalLink size={14} />
        前往下载 v{status.version}
      </Button>
    )
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      className="gap-1.5"
      onClick={handleCheck}
      disabled={isChecking}
    >
      {isChecking ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
      {isChecking ? '检查中…' : '检查更新'}
    </Button>
  )
}

// ===== Update Section =====

function UpdateSection(): React.ReactElement | null {
  const available = useAtomValue(updaterAvailableAtom)
  const status = useAtomValue(updateStatusAtom)
  const isPortable = useAtomValue(isPortableBuildAtom)
  const [showReleaseNotes, setShowReleaseNotes] = React.useState(false)
  const [release, setRelease] = React.useState<import('@tagent/shared').GitHubRelease | null>(null)

  // 进入关于页时自动检查更新（Portable / 非 idle 时跳过）
  React.useEffect(() => {
    if (available && !isPortable && status.status === 'idle') {
      checkForUpdates()
    }
  }, [available, isPortable, status.status])

  // 获取 release 信息
  React.useEffect(() => {
    if (status.status === 'available' && status.version && !release) {
      window.electronAPI
        .getReleaseByTag(`v${status.version}`)
        .then((r) => {
          if (r) setRelease(r)
        })
        .catch(console.error)
    }
  }, [status.status, status.version, release])

  // updater 不可用时不渲染
  if (!available) return null

  // Portable：说明无法自动更新，引导手动下载同名 Portable 包
  if (isPortable || status.status === 'portable') {
    return (
      <SettingsCard className="overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw size={16} className="text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">软件更新</span>
          </div>
          <Badge variant="secondary" className="text-xs">
            Portable
          </Badge>
        </div>
        <div className="border-t px-4 py-3 space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            当前为免安装 Portable 版本，不支持应用内自动更新。有新版本时请到 GitHub Release 下载{' '}
            <span className="font-mono text-foreground/80">TAgent.Portable.*.exe</span>{' '}
            ，关闭本程序后用新文件替换即可。
          </p>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => window.electronAPI.openExternal(GITHUB_RELEASES_URL)}
          >
            <ExternalLink size={12} />
            打开 Releases
          </Button>
        </div>
      </SettingsCard>
    )
  }

  const hasReleaseNotes = status.releaseNotes || release?.body

  return (
    <SettingsCard className="overflow-hidden">
      {/* 状态摘要 */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw size={16} className="text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">软件更新</span>
        </div>
        <UpdateStatusBadge
          status={status.status}
          version={status.version}
          error={status.error}
          progress={status.progress}
        />
      </div>

      {/* 下载进度 */}
      {status.status === 'downloading' && (
        <UpdateDownloadProgress version={status.version} progress={status.progress} />
      )}

      {/* 下载完成：关于页内直接重启 */}
      {status.status === 'downloaded' && status.version && (
        <div className="border-t px-4 py-2.5 flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            v{status.version} 已下载，重启后生效
          </span>
          <Button
            size="sm"
            className="h-7 text-xs gap-1 shrink-0"
            onClick={() => window.electronAPI.updater?.quitAndInstall()}
          >
            <RotateCw size={12} />
            立即重启
          </Button>
        </div>
      )}

      {/* 错误详情（可展开） */}
      {status.status === 'error' && status.error && (
        <div className="border-t px-4 py-2.5">
          <div className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive dark:text-destructive">
            <div className="font-medium mb-0.5">更新失败</div>
            <div className="text-[11px] break-all opacity-90">{status.error}</div>
          </div>
        </div>
      )}

      {/* Release Notes 展开 */}
      {status.status === 'available' && hasReleaseNotes && (
        <div className="border-t">
          <button
            onClick={() => setShowReleaseNotes(!showReleaseNotes)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-muted/30 transition-colors"
          >
            <span className="text-xs text-muted-foreground">查看更新日志</span>
            {showReleaseNotes ? (
              <ChevronUp size={14} className="text-muted-foreground" />
            ) : (
              <ChevronDown size={14} className="text-muted-foreground" />
            )}
          </button>

          {showReleaseNotes && release && (
            <div className="px-4 pb-3">
              <ReleaseNotesViewer release={release} showHeader={false} compact />
            </div>
          )}
        </div>
      )}
    </SettingsCard>
  )
}

function UpdateDownloadProgress({
  version,
  progress,
}: {
  version?: string
  progress?: DownloadProgress
}): React.ReactElement {
  const percent = progress ? Math.min(100, Math.round(progress.percent)) : 0
  const hasProgress = Boolean(progress && progress.total > 0)

  return (
    <div className="border-t px-4 py-2.5 space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{version ? `正在下载 v${version}` : '正在下载更新'}</span>
        <span>{hasProgress ? `${percent}%` : '连接中…'}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: hasProgress ? `${percent}%` : '30%' }}
        />
      </div>
      {hasProgress && progress && (
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>
            {formatBytes(progress.transferred)} / {formatBytes(progress.total)}
          </span>
          <span>{formatBytes(progress.bytesPerSecond)}/s</span>
        </div>
      )}
    </div>
  )
}

function UpdateStatusBadge({
  status,
  version,
  error,
  progress,
}: {
  status: string
  version?: string
  error?: string
  progress?: DownloadProgress
}): React.ReactElement {
  switch (status) {
    case 'checking':
      return (
        <Badge variant="secondary" className="text-xs">
          检查中…
        </Badge>
      )
    case 'available':
      return (
        <Badge variant="default" className="text-xs gap-1">
          <ExternalLink size={10} />v{version} 可用
        </Badge>
      )
    case 'downloading': {
      const percent =
        progress && progress.total > 0 ? Math.min(100, Math.round(progress.percent)) : null
      return (
        <Badge variant="secondary" className="text-xs gap-1">
          <Loader2 size={10} className="animate-spin" />
          {percent != null ? `下载中 ${percent}%` : '下载中…'}
        </Badge>
      )
    }
    case 'downloaded':
      return (
        <Badge variant="default" className="text-xs gap-1">
          <CheckCircle2 size={10} />
          就绪
        </Badge>
      )
    case 'not-available':
      return (
        <Badge variant="outline" className="text-xs gap-1">
          <CheckCircle2 size={10} className="text-emerald-500" />
          已是最新
        </Badge>
      )
    case 'error':
      return (
        <Badge variant="destructive" className="text-xs gap-1">
          <AlertCircle size={10} />
          检查失败
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="text-xs">
          未检查
        </Badge>
      )
  }
}

// ===== Environment Section =====

function EnvironmentSection(): React.ReactElement {
  const hasIssues = useAtomValue(hasEnvironmentIssuesAtom)
  const setEnvironmentResult = useSetAtom(environmentCheckResultAtom)
  const [result, setResult] = React.useState<EnvironmentCheckResult | null>(null)
  const [runtimeStatus, setRuntimeStatus] = React.useState<RuntimeStatus | null>(null)
  const [isChecking, setIsChecking] = React.useState(false)
  const [expanded, setExpanded] = React.useState(false)
  const [ksccStatus, setKsccStatus] = React.useState<{
    installed: boolean
    version?: string
  } | null>(null)

  // 初始化时加载缓存
  React.useEffect(() => {
    window.electronAPI.getSettings().then((settings) => {
      if (settings.lastEnvironmentCheck) {
        setResult(settings.lastEnvironmentCheck)
        setEnvironmentResult(settings.lastEnvironmentCheck)
      }
    })
    window.electronAPI.getRuntimeStatus().then((status) => {
      setRuntimeStatus(status)
    })
    window.electronAPI
      .getKsccStatus()
      .then((status) => {
        if (status) setKsccStatus({ installed: status.installed, version: undefined })
      })
      .catch(() => {})
  }, [])

  const handleCheck = async () => {
    setIsChecking(true)
    try {
      const checkResult = await window.electronAPI.checkEnvironment()
      setResult(checkResult)
      setEnvironmentResult(checkResult)
      const status = await window.electronAPI.getRuntimeStatus()
      setRuntimeStatus(status)
      const ksccResult = await window.electronAPI.checkKsccReadiness()
      if (ksccResult)
        setKsccStatus({ installed: ksccResult.kscc.installed, version: ksccResult.kscc.version })
    } catch (error) {
      console.error('[环境检测] 检测失败:', error)
    } finally {
      setIsChecking(false)
    }
  }

  // 计算状态
  const nodejsOk = result?.nodejs.installed && result?.nodejs.meetsMinimum
  const gitOk = result?.git.installed && result?.git.meetsRequirement
  const shellOk = runtimeStatus?.shell?.gitBash?.available || runtimeStatus?.shell?.wsl?.available

  return (
    <SettingsCard className="overflow-hidden">
      {/* 状态网格 */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-foreground">运行环境</span>
          {hasIssues && (
            <Badge variant="destructive" className="text-xs">
              !
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-4 gap-3">
          <StatusGridItem name="Node.js" ok={nodejsOk} version={result?.nodejs.version} />
          <StatusGridItem name="Git" ok={gitOk} version={result?.git.version} />
          <StatusGridItem
            name="Shell"
            ok={shellOk}
            version={
              runtimeStatus?.shell?.gitBash?.version?.toString() ??
              runtimeStatus?.shell?.wsl?.version?.toString() ??
              undefined
            }
            hide={!runtimeStatus?.shell}
          />
          <StatusGridItem
            name="kscc"
            ok={ksccStatus?.installed ?? false}
            version={ksccStatus?.version}
          />
        </div>

        {/* 快捷检测按钮 */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
          <span className="text-xs text-muted-foreground">
            {hasIssues ? '部分环境需要配置' : '所有环境已就绪'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? '收起详情' : '展开详情'}
            </button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={handleCheck}
              disabled={isChecking}
            >
              {isChecking ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <RefreshCw size={12} />
              )}
              {isChecking ? '检测中' : '重新检测'}
            </Button>
          </div>
        </div>
      </div>

      {/* 展开详情 */}
      {expanded && (
        <div className="border-t px-4 py-3 space-y-3">
          {/* Node.js */}
          <EnvironmentCheckCard
            name="Node.js"
            status={
              !result
                ? 'checking'
                : nodejsOk
                  ? result.nodejs.meetsRecommended
                    ? 'success'
                    : 'warning'
                  : 'error'
            }
            version={result?.nodejs.version}
            requirement="推荐 22 LTS，最低 18 LTS"
            action={{
              type: 'openExternal',
              url: result?.nodejs.downloadUrl || 'https://nodejs.org/',
            }}
          />

          {/* Git */}
          <EnvironmentCheckCard
            name="Git"
            status={!result ? 'checking' : gitOk ? 'success' : 'error'}
            version={result?.git.version}
            requirement="版本 >= 2.0"
            action={{
              type: 'openExternal',
              url: result?.git.downloadUrl || 'https://git-scm.com/',
            }}
          />

          {/* Shell（仅 Windows） */}
          {runtimeStatus?.shell && (
            <>
              <EnvironmentCheckCard
                name="Git Bash"
                status={runtimeStatus.shell.gitBash?.available ? 'success' : 'error'}
                version={runtimeStatus.shell.gitBash?.version ?? undefined}
                requirement="Git for Windows 自带"
                action={{ type: 'download', installerId: 'git-for-windows' }}
                statusText={
                  runtimeStatus.shell.gitBash?.available
                    ? (runtimeStatus.shell.gitBash.path ?? undefined)
                    : '未安装'
                }
              />
              <EnvironmentCheckCard
                name="WSL"
                status={runtimeStatus.shell.wsl?.available ? 'success' : 'error'}
                version={
                  runtimeStatus.shell.wsl?.version
                    ? `WSL ${runtimeStatus.shell.wsl.version}`
                    : undefined
                }
                requirement="WSL 1 或 WSL 2"
                action={{
                  type: 'openExternal',
                  url: 'https://learn.microsoft.com/zh-cn/windows/wsl/install',
                }}
                statusText={
                  runtimeStatus.shell.wsl?.available
                    ? `${runtimeStatus.shell.wsl.defaultDistro || '未设置'}`
                    : '未安装'
                }
              />
            </>
          )}

          {/* Windows 提示 */}
          {result?.platform === 'win32' && !shellOk && (
            <Alert>
              <Terminal className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Agent 模式需要 Git Bash 或 WSL。安装 Git for Windows 后重启应用即可。
              </AlertDescription>
            </Alert>
          )}

          {/* kscc 内网 CLI */}
          <EnvironmentCheckCard
            name="kscc"
            status={!ksccStatus ? 'checking' : ksccStatus.installed ? 'success' : 'warning'}
            version={ksccStatus?.version}
            requirement="公司内网 AI 编程工具（免费）"
            statusText={!ksccStatus ? undefined : ksccStatus.installed ? '已安装' : '未安装'}
            action={
              ksccStatus && !ksccStatus.installed
                ? { type: 'openExternal' as const, url: 'https://tagent.cool/docs/kscc-install' }
                : { type: 'none' as const }
            }
          />
        </div>
      )}
    </SettingsCard>
  )
}

function StatusGridItem({
  name,
  ok,
  version,
  hide,
}: {
  name: string
  ok?: boolean
  version?: string
  hide?: boolean
}): React.ReactElement | null {
  if (hide) return null

  return (
    <div className="flex flex-col items-center p-2 rounded-lg bg-muted/30">
      {ok ? (
        <CheckCircle2 size={18} className="text-emerald-500 mb-1" />
      ) : (
        <AlertCircle size={18} className="text-muted-foreground mb-1" />
      )}
      <span className="text-xs font-medium text-foreground">{name}</span>
      {version && <span className="text-[10px] text-muted-foreground font-mono">v{version}</span>}
    </div>
  )
}

// ===== Footer =====

function FooterLinks(): React.ReactElement {
  return (
    <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground/60 py-2">
      <a
        href="https://www.gnu.org/licenses/agpl-3.0.html"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-foreground transition-colors"
      >
        AGPL-3.0 开源协议
      </a>
      <span>·</span>
      <a
        href="https://github.com/Frank-LiangMX/TAgent_General"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-foreground transition-colors inline-flex items-center gap-1"
      >
        <Github size={12} />
        GitHub 仓库
      </a>
    </div>
  )
}
