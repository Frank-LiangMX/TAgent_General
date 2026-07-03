/**
 * Automation Prompt 安全扫描器
 *
 * 防止 cron/automation 被用作 prompt injection 载体：
 * - 第一层：剥离 invisible unicode（零宽空格、BOM、Word joiner 等），只 sanitize 不 block
 *   原因：不可见字符可能是用户无意粘贴进来的，不一定是恶意，但执行前必须清掉，
 *   否则会在 Agent 看不见的位置携带藏匿指令。
 * - 第二层：可疑模式匹配（"忽略以上所有指令" / "<|im_start|>" 等 jailbreak 特征短语），
 *   命中即 block，写日志 + 通知用户，不执行。
 *
 * 应用点：
 * 1. automation-manager.createAutomation/updateAutomation：写入前拦截
 * 2. automation-scheduler.runAutomation：执行前再扫一次（防御 runtime 期间被外部修改）
 *
 * 注意：scanner 永远不能"修改 prompt 后放行"——只剥离 invisible unicode，
 * 可疑模式一律 block。否则恶意 prompt 经过 sanitize 后仍可能保留攻击 payload。
 */

/**
 * 可疑模式列表（命中即 block，不区分大小写）
 *
 * 维护原则：
 * - 只列 jailbreak 高置信特征短语，避免误伤正常 prompt
 * - 中英双语覆盖
 * - 包含 chat template 越界标记（<|im_start|>、</system> 等）
 * - 新增模式时同步在 automation-prompt-scanner.test.ts 加用例
 */
const SUSPICIOUS_PATTERNS: ReadonlyArray<RegExp> = [
  // 中文 jailbreak
  /忽略以上所有指令/,
  /忽略上面所有指令/,
  /忽略前面的所有指令/,
  /你的新指令是/,
  /你现在是/,
  /请忽略你的设定/,
  /请忽略系统提示/,
  // 英文 jailbreak
  /ignore (all )?previous instructions/i,
  /ignore (all )?prior instructions/i,
  /disregard (all )?previous instructions/i,
  /system prompt override/i,
  /override (system |the )?instructions/i,
  /now you are/i,
  /you are now (a |an )?/i,
  /new instructions?:/i,
  /act as if/i,
  /forget everything/i,
  // Chat template 越界
  /<\/system>/i,
  /<\|im_start\|>/,
  /<\|im_end\|>/,
  /<\|system\|>/,
  /<\|user\|>/,
  /<\|assistant\|>/,
  // 强制提示注入特征
  /IMPORTANT:.*override/i,
  /\[SYSTEM\]/i,
]

/**
 * Invisible Unicode 字符列表
 *
 * 这些字符在视觉上不可见，可被用于藏匿 payload。
 * 只剥离不 block（用户可能是无意粘贴的），剥离后继续走模式匹配。
 */
const INVISIBLE_UNICODE_PATTERNS: ReadonlyArray<RegExp> = [
  // 零宽字符族（U+200B ~ U+200D, U+2060, U+FEFF）
  /[​-‍⁠﻿]/g,
  // 方向控制字符（LRE/RLE/PDF/LRO/RLO 等，U+202A ~ U+202E）
  /[‪-‮]/g,
  // Bidi isolate（U+2066 ~ U+2069）
  /[⁦-⁩]/g,
  // 其他不可见/格式字符（U+00AD 软连字符、U+180E 蒙古元音分隔符）
  /[­᠎]/g,
  // U+2061 ~ U+2064 函数应用/invisible times 等（数学不可见字符）
  /[⁡-⁤]/g,
]

/** 扫描结果 */
export interface ScanResult {
  /** 是否拦截（true = 命中可疑模式，不执行） */
  blocked: boolean
  /** 拦截原因列表（每条对应一个命中的模式） */
  reasons: string[]
  /** 命中的可疑模式源字符串列表 */
  patterns: string[]
  /** 剥离 invisible unicode 后的 prompt（无论是否 block，都返回 sanitized 版本） */
  sanitizedPrompt: string
  /** 被剥离的 invisible unicode 字符数（用于日志记录） */
  strippedInvisibleCount: number
}

