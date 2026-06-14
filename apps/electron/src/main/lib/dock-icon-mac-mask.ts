/** Apple 图标外轮廓 superellipse 近似指数 */
export const MAC_SQUIRCLE_EXPONENT = 4.8

/** Dock 输出画布（与 macOS 图标网格一致） */
export const MAC_DOCK_CANVAS_SIZE = 1024

/**
 * 内容缩放：系统图标在 squircle 内留有安全边距，满幅图会显得更大。
 * 仅用于 Dock 运行时合成，不修改源 PNG。
 */
export const MAC_DOCK_CONTENT_SCALE = 0.85

export function isInsideMacSquircle(x: number, y: number, width: number, height: number): boolean {
  const denomX = width > 1 ? width - 1 : 1
  const denomY = height > 1 ? height - 1 : 1
  const nx = Math.abs((2 * x) / denomX - 1)
  const ny = Math.abs((2 * y) / denomY - 1)
  return nx ** MAC_SQUIRCLE_EXPONENT + ny ** MAC_SQUIRCLE_EXPONENT <= 1
}

/** 对 BGRA 位图应用 squircle alpha 蒙版（区外透明） */
export function applyMacSquircleMaskToBitmap(bitmap: Buffer, width: number, height: number): Buffer {
  const out = Buffer.from(bitmap)
  const pixelCount = width * height
  if (out.length < pixelCount * 4) {
    return out
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isInsideMacSquircle(x, y, width, height)) {
        const alphaIndex = (y * width + x) * 4 + 3
        out[alphaIndex] = 0
      }
    }
  }
  return out
}

/** 将较小位图居中贴到透明画布（BGRA） */
export function blitCenteredOnCanvas(
  patchBitmap: Buffer,
  patchWidth: number,
  patchHeight: number,
  canvasSize: number,
): Buffer {
  const canvas = Buffer.alloc(canvasSize * canvasSize * 4, 0)
  const offsetX = Math.floor((canvasSize - patchWidth) / 2)
  const offsetY = Math.floor((canvasSize - patchHeight) / 2)

  for (let y = 0; y < patchHeight; y++) {
    for (let x = 0; x < patchWidth; x++) {
      const srcIndex = (y * patchWidth + x) * 4
      const dstX = x + offsetX
      const dstY = y + offsetY
      const dstIndex = (dstY * canvasSize + dstX) * 4
      canvas[dstIndex] = patchBitmap[srcIndex] ?? 0
      canvas[dstIndex + 1] = patchBitmap[srcIndex + 1] ?? 0
      canvas[dstIndex + 2] = patchBitmap[srcIndex + 2] ?? 0
      canvas[dstIndex + 3] = patchBitmap[srcIndex + 3] ?? 0
    }
  }

  return canvas
}
