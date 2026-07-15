/**
 * detect-ui-intent — UI 设计意图检测
 *
 * 检测用户消息中是否包含 UI/前端设计相关的关键词，
 * 用于触发 Design Preview 的自动开启提示。
 *
 * 设计来源：docs/plans/2026-07-13-design-preview-design.md §5.3
 */

/** UI 设计相关关键词（按优先级分档） */
const UI_KEYWORDS = {
  /** 高置信度：明确要求生成 UI 页面 */
  high: [
    '登录页', '注册页', '主页', '首页', '仪表盘',
    '个人中心', '设置页', '详情页', '列表页',
    '帮我设计', '帮我做个', '帮我写一个页面',
    '帮我生成一个', '做一个页面', '生成一个页面',
    '画一个', '设计一个', '布局', '原型',
  ],

  /** 中置信度：提到 UI 组件或样式 */
  medium: [
    '按钮', '导航', '菜单', '侧边栏', '页头', '页脚',
    '卡片', '列表', '输入框', '搜索框', '选择器',
    '弹窗', '模态框', '对话框', '提示框',
    '表单', '表格', '面板', '标签页', '轮播',
    '页面', '界面', 'UI', '前端', '样式', '布局',
    '颜色', '字体', '间距', '圆角', '阴影',
    '响应式', '适配', '主题',
  ],

  /** 低置信度：涉及修改或查看已有设计 */
  low: [
    '改一下', '改改', '修改', '调整', '移动', '往上', '往下',
    '放大', '缩小', '加宽', '收窄',
    '换成', '变成', '改成', '设置为',
    '好不好看', '怎么样', '看起来',
    '对齐', '居中', '靠左', '靠右',
    '间距', '紧凑', '宽松',
  ],
}

/** 组合所有关键词用于快速匹配 */
const ALL_KEYWORDS = [
  ...UI_KEYWORDS.high.map((kw) => ({ keyword: kw, level: 'high' as const })),
  ...UI_KEYWORDS.medium.map((kw) => ({ keyword: kw, level: 'medium' as const })),
  ...UI_KEYWORDS.low.map((kw) => ({ keyword: kw, level: 'low' as const })),
]

/** 检测结果 */
export interface UIIntentResult {
  /** 是否检测到 UI 意图 */
  detected: boolean
  /** 置信度：high / medium / low */
  confidence: 'high' | 'medium' | 'low'
  /** 命中的关键词 */
  matchedKeywords: string[]
  /** 简短描述（用于提示文案） */
  label: string
}

/**
 * 检测消息中是否包含 UI 设计意图。
 *
 * 检测策略：
 * - high 关键词匹配 → 高置信度，立刻提示
 * - medium 关键词匹配 ≥ 2 个 → 中置信度，提示
 * - medium 关键词匹配 1 个 + low 匹配 ≥ 2 个 → 中置信度，提示
 * - 仅 low 匹配 ≥ 3 个 → 低置信度，温和提示
 */
export function detectUIIntent(message: string): UIIntentResult {
  const normalized = message.toLowerCase()

  let highMatches: string[] = []
  let mediumMatches: string[] = []
  let lowMatches: string[] = []

  for (const { keyword, level } of ALL_KEYWORDS) {
    if (normalized.includes(keyword)) {
      if (level === 'high') highMatches.push(keyword)
      else if (level === 'medium') mediumMatches.push(keyword)
      else lowMatches.push(keyword)
    }
  }

  // 去重
  highMatches = [...new Set(highMatches)]
  mediumMatches = [...new Set(mediumMatches)]
  lowMatches = [...new Set(lowMatches)]

  // 置信度判断
  if (highMatches.length > 0) {
    return {
      detected: true,
      confidence: 'high',
      matchedKeywords: highMatches,
      label: highMatches[0]!,
    }
  }

  if (mediumMatches.length >= 2) {
    return {
      detected: true,
      confidence: 'medium',
      matchedKeywords: mediumMatches.slice(0, 3),
      label: mediumMatches.slice(0, 2).join('、'),
    }
  }

  if (mediumMatches.length === 1 && lowMatches.length >= 2) {
    return {
      detected: true,
      confidence: 'medium',
      matchedKeywords: [mediumMatches[0]!, ...lowMatches.slice(0, 2)],
      label: mediumMatches[0]!,
    }
  }

  if (lowMatches.length >= 3) {
    return {
      detected: true,
      confidence: 'low',
      matchedKeywords: lowMatches.slice(0, 3),
      label: lowMatches.slice(0, 2).join('、'),
    }
  }

  return {
    detected: false,
    confidence: 'low',
    matchedKeywords: [],
    label: '',
  }
}

/**
 * 检测助手消息末尾是否包含设计建议（用于后续扩展）。
 * 当前保留接口，后续可解析 Agent 返回中的设计意图。
 */
export function detectAgentDesignIntent(response: string): boolean {
  const agentMarkers = [
    /```html/i,
    /```css/i,
    /<!DOCTYPE html/i,
    /<html/i,
    /<div/i,
    /设计.*原型/i,
    /生成了一个.*页面/i,
    /这是我.*的.*设计/i,
  ]
  return agentMarkers.some((marker) => marker.test(response))
}

/** UI 设计相关指令前缀列表 */
const DESIGN_PREFIXES = [
  '帮我', '我想', '我需要', '我要', '请', '能不能', '可以',
  '做一个', '写一个', '设计', '生成',
]

/**
 * 检测消息是否是全新的设计请求（不是后续修改）。
 * 用于决定是否自动生成第一个页面，而不是等待用户确认。
 */
export function isNewDesignRequest(message: string): boolean {
  const normalized = message.trim()
  const hasPrefix = DESIGN_PREFIXES.some((prefix) => normalized.startsWith(prefix))
  const hasUIKeyword = UI_KEYWORDS.high.some((kw) => normalized.includes(kw))
  return hasPrefix && hasUIKeyword
}