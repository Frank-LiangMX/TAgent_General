# Liquid Glass Demo

Apple风格的玻璃效果UI演示，参考了 [liquid-glass-react](https://github.com/rdev/liquid-glass-react) 库的实现。

## 功能特性

- **动态模糊折射**：背景模糊和饱和度调整
- **边缘色差效果**：基于SVG滤镜的色差（Chromatic Aberration）
- **弹性交互效果**：鼠标跟踪和弹性缩放
- **动态高光**：根据鼠标位置实时调整高光方向
- **位移效果**：模拟玻璃的折射扭曲
- **响应式设计**：支持各种屏幕尺寸

## 技术实现

### 核心CSS技术
1. **backdrop-filter**：实现背景模糊和饱和度调整
2. **多层叠加**：模糊层 + 雾面层 + 高光层
3. **CSS动画**：浮动动画和过渡效果

### SVG滤镜
- 使用 `feDisplacementMap` 实现位移效果
- 使用 `feColorMatrix` 实现RGB通道分离
- 使用 `feBlend` 混合色差效果

### JavaScript交互
- 鼠标位置跟踪
- 弹性缩放算法
- 动态参数调整

## 位置

`prototypes/liquid-glass-demo/`（仓库统一前端原型目录，见 [`../README.md`](../README.md)）

## 使用方法

1. 直接在浏览器中打开本目录下的 `index.html` 文件
2. 使用底部的控制面板调整效果参数：
   - **Blur**：控制模糊强度（0-30px）
   - **Saturation**：控制色彩饱和度（100-200%）
   - **Opacity**：控制雾面层透明度（10-50%）

## 浏览器兼容性

- ✅ Chrome/Edge：完整支持（包括位移效果）
- ⚠️ Firefox：部分支持（位移效果不可用）
- ⚠️ Safari：部分支持（需要-webkit前缀）

## 参数说明

| 参数 | 默认值 | 范围 | 说明 |
|------|--------|------|------|
| blur | 20px | 0-30px | 背景模糊强度 |
| saturation | 180% | 100-200% | 色彩饱和度 |
| opacity | 25% | 10-50% | 雾面层透明度 |
| displacementScale | 25 | 10-40 | 位移效果强度 |

## 文件结构

```
liquid-glass-demo/
├── index.html          # 主演示文件
└── README.md           # 说明文档
```

## 扩展建议

1. **添加更多交互**：点击效果、拖拽效果
2. **性能优化**：使用 `will-change` 和 `transform: translateZ(0)` 启用硬件加速
3. **无障碍支持**：添加 `prefers-reduced-motion` 媒体查询
4. **主题切换**：支持深色/浅色主题

## 参考资料

- [liquid-glass-react](https://github.com/rdev/liquid-glass-react) - Apple Liquid Glass效果的React实现
- [CSS Backdrop Filter](https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter) - MDN文档
- [SVG Filter Effects](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/filter) - SVG滤镜文档
