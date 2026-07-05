"""
macOS 菜单栏 tray icon（最终极简版）。

历史：
- A2 完整版：5 主顶点 + 11 条细分线 + 3 facet → 22px 糊成一坨
- 极简放射版：五边形 + 5 条 1px 放射线 → macOS status item 渲染到 ~16pt 时
  1px 线条消失，只剩五边形轮廓

最终策略：纯实心五边形主体（icosahedron 正面投影 5 主顶点），
不画任何内部细分线和 facet。形状本身的非对称性（顶点角度不同）
就是 icosahedron 的识别特征。

icon.svg 5 主顶点（1024 画布，半径 260）：
  top:         (0, -260)
  upper right: (250, -80)
  lower right: (155, 225)
  lower left:  (-155, 225)
  upper left:  (-250, -80)

缩放：32 画布 / 半径 16，scale = 16/260
"""

from PIL import Image, ImageDraw
from pathlib import Path

OUT_DIR = Path(__file__).parent

SCALE = 16 / 260
CX = 16
CY = 16


def to_canvas(x: float, y: float) -> tuple[float, float]:
    return (x * SCALE + CX, y * SCALE + CY)


# 5 主顶点（icosahedron 正面投影）
PENTAGON_OUTER = [
    to_canvas(0, -260),     # top
    to_canvas(250, -80),    # upper right
    to_canvas(155, 225),    # lower right
    to_canvas(-155, 225),   # lower left
    to_canvas(-250, -80),   # upper left
]


def draw_tray_icon(size: int) -> Image.Image:
    """实心五边形主体（无内部细节）。"""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    s = size / 32.0

    def scale_pt(p: tuple[float, float]) -> tuple[float, float]:
        return (p[0] * s, p[1] * s)

    pent = [scale_pt(p) for p in PENTAGON_OUTER]
    draw.polygon(pent, fill=(255, 255, 255, 255))

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
