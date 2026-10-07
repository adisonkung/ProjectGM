"""Yue Zheng — Iron Mountain Bastion (3★ Tank, remodel roster #2) → hero-yuezheng.png + portrait.

First batch = base sheet only (skills use the Tank class kit and fall back to the attack clip until s1/s2/ult arrive).
Same import pipeline as Bai Long / Aurel v2 (tools/sprites/bailong.py + aurel_v2.py helpers): magenta key, halo cut,
per-row watershed split seeded on the bodies, feet root from the body mask, chest stabilisation, pixelated render.

Sources (art/incoming/yuezheng, not committed):
  base.png       idle 6 · walk 8 · hurt 4 · attack 7 · die 6 (on #FF00FF)
  s1_char.png    Skill 1 Iron Wall Taunt, 10 frames in one row (character only, no VFX)
  reference.png  turnaround + weapons + palette; the face close-up (bottom right) becomes the portrait
                 (only while art/portrait.png is missing — the painted UI art replaces it)

Atlas: cols = longest row × 8 rows (skill rows reserved, empty for now), cell 260 × 170, root (feet) at (130, 155),
facing right — same cell / root as Aurel v2 (the big shield needs the width).

Usage: python3 tools/sprites/yuezheng.py [src dir] [sprite out dir] [portrait out dir]
"""
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import bailong as B  # noqa: E402

SRC = sys.argv[1] if len(sys.argv) > 1 else 'art/incoming/yuezheng'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'public/sprites'
POUT = sys.argv[3] if len(sys.argv) > 3 else 'public/portraits'
B.SRC = SRC
B.CELL_W, B.CELL_H, B.FOOT = 260, 170, 15
B.ROOT_X, B.ROOT_Y = 130, 155
import aurel_v2 as A  # noqa: E402  (after the cell constants: shares sheet_frames / torso_x / stabilise / body_h)

B.SRC = SRC          # aurel_v2 sets its own source dir on import

# body height of the base idle on screen (px) — same tank size as Aurel v2, Bai Long ≈ 75
IDLE_BODY = 78
BASE_COUNTS = [6, 8, 4, 7, 6]
BASE_NAMES = ['idle', 'walk', 'hurt', 'attack', 'die']
ATLAS_ROWS = 8          # 5 base rows + skill / skill2 / ult (empty until their sheets arrive)
SKILL_ROWS = [  # (anim, file, frames per source row) — rows 5, 6, 7
    ('skill', 's1_char', [10]),
    ('skill2', 's2_char', [12]),
    ('ult', 'ult_char', [8, 8]),
]
# face close-up of the reference sheet (x0, y0, x1, y1) in source px
FACE = (1362, 572, 1640, 868)


def main():
    report = {'notes': [], 'rows': {}}
    base = A.sheet_frames('base', BASE_COUNTS, False)
    groups, i = {}, 0
    for name, n in zip(BASE_NAMES, BASE_COUNTS):
        groups[name] = base[i:i + n]
        i += n
    sc = IDLE_BODY / A.body_h(groups['idle'][0])
    report['notes'].append(f'base scale {sc:.3f}')
    rows = [(n, groups[n], sc) for n in BASE_NAMES]
    # skill rows that have arrived (character only — VFX sheets come separately): same on-screen body as the idle
    for name, file, counts in SKILL_ROWS:
        if not os.path.exists(f'{SRC}/{file}.png'):
            continue
        frs = A.sheet_frames(file, counts, False)
        s = sc * A.body_h(groups['idle'][0]) / A.body_h(frs[0])
        rows.append((name, frs, s))
        report['notes'].append(f'{file}: {len(frs)} frames, scale {s:.3f}')
    cols = max(len(r[1]) for r in rows)
    probe = Image.new('RGBA', (B.CELL_W * cols, B.CELL_H * len(rows)), (0, 0, 0, 0))
    for r, (name, frs, s) in enumerate(rows):
        for c, fr in enumerate(frs):
            B.paste(probe, fr, r, c, s)
    pa = np.array(probe)[..., 3]
    tx = {name: [A.torso_x(pa[r * B.CELL_H:(r + 1) * B.CELL_H, c * B.CELL_W:(c + 1) * B.CELL_W]) for c in range(len(frs))]
          for r, (name, frs, _) in enumerate(rows)}
    shifts = A.stabilise(tx)
    report['shift_x'] = {k: [round(v, 1) for v in shifts[k]] for k in shifts}
    sheet = Image.new('RGBA', (B.CELL_W * cols, B.CELL_H * ATLAS_ROWS), (0, 0, 0, 0))
    for r, (name, frs, s) in enumerate(rows):
        report['rows'][name] = {'row': r, 'frames': len(frs),
                                'clipped': [B.paste(sheet, fr, r, c, s, (shifts[name][c], 0)) for c, fr in enumerate(frs)]}
    sheet.save(f'{OUT}/hero-yuezheng.png', optimize=True)
    report['sheet'] = {'cols': cols, 'rows': ATLAS_ROWS, 'size': sheet.size}

    # the user's painted portrait (art/portrait.png → public/portraits/yuezheng.webp, done by hand) wins over the crop
    if os.path.exists(f'{SRC}/art/portrait.png'):
        print(json.dumps(report, indent=1))
        return
    # portrait: face close-up, magenta keyed, on a navy → bronze backdrop (the shield's colours)
    ref, _ = B.load('reference')
    x0, y0, x1, y1 = FACE
    face = ref[y0:y1, x0:x1].copy()
    ys, xs = np.nonzero(face[..., 3] > 0)
    face = face[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    S = 288
    yy, xx = np.mgrid[0:S, 0:S]
    t = np.clip((yy / S) * 0.8 + (xx / S) * 0.2, 0, 1)[..., None]
    bg = np.zeros((S, S, 4), np.uint8)
    top, bot = np.array([30, 36, 62]), np.array([128, 44, 40])
    bg[..., :3] = (top * (1 - t) + bot * t).astype(np.uint8)
    glow = np.exp(-(((xx - S * 0.45) ** 2 + (yy - S * 0.35) ** 2) / (2 * (S * 0.3) ** 2)))[..., None]
    bg[..., :3] = np.clip(bg[..., :3] + glow * np.array([60, 52, 34]), 0, 255).astype(np.uint8)
    bg[..., 3] = 255
    portrait = Image.fromarray(bg)
    f = Image.fromarray(face.astype(np.uint8))
    k = S * 1.02 / f.height
    f = f.resize((round(f.width * k), round(f.height * k)), Image.LANCZOS)
    portrait.alpha_composite(f, ((S - f.width) // 2 + 10, S - f.height + 4))
    pa = np.array(portrait)
    pa[:3, :] = pa[-3:, :] = pa[:, :3] = pa[:, -3:] = [196, 160, 98, 255]
    Image.fromarray(pa).convert('RGB').save(f'{POUT}/yuezheng.webp', quality=92)
    print(json.dumps(report, indent=1))


if __name__ == '__main__':
    main()
