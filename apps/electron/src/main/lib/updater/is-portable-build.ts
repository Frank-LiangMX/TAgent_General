/**
 * 检测当前是否为 electron-builder Windows portable 构建。
 *
 * portable 包装器会设置 PORTABLE_EXECUTABLE_DIR（以及 FILE / APP_FILENAME）。
 * NSIS 安装版与开发模式均无此环境变量。
 */
export function isPortableBuild(): boolean {
  return Boolean(process.env.PORTABLE_EXECUTABLE_DIR)
}
