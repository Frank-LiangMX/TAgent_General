# ta_agent 工具分类分析

> 生成时间：2026-06-07
> 目的：评估哪些工具适合 MCP 实现，哪些可以 TS 内置

---

## 工具分类总览

ta_agent 共 ~50 个工具，按实现方式分为 4 类：

| 类别 | 数量 | 说明 |
|------|------|------|
| **TS 内置** | ~8 | 纯逻辑，无 Python 依赖 |
| **MCP 必需** | ~20 | 需要 Python 库（trimesh、PIL、numpy）|
| **引擎扩展** | ~9 | UE5/Blender 集成 |
| **MCP 管理** | ~6 | 动态 MCP server 管理 |

---

## 1. TS 内置工具（可直接用 TypeScript 实现）

| 工具 | 功能 | Python 依赖 |
|------|------|-------------|
| `check_naming` | 命名规范检查 | 无 |
| `suggest_naming` | 命名建议 | 无 |
| `check_directory_structure` | 目录结构检查 | 无 |
| `scan_directory` | 目录扫描 | 无（可用 Node.js fs）|
| `check_file_info` | 文件信息检查 | 无（可用 Node.js fs）|
| `discover_conventions` | 发现项目规范 | 无 |
| `load_conventions` | 加载规范配置 | 无 |
| `check_project_config` | 检查项目配置 | 无 |

**实现成本**：低，可直接用 Bun/Node.js API

---

## 2. MCP 必需工具（需要 Python 库）

### 2.1 网格/模型分析

| 工具 | 功能 | Python 依赖 |
|------|------|-------------|
| `check_mesh_budget` | 多边形预算检查 | trimesh, numpy |
| `check_fbx_info` | FBX 信息检查 | trimesh, fbx |
| `check_blender` | Blender 检查 | bpy (Blender Python) |

### 2.2 纹理分析

| 工具 | 功能 | Python 依赖 |
|------|------|-------------|
| `check_texture_info` | 纹理信息检查 | PIL/Pillow |
| `check_texture_batch` | 批量纹理检查 | PIL/Pillow |

### 2.3 资产识别与分析

| 工具 | 功能 | Python 依赖 |
|------|------|-------------|
| `analyze_assets` | 资产分析（ML）| 本地模型 |
| `run_ai_inference` | AI 推理 | onnxruntime 等 |
| `search_assets` | 资产搜索 | SQLite（可用 better-sqlite3）|
| `get_asset_detail` | 资产详情 | SQLite |
| `list_assets` | 资产列表 | SQLite |

### 2.4 渲染与预览

| 工具 | 功能 | Python 依赖 |
|------|------|-------------|
| `render_asset_preview` | 资产预览渲染 | Blender Python |

### 2.5 报告生成

| 工具 | 功能 | Python 依赖 |
|------|------|-------------|
| `generate_report` | 生成报告 | 可用 TS 实现 |

---

## 3. 引擎扩展工具

### 3.1 UE5 集成（9 个工具）

| 工具 | 功能 |
|------|------|
| `ue5_execute_python` | 执行 UE5 Python |
| `ue5_get_actors` | 获取 Actor 列表 |
| `ue5_import_asset` | 导入资产 |
| `ue5_set_property` | 设置属性 |
| `ue5_screenshot` | 截图 |
| ... | |

**实现方式**：通过 UE5 Python API 或 TCP Socket 通信

### 3.2 Blender 集成

已有 [blender-mcp](https://github.com/ahujasid/blender-mcp) 可参考

---

## 4. MCP 管理工具（已有方案）

| 工具 | 功能 |
|------|------|
| `mcp_list_servers` | 列出 MCP servers |
| `mcp_add_server` | 添加 server |
| `mcp_remove_server` | 移除 server |
| `mcp_toggle_server` | 启用/禁用 |
| `mcp_reload_servers` | 重载配置 |
| `mcp_test_connection` | 测试连接 |

**实现方式**：TAgent 已有 MCP 管理界面，可直接复用

---

## 5. 实施优先级

### P0：MVP 必需

| 优先级 | 工具 | 实现方式 |
|--------|------|----------|
| 🔴 P0 | `check_naming` | TS 内置 |
| 🔴 P0 | `scan_directory` | TS 内置 |
| 🔴 P0 | `search_assets` | TS + SQLite |
| 🟡 P1 | `check_mesh_budget` | MCP (trimesh) |
| 🟡 P1 | `check_texture_info` | MCP (PIL) |

### P1：核心 TA 功能

| 优先级 | 工具 | 实现方式 |
|--------|------|----------|
| 🟡 P1 | `analyze_assets` | MCP (ML) |
| 🟡 P1 | `render_preview` | MCP (Blender) |

### P2：引擎集成

| 优先级 | 工具 | 实现方式 |
|--------|------|----------|
| 🟢 P2 | UE5 工具集 | MCP + UE5 Python |
| 🟢 P2 | Blender 工具 | blender-mcp |

---

## 6. 技术决策

### TS 内置 vs MCP 边界

```
TS 内置：
- 无外部依赖
- 纯文件/字符串操作
- Node.js 原生能力可覆盖

MCP：
- 需要 Python 科学计算库
- 需要外部引擎（UE5/Blender）
- 用户可能需要自定义扩展
```

### 打包策略

| 方案 | 优点 | 缺点 |
|------|------|------|
| **A. 用户自备 Python** | 打包体积小 | 用户需安装 Python |
| **B. 内嵌 Python** | 开箱即用 | 体积 +200MB |
| **C. 独立下载包** | 可选安装 | 需要下载器 |

**推荐**：方案 C — TA MCP 作为可选插件包，用户按需下载
