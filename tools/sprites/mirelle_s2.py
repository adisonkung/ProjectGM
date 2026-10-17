"""Cut the supplied Glassbind Main/Bind for provisional review, without a final timeline.

python3 tools/sprites/mirelle_s2.py [source directory] [sprite output]
Sources remain read-only. Uses the same alpha/magenta recovery as Mirelle S1.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

from mirelle_s1 import load_fx, cut_frames


def bake_ground(frames, out, filename, peak_width):
    """Keep the floor ring on one baseline; changing crystal height must not make the ground jump."""
    scale = peak_width / max(im.width for im, _ in frames)
    tiles = []
    for im, _ in frames:
        a = np.array(im)
        mask = a[..., 3] >= 64
        # Find the wide base ring in the lower portion; isolated low sparkles are not the foot pivot.
        profile = mask.sum(1)
        start = int(im.height * 0.65)
        y = start + int(np.argmax(profile[start:]))
        ys = np.flatnonzero(mask[:, max(0, im.width // 4):3 * im.width // 4].any(1))
        bottom = int(ys[-1])
        floor = y + (bottom - y) * 0.45
        scaled = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.Resampling.LANCZOS)
        tiles.append((scaled, floor * scale))
    up = int(np.ceil(max(floor for _, floor in tiles))) + 2
    down = int(np.ceil(max(im.height - floor for im, floor in tiles))) + 2
    w, h = peak_width + 4, up + down
    strip = Image.new('RGBA', (w * len(tiles), h))
    for i, (im, floor) in enumerate(tiles):
        strip.alpha_composite(im, (i * w + (w - im.width) // 2, round(up - floor)))
    strip.save(out / filename, optimize=True)
    return {'frames': len(tiles), 'w': w, 'h': h, 'pivot': [0.5, round(up / h, 6)],
            'sourceBounds': [b for _, b in frames]}


def main():
    src = Path(sys.argv[1] if len(sys.argv) > 1 else 'art/incoming/mirelle/s2')
    out = Path(sys.argv[2] if len(sys.argv) > 2 else 'public/sprites')
    out.mkdir(parents=True, exist_ok=True)
    main_frames = cut_frames(load_fx(src / 's2_main.png'), [105, 310, 550, 815, 1113, 1410, 1735, 2038])
    bind_frames = cut_frames(load_fx(src / 's2_bind.png'), [100, 285, 492, 703, 938, 1160, 1375, 1570])
    print(json.dumps({'state': 'PROVISIONAL_REVIEW',
                     'main': bake_ground(main_frames, out, 'fx-mirelle-s2-main.png', 144),
                     'bind': bake_ground(bind_frames, out, 'fx-mirelle-s2-bind.png', 60)}, indent=2))


if __name__ == '__main__':
    main()
