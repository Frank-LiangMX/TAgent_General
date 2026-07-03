/**
 * FeedbackDialog - 错误反馈 Dialog
 *
 * 错误卡片上「反馈给开发者」按钮打开此 Dialog。
 * 预览脱敏后的诊断信息（Markdown），用户可编辑后选三种方式提交：
 * - 复制到剪贴板
 * - 保存为 .md 文件
 * - 打开 GitHub Issue（body 预填）
 *
 * 隐私保证：不收集 API Key、不收集对话内容；只收集错误信息 + 环境/渠道元数据。
 */

import { AlertTriangle, Check, Copy, Download, ExternalLink } from 'lucide-react'
import * as React from 'react'
import { useAtom, useAtomValue } from 'jotai'

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
} from '@tagent/ui'
import type { Channel } from '@tagent/shared'
import { channelsAtom } from '@/atoms/model-atoms'
import { feedbackDialogAtom, type FeedbackDialogData } from '@/atoms/feedback'

declare const __APP_VERSION__: string

const GITHUB_ISSUES_URL = 'https://github.com/Frank-LiangMX/TAgent_General/issues/new'
/** GitHub Issue URL 总长安全阈值（浏览器 URL 上限通常 8K~32K，中文编码会 9 倍膨胀，保守取 3000 留余量） */
const GITHUB_ISSUE_URL_MAX = 3000

/** 反查当前错误对应的渠道（用于附加 provider / baseURL 等元数据） */
function findChannel(channels: Channel[], data: FeedbackDialogData | null): Channel | undefined {
  if (!data) return undefined
  if (data.channelId) {
    const byId = channels.find((c) => c.id === data.channelId)
    if (byId) return byId
  }
  if (data.modelId) {
    const byModel = channels.find((c) => c.models?.some((m) => m.id === data.modelId))
    if (byModel) return byModel
  }
  return undefined
}

/** 生成脱敏后的诊断信息 Markdown（不读 channel.apiKey） */
function buildDiagnosticMarkdown(
  data: FeedbackDialogData | null,
  channel: Channel | undefined
): string {
  if (!data) return ''
  const lines: string[] = []
  lines.push('# TAgent 错误反馈')
  lines.push('')
  lines.push('## 错误信息')
  if (data.errorCode) lines.push(`- 错误代码: ${data.errorCode}`)
  if (data.errorTitle) lines.push(`- 错误标题: ${data.errorTitle}`)
  lines.push(`- 错误消息: ${data.errorMessage}`)
  if (data.errorDetails && data.errorDetails.length > 0) {
    lines.push('- 原始错误详情:')
    lines.push('```')
    lines.push(data.errorDetails.join('\n'))
    lines.push('```')
  }
  lines.push('')
  lines.push('## 环境')
  lines.push(`- TAgent 版本: ${__APP_VERSION__}`)
  lines.push(`- 平台: ${navigator.platform}`)
  lines.push(`- UserAgent: ${navigator.userAgent}`)
  lines.push(`- 反馈时间: ${new Date().toISOString()}`)
  lines.push('')
  lines.push('## 渠道与模型')
  if (channel) {
    lines.push(`- 渠道: ${channel.name}`)
    lines.push(`- Provider: ${channel.provider}`)
    lines.push(`- BaseURL: ${channel.baseUrl}`)
  }
  if (data.modelId) lines.push(`- 模型: ${data.modelId}`)
  lines.push('')
  if (data.sessionId) {
    lines.push('## 会话')
    lines.push(`- SessionID: ${data.sessionId}`)
    lines.push('')
  }
  lines.push('## 用户补充说明')
  lines.push('<!-- 可在此填写复现步骤 / 期望行为 / 联系方式，或保留空白 -->')
  lines.push('')
  return lines.join('\n')
}

export function FeedbackDialog(): React.ReactElement {
  const [{ open, data }, setFeedbackDialog] = useAtom(feedbackDialogAtom)
  const channels = useAtomValue(channelsAtom)
  const [content, setContent] = React.useState('')
  const [copied, setCopied] = React.useState(false)

  // 仅在 Dialog 由关闭→打开时重新生成初始 markdown，避免 Dialog 打开期间 channels/data 变化覆盖用户编辑
  const prevOpenRef = React.useRef(false)
  React.useEffect(() => {
    const wasOpen = prevOpenRef.current
    prevOpenRef.current = open
    if (open && !wasOpen) {
      const channel = findChannel(channels, data)
      setContent(buildDiagnosticMarkdown(data, channel))
    }
  }, [open, data, channels])

  const setOpen = React.useCallback(
    (next: boolean) => setFeedbackDialog((prev) => ({ ...prev, open: next })),
    [setFeedbackDialog]
  )

  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('[FeedbackDialog] 复制失败:', error)
    }
  }, [content])

  const handleSaveFile = React.useCallback(() => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tagent-feedback-${Date.now()}.md`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }, [content])

  const handleGitHubIssue = React.useCallback(async () => {
    const body = encodeURIComponent(content)
    const url = `${GITHUB_ISSUES_URL}?body=${body}`
    if (url.length > GITHUB_ISSUE_URL_MAX) {
      // URL 过长会被浏览器 / Electron 截断 —— 提示用户改用文件方式
      alert(
        `诊断信息过长（URL 总长 ${url.length} 字符），浏览器可能无法打开。\n请改用「保存文件」方式，然后手动将文件附加到 Issue 中。`
      )
      return
    }
    try {
      await window.electronAPI.openExternal(url)
    } catch (error) {
      console.error('[FeedbackDialog] 打开 GitHub Issue 失败:', error)
      alert('打开 GitHub Issue 失败，请改用「复制到剪贴板」方式。')
    }
  }, [content])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>反馈错误诊断信息</DialogTitle>
          <DialogDescription>
            下方预览区已自动填入脱敏后的诊断信息，可直接编辑删减后选择提交方式
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs">
          <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="text-amber-700 dark:text-amber-300">
            <p className="font-medium">隐私说明</p>
            <p className="mt-0.5 text-amber-600 dark:text-amber-400">
              收集：错误信息 + 环境与渠道元数据。不收集：API Key、对话内容、会话 JSONL。
            </p>
          </div>
        </div>

        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[320px] font-mono text-xs"
          placeholder="诊断信息将在此处显示..."
        />

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={handleCopy} className="w-full sm:w-auto">
            {copied ? <Check className="size-3.5 mr-1.5" /> : <Copy className="size-3.5 mr-1.5" />}
            {copied ? '已复制' : '复制到剪贴板'}
          </Button>
          <Button variant="outline" onClick={handleSaveFile} className="w-full sm:w-auto">
            <Download className="size-3.5 mr-1.5" />
            保存为文件
          </Button>
          <Button onClick={handleGitHubIssue} className="w-full sm:w-auto">
            <ExternalLink className="size-3.5 mr-1.5" />
            打开 GitHub Issue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
