"""Garrick Stoneward — The Iron Bell (3★ Tank / Frontline Control, remodel roster #6) → hero-garrick.png + portrait.

First batch = base sheet only (skills use the Tank class ids, effects arranged to his kit; the skill rows fall back to
the attack clip until s1/s2/ult arrive). Same import pipeline as Tang Xun (tools/sprites/tangxun.py: bailong.py +
aurel_v2.py helpers, k-means body seeds, stray cut). Classic Western fantasy knight — no wuxia motifs.

Sources (art/incoming/garrick, not committed):
  base.png       idle 5 · walk 7 · hurt 4 · attack (overhead hammer slam, ground spark F5) 7 · die 6 (on #FF00FF, no labels)
  reference.png  full figure + hammer turnaround + armour details + 6 face close-ups + palette; the head and shoulders
                 of the full figure become the portrait (only while art/portrait.png is missing)

Atlas: cols = longest row × 8 rows (skill rows 5–7 reserved), cell 260 × 170, root (feet) at (130, 155), facing right.

Usage: python3 tools/sprites/garrick.py [src dir] [sprite out dir] [portrait out dir]
"""
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import bailong as B  # noqa: E402

SRC = sys.argv[1] if len(sys.argv) > 1 else 'art/incoming/garrick'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'public/sprites'
POUT = sys.argv[3] if len(sys.argv) > 3 else 'public/portraits'
B.SRC = SRC
B.CELL_W, B.CELL_H, B.FOOT = 260, 170, 15
B.ROOT_X, B.ROOT_Y = 130, 155
import aurel_v2 as A  # noqa: E402  (after the cell constants: shares sheet_frames / torso_x / stabilise / body_h)

B.SRC = SRC          # aurel_v2 sets its own source dir on import

from scipy import ndimage  # noqa: E402

_load = B.load


def load_dark(name):
    """no despill: the navy cape / violet scarf are his; keyed-out pixels keep their magenta RGB and the BOX downscale
    would bleed it into the edges → make them dark"""
    im, n = _load(name)
    im = im.copy()
    im[im[..., 3] == 0, :3] = (14, 14, 18)
    return im, n


B.load = load_dark


