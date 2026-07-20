/**
 * 工具内容 Token 估算模块
 *
 * 估算实现在 @tagent/shared，此处保留阈值常量与兼容 re-export，
 * 供 canUseTool 拦截大文件写入。
 */

export { estimateTokenCount, isCjkCodePoint } from '@tagent/shared'

/** Write 内容的 token 阈值，超过此值触发分块写入引导 */
export const WRITE_CONTENT_TOKEN_THRESHOLD = 16_000
