"""
macOS 菜单栏 tray icon（线框 + 5 放射线版）。

历史：
- 纯实心五边形：太大太黑
- 纯线框轮廓：只剩外框，丢失 icosahedron 识别度

本版策略：外框轮廓 + 5 条中心放射线（icon.svg:28-32 的核心特征）。
- 1.5px 描边外框
- 1.5px 中心放射线（icosahedron 正面投影的标志性视觉）
- 缩小到画布 70%（半径 12/32，留 4px 边距）

icon.svg 5 主顶点（1024 画布，半径 260）：
  top:         (0, -260)
  upper right: (250, -80)
  lower right: (155, 225)
  lower left:  (-155, 225)
  upper left:  (-250, -80)
"""

from PIL import Image, ImageDraw
from pathlib import Path

OUT_DIR = Path(__file__).parent

SCALE = 12 / 260  # 缩到 70%
CX = 16
CY = 16


def to_canvas(x: float, y: float) -> tuple[float, float]:
    return (x * SCALE + CX, y * SCALE + CY)


PENTAGON_OUTER = [
    to_canvas(0, -260),     # top
    to_canvas(250, -80),    # upper right
    to_canvas(155, 225),    # lower right
    to_canvas(-155, 225),   # lower left
    to_canvas(-250, -80),   # upper left
]
CENTER = (CX, CY)


def draw_tray_icon(size: int) -> Image.Image:
    """线框轮廓 + 5 条中心放射线。"""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    s = size / 32.0

    def scale_pt(p: tuple[float, float]) -> tuple[float, float]:
        return (p[0] * s, p[1] * s)

    line_w = max(1, round(1.5 * s))
    center = scale_pt(CENTER)

    # 1. 外框轮廓（闭合五边形）
    pent = [scale_pt(p) for p in PENTAGON_OUTER]
    draw.line(
        pent + [pent[0]],
        fill=(255, 255, 255, 255),
        width=line_w,
        joint="curve",
    )

    # 2. 5 条中心放射线（icosahedron 标志特征）
    for vertex in PENTAGON_OUTER:
        v = scale_pt(vertex)
        draw.line(
            [center, v],
            fill=(255, 255, 255, 255),
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
