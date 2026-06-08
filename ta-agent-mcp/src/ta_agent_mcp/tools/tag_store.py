"""
资产库管理工具

提供资产的保存、更新、删除功能。
"""

import os
from typing import Optional, List, Dict, Any
from mcp.types import Tool

from ..utils.output import format_result, format_error
from ..tag_store import (
    save_asset,
    update_asset,
    delete_asset,
    get_asset_by_id,
    list_assets,
    count_assets,
    get_db_status,
    get_tag_store_path
)

# ===== 工具定义 =====

SAVE_ASSET_TOOL = Tool(
    name="tagent__save_asset",
    description="Save a single asset to the asset library database.",
    inputSchema={
        "type": "object",
        "properties": {
            "name": {
                "type": "string",
                "description": "Asset name"
            },
            "type": {
                "type": "string",
                "enum": ["mesh", "texture", "material", "animation", "audio", "skeleton", "particle", "level", "blueprint", "other"],
                "description": "Asset type"
            },
            "path": {
                "type": "string",
                "description": "Asset file path"
            },
            "project": {
                "type": "string",
                "description": "Project name"
            },
            "tags": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Asset tags"
            },
            "metadata": {
                "type": "object",
                "description": "Additional metadata"
            },
            "asset_id": {
                "type": "string",
                "description": "Existing asset ID to update (optional)"
            }
        },
        "required": ["name", "type", "path"]
    }
)

UPDATE_ASSET_TOOL = Tool(
    name="tagent__update_asset",
    description="Update asset properties in the database.",
    inputSchema={
        "type": "object",
        "properties": {
            "asset_id": {
                "type": "string",
                "description": "Asset ID to update"
            },
            "name": {
                "type": "string",
                "description": "New asset name"
            },
            "type": {
                "type": "string",
                "enum": ["mesh", "texture", "material", "animation", "audio", "skeleton", "particle", "level", "blueprint", "other"],
                "description": "New asset type"
            },
            "project": {
                "type": "string",
                "description": "New project name"
            },
            "tags": {
                "type": "array",
                "items": {"type": "string"},
                "description": "New tags"
            },
            "metadata": {
                "type": "object",
                "description": "New metadata"
            },
            "review_status": {
                "type": "string",
                "enum": ["pending", "approved", "rejected", "needs_review"],
                "description": "Review status"
            },
            "review_notes": {
                "type": "string",
                "description": "Review notes"
            }
        },
        "required": ["asset_id"]
    }
)

DELETE_ASSET_TOOL = Tool(
    name="tagent__delete_asset",
    description="Delete an asset from the database (soft delete).",
    inputSchema={
        "type": "object",
        "properties": {
            "asset_id": {
                "type": "string",
                "description": "Asset ID to delete"
            }
        },
        "required": ["asset_id"]
    }
)

GET_ASSET_TOOL = Tool(
    name="tagent__get_asset",
    description="Get asset details by ID.",
    inputSchema={
        "type": "object",
        "properties": {
            "asset_id": {
                "type": "string",
                "description": "Asset ID"
            }
        },
        "required": ["asset_id"]
    }
)

LIST_ASSETS_TOOL = Tool(
    name="tagent__list_assets",
    description="List assets from the database with optional filters.",
    inputSchema={
        "type": "object",
        "properties": {
            "type": {
                "type": "string",
                "description": "Filter by asset type"
            },
            "project": {
                "type": "string",
                "description": "Filter by project"
            },
            "review_status": {
                "type": "string",
                "enum": ["pending", "approved", "rejected", "needs_review"],
                "description": "Filter by review status"
            },
            "limit": {
                "type": "integer",
                "description": "Number of results (default 50)"
            },
            "offset": {
                "type": "integer",
                "description": "Offset for pagination"
            }
        }
    }
)

GET_DB_STATUS_TOOL = Tool(
    name="tagent__get_db_status",
    description="Get asset database status and statistics.",
    inputSchema={
        "type": "object",
        "properties": {}
    }
)

# ===== 工具实现 =====

async def save_asset_tool(
    name: str,
    type: str,
    path: str,
    project: Optional[str] = None,
    tags: Optional[List[str]] = None,
    metadata: Optional[Dict[str, Any]] = None,
    asset_id: Optional[str] = None
) -> dict:
    """
    保存资产到数据库
    """
    # 验证路径存在
    if not os.path.exists(path):
        return format_error(f"资产路径不存在: {path}")

    try:
        saved_id = save_asset(
            name=name,
            type=type,
            path=path,
            project=project,
            tags=tags,
            metadata=metadata,
            asset_id=asset_id
        )

        return format_result(
            data={
                "asset_id": saved_id,
                "name": name,
                "type": type,
                "path": path
            },
            message=f"资产已保存: {name}"
        )
    except Exception as e:
        return format_error(f"保存失败: {str(e)}")


async def update_asset_tool(
    asset_id: str,
    **kwargs
) -> dict:
    """
    更新资产属性
    """
    # 检查资产存在
    existing = get_asset_by_id(asset_id)
    if not existing:
        return format_error(f"资产不存在: {asset_id}")

    try:
        success = update_asset(asset_id, **kwargs)

        if success:
            updated = get_asset_by_id(asset_id)
            return format_result(
                data=updated,
                message=f"资产已更新: {asset_id}"
            )
        else:
            return format_error("更新失败，无有效字段")
    except Exception as e:
        return format_error(f"更新失败: {str(e)}")


async def delete_asset_tool(asset_id: str) -> dict:
    """
    删除资产（软删除）
    """
    # 检查资产存在
    existing = get_asset_by_id(asset_id)
    if not existing:
        return format_error(f"资产不存在: {asset_id}")

    try:
        success = delete_asset(asset_id)

        if success:
            return format_result(
                data={"asset_id": asset_id},
                message=f"资产已删除: {existing['name']}"
            )
        else:
            return format_error("删除失败")
    except Exception as e:
        return format_error(f"删除失败: {str(e)}")


async def get_asset_tool(asset_id: str) -> dict:
    """
    获取资产详情
    """
    asset = get_asset_by_id(asset_id)

    if not asset:
        return format_error(f"资产不存在: {asset_id}")

    return format_result(
        data=asset,
        message=f"资产: {asset['name']}"
    )


async def list_assets_tool(
    type: Optional[str] = None,
    project: Optional[str] = None,
    review_status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
) -> dict:
    """
    列出资产
    """
    try:
        assets = list_assets(
            type=type,
            project=project,
            review_status=review_status,
            limit=limit,
            offset=offset
        )

        total = count_assets(
            type=type,
            project=project,
            review_status=review_status
        )

        return format_result(
            data={
                "assets": assets,
                "total": total,
                "count": len(assets),
                "has_more": offset + len(assets) < total
            },
            message=f"找到 {len(assets)} 个资产（共 {total} 个）"
        )
    except Exception as e:
        return format_error(f"查询失败: {str(e)}")


async def get_db_status_tool() -> dict:
    """
    获取数据库状态
    """
    try:
        status = get_db_status()
        return format_result(
            data=status,
            message="数据库状态"
        )
    except Exception as e:
        return format_error(f"获取状态失败: {str(e)}")