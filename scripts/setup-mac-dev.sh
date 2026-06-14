#!/usr/bin/env bash
# Mac 本地开发环境一键初始化（国内网络友好）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Bun
if ! command -v bun >/dev/null 2>&1; then
  echo "未检测到 Bun，正在从 npmmirror 安装到 ~/.bun/bin ..."
  mkdir -p "$HOME/.bun/bin" /tmp/bun-oven
  curl --http1.1 -fsSL "https://registry.npmmirror.com/@oven/bun-darwin-aarch64/-/bun-darwin-aarch64-1.3.14.tgz" \
    -o /tmp/bun-oven/pkg.tgz
  tar -xzf /tmp/bun-oven/pkg.tgz -C /tmp/bun-oven
  cp /tmp/bun-oven/package/bin/bun "$HOME/.bun/bin/bun"
  chmod +x "$HOME/.bun/bin/bun"
  ln -sf "$HOME/.bun/bin/bun" "$HOME/.bun/bin/bunx"
fi

# @oven 分包不含 bunx，dev 脚本依赖 bunx electronmon
if [[ ! -x "$HOME/.bun/bin/bunx" ]]; then
  ln -sf "$HOME/.bun/bin/bun" "$HOME/.bun/bin/bunx"
fi

export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"

if ! grep -q 'BUN_INSTALL' "$HOME/.zshrc" 2>/dev/null; then
  printf '\n# Bun (TAgent)\nexport BUN_INSTALL="$HOME/.bun"\nexport PATH="$BUN_INSTALL/bin:$PATH"\n' >> "$HOME/.zshrc"
  echo "已写入 ~/.zshrc PATH"
fi

echo "Bun: $(bun --version)"

# 依赖（.npmrc 已配置 npmmirror）
bun install

# Electron 二进制（若 postinstall 未拉取）
if [[ ! -f node_modules/electron/dist/Electron.app/Contents/MacOS/Electron ]]; then
  echo "正在下载 Electron 二进制 ..."
  export ELECTRON_MIRROR="${ELECTRON_MIRROR:-https://npmmirror.com/mirrors/electron/}"
  bun node node_modules/electron/install.js
fi

echo "类型检查 ..."
bun run typecheck

echo ""
echo "完成。启动: bun run dev  或  bun run dev-start"
echo "停止: bun run dev-stop"
