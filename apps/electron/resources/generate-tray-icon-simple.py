"""
macOS 菜单栏 tray icon（A2 方案：保留完整 icosahedron 几何结构，单色 template）。

设计基于 icon.svg 的二十面体正面投影：
- 实心五边形主体（全透明白）
- 5 条中心到顶点的细分线（半透明，对应原白色细分线）
- 3 个 facet 用不同 alpha 区分层次：
  * 右上 facet：alpha 最高（对应青绿高亮）
  * 底部 facet：alpha 中等（对应深灰）
  * 左上 facet：alpha 较低（对应浅灰）
- 去掉角标勾（22px 装不下，留作 dock 图标）

macOS Template 规范：单色 + alpha 通道，系统自动按菜单栏明暗反色。
"""

from PIL import Image, ImageDraw
from pathlib import Path

OUT_DIR = Path(__file__).parent

# 32x32 design coords（icon.svg icosahedron 投影，缩放到 32 画布，居中 16,16）
# 五边形主体顶点
PENTAGON_OUTER = [
    (16, 4),       # top
    (28, 12),      # upper right
    (23, 24),      # lower right
    (9, 24),       # lower left
    (4, 12),       # upper left
]

# 5 条中心到各顶点的细分线（中心 = 16,16）
INNER_LINES = [
    ((16, 16), (16, 4)),    # → top
    ((16, 16), (28, 12)),   # → upper right
    ((16, 16), (23, 24)),   # → lower right
    ((16, 16), (9, 24)),    # → lower left
    ((16, 16), (4, 12)),    # → upper left
]

# 3 个 facet（对应 icon.svg 的 facet 高亮）
# 右上 facet（原青绿高亮）— alpha 最高
RIGHT_TOP_FACET = [
    (16, 4),       # top
    (28, 12),      # upper right
    (22, 14),      # center 偏右上
    (16, 11),      # top 下方中点
]

# 底部 facet（原深灰）— alpha 中等
BOTTOM_FACET = [
    (9, 24),       # lower left
    (12, 18),      # center 偏左下
    (20, 18),      # center 偏右下
    (23, 24),      # lower right
]

# 左上 facet（原浅灰）— alpha 较低
LEFT_TOP_FACET = [
    (16, 4),       # top
    (16, 11),      # top 下方中点
    (12, 18),      # center 偏左下
    (4, 12),       # upper left
]


def draw_tray_icon(size: int) -> Image.Image:
    """Draw monochrome icosahedron with facet alpha layers."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    s = size / 32.0

    # 1. 实心五边形主体（全透明白，alpha=255）
    pent = [(x * s, y * s) for x, y in PENTAGON_OUTER]
    draw.polygon(pent, fill=(255, 255, 255, 255))

    # 2. 在主体上叠加 3 个 facet（用半透明黑色「挖」出层次）
    #    alpha 越高 = 越透明 = facet 越暗（系统反色后）
    #    右上 facet：alpha=100（最不透明，对应青绿高亮 → 反色后最亮）
    #    底部 facet：alpha=140（中等透明，对应深灰）
    #    左上 facet：alpha=170（最透明，对应浅灰）
    right_top = [(x * s, y * s) for x, y in RIGHT_TOP_FACET]
    draw.polygon(right_top, fill=(0, 0, 0, 100))

    bottom = [(x * s, y * s) for x, y in BOTTOM_FACET]
    draw.polygon(bottom, fill=(0, 0, 0, 140))

    left_top = [(x * s, y * s) for x, y in LEFT_TOP_FACET]
    draw.polygon(left_top, fill=(0, 0, 0, 170))

    # 3. 5 条中心细分线（半透明黑色，对应原白色细分线）
    line_w = max(1, int(1.0 * s))
    for (x1, y1), (x2, y2) in INNER_LINES:
        draw.line(
            [(x1 * s, y1 * s), (x2 * s, y2 * s)],
            fill=(0, 0, 0, 180),
            width=line_w,
        )

    return img


SIZES = [
    ("iconTemplate.png", 22),
    ("iconTemplate@2x.png", 44),
    ("iconTemplate@3x.png", 66),
]

for name, size in SIZES:
    img = draw_tray_icon(size)
    out = OUT_DIR / name
    img.save(out, format="PNG", optimize=True)
    print(f"[OK] {out.name} ({size}x{size}) -> {out.stat().st_size} bytes")
