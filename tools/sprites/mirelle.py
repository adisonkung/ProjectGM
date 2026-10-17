"""Bake approved Mirelle base combat + portrait; no skill production/timeline.

python3 tools/sprites/mirelle.py [source directory] [sprite output] [portrait output]
Sources: base.png / reference.png, copied byte-for-byte from the user's mirelle-source.zip.
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
    probe = Image.new('RGBA', (260 * 7, 170 * 8))
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

    # Existing approved face close-up; crop/key/resize only, no redrawing or colour changes.
    reference, _ = B.load('reference')
    face = Image.fromarray(reference).crop((1040, 550, 1440, 1080))
    face.thumbnail((288, 288), Image.Resampling.LANCZOS)
    portrait = Image.new('RGBA', (288, 288), (24, 40, 67, 255))
    portrait.alpha_composite(face, ((288 - face.width) // 2, (288 - face.height) // 2))
    portrait.convert('RGB').save(PORTRAITS / 'mirelle.webp', quality=92)
    print(json.dumps({'scale': scale, 'bodyHeight': IDLE_BODY, 'counts': COUNTS,
                      'sheet': sheet.size, 'projectile': shard.size, 'clipped': sum(clipped)}, indent=2))


if __name__ == '__main__':
    main()
