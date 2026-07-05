"""
macOS 菜单栏 tray icon（B 方案：保留 icosahedron 识别度）。

设计：
- 实心五边形主体（全透明白）
- 中心到顶部顶点的细分线（中轴，最识别性特征）
- 右上 facet 半透明镂空（用 alpha 区分层次，不依赖彩色）
- 去掉角标勾（22px 装不下，留作 dock 图标）

macOS Template 规范：单色 + alpha 通道，系统自动按菜单栏明暗反色。
"""

from PIL import Image, ImageDraw
from pathlib import Path

OUT_DIR = Path(__file__).parent

# 32x32 design coords（icon.svg 同款 icosahedron 投影，缩放到 32 画布）
PENTAGON_OUTER = [
    (16, 4),       # top
    (28, 12),      # upper right
    (23, 24),      # lower right
    (9, 24),       # lower left
    (4, 12),       # upper left
]

# 右上 facet（对应 icon.svg 青绿高亮 facet）
# 顶点：top, upper-right, 中心偏上中点, 顶部下方中点
RIGHT_TOP_FACET = [
    (16, 4),       # top
    (28, 12),      # upper right
    (22, 14),      # 中右（center 偏右上）
    (16, 11),      # 上中（top 下方）
]


def draw_tray_icon(size: int) -> Image.Image:
    """Draw monochrome icosahedron with facet cutout."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    s = size / 32.0

    # 1. 实心五边形主体（全透明白）
    pent = [(x * s, y * s) for x, y in PENTAGON_OUTER]
    draw.polygon(pent, fill=(255, 255, 255, 255))

    # 2. 右上 facet 半透明镂空（alpha=110，约 43% 不透明度）
    facet = [(x * s, y * s) for x, y in RIGHT_TOP_FACET]
    draw.polygon(facet, fill=(0, 0, 0, 145))  # 用半透明黑色「挖」出层次

    # 3. 中心到顶部顶点的中轴线（细分线，alpha=180 略透明）
    line_w = max(1, int(1.2 * s))
    draw.line(
        [(16 * s, 16 * s), (16 * s, 4 * s)],
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
