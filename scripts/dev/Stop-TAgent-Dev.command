#!/bin/bash
# 双击停止 TAgent 开发环境（macOS Terminal）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TAGENT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$TAGENT_ROOT/scripts/dev-launcher-env.sh"
tagent_ensure_bun || exit 1

echo "正在停止 TAgent 开发进程..."
bun run dev-stop
echo ""
echo "已停止。"
read -r -p "按回车关闭窗口..."
