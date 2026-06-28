/** SDK 分类名 → 中文展示（未映射则显示原文） */
export const CONTEXT_USAGE_LABELS: Record<string, string> = {
  'System prompt': '系统提示词',
  'System tools': '内置工具',
  'Tool definitions': '工具定义',
  'Custom agents': '子 Agent',
  Rules: '规则',
  'Free space': '剩余空间',
  Skills: '技能',
  'MCP tools': 'MCP 工具',
  Memory: '记忆文件',
  Conversation: '对话',
  Messages: '消息',
  Attachments: '附件',
  Agents: '子 Agent',
  'Slash commands': '斜杠命令',
  'Autocompact buffer': '自动压缩预留',
  // 面板头部 / 元信息
  'Context 容量': 'Context 容量',
  '已用 / 窗口': '已用 / 窗口',
  自动压缩: '自动压缩',
  自动压缩阈值: '自动压缩阈值',
  // 消息明细
  用户消息: '用户消息',
  助手消息: '助手消息',
  工具调用: '工具调用',
  工具结果: '工具结果',
  附件明细: '附件',
  附件: '附件',
  // 表头 / 底栏
  分类: '分类',
  Token: 'Token',
  占比: '占比',
  // 脚注
  SDK窗口差异: 'SDK 窗口差异',
  流式估算: '流式估算',
  分项刷新中: '分项刷新中',
  分项为SDK估算: '分项为 SDK 估算',
  压缩上下文: '压缩上下文',
  客户端快速压缩: '快速压缩',
  // 底栏统计
  累计输入: '输入',
  累计输出: '输出',
  会话费用: '费用',
  对话轮数: '轮',
}

/** 分项说明（Tooltip） */
export const CONTEXT_USAGE_DESCRIPTIONS: Record<string, string> = {
  'System prompt':
    'Agent 的系统指令与工作区说明等固定前缀，每次请求都会携带。通常包含身份、行为规范、cwd 与项目约束。',
  'System tools':
    'Claude Agent SDK 内置工具（Read、Write、Bash、Grep 等）的 JSON schema 定义占用。',
  'Tool definitions':
    '与「内置工具」相同，部分 SDK 版本在分项中使用此名称。',
  'MCP tools':
    '已注册 MCP 服务器的工具定义。工具多或 schema 大时会显著占用上下文；标记「延迟」的尚未加载。',
  'Custom agents':
    'Task 等子 Agent 的类型说明与调用约束，供主 Agent 派发子任务时使用。',
  Agents: '与「子 Agent」相同，子 Agent 定义与元数据占用。',
  Rules:
    '项目或用户规则文件（如 CLAUDE.md、.cursor/rules）注入到 prompt 的规则类内容。',
  'Free space':
    '当前窗口内尚未被分类项占用的可用额度。注意：不含「自动压缩预留」，两者分开统计。',
  Skills: '工作区 Skills 目录下的技能配置与 frontmatter，Agent 可按需引用。',
  Memory: 'TAgent 记忆层（用户画像、项目事实、L0-L5 等）注入到 prompt 的内容。',
  Conversation:
    '本会话累计的对话体：用户输入、助手回复、工具调用与返回等（与 Messages 同类项）。',
  Messages:
    '本会话消息主体：用户输入、助手回复、工具调用参数与工具返回结果等动态增长部分。',
  Attachments: '随消息附加或引用的文件、图片等，编码进上下文后的 token 体积。',
  'Slash commands':
    '内置斜杠命令（如 /compact）相关的提示与帮助文本注入。',
  'Autocompact buffer':
    'SDK 在窗口内预留的额度，用于接近上限时执行自动压缩（摘要历史）。不是已发送的对话，也不能当作可用空间。',
  'Context 容量':
    '当前模型上下文窗口的整体占用比例，数据来自 SDK getContextUsage()，与底栏圆环同源。',
  '已用 / 窗口':
    '已统计占用的 token 总数相对模型窗口上限。分项含 SDK 预留空间时，可能与「剩余空间」之和与直觉略有差异。',
  自动压缩:
    '开启后，当上下文接近阈值时，SDK 会自动用模型摘要较早对话以释放空间（不等同于底栏「客户端压缩」）。',
  自动压缩阈值:
    '触发自动压缩的 token 水位线。通常为有效窗口的约 77.5%，具体由 SDK / CLI 配置决定。',
  用户消息: '你在本会话中发送的文本、指令及 @ 引用等用户侧内容。',
  助手消息: 'Agent 模型生成的自然语言回复（不含工具调用块本身）。',
  工具调用: 'Agent 决定调用工具时，写入上下文的工具名、参数与 schema 占用。',
  工具结果: '工具执行后的返回内容（读文件、命令输出、MCP 结果等），往往是对话中增长最快的部分之一。',
  附件明细: '本分类下计入的附件与多媒体内容 token（图片、文档等）。',
  附件: '本分类下计入的附件与多媒体内容 token（图片、文档等）。',
  延迟加载:
    '该 MCP 工具尚未加载到当前上下文，仅占位或未计入；展开连接后体积可能上升。',
  分类: 'SDK getContextUsage() 返回的上下文占用分项，按来源归类统计。',
  Token: '该项在上下文窗口中估算占用的 token 数量（非精确计费 token）。',
  占比: '该项 token 数占模型上下文窗口上限的百分比。',
  SDK窗口差异:
    'SDK 报告的原始窗口上限可能与 TAgent 按模型配置的展示窗口不同；分项百分比以展示窗口为分母。',
  流式估算:
    '圆环加载完成前的临时数值，来自 API 流式 usage，可能与 SDK 分项总和不一致。',
  分项刷新中: 'SDK 正在重新计算分项明细，摘要百分比可先参考。',
  分项为SDK估算: '各分类 token 由 Claude Agent SDK 估算，与供应商账单可能略有偏差。',
  压缩上下文:
    '调用 SDK 压缩流程，用模型摘要较早对话以释放窗口空间；对话进行中时不可用。',
  客户端快速压缩:
    '不调 LLM，直接丢弃较早的 tool 块以腾空间；速度快，但不如完整压缩保留的信息多。',
  累计输入: '本会话至今所有 API 请求的 input token 累计（含缓存读取与写入，非当前窗口占用）。',
  累计输出: '本会话至今模型生成的 output token 累计。',
  会话费用: '按渠道模型单价估算的本会话 API 费用（美元），仅供参考。',
  对话轮数: '本会话中用户发送消息的次数（一轮 = 一次用户输入及其后续 Agent 响应）。',
  缓存读取: '占总会话 input 的比例。多为系统提示词、工具定义等静态前缀的跨请求复用。',
}

const LABEL_LOOKUP = new Map<string, string>(
  Object.entries(CONTEXT_USAGE_LABELS).flatMap(([key, label]) => [
    [key, label],
    [key.toLowerCase(), label],
  ])
)

const DESCRIPTION_LOOKUP = new Map<string, string>(
  Object.entries(CONTEXT_USAGE_DESCRIPTIONS).flatMap(([key, desc]) => [
    [key, desc],
    [key.toLowerCase(), desc],
  ])
)

export function getContextUsageLabel(name: string): string {
  return LABEL_LOOKUP.get(name) ?? LABEL_LOOKUP.get(name.toLowerCase()) ?? name
}

export function getContextUsageDescription(name: string): string | undefined {
  return DESCRIPTION_LOOKUP.get(name) ?? DESCRIPTION_LOOKUP.get(name.toLowerCase())
}
