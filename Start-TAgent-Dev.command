#!/bin/bash
# 双击启动 TAgent 开发环境（macOS Terminal）
set -euo pipefail

TAGENT_ROOT="$(cd "$(dirname "$0")" && pwd)"
source "$TAGENT_ROOT/scripts/dev-launcher-env.sh"
tagent_ensure_bun || exit 1

echo "========================================"
echo "  TAgent 开发模式"
echo "  目录: $TAGENT_ROOT"
echo "  停止: 双击 Stop-TAgent-Dev.command"
echo "========================================"
echo ""

exec bun run dev-start
