/** Windows NSIS 向导式安装包（oneClick: false）不支持静默 /S 安装 */
export function shouldUseSilentInstall(): boolean {
  return process.platform !== 'win32'
}
