/**
 * agent-tool-token-estimator 单测
 *
 * 工具内容 token 估算（CJK / ASCII / 其他），用于 canUseTool 拦截大文件写入。
 */

import { describe, expect, test } from 'vitest'

import {
  isCjkCodePoint,
  estimateTokenCount,
  WRITE_CONTENT_TOKEN_THRESHOLD,
} from './agent-tool-token-estimator'

// ============================================
// isCjkCodePoint
// ============================================

describe('isCjkCodePoint', () => {
  describe('CJK Unified Ideographs (basic block)', () => {
    test('中 (U+4E2D) When check Then 是 CJK', () => {
      expect(isCjkCodePoint(0x4E2D)).toBe(true)
    })
    test('边界 0x4E00 When check Then 是 CJK', () => {
      expect(isCjkCodePoint(0x4E00)).toBe(true)
    })
    test('边界 0x9FFF When check Then 是 CJK', () => {
      expect(isCjkCodePoint(0x9FFF)).toBe(true)
    })
    test('低于下界 0x4DFF When check Then 不是', () => {
      expect(isCjkCodePoint(0x4DFF)).toBe(false)
    })
    test('高于上界 0xA000 When check Then 不是', () => {
      expect(isCjkCodePoint(0xA000)).toBe(false)
    })
  })

  describe('CJK Symbols and Punctuation (U+3000-303F)', () => {
    test('、 (U+3001) When check Then 是 CJK', () => {
      expect(isCjkCodePoint(0x3001)).toBe(true)
    })
    test('全角空格 U+3000 When check Then 是 CJK', () => {
      expect(isCjkCodePoint(0x3000)).toBe(true)
    })
    test('下界外 U+2FFF When check Then 不是', () => {
      expect(isCjkCodePoint(0x2FFF)).toBe(false)
    })
  })

  describe('Fullwidth Forms (U+FF00-FFEF)', () => {
    test('全角 A (U+FF21) When check Then 是 CJK', () => {
      expect(isCjkCodePoint(0xFF21)).toBe(true)
    })
    test('全角数字 １ (U+FF11) When check Then 是 CJK', () => {
      expect(isCjkCodePoint(0xFF11)).toBe(true)
    })
    test('上界外 U+FFF0 When check Then 不是', () => {
      expect(isCjkCodePoint(0xFFF0)).toBe(false)
    })
  })

  describe('Hangul Syllables (U+AC00-D7AF)', () => {
    test('한 (U+D55C) When check Then 是 CJK', () => {
      expect(isCjkCodePoint(0xD55C)).toBe(true)
    })
    test('가 (U+AC00) When check Then 是 CJK', () => {
      expect(isCjkCodePoint(0xAC00)).toBe(true)
    })
    test('下界外 U+ABFF When check Then 不是', () => {
      expect(isCjkCodePoint(0xABFF)).toBe(false)
    })
  })

  describe('Hiragana + Katakana (U+3040-30FF)', () => {
    test('あ (U+3042) When check Then 是 CJK', () => {
      expect(isCjkCodePoint(0x3042)).toBe(true)
    })
    test('ア (U+30A2) When check Then 是 CJK', () => {
      expect(isCjkCodePoint(0x30A2)).toBe(true)
    })
    test('下界外 U+2FFF When check Then 不是 (2FFF 不在 3040-30FF 也不在 3000-303F 之外)', () => {
      expect(isCjkCodePoint(0x2FFF)).toBe(false)
    })

    test('上界外 U+3100 When check Then 不是', () => {
      expect(isCjkCodePoint(0x3100)).toBe(false)
    })
  })

  describe('CJK Extension A (U+3400-4DBF)', () => {
    test('扩展 A 字符 (U+3400) When check Then 是 CJK', () => {
      expect(isCjkCodePoint(0x3400)).toBe(true)
    })
    test('扩展 A 字符 (U+4DB5) When check Then 是 CJK', () => {
      expect(isCjkCodePoint(0x4DB5)).toBe(true)
    })
    test('下界外 U+33FF When check Then 不是', () => {
      expect(isCjkCodePoint(0x33FF)).toBe(false)
    })
  })

  describe('CJK Extension B (U+20000-2A6DF) - supplementary plane', () => {
    test('扩展 B 字符 (U+20000) When check Then 是 CJK', () => {
      expect(isCjkCodePoint(0x20000)).toBe(true)
    })
    test('扩展 B 字符 (U+2A6D6) When check Then 是 CJK', () => {
      expect(isCjkCodePoint(0x2A6D6)).toBe(true)
    })
    test('下界外 U+1FFFF When check Then 不是', () => {
      expect(isCjkCodePoint(0x1FFFF)).toBe(false)
    })
  })

  describe('non-CJK 字符 (回归测试)', () => {
    test('ASCII 字母 A (U+0041) When check Then 不是', () => {
      expect(isCjkCodePoint(0x0041)).toBe(false)
    })
    test('Latin-1 é (U+00E9) When check Then 不是', () => {
      expect(isCjkCodePoint(0x00E9)).toBe(false)
    })
    test('希腊字母 α (U+03B1) When check Then 不是', () => {
      expect(isCjkCodePoint(0x03B1)).toBe(false)
    })
    test('emoji 😀 (U+1F600) When check Then 不是 (不是 CJK 范围)', () => {
      expect(isCjkCodePoint(0x1F600)).toBe(false)
    })
    test('NULL (U+0000) When check Then 不是', () => {
      expect(isCjkCodePoint(0x0000)).toBe(false)
    })
  })
})

