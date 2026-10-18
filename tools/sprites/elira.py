"""Elira: bake approved base/reference and supplied S1/S2/Ultimate character without modifying sources.

python3 tools/sprites/elira.py [base source dir] [sprites out] [portraits out] [S1 source dir] [S2 source dir] [Ultimate source dir] [UI art dir]
Sources: base.png from Elira_master_base.zip. S1/S2/Ultimate and dedicated Elira_icn.zip UI sources are required.
"""
import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, os.path.dirname(__file__))
import aurel_v2 as A
import bailong as B
from elira_art import SOURCES as UI_SOURCES, bake_ui

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else 'art/incoming/elira')
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


def body_extent(frame):
    """Measure the connected character, excluding detached staff ornaments and sparks.

    Opening alone is insufficient: a thick ornament can survive it above the head.
    Use the largest opened component, and compare equivalent ready poses only.
    """
    mask = ndimage.binary_opening(frame['img'][..., 3] >= B.ALPHA_CUT,
                                  structure=np.ones((9, 9)))
    labels, count = ndimage.label(mask)
    if not count:
        raise ValueError('No connected character body to measure')
    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    ys = np.nonzero(labels == sizes.argmax())[0]
    return int(ys.max() - ys.min())


def support_scale(reference, frames, base_scale):
    # One scale for the entire clip. The first/last standing poses avoid raised-arm bias.
    extent = np.median([body_extent(frames[0]), body_extent(frames[-1])])
    return base_scale * body_extent(reference) / extent


def main():
    # Fail before writing outputs if dedicated art is missing; no reference-crop fallback.
    for filename in UI_SOURCES.values():
        if not (ART / filename).is_file():
            raise FileNotFoundError(f'Required Elira UI art: {ART / filename}')
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
    # S1 source is now required: future rebakes cannot silently restore the base-only fallback.
    if not (S1 / 'Skill 1 Character Action Only.png').exists():
        raise FileNotFoundError(f'Required S1 source: {S1}')
    B.SRC = str(S1)
    groups['skill'] = A.sheet_frames('Skill 1 Character Action Only', [5, 5], False)
    B.SRC = str(SRC)
    if not (S2 / 'Skill 2 Character Action Only.png').exists():
        raise FileNotFoundError(f'Required S2 source: {S2}')
    B.SRC = str(S2)
    groups['skill2'] = A.sheet_frames('Skill 2 Character Action Only', [5, 5], False)
    B.SRC = str(SRC)
    if not (ULT / 'Ultimate Character Action Only.png').exists():
        raise FileNotFoundError(f'Required Ultimate source: {ULT}')
    B.SRC = str(ULT)
    groups['ult'] = A.sheet_frames('Ultimate Character Action Only', [5, 5], False)
    B.SRC = str(SRC)
    names = NAMES + ['skill', 'skill2', 'ult']
    scales = {name: scale for name in NAMES}
    scales['skill'] = support_scale(groups['idle'][0], groups['skill'], scale)
    scales['skill2'] = 78 / A.body_h(groups['skill2'][0])
    scales['ult'] = support_scale(groups['idle'][0], groups['ult'], scale)
    probe = Image.new('RGBA', (260 * 10, 170 * 8))
    for row, name in enumerate(names):
        for col, fr in enumerate(groups[name]):
            A.paste_frame(probe, fr, row, col, scales[name], (0, 0))
    alpha = np.array(probe)[..., 3]
    torso = {name: [A.torso_x(alpha[row*170:(row+1)*170, col*260:(col+1)*260])
                    for col in range(len(groups[name]))] for row, name in enumerate(names)}
    shifts = A.stabilise(torso)
    sheet = Image.new('RGBA', probe.size)
    clipped = []
    for row, name in enumerate(names):
        for col, fr in enumerate(groups[name]):
            # Source Idle F3/F4 have a displaced root: same-size details sink 8/7 atlas px.
            # Correct translation only; preserve the source breathing and all action poses.
            dy = {2: -8, 3: -7}.get(col, 0) if name == 'idle' else 0
            clipped.append(A.paste_frame(sheet, fr, row, col, scales[name], (shifts[name][col], dy)))
    if any(clipped):
        raise ValueError(f'Clipped source pixels: {clipped}')
    sheet.save(OUT / 'hero-elira.png', optimize=True)
    bake_ui(ART, PORTRAITS.parent)
    print(json.dumps({'counts': COUNTS, 'scale': scale, 'bodyHeight': 78,
                      'scales': scales, 'sheet': sheet.size, 'clipped': sum(clipped)}, indent=2))


if __name__ == '__main__':
    main()
