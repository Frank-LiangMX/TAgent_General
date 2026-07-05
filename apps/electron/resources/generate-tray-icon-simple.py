"""
macOS 菜单栏 tray icon（线框轮廓版，参考 Cursor 风格）。

历史：
- A2 完整版：5 主顶点 + 11 条细分线 + 3 facet → 糊成一坨
- 极简放射版：五边形 + 5 条放射线 → 1px 线条消失
- 纯实心五边形：太大太黑，撑满 22px 画布

本版策略：参考 Cursor 立方体图标的线框风格——
- 1.5px 描边轮廓（不填充）
- 五边形顶点保持 icosahedron 真实投影
- 缩小到画布 70% 大小（留出边距）
- 不画内部任何细节

icon.svg 5 主顶点（1024 画布，半径 260）：
  top:         (0, -260)
  upper right: (250, -80)
  lower right: (155, 225)
  lower left:  (-155, 225)
  upper left:  (-250, -80)

缩放：32 画布 / 半径 12（留 8px 边距 = 4px 每边），scale = 12/260
"""

from PIL import Image, ImageDraw
from pathlib import Path

OUT_DIR = Path(__file__).parent

# 缩小到 70%，留出边距（参考 Cursor 立方体的留白）
SCALE = 12 / 260
CX = 16
CY = 16


def to_canvas(x: float, y: float) -> tuple[float, float]:
    return (x * SCALE + CX, y * SCALE + CY)


# 5 主顶点
PENTAGON_OUTER = [
    to_canvas(0, -260),     # top
    to_canvas(250, -80),    # upper right
    to_canvas(155, 225),    # lower right
    to_canvas(-155, 225),   # lower left
    to_canvas(-250, -80),   # upper left
]


def draw_tray_icon(size: int) -> Image.Image:
    """线框轮廓五边形（无填充）。"""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    s = size / 32.0

    def scale_pt(p: tuple[float, float]) -> tuple[float, float]:
        return (p[0] * s, p[1] * s)

    # 1.5px 描边轮廓（参考 Cursor 的细线风格）
    line_w = max(1, round(1.5 * s))
    pent = [scale_pt(p) for p in PENTAGON_OUTER]
    # 用 line 而非 polygon，line 描边更清晰，polygon 会自带填充
    # 闭合：把首点接到末点
    points = pent + [pent[0]]
    draw.line(
        points,
        fill=(255, 255, 255, 255),
        width=line_w,
        joint="curve",
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
