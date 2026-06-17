/**
 * AskHeuristicDialog — 启发式发送前提示对话框
 *
 * Ask 档位下，若用户消息匹配"动手意图"关键词（详见 ask-heuristic.ts），
 * 弹出一个对话框让用户确认：
 * - 「切到 Agent 档位并发送」：调用 onSwitchAndSend
 * - 「继续在 Ask 发送」：调用 onSendAsAsk
 * - 「取消」：调用 onCancel
 *
 * 选 Ask 模式时，请求实际仍通过 ask-service 发送（文档处理等），
 * 模型在 system prompt 约束下会解释边界并调用 suggest_agent_switch。
 */

import { AlertTriangle, ArrowRight, MessageCircle, X } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'

export type AskHeuristicChoice = 'switch' | 'ask' | 'cancel'

interface AskHeuristicDialogProps {
  open: boolean
  messagePreview: string
  onChoice: (choice: AskHeuristicChoice) => void
}

export function AskHeuristicDialog({
  open,
  messagePreview,
  onChoice,
}: AskHeuristicDialogProps): React.ReactElement | null {
  if (!open) return null

  const truncated =
    messagePreview.length > 200 ? messagePreview.slice(0, 200) + '…' : messagePreview

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 animate-in fade-in duration-150"
      onClick={() => onChoice('cancel')}
    >
      <div
        className="bg-card rounded-xl shadow-2xl w-[min(90vw,440px)] p-5 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-sm font-medium text-foreground">这条消息可能需要 Agent 档位</h2>
          </div>
          <button
            type="button"
            onClick={() => onChoice('cancel')}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            aria-label="关闭"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          Ask 档位只能对话，不能写文件或执行命令。检测到你的消息含"动手意图"关键词（修改文件 /
          运行命令 / 写代码…），建议切到 Agent 档位。
        </p>

        <div className="rounded-md bg-muted/50 px-3 py-2 mb-4 max-h-32 overflow-y-auto">
          <div className="text-[10px] font-medium text-muted-foreground mb-1">消息预览</div>
          <div className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
            {truncated}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChoice('cancel')}
            className="h-8 px-3 text-xs"
          >
            取消
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChoice('ask')}
            className="h-8 px-3 text-xs"
          >
            <MessageCircle className="size-3.5 mr-1.5" />
            继续在 Ask 发送
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => onChoice('switch')}
            className="h-8 px-3 text-xs"
          >
            切到 Agent 并发送
            <ArrowRight className="size-3 ml-1.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
