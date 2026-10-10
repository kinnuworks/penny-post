"""Draws Dak's mark: the face of a pillar box, a vermilion block with a letter slot.

Run from the repo root:  python3 scripts/make_icons.py
Writes assets/icon.png, assets/adaptive-foreground.png and assets/splash.png.
No dependencies beyond the standard library.
"""

import struct
import zlib
from pathlib import Path

PAPER = (0xF4, 0xEB, 0xDD)
RAISED = (0xFB, 0xF5, 0xEA)
INK = (0x24, 0x1C, 0x17)
VERMILION = (0xD4, 0x41, 0x2B)

SAMPLES = 3  # per axis, for smooth edges


def in_rounded_rect(x, y, left, top, right, bottom, radius):
    if not (left <= x <= right and top <= y <= bottom):
        return False
    cx = min(max(x, left + radius), right - radius)
    cy = min(max(y, top + radius), bottom - radius)
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius**2


def mark_colour(u, v):
    """Colour of the mark at (u, v) in a 0..1 box, or None outside the mark."""
    if not in_rounded_rect(u, v, 0.0, 0.0, 1.0, 1.0, 0.09):
        return None
    if in_rounded_rect(u, v, 0.23, 0.435, 0.77, 0.515, 0.032):
        return INK  # the dark of the slot
    if in_rounded_rect(u, v, 0.18, 0.39, 0.82, 0.56, 0.06):
        return RAISED  # the slot's surround
    if in_rounded_rect(u, v, 0.36, 0.68, 0.64, 0.75, 0.012):
        return RAISED  # the collection-times plate
    return VERMILION


def render(size, mark_scale, background):
    """Returns RGBA rows. `background` is an RGB tuple, or None for transparent."""
    offset = (1.0 - mark_scale) / 2.0
    step = 1.0 / (size * SAMPLES)
    rows = []
    for py in range(size):
        row = bytearray()
        for px in range(size):
            r = g = b = a = 0
            for sy in range(SAMPLES):
                for sx in range(SAMPLES):
                    x = (px * SAMPLES + sx + 0.5) * step
                    y = (py * SAMPLES + sy + 0.5) * step
                    colour = mark_colour((x - offset) / mark_scale, (y - offset) / mark_scale)
                    if colour is None:
                        colour = background
                    if colour is not None:
                        r += colour[0]
                        g += colour[1]
                        b += colour[2]
                        a += 255
            n = SAMPLES * SAMPLES
            covered = a // 255
            if covered:
                row += bytes((r // covered, g // covered, b // covered, a // n))
            else:
                row += b"\x00\x00\x00\x00"
        rows.append(bytes(row))
    return rows


def write_png(path, rows):
    size = len(rows)

    def chunk(kind, data):
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + row for row in rows)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    path.write_bytes(png)


def main():
    out = Path("assets")
    out.mkdir(exist_ok=True)
    write_png(out / "icon.png", render(1024, 0.62, PAPER))
    # Android crops adaptive icons to the middle two thirds, so the mark is smaller here.
    write_png(out / "adaptive-foreground.png", render(1024, 0.42, None))
    write_png(out / "splash.png", render(512, 0.8, None))


if __name__ == "__main__":
    main()
