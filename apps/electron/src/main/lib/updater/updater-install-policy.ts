/**
 * 是否使用静默安装。
 *
 * 所有平台统一静默：electron-updater 会传 /S 给 NSIS，
 * 即使 oneClick: false，/S 标志也会跳过向导直接安装。
 * 用户无需手动交互，退出后自动替换。
 */
export function shouldUseSilentInstall(): boolean {
  return true
}
