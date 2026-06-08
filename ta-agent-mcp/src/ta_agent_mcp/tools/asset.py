"""
资产分析工具

提供资产分类和分析功能。
支持扫描目录并将结果写入资产库数据库。
"""

import os
from typing import Optional, List
from mcp.types import Tool

from ..utils.output import format_result, format_error
from ..tag_store import save_assets_batch, get_db_status

# ===== 工具定义 =====

ANALYZE_ASSETS_TOOL = Tool(
    name="tagent__analyze_assets",
    description="Analyze assets in a directory and classify by type (mesh, texture, material, animation). Optionally save results to asset database.",
    inputSchema={
        "type": "object",
        "properties": {
            "directory": {
                "type": "string",
                "description": "Directory to analyze"
            },
            "recursive": {
                "type": "boolean",
                "description": "Search recursively (default: true)"
            },
            "output_format": {
                "type": "string",
                "enum": ["summary", "detailed", "json"],
                "description": "Output format (default: summary)"
            },
            "save_to_db": {
                "type": "boolean",
                "description": "Save analyzed assets to database (default: false)"
            },
            "project": {
                "type": "string",
                "description": "Project name for saved assets"
            }
        },
        "required": ["directory"]
    }
)

# ===== 资产类型定义 =====

ASSET_EXTENSIONS = {
    "mesh": {'.fbx', '.obj', '.gltf', '.glb', '.blend', '.max', '.ma', '.mb'},
    "texture": {'.png', '.jpg', '.jpeg', '.tga', '.bmp', '.tif', '.tiff', '.webp', '.exr', '.hdr', '.psd'},
    "material": {'.mat', '.mtl', '.sbs', '.sbsar'},
    "animation": {'.anim', '.fbx', '.bip'},  # FBX 可能包含动画
    "audio": {'.wav', '.mp3', '.ogg', '.aac'},
    "video": {'.mp4', '.mov', '.avi', '.webm'},
    "script": {'.py', '.lua', '.cs', '.cpp', '.h'},
    "config": {'.json', '.yaml', '.yml', '.xml', '.ini'},
    "other": set()
}

# ===== 工具实现 =====

def classify_file(filename: str) -> str:
    """根据扩展名分类文件"""
    ext = os.path.splitext(filename)[1].lower()
    for asset_type, extensions in ASSET_EXTENSIONS.items():
        if ext in extensions:
            return asset_type
    return "other"


async def analyze_assets(
    directory: str,
    recursive: bool = True,
    output_format: str = "summary",
    save_to_db: bool = False,
    project: Optional[str] = None
) -> dict:
    """
    分析目录中的资产

    Args:
        directory: 目标目录
        recursive: 是否递归搜索
        output_format: 输出格式
        save_to_db: 是否保存到数据库
        project: 项目名称

    Returns:
        资产分析结果
    """
    if not os.path.exists(directory):
        return format_error(f"目录不存在: {directory}")

    if not os.path.isdir(directory):
        return format_error(f"不是目录: {directory}")

    # 收集文件
    files = []
    if recursive:
        for root, _, filenames in os.walk(directory):
            for f in filenames:
                files.append(os.path.join(root, f))
    else:
        for f in os.listdir(directory):
            full_path = os.path.join(directory, f)
            if os.path.isfile(full_path):
                files.append(full_path)

    if not files:
        return format_result(
            data={"count": 0},
            message="目录为空"
        )

    # 分类统计
    type_counts = {}
    type_sizes = {}
    type_files = {}
    assets_to_save = []

    for file_path in files:
        filename = os.path.basename(file_path)
        asset_type = classify_file(filename)

        # 统计数量
        type_counts[asset_type] = type_counts.get(asset_type, 0) + 1

        # 统计大小
        try:
            size = os.path.getsize(file_path)
            type_sizes[asset_type] = type_sizes.get(asset_type, 0) + size
        except:
            pass

        # 收集文件列表
        if asset_type not in type_files:
            type_files[asset_type] = []
        if len(type_files[asset_type]) < 10:  # 每类型最多 10 个
            type_files[asset_type].append(filename)

        # 收集待保存的资产
        if save_to_db:
            assets_to_save.append({
                'name': filename,
                'type': asset_type,
                'path': file_path,
                'project': project,
                'metadata': {
                    'size': size if 'size' in dir() else 0
                }
            })

    # 计算总大小
    total_size = sum(type_sizes.values())
    total_size_mb = total_size / (1024 * 1024)

    # 格式化大小
    def format_size(size_bytes):
        if size_bytes < 1024:
            return f"{size_bytes} B"
        elif size_bytes < 1024 * 1024:
            return f"{size_bytes / 1024:.1f} KB"
        elif size_bytes < 1024 * 1024 * 1024:
            return f"{size_bytes / (1024 * 1024):.1f} MB"
        else:
            return f"{size_bytes / (1024 * 1024 * 1024):.1f} GB"

    # 构建结果
    result_data = {
        "directory": os.path.basename(directory),
        "total_files": len(files),
        "total_size": format_size(total_size),
        "total_size_mb": round(total_size_mb, 2),
        "by_type": {}
    }

    for asset_type in sorted(type_counts.keys()):
        result_data["by_type"][asset_type] = {
            "count": type_counts[asset_type],
            "size": format_size(type_sizes.get(asset_type, 0)),
            "size_mb": round(type_sizes.get(asset_type, 0) / (1024 * 1024), 2),
            "percentage": round(type_counts[asset_type] / len(files) * 100, 1)
        }

        if output_format == "detailed":
            result_data["by_type"][asset_type]["files"] = type_files[asset_type]

    # 问题检测
    issues = []

    # 检查是否有混合资产类型在根目录
    if len(type_counts) > 3 and not recursive:
        issues.append("根目录包含多种资产类型，建议按类型分子目录")

    # 检查命名规范
    naming_issues = []
    for file_path in files[:20]:
        filename = os.path.basename(file_path)
        if ' ' in filename:
            naming_issues.append(f"'{filename}' 包含空格")
        if filename.startswith('.'):
            naming_issues.append(f"'{filename}' 隐藏文件")

    if naming_issues:
        issues.append(f"命名问题: {len(naming_issues)} 个文件")

    if issues:
        result_data["issues"] = issues

    # 保存到数据库
    saved_count = 0
    if save_to_db and assets_to_save:
        try:
            saved_count = save_assets_batch(assets_to_save)
            result_data["saved_to_db"] = saved_count
            result_data["db_status"] = get_db_status()
        except Exception as e:
            result_data["db_error"] = str(e)

    return format_result(
        data=result_data,
        message=f"发现 {len(files)} 个文件, 总计 {format_size(total_size)}" + (f", 已保存 {saved_count} 个到数据库" if saved_count > 0 else "")
    )
