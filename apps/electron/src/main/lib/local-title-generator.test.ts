import { describe, expect, test } from 'vitest'

import { generateLocalTitle } from './local-title-generator'

describe('generateLocalTitle', () => {
  test('returns null for empty string', () => {
    expect(generateLocalTitle('')).toBeNull()
  })

  test('returns null for whitespace-only string', () => {
    expect(generateLocalTitle('   \n\t  \n  ')).toBeNull()
  })

  test('returns null for multiple blank lines', () => {
    expect(generateLocalTitle('\n\n\n')).toBeNull()
  })

  test('extracts first non-empty line from multiline text', () => {
    expect(generateLocalTitle('\n\nHello World\nSecond line')).toBe('Hello World')
  })

  test('normalizes consecutive whitespace within a line', () => {
    expect(generateLocalTitle('Hello   World   Test')).toBe('Hello World Test')
  })

  test('normalizes tabs and mixed whitespace', () => {
    expect(generateLocalTitle('Hello\t\tWorld  Test')).toBe('Hello World Test')
  })

  test('keeps full long title (no char-count truncation)', () => {
    const longText =
      '分析[http://10.11.177.100:8080/path/to/resource] 的性能问题以及后续优化建议'
    expect(generateLocalTitle(longText)).toBe(longText)
    // 禁止旧 slice(0,20) 硬截
    expect(generateLocalTitle(longText)).not.toBe(longText.slice(0, 20))
  })

  test('preserves Chinese characters', () => {
    expect(generateLocalTitle('你好世界')).toBe('你好世界')
  })

  test('keeps long Chinese full title', () => {
    const longChinese = '这是一段很长的中文标题用来测试落盘是否保留完整内容并且不按字数截断'
    expect(generateLocalTitle(longChinese)).toBe(longChinese)
  })

  test('handles mixed Chinese and English', () => {
    expect(generateLocalTitle('你好 Hello 世界')).toBe('你好 Hello 世界')
  })

  test('handles single character', () => {
    expect(generateLocalTitle('A')).toBe('A')
  })

  test('trims leading and trailing whitespace from first line', () => {
    expect(generateLocalTitle('   Hello World   ')).toBe('Hello World')
  })

  test('skips leading blank lines and uses first non-empty', () => {
    expect(generateLocalTitle('  \n  \n  Actual Title  \n  ')).toBe('Actual Title')
  })

  test('returns null for non-string input', () => {
    expect(generateLocalTitle(null as unknown as string)).toBeNull()
    expect(generateLocalTitle(undefined as unknown as string)).toBeNull()
  })

  test('does not append ellipsis for long strings', () => {
    const long = 'a'.repeat(200)
    const result = generateLocalTitle(long)
    expect(result).toBe(long)
    expect(result!.endsWith('\u2026')).toBe(false)
    expect(result!.endsWith('...')).toBe(false)
  })
})
