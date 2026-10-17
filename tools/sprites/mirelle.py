"""Bake approved Mirelle base combat, supplied UI art and skill character sources.

python3 tools/sprites/mirelle.py [source directory] [sprite output] [portrait output]
Sources: base.png, skill PNGs and art/*.png from the user's approved ZIPs.
Shared chroma key, body-seeded watershed, root placement and torso stabilisation match the other heroes.
Requires numpy, scipy, scikit-image, Pillow (same dependencies as bailong.py).
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

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else 'art/incoming/mirelle')
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else 'public/sprites')
PORTRAITS = Path(sys.argv[3] if len(sys.argv) > 3 else 'public/portraits')
B.SRC = str(SRC)
B.CELL_W, B.CELL_H, B.ROOT_X, B.ROOT_Y = 260, 170, 130, 155
NAMES = ['idle', 'walk', 'hurt', 'attack', 'die']
COUNTS = [5, 7, 4, 7, 6]
IDLE_BODY = 78


def separate_projectile(fr):
    """Detached flying ice shard is not character pixels. Retain nearby book/crystal-focus details."""
    mask = fr['img'][..., 3] > 0
    labels, count = ndimage.label(mask)
    sizes = ndimage.sum(mask, labels, range(1, count + 1))
    main = labels == int(np.argmax(sizes)) + 1
    near = ndimage.binary_dilation(main, iterations=14)
    keep = np.isin(labels, [i + 1 for i in range(count) if (near & (labels == i + 1)).any()])
    fr['img'][~keep] = 0


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    PORTRAITS.mkdir(parents=True, exist_ok=True)
    frames = A.sheet_frames('base', COUNTS, False)
    groups, offset = {}, 0
    for name, count in zip(NAMES, COUNTS):
        groups[name] = frames[offset:offset + count]
        offset += count
    for fr in groups['attack']:
        separate_projectile(fr)
    # Running feet can be airborne; use one source-row ground line, never snap each foot to the ground.
    ground = max(fr['root'][1] for fr in groups['walk'])
    for fr in groups['walk']:
        fr['root'] = (fr['root'][0], ground)
    scale = IDLE_BODY / A.body_h(groups['idle'][0])
    names = list(NAMES)
    scales = {name: scale for name in names}
    if (SRC / 's1/s1_character.png').exists():
        groups['skill'] = A.sheet_frames('s1/s1_character', [5, 5], False)
        names.append('skill')
        scales['skill'] = IDLE_BODY / A.body_h(groups['skill'][0])
    if (SRC / 's2/s2_character.png').exists():
        groups['skill2'] = A.sheet_frames('s2/s2_character', [10, 10], False)
        names.append('skill2')
        scales['skill2'] = IDLE_BODY / A.body_h(groups['skill2'][0])
    if (SRC / 'ult/ult_character.png').exists():
        groups['ult'] = A.sheet_frames('ult/ult_character', [8, 6, 6], False)
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
    sheet.save(OUT / 'hero-mirelle.png', optimize=True)

    # Normal-attack projectile only, directly cropped from the approved base sheet's free ice shard.
    base, _ = B.load('base')
    shard_pixels = base[728:755, 1006:1071].copy()
    labels, count = ndimage.label(shard_pixels[..., 3] > 0)
    sizes = ndimage.sum(shard_pixels[..., 3] > 0, labels, range(1, count + 1))
    shard_pixels[labels != int(np.argmax(sizes)) + 1] = 0
    shard = Image.fromarray(shard_pixels)
    shard = shard.resize((round(shard.width * scale), round(shard.height * scale)), Image.Resampling.BOX)
    shard.save(OUT / 'fx-mirelle-basic-crystal.png', optimize=True)

    # Approved new portrait/UI sources are required; never silently restore the old reference crop.
    portrait = Image.open(SRC / 'art/portrait.png').convert('RGB')
    portrait = portrait.resize((288, 288), Image.Resampling.LANCZOS)
    portrait.save(PORTRAITS / 'mirelle.webp', quality=92)
    for part in ['s1', 's2', 'ult', 'banner']:
        source = SRC / 'art' / f'{part}.png'
        folder = PORTRAITS.parent / ('banners' if part == 'banner' else 'skills')
        folder.mkdir(parents=True, exist_ok=True)
        art = Image.open(source).convert('RGB')
        size = (1400, round(art.height * 1400 / art.width)) if part == 'banner' else (160, 160)
        art = art.resize(size, Image.Resampling.LANCZOS)
        name = 'mirelle.webp' if part == 'banner' else f'mirelle-{part}.webp'
        art.save(folder / name, quality=92)
    print(json.dumps({'scales': scales, 'bodyHeight': IDLE_BODY, 'counts': {n: len(groups[n]) for n in names},
                      'sheet': sheet.size, 'projectile': shard.size, 'clipped': sum(clipped)}, indent=2))


if __name__ == '__main__':
    main()
