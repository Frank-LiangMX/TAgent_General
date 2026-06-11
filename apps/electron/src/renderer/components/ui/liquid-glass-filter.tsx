/**
 * LiquidGlassFilter - SVG 滤镜定义 + SDF 位移贴图
 *
 * 参考 shuding/liquid-glass 的实现：
 * 1. roundedRectSDF - 有向距离场计算边缘距离
 * 2. smoothStep - 平滑过渡函数
 * 3. 边缘增强位移 - 边缘位移最大，中心位移为 0
 * 4. feDisplacementMap - SVG 滤镜应用位移
 */

import * as React from 'react'

// ===== 数学工具函数 =====

/**
 * 平滑阶梯函数（Hermite 插值）
 * 在 a-b 区间内产生平滑的 0-1 过渡
 */
function smoothStep(a: number, b: number, t: number): number {
  t = Math.max(0, Math.min(1, (t - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * 计算到圆角矩形边缘的有向距离
 * 返回值 < 0 表示在内部，> 0 表示在外部
 *
 * @param x 当前点 x（相对于中心，归一化）
 * @param y 当前点 y（相对于中心，归一化）
 * @param width 半宽度（归一化）
 * @param height 半高度（归一化）
 * @param radius 圆角半径（归一化）
 */
function roundedRectSDF(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): number {
  const qx = Math.abs(x) - width + radius
  const qy = Math.abs(y) - height + radius
  return Math.min(Math.max(qx, qy), 0) + Math.sqrt(Math.max(qx, 0) ** 2 + Math.max(qy, 0) ** 2) - radius
}

/**
 * 生成液态玻璃位移贴图（基于 SDF）
 */
function generateDisplacementMap(
  width: number,
  height: number,
  edgeThickness: number = 0.15,
  displacementStrength: number = 0.3
): string {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  const imageData = ctx.createImageData(width, height)
  const data = imageData.data

  // 面板尺寸参数（归一化）
  const halfWidth = 0.3   // 半宽度 = 30% 归一化
  const halfHeight = 0.2  // 半高度 = 20% 归一化
  const cornerRadius = 0.08 // 圆角半径

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const i = (py * width + px) * 4

      // UV 坐标（归一化到 -0.5 ~ 0.5）
      const uvx = (px / width) - 0.5
      const uvy = (py / height) - 0.5

      // 计算到边缘的有向距离
      const dist = roundedRectSDF(uvx, uvy, halfWidth, halfHeight, cornerRadius)

      // 边缘位移强度（边缘=1，中心=0）
      const displacement = smoothStep(0.5, 0, dist + edgeThickness)
      const scaled = smoothStep(0, 1, displacement)

      // 应用位移（向边缘方向缩放）
      const dx = uvx * scaled
      const dy = uvy * scaled

      // 转换为位移贴图格式
      // R = X 位移（归一化到 0-255）
      // G = Y 位移（归一化到 0-255）
      // 中值 127.5 表示无位移
      const r = (dx * displacementStrength + 0.5) * 255
      const g = (dy * displacementStrength + 0.5) * 255

      data[i] = Math.floor(Math.max(0, Math.min(255, r)))     // R: X 位移
      data[i + 1] = Math.floor(Math.max(0, Math.min(255, g))) // G: Y 位移
      data[i + 2] = 0                                          // B: 不使用
      data[i + 3] = 255                                        // A: 固定
    }
  }

  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/png')
}

export interface LiquidGlassFilterProps {
  /** 滤镜 ID */
  id?: string
  /** 位移强度（像素） */
  displacementScale?: number
  /** 边缘厚度（0-1） */
  edgeThickness?: number
  /** 位移强度系数（0-1） */
  displacementStrength?: number
  /** 贴图尺寸 */
  mapWidth?: number
  mapHeight?: number
}

/**
 * SVG 滤镜组件
 */
export function LiquidGlassFilter({
  id = 'liquid-glass-filter',
  displacementScale = 15,
  edgeThickness = 0.15,
  displacementStrength = 0.3,
  mapWidth = 256,
  mapHeight = 256,
}: LiquidGlassFilterProps): React.ReactElement {
  const [displacementMap, setDisplacementMap] = React.useState<string>('')

  React.useEffect(() => {
    const map = generateDisplacementMap(mapWidth, mapHeight, edgeThickness, displacementStrength)
    setDisplacementMap(map)
  }, [mapWidth, mapHeight, edgeThickness, displacementStrength])

  if (!displacementMap) return <></>

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
      aria-hidden="true"
    >
      <defs>
        <filter
          id={id}
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
          x="0"
          y="0"
          width="100%"
          height="100%"
        >
          {/* 位移贴图 */}
          <feImage
            href={displacementMap}
            result="DISPLACEMENT_MAP"
            preserveAspectRatio="none"
          />

          {/* 应用位移 */}
          <feDisplacementMap
            in="SourceGraphic"
            in2="DISPLACEMENT_MAP"
            scale={displacementScale}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  )
}

/**
 * BTW 面板专用滤镜（更大的位移）
 */
export function LiquidGlassFilterBtw({
  id = 'liquid-glass-btw',
}: Omit<LiquidGlassFilterProps, 'id'>): React.ReactElement {
  return (
    <LiquidGlassFilter
      id={id}
      displacementScale={20}
      edgeThickness={0.12}
      displacementStrength={0.35}
      mapWidth={360}
      mapHeight={280}
    />
  )
}