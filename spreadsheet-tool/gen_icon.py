"""Generate a PNG icon for the spreadsheet tool. No external dependencies needed."""
import struct
import zlib


def create_png(width, height, pixels):
    """Create a simple PNG from RGBA pixel data."""
    def make_chunk(chunk_type, data):
        chunk = chunk_type + data
        return struct.pack(">I", len(data)) + chunk + struct.pack(">I", zlib.crc32(chunk) & 0xFFFFFFFF)

    header = b"\x89PNG\r\n\x1a\n"
    ihdr = make_chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))

    raw_rows = []
    for y in range(height):
        raw_rows.append(b"\x00" + bytes(pixels[y * width:(y + 1) * width]))
    idat = make_chunk(b"IDAT", zlib.compress(b"".join(raw_rows)))
    iend = make_chunk(b"IEND", b"")

    return header + ihdr + idat + iend


def draw_icon():
    """Draw a 128x128 spreadsheet icon."""
    W, H = 128, 128
    pixels = [0, 0, 0, 0] * (W * H)  # transparent background

    def set_pixel(x, y, r, g, b, a=255):
        if 0 <= x < W and 0 <= y < H:
            idx = (y * W + x) * 4
            pixels[idx] = r
            pixels[idx + 1] = g
            pixels[idx + 2] = b
            pixels[idx + 3] = a

    BLUE = (26, 115, 232)
    DARK_BLUE = (21, 87, 176)
    WHITE = (255, 255, 255)

    # Body rectangle with rounded corners (approximate)
    for y in range(12, 116):
        for x in range(16, 112):
            # Simple rounded corner check
            in_corner = False
            if y < 20 and x < 24:  # top-left
                cx, cy = 24, 20
                if (x - cx) ** 2 + (y - cy) ** 2 > 64:
                    in_corner = True
            elif y < 20 and x > 104:  # top-right
                cx, cy = 104, 20
                if (x - cx) ** 2 + (y - cy) ** 2 > 64:
                    in_corner = True
            elif y > 108 and x < 24:  # bottom-left
                cx, cy = 24, 108
                if (x - cx) ** 2 + (y - cy) ** 2 > 64:
                    in_corner = True
            elif y > 108 and x > 104:  # bottom-right
                cx, cy = 104, 108
                if (x - cx) ** 2 + (y - cy) ** 2 > 64:
                    in_corner = True

            if not in_corner:
                set_pixel(x, y, *BLUE)

    # Sheet tab
    for y in range(18, 36):
        for x in range(22, 88):
            if y < 28:
                set_pixel(x, y, *(c // 2 for c in WHITE))
                if x in (22, 87):
                    set_pixel(x, y, *WHITE, 120)

    # Grid lines
    line_y = [38, 50, 62, 74, 86, 98]
    for ly in line_y:
        for x in range(22, 106):
            set_pixel(x, ly, *WHITE, 100)
            set_pixel(x, ly + 1, *WHITE, 60)

    # Column separators
    for cx in [46, 70, 94]:
        for y in range(36, 108):
            set_pixel(cx, y, *WHITE, 40)

    return bytes(pixels)


if __name__ == "__main__":
    icon_data = draw_icon()
    png_data = create_png(128, 128, icon_data)
    with open("icon.png", "wb") as f:
        f.write(png_data)
    print("icon.png created")
