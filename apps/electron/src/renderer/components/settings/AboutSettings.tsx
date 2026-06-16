/**
 * AboutSettings - 关于页面
 *
 * 三段式布局：
 * 1. Hero Section - 品牌 Logo + 版本信息 + 快捷操作（教程/更新）
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
  FileCode2,
} from 'lucide-react'
import * as React from 'react'

import { SettingsCard } from './primitives'
import { ReleaseNotesViewer } from './ReleaseNotesViewer'

import type { EnvironmentCheckResult, RuntimeStatus } from '@tagent/shared'

import {
  environmentCheckResultAtom,
  hasEnvironmentIssuesAtom,
} from '@/atoms/environment'
import { updateStatusAtom, updaterAvailableAtom, checkForUpdates } from '@/atoms/updater'
import { EnvironmentCheckCard } from '@/components/environment/EnvironmentCheckCard'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'


/** 从 package.json 构建时由 Vite define 注入 */
declare const __APP_VERSION__: string
const APP_VERSION = __APP_VERSION__

const GITHUB_RELEASES_URL = 'https://github.com/Frank-LiangMX/TAgent_General/releases'

export function AboutSettings(): React.ReactElement {
  return (
    <div className="space-y-6">
      {/* ===== Hero Section ===== */}
      <HeroSection />

      {/* ===== Update Section ===== */}
      <UpdateSection />

      {/* ===== Environment Section ===== */}
      <EnvironmentSection />

      {/* ===== Footer ===== */}
      <FooterLinks />
    </div>
  )
}

// ===== Hero Section =====

function HeroSection(): React.ReactElement {
  const [openingTutorial, setOpeningTutorial] = React.useState(false)
  const [tutorialError, setTutorialError] = React.useState<string | null>(null)

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
    <div className="relative rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent opacity-50" />

      <div className="relative flex flex-col items-center py-8 px-6">
        {/* Logo 区域 */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30 flex items-center justify-center mb-4 shadow-lg shadow-primary/10">
          <FileCode2 size={32} className="text-primary" />
        </div>

        {/* 品牌名 */}
        <h1 className="text-2xl font-bold text-foreground mb-1">TAgent</h1>
        <p className="text-sm text-muted-foreground text-center max-w-sm leading-relaxed">
          集成通用 AI Agent 的下一代人工智能软件
        </p>

        {/* 版本信息 */}
        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground/60">
          <span className="font-mono">v{APP_VERSION}</span>
          <span>·</span>
          <span>Electron + React</span>
        </div>

        {/* 快捷操作按钮 */}
        <div className="flex items-center gap-3 mt-5">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleOpenTutorial}
            disabled={openingTutorial}
          >
            <BookOpen size={14} />
            {openingTutorial ? '正在打开…' : '打开教程'}
          </Button>
          <CheckUpdateButton />
        </div>

        {/* 教程打开错误 */}
        {tutorialError && (
          <p className="mt-3 text-xs text-destructive bg-destructive/10 px-3 py-1.5 rounded-md">
            教程打开失败：{tutorialError}
          </p>
        )}
      </div>
    </div>
  )
}

// ===== Check Update Button (Inline) =====

