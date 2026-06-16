#!/bin/bash
# quick-start.sh - Linux 快速启动脚本

set -e

echo "========================================"
echo "  TAgent Linux 开发环境快速设置"
echo "========================================"
echo ""

# 检查是否在 Linux 上
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
  echo "警告：当前不是 Linux 系统（$OSTYPE）"
  echo "此脚本专为 Linux 设计，部分功能可能无法正常工作。"
  echo ""
fi

# 检测包管理器
if command -v apt-get &> /dev/null; then
  PKG_MANAGER="apt"
  INSTALL_CMD="sudo apt-get install -y"
elif command -v dnf &> /dev/null; then
  PKG_MANAGER="dnf"
  INSTALL_CMD="sudo dnf install -y"
elif command -v pacman &> /dev/null; then
  PKG_MANAGER="pacman"
  INSTALL_CMD="sudo pacman -S --noconfirm"
else
  PKG_MANAGER="unknown"
fi

echo "检测到包管理器: ${PKG_MANAGER:-未知}"
echo ""

# 检查必要的系统依赖
echo "检查系统依赖..."

MISSING_DEPS=()

# 检查 curl（用于下载 Bun）
if ! command -v curl &> /dev/null; then
  MISSING_DEPS+=("curl")
fi

# 检查 git
if ! command -v git &> /dev/null; then
  MISSING_DEPS+=("git")
fi

# 检查构建工具（better-sqlite3 等原生模块需要）
if ! command -v gcc &> /dev/null && ! command -v cc &> /dev/null; then
  case $PKG_MANAGER in
    apt) MISSING_DEPS+=("build-essential") ;;
    dnf) MISSING_DEPS+=("gcc" "make") ;;
    pacman) MISSING_DEPS+=("base-devel") ;;
  esac
fi

# 检查 Python（node-gyp 需要）
if ! command -v python3 &> /dev/null; then
  case $PKG_MANAGER in
    apt) MISSING_DEPS+=("python3") ;;
    dnf) MISSING_DEPS+=("python3") ;;
    pacman) MISSING_DEPS+=("python") ;;
  esac
fi

# Electron 运行需要的库
NEEDS_ELECTRON_DEPS=false
if [[ "$PKG_MANAGER" == "apt" ]]; then
  # 检查 Electron 是否能运行
  if ! ldconfig -p 2>/dev/null | grep -q "libgtk-3.so"; then
    NEEDS_ELECTRON_DEPS=true
  fi
fi

# 如果有缺失的依赖，提示安装
if [ ${#MISSING_DEPS[@]} -gt 0 ] || [ "$NEEDS_ELECTRON_DEPS" = true ]; then
  echo ""
  echo "⚠️  检测到缺少以下依赖："
  echo ""

  for dep in "${MISSING_DEPS[@]}"; do
    echo "  - $dep"
  done

  if [ "$NEEDS_ELECTRON_DEPS" = true ] && [ "$PKG_MANAGER" = "apt" ]; then
    echo "  - Electron 运行库 (libgtk-3-0, libnss3 等)"
  fi

  echo ""
  read -p "是否自动安装？[Y/n] " -n 1 -r
  echo ""

  if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
    echo ""
    echo "正在安装依赖..."

    case $PKG_MANAGER in
      apt)
        sudo apt-get update
        sudo apt-get install -y curl git build-essential python3
        # Electron 依赖
        sudo apt-get install -y libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6 xdg-utils libatspi2.0-0 libdrm2 libgbm1 libxcb-dri3-0 libasound2
        ;;
      dnf)
        sudo dnf install -y curl git gcc make python3
        sudo dnf install -y gtk3 libnotify nss libXScrnSaver libXtst xdg-utils at-spi2-atk libdrm mesa-gbm libxcb
        ;;
      pacman)
        sudo pacman -S --noconfirm curl git base-devel python
        sudo pacman -S --noconfirm gtk3 libnotify nss libxss libxtst xdg-utils at-spi2-atk libdrm mesa libxcb
        ;;
      *)
        echo "未知包管理器，请手动安装依赖"
        exit 1
        ;;
    esac

    echo "✅ 系统依赖安装完成"
  else
    echo "跳过依赖安装，继续设置..."
  fi
else
  echo "✅ 系统依赖检查通过"
fi

echo ""

# 检查 Bun 是否安装
if ! command -v bun &> /dev/null; then
  echo "正在安装 Bun..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"

  # 添加到 shell 配置
  if [ -f "$HOME/.bashrc" ]; then
    echo 'export PATH="$HOME/.bun/bin:$PATH"' >> "$HOME/.bashrc"
  fi
  if [ -f "$HOME/.zshrc" ]; then
    echo 'export PATH="$HOME/.bun/bin:$PATH"' >> "$HOME/.zshrc"
  fi
fi

echo "Bun 版本: $(bun --version)"
echo ""

# 创建符号链接
if [ -f "./setup-symlinks.sh" ]; then
  chmod +x ./setup-symlinks.sh
  ./setup-symlinks.sh
else
  echo "错误：找不到 setup-symlinks.sh"
  exit 1
fi

echo ""
echo "正在安装 Node.js 依赖..."
bun install

echo ""
echo "========================================"
echo "  ✅ 设置完成！"
echo "========================================"
echo ""
echo "启动开发模式："
echo "  bun run dev"
echo ""
echo "构建生产版本："
echo "  bun run build"
echo ""
echo "打包安装程序："
echo "  bun run dist:appimage  # AppImage 格式"
echo "  bun run dist:deb       # deb 格式（Ubuntu/Debian）"
echo ""
