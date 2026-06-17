# TA Agent MCP Server

Technical Artist (TA) 领域 MCP Server，为 TAgent 提供游戏资产分析和处理能力。

## 功能

- **网格分析** (`check_mesh_budget`) - 多边形预算检查
- **纹理分析** (`check_texture_info`) - 纹理信息检查
- **批量纹理处理** (`check_texture_batch`) - 批量纹理检查
- **资产识别** (`analyze_assets`) - AI 资产分类（支持 UE / Unity 工程）

## 安装

### TAgent 内（推荐）

TAgent 桌面端已集成一键安装：

1. 打开 TAgent → 切换到 TA 模式
2. 左下角 MCP Server 状态为红灯时，点击"一键安装"
3. 安装过程约 1-2 分钟，结束后红灯变黄
4. 点击"启用"完成配置

TAgent 会在用户机器上创建独立的 venv（`~/.tagent/ta/venv/`），不污染系统 Python。

### 手动安装

如果想直接安装到系统 Python：

```bash
pip install -e .
```

## 使用

TAgent 用户无需手动配置。手动使用者可在 MCP 配置中添加：

```json
{
  "ta-agent-mcp": {
    "command": "python",
    "args": ["-m", "ta_agent_mcp"]
  }
}
```

## 工具列表

| 工具名                        | 功能                                                    | 依赖    |
| ----------------------------- | ------------------------------------------------------- | ------- |
| `tagent__check_mesh_budget`   | 多边形预算检查                                          | trimesh |
| `tagent__check_texture_info`  | 纹理信息检查                                            | Pillow  |
| `tagent__check_texture_batch` | 批量纹理检查                                            | Pillow  |
| `tagent__analyze_assets`      | 资产分类分析（支持 .uasset / .umap / .prefab / .unity） | —       |

## 资产分类

`analyze_assets` 支持的资产类型：

- **通用**：`.fbx` / `.obj` / `.gltf` / `.glb` / `.blend` / `.max` / `.ma` / `.mb`
- **纹理**：`.png` / `.jpg` / `.tga` / `.bmp` / `.tif` / `.webp` / `.exr` / `.hdr` / `.psd`
- **材质**：`.mat` / `.mtl` / `.sbs` / `.sbsar`
- **动画**：`.anim` / `.fbx` / `.bip` / `.bvh`
- **音频**：`.wav` / `.mp3` / `.ogg` / `.aac` / `.flac`
- **脚本**：`.py` / `.lua` / `.cs` / `.cpp` / `.h` / `.hpp` / `.c` / `.cc`

### Unreal Engine 资产（按命名约定细分 .uasset）

- `BP_*` / `Blueprint_*` / `ABL_*` → blueprint
- `M_*` / `MI_*` / `Mat_*` → material
- `T_*` / `Tex_*` / `TC_*` → texture
- `SM_*` / `SK_*` / `SKM_*` / `SKT_*` → mesh
- `A_*` / `AM_*` / `L_*` → level
- `SFX_*` / `S_*` / `SN_*` / `US_*` → audio
- `P_*` → blueprint (Niagara / Cascade)
- `.umap` → level

### Unity 资产

- `.unity` / `.prefab` → level
- `.shader` → material

## 忽略目录

扫描时自动跳过构建产物目录：

- **Unreal**：`binaries/`、`intermediate/`、`saved/`、`deriveddatacache/`、`plugins/`
- **Unity**：`library/`、`temp/`、`obj/`、`logs/`、`memorycaptures/`
- **通用**：`node_modules/`、`.git/`、`.idea/`、`.vscode/`、`dist/`、`build/` 等

## 开发

```bash
# 安装开发依赖
pip install -e ".[dev]"

# 运行测试
pytest

# 代码检查
ruff check src/
```
