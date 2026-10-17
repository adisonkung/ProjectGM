"""Bake the user's approved Sylvara base ZIP; skill production remains pending.

python3 tools/sprites/sylvara.py [source directory] [sprite output] [portrait output]
Read-only source slots: base.png and reference.png, byte-identical to sylvara_base.zip.
Uses the shared chroma-key, body watershed, scale and torso stabilisation pipeline.
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

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else 'art/incoming/sylvara')
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else 'public/sprites')
PORTRAITS = Path(sys.argv[3] if len(sys.argv) > 3 else 'public/portraits')
B.SRC = str(SRC)
B.CELL_W, B.CELL_H, B.ROOT_X, B.ROOT_Y = 260, 170, 130, 155
NAMES = ['idle', 'walk', 'hurt', 'attack', 'die']
COUNTS = [5, 7, 4, 7, 6]
IDLE_BODY = 78


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    PORTRAITS.mkdir(parents=True, exist_ok=True)
    base, _ = B.load('base')
    # The detached arrow belongs to the normal-attack projectile, never to the body atlas.
    arrow = base[710:735, 1008:1061].copy()
    if not (arrow[..., 3] > 0).any():
        raise ValueError('Approved base arrow crop is empty')
    # Pass a character-only copy through the shared cutter without modifying the original PNG.
    character = base.copy()
    character[710:735, 1008:1061] = 0
    bands = B.bands(character[..., 3] >= B.ALPHA_CUT)
    if len(bands) != len(COUNTS):
        raise ValueError(f'Expected five base rows, got {bands}')
    groups = {name: B.clip_frames(character, band, count, 'feet', False)
              for name, band, count in zip(NAMES, bands, COUNTS)}
    ground = max(fr['root'][1] for fr in groups['walk'])
    for fr in groups['walk']:
        fr['root'] = (fr['root'][0], ground)
    scale = IDLE_BODY / A.body_h(groups['idle'][0])
    probe = Image.new('RGBA', (260 * max(COUNTS), 170 * 8))
    for row, name in enumerate(NAMES):
        for col, fr in enumerate(groups[name]):
            A.paste_frame(probe, fr, row, col, scale, (0, 0))
    alpha = np.array(probe)[..., 3]
    torso = {name: [A.torso_x(alpha[row * 170:(row + 1) * 170, col * 260:(col + 1) * 260])
                    for col in range(len(groups[name]))] for row, name in enumerate(NAMES)}
    shifts = A.stabilise(torso)
    sheet = Image.new('RGBA', probe.size)
    clipped = []
    for row, name in enumerate(NAMES):
        for col, fr in enumerate(groups[name]):
            clipped.append(A.paste_frame(sheet, fr, row, col, scale, (shifts[name][col], 0)))
    if any(clipped):
        raise ValueError(f'Clipped character pixels: {clipped}')
    sheet.save(OUT / 'hero-sylvara.png', optimize=True)
    # Crop existing arrow pixels, retain their drawn orientation and scale with the character.
    arrow_image = Image.fromarray(arrow)
    arrow_image = arrow_image.crop(arrow_image.getbbox())
    arrow_image = arrow_image.resize((max(1, round(arrow_image.width * scale)),
                                      max(1, round(arrow_image.height * scale))), Image.Resampling.BOX)
    arrow_image.save(OUT / 'fx-sylvara-basic-arrow.png', optimize=True)
    # Temporary portrait from the approved reference close-up; no fabricated skill icons or banner.
    reference, _ = B.load('reference')
    portrait = Image.fromarray(reference).crop((1040, 760, 1448, 1086))
    portrait.thumbnail((288, 288), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (288, 288))
    canvas.alpha_composite(portrait, ((288 - portrait.width) // 2, 288 - portrait.height))
    canvas.save(PORTRAITS / 'sylvara.webp', quality=92)
    print(json.dumps({'scale': scale, 'bodyHeight': IDLE_BODY, 'counts': dict(zip(NAMES, COUNTS)),
                      'sheet': sheet.size, 'projectile': arrow_image.size, 'clipped': sum(clipped)}, indent=2))


if __name__ == '__main__':
    main()
