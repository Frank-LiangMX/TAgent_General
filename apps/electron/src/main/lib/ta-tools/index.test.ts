/**
 * TA 内置工具单元测试
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

import { executeCheckNaming } from './check-naming-tool'
import { executeSuggestNaming } from './suggest-naming-tool'
import { executeCheckDirectoryStructure } from './check-directory-structure-tool'
import { executeDiscoverConventions } from './discover-conventions-tool'
import { executeLoadConventions } from './load-conventions-tool'
import { isTAToolCall } from './index'

import type { ToolCall } from '@tagent/core'

// ===== check_naming 测试 =====

describe('check_naming', () => {
  test('检查合规命名', async () => {
    const toolCall: ToolCall = {
      id: 'test-1',
      name: 'check_naming',
      arguments: { name: 'SM_Character_Hero' },
    }
    const result = await executeCheckNaming(toolCall)
    expect(result.isError).toBeUndefined()
    expect(result.content).toContain('通过')
  })

  test('检测命名类型', async () => {
    const toolCall: ToolCall = {
      id: 'test-2',
      name: 'check_naming',
      arguments: { name: 'T_Wood_BaseColor' },
    }
    const result = await executeCheckNaming(toolCall)
    expect(result.content).toContain('检测类型')
    expect(result.content).toContain('texture')
  })

  test('检测空格错误', async () => {
    const toolCall: ToolCall = {
      id: 'test-3',
      name: 'check_naming',
      arguments: { name: 'SM Character Hero' },
    }
    const result = await executeCheckNaming(toolCall)
    expect(result.content).toContain('禁用字符')
  })

  test('检测小写开头错误', async () => {
    const toolCall: ToolCall = {
      id: 'test-4',
      name: 'check_naming',
      arguments: { name: 'characterHero' },
    }
    const result = await executeCheckNaming(toolCall)
    expect(result.content).toContain('大写字母开头')
  })

  test('指定资产类型检查前缀', async () => {
    const toolCall: ToolCall = {
      id: 'test-5',
      name: 'check_naming',
      arguments: { name: 'Character_Hero', assetType: 'mesh' },
    }
    const result = await executeCheckNaming(toolCall)
    expect(result.content).toContain('前缀')
  })
})

// ===== suggest_naming 测试 =====

describe('suggest_naming', () => {
  test('生成 mesh 命名建议', async () => {
    const toolCall: ToolCall = {
      id: 'test-6',
      name: 'suggest_naming',
      arguments: { baseName: 'CharacterHero', assetType: 'mesh' },
    }
    const result = await executeSuggestNaming(toolCall)
    expect(result.isError).toBeUndefined()
    expect(result.content).toContain('SM_CharacterHero')
  })

  test('生成 texture 命名建议', async () => {
    const toolCall: ToolCall = {
      id: 'test-7',
      name: 'suggest_naming',
      arguments: { baseName: 'Wood', assetType: 'texture' },
    }
    const result = await executeSuggestNaming(toolCall)
    expect(result.content).toContain('T_')
  })

  test('生成带变体的命名建议', async () => {
    const toolCall: ToolCall = {
      id: 'test-8',
      name: 'suggest_naming',
      arguments: { baseName: 'Hero', assetType: 'mesh', variant: 'LOD0' },
    }
    const result = await executeSuggestNaming(toolCall)
    expect(result.content).toContain('_LOD0')
  })

  test('处理带空格的 baseName', async () => {
    const toolCall: ToolCall = {
      id: 'test-9',
      name: 'suggest_naming',
      arguments: { baseName: 'character hero', assetType: 'mesh' },
    }
    const result = await executeSuggestNaming(toolCall)
    // 空格被移除，变成 "characterhero"
    expect(result.content).toContain('SM_Characterhero')
  })
})

// ===== check_directory_structure 测试 =====

describe('check_directory_structure', () => {
  const tmpDir = path.join(os.tmpdir(), 'ta-test-' + Date.now())

  beforeAll(() => {
    // 创建临时测试目录结构
    fs.mkdirSync(tmpDir, { recursive: true })
    fs.mkdirSync(path.join(tmpDir, 'models'), { recursive: true })
    fs.mkdirSync(path.join(tmpDir, 'textures'), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Test Project')
  })

  afterAll(() => {
    // 清理临时目录
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('检查存在的目录', async () => {
    const toolCall: ToolCall = {
      id: 'test-10',
      name: 'check_directory_structure',
      arguments: { directory: tmpDir },
    }
    const result = await executeCheckDirectoryStructure(toolCall, tmpDir)
    expect(result.isError).toBeUndefined()
    expect(result.content).toContain('发现目录')
  })

  test('检测缺失的标准目录', async () => {
    const toolCall: ToolCall = {
      id: 'test-11',
      name: 'check_directory_structure',
      arguments: { directory: tmpDir, projectType: 'ue5' },
    }
    const result = await executeCheckDirectoryStructure(toolCall, tmpDir)
    expect(result.content).toContain('缺失') // Content 目录缺失
  })

  test('处理不存在的目录', async () => {
    const toolCall: ToolCall = {
      id: 'test-12',
      name: 'check_directory_structure',
      arguments: { directory: '/nonexistent/path' },
    }
    const result = await executeCheckDirectoryStructure(toolCall, tmpDir)
    expect(result.content).toContain('不存在')
  })
})

// ===== discover_conventions 测试 =====

describe('discover_conventions', () => {
  const tmpDir = path.join(os.tmpdir(), 'ta-conv-test-' + Date.now())

  beforeAll(() => {
    fs.mkdirSync(tmpDir, { recursive: true })
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Test')
    fs.writeFileSync(path.join(tmpDir, '.editorconfig'), 'root = true')
    fs.writeFileSync(
      path.join(tmpDir, 'ta-config.json'),
      JSON.stringify({ naming: { prefixes: { mesh: ['SM_'] } } })
    )
  })

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('发现配置文件', async () => {
    const toolCall: ToolCall = {
      id: 'test-13',
      name: 'discover_conventions',
      arguments: { directory: tmpDir },
    }
    const result = await executeDiscoverConventions(toolCall, tmpDir)
    expect(result.isError).toBeUndefined()
    expect(result.content).toContain('README.md')
    expect(result.content).toContain('.editorconfig')
    expect(result.content).toContain('ta-config.json')
  })

  test('检测缺失的配置', async () => {
    const toolCall: ToolCall = {
      id: 'test-14',
      name: 'discover_conventions',
      arguments: { directory: tmpDir },
    }
    const result = await executeDiscoverConventions(toolCall, tmpDir)
    expect(result.content).toContain('naming-convention.json') // 缺失
  })
})

// ===== load_conventions 测试 =====

describe('load_conventions', () => {
  const tmpDir = path.join(os.tmpdir(), 'ta-load-test-' + Date.now())
  const configPath = path.join(tmpDir, 'ta-config.json')

  beforeAll(() => {
    fs.mkdirSync(tmpDir, { recursive: true })
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        naming: {
          prefixes: { mesh: ['SM_', 'BP_'], texture: ['T_'] },
          caseStyle: 'pascal',
        },
        structure: {
          requiredDirs: ['models', 'textures'],
        },
        metadata: {
          projectType: 'ue5',
          engine: 'unreal',
        },
      })
    )
  })

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('加载有效配置', async () => {
    const toolCall: ToolCall = {
      id: 'test-15',
      name: 'load_conventions',
      arguments: { configPath },
    }
    const result = await executeLoadConventions(toolCall, tmpDir)
    expect(result.isError).toBeUndefined()
    expect(result.content).toContain('加载成功')
    expect(result.content).toContain('SM_')
  })

  test('摘要格式输出', async () => {
    const toolCall: ToolCall = {
      id: 'test-16',
      name: 'load_conventions',
      arguments: { configPath, format: 'summary' },
    }
    const result = await executeLoadConventions(toolCall, tmpDir)
    expect(result.content).toContain('摘要')
    expect(result.content).toContain('ue5')
  })

  test('仅规则输出', async () => {
    const toolCall: ToolCall = {
      id: 'test-17',
      name: 'load_conventions',
      arguments: { configPath, format: 'rules-only' },
    }
    const result = await executeLoadConventions(toolCall, tmpDir)
    expect(result.content).toContain('命名规则')
    expect(result.content).toContain('目录规则')
  })

  test('加载不存在的配置', async () => {
    const toolCall: ToolCall = {
      id: 'test-18',
      name: 'load_conventions',
      arguments: { configPath: '/nonexistent/config.json' },
    }
    const result = await executeLoadConventions(toolCall, tmpDir)
    expect(result.content).toContain('失败')
  })

  test('加载无效 JSON', async () => {
    const invalidPath = path.join(tmpDir, 'invalid.json')
    fs.writeFileSync(invalidPath, 'not valid json')
    const toolCall: ToolCall = {
      id: 'test-19',
      name: 'load_conventions',
      arguments: { configPath: invalidPath },
    }
    const result = await executeLoadConventions(toolCall, tmpDir)
    expect(result.content).toContain('失败')
  })
})

// ===== 工具路由测试 =====

describe('TA 工具路由', () => {
  test('isTAToolCall 正确识别', () => {
    expect(isTAToolCall('check_naming')).toBe(true)
    expect(isTAToolCall('suggest_naming')).toBe(true)
    expect(isTAToolCall('check_directory_structure')).toBe(true)
    expect(isTAToolCall('discover_conventions')).toBe(true)
    expect(isTAToolCall('load_conventions')).toBe(true)
  })

  test('isTAToolCall 拒绝非 TA 工具', () => {
    expect(isTAToolCall('recall_memory')).toBe(false)
    expect(isTAToolCall('web_search')).toBe(false)
    expect(isTAToolCall('unknown_tool')).toBe(false)
  })
})
