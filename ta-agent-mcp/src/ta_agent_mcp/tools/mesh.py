"""
网格分析工具

使用 trimesh 进行多边形预算检查和 FBX 信息分析。
"""

from typing import Optional
from mcp.types import Tool

from ..utils.output import format_result, format_error

# ===== 工具定义 =====

CHECK_MESH_BUDGET_TOOL = Tool(
    name="tagent__check_mesh_budget",
    description="Check if a mesh meets polygon budget requirements. Returns triangle count, budget status, and optimization suggestions.",
    inputSchema={
        "type": "object",
        "properties": {
            "file_path": {
                "type": "string",
                "description": "Path to the mesh file (FBX, OBJ, GLTF)"
            },
            "budget": {
                "type": "number",
                "description": "Maximum allowed triangle count (default: 50000)"
            },
            "lod_level": {
                "type": "integer",
                "description": "LOD level for budget reference (0=LOD0, 1=LOD1, etc.)"
            }
        },
        "required": ["file_path"]
    }
)

CHECK_FBX_INFO_TOOL = Tool(
    name="tagent__check_fbx_info",
    description="Extract detailed information from an FBX file including meshes, materials, textures, and animations.",
    inputSchema={
        "type": "object",
        "properties": {
            "file_path": {
                "type": "string",
                "description": "Path to the FBX file"
            },
            "include_materials": {
                "type": "boolean",
                "description": "Include material information (default: true)"
            },
            "include_animations": {
                "type": "boolean",
                "description": "Include animation information (default: true)"
            }
        },
        "required": ["file_path"]
    }
)

# ===== 工具实现 =====

# LOD 预算参考（UE5 标准）
LOD_BUDGETS = {
    0: 50000,    # LOD0 - 最高精度
    1: 25000,    # LOD1
    2: 12500,    # LOD2
    3: 6000,     # LOD3
    4: 3000,     # LOD4
}

async def check_mesh_budget(
    file_path: str,
    budget: Optional[int] = None,
    lod_level: Optional[int] = None
) -> dict:
    """
    检查网格多边形预算

    Args:
        file_path: 网格文件路径
        budget: 最大三角形数量，默认根据 LOD 级别自动选择
        lod_level: LOD 级别（0-4）

    Returns:
        检查结果，包含三角形数量、预算状态、优化建议
    """
    import os
    import trimesh

    # 检查文件是否存在
    if not os.path.exists(file_path):
        return format_error(f"文件不存在: {file_path}")

    # 确定预算
    if budget is None:
        if lod_level is not None and lod_level in LOD_BUDGETS:
            budget = LOD_BUDGETS[lod_level]
        else:
            budget = LOD_BUDGETS[0]  # 默认 LOD0 预算

    try:
        # 加载网格
        scene = trimesh.load(file_path)

        # 统计三角形数量
        if isinstance(scene, trimesh.Scene):
            # 场景包含多个网格
            total_triangles = 0
            mesh_info = []
            for name, geometry in scene.geometry.items():
                if hasattr(geometry, 'triangles'):
                    tris = len(geometry.triangles)
                    total_triangles += tris
                    mesh_info.append({
                        "name": name,
                        "triangles": tris
                    })
        else:
            # 单个网格
            total_triangles = len(scene.triangles)
            mesh_info = [{"name": "main", "triangles": total_triangles}]

        # 计算预算使用率
        usage_percent = (total_triangles / budget) * 100
        within_budget = total_triangles <= budget

        # 生成建议
        suggestions = []
        if not within_budget:
            excess = total_triangles - budget
            suggestions.append(f"超出预算 {excess:,} 三角形")
            suggestions.append("建议：使用 Decimate 修改器减少多边形")
            suggestions.append("建议：检查是否有不必要的细分")
        elif usage_percent > 80:
            suggestions.append(f"接近预算上限 ({usage_percent:.1f}%)")
            suggestions.append("建议：留出余量以应对未来修改")

        return format_result(
            data={
                "file": os.path.basename(file_path),
                "total_triangles": total_triangles,
                "budget": budget,
                "usage_percent": round(usage_percent, 2),
                "within_budget": within_budget,
                "lod_level": lod_level,
                "meshes": mesh_info,
                "suggestions": suggestions if suggestions else None
            },
            message="✅ 预算检查通过" if within_budget else "❌ 超出预算"
        )

    except Exception as e:
        return format_error(f"网格加载失败: {str(e)}")


async def check_fbx_info(
    file_path: str,
    include_materials: bool = True,
    include_animations: bool = True
) -> dict:
    """
    提取 FBX 文件信息

    Args:
        file_path: FBX 文件路径
        include_materials: 是否包含材质信息
        include_animations: 是否包含动画信息

    Returns:
        FBX 文件详细信息
    """
    import os
    import trimesh

    if not os.path.exists(file_path):
        return format_error(f"文件不存在: {file_path}")

    try:
        scene = trimesh.load(file_path)

        result = {
            "file": os.path.basename(file_path),
            "format": os.path.splitext(file_path)[1].upper(),
        }

        # 网格信息
        if isinstance(scene, trimesh.Scene):
            meshes = []
            total_vertices = 0
            total_triangles = 0

            for name, geometry in scene.geometry.items():
                if hasattr(geometry, 'vertices'):
                    verts = len(geometry.vertices)
                    tris = len(geometry.triangles) if hasattr(geometry, 'triangles') else 0
                    total_vertices += verts
                    total_triangles += tris

                    mesh_data = {
                        "name": name,
                        "vertices": verts,
                        "triangles": tris
                    }

                    # 边界框
                    if hasattr(geometry, 'bounds'):
                        bounds = geometry.bounds
                        mesh_data["bounds"] = {
                            "min": bounds[0].tolist(),
                            "max": bounds[1].tolist()
                        }

                    meshes.append(mesh_data)

            result["meshes"] = meshes
            result["total_vertices"] = total_vertices
            result["total_triangles"] = total_triangles

        # 材质信息
        if include_materials:
            # trimesh 材质提取有限，这里提供基础信息
            materials = []
            if hasattr(scene, 'geometry'):
                for name, geometry in scene.geometry.items():
                    if hasattr(geometry, 'visual') and hasattr(geometry.visual, 'material'):
                        mat = geometry.visual.material
                        materials.append({
                            "mesh": name,
                            "material": str(type(mat).__name__)
                        })
            result["materials"] = materials

        # 动画信息（trimesh 不直接支持动画，标记为需要专用工具）
        if include_animations:
            result["animations"] = {
                "note": "动画信息需要使用 Blender 或 FBX SDK 提取"
            }

        return format_result(result, "FBX 信息提取成功")

    except Exception as e:
        return format_error(f"FBX 加载失败: {str(e)}")