function CheckUpdateButton(): React.ReactElement | null {
  const available = useAtomValue(updaterAvailableAtom)
  const status = useAtomValue(updateStatusAtom)
  const [checking, setChecking] = React.useState(false)

  if (!available) return null

  const handleCheck = async (): Promise<void> => {
    setChecking(true)
    try {
      await checkForUpdates()
    } finally {
      setTimeout(() => setChecking(false), 1000)
    }
  }

  const handleGoToDownload = (): void => {
    window.electronAPI.openExternal(GITHUB_RELEASES_URL)
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
    <Button variant="secondary" size="sm" className="gap-1.5" onClick={handleCheck} disabled={isChecking}>
      {isChecking ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
      {isChecking ? '检查中…' : '检查更新'}
    </Button>
  )
}

// ===== Update Section =====

function UpdateSection(): React.ReactElement | null {
  const available = useAtomValue(updaterAvailableAtom)
  const status = useAtomValue(updateStatusAtom)
  const [showReleaseNotes, setShowReleaseNotes] = React.useState(false)
  const [release, setRelease] = React.useState<import('@tagent/shared').GitHubRelease | null>(null)

  // updater 不可用时不渲染
  if (!available) return null

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

  const hasReleaseNotes = status.releaseNotes || release?.body

  return (
    <SettingsCard className="overflow-hidden">
      {/* 状态摘要 */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw size={16} className="text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">软件更新</span>
        </div>
        <UpdateStatusBadge status={status.status} version={status.version} />
      </div>

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

function UpdateStatusBadge({ status, version }: { status: string; version?: string }): React.ReactElement {
  switch (status) {
    case 'checking':
      return <Badge variant="secondary" className="text-xs">检查中…</Badge>
    case 'available':
      return <Badge variant="default" className="text-xs gap-1"><ExternalLink size={10} />v{version} 可用</Badge>
    case 'downloading':
      return <Badge variant="secondary" className="text-xs"><Loader2 size={10} className="animate-spin" />下载中</Badge>
    case 'downloaded':
      return <Badge variant="default" className="text-xs gap-1"><CheckCircle2 size={10} />就绪</Badge>
    case 'not-available':
      return <Badge variant="outline" className="text-xs gap-1"><CheckCircle2 size={10} className="text-emerald-500" />已是最新</Badge>
    case 'error':
      return <Badge variant="destructive" className="text-xs gap-1"><AlertCircle size={10} />检查失败</Badge>
    default:
      return <Badge variant="outline" className="text-xs">未检查</Badge>
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
  }, [])

  const handleCheck = async () => {
    setIsChecking(true)
    try {
      const checkResult = await window.electronAPI.checkEnvironment()
      setResult(checkResult)
      setEnvironmentResult(checkResult)
      const status = await window.electronAPI.getRuntimeStatus()
      setRuntimeStatus(status)
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
          {hasIssues && <Badge variant="destructive" className="text-xs">!</Badge>}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <StatusGridItem
            name="Node.js"
            ok={nodejsOk}
            version={result?.nodejs.version}
          />
          <StatusGridItem
            name="Git"
            ok={gitOk}
            version={result?.git.version}
          />
          <StatusGridItem
            name="Shell"
            ok={shellOk}
            version={runtimeStatus?.shell?.gitBash?.version?.toString() ?? runtimeStatus?.shell?.wsl?.version?.toString() ?? undefined}
            hide={!runtimeStatus?.shell}
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
              {isChecking ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
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
            status={!result ? 'checking' : nodejsOk ? (result.nodejs.meetsRecommended ? 'success' : 'warning') : 'error'}
            version={result?.nodejs.version}
            requirement="推荐 22 LTS，最低 18 LTS"
            action={{ type: 'openExternal', url: result?.nodejs.downloadUrl || 'https://nodejs.org/' }}
          />

          {/* Git */}
          <EnvironmentCheckCard
            name="Git"
            status={!result ? 'checking' : gitOk ? 'success' : 'error'}
            version={result?.git.version}
            requirement="版本 >= 2.0"
            action={{ type: 'openExternal', url: result?.git.downloadUrl || 'https://git-scm.com/' }}
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
                statusText={runtimeStatus.shell.gitBash?.available ? (runtimeStatus.shell.gitBash.path ?? undefined) : '未安装'}
              />
              <EnvironmentCheckCard
                name="WSL"
                status={runtimeStatus.shell.wsl?.available ? 'success' : 'error'}
                version={runtimeStatus.shell.wsl?.version ? `WSL ${runtimeStatus.shell.wsl.version}` : undefined}
                requirement="WSL 1 或 WSL 2"
                action={{ type: 'openExternal', url: 'https://learn.microsoft.com/zh-cn/windows/wsl/install' }}
                statusText={runtimeStatus.shell.wsl?.available ? `${runtimeStatus.shell.wsl.defaultDistro || '未设置'}` : '未安装'}
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
        </div>
      )}
    </SettingsCard>
  )
}

function StatusGridItem({ name, ok, version, hide }: {
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