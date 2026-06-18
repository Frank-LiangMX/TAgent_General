/** SDK 分类名 → 中文展示（未映射则显示原文） */
export const CONTEXT_USAGE_LABELS: Record<string, string> = {
  'System prompt': '系统提示词',
  'Tool definitions': '工具定义',
  Rules: '规则',
  Skills: '技能',
  'MCP tools': 'MCP 工具',
  Memory: '记忆文件',
  Conversation: '对话',
  Messages: '消息',
  Attachments: '附件',
  Agents: '子 Agent',
  'Slash commands': '斜杠命令',
}

export function getContextUsageLabel(name: string): string {
  return CONTEXT_USAGE_LABELS[name] ?? name
}
