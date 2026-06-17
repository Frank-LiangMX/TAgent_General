/**
 * 资产库模块入口
 *
 * 提供 SQLite 直读服务，支持：
 * - 资产列表查询
 * - FTS5 全文搜索
 * - 资产详情
 * - 统计信息
 */

export {
  assetStoreService,
  type ListAssetsParams,
  type ListAssetsResult,
  type SearchAssetsParams,
  type AssetStoreStats,
} from './service'
export {
  initializeAssetStoreDb,
  type AssetRecord,
  type AssetType,
  type AssetStatus,
  type ReviewStatus,
  type ReviewHistoryRecord,
} from './schema'
