"""
Regenerate icon.icns from icon.png

ICNS format reference:
  - 8 bytes header: "icns" + total file length (big-endian uint32)
  - For each icon: 4 bytes type + 4 bytes length (big-endian uint32, including the 8-byte header) + data

PNG-embedded types (no need for raw ARGB):
  - icp4 = 16x16
  - icp5 = 32x32
  - icp6 = 64x64
  - ic07 = 128x128
  - ic08 = 256x256
  - ic09 = 512x512
  - ic10 = 1024x1024 (also serves 512x512@2x)

macOS 10.7+ accepts any subset; we provide the common PNG sizes.
"""

import struct
import sys
from pathlib import Path
from PIL import Image

SRC = Path(r"F:\TAgent_General\apps\electron\resources\icon.png")
DST = Path(r"F:\TAgent_General\apps\electron\resources\icon.icns")

# (type, size_in_px)
SIZES = [
    ("icp4", 16),
    ("icp5", 32),
    ("icp6", 64),
    ("ic07", 128),
    ("ic08", 256),
    ("ic09", 512),
    ("ic10", 1024),
]


def png_bytes_at(im: Image.Image, size: int) -> bytes:
    """Return PNG bytes for the image resized to `size`x`size`."""
    if im.size != (size, size):
        im2 = im.resize((size, size), Image.LANCZOS)
    else:
        im2 = im
    # Convert to RGBA to ensure proper alpha channel
    if im2.mode != "RGBA":
        im2 = im2.convert("RGBA")
    from io import BytesIO
    buf = BytesIO()
    im2.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def build_icns(entries: list[tuple[str, bytes]]) -> bytes:
    """Build an ICNS file from a list of (type, png_data) entries."""
    body = b""
    for typ, data in entries:
        # 4 bytes type + 4 bytes length + data; length is total chunk length (header + data)
        chunk = struct.pack(">4sI", typ.encode("ascii"), 8 + len(data)) + data
        body += chunk
    # 4 bytes "icns" + 4 bytes total file length
    header = struct.pack(">4sI", b"icns", 8 + len(body))
    return header + body


def main() -> int:
    if not SRC.exists():
        print(f"❌ Source not found: {SRC}")
        return 1

    im = Image.open(SRC)
    print(f"[SRC] {SRC.name} ({im.size[0]}x{im.size[1]} {im.mode})")

    entries = []
    for typ, size in SIZES:
        data = png_bytes_at(im, size)
        entries.append((typ, data))
        print(f"  [OK] {typ} ({size}x{size}) -> {len(data):>6} bytes")

    icns = build_icns(entries)

    DST.write_bytes(icns)
    print(f"[DONE] Wrote {DST.name} ({len(icns):,} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
