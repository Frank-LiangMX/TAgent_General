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

  test('truncates to 20 characters', () => {
    const longText = 'This is a very long title that exceeds the maximum length'
    const result = generateLocalTitle(longText)
    expect(result).toBe('This is a very long ')
    expect(result!.length).toBe(20)
  })

  test('preserves Chinese characters', () => {
    expect(generateLocalTitle('你好世界')).toBe('你好世界')
  })

  test('truncates Chinese text to 20 characters', () => {
    const longChinese = '这是一段很长的中文标题用来测试截断功能是否正常工作'
    const result = generateLocalTitle(longChinese)
    expect(result).toBe('这是一段很长的中文标题用来测试截断功能是')
    expect(result!.length).toBe(20)
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

  test('exactly 20 characters is not truncated', () => {
    const exact20 = '12345678901234567890'
    expect(generateLocalTitle(exact20)).toBe('12345678901234567890')
    expect(generateLocalTitle(exact20)!.length).toBe(20)
  })

  test('21 characters is truncated to 20', () => {
    const exact21 = '123456789012345678901'
    expect(generateLocalTitle(exact21)).toBe('12345678901234567890')
    expect(generateLocalTitle(exact21)!.length).toBe(20)
  })
})
