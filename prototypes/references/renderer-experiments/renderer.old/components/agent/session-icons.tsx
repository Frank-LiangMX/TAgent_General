/**
 * 会话区图标 — 基于 reicon-react，与 Lucide 用法兼容（className + size-*）
 */

import type { IconComponent } from 'reicon-react/createIcon'
import {
  AlertTriangle,
  BranchDown,
  CalendarAdd,
  CalendarDays,
  CalendarMark,
  CalendarRemove2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  CloseCircle2,
  Code2,
  Database,
  Designtools2,
  DocumentText2,
  Download,
  ForbiddenCircle,
  GlobalSearch2,
  Image3,
  ImagePlus,
  Layers2,
  Link,
  List3,
  ListCheck2,
  Login2,
  Logout2,
  MagicStar2,
  Magnifier,
  Map2,
  MessageQuestion2,
  MessageText2,
  Minimize,
  Monitor,
  Notebook,
  Pen2,
  PenWriting4,
  Plug2,
  Plus,
  ProgrammingArrows2,
  QuoteDown2,
  Radio2,
  Refresh2,
  Send22,
  Server2,
  Sparkles,
  StopCircle,
  TaskSquare2,
  TerminalSquare,
  TriangleWarning,
  Undo,
} from 'reicon-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export interface SessionIconProps extends React.SVGAttributes<SVGSVGElement> {
  size?: number | string
  className?: string
}

export type SessionIconComponent = React.FC<SessionIconProps>

/** 从 Tailwind size-* 或 size prop 解析像素尺寸 */
function resolveIconSize(className?: string, size?: number | string): number {
  if (typeof size === 'number' && Number.isFinite(size)) return size
  if (typeof size === 'string') {
    const parsed = Number.parseFloat(size)
    if (Number.isFinite(parsed)) return parsed
  }

  const arbitrary = className?.match(/\bsize-\[(\d+(?:\.\d+)?)px\]/)
  if (arbitrary?.[1]) return Number.parseFloat(arbitrary[1])

  const scale = className?.match(/\bsize-([\d.]+)\b/)
  if (scale?.[1]) return Number.parseFloat(scale[1]) * 4

  return 14
}

/** 将 reicon 组件包装为会话区通用图标（支持 className / size-*） */
export function createSessionIcon(
  Reicon: IconComponent,
  displayName: string
): SessionIconComponent {
  const SessionIcon = ({ className, size, ...rest }: SessionIconProps): React.ReactElement => (
    <Reicon
      size={resolveIconSize(className, size)}
      weight="Outline"
      className={cn('shrink-0', className)}
      aria-hidden={rest['aria-hidden'] ?? true}
      {...rest}
    />
  )
  SessionIcon.displayName = displayName
  return SessionIcon
}

// ===== 会话 UI 常用图标 =====

export const SessionChevronRight = createSessionIcon(ChevronRight, 'SessionChevronRight')
export const SessionChevronDown = createSessionIcon(ChevronDown, 'SessionChevronDown')
export const SessionChevronUp = createSessionIcon(ChevronUp, 'SessionChevronUp')
export const SessionThinkingIcon = createSessionIcon(MagicStar2, 'SessionThinkingIcon')
export const SessionErrorIcon = createSessionIcon(CloseCircle2, 'SessionErrorIcon')
export const SessionAlertIcon = createSessionIcon(AlertTriangle, 'SessionAlertIcon')
export const SessionMessageTextIcon = createSessionIcon(MessageText2, 'SessionMessageTextIcon')
export const SessionRefreshIcon = createSessionIcon(Refresh2, 'SessionRefreshIcon')
export const SessionQuoteIcon = createSessionIcon(QuoteDown2, 'SessionQuoteIcon')
export const SessionAssistantIcon = createSessionIcon(Sparkles, 'SessionAssistantIcon')
export const SessionDownloadIcon = createSessionIcon(Download, 'SessionDownloadIcon')
export const SessionDocumentIcon = createSessionIcon(DocumentText2, 'SessionDocumentIcon')
export const SessionSettingsIcon = createSessionIcon(Designtools2, 'SessionSettingsIcon')
export const SessionToolFallbackIcon = createSessionIcon(Designtools2, 'SessionToolFallbackIcon')
export const SessionMcpIcon = createSessionIcon(Plug2, 'SessionMcpIcon')
export const SessionSplitIcon = createSessionIcon(BranchDown, 'SessionSplitIcon')
export const SessionUndoIcon = createSessionIcon(Undo, 'SessionUndoIcon')
export const SessionPlusIcon = createSessionIcon(Plus, 'SessionPlusIcon')
export const SessionMinimizeIcon = createSessionIcon(Minimize, 'SessionMinimizeIcon')
export const SessionExternalLinkIcon = createSessionIcon(Link, 'SessionExternalLinkIcon')
export const SessionImageFileIcon = createSessionIcon(Image3, 'SessionImageFileIcon')
export const SessionWarningMessageIcon = createSessionIcon(
  TriangleWarning,
  'SessionWarningMessageIcon'
)

