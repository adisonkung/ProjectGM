"""Bake the user's approved Sylvara base, S1, S2 and Ultimate character sources plus dedicated UI art.

python3 tools/sprites/sylvara.py [source directory] [sprite output] [portrait output] [S1 source directory] [S2 source directory] [Ult source directory] [UI art directory]
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
from sylvara_art import bake_ui
import bailong as B

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else 'art/incoming/sylvara')
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else 'public/sprites')
PORTRAITS = Path(sys.argv[3] if len(sys.argv) > 3 else 'public/portraits')
S1 = Path(sys.argv[4]) if len(sys.argv) > 4 else SRC / 's1'
S2 = Path(sys.argv[5]) if len(sys.argv) > 5 else SRC / 's2'
ULT = Path(sys.argv[6]) if len(sys.argv) > 6 else SRC / 'ult'
ART = Path(sys.argv[7]) if len(sys.argv) > 7 else SRC / 'art'
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
    names = list(NAMES)
    scales = {name: scale for name in names}
    # S1 is now supplied: never silently replace its approved row with empty/base fallback art.
    if not (S1 / 's1_character.png').exists():
        raise FileNotFoundError(f'Required S1 source: {S1 / "s1_character.png"}')
    B.SRC = str(S1)
    groups['skill'] = A.sheet_frames('s1_character', [5, 5], False)
    B.SRC = str(SRC)
    names.append('skill')
    scales['skill'] = IDLE_BODY / A.body_h(groups['skill'][0])
    if not (S2 / 's2_character.png').exists():
        raise FileNotFoundError(f'Required S2 source: {S2 / "s2_character.png"}')
    B.SRC = str(S2)
    # F7's long detached arrowheads sit closer to F8's hair. Keep them owned by F7, which review playback skips.
    old_fixes = B.CLIP_FIXES.get('s2_character')
    B.CLIP_FIXES['s2_character'] = [(680, 550, 780, 685, 1, 'all')]
    groups['skill2'] = A.sheet_frames('s2_character', [5, 5], False)
    if old_fixes is None:
        B.CLIP_FIXES.pop('s2_character')
    else:
        B.CLIP_FIXES['s2_character'] = old_fixes
    B.SRC = str(SRC)
    names.append('skill2')
    scales['skill2'] = IDLE_BODY / A.body_h(groups['skill2'][0])
    if not (ULT / 'Ultimate character.png').exists():
        raise FileNotFoundError(f'Required Ult source: {ULT}')
    B.SRC = str(ULT)
    groups['ult'] = A.sheet_frames('Ultimate character', [5, 5], False)
    B.SRC = str(SRC)
    names.append('ult')
    scales['ult'] = IDLE_BODY / A.body_h(groups['ult'][0])
    cols = max(len(groups[name]) for name in names)
    probe = Image.new('RGBA', (260 * cols, 170 * 8))
    for row, name in enumerate(names):
        for col, fr in enumerate(groups[name]):
            A.paste_frame(probe, fr, row, col, scales[name], (0, 0))
    alpha = np.array(probe)[..., 3]
    torso = {name: [A.torso_x(alpha[row * 170:(row + 1) * 170, col * 260:(col + 1) * 260])
                    for col in range(len(groups[name]))] for row, name in enumerate(names)}
    shifts = A.stabilise(torso)
    sheet = Image.new('RGBA', probe.size)
    clipped = []
    for row, name in enumerate(names):
        for col, fr in enumerate(groups[name]):
            clipped.append(A.paste_frame(sheet, fr, row, col, scales[name], (shifts[name][col], 0)))
    if any(clipped):
        raise ValueError(f'Clipped character pixels: {clipped}')
    sheet.save(OUT / 'hero-sylvara.png', optimize=True)
    # Crop existing arrow pixels, retain their drawn orientation and scale with the character.
    arrow_image = Image.fromarray(arrow)
    arrow_image = arrow_image.crop(arrow_image.getbbox())
    arrow_image = arrow_image.resize((max(1, round(arrow_image.width * scale)),
                                      max(1, round(arrow_image.height * scale))), Image.Resampling.BOX)
    arrow_image.save(OUT / 'fx-sylvara-basic-arrow.png', optimize=True)
    # Dedicated supplied UI art is required; never restore the historical reference crop.
    bake_ui(ART, PORTRAITS.parent)
    print(json.dumps({'scales': scales, 'bodyHeight': IDLE_BODY, 'counts': {n: len(groups[n]) for n in names},
                      'sheet': sheet.size, 'projectile': arrow_image.size, 'clipped': sum(clipped)}, indent=2))


if __name__ == '__main__':
    main()
