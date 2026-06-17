/**
 * 工具内容 Token 估算模块
 *
 * 基于字符级启发式估算文本的 token 消耗量，
 * 用于在 canUseTool 中拦截可能因 token 截断而失败的大文件写入。
 */

/** Write 内容的 token 阈值，超过此值触发分块写入引导 */
export const WRITE_CONTENT_TOKEN_THRESHOLD = 16_000

/**
 * 判断 Unicode 码点是否为 CJK 字符。
 *
 * 覆盖区间：CJK 统一汉字、CJK 符号标点、全角形式、
 * 韩文音节、平假名、片假名、CJK 扩展 A/B。
 */
export function isCjkCodePoint(cp: number): boolean {
  return (
    (cp >= 0x4e00 && cp <= 0x9fff) || // CJK Unified Ideographs
    (cp >= 0x3000 && cp <= 0x303f) || // CJK Symbols and Punctuation
    (cp >= 0xff00 && cp <= 0xffef) || // Fullwidth Forms
    (cp >= 0xac00 && cp <= 0xd7af) || // Hangul Syllables
    (cp >= 0x3040 && cp <= 0x30ff) || // Hiragana + Katakana
    (cp >= 0x3400 && cp <= 0x4dbf) || // CJK Extension A
    (cp >= 0x20000 && cp <= 0x2a6df) // CJK Extension B (supplementary)
  )
}

/**
 * 估算文本的近似 token 数量。
 *
 * CJK 字符 BPE 分词效率较低，保守估计：
 * - CJK ≈ 1.5 tokens/char
 * - ASCII ≈ 0.25 tokens/char
 * - 其他 ≈ 0.75 tokens/char
 *
 * 偏保守：宁可高估触发分块，也不要低估导致截断。
 */
export function estimateTokenCount(text: string): number {
  let cjkCount = 0
  let asciiCount = 0
  let otherCount = 0

  for (const char of text) {
    const cp = char.codePointAt(0) ?? 0
    if (isCjkCodePoint(cp)) {
      cjkCount++
    } else if (cp < 128) {
      asciiCount++
    } else {
      otherCount++
    }
  }

  return Math.ceil(cjkCount * 1.5 + asciiCount * 0.25 + otherCount * 0.75)
}
