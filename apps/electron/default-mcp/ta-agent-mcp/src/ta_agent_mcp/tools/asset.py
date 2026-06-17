"""
资产分析工具

提供资产分类和分析功能。
支持扫描目录并将结果写入资产库数据库。
"""

import os
from typing import Optional

from mcp.types import Tool

from ..tag_store import get_db_status, save_assets_batch
from ..utils.output import format_error, format_result

# ===== 工具定义 =====

ANALYZE_ASSETS_TOOL = Tool(
    name="tagent__analyze_assets",
    description=(
        "Analyze assets in a directory and classify by type "
        "(mesh, texture, material, animation). Optionally save results to asset database."
    ),
    inputSchema={
        "type": "object",
        "properties": {
            "directory": {"type": "string", "description": "Directory to analyze"},
            "recursive": {"type": "boolean", "description": "Search recursively (default: true)"},
            "output_format": {
                "type": "string",
                "enum": ["summary", "detailed", "json"],
                "description": "Output format (default: summary)",
            },
            "save_to_db": {
                "type": "boolean",
                "description": "Save analyzed assets to database (default: false)",
            },
            "project": {"type": "string", "description": "Project name for saved assets"},
        },
        "required": ["directory"],
    },
)

# ===== 资产类型定义 =====

# 按扩展名粗分类的扩展名集合（与命名约定辅助判断）
ASSET_EXTENSIONS = {
    "mesh": {
        # 通用模型
        ".fbx",
        ".obj",
        ".gltf",
        ".glb",
        ".blend",
        ".max",
        ".ma",
        ".mb",
        ".bvh",
    },
    "texture": {
        ".png",
        ".jpg",
        ".jpeg",
        ".tga",
        ".bmp",
        ".tif",
        ".tiff",
        ".webp",
        ".exr",
        ".hdr",
        ".psd",
    },
    "material": {
        ".mat",
        ".mtl",
        ".sbs",
        ".sbsar",
        # Unity 材质
        ".shader",
    },
    "animation": {".anim", ".bip"},
    "audio": {".wav", ".mp3", ".ogg", ".aac", ".flac"},
    "video": {".mp4", ".mov", ".avi", ".webm", ".mkv"},
    "script": {
        ".py",
        ".lua",
        ".cs",
        ".cpp",
        ".h",
        ".hpp",
        ".c",
        ".cc",
    },
    "config": {".json", ".yaml", ".yml", ".xml", ".ini", ".toml"},
    "level": {
        # Unity 场景
        ".unity",
        ".prefab",
    },
    "other": set(),
}

# UE `.uasset` 根据命名约定的细分（UE 资产标准前缀）
# 来自 UE 官方资产命名规范:
#   https://docs.unrealengine.com/5.0/en-US/asset-naming-conventions-in-unreal-engine/
UE_UASSET_PREFIX_TYPE = {
    # blueprint
    "bp": "blueprint",
    "blueprint": "blueprint",
    "abl": "blueprint",
    # material
    "m": "material",
    "mi": "material",
    "mat": "material",
    # texture
    "t": "texture",
    "tex": "texture",
    "tc": "texture",
    # mesh
    "sm": "mesh",
    "sk": "mesh",
    "skm": "mesh",
    "skt": "mesh",
    # level / actor
    "a": "level",
    "am": "level",
    "l": "level",
    # particle
    "p": "blueprint",  # Niagara / Cascade system 多数以 P_ 开头，归到 blueprint
    # sound
    "sfx": "audio",
    "s": "audio",
    "sn": "audio",
    "us": "audio",
}


def classify_unreal_uasset(filename: str) -> str:
    """根据 UE 资产命名约定推断 .uasset 类型"""
    # 去掉扩展名，按 _ 切分首段
    base = os.path.splitext(filename)[0]
    parts = base.split("_", 1)
    if len(parts) < 2 or not parts[0]:
        return "mesh"  # 默认归 mesh（保守）
    prefix = parts[0].lower()
    return UE_UASSET_PREFIX_TYPE.get(prefix, "mesh")


def classify_file(filename: str) -> str:
    """根据扩展名 + 命名约定分类文件"""
    ext = os.path.splitext(filename)[1].lower()

    # .umap 是 UE 关卡
    if ext == ".umap":
        return "level"

    # .uasset 需要按命名约定细分
    if ext == ".uasset":
        return classify_unreal_uasset(filename)

    # 其余按扩展名表查找
    for asset_type, extensions in ASSET_EXTENSIONS.items():
        if ext in extensions:
            return asset_type
    return "other"


# ===== 忽略目录（递归时跳过） =====

# UE: Content/Plugins/Config 等是真正的资产目录；Library/Intermediate/Saved/DerivedDataCache 是构建产物
# Unity: Assets/ 是真正的资产目录；Library/Temp/obj/Logs 是构建/导入产物
IGNORE_DIRS = {
    # Unreal Engine
    "binaries",
    "intermediate",
    "saved",
    "deriveddatacache",
    "plugins",  # 第三方插件通常不归到主项目
    # Unity
    "library",
    "temp",
    "obj",
    "logs",
    "memorycaptures",
    # 通用
    "node_modules",
    ".git",
    ".svn",
    ".hg",
    "__pycache__",
    ".cache",
    ".next",
    ".nuxt",
    "dist",
    "build",
    ".idea",
    ".vscode",
    ".vs",
    # macOS / Windows 系统
    ".ds_store",
    "thumbs.db",
}

# ===== 工具实现 =====


async def analyze_assets(
    directory: str,
    recursive: bool = True,
    output_format: str = "summary",
    save_to_db: bool = False,
    project: Optional[str] = None,
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
        for root, dirs, filenames in os.walk(directory):
            # 就地修改 dirs 列表，os.walk 会跳过被标记的目录
            dirs[:] = [d for d in dirs if d.lower() not in IGNORE_DIRS]
            for f in filenames:
                files.append(os.path.join(root, f))
    else:
        for entry in os.listdir(directory):
            if entry.lower() in IGNORE_DIRS:
                continue
            full_path = os.path.join(directory, entry)
            if os.path.isfile(full_path):
                files.append(full_path)

    if not files:
        return format_result(data={"count": 0}, message="目录为空")

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
        except OSError:
            size = 0
        type_sizes[asset_type] = type_sizes.get(asset_type, 0) + size

        # 收集文件列表
        if asset_type not in type_files:
            type_files[asset_type] = []
        if len(type_files[asset_type]) < 10:  # 每类型最多 10 个
            type_files[asset_type].append(filename)

        # 收集待保存的资产
        if save_to_db:
            assets_to_save.append(
                {
                    "name": filename,
                    "type": asset_type,
                    "path": file_path,
                    "project": project,
                    "metadata": {"size": size},
                }
            )

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
        "by_type": {},
    }

    for asset_type in sorted(type_counts.keys()):
        result_data["by_type"][asset_type] = {
            "count": type_counts[asset_type],
            "size": format_size(type_sizes.get(asset_type, 0)),
            "size_mb": round(type_sizes.get(asset_type, 0) / (1024 * 1024), 2),
            "percentage": round(type_counts[asset_type] / len(files) * 100, 1),
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
        if " " in filename:
            naming_issues.append(f"'{filename}' 包含空格")
        if filename.startswith("."):
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
        message=f"发现 {len(files)} 个文件, 总计 {format_size(total_size)}"
        + (f", 已保存 {saved_count} 个到数据库" if saved_count > 0 else ""),
    )
