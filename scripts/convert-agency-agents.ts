/**
 * agency-agents-zh .md → TAgent RoleStoreCatalog JSON 转换脚本
 *
 * 用法：bun run scripts/convert-agency-agents.ts
 * 前置：git clone --depth 1 https://github.com/jnMetaCode/agency-agents-zh.git /tmp/agency-agents-zh
 */

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, basename } from 'node:path'

interface Frontmatter {
  name: string
  description: string
  emoji?: string
  color?: string
}

interface RoleStoreCatalogEntry {
  id: string
  displayName: string
  description: string
  category: string
  tier: string
  version: string
  source: string
  sourceUrl?: string
  role: {
    id: string
    displayName: string
    description: string
    systemPrompt: string
    permissionMode: string
    modelPool: string[]
    maxConcurrentPerModel: number
    fallbackToChannelDefault: boolean
  }
}

/** 目录名 → 角色商店分类映射 */
const CATEGORY_MAP: Record<string, string> = {
  engineering: 'coding',
  design: 'design',
  marketing: 'marketing',
  'paid-media': 'marketing',
  product: 'management',
  'project-management': 'management',
  strategy: 'management',
  testing: 'review',
  security: 'security',
  finance: 'data',
  'game-development': 'coding',
  'spatial-computing': 'coding',
  gis: 'data',
  specialized: 'general',
  integrations: 'coding',
  academic: 'education',
  hr: 'general',
  sales: 'general',
  legal: 'general',
  'supply-chain': 'general',
  support: 'general',
  examples: 'general',
}

/** 解析 YAML frontmatter */
function parseFrontmatter(content: string): { meta: Frontmatter; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) {
    return { meta: { name: '', description: '' }, body: content }
  }

  const yamlStr = match[1]
  const body = match[2]
  const meta: Frontmatter = { name: '', description: '' }

  for (const line of yamlStr.split('\n')) {
    const kv = line.match(/^(\w+):\s*(.+)$/)
    if (kv) {
      const [, key, value] = kv
      if (key === 'name') meta.name = value.trim()
      else if (key === 'description') meta.description = value.trim()
      else if (key === 'emoji') meta.emoji = value.trim()
      else if (key === 'color') meta.color = value.trim()
    }
  }

  return { meta, body: body.trim() }
}

/** 生成稳定的 kebab-case id */
function toId(dirName: string, fileName: string): string {
  // 文件名格式：engineering-frontend-developer.md
  // 去掉 .md 后缀，保留 kebab-case
  return basename(fileName, '.md')
}

/** 推断 tier：工程/设计/测试/安全 → recommended，其他 → optional */
function inferTier(category: string): string {
  return ['coding', 'design', 'review', 'security'].includes(category) ? 'recommended' : 'optional'
}

async function main() {
  const repoPath = '/tmp/agency-agents-zh'
  const entries: RoleStoreCatalogEntry[] = []

  const dirs = await readdir(repoPath, { withFileTypes: true })

  for (const dir of dirs) {
    if (!dir.isDirectory()) continue
    const dirName = dir.name
    const category = CATEGORY_MAP[dirName] || 'general'

    const dirPath = join(repoPath, dirName)
    const files = await readdir(dirPath)
    const mdFiles = files.filter((f) => f.endsWith('.md'))

    for (const file of mdFiles) {
      const filePath = join(dirPath, file)
      const content = await readFile(filePath, 'utf-8')
      const { meta, body } = parseFrontmatter(content)

      if (!meta.name || !body) {
        console.warn(`跳过：${filePath}（缺少 name 或 body）`)
        continue
      }

      const id = toId(dirName, file)

      entries.push({
        id,
        displayName: meta.name,
        description: meta.description || `${meta.name}专业角色`,
        category,
        tier: inferTier(category),
        version: '1.0.0',
        source: 'agency-agents-zh',
        sourceUrl: `https://github.com/jnMetaCode/agency-agents-zh/blob/main/${dirName}/${file}`,
        role: {
          id,
          displayName: meta.name,
          description: meta.description || `${meta.name}专业角色`,
          systemPrompt: body,
          permissionMode: 'bypassPermissions',
          modelPool: [],
          maxConcurrentPerModel: 2,
          fallbackToChannelDefault: true,
        },
      })
    }
  }

  // 按 category + displayName 排序
  entries.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category)
    return a.displayName.localeCompare(b.displayName)
  })

  const catalog = {
    version: 1,
    updatedAt: new Date().toISOString(),
    entries,
  }

  const outPath = join(__dirname, '..', 'packages', 'shared', 'src', 'role-store-catalog.json')
  await writeFile(outPath, JSON.stringify(catalog, null, 2), 'utf-8')

  console.log(`✅ 生成完成：${entries.length} 个角色 → ${outPath}`)

  // 统计分类分布
  const counts: Record<string, number> = {}
  for (const e of entries) {
    counts[e.category] = (counts[e.category] || 0) + 1
  }
  console.log('\n分类分布：')
  for (const [cat, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`)
  }
}

main().catch(console.error)
