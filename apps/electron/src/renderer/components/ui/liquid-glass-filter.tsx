/**
 * LiquidGlassFilter - SVG 滤镜定义 + JS 动态生成 displacement map
 *
 * 真正的液态玻璃效果核心：
 * 1. feDisplacementMap - 基于位移贴图扭曲背景
 * 2. RGB 通道分离位移 - 产生色差效果
 * 3. 边缘遮罩 - 只在面板边缘显示折射
 * 4. backdrop-filter: url(#liquid-glass-filter) - 应用滤镜
 */

import * as React from 'react'

// 生成 displacement map（Canvas 动态生成）
function generateDisplacementMap(
  width: number,
  height: number,
  aberrationIntensity: number
): string {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  const imageData = ctx.createImageData(width, height)
  const data = imageData.data

  // 生成边缘增强的噪声位移贴图
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4

      // 计算到边缘的距离（归一化 0-1）
      const edgeX = Math.min(x, width - x) / (width * 0.5)
      const edgeY = Math.min(y, height - y) / (height * 0.5)
      const edgeDist = Math.min(edgeX, edgeY)

      // 边缘强度：距离边缘越近，强度越高
      const edgeIntensity = Math.pow(1 - edgeDist, 2)

      // Perlin-like 噪声模拟（简化版）
      const noise = Math.sin(x * 0.02) * Math.cos(y * 0.03) * 0.5 +
                    Math.sin(x * 0.05 + y * 0.03) * 0.3 +
                    Math.cos(y * 0.07 - x * 0.02) * 0.2

      // R 通道：水平位移（红色位移）
      const displacementR = (noise * 0.5 + 0.5) * edgeIntensity * aberrationIntensity
      // B 通道：垂直位移（蓝色位移）
      const displacementB = (noise * 0.3 + 0.6) * edgeIntensity * aberrationIntensity * 0.8
      // G 通道：备用（用于边缘遮罩）
      const displacementG = edgeIntensity

      data[i] = Math.floor(displacementR * 255)     // R
      data[i + 1] = Math.floor(displacementG * 255) // G
      data[i + 2] = Math.floor(displacementB * 255) // B
      data[i + 3] = 255                              // A
    }
  }

  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/png')
}

export interface LiquidGlassFilterProps {
  /** 滤镜 ID（用于 CSS backdrop-filter: url(#id)） */
  id?: string
  /** 位移强度（像素） */
  displacementScale?: number
  /** 色差强度（0-1） */
  aberrationIntensity?: number
  /** 贴图尺寸 */
  mapWidth?: number
  mapHeight?: number
}

/**
 * SVG 滤镜定义组件
 * 放置在 DOM 顶层，供全局 CSS 引用
 */
export function LiquidGlassFilter({
  id = 'liquid-glass-filter',
  displacementScale = 12,
  aberrationIntensity = 0.4,
  mapWidth = 256,
  mapHeight = 256,
}: LiquidGlassFilterProps): React.ReactElement {
  const [displacementMap, setDisplacementMap] = React.useState<string>('')

  // 初始化时生成位移贴图
  React.useEffect(() => {
    const map = generateDisplacementMap(mapWidth, mapHeight, aberrationIntensity)
    setDisplacementMap(map)
  }, [mapWidth, mapHeight, aberrationIntensity])

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
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
          colorInterpolationFilters="sRGB"
        >
          {/* 1. 加载位移贴图 */}
          <feImage
            href={displacementMap}
            result="DISPLACEMENT_MAP"
            preserveAspectRatio="none"
          />

          {/* 2. 从位移贴图提取边缘遮罩（G 通道） */}
          <feColorMatrix
            in="DISPLACEMENT_MAP"
            type="matrix"
            values="
              0 0 0 0 0
              0 1 0 0 0
              0 0 0 0 0
              0 0 0 1 0
            "
            result="EDGE_MASK_RAW"
          />

          {/* 3. 边缘遮罩二值化：边缘区域=1，中心区域=0 */}
          <feComponentTransfer in="EDGE_MASK_RAW" result="EDGE_MASK">
            <feFuncA type="discrete" tableValues="0 0 1" />
          </feComponentTransfer>

          {/* 4. R 通道位移（红色通道 - 最大位移） */}
          <feDisplacementMap
            in="SourceGraphic"
            in2="DISPLACEMENT_MAP"
            scale={displacementScale}
            xChannelSelector="R"
            yChannelSelector="B"
            result="RED_DISPLACED"
          />

          {/* 5. G 通道位移（绿色通道 - 中等位移） */}
          <feDisplacementMap
            in="SourceGraphic"
            in2="DISPLACEMENT_MAP"
            scale={displacementScale - aberrationIntensity * 8}
            xChannelSelector="R"
            yChannelSelector="B"
            result="GREEN_DISPLACED"
          />

          {/* 6. B 通道位移（蓝色通道 - 最小位移） */}
          <feDisplacementMap
            in="SourceGraphic"
            in2="DISPLACEMENT_MAP"
            scale={displacementScale - aberrationIntensity * 16}
            xChannelSelector="R"
            yChannelSelector="B"
            result="BLUE_DISPLACED"
          />

          {/* 7. 合并 RGB 三层（使用 screen 混合模式） */}
          <feBlend
            in="RED_DISPLACED"
            in2="GREEN_DISPLACED"
            mode="screen"
            result="RG_BLEND"
          />
          <feBlend
            in="RG_BLEND"
            in2="BLUE_DISPLACED"
            mode="screen"
            result="RGB_BLEND"
          />

          {/* 8. 应用边缘遮罩：只保留边缘区域的折射效果 */}
          <feComposite
            in="RGB_BLEND"
            in2="EDGE_MASK"
            operator="in"
            result="EDGE_REFRACTION"
          />

          {/* 9. 边缘折射与原图混合 */}
          <feBlend
            in="SourceGraphic"
            in2="EDGE_REFRACTION"
            mode="screen"
          />
        </filter>
      </defs>
    </svg>
  )
}

/**
 * 简化版液态玻璃滤镜
 * 使用更少的滤镜原语，性能更好
 */
export function LiquidGlassFilterSimple({
  id = 'liquid-glass-simple',
  displacementScale = 8,
  aberrationIntensity = 0.3,
}: LiquidGlassFilterProps): React.ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
      aria-hidden="true"
    >
      <defs>
        <filter
          id={id}
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
          colorInterpolationFilters="sRGB"
        >
          {/* 使用 feTurbulence 生成程序化噪声 */}
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.015"
            numOctaves="2"
            seed="5"
            result="NOISE"
          />

          {/* 将噪声映射为位移 */}
          <feDisplacementMap
            in="SourceGraphic"
            in2="NOISE"
            scale={displacementScale}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  )
}
