import { describe, expect, test } from 'bun:test'

import {
  buildMarketplaceItems,
  excludeBundleMembersFromMarketplace,
} from './plugin-marketplace-shared'

import type { PluginStoreCatalog } from '@tagent/shared'

const mockCatalog: PluginStoreCatalog = {
  bundles: [
    {
      id: 'dev-suite',
      name: 'Dev Suite',
      description: 'dev',
      publisher: 'TAgent',
      category: 'dev',
      tier: 'recommended',
      logo: 'github-dev-collab',
      skills: ['skill-a'],
      mcps: ['mcp-a'],
      repositoryUrl: 'https://example.com',
    },
  ],
  skills: [
    {
      slug: 'skill-a',
      name: 'Skill A',
      description: 'in bundle',
      version: '1.0.0',
      category: 'dev',
      tier: 'recommended',
      installKind: 'inline',
    },
    {
      slug: 'skill-b',
      name: 'Skill B',
      description: 'standalone',
      version: '1.0.0',
      category: 'dev',
      tier: 'optional',
      installKind: 'inline',
    },
  ],
  mcps: [
    {
      name: 'mcp-a',
      displayName: 'MCP A',
      description: 'in bundle',
      category: 'dev',
      tier: 'recommended',
      installCommand: 'echo',
      installArgs: [],
    },
    {
      name: 'mcp-b',
      displayName: 'MCP B',
      description: 'standalone',
      category: 'dev',
      tier: 'optional',
      installCommand: 'echo',
      installArgs: [],
    },
  ],
}

describe('excludeBundleMembersFromMarketplace', () => {
  test('buildMarketplaceItems 不包含整合包内 Skill / MCP', () => {
    const items = buildMarketplaceItems(mockCatalog)
    expect(items.map((item) => item.id).sort()).toEqual(['mcp-b', 'skill-b'])
  })

  test('excludeBundleMembersFromMarketplace 保留未收录条目', () => {
    const all = [
      {
        id: 'skill-a',
        kind: 'skill' as const,
        title: '',
        description: '',
        category: 'dev' as const,
        tier: 'recommended',
      },
      {
        id: 'skill-b',
        kind: 'skill' as const,
        title: '',
        description: '',
        category: 'dev' as const,
        tier: 'optional',
      },
    ]
    const filtered = excludeBundleMembersFromMarketplace(all, mockCatalog)
    expect(filtered.map((item) => item.id)).toEqual(['skill-b'])
  })
})
