/**
 * SettingsSearchIndex - 设置页全局搜索索引
 *
 * 为每个设置 tab 编制可搜索的设置项 + 关键词。
 * 支持：
 * - tab 标题搜索
 * - 设置项标签搜索
 * - 关键词模糊匹配
 *
 * 搜索结果支持跳转到对应 tab，并通过 URL hash 高亮目标设置项。
 */

import type { SettingsTab } from '@/atoms/settings-tab'

/** 单个可搜索的设置项 */
export interface SearchableItem {
  /** 唯一 ID（用于 DOM 锚点跳转） */
  id: string
  /** 显示标题 */
  title: string
  /** 描述（可选） */
  description?: string
  /** 额外关键词（用于模糊匹配） */
  keywords?: string[]
}

/** Tab 级别的搜索条目 */
export interface SearchableTab {
  /** tab id */
  tabId: SettingsTab
  /** tab 显示名称 */
  tabLabel: string
  /** tab 描述（可选） */
  tabDescription?: string
  /** tab 内可搜索的设置项 */
  items: SearchableItem[]
}

/** 设置页全局搜索索引 */
export const SETTINGS_SEARCH_INDEX: SearchableTab[] = [
  {
    tabId: 'general',
    tabLabel: '通用设置',
    tabDescription: '用户档案、通知、归档、消息置顶条、关闭窗口',
    items: [
      {
        id: 'user-avatar',
        title: '头像',
        description: '更换用户头像',
        keywords: ['emoji', '图片', 'profile', '用户'],
      },
      {
        id: 'user-name',
        title: '用户名',
        description: '编辑显示名称',
        keywords: ['profile', '用户', '显示'],
      },
      { id: 'language', title: '语言', description: '界面语言（简体中文）' },
      { id: 'desktop-notification', title: '桌面通知', description: 'Agent 完成任务时通知' },
      { id: 'notification-sound', title: '通知提示音', description: '阻塞操作时播放提示音' },
      { id: 'sound-task-complete', title: '任务完成音效', description: '任务完成时播放的音效' },
      { id: 'sound-permission', title: '权限审批音效', description: '权限请求时播放的音效' },
      { id: 'sound-plan', title: '计划审批音效', description: '计划审批时播放的音效' },
      {
        id: 'auto-archive',
        title: '自动归档',
        description: '超过指定天数自动归档',
        keywords: ['archive', '归档'],
      },
      {
        id: 'close-action',
        title: '关闭窗口',
        description: '关闭按钮隐藏到托盘，托盘右键退出',
        keywords: ['close', 'quit', '退出', '托盘', 'tray', '关闭窗口'],
      },
      { id: 'sticky-message', title: '消息悬浮置顶条', description: '滚动时显示最近用户消息' },
    ],
  },
  {
    tabId: 'channels',
    tabLabel: 'AI 渠道',
    tabDescription: '添加和管理 AI 模型渠道',
    items: [
      {
        id: 'add-channel',
        title: '添加渠道',
        description: '添加新的 AI 渠道',
        keywords: ['add', '新增'],
      },
      { id: 'channel-list', title: '已配置渠道', description: '查看和编辑现有渠道' },
      { id: 'default-model', title: '默认模型', description: '选择默认使用的模型' },
    ],
  },
  {
    tabId: 'prompts',
    tabLabel: '提示词管理',
    tabDescription: '管理 Chat 模式的系统提示词',
    items: [
      { id: 'create-prompt', title: '新建提示词', description: '创建新的系统提示词' },
      { id: 'default-prompt', title: '默认提示词', description: '设置默认使用的提示词' },
      { id: 'append-datetime', title: '追加日期时间和用户名', description: '在提示词末尾自动追加' },
    ],
  },
  {
    tabId: 'proxy',
    tabLabel: '代理设置',
    tabDescription: '网络代理配置',
    items: [
      { id: 'proxy-enable', title: '启用代理', description: '是否使用代理服务器' },
      { id: 'proxy-type', title: '代理类型', description: 'HTTP/HTTPS/SOCKS5 代理' },
      { id: 'proxy-host', title: '代理服务器', description: '代理服务器地址和端口' },
    ],
  },
  {
    tabId: 'voice-input',
    tabLabel: '语音输入',
    tabDescription: '豆包 ASR 语音输入配置',
    items: [
      { id: 'voice-app-id', title: '豆包 APP ID', description: 'X-Api-App-Key' },
      { id: 'voice-access-token', title: '豆包 Access Token', description: 'X-Api-Access-Key' },
      { id: 'voice-resource-id', title: 'Resource ID', description: '豆包 ASR 资源 ID' },
      { id: 'voice-language', title: '识别语言', description: '语音识别语言设置' },
      { id: 'voice-hotwords', title: '自定义热词', description: '提升专业词汇识别准确率' },
      { id: 'voice-test', title: '测试连接', description: '测试豆包 ASR 连接' },
    ],
  },
  {
    tabId: 'bots',
    tabLabel: '远程连接',
    tabDescription: '飞书 / 钉钉 / 微信 / WPS 协作远程连通',
    items: [
      {
        id: 'feishu-config',
        title: '飞书 Bot',
        description: '飞书 Bridge 配置',
        keywords: ['feishu', 'lark'],
      },
      {
        id: 'dingtalk-config',
        title: '钉钉 Bot',
        description: '钉钉 Bridge 配置',
        keywords: ['dingtalk'],
      },
      {
        id: 'wechat-config',
        title: '微信 Bot',
        description: '微信 Bridge 配置',
        keywords: ['wechat', 'wx'],
      },
      {
        id: 'wps-config',
        title: 'WPS 协作',
        description: 'WPS365 回调与 Bridge 配置',
        keywords: ['wps', 'xiezuo', '协作', 'wps365'],
      },
    ],
  },
  {
    tabId: 'shortcuts',
    tabLabel: '快捷键管理',
    tabDescription: '查看和自定义全局快捷键',
    items: [
      {
        id: 'shortcut-quick-task',
        title: '快速任务',
        description: '打开快速任务窗口',
        keywords: ['Alt+Space'],
      },
      {
        id: 'shortcut-show-main',
        title: '显示主窗口',
        description: '显示/隐藏主窗口',
        keywords: ['CommandOrControl+Shift+P'],
      },
      { id: 'shortcut-voice', title: '语音输入', description: '语音输入快捷键' },
    ],
  },
  {
    tabId: 'insights',
    tabLabel: '数据洞察',
    tabDescription: '使用统计和磁盘管理（合并视图）',
    items: [
      { id: 'insights-hero', title: '总览指标', description: 'Token 总数 / 累计费用 / 存储用量' },
      { id: 'insights-time-range', title: '时间范围', description: '今日/本周/本月/全部' },
      { id: 'insights-tokens', title: 'Token 消耗', description: '按模型统计的 token 消耗' },
      { id: 'insights-cost', title: '费用统计', description: '按模型统计的费用' },
      { id: 'insights-storage', title: '存储分布', description: '各类别磁盘占用' },
      { id: 'insights-auto-cleanup', title: '自动清理', description: '启动清理和归档清理配置' },
      { id: 'insights-clean-temp', title: '清理临时文件', description: '一键清理预览和安装缓存' },
      { id: 'insights-clean-orphans', title: '清理孤儿数据', description: '检测和清理孤儿数据' },
    ],
  },
  {
    tabId: 'appearance',
    tabLabel: '外观设置',
    tabDescription: '主题、皮肤、字号、材质',
    items: [
      {
        id: 'theme-mode',
        title: '主题模式',
        description: '浅色/深色/跟随系统',
        keywords: ['theme', 'dark', 'light'],
      },
      { id: 'theme-style', title: '皮肤风格', description: '10 种主题风格' },
      { id: 'brand-color', title: '品牌色', description: 'TAgent 品牌色' },
      { id: 'markdown-font-size', title: 'Markdown 字号', description: '阅读字号档位' },
      { id: 'advanced-material', title: '高级材质', description: '高透玻璃 / 低透磨砂玻璃' },
    ],
  },
  {
    tabId: 'about',
    tabLabel: '关于/更新',
    tabDescription: '版本信息、更新检查、教程',
    items: [
      { id: 'about-version', title: '版本', description: '应用版本号' },
      { id: 'about-check-update', title: '检查更新', description: '检查并安装更新' },
      { id: 'about-tutorial', title: '打开教程', description: '在浏览器中打开使用教程' },
      { id: 'about-environment', title: '运行环境', description: 'Node.js / Git / Shell 状态' },
      { id: 'about-github', title: 'GitHub 仓库', description: '项目源代码' },
    ],
  },
]

