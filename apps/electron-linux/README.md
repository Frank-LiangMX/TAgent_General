# TAgent Linux 开发工程

这是一个独立的 Linux 开发工程目录，用于在 Linux 系统上直接运行 TAgent。

## 目录结构

```
electron-linux/
├── src/                  # 源代码（符号链接 → ../electron/src）
├── resources/            # 资源文件（符号链接 → ../electron/resources）
├── default-skills/       # 默认 Skills（符号链接 → ../electron/default-skills）
├── scripts/              # 开发脚本（符号链接 → ../electron/scripts）
├── package.json          # Linux 专用依赖配置
├── electron-builder.yml  # Linux 打包配置
├── vite.config.ts        # Vite 配置
├── tsconfig.json         # TypeScript 配置
├── setup-symlinks.sh     # 创建符号链接脚本
├── quick-start.sh        # 快速启动脚本
└── README.md             # 本文件
```

## 快速开始

### 方法一：使用快速启动脚本（推荐）

```bash
# 赋予执行权限并运行
chmod +x quick-start.sh
./quick-start.sh
```

### 方法二：手动步骤

```bash
# 1. 创建符号链接
chmod +x setup-symlinks.sh
./setup-symlinks.sh

# 2. 安装依赖
bun install

# 3. 启动开发模式
bun run dev
```

## 可用命令

| 命令                    | 说明                      |
| ----------------------- | ------------------------- |
| `bun run dev`           | 启动开发模式（热重载）    |
| `bun run build`         | 构建生产版本              |
| `bun run start`         | 构建并运行生产版本        |
| `bun run dist:appimage` | 打包 AppImage（推荐）     |
| `bun run dist:deb`      | 打包 deb（Ubuntu/Debian） |
| `bun run dist:rpm`      | 打包 rpm（Fedora/RHEL）   |
| `bun run dist:linux`    | 打包所有 Linux 格式       |

## 打包产物

- **AppImage** - 推荐格式，跨发行版兼容，无需安装
- **deb** - Debian/Ubuntu 系列安装包
- **tar.gz** - 便携式压缩包

## 依赖说明

### 核心依赖

- **Electron** 39.5.1 - 桌面应用框架
- **Claude Agent SDK** 0.3.153 - AI Agent 能力
- **Bun** 1.0+ - JavaScript 运行时

### Linux SDK

- `@anthropic-ai/claude-agent-sdk-linux-x64` - x64 架构
- `@anthropic-ai/claude-agent-sdk-linux-arm64` - ARM64 架构

### 系统依赖（deb 包需要）

```bash
# Ubuntu/Debian
sudo apt install libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6 xdg-utils libatspi2.0-0 libdrm2 libgbm1 libxcb-dri3-0
```

## 与主工程的关系

| 项目     | 关系                                      |
| -------- | ----------------------------------------- |
| 源代码   | 符号链接共享 `../electron/src`            |
| 资源文件 | 符号链接共享 `../electron/resources`      |
| Skills   | 符号链接共享 `../electron/default-skills` |
| 依赖配置 | 独立 `package.json`，包含 Linux SDK       |
| 打包配置 | 独立 `electron-builder.yml`，仅 Linux     |

## 注意事项

1. **符号链接** - 必须先运行 `setup-symlinks.sh` 创建符号链接
2. **原生模块** - `better-sqlite3` 会在 `bun install` 时自动编译
3. **平台特定功能** - 部分 macOS/Windows 特有功能在 Linux 上不可用：
   - Dock 图标/徽章
   - WSL 检测
   - 微信/钉钉桥接（可能不支持）
4. **测试** - 建议在真实 Linux 环境测试所有功能

## 故障排除

### 符号链接失效

```bash
rm -f src resources default-skills scripts ta-agent-mcp-wheels
./setup-symlinks.sh
```

### 原生模块编译失败

```bash
# 确保有编译工具链
sudo apt install build-essential python3

# 重新安装
rm -rf node_modules bun.lock
bun install
```

### Electron 启动失败

```bash
# 检查系统依赖
sudo apt install libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6 xdg-utils
```

## 开发提示

- 修改源代码后无需重新构建，开发模式会自动热重载
- 如需修改打包配置，编辑 `electron-builder.yml`
- 如需添加新依赖，编辑 `package.json` 后运行 `bun install`
