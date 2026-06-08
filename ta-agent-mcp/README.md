# TA Agent MCP Server

Technical Artist (TA) 领域 MCP Server，为 TAgent 提供游戏资产分析和处理能力。

## 功能

- **网格分析** (`check_mesh_budget`) - 多边形预算检查
- **纹理分析** (`check_texture_info`) - 纹理信息检查
- **批量纹理处理** (`check_texture_batch`) - 批量纹理检查
- **资产识别** (`analyze_assets`) - AI 资产分类

## 安装

```bash
pip install -e .
```

## 使用

在 TAgent 的 MCP 配置中添加：

```json
{
  "ta-agent-mcp": {
    "command": "python",
    "args": ["-m", "ta_agent_mcp"]
  }
}
```

## 工具列表

| 工具名 | 功能 | 依赖 |
|--------|------|------|
| `tagent__check_mesh_budget` | 多边形预算检查 | trimesh |
| `tagent__check_texture_info` | 纹理信息检查 | Pillow |
| `tagent__check_texture_batch` | 批量纹理检查 | Pillow |
| `tagent__analyze_assets` | 资产分类分析 | 可选 onnxruntime |

## 开发

```bash
# 安装开发依赖
pip install -e ".[dev]"

# 运行测试
pytest

# 代码检查
ruff check src/
```