/** 搜索结果 */
export interface SearchResult {
  tab: SearchableTab
  item?: SearchableItem
  /** 匹配度分数（越高越相关） */
  score: number
}

/**
 * 全局搜索
 *
 * @param query 搜索关键词
 * @returns 排序后的搜索结果
 */
export function searchSettings(query: string): SearchResult[] {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return []

  const results: SearchResult[] = []

  for (const tab of SETTINGS_SEARCH_INDEX) {
    // 匹配 tab 标题
    if (tab.tabLabel.toLowerCase().includes(trimmed)) {
      results.push({ tab, score: 100 })
    }

    // 匹配 tab 描述
    if (tab.tabDescription?.toLowerCase().includes(trimmed)) {
      results.push({ tab, score: 50 })
    }

    // 匹配设置项
    for (const item of tab.items) {
      let score = 0

      if (item.title.toLowerCase().includes(trimmed)) {
        score += 30
      }
      if (item.description?.toLowerCase().includes(trimmed)) {
        score += 10
      }
      if (item.keywords?.some((k) => k.toLowerCase().includes(trimmed))) {
        score += 5
      }

      if (score > 0) {
        results.push({ tab, item, score: score + 10 })
      }
    }
  }

  // 按分数倒序，去重
  const seen = new Set<string>()
  return results
    .sort((a, b) => b.score - a.score)
    .filter((r) => {
      const key = `${r.tab.tabId}:${r.item?.id ?? ''}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}
