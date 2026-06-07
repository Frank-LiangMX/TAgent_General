"""
Generate tray icon (iconTemplate.png + @2x + @3x) from a simple geometric design.

For macOS Template icons + Windows tray:
  - Monochrome (black on transparent)
  - macOS auto-tints based on menu bar theme
  - 3 sizes: 22x22 (1x), 44x44 (2x Retina), 66x66 (3x)
"""

from PIL import Image, ImageDraw
from pathlib import Path

OUT_DIR = Path(r"F:\TAgent_General\apps\electron\resources")

# icosahedron simplified: pentagon with internal facet lines
# (centered at 0,0; scale = half-width)
PENTAGON_OUTER = [
    (0, -12),     # top
    (12, -4),     # upper right
    (7, 11),      # lower right
    (-7, 11),     # lower left
    (-12, -4),    # upper left
]
CENTER = (0, 0)
# Internal facet lines (center to each vertex except bottom two)
INNER_LINES = [
    ((0, 0), (0, -12)),
    ((0, 0), (12, -4)),
    ((0, 0), (-12, -4)),
    ((0, 0), (7, 11)),
    ((0, 0), (-7, 11)),
    # Upper internal division line (between top and upper-mid)
    ((-6, -2), (6, -2)),
]


def draw_tray_icon(size: int) -> Image.Image:
    """Draw monochrome (white) icosahedron at given size."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    s = size / 32.0  # scale factor (design is in 32x32 coords)

    # Center
    cx, cy = size / 2, size / 2

    # Pentagon outer (solid white)
    pent = [(x * s + cx, y * s + cy) for x, y in PENTAGON_OUTER]
    draw.polygon(pent, fill=(255, 255, 255, 255))

    # Carve internal "facet" cuts with semi-transparent gaps
    line_w = max(1, int(1.5 * s))
    for (x1, y1), (x2, y2) in INNER_LINES:
        draw.line(
            [(x1 * s + cx, y1 * s + cy), (x2 * s + cx, y2 * s + cy)],
            fill=(0, 0, 0, 0),
            width=line_w,
        )

    # Make 2 facets appear darker (carve with semi-transparent cuts)
    cut_ul = [
        (0 * s + cx, -12 * s + cy),
        (0 * s + cx, 0 * s + cy),
        (-12 * s + cx, -4 * s + cy),
    ]
    draw.polygon(cut_ul, fill=(255, 255, 255, 110))
    cut_b = [
        (0 * s + cx, 0 * s + cy),
        (7 * s + cx, 11 * s + cy),
        (-7 * s + cx, 11 * s + cy),
    ]
    draw.polygon(cut_b, fill=(255, 255, 255, 110))

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