// ============================================
// estimateTokenCount
// ============================================

describe('estimateTokenCount', () => {
  describe('纯文本', () => {
    test('Given 空字符串 When estimate Then 返回 0', () => {
      expect(estimateTokenCount('')).toBe(0)
    })

    test('Given 4 个 ASCII 字符 When estimate Then 返回 ceil(4 * 0.25) = 1', () => {
      expect(estimateTokenCount('abcd')).toBe(1)
    })

    test('Given 100 个 ASCII 字符 When estimate Then 返回 ceil(100 * 0.25) = 25', () => {
      expect(estimateTokenCount('a'.repeat(100))).toBe(25)
    })

    test('Given 1000 个 ASCII 字符 When estimate Then 返回 ceil(1000 * 0.25) = 250', () => {
      expect(estimateTokenCount('a'.repeat(1000))).toBe(250)
    })
  })

  describe('CJK 文本', () => {
    test('Given 1 个汉字 When estimate Then 返回 ceil(1 * 1.5) = 2', () => {
      expect(estimateTokenCount('中')).toBe(2)
    })

    test('Given 100 个汉字 When estimate Then 返回 ceil(100 * 1.5) = 150', () => {
      expect(estimateTokenCount('中'.repeat(100))).toBe(150)
    })

    test('Given 日文ひらがな When estimate Then 返回 ceil(1 * 1.5) = 2', () => {
      expect(estimateTokenCount('あ')).toBe(2)
    })

    test('Given 韩文 When estimate Then 返回 ceil(1 * 1.5) = 2', () => {
      expect(estimateTokenCount('한')).toBe(2)
    })
  })

  describe('混合文本', () => {
    test('Given "hello 中文" (5 ASCII + 2 CJK + 1 空格) When estimate Then 5*0.25+2*1.5+1*0.25 = ceil(4.5) = 5', () => {
      // h,e,l,l,o = 5 ASCII; 空格 = 1 ASCII; 中,文 = 2 CJK
      // 5*0.25 + 1*0.25 + 2*1.5 = 1.25 + 0.25 + 3 = 4.5 → ceil = 5
      expect(estimateTokenCount('hello 中文')).toBe(5)
    })

    test('Given 50% CJK + 50% ASCII When estimate Then 累加正确', () => {
      const cjk = '中'.repeat(50)
      const ascii = 'a'.repeat(50)
      const combined = cjk + ascii
      // 50*1.5 + 50*0.25 = 75 + 12.5 = 87.5 → ceil = 88
      expect(estimateTokenCount(combined)).toBe(88)
    })
  })

  describe('其他字符 (非 CJK 非 ASCII)', () => {
    test('Given 希腊字母 (非 ASCII < 128 范围) When estimate Then 按 0.75/char 算', () => {
      // α = 0x03B1, 希腊字母, 非 CJK 非 ASCII
      // 1 char * 0.75 = 0.75 → ceil = 1
      expect(estimateTokenCount('α')).toBe(1)
    })

    test('Given emoji When estimate Then 按 0.75/char 算', () => {
      // 😀 = U+1F600, 在 supplementary plane, 非 CJK 范围
      // 但 JS 字符串用 for...of 迭代会处理 surrogate pair
      // 1 char * 0.75 = 0.75 → ceil = 1
      expect(estimateTokenCount('😀')).toBe(1)
    })

    test('Given 全角空格 (U+3000) When estimate Then 按 1.5/char 算 (CJK 范围)', () => {
      expect(estimateTokenCount('　')).toBe(2)  // ceil(1 * 1.5)
    })
  })

  describe('与阈值对比', () => {
    test('Given 16_000 tokens 阈值 When 比较纯 ASCII 100K 字符 Then 远超阈值', () => {
      // 100_000 ASCII * 0.25 = 25_000 tokens
      expect(estimateTokenCount('a'.repeat(100_000))).toBeGreaterThan(WRITE_CONTENT_TOKEN_THRESHOLD)
    })

    test('Given 16_000 tokens 阈值 When 比较 64K ASCII 字符 Then 不超阈值', () => {
      // 64_000 ASCII * 0.25 = 16_000 tokens (刚好等于)
      expect(estimateTokenCount('a'.repeat(64_000))).toBe(16_000)
    })

    test('Given 阈值常量 When 读 Then 是 16_000', () => {
      expect(WRITE_CONTENT_TOKEN_THRESHOLD).toBe(16_000)
    })
  })

  describe('代码点遍历 (补充字符 surrogate pair)', () => {
    test('Given 扩展 B 字符 (supplementary plane) When iterate 用 for...of Then 正确按 1 char 算', () => {
      // U+20000 是 4 字节 UTF-8，但 JS string 用 for...of 按 code point 迭代为 1 char
      const extB = String.fromCodePoint(0x20000)
      expect(extB.length).toBe(2)  // UTF-16 长度 = 2
      // for...of 迭代 1 次 (1 code point)
      // 1 CJK * 1.5 = 1.5 → ceil = 2
      expect(estimateTokenCount(extB)).toBe(2)
    })
  })
})
