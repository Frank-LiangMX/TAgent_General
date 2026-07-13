import { describe, expect, test } from 'bun:test'

import { resolveInstalledGridView } from './installed-plugin-nav'
import type { InstalledPluginsGrouping } from './installed-plugins-grouping'

const mockGrouping: InstalledPluginsGrouping = {
  bundleGroups: [
    {
      bundleId: 'superpowers-full',
      name: 'Superpowers 完整开发方法论',
      logo: 'superpowers-full',
      installedCount: 1,
      totalCount: 2,
      items: [
        {
          id: 'brainstorming',
          kind: 'skill',
          title: 'brainstorming',
          enabled: true,
        },
      ],
    },
  ],
  orphanItems: [
    {
      id: 'brandkit',
      kind: 'skill',
      title: 'brandkit',
      enabled: true,
    },
    {
      id: 'ta-agent-mcp',
      kind: 'mcp',
      title: 'ta-agent-mcp',
      enabled: true,
    },
  ],
}

describe('resolveInstalledGridView', () => {
  test('概览显示整合包卡片与单独安装项', () => {
    const view = resolveInstalledGridView('overview', mockGrouping)
    expect(view.bundles).toHaveLength(1)
    expect(view.items.map((item) => item.id).sort()).toEqual(['brandkit', 'ta-agent-mcp'])
  })

  test('整合包筛选只显示该包成员', () => {
    const view = resolveInstalledGridView('bundle:superpowers-full', mockGrouping)
    expect(view.bundles).toHaveLength(0)
    expect(view.items.map((item) => item.id)).toEqual(['brainstorming'])
  })

  test('MCP 筛选跨整合包与单独安装', () => {
    const view = resolveInstalledGridView('mcp', mockGrouping)
    expect(view.items.map((item) => item.id)).toEqual(['ta-agent-mcp'])
  })
})
