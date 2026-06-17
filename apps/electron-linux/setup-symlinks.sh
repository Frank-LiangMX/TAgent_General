#!/bin/bash
# setup-symlinks.sh - 创建符号链接共享源代码和资源
#
# 用法（在 apps/electron-linux/ 目录下执行）：
#   ./setup-symlinks.sh
#
# 必须先执行此脚本，再运行 bun install / bun run build / bun run dev。
# 在 CI 中由 .github/workflows/release.yml 的 "Setup Linux symlinks" 步骤调用。

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ELECTRON_DIR="$SCRIPT_DIR/../electron"

# 防御性检查：主工程目录必须存在
if [ ! -d "$ELECTRON_DIR/src" ]; then
  echo "错误：主工程目录不存在: $ELECTRON_DIR/src"
  exit 1
fi

echo "创建符号链接..."

# 源代码目录
if [ ! -e "$SCRIPT_DIR/src" ]; then
  ln -sf "$ELECTRON_DIR/src" "$SCRIPT_DIR/src"
  echo "✓ 链接 src/ 目录"
fi

# 资源目录
if [ ! -e "$SCRIPT_DIR/resources" ]; then
  ln -sf "$ELECTRON_DIR/resources" "$SCRIPT_DIR/resources"
  echo "✓ 链接 resources/ 目录"
fi

# 默认 Skills
if [ ! -e "$SCRIPT_DIR/default-skills" ]; then
  ln -sf "$ELECTRON_DIR/default-skills" "$SCRIPT_DIR/default-skills"
  echo "✓ 链接 default-skills/ 目录"
fi

# TA MCP wheels（如果存在）
if [ -d "$ELECTRON_DIR/ta-agent-mcp-wheels" ] && [ ! -e "$SCRIPT_DIR/ta-agent-mcp-wheels" ]; then
  ln -sf "$ELECTRON_DIR/ta-agent-mcp-wheels" "$SCRIPT_DIR/ta-agent-mcp-wheels"
  echo "✓ 链接 ta-agent-mcp-wheels/ 目录"
fi

# scripts 目录（开发工具）
if [ ! -e "$SCRIPT_DIR/scripts" ]; then
  ln -sf "$ELECTRON_DIR/scripts" "$SCRIPT_DIR/scripts"
  echo "✓ 链接 scripts/ 目录"
fi

echo ""
echo "符号链接创建完成！"
echo ""
echo "接下来请运行："
echo "  bun install    # 安装依赖"
echo "  bun run dev    # 启动开发模式"
