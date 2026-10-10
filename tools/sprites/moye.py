"""Yue Zheng — Iron Mountain Bastion (3★ Tank, remodel roster #2) → hero-moye.png + portrait.

First batch = base sheet only (skills use the Assassin class kit and fall back to the attack clip until s1/s2/ult arrive).
Same import pipeline as Bai Long / Aurel v2 (tools/sprites/bailong.py + aurel_v2.py helpers): magenta key, halo cut,
per-row watershed split seeded on the bodies, feet root from the body mask, chest stabilisation, pixelated render.

Sources (art/incoming/moye, not committed):
  base.png       idle 6 · walk 8 · hurt 4 · attack 8 · die 7 (on #FF00FF) — big blade right hand, small blade left
  s1_char.png    Skill 1 Orchid Sever, 10 frames in one row (character only — VFX come from moye_s1.py)
  reference.png  turnaround + both blades + palette; the face close-up (bottom right) becomes the portrait
                 (only while art/portrait.png is missing — painted UI art replaces it)

Atlas: cols = longest row × 8 rows (skill rows 5–7 reserved), cell 260 × 170, root (feet) at (130, 155), facing right —
same cell as Yue Zheng (the big blade overhead / extended needs the width).

Usage: python3 tools/sprites/moye.py [src dir] [sprite out dir] [portrait out dir]
"""
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import bailong as B  # noqa: E402

SRC = sys.argv[1] if len(sys.argv) > 1 else 'art/incoming/moye'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'public/sprites'
POUT = sys.argv[3] if len(sys.argv) > 3 else 'public/portraits'
B.SRC = SRC
B.CELL_W, B.CELL_H, B.FOOT = 260, 170, 15
B.ROOT_X, B.ROOT_Y = 130, 155
import aurel_v2 as A  # noqa: E402  (after the cell constants: shares sheet_frames / torso_x / stabilise / body_h)

B.SRC = SRC          # aurel_v2 sets its own source dir on import

from scipy import ndimage  # noqa: E402


def cluster_markers(hard, want):
    """Mo Ye's dark robe + hair break into several blobs per figure once opened (legs / blades / ponytail apart) and
    two neighbours can touch through a blade or a lunging leg: seed each frame with every chunky blob whose x-centre
    falls in its cluster (1-D k-means on the blob centres, weighted by size) — opened harder until every frame has
    its own seed."""
    xs = np.nonzero(hard.any(0))[0]
    lo, hi = xs.min(), xs.max()
    best = None
    for k in (9, 15, 21, 27, 33, 39):
        body = ndimage.binary_opening(hard, structure=np.ones((k, k)))
        lab, n = ndimage.label(body)
        if n == 0:
            break
        sizes = ndimage.sum(body, lab, range(1, n + 1))
        keep = [i for i in range(n) if sizes[i] >= 250]
        cx = np.array([ndimage.center_of_mass(body, lab, i + 1)[1] for i in keep])
        w = np.array([sizes[i] for i in keep])
        cent = lo + (np.arange(want) + 0.5) * (hi - lo) / want
        for _ in range(50):
            a = np.argmin(np.abs(cx[:, None] - cent[None, :]), 1)
            new = np.array([np.average(cx[a == j], weights=w[a == j]) if (a == j).any() else cent[j] for j in range(want)])
            if np.allclose(new, cent):
                break
            cent = new
        a = np.argmin(np.abs(cx[:, None] - cent[None, :]), 1)
        if len(set(a.tolist())) < want:   # a cluster emptied: evenly spaced figures → fixed even centres
            cent = lo + (np.arange(want) + 0.5) * (hi - lo) / want
            a = np.argmin(np.abs(cx[:, None] - cent[None, :]), 1)
        # a seed blob must not span two frames: its width ≤ 1.2 × the frame spacing
        spacing = (hi - lo) / want
        wide = any((np.ptp(np.nonzero((lab == i + 1).any(0))[0]) > 1.2 * spacing) for i in keep)
        markers = np.zeros(hard.shape, np.int32)
        for j, i in enumerate(keep):
            markers[lab == i + 1] = a[j] + 1
        best = (markers, len(set(a.tolist())))
        if best[1] == want and not wide:
            return best
    return best


def drop_strays(fr, reach=4):
    """a neighbour's blade tip the watershed handed to this frame: keep only what touches the main figure (within
    `reach` px) — a held blade is always connected to its hand"""
    a = fr['img'][..., 3] > 0
    lab, n = ndimage.label(a)
    if n < 2:
        return
    sizes = ndimage.sum(a, lab, range(1, n + 1))
    main = lab == 1 + int(np.argmax(sizes))
    near = ndimage.binary_dilation(main, iterations=reach)
    keep = np.isin(lab, [i + 1 for i in range(n) if (near & (lab == i + 1)).any()])
    fr['img'][~keep] = 0


