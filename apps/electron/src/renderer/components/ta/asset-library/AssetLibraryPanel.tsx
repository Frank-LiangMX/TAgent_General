/**
 * AssetLibraryPanel - 资产库面板
 *
 * 显示资产列表、搜索、筛选功能。
 * 从 SQLite 数据库直读资产数据。
 */

import {
  Filter,
  Plus,
  Folder,
  Image,
  Box,
  Music,
  FileText,
  Loader2,
  AlertCircle,
  RefreshCw,
  Database,
} from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { SearchInput } from '@/components/ui/search-input'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

// 资产类型图标
const ASSET_TYPE_ICONS: Record<string, React.ReactNode> = {
  mesh: <Box size={16} />,
  texture: <Image size={16} />,
  audio: <Music size={16} />,
  material: <FileText size={16} />,
  animation: <FileText size={16} />,
  skeleton: <Box size={16} />,
  particle: <FileText size={16} />,
  level: <Folder size={16} />,
  blueprint: <FileText size={16} />,
  other: <Folder size={16} />,
}

// 资产类型列表
const ASSET_TYPES = [
  'mesh',
  'texture',
  'material',
  'animation',
  'audio',
  'skeleton',
  'particle',
  'level',
  'blueprint',
]

/** 资产记录类型 */
interface AssetRecord {
  id: string
  name: string
  type: string
  path: string
  project?: string
  status: string
  tags?: string
  metadata?: string
  created_at: number
  updated_at: number
  analyzed_at?: number
  review_status: string
  review_notes?: string
}

/** 资产库状态类型 */
interface AssetStoreStatus {
  available: boolean
  dbPath: string | null
}

/** 资产库统计类型 */
interface AssetStoreStats {
  totalAssets: number
  byType: Record<string, number>
  byReviewStatus: Record<string, number>
  lastUpdatedAt: number | null
}

/** 列表查询参数 */
interface ListAssetsParams {
  type?: string
  project?: string
  reviewStatus?: string
  offset?: number
  limit?: number
  orderBy?: 'name' | 'updated_at' | 'created_at'
  orderDir?: 'ASC' | 'DESC'
}

/** 列表查询结果 */
interface ListAssetsResult {
  assets: AssetRecord[]
  total: number
  hasMore: boolean
}

/** 搜索参数 */
interface SearchAssetsParams {
  query: string
  type?: string
  limit?: number
}

