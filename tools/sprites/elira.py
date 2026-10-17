"""Elira Phase A: bake approved base/reference PNGs without modifying source pixels.

python3 tools/sprites/elira.py [source dir] [sprites out] [portraits out]
Sources: base.png / reference.png from Elira_master_base.zip. Skill art remains pending.
"""
import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import aurel_v2 as A
import bailong as B

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else 'art/incoming/elira')
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else 'public/sprites')
PORTRAITS = Path(sys.argv[3] if len(sys.argv) > 3 else 'public/portraits')
B.SRC = str(SRC)
B.CELL_W, B.CELL_H, B.ROOT_X, B.ROOT_Y = 260, 170, 130, 155
NAMES = ['idle', 'walk', 'hurt', 'attack', 'die']
COUNTS = [5, 7, 4, 7, 6]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    PORTRAITS.mkdir(parents=True, exist_ok=True)
    base, _ = B.load('base')
    # One existing detached white-gold star is the normal bolt; no replacement art is generated.
    light = Image.fromarray(base[701:743, 998:1038].copy())
    light = light.crop(light.getbbox()).resize((16, 16), Image.Resampling.BOX)
    light.save(OUT / 'fx-elira-basic-light.png', optimize=True)
    frames = A.sheet_frames('base', COUNTS, False)
    groups, start = {}, 0
    for name, count in zip(NAMES, COUNTS):
        groups[name] = frames[start:start + count]
        start += count
    ground = max(fr['root'][1] for fr in groups['walk'])
    for fr in groups['walk']:
        fr['root'] = (fr['root'][0], ground)
    scale = 78 / A.body_h(groups['idle'][0])
    probe = Image.new('RGBA', (260 * 7, 170 * 8))
    for row, name in enumerate(NAMES):
        for col, fr in enumerate(groups[name]):
            A.paste_frame(probe, fr, row, col, scale, (0, 0))
    alpha = np.array(probe)[..., 3]
    torso = {name: [A.torso_x(alpha[row*170:(row+1)*170, col*260:(col+1)*260])
                    for col in range(len(groups[name]))] for row, name in enumerate(NAMES)}
    shifts = A.stabilise(torso)
    sheet = Image.new('RGBA', probe.size)
    clipped = []
    for row, name in enumerate(NAMES):
        for col, fr in enumerate(groups[name]):
            clipped.append(A.paste_frame(sheet, fr, row, col, scale, (shifts[name][col], 0)))
    if any(clipped):
        raise ValueError(f'Clipped source pixels: {clipped}')
    sheet.save(OUT / 'hero-elira.png', optimize=True)
    # Face close-up at bottom-right, avoiding expression panels and palette swatches.
    reference, _ = B.load('reference')
    portrait = Image.fromarray(reference[770:1070, 1110:1410]).resize((288, 288), Image.Resampling.LANCZOS)
    portrait.save(PORTRAITS / 'elira.webp', quality=92)
    print(json.dumps({'counts': COUNTS, 'scale': scale, 'bodyHeight': 78,
                      'sheet': sheet.size, 'clipped': sum(clipped)}, indent=2))


if __name__ == '__main__':
    main()
