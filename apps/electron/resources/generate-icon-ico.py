"""
从 icon.png 生成 icon.ico（Windows 多分辨率图标）
使用 Pillow，直接在 Windows 上运行。

用法: python generate-icon-ico.py
"""
import struct
from io import BytesIO
from pathlib import Path
from PIL import Image

SRC = Path(__file__).parent / "icon.png"
DST = Path(__file__).parent / "icon.ico"

# ICO 格式支持多个尺寸，Windows 常用: 256, 128, 96, 64, 48, 32, 16
SIZES = [256, 128, 96, 64, 48, 32, 16]


def convert_to_rgba(im: Image.Image) -> Image.Image:
    if im.mode != "RGBA":
        return im.convert("RGBA")
    return im


def build_ico(images: list[Image.Image]) -> bytes:
    """将多个尺寸的 PNG 图像打包成 ICO 文件。"""
    if not images:
        raise ValueError("No images to pack")

    # ICO header: 6 bytes
    # Each directory entry: 16 bytes
    num_images = len(images)
    header = struct.pack("<HHH", 0, 1, num_images)

    # 计算所有图像的字节数据
    png_datas: list[bytes] = []
    for im in images:
        buf = BytesIO()
        im.save(buf, format="PNG", optimize=False)
        png_datas.append(buf.getvalue())

    # Directory entries
    # Calculate offsets: header(6) + directory(16 * n)
    offset = 6 + 16 * num_images
    dir_entries = b""
    for size, png_data in zip([im.size[0] for im in images], png_datas):
        w = 0 if size >= 256 else size  # 256 → 0 in ICO format
        h = 0 if size >= 256 else size
        entry = struct.pack(
            "<BBBBHHII",
            w,          # width (0 = 256)
            h,          # height (0 = 256)
            0,          # color palette (0 = no palette)
            0,          # reserved
            1,          # color planes
            32,         # bits per pixel
            len(png_data),  # size of image data
            offset,     # offset to image data
        )
        dir_entries += entry
        offset += len(png_data)

    # Combine: header + directory + all image data
    ico_data = header + dir_entries
    for png_data in png_datas:
        ico_data += png_data

    return ico_data


def main() -> int:
    if not SRC.exists():
        print(f"❌ Source not found: {SRC}")
        return 1

    im = Image.open(SRC)
    print(f"[SRC] {SRC.name} ({im.size[0]}x{im.size[1]} {im.mode})")

    images = []
    for size in SIZES:
        if im.size != (size, size):
            resized = im.resize((size, size), Image.Resampling.LANCZOS)
        else:
            resized = im
        resized = convert_to_rgba(resized)
        images.append(resized)
        print(f"  [OK] {size}x{size}")

    ico_data = build_ico(images)
    DST.write_bytes(ico_data)
    print(f"[DONE] Wrote {DST.name} ({len(ico_data):,} bytes)")
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