export function AssetLibraryPanel(): React.ReactElement {
  const [isLoading, setIsLoading] = React.useState(true)
  const [storeStatus, setStoreStatus] = React.useState<AssetStoreStatus | null>(null)
  const [stats, setStats] = React.useState<AssetStoreStats | null>(null)
  const [assets, setAssets] = React.useState<AssetRecord[]>([])
  const [total, setTotal] = React.useState(0)
  const [hasMore, setHasMore] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [searchQuery, setSearchQuery] = React.useState('')
  const [selectedType, setSelectedType] = React.useState<string | null>(null)
  const [selectedProject, setSelectedProject] = React.useState<string | null>(null)
  const [projects, setProjects] = React.useState<string[]>([])

  // 初始化资产库
  React.useEffect(() => {
    let mounted = true

    async function initAssetStore() {
      setIsLoading(true)
      setError(null)

      try {
        // 初始化服务
        const initResult = await window.electronAPI.initAssetStore()
        if (!mounted) return

        if (!initResult.success) {
          setError(initResult.error || '初始化失败')
          setIsLoading(false)
          return
        }

        if (!initResult.dbExists) {
          // 数据库不存在，显示引导
          setStoreStatus({ available: false, dbPath: null })
          setIsLoading(false)
          return
        }

        // 获取状态
        const status = await window.electronAPI.getAssetStoreStatus()
        if (!mounted) return
        setStoreStatus(status)

        // 加载初始数据
        await loadAssets()
        await loadStats()
        await loadProjects()
      } catch (err) {
        if (!mounted) return
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg)
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    initAssetStore()

    return () => {
      mounted = false
    }
  }, [])

  // 加载资产列表
  const loadAssets = React.useCallback(
    async (params?: ListAssetsParams) => {
      try {
        const result: ListAssetsResult = await window.electronAPI.listAssets({
          type: selectedType || undefined,
          project: selectedProject || undefined,
          limit: 50,
          ...params,
        })
        setAssets(result.assets)
        setTotal(result.total)
        setHasMore(result.hasMore)
      } catch (err) {
        console.error('[AssetLibraryPanel] 加载资产失败:', err)
      }
    },
    [selectedType, selectedProject]
  )

  // 加载统计
  const loadStats = React.useCallback(async () => {
    try {
      const result: AssetStoreStats = await window.electronAPI.getAssetStoreStats()
      setStats(result)
    } catch (err) {
      console.error('[AssetLibraryPanel] 加载统计失败:', err)
    }
  }, [])

  // 加载项目列表
  const loadProjects = React.useCallback(async () => {
    try {
      const result: string[] = await window.electronAPI.listProjects()
      setProjects(result)
    } catch (err) {
      console.error('[AssetLibraryPanel] 加载项目列表失败:', err)
    }
  }, [])

  // 搜索资产
  const handleSearch = React.useCallback(async () => {
    if (!searchQuery.trim()) {
      loadAssets()
      return
    }

    setIsLoading(true)
    try {
      const result: ListAssetsResult = await window.electronAPI.searchAssets({
        query: searchQuery,
        type: selectedType || undefined,
      })
      setAssets(result.assets)
      setTotal(result.total)
      setHasMore(result.hasMore)
    } catch (err) {
      console.error('[AssetLibraryPanel] 搜索失败:', err)
    } finally {
      setIsLoading(false)
    }
  }, [searchQuery, selectedType, loadAssets])

  // 刷新
  const handleRefresh = React.useCallback(async () => {
    setIsLoading(true)
    setSearchQuery('')
    await Promise.all([loadAssets(), loadStats(), loadProjects()])
    setIsLoading(false)
  }, [loadAssets, loadStats, loadProjects])

  // 加载更多
  const handleLoadMore = React.useCallback(async () => {
    if (!hasMore || isLoading) return

    try {
      const result: ListAssetsResult = await window.electronAPI.listAssets({
        type: selectedType || undefined,
        project: selectedProject || undefined,
        offset: assets.length,
        limit: 50,
      })
      setAssets((prev) => [...prev, ...result.assets])
      setHasMore(result.hasMore)
    } catch (err) {
      console.error('[AssetLibraryPanel] 加载更多失败:', err)
    }
  }, [hasMore, isLoading, selectedType, selectedProject, assets.length])

  // 类型筛选变化
  React.useEffect(() => {
    if (storeStatus?.available) {
      loadAssets()
    }
  }, [selectedType, selectedProject, storeStatus?.available, loadAssets])

  // 初始化资产库数据库
  const handleCreateDatabase = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await window.electronAPI.createAssetStoreDatabase()
      if (result.success) {
        toast.success('资产库已初始化')
        // 重新初始化服务（以只读模式打开新创建的数据库）
        const initResult = await window.electronAPI.initAssetStore()
        if (initResult.success && initResult.dbExists) {
          const status = await window.electronAPI.getAssetStoreStatus()
          setStoreStatus(status)
          // 主动加载资产列表，让视图立即切换
          await Promise.all([loadAssets(), loadStats(), loadProjects()])
        } else {
          toast.error('数据库已创建，但重新打开失败')
        }
      } else {
        toast.error(`初始化失败: ${result.error || '未知错误'}`)
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      toast.error(`初始化失败: ${msg}`)
    } finally {
      setIsLoading(false)
    }
  }, [loadAssets, loadStats, loadProjects])

  // 渲染空状态
  if (!isLoading && !storeStatus?.available) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
        <AlertCircle size={48} className="mb-4 opacity-30" />
        <p className="text-sm font-medium mb-2">资产库未初始化</p>
        <p className="text-xs text-center max-w-md mb-4">
          数据库尚未创建，点击下方按钮初始化资产库。
          <br />
          数据库位置: ~/.tagent/ta/tag_store/tags.db
        </p>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleCreateDatabase}>
          <Database size={14} />
          初始化资产库
        </Button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* 顶部工具栏 */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        {/* 搜索框 */}
        <SearchInput
          containerClassName="flex-1"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="搜索资产..."
        />

        {/* 类型筛选 */}
        <div className="flex items-center gap-1">
          {ASSET_TYPES.slice(0, 5).map((type) => (
            <Tooltip key={type}>
              <TooltipTrigger asChild>
                <Button
                  variant={selectedType === type ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedType(selectedType === type ? null : type)}
                  className="size-[32px] rounded-lg p-0"
                >
                  {ASSET_TYPE_ICONS[type] || <Folder size={16} />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{type}</TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* 刷新按钮 */}
        <Button
          variant="ghost"
          size="sm"
          className="size-[36px] rounded-full p-0"
          onClick={handleRefresh}
          disabled={isLoading}
        >
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
        </Button>
      </div>

      {/* 加载状态 */}
      {isLoading && assets.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
          <AlertCircle size={48} className="mb-4 opacity-30" />
          <p className="text-sm">{error}</p>
        </div>
      ) : (
        <>
          {/* 资产列表 */}
          <div className="flex-1 overflow-y-auto p-4">
            {assets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Folder size={48} className="mb-4 opacity-30" />
                <p className="text-sm">未找到资产</p>
                <p className="text-xs mt-1">尝试调整搜索条件或导入新资产</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {assets.map((asset) => (
                  <AssetCard key={asset.id} asset={asset} />
                ))}
              </div>
            )}
          </div>

          {/* 加载更多 */}
          {hasMore && (
            <div className="px-4 py-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={handleLoadMore}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                加载更多
              </Button>
            </div>
          )}
        </>
      )}

      {/* 底部统计 */}
      <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
        <span>
          共 {assets.length} / {stats?.totalAssets ?? total} 个资产
        </span>
        {stats?.lastUpdatedAt && (
          <span>最后更新: {new Date(stats.lastUpdatedAt).toLocaleDateString()}</span>
        )}
      </div>
    </div>
  )
}

interface AssetCardProps {
  asset: AssetRecord
}

function AssetCard({ asset }: AssetCardProps): React.ReactElement {
  const timeAgo = getTimeAgo(asset.updated_at)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-muted/50 transition-colors cursor-pointer">
          {/* 图标 */}
          <div className="size-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
            {ASSET_TYPE_ICONS[asset.type] || <Folder size={20} className="text-muted-foreground" />}
          </div>

          {/* 信息 */}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{asset.name}</div>
            <div className="text-xs text-muted-foreground truncate">{asset.path}</div>
          </div>

          {/* 时间 */}
          <div className="text-xs text-muted-foreground flex-shrink-0">{timeAgo}</div>
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-[400px] break-all">{asset.path}</TooltipContent>
    </Tooltip>
  )
}

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return '刚刚'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  return `${days} 天前`
}
