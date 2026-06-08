"""
TA Agent MCP Server 测试
"""

import pytest
import os
import tempfile
from pathlib import Path

from ta_agent_mcp.tools.mesh import check_mesh_budget, check_fbx_info
from ta_agent_mcp.tools.texture import check_texture_info, check_texture_batch, detect_texture_type
from ta_agent_mcp.tools.asset import analyze_assets, classify_file


class TestTextureTools:
    """纹理工具测试"""

    def test_detect_texture_type(self):
        """测试纹理类型检测"""
        assert detect_texture_type("T_Wood_BC.png") == "basecolor"
        assert detect_texture_type("T_Wood_N.png") == "normal"
        assert detect_texture_type("T_Wood_R.png") == "roughness"
        assert detect_texture_type("T_Wood_M.png") == "metallic"
        assert detect_texture_type("RandomName.png") == "unknown"

    @pytest.mark.asyncio
    async def test_check_texture_info_not_found(self):
        """测试不存在的纹理文件"""
        result = await check_texture_info("/nonexistent/texture.png")
        assert result["success"] is False
        assert "不存在" in result["error"]

    @pytest.mark.asyncio
    async def test_check_texture_info_valid(self, tmp_path):
        """测试有效的纹理文件"""
        from PIL import Image

        # 创建测试纹理
        texture_path = tmp_path / "T_Test_BC.png"
        img = Image.new("RGB", (512, 512), color="red")
        img.save(texture_path)

        result = await check_texture_info(str(texture_path))

        assert result["success"] is True
        assert result["data"]["dimensions"]["width"] == 512
        assert result["data"]["dimensions"]["height"] == 512
        assert result["data"]["type"] == "basecolor"
        assert result["data"]["is_pot"] is True

    @pytest.mark.asyncio
    async def test_check_texture_non_power_of_two(self, tmp_path):
        """测试非 2 的幂尺寸纹理"""
        from PIL import Image

        texture_path = tmp_path / "texture.png"
        img = Image.new("RGB", (500, 500), color="blue")
        img.save(texture_path)

        result = await check_texture_info(str(texture_path))

        assert result["success"] is True
        assert result["data"]["is_pot"] is False
        assert len(result["data"]["issues"]) > 0


class TestAssetTools:
    """资产工具测试"""

    def test_classify_file(self):
        """测试文件分类"""
        assert classify_file("model.fbx") == "mesh"
        assert classify_file("texture.png") == "texture"
        assert classify_file("material.mat") == "material"
        assert classify_file("script.py") == "script"
        assert classify_file("unknown.xyz") == "other"

    @pytest.mark.asyncio
    async def test_analyze_assets_empty_dir(self, tmp_path):
        """测试空目录分析"""
        result = await analyze_assets(str(tmp_path))

        assert result["success"] is True
        assert result["data"]["count"] == 0

    @pytest.mark.asyncio
    async def test_analyze_assets_with_files(self, tmp_path):
        """测试有文件的目录分析"""
        # 创建一些测试文件
        (tmp_path / "model.fbx").write_bytes(b"fake fbx content")
        (tmp_path / "texture.png").write_bytes(b"fake png content")
        (tmp_path / "script.py").write_bytes(b"print('hello')")

        result = await analyze_assets(str(tmp_path))

        assert result["success"] is True
        assert result["data"]["total_files"] == 3
        assert "mesh" in result["data"]["by_type"]
        assert "texture" in result["data"]["by_type"]
        assert "script" in result["data"]["by_type"]


class TestMeshTools:
    """网格工具测试"""

    @pytest.mark.asyncio
    async def test_check_mesh_budget_not_found(self):
        """测试不存在的网格文件"""
        result = await check_mesh_budget("/nonexistent/model.fbx")
        assert result["success"] is False
        assert "不存在" in result["error"]

    @pytest.mark.asyncio
    async def test_check_fbx_info_not_found(self):
        """测试不存在的 FBX 文件"""
        result = await check_fbx_info("/nonexistent/model.fbx")
        assert result["success"] is False


class TestOutputFormat:
    """输出格式测试"""

    def test_format_result(self):
        """测试成功结果格式化"""
        from ta_agent_mcp.utils.output import format_result

        result = format_result({"test": "data"}, "测试消息")

        assert result["success"] is True
        assert result["data"]["test"] == "data"
        assert result["message"] == "测试消息"

    def test_format_error(self):
        """测试错误结果格式化"""
        from ta_agent_mcp.utils.output import format_error

        result = format_error("测试错误", {"detail": "详情"})

        assert result["success"] is False
        assert result["error"] == "测试错误"
        assert result["details"]["detail"] == "详情"
