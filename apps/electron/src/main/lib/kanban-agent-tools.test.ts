import { describe, expect, test } from 'bun:test'
import { injectProjectRootHeader } from './kanban-agent-tools'

describe('injectProjectRootHeader', () => {
  test('空 body 注入完整 header', () => {
    const result = injectProjectRootHeader('', 'F:/TAgent_General')
    expect(result).toBe('---\n项目根目录: F:/TAgent_General\n数据目录: ~/.tagent/\n---\n\n')
  })

  test('已有 body 前插 header，原 body 完整保留', () => {
    const result = injectProjectRootHeader('读 apps/electron/package.json', 'F:/TAgent_General')
    expect(result).toBe(
      '---\n项目根目录: F:/TAgent_General\n数据目录: ~/.tagent/\n---\n\n读 apps/electron/package.json'
    )
  })

  test('多行 body 前插 header，原 body 逐行保留', () => {
    const body = '第一行\n第二行\n第三行'
    const result = injectProjectRootHeader(body, '/Users/frank/proj')
    expect(result).toBe(
      '---\n项目根目录: /Users/frank/proj\n数据目录: ~/.tagent/\n---\n\n第一行\n第二行\n第三行'
    )
  })

  test('幂等：body 已含 "项目根目录:" 头部时不重复注入', () => {
    const body = '---\n项目根目录: /custom/path\n数据目录: ~/.tagent/\n---\n\n原内容'
    const result = injectProjectRootHeader(body, 'F:/TAgent_General')
    expect(result).toBe(body)
  })

  test('路径含空格 / 反斜杠正常处理', () => {
    const result = injectProjectRootHeader('body', 'C:\\Users\\frank\\my project')
    expect(result).toContain('项目根目录: C:\\Users\\frank\\my project')
    expect(result).toContain('body')
  })

  test('路径含中文正常处理', () => {
    const result = injectProjectRootHeader('body', 'F:/我的项目')
    expect(result).toContain('项目根目录: F:/我的项目')
  })
})