/**
 * 剥离 invisible unicode 字符
 *
 * 不修改原字符串，返回新字符串。同时返回剥离的字符数，便于日志审计。
 */
export function sanitizeInvisibleUnicode(prompt: string): {
  sanitized: string
  strippedCount: number
} {
  let sanitized = prompt
  let strippedCount = 0
  for (const pattern of INVISIBLE_UNICODE_PATTERNS) {
    // 同一字符类可能命中多次，需要全部统计
    const matches = sanitized.match(new RegExp(pattern.source, pattern.flags))
    if (matches) strippedCount += matches.length
    sanitized = sanitized.replace(pattern, '')
  }
  return { sanitized, strippedCount }
}

/**
 * 扫描 automation prompt
 *
 * 双层扫描：
 * 1. 先剥离 invisible unicode（log 但不 block）
 * 2. 再对 sanitized prompt 做可疑模式匹配（命中即 block）
 *
 * 返回 ScanResult，由调用方决定如何处理（block / 通知 / 写日志）
 */
export function scanAutomationPrompt(prompt: string): ScanResult {
  const { sanitized: sanitizedPrompt, strippedCount: strippedInvisibleCount } =
    sanitizeInvisibleUnicode(prompt)

  const matchedPatterns: string[] = []
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(sanitizedPrompt)) {
      matchedPatterns.push(pattern.source)
    }
  }

  const blocked = matchedPatterns.length > 0
  const reasons = blocked ? [`命中可疑模式: ${matchedPatterns.join(', ')}`] : []

  return {
    blocked,
    reasons,
    patterns: matchedPatterns,
    sanitizedPrompt,
    strippedInvisibleCount,
  }
}

/**
 * 拦截日志条目结构（写入 ~/.tagent[-dev]/automation/logs/{automationId}_{timestamp}.json）
 */
export interface BlockedLogEntry {
  /** 拦截时间戳（毫秒） */
  timestamp: number
  /** 触发拦截的 automation ID */
  automationId: string
  /** automation 名称（便于 UI 展示，避免每次都反查 automations.json） */
  automationName: string
  /** 拦截原因列表 */
  reasons: string[]
  /** 命中的可疑模式源字符串 */
  patterns: string[]
  /** 原始 prompt（含 invisible unicode，便于审计） */
  originalPrompt: string
  /** 剥离 invisible unicode 后的 prompt */
  sanitizedPrompt: string
  /** 被剥离的 invisible unicode 字符数 */
  strippedInvisibleCount: number
  /** 拦截来源：create（创建时拦截）/ update（更新时拦截）/ runtime（执行时拦截） */
  stage: 'create' | 'update' | 'runtime'
}

/**
 * 拦截日志摘要（列表展示用，不含完整 prompt 文本）
 *
 * 完整 originalPrompt / sanitizedPrompt 通过 getBlockedLogDetail(fileName) 单独取，
 * 避免 UI 列表一次性加载大量文本。
 */
export interface BlockedLogSummary {
  /** 日志文件名（用于查详情 / 删除） */
  fileName: string
  /** 拦截时间戳（毫秒） */
  timestamp: number
  /** 触发拦截的 automation ID */
  automationId: string
  /** automation 名称 */
  automationName: string
  /** 拦截原因列表 */
  reasons: string[]
  /** 命中的可疑模式源字符串 */
  patterns: string[]
  /** 拦截来源 */
  stage: 'create' | 'update' | 'runtime'
  /** 被剥离的 invisible unicode 字符数 */
  strippedInvisibleCount: number
}

/** 导出模式列表供测试或外部审计使用 */
export function listSuspiciousPatterns(): ReadonlyArray<string> {
  return SUSPICIOUS_PATTERNS.map((p) => p.source)
}
