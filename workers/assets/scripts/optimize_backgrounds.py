#!/usr/bin/env python3
"""Emit optimized WebP variants of every hero background PNG (q80, widths
1920/828, LANCZOS) into backgrounds/opt/. Skip-existing; never modifies sources."""
from __future__ import annotations

import os
import sys

from PIL import Image

WIDTHS = (1920, 828)
QUALITY = 80


def process(png_path: str, out_dir: str) -> tuple[int, int, int]:
    """Return (written, skipped, bytes_written) for one source PNG."""
    stem = os.path.splitext(os.path.basename(png_path))[0]
    written = skipped = nbytes = 0
    notes = []
    with Image.open(png_path) as im:
        # Flatten onto black: the upstream PNGs keep garbage RGB under alpha=0 (haze's right
        # edge), and a bare convert("RGB") exposes it as a rainbow strip in the served plate.
        if im.mode in ("RGBA", "LA", "P"):
            rgba = im.convert("RGBA")
            flat = Image.new("RGBA", rgba.size, (0, 0, 0, 255))
            flat.alpha_composite(rgba)
            im = flat.convert("RGB")
        else:
            im = im.convert("RGB")
        src_w, src_h = im.size
        for w in WIDTHS:
            out = os.path.join(out_dir, f"{stem}_{w}.webp")
            if os.path.exists(out) and os.path.getsize(out) > 0:
                skipped += 1
                notes.append(f"{stem}_{w}.webp skip")
                continue
            if src_w > w:
                resized = im.resize((w, round(src_h * w / src_w)), Image.LANCZOS)
            else:
                resized = im
            resized.save(out, "WEBP", quality=QUALITY)
            written += 1
            nbytes += os.path.getsize(out)
            notes.append(f"{stem}_{w}.webp {os.path.getsize(out) / 1024:.1f}KB")
    print(f"  {stem}.png {src_w}x{src_h} -> " + ", ".join(notes))
    return written, skipped, nbytes


def main() -> int:
    here = os.path.dirname(os.path.abspath(__file__))
    bg_dir = os.path.join(here, "deadlock", "heroes", "backgrounds")
    out_dir = os.path.join(bg_dir, "opt")
    os.makedirs(out_dir, exist_ok=True)
    pngs = sorted(f for f in os.listdir(bg_dir) if f.endswith("_bg.png"))
    if not pngs:
        print(f"optimize_backgrounds: no *_bg.png under {bg_dir}", file=sys.stderr)
        return 1
    total_w = total_s = total_b = 0
    for f in pngs:
        w, s, b = process(os.path.join(bg_dir, f), out_dir)
        total_w += w
        total_s += s
        total_b += b
    print(f"TOTAL: {len(pngs)} backgrounds, {total_w} variants written, "
          f"{total_s} skipped, {total_b / 1024:.0f} KiB written -> {out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
