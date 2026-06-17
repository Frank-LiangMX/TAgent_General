/**
 * Ask 档位启发式检测
 *
 * 模式：粗略匹配用户消息中的"动手意图"关键词，
 * 用于在 Ask 档位下发送前给出切换提示。
 *
 * 设计取舍：
 * - 高召回、低精度：宁可多提示一次让用户自己判断，也不要漏掉真动手意图
 * - 不解析意图：只匹配字面关键词（包含中英文 + 常见代码/工具 token）
 * - 用户可一键忽略，重复操作不打扰
 */

const FILE_OPS_ZH = [
  '帮我改',
  '帮我写',
  '帮我创建',
  '帮我添加',
  '帮我删除',
  '帮我移除',
  '帮我重命名',
  '帮我搬',
  '帮我生成',
  '帮我修复',
  '帮我调',
  '帮我部署',
  '帮我打包',
  '帮我安装',
  '帮我跑',
  '帮我运行',
  '帮我执行',
  '帮我检查',
  '帮我排查',
  '帮我优化',
  '帮我重写',
  '帮我重构',
  '改一下',
  '写一下',
  '创建一下',
  '写个',
  '写一个',
  '创建个',
  '加个',
  '加一下',
  '改个',
  '改这份',
  '改下',
]
const FILE_OPS_EN = [
  'write a file',
  'create a file',
  'edit the file',
  'modify the',
  'update the',
  'delete the',
  'rename the',
  'add a file',
  'add an',
  'fix the bug',
  'refactor the',
  'rewrite the',
  'implement the',
]
const SHELL_OPS_ZH = [
  '运行',
  '跑一下',
  '跑个',
  '跑这个',
  '执行',
  '跑命令',
  '运行命令',
  '命令行',
  '终端里',
  'shell 里',
  '执行命令',
  '安装依赖',
  '装一下',
  '装个',
]
const SHELL_OPS_EN = [
  'run the',
  'execute the',
  'shell command',
  'in the terminal',
  'npm install',
  'npm run',
  'yarn install',
  'yarn add',
  'pnpm install',
  'pnpm add',
  'pip install',
  'pip3 install',
  'brew install',
  'cargo run',
  'go run',
  'make ',
]
const FILE_EXT_RE =
  /\.(ts|tsx|js|jsx|mjs|cjs|py|rs|go|java|kt|swift|c|cpp|cc|h|hpp|md|json|ya?ml|toml|ini|sh|bash|zsh|sql|css|scss|html|vue|svelte|php|rb|dart)\b/i
const PATH_HINT_RE =
  /(?:^|\s|[`'"'"])(?:\.{0,2}\/)?(?:[\w-]+\/)*[\w-]+\.(ts|tsx|js|jsx|py|rs|go|java|json|md|sh)\b/i

/** 综合检测：true → 消息很可能需要 Agent 档位 */
export function isLikelyAgentIntent(text: string): boolean {
  if (!text) return false
  const lower = text.toLowerCase()

  for (const k of FILE_OPS_ZH) {
    if (text.includes(k)) return true
  }
  for (const k of FILE_OPS_EN) {
    if (lower.includes(k)) return true
  }
  for (const k of SHELL_OPS_ZH) {
    if (text.includes(k)) return true
  }
  for (const k of SHELL_OPS_EN) {
    if (lower.includes(k)) return true
  }
  if (
    FILE_EXT_RE.test(text) &&
    /\b(改|写|创建|编辑|修改|删除|添加|移除|看|读|打开|新建|重命名|移动|编辑一下|改一下|看一下)\b/.test(
      text
    )
  ) {
    return true
  }
  if (
    PATH_HINT_RE.test(text) &&
    /\b(改|写|创建|编辑|修改|删除|添加|移除|重命名|移动|新建)\b/.test(text)
  ) {
    return true
  }
  return false
}