/** 工具名称 → 图标（会话过程区） */
export const SESSION_TOOL_ICONS: Record<string, SessionIconComponent> = {
  Edit: createSessionIcon(Pen2, 'ToolEdit'),
  Write: createSessionIcon(PenWriting4, 'ToolWrite'),
  Read: createSessionIcon(DocumentText2, 'ToolRead'),
  Bash: createSessionIcon(TerminalSquare, 'ToolBash'),
  Glob: createSessionIcon(Magnifier, 'ToolGlob'),
  Grep: createSessionIcon(GlobalSearch2, 'ToolGrep'),
  Task: createSessionIcon(ProgrammingArrows2, 'ToolTask'),
  WebFetch: createSessionIcon(Download, 'ToolWebFetch'),
  WebSearch: createSessionIcon(GlobalSearch2, 'ToolWebSearch'),
  NotebookEdit: createSessionIcon(Notebook, 'ToolNotebookEdit'),
  Skill: createSessionIcon(MagicStar2, 'ToolSkill'),
  TodoWrite: createSessionIcon(ListCheck2, 'ToolTodoWrite'),
  TodoRead: createSessionIcon(ClipboardList, 'ToolTodoRead'),
  TaskCreate: createSessionIcon(TaskSquare2, 'ToolTaskCreate'),
  TaskUpdate: createSessionIcon(ListCheck2, 'ToolTaskUpdate'),
  TaskGet: createSessionIcon(DocumentText2, 'ToolTaskGet'),
  TaskList: createSessionIcon(List3, 'ToolTaskList'),
  Agent: createSessionIcon(Sparkles, 'ToolAgent'),
  EnterPlanMode: createSessionIcon(Map2, 'ToolEnterPlanMode'),
  ExitPlanMode: createSessionIcon(ForbiddenCircle, 'ToolExitPlanMode'),
  generate_image: createSessionIcon(ImagePlus, 'ToolGenerateImage'),
  TaskOutput: createSessionIcon(Layers2, 'ToolTaskOutput'),
  TaskStop: createSessionIcon(StopCircle, 'ToolTaskStop'),
  AskUserQuestion: createSessionIcon(MessageQuestion2, 'ToolAskUserQuestion'),
  REPL: createSessionIcon(Code2, 'ToolRepl'),
  Workflow: createSessionIcon(ProgrammingArrows2, 'ToolWorkflow'),
  ScheduleWakeup: createSessionIcon(CalendarMark, 'ToolScheduleWakeup'),
  Monitor: createSessionIcon(Monitor, 'ToolMonitor'),
  PushNotification: createSessionIcon(Send22, 'ToolPushNotification'),
  CronCreate: createSessionIcon(CalendarAdd, 'ToolCronCreate'),
  CronDelete: createSessionIcon(CalendarRemove2, 'ToolCronDelete'),
  CronList: createSessionIcon(CalendarDays, 'ToolCronList'),
  RemoteTrigger: createSessionIcon(Radio2, 'ToolRemoteTrigger'),
  EnterWorktree: createSessionIcon(Login2, 'ToolEnterWorktree'),
  ExitWorktree: createSessionIcon(Logout2, 'ToolExitWorktree'),
  ReadMcpResourceTool: createSessionIcon(Database, 'ToolReadMcpResource'),
  ListMcpResourcesTool: createSessionIcon(Server2, 'ToolListMcpResources'),
  SendMessage: createSessionIcon(Send22, 'ToolSendMessage'),
}

export function getSessionToolIcon(toolName: string): SessionIconComponent {
  if (SESSION_TOOL_ICONS[toolName]) return SESSION_TOOL_ICONS[toolName]
  if (toolName.startsWith('mcp__')) return SessionMcpIcon
  return SessionToolFallbackIcon
}
