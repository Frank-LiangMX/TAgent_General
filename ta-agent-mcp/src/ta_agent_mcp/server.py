"""
MCP Server 入口

定义工具列表和调用路由。
"""

import asyncio
import logging

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

from .tools import mesh, texture, asset, tag_store

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 创建 MCP Server 实例
app = Server("ta-agent-mcp")


@app.list_tools()
async def list_tools() -> list[Tool]:
    """返回所有可用工具"""
    return [
        # 网格工具
        mesh.CHECK_MESH_BUDGET_TOOL,
        mesh.CHECK_FBX_INFO_TOOL,
        # 纹理工具
        texture.CHECK_TEXTURE_INFO_TOOL,
        texture.CHECK_TEXTURE_BATCH_TOOL,
        # 资产工具
        asset.ANALYZE_ASSETS_TOOL,
        # 资产库管理工具
        tag_store.SAVE_ASSET_TOOL,
        tag_store.UPDATE_ASSET_TOOL,
        tag_store.DELETE_ASSET_TOOL,
        tag_store.GET_ASSET_TOOL,
        tag_store.LIST_ASSETS_TOOL,
        tag_store.GET_DB_STATUS_TOOL,
    ]


@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    """执行工具调用"""
    try:
        # 网格工具
        if name == "tagent__check_mesh_budget":
            result = await mesh.check_mesh_budget(**arguments)
        elif name == "tagent__check_fbx_info":
            result = await mesh.check_fbx_info(**arguments)
        # 纹理工具
        elif name == "tagent__check_texture_info":
            result = await texture.check_texture_info(**arguments)
        elif name == "tagent__check_texture_batch":
            result = await texture.check_texture_batch(**arguments)
        # 资产工具
        elif name == "tagent__analyze_assets":
            result = await asset.analyze_assets(**arguments)
        # 资产库管理工具
        elif name == "tagent__save_asset":
            result = await tag_store.save_asset_tool(**arguments)
        elif name == "tagent__update_asset":
            result = await tag_store.update_asset_tool(**arguments)
        elif name == "tagent__delete_asset":
            result = await tag_store.delete_asset_tool(**arguments)
        elif name == "tagent__get_asset":
            result = await tag_store.get_asset_tool(**arguments)
        elif name == "tagent__list_assets":
            result = await tag_store.list_assets_tool(**arguments)
        elif name == "tagent__get_db_status":
            result = await tag_store.get_db_status_tool()
        else:
            result = {"error": f"未知工具: {name}"}

        # 格式化输出
        import json
        return [TextContent(type="text", text=json.dumps(result, ensure_ascii=False, indent=2))]

    except Exception as e:
        logger.exception(f"工具执行失败: {name}")
        return [TextContent(type="text", text=f"错误: {str(e)}")]


async def run_server():
    """运行 MCP Server"""
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream, app.create_initialization_options())


def main():
    """入口函数"""
    asyncio.run(run_server())


if __name__ == "__main__":
    main()