A._markers = cluster_markers
A.grid_markers = cluster_markers   # skill rows: the same seeding (blades cross into the neighbour frames)

# body height of the base idle on screen (px) — Bai Long ≈ 75, Yue Zheng 78 · Mo Ye a touch slimmer / shorter
IDLE_BODY = 74
BASE_COUNTS = [6, 8, 4, 8, 7]
BASE_NAMES = ['idle', 'walk', 'hurt', 'attack', 'die']
ATLAS_ROWS = 8          # 5 base rows + skill / skill2 / ult (empty until their sheets arrive)
SKILL_ROWS: list = [  # (anim, file, frames per source row) — rows 5, 6, 7 as the skill sheets arrive
    ('skill', 's1_char', [10]),
]
# baked root motion (atlas px, + = forward) per pose, from the skill's Timeline Sync Sheet (tools/sprites/moye_s1.py):
# Orchid Sever steps in ~12 px for the two cuts and gives half of it back in the recovery — never a dash
ROOT_SHIFT = {'skill': [0, 0, 0, 3, 9, 12, 12, 11, 8, 6]}
# face close-up of the reference sheet (x0, y0, x1, y1) in source px
FACE = (1240, 528, 1640, 912)


def main():
    report = {'notes': [], 'rows': {}}
    base = A.sheet_frames('base', BASE_COUNTS, False)
    groups, i = {}, 0
    for name, n in zip(BASE_NAMES, BASE_COUNTS):
        groups[name] = base[i:i + n]
        i += n
    # the walk is a run: the lowest foot of each frame is not always on the ground (flight frames) → every walk
    # frame keeps its drawn height above the row's common ground line instead of dropping its lowest pixel onto it
    ground = max(fr['root'][1] for fr in groups['walk'])
    for fr in groups['walk']:
        fr['root'] = (fr['root'][0], ground)
    sc = IDLE_BODY / A.body_h(groups['idle'][0])
    report['notes'].append(f'base scale {sc:.3f}')
    rows = [(n, groups[n], sc) for n in BASE_NAMES]
    # skill rows that have arrived (character only — VFX sheets come separately): same on-screen body as the idle
    for name, file, counts in SKILL_ROWS:
        if not os.path.exists(f'{SRC}/{file}.png'):
            continue
        frs = A.sheet_frames(file, counts, False)
        for fr in frs:
            drop_strays(fr)
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
                                'clipped': [B.paste(sheet, fr, r, c, s, (shifts[name][c] + ROOT_SHIFT.get(name, [0] * 99)[c], 0))
                                            for c, fr in enumerate(frs)]}
    sheet.save(f'{OUT}/hero-moye.png', optimize=True)
    report['sheet'] = {'cols': cols, 'rows': ATLAS_ROWS, 'size': sheet.size}

    # the user's painted portrait (art/portrait.png → public/portraits/moye.webp, done by hand) wins over the crop
    if os.path.exists(f'{SRC}/art/portrait.png'):
        print(json.dumps(report, indent=1))
        return
    # portrait: face close-up, magenta keyed, on a night-black → crimson backdrop (Shadow Orchid)
    ref, _ = B.load('reference')
    x0, y0, x1, y1 = FACE
    face = ref[y0:y1, x0:x1].copy()
    ys, xs = np.nonzero(face[..., 3] > 0)
    face = face[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    S = 288
    yy, xx = np.mgrid[0:S, 0:S]
    t = np.clip((yy / S) * 0.8 + (xx / S) * 0.2, 0, 1)[..., None]
    bg = np.zeros((S, S, 4), np.uint8)
    top, bot = np.array([20, 16, 30]), np.array([110, 18, 34])
    bg[..., :3] = (top * (1 - t) + bot * t).astype(np.uint8)
    glow = np.exp(-(((xx - S * 0.45) ** 2 + (yy - S * 0.35) ** 2) / (2 * (S * 0.3) ** 2)))[..., None]
    bg[..., :3] = np.clip(bg[..., :3] + glow * np.array([70, 20, 34]), 0, 255).astype(np.uint8)
    bg[..., 3] = 255
    portrait = Image.fromarray(bg)
    f = Image.fromarray(face.astype(np.uint8))
    k = S * 1.02 / f.height
    f = f.resize((round(f.width * k), round(f.height * k)), Image.LANCZOS)
    portrait.alpha_composite(f, ((S - f.width) // 2 + 10, S - f.height + 4))
    pa = np.array(portrait)
    pa[:3, :] = pa[-3:, :] = pa[:, :3] = pa[:, -3:] = [180, 40, 56, 255]
    Image.fromarray(pa).convert('RGB').save(f'{POUT}/moye.webp', quality=92)
    print(json.dumps(report, indent=1))


if __name__ == '__main__':
    main()
