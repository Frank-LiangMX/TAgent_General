"""
macOS 菜单栏 tray icon（A2 方案修正版：直接用 icon.svg 真实 icosahedron 坐标）。

之前版本错误：用了简化的对称五边形顶点，丢失 logo 识别度。
本版直接从 icon.svg 提取 icosahedron 正面投影坐标，等比缩放到 32x32 画布，
保留完整几何结构（5 主顶点 + 4 上半细分点 + 2 中部细分点 + 3 个 facet），
只做单色化处理（颜色转 alpha 层次）。

icon.svg 原始坐标：1024x1024 画布，icosahedron translate(512,512)，坐标范围 ±260
缩放：32x32 画布，icosahedron 占 16x16（留 8px 边距）
scale = 16/520 ≈ 0.0308
居中：原 (0,0) → 32 画布 (16,16)
"""

from PIL import Image, ImageDraw
from pathlib import Path

OUT_DIR = Path(__file__).parent

# 缩放参数：icon.svg icosahedron 坐标范围 ±260 → 32 画布
SCALE = 16 / 260  # 半径 260 映射到 16 像素（半画布）
CX = 16  # 32 画布中心
CY = 16


def to_canvas(x: float, y: float) -> tuple[float, float]:
    """icon.svg coords → 32x32 canvas coords (居中 16,16)"""
    return (x * SCALE + CX, y * SCALE + CY)


# 主体多边形：icosahedron 正面投影 5 个主顶点
PENTAGON_OUTER = [
    to_canvas(0, -260),     # top
    to_canvas(250, -80),    # upper right
    to_canvas(155, 225),    # lower right
    to_canvas(-155, 225),   # lower left
    to_canvas(-250, -80),   # upper left
]

# 5 条中心到各顶点的细分线（icon.svg:28-32）
INNER_LINES_MAIN = [
    (to_canvas(0, 0), to_canvas(0, -260)),     # → top
    (to_canvas(0, 0), to_canvas(250, -80)),    # → upper right
    (to_canvas(0, 0), to_canvas(155, 225)),    # → lower right
    (to_canvas(0, 0), to_canvas(-155, 225)),   # → lower left
    (to_canvas(0, 0), to_canvas(-250, -80)),   # → upper left
]

# 上半部分内部细分线（icon.svg:36-38）
INNER_LINES_UPPER = [
    (to_canvas(0, -130), to_canvas(125, -40)),
    (to_canvas(0, -130), to_canvas(-125, -40)),
    (to_canvas(0, -130), to_canvas(0, 0)),
]

# 中部细分线（icon.svg:41-43）
INNER_LINES_MID = [
    (to_canvas(-78, 73), to_canvas(78, 73)),
    (to_canvas(-125, -40), to_canvas(-78, 73)),
    (to_canvas(125, -40), to_canvas(78, 73)),
]

# 右上 facet（icon.svg:46，原青绿高亮）— alpha 最低（最亮）
RIGHT_TOP_FACET = [
    to_canvas(0, -260),
    to_canvas(250, -80),
    to_canvas(125, -40),
    to_canvas(0, -130),
]

# 底部 facet（icon.svg:50，原深灰）— alpha 中等
BOTTOM_FACET = [
    to_canvas(-155, 225),
    to_canvas(-78, 73),
    to_canvas(78, 73),
    to_canvas(155, 225),
]

# 左上 facet（icon.svg:54，原浅灰）— alpha 较高（较暗）
LEFT_TOP_FACET = [
    to_canvas(0, -260),
    to_canvas(-125, -40),
    to_canvas(-250, -80),
]


def draw_tray_icon(size: int) -> Image.Image:
    """Draw monochrome icosahedron with facet alpha layers."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    s = size / 32.0  # 缩放因子（32 design coords → 实际像素）

    def scale_pt(p: tuple[float, float]) -> tuple[float, float]:
        return (p[0] * s, p[1] * s)

    # 1. 实心主体（全透明白，alpha=255）
    pent = [scale_pt(p) for p in PENTAGON_OUTER]
    draw.polygon(pent, fill=(255, 255, 255, 255))

    # 2. 叠加 3 个 facet（用半透明黑色「挖」层次）
    #    alpha 越低 = 越不透明 = facet 越亮
    #    右上 facet：alpha=100（最亮，对应青绿高亮）
    #    底部 facet：alpha=140（中等，对应深灰）
    #    左上 facet：alpha=170（较暗，对应浅灰）
    right_top = [scale_pt(p) for p in RIGHT_TOP_FACET]
    draw.polygon(right_top, fill=(0, 0, 0, 100))

    bottom = [scale_pt(p) for p in BOTTOM_FACET]
    draw.polygon(bottom, fill=(0, 0, 0, 140))

    left_top = [scale_pt(p) for p in LEFT_TOP_FACET]
    draw.polygon(left_top, fill=(0, 0, 0, 170))

    # 3. 5 条中心到顶点主细分线（alpha=180）
    line_w_main = max(1, int(1.2 * s))
    for p1, p2 in INNER_LINES_MAIN:
        draw.line(
            [scale_pt(p1), scale_pt(p2)],
            fill=(0, 0, 0, 180),
            width=line_w_main,
        )

    # 4. 上半部分细分线（alpha=200，略浅）
    line_w_inner = max(1, int(0.9 * s))
    for p1, p2 in INNER_LINES_UPPER:
        draw.line(
            [scale_pt(p1), scale_pt(p2)],
            fill=(0, 0, 0, 200),
            width=line_w_inner,
        )

    # 5. 中部细分线（alpha=200）
    for p1, p2 in INNER_LINES_MID:
        draw.line(
            [scale_pt(p1), scale_pt(p2)],
            fill=(0, 0, 0, 200),
            width=line_w_inner,
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
