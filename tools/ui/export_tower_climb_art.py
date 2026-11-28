"""Tower climb background (user 2026-11-28, two generated images): warp-entrance base + repeating tier loop.

Sources (tracked, do not edit): assets/ui/tower-climb/base-source.png and loop-source.png (887 x 1774).
Runtime: public/ui/tower/climb-base.webp (887 x 1774) and climb-loop.webp (887 x 797, tiles top-to-bottom).

The raw loop did not tile (top and bottom edges differ, and its four tiers are spaced 398 / 399 / 448 px, 529 px
across the wrap). This script:
  1. matches the loop's colours to the base (per-channel mean / spread),
  2. cuts exactly two evenly spaced tiers (rows 128 … 925 = 797 px) and cross-fades 72 rows so it tiles,
  3. fades the base's top 150 rows into the loop so the join is invisible,
  4. rotates the loop so its bottom row continues straight into the base's top row: stack the loop above the base
     (bottom-aligned, repeat upward) and no offset maths is needed at runtime.
Balcony rails (source px from the top): base 327 / 712 / 1082 (floors 3 / 2 / 1), loop 327 / 725.
Those numbers live in src/app/pages/tower/tower-climb-art.ts. Needs Pillow and numpy. Re-run after replacing a source.
"""
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

SRC, OUT = Path('assets/ui/tower-climb'), Path('public/ui/tower')
LOOP_START, PERIOD, SEAM_FADE = 128, 797, 72
BASE_FADE, PHASE = 150, 670  # base row 0 continues loop row PHASE (the base's first rail sits one tier below)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    base = np.asarray(Image.open(SRC / 'base-source.png').convert('RGB')).astype(float)
    raw = np.asarray(Image.open(SRC / 'loop-source.png').convert('RGB')).astype(float)

    ref = base[:1150]  # the tower part of the base (above the plaza)
    loop_src = raw.copy()
    for c in range(3):
        loop_src[..., c] = (raw[..., c] - raw[..., c].mean()) / raw[..., c].std() * ref[..., c].std() + ref[..., c].mean()
    loop_src = np.clip(loop_src, 0, 255)

    loop = loop_src[LOOP_START:LOOP_START + PERIOD].copy()
    w = np.linspace(0, 1, SEAM_FADE)[:, None, None]
    loop[:SEAM_FADE] = loop_src[LOOP_START + PERIOD:LOOP_START + PERIOD + SEAM_FADE] * (1 - w) + loop_src[LOOP_START:LOOP_START + SEAM_FADE] * w

    out_base = base.copy()
    for y in range(BASE_FADE):
        t = y / (BASE_FADE - 1)
        out_base[y] = loop[(PHASE + y) % PERIOD] * (1 - t) + base[y] * t

    rolled = np.roll(loop, -PHASE, axis=0)  # row 0 = loop row PHASE, last row = PHASE - 1 (sits right above the base)

    Image.fromarray(out_base.astype('uint8')).save(OUT / 'climb-base.webp', quality=86, method=6)
    Image.fromarray(rolled.astype('uint8')).save(OUT / 'climb-loop.webp', quality=86, method=6)

    manifest = {p.name: {'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(SRC.glob('*-source.png'))}
    (SRC / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    for f in sorted(OUT.glob('climb-*.webp')):
        print(f'{f.name:18} {Image.open(f).size} {f.stat().st_size // 1024:4} KB')


if __name__ == '__main__':
    main()
