import { describe, expect, test } from 'bun:test'

import type { PluginStoreCatalog, WorkspaceCapabilities } from '@tagent/shared'

import { groupInstalledPlugins } from './installed-plugins-grouping'

const mockCatalog: PluginStoreCatalog = {
  bundles: [
    {
      id: 'planning-suite',
      name: '需求与计划',
      description: '',
      category: 'planning',
      tier: 'recommended',
      mcps: [],
      skills: ['brainstorming', 'writing-plans'],
      logo: 'planning-suite',
      publisher: 'TAgent',
      repositoryUrl: 'https://example.com',
    },
    {
      id: 'ta-agent-suite',
      name: 'TA Agent 套件',
      description: '',
      category: 'ta',
      tier: 'recommended',
      mcps: ['ta-agent-mcp'],
      skills: [],
      logo: 'ta-agent-suite',
      publisher: 'TAgent',
      repositoryUrl: 'https://example.com',
    },
  ],
  skills: [],
  mcps: [],
}

function makeCapabilities(partial: Partial<WorkspaceCapabilities>): WorkspaceCapabilities {
  return {
    mcpServers: [],
    skills: [],
    installedBundles: [],
    ...partial,
  } as WorkspaceCapabilities
}

describe('groupInstalledPlugins', () => {
  test('无 manifest 时按整合包定义推断分组', () => {
    const capabilities = makeCapabilities({
      mcpServers: [
        {
          name: 'ta-agent-mcp',
          type: 'stdio',
          enabled: true,
          command: 'python',
          args: [],
        },
      ],
      skills: [
        {
          slug: 'brainstorming',
          name: 'brainstorming',
          description: '',
          enabled: true,
          path: 'skills/brainstorming',
        },
        {
          slug: 'brandkit',
          name: 'brandkit',
          description: '',
          enabled: true,
          path: 'skills/brandkit',
        },
      ],
      installedBundles: [],
    })

    const { bundleGroups, orphanItems } = groupInstalledPlugins(capabilities, mockCatalog)

    expect(bundleGroups.map((group) => group.bundleId).sort()).toEqual([
      'planning-suite',
      'ta-agent-suite',
    ])
    expect(bundleGroups.find((group) => group.bundleId === 'planning-suite')?.items.map((i) => i.id)).toEqual([
      'brainstorming',
    ])
    expect(orphanItems.map((item) => item.id)).toEqual(['brandkit'])
  })

  test('manifest 记录优先，成员不重复出现在单独安装', () => {
    const capabilities = makeCapabilities({
      skills: [
        {
          slug: 'brainstorming',
          name: 'brainstorming',
          description: '',
          enabled: true,
          path: 'skills/brainstorming',
        },
      ],
      installedBundles: [
        {
          bundleId: 'planning-suite',
          source: 'store',
          installedAt: '2026-01-01T00:00:00.000Z',
          mcps: [],
          skills: ['brainstorming', 'writing-plans'],
        },
      ],
    })

    const { bundleGroups, orphanItems } = groupInstalledPlugins(capabilities, mockCatalog)

    expect(bundleGroups).toHaveLength(1)
    expect(bundleGroups[0]?.items.map((item) => item.id)).toEqual(['brainstorming'])
    expect(orphanItems).toHaveLength(0)
  })
})
