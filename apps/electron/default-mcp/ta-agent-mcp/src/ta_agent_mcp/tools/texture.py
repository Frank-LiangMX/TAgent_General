"""
纹理分析工具

使用 Pillow 进行纹理信息检查和批量处理。
"""

import os
from typing import Optional

from mcp.types import Tool

from ..utils.output import format_error, format_result

# ===== 工具定义 =====

CHECK_TEXTURE_INFO_TOOL = Tool(
    name="tagent__check_texture_info",
    description="Analyze a texture file and return dimensions, format, color space, and optimization suggestions.",
    inputSchema={
        "type": "object",
        "properties": {
            "file_path": {"type": "string", "description": "Path to the texture file"},
            "max_size": {
                "type": "integer",
                "description": "Maximum allowed texture size (default: 4096)",
            },
        },
        "required": ["file_path"],
    },
)

CHECK_TEXTURE_BATCH_TOOL = Tool(
    name="tagent__check_texture_batch",
    description="Batch analyze multiple texture files in a directory.",
    inputSchema={
        "type": "object",
        "properties": {
            "directory": {"type": "string", "description": "Directory containing texture files"},
            "recursive": {"type": "boolean", "description": "Search recursively (default: false)"},
            "max_size": {
                "type": "integer",
                "description": "Maximum allowed texture size (default: 4096)",
            },
        },
        "required": ["directory"],
    },
)

# ===== 纹理规范 =====

# 游戏引擎标准纹理尺寸
STANDARD_SIZES = [64, 128, 256, 512, 1024, 2048, 4096, 8192]

# 纹理类型检测模式
TEXTURE_TYPE_PATTERNS = {
    "basecolor": ["_BC", "_Albedo", "_Diffuse", "_Color", "BaseColor"],
    "normal": ["_N", "_Normal", "Normal"],
    "roughness": ["_R", "_Roughness", "Roughness"],
    "metallic": ["_M", "_Metallic", "Metallic"],
    "emissive": ["_E", "_Emissive", "Emissive"],
    "ao": ["_AO", "_AmbientOcclusion", "Occlusion"],
    "height": ["_H", "_Height", "_Displacement"],
    "alpha": ["_A", "_Alpha", "_Mask"],
}

# ===== 工具实现 =====


def detect_texture_type(filename: str) -> str:
    """根据文件名检测纹理类型"""
    name = os.path.splitext(filename)[0].upper()
    for tex_type, patterns in TEXTURE_TYPE_PATTERNS.items():
        for pattern in patterns:
            if pattern.upper() in name:
                return tex_type
    return "unknown"


def is_power_of_two(n: int) -> bool:
    """检查是否为 2 的幂"""
    return (n & (n - 1)) == 0


async def check_texture_info(file_path: str, max_size: Optional[int] = 4096) -> dict:
    """
    分析单个纹理文件

    Args:
        file_path: 纹理文件路径
        max_size: 最大允许尺寸

    Returns:
        纹理信息和优化建议
    """
    from PIL import Image

    if not os.path.exists(file_path):
        return format_error(f"文件不存在: {file_path}")

    try:
        with Image.open(file_path) as img:
            width, height = img.size
            mode = img.mode
            format_name = img.format

            # 检测纹理类型
            tex_type = detect_texture_type(file_path)

            # 生成问题列表
            issues = []
            suggestions = []

            # 检查尺寸
            if max(width, height) > max_size:
                issues.append(f"尺寸 {width}x{height} 超过最大限制 {max_size}")
                suggestions.append(f"建议缩小到 {max_size} 或更小")

            # 检查 POT
            if not is_power_of_two(width) or not is_power_of_two(height):
                issues.append("非 2 的幂尺寸，可能影响压缩和 Mipmap")
                suggestions.append("建议调整为 2 的幂尺寸（如 1024, 2048, 4096）")

            # 检查是否为正方形
            if width != height:
                # 非正方形不一定是问题，但某些情况需要注意
                pass

            # 检查颜色模式
            color_info = {
                "mode": mode,
                "channels": len(img.getbands()),
                "bands": list(img.getbands()),
            }

            # 针对不同纹理类型的建议
            if tex_type == "normal" and mode not in ["RGB", "RGBA"]:
                suggestions.append("法线贴图建议使用 RGB 或 RGBA 格式")

            if tex_type in ["basecolor", "albedo"] and mode not in ["RGB", "RGBA"]:
                suggestions.append("基础颜色贴图建议使用 RGB 或 RGBA 格式")

            # 文件大小
            file_size = os.path.getsize(file_path)
            file_size_mb = file_size / (1024 * 1024)

            # 内存占用估算
            memory_size = width * height * len(img.getbands())
            memory_mb = memory_size / (1024 * 1024)

            return format_result(
                data={
                    "file": os.path.basename(file_path),
                    "type": tex_type,
                    "dimensions": {"width": width, "height": height},
                    "format": format_name,
                    "color": color_info,
                    "file_size_mb": round(file_size_mb, 2),
                    "memory_mb": round(memory_mb, 2),
                    "is_pot": is_power_of_two(width) and is_power_of_two(height),
                    "is_square": width == height,
                    "issues": issues if issues else None,
                    "suggestions": suggestions if suggestions else None,
                },
                message="✅ 纹理检查通过" if not issues else "⚠️ 发现问题",
            )

    except Exception as e:
        return format_error(f"纹理加载失败: {str(e)}")


async def check_texture_batch(
    directory: str, recursive: bool = False, max_size: Optional[int] = 4096
) -> dict:
    """
    批量分析纹理文件

    Args:
        directory: 纹理目录
        recursive: 是否递归搜索
        max_size: 最大允许尺寸

    Returns:
        批量分析结果
    """
    if not os.path.exists(directory):
        return format_error(f"目录不存在: {directory}")

    # 支持的纹理格式
    texture_extensions = {
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
    }

    # 收集纹理文件
    texture_files = []
    if recursive:
        for root, _, files in os.walk(directory):
            for f in files:
                if os.path.splitext(f)[1].lower() in texture_extensions:
                    texture_files.append(os.path.join(root, f))
    else:
        for f in os.listdir(directory):
            if os.path.splitext(f)[1].lower() in texture_extensions:
                texture_files.append(os.path.join(directory, f))

    if not texture_files:
        return format_result(data={"count": 0, "textures": []}, message="未找到纹理文件")

    # 分析每个纹理
    results = []
    total_size = 0
    issues_count = 0

    for tex_path in texture_files[:50]:  # 限制最多 50 个
        result = await check_texture_info(tex_path, max_size)
        if "error" not in result:
            total_size += result["data"]["file_size_mb"]
            if result["data"].get("issues"):
                issues_count += 1
            results.append(
                {
                    "file": result["data"]["file"],
                    "type": result["data"]["type"],
                    "dimensions": result["data"]["dimensions"],
                    "format": result["data"]["format"],
                    "issues": result["data"].get("issues"),
                }
            )

    # 统计信息
    type_stats = {}
    for r in results:
        t = r["type"]
        type_stats[t] = type_stats.get(t, 0) + 1

    return format_result(
        data={
            "directory": os.path.basename(directory),
            "count": len(results),
            "total_count": len(texture_files),
            "total_size_mb": round(total_size, 2),
            "issues_count": issues_count,
            "type_distribution": type_stats,
            "textures": results[:20],  # 只返回前 20 个详细信息
            "truncated": len(results) > 20,
        },
        message=f"分析完成: {len(results)} 个纹理, {issues_count} 个问题",
    )
