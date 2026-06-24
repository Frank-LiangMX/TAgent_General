# TA MCP Server 架构设计

> 生成时间：2026-06-07
> 目的：定义 Python TA 工具的 MCP 封装方案

---

## 1. 架构总览

```
TAgent Desktop App (Electron/TypeScript)
│
├── 内置工具（TS 实现）
│   ├── check_naming
│   ├── scan_directory
│   └── search_assets (SQLite)
│
└── MCP Servers（用户配置）
    │
    ├── ta-agent-mcp（TA 领域 Python 工具）
    │   ├── Server 进程（Python）
    │   │   ├── trimesh → check_mesh_budget
    │   │   ├── PIL → check_texture_info
    │   │   ├── onnxruntime → analyze_assets
    │   │   └── Blender API → render_preview
    │   │
    │   └── 通信方式
    │       ├── stdin/stdout（标准 MCP）
    │       └── TCP Socket（Blender/UE5）
    │
    ├── blender-mcp（第三方）
    │
    └── 用户自定义 MCP
```

---

## 2. 命名空间设计

为避免与 Claude SDK 内置工具冲突，TA 工具加 `tagent__` 前缀：

| 原名                 | MCP 名称                     |
| -------------------- | ---------------------------- |
| `check_mesh_budget`  | `tagent__check_mesh_budget`  |
| `check_texture_info` | `tagent__check_texture_info` |
| `analyze_assets`     | `tagent__analyze_assets`     |

**TS 内置工具不加前缀**（因为它们是 TAgent 自带的）

---

## 3. ta-agent-mcp Server 结构

### 3.1 目录结构

```
ta-agent-mcp/
├── src/
│   ├── __init__.py
│   ├── server.py          # MCP server 入口
│   ├── tools/
│   │   ├── mesh.py        # 网格分析工具
│   │   ├── texture.py     # 纹理分析工具
│   │   ├── asset.py       # 资产识别工具
│   │   ├── render.py      # 渲染工具
│   │   └── ue5_bridge.py  # UE5 集成
│   └── utils/
│       ├── path_resolve.py
│       └── output_format.py
│
├── pyproject.toml         # Python 依赖
├── requirements.txt
└── README.md
```

### 3.2 MCP Server 入口

```python
# server.py
from mcp.server import Server
from mcp.server.stdio import stdio_server

import tools.mesh
import tools.texture
import tools.asset

app = Server("ta-agent-mcp")

@app.list_tools()
async def list_tools():
    return [
        tools.mesh.CHECK_MESH_BUDGET_SCHEMA,
        tools.texture.CHECK_TEXTURE_INFO_SCHEMA,
        tools.asset.ANALYZE_ASSETS_SCHEMA,
        # ...
    ]

@app.call_tool()
async def call_tool(name: str, arguments: dict):
    if name == "tagent__check_mesh_budget":
        return await tools.mesh.check_mesh_budget(**arguments)
    elif name == "tagent__check_texture_info":
        return await tools.texture.check_texture_info(**arguments)
    # ...

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream)

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
```

---

## 4. 通信方式

### 4.1 标准 MCP（stdin/stdout）

用于大多数 Python 工具：

```json
// TAgent mcp.json 配置
{
  "ta-agent-mcp": {
    "command": "python",
    "args": ["-m", "ta_agent_mcp"],
    "cwd": "~/.tagent/ta-agent-mcp"
  }
}
```

### 4.2 TCP Socket（引擎集成）

用于 Blender/UE5（需要保持进程）：

```
Blender MCP:
┌─────────────┐     TCP Socket     ┌─────────────┐
│  Blender    │◄──────────────────►│  MCP Server │
│  (Addon)    │    localhost:9876   │  (Python)   │
└─────────────┘                     └─────────────┘
```

UE5 同理。

---

## 5. 与 TAgent 集成

### 5.1 MCP 配置界面

TAgent 已有 MCP 管理界面（`AgentSettings.tsx`），用户可：

1. 添加 ta-agent-mcp server
2. 配置启动参数
3. 启用/禁用

### 5.2 TA 模式自动加载

TA 模式激活时，自动检查并加载 ta-agent-mcp：

```typescript
// agent-workspace-manager.ts
const TA_MCP_CONFIG = {
  'ta-agent-mcp': {
    command: 'python',
    args: ['-m', 'ta_agent_mcp'],
    cwd: path.join(getTaDataDir(), 'mcp-servers', 'ta-agent-mcp'),
    env: { TA_AGENT_DATA_DIR: getTaDataDir() },
  },
}

// 激活 TA 模式时合并配置
function activateTaMode(workspaceId: string) {
  const existingMcp = loadMcpConfig(workspaceId)
  const merged = { ...existingMcp, ...TA_MCP_CONFIG }
  saveMcpConfig(workspaceId, merged)
}
```

---

## 6. 打包与安装

### 6.1 开发模式

```bash
# 安装 ta-agent-mcp
cd ~/.tagent/ta-agent-mcp
pip install -e .

# TAgent 配置 mcp.json
{
  "ta-agent-mcp": {
    "command": "python",
    "args": ["-m", "ta_agent_mcp"]
  }
}
```

### 6.2 生产打包方案

**方案 A：用户自备 Python**

- 用户需自行安装 Python 3.11+ 和依赖
- TAgent 提供安装引导

**方案 B：内嵌 Python（PyInstaller）**

- 打包独立 exe/app
- 体积 +150MB
- 开箱即用

**方案 C：可选下载**

- TA MCP 作为独立插件包
- 用户在设置页一键下载安装

**推荐**：方案 C（可选下载）

---

## 7. 用户自定义工具

用户可创建自己的 MCP server：

```python
# user-custom-mcp/server.py
from mcp.server import Server

app = Server("user-custom-mcp")

@app.list_tools()
async def list_tools():
    return [
        {
            "name": "custom__my_tool",
            "description": "我的自定义工具",
            "inputSchema": { ... }
        }
    ]

@app.call_tool()
async def call_tool(name, arguments):
    # 用户实现
    ...
```

在 TAgent 中配置：

```json
{
  "user-custom-mcp": {
    "command": "python",
    "args": ["server.py"],
    "cwd": "~/.tagent/custom-tools/my-tool"
  }
}
```

---

## 8. 工作量估算

| 任务                  | 工时   |
| --------------------- | ------ |
| TS 内置工具（8 个）   | 2-3 天 |
| ta-agent-mcp 框架搭建 | 1 天   |
| mesh/texture 工具迁移 | 2-3 天 |
| 资产分析工具迁移      | 2-3 天 |
| Blender/UE5 集成      | 3-5 天 |
| 打包与安装流程        | 1-2 天 |
| 测试与文档            | 2 天   |

**总计**：~2-3 周
