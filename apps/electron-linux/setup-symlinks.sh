#!/bin/bash
# setup-symlinks.sh - 创建符号链接共享源代码和资源

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ELECTRON_DIR="$SCRIPT_DIR/../electron"

echo "创建符号链接..."

# 源代码目录
if [ ! -L "$SCRIPT_DIR/src" ]; then
  ln -sf "$ELECTRON_DIR/src" "$SCRIPT_DIR/src"
  echo "✓ 链接 src/ 目录"
fi

# 资源目录
if [ ! -L "$SCRIPT_DIR/resources" ]; then
  ln -sf "$ELECTRON_DIR/resources" "$SCRIPT_DIR/resources"
  echo "✓ 链接 resources/ 目录"
fi

# 默认 Skills
if [ ! -L "$SCRIPT_DIR/default-skills" ]; then
  ln -sf "$ELECTRON_DIR/default-skills" "$SCRIPT_DIR/default-skills"
  echo "✓ 链接 default-skills/ 目录"
fi

# TA MCP wheels（如果存在）
if [ -d "$ELECTRON_DIR/ta-agent-mcp-wheels" ] && [ ! -L "$SCRIPT_DIR/ta-agent-mcp-wheels" ]; then
  ln -sf "$ELECTRON_DIR/ta-agent-mcp-wheels" "$SCRIPT_DIR/ta-agent-mcp-wheels"
  echo "✓ 链接 ta-agent-mcp-wheels/ 目录"
fi

# scripts 目录（开发工具）
if [ ! -L "$SCRIPT_DIR/scripts" ]; then
  ln -sf "$ELECTRON_DIR/scripts" "$SCRIPT_DIR/scripts"
  echo "✓ 链接 scripts/ 目录"
fi

echo ""
echo "符号链接创建完成！"
echo ""
echo "接下来请运行："
echo "  bun install    # 安装依赖"
echo "  bun run dev    # 启动开发模式"