def cluster_markers(hard, want):
    """Dark robes + long hair break into several blobs per figure once opened (legs / blades / ponytail apart) and
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


def cell_frames(file, y0, y1, divs, want):
    """one frame per x-slot between `divs` (source px) inside the band y0..y1 — for rows whose figures touch end to end
    (the raised hammer of one pose meets the cape of the next, so blob seeds merge two poses)"""
    im, _ = B.load(file)
    hard = im[..., 3] >= B.ALPHA_CUT
    ys = np.nonzero(hard[y0:y1].any(1))[0]
    band = (y0 + int(ys.min()), y0 + int(ys.max()) + 1)
    bins = np.digitize(np.arange(im.shape[1]), divs) + 1
    full = np.broadcast_to(bins[None, :], (band[1] - band[0], im.shape[1]))
    bm, ws = B.body_markers, B.watershed
    B.body_markers = lambda h, n: (np.where(h, full, 0), n)
    B.watershed = lambda _e, _m, mask=None: np.where(mask, full, 0)
    try:
        return B.clip_frames(im, band, want, 'feet', False)
    finally:
        B.body_markers, B.watershed = bm, ws


A._markers = cluster_markers
A.grid_markers = cluster_markers   # skill rows: the same seeding (the hammer crosses into the neighbour frames)

# body height of the base idle on screen (px) — Bai Long ≈ 75, Yue Zheng 78, Mo Ye 74, Tang Xun 78, Lin Xue 82 ·
# Garrick: the heavy armoured knight, a touch taller than Yue Zheng
IDLE_BODY = 80
BASE_COUNTS = [5, 7, 4, 7, 6]
BASE_NAMES = ['idle', 'walk', 'hurt', 'attack', 'die']
ATLAS_ROWS = 8          # 5 base rows + skill / skill2 / ult (empty until their sheets arrive)
SKILL_ROWS: list = [  # (anim, file, frames per source row) — rows 5, 6, 7 as the skill sheets arrive
    ('skill', 's1_char', [10]),
    ('skill2', 's2_char', [10]),
    ('ult', 'ult_char', [10, 10]),
]
COMMON_GROUND: dict = {}
# base rows cut by fixed x-slots instead of blob seeds: name → (y0, y1, dividers) in source px
# attack: the overhead swing poses F2–F5 touch each other end to end (hammer head ↔ cape)
CELL_ROWS = {'attack': (600, 826, [215, 410, 585, 765, 1010, 1290])}
ROOT_SHIFT: dict = {}
# head and shoulders of the full figure on the reference sheet (x0, y0, x1, y1) in source px
FACE = (40, 40, 480, 480)


def main():
    report = {'notes': [], 'rows': {}}
    base = A.sheet_frames('base', BASE_COUNTS, False)
    groups, i = {}, 0
    for name, n in zip(BASE_NAMES, BASE_COUNTS):
        groups[name] = base[i:i + n]
        i += n
    for name, (y0, y1, divs) in CELL_ROWS.items():
        groups[name] = cell_frames('base', y0, y1, divs, BASE_COUNTS[BASE_NAMES.index(name)])
    # the walk is a run: the lowest foot of each frame is not always on the ground (flight frames) → every walk
    # frame keeps its drawn height above the row's common ground line instead of dropping its lowest pixel onto it
    ground = max(fr['root'][1] for fr in groups['walk'])
    for fr in groups['walk']:
        fr['root'] = (fr['root'][0], ground)
    # the ground spark of the hammer slam is drawn loose under the head: keep only what touches the figure
    for fr in groups['attack']:
        drop_strays(fr, reach=10)
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
        for a0, a1 in COMMON_GROUND.get(name, []):
            g = max(fr['root'][1] for fr in frs[a0:a1])
            for fr in frs[a0:a1]:
                fr['root'] = (fr['root'][0], g)
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
    sheet.save(f'{OUT}/hero-garrick.png', optimize=True)
    report['sheet'] = {'cols': cols, 'rows': ATLAS_ROWS, 'size': sheet.size}

    # the user's painted portrait (art/portrait.png → public/portraits/garrick.webp, done by hand) wins over the crop
    if os.path.exists(f'{SRC}/art/portrait.png'):
        print(json.dumps(report, indent=1))
        return
    # portrait: head and shoulders, magenta keyed, on a steel-blue → warm gold backdrop (Iron Bastion / Golden Lion)
    ref, _ = B.load('reference')
    x0, y0, x1, y1 = FACE
    face = ref[y0:y1, x0:x1].copy()
    ys, xs = np.nonzero(face[..., 3] > 0)
    face = face[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    S = 288
    yy, xx = np.mgrid[0:S, 0:S]
    t = np.clip((yy / S) * 0.8 + (xx / S) * 0.2, 0, 1)[..., None]
    bg = np.zeros((S, S, 4), np.uint8)
    top, bot = np.array([18, 24, 40]), np.array([96, 74, 34])
    bg[..., :3] = (top * (1 - t) + bot * t).astype(np.uint8)
    glow = np.exp(-(((xx - S * 0.45) ** 2 + (yy - S * 0.35) ** 2) / (2 * (S * 0.3) ** 2)))[..., None]
    bg[..., :3] = np.clip(bg[..., :3] + glow * np.array([70, 62, 30]), 0, 255).astype(np.uint8)
    bg[..., 3] = 255
    portrait = Image.fromarray(bg)
    f = Image.fromarray(face.astype(np.uint8))
    k = S * 1.02 / f.height
    f = f.resize((round(f.width * k), round(f.height * k)), Image.LANCZOS)
    portrait.alpha_composite(f, ((S - f.width) // 2 + 10, S - f.height + 4))
    pa = np.array(portrait)
    pa[:3, :] = pa[-3:, :] = pa[:, :3] = pa[:, -3:] = [200, 160, 80, 255]
    Image.fromarray(pa).convert('RGB').save(f'{POUT}/garrick.webp', quality=92)
    print(json.dumps(report, indent=1))


if __name__ == '__main__':
    main()
