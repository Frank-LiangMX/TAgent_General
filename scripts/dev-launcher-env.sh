# TAgent 开发启动器共用环境（供 .command 脚本 source）
# shellcheck shell=bash

tagent_find_repo_root() {
  local dir="$1"
  while [[ "$dir" != "/" ]]; do
    if [[ -f "$dir/package.json" ]] && grep -q '"name": "tagent"' "$dir/package.json" 2>/dev/null; then
      printf '%s' "$dir"
      return 0
    fi
    dir="$(dirname "$dir")"
  done
  return 1
}

tagent_dev_root() {
  local i=1
  local src=""
  while [[ -n "${BASH_SOURCE[$i]:-}" ]]; do
    src="${BASH_SOURCE[$i]}"
    if [[ "$src" != *dev-launcher-env.sh ]]; then
      break
    fi
    i=$((i + 1))
  done
  if [[ -z "$src" ]]; then
    src="${BASH_SOURCE[0]}"
  fi
  local start
  start="$(cd "$(dirname "$src")" && pwd)"
  tagent_find_repo_root "$start"
}

tagent_setup_dev_env() {
  if [[ -z "${TAGENT_ROOT:-}" ]]; then
    TAGENT_ROOT="$(tagent_dev_root)"
  fi
  if [[ -z "$TAGENT_ROOT" ]]; then
    echo "无法定位 TAgent 仓库根目录。"
    return 1
  fi
  cd "$TAGENT_ROOT"

  export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  export PATH="$BUN_INSTALL/bin:$PATH"

  unset ELECTRON_RUN_AS_NODE

  if [[ ! -x "$BUN_INSTALL/bin/bunx" ]] && [[ -x "$BUN_INSTALL/bin/bun" ]]; then
    ln -sf "$BUN_INSTALL/bin/bun" "$BUN_INSTALL/bin/bunx" 2>/dev/null || true
  fi
  return 0
}

tagent_ensure_bun() {
  tagent_setup_dev_env || return 1
  if command -v bun >/dev/null 2>&1; then
    return 0
  fi
  echo "未找到 Bun。请先在本机终端执行："
  echo "  cd \"$TAGENT_ROOT\" && ./scripts/setup-mac-dev.sh"
  echo ""
  read -r -p "按回车关闭窗口..."
  return 1
}
