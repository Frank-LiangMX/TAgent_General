/**
 * 插件商店目录与预装 Skill 白名单
 *
 * - PREINSTALLED_SKILL_SLUGS：新建工作区时自动安装的 Skill（默认空，全部走商店）
 * - BUILTIN_MCP_CATALOG：内置 MCP 连接插件目录
 */

export const PREINSTALLED_SKILL_SLUGS: readonly string[] = []

export interface BuiltinMcpEnvHint {
  key: string
  description: string
  required: boolean
}

export interface BuiltinMcpCatalogEntry {
  name: string
  displayName: string
  description: string
  category: 'general' | 'ta'
  installCommand: string
  installArgs: string[]
  envHints?: BuiltinMcpEnvHint[]
  docsUrl?: string
}

/** 内置 MCP 连接插件（插件商店 MCP 分区） */
export const BUILTIN_MCP_CATALOG: BuiltinMcpCatalogEntry[] = [
  {
    name: 'context7',
    displayName: 'Context7 文档查询',
    description: '实时查询库/框架文档，支持 500+ 库',
    category: 'general',
    installCommand: 'npx',
    installArgs: ['-y', '@upstash/context7-mcp'],
    docsUrl: 'https://github.com/upstash/context7-mcp',
  },
  {
    name: 'github',
    displayName: 'GitHub API',
    description: '操作 GitHub PR、Issue、代码搜索',
    category: 'general',
    installCommand: 'npx',
    installArgs: ['-y', '@modelcontextprotocol/server-github'],
    envHints: [
      { key: 'GITHUB_TOKEN', description: 'GitHub PAT (classic or fine-grained)', required: true },
    ],
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/github',
  },
  {
    name: 'sequential-thinking',
    displayName: 'Sequential Thinking',
    description: '多步骤复杂推理，适合复杂问题分解',
    category: 'general',
    installCommand: 'npx',
    installArgs: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking',
  },
  {
    name: 'puppeteer',
    displayName: 'Puppeteer 浏览器',
    description: '浏览器自动化，网页抓取和交互',
    category: 'general',
    installCommand: 'npx',
    installArgs: ['-y', '@modelcontextprotocol/server-puppeteer'],
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer',
  },
  {
    name: 'filesystem',
    displayName: 'Filesystem 文件系统',
    description: '安全文件操作，限定允许访问目录',
    category: 'general',
    installCommand: 'npx',
    installArgs: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/allowed/dir'],
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem',
  },
  {
    name: 'ta-agent-mcp',
    displayName: 'TA Agent MCP',
    description: 'Technical Artist 工具链：资产检查、命名规范、FBX 分析等',
    category: 'ta',
    installCommand: 'python',
    installArgs: ['-m', 'ta_agent_mcp'],
    envHints: [
      { key: 'TA_AGENT_DATA_DIR', description: 'TA 数据目录，默认 ~/.tagent/ta/', required: false },
    ],
    docsUrl:
      'https://github.com/Frank-LiangMX/TAgent_General/tree/main/apps/electron/default-mcp/ta-agent-mcp',
  },
]

export interface PluginStoreSkillEntry {
  slug: string
  name: string
  description: string
  version: string
}

export interface PluginStoreCatalog {
  skills: PluginStoreSkillEntry[]
  mcps: BuiltinMcpCatalogEntry[]
}
