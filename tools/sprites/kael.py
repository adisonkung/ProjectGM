"""Kael Ashen Vanguard (3★ Fighter / Frontline DPS · Guard Breaker, remodel roster #7) → hero-kael.png + portrait.

First batch = base sheet only (skills use the Tank class ids, effects arranged to his kit; the skill rows fall back to
the attack clip until s1/s2/ult arrive). Same import pipeline as Garrick (tools/sprites/garrick.py: bailong.py +
aurel_v2.py helpers, k-means body seeds, stray cut). Classic fantasy swordsman (Kingdom Adventurers) — no wuxia motifs.

Sources = the canonical asset directory assets/heroes/Kael (user 2026-10; not committed, never edited):
  character/kael_base_combat.png       idle 5 · walk (run) 7 · hurt 4 · attack (overhead cut → thrust, slash arc drawn on F3–F4) 7 · die 6
                 (on #FF00FF, no labels)
  reference/kael_master_reference.png  full figure + 4 action poses + longsword / scabbard turnaround + armour details + 6 face close-ups +
                 palette; the head and shoulders
                 of the full figure become the portrait (only while art/portrait.png is missing)

Atlas: cols = longest row × 8 rows (skill rows 5–7 reserved), cell 260 × 170, root (feet) at (130, 155), facing right.

Usage: python3 tools/sprites/kael.py [src dir] [sprite out dir] [portrait out dir]
"""
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import bailong as B  # noqa: E402

SRC = sys.argv[1] if len(sys.argv) > 1 else 'assets/heroes/Kael'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'public/sprites'
POUT = sys.argv[3] if len(sys.argv) > 3 else 'public/portraits'
B.SRC = SRC
B.CELL_W, B.CELL_H, B.FOOT = 260, 170, 15
B.ROOT_X, B.ROOT_Y = 130, 155
import aurel_v2 as A  # noqa: E402  (after the cell constants: shares sheet_frames / torso_x / stabilise / body_h)

B.SRC = SRC          # aurel_v2 sets its own source dir on import

from scipy import ndimage  # noqa: E402

_load = B.load


# logical sheet names (the pipeline keys behaviour on them, e.g. 'base') → canonical files in assets/heroes/Kael
FILES = {
    'base': 'character/kael_base_combat',
    'reference': 'reference/kael_master_reference',
    's1_char': 'character/kael_s1_character',
    's2_char': 'character/kael_s2_character_14f',
    'ult_char': 'character/kael_ult_character',
}


def load_dark(name):
    """no despill: the burgundy cape / scarf are his; keyed-out pixels keep their magenta RGB and the BOX downscale
    would bleed it into the edges → make them dark"""
    im, n = _load(FILES.get(name, name))
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


def comp_frames(file, y0, y1, divs, want):
    """one frame per connected figure: every 8-connected blob of the band goes whole to the slot its centre falls in
    (`divs` = x dividers in source px; a divider may be a polyline [(local y from, x), …] for poses that overlap in x),
    only a blob that really spans a divider (≥ 15 % of it on both sides — two poses touching, e.g. a thrust blade tip on
    the next pose's cape) is cut along that divider. Keeps a slash arc / sword with its own pose where fixed x-slots or
    blob seeds would hand it to the neighbour."""
    im, _ = B.load(file)
    hard = im[..., 3] >= B.ALPHA_CUT
    ys = np.nonzero(hard[y0:y1].any(1))[0]
    band = (y0 + int(ys.min()), y0 + int(ys.max()) + 1)
    h = hard[band[0]:band[1]]
    H, W = h.shape
    yy = np.arange(H)[:, None] + (band[0] - y0)

    def divx(d):   # divider x per local row (relative to y0) → (H, 1)
        if isinstance(d, (int, float)):
            return np.full((H, 1), d)
        x = np.full((H, 1), d[0][1])
        for yf, xv in d:
            x[yy[:, 0] >= yf] = xv
        return x

    dx = [divx(d) for d in divs]
    xx = np.broadcast_to(np.arange(W)[None, :], (H, W))
    slot = np.ones((H, W), np.int32)
    for d in dx:
        slot += xx >= d
    lab, n = ndimage.label(h, structure=np.ones((3, 3)))
    full = np.zeros((H, W), np.int32)
    for i in range(1, n + 1):
        m = lab == i
        ks, cnt = np.unique(slot[m], return_counts=True)
        if len(ks) > 1 and np.sort(cnt)[-2] >= 0.15 * m.sum():
            full[m] = slot[m]
        else:
            full[m] = ks[np.argmax(cnt)]
    bm, ws = B.body_markers, B.watershed
    B.body_markers = lambda hh, nn: (np.where(hh, full, 0), nn)
    B.watershed = lambda _e, _m, mask=None: np.where(mask, full, 0)
    try:
        return B.clip_frames(im, band, want, 'feet', False)
    finally:
        B.body_markers, B.watershed = bm, ws


A._markers = cluster_markers
A.grid_markers = cluster_markers   # skill rows: the same seeding (the hammer crosses into the neighbour frames)

# body height of the base idle on screen (px) — Bai Long ≈ 75, Yue Zheng 78, Mo Ye 74, Tang Xun 78, Lin Xue 82,
# Garrick 80 · Kael: a well-built young swordsman, between Bai Long and Garrick
IDLE_BODY = 78
BASE_COUNTS = [5, 7, 4, 7, 6]
BASE_NAMES = ['idle', 'walk', 'hurt', 'attack', 'die']
ATLAS_ROWS = 8          # 5 base rows + skill / skill2 / ult (empty until their sheets arrive)
SKILL_ROWS: list = [  # (anim, file, frames per source row) — rows 5, 6, 7 as the skill sheets arrive
    ('skill', 's1_char', [5, 5]),     # S1 Sundering Edge: heavy diagonal cut (frame counts set when the sheet arrives)
    ('skill2', 's2_char', [7, 7]),    # S2 Relentless Cross: horizontal cut → rising reverse cut
    ('ult', 'ult_char', [5, 5]),      # Ult Ashen Rupture: gather → sword overhead → one forward cut → sword wave
]
# skills are integrated one at a time after the user approves the previous one (2026-10) — rows 5 / 6 / 7 stay in place
ENABLED = {'skill', 'skill2', 'ult'}
# one size correction per skill clip on top of the idle-height match (README: one factor per clip, never per frame):
# S1's first pose is a crouched ready stance, so matching its height to the standing idle drew him ~13 % too big —
# measured against the base attack's matching ready pose (height 80 vs 69 px, SIFT median ≈ 1.12) · S2: its ready
# stance has bent knees yet stood as tall as the idle → ~8 % big (SIFT vs S1 ≈ 1.07–1.11, vs idle ≈ 1.0–1.04)
CLIP_SCALE = {'skill': 0.885, 'skill2': 0.92, 'ult': 0.83}
# F8's blade tip touches F9's boot on the ult sheet: hand that tip back to F8 (source px; index = frame in its row)
B.CLIP_FIXES['ult_char'] = [(1040, 735, 1072, 782, 2, None), (1072, 755, 1094, 780, 2, None)]
COMMON_GROUND: dict = {}
SHIFT_MAX = {'skill': 3, 'skill2': 4, 'ult': 4}
# base rows cut by fixed x-slots instead of blob seeds: name → (y0, y1, dividers) in source px
CELL_ROWS: dict = {}
# base rows cut per connected figure (comp_frames): name → (y0, y1, dividers) in source px — the automatic seeds split
# a running pose in two / merged two falling poses / gave the thrust's slash arc to the next pose
COMP_ROWS = {
    'walk': (250, 440, [224, 428, 621, 817, 1023, 1221]),
    'attack': (640, 852, [188, 366, 580, 860, [(0, 1108), (100, 1062)], 1244]),
    'die': (872, 1042, [178, 356, 559, 788, 1080]),
}
ROOT_SHIFT: dict = {}
# head and shoulders of the full figure on the reference sheet (x0, y0, x1, y1) in source px
FACE = (50, 60, 370, 340)
# canonical file names inside SRC (no extension)
BASE = 'base'
REF = 'reference'


def main():
    report = {'notes': [], 'rows': {}}
    base = A.sheet_frames(BASE, BASE_COUNTS, False)
    groups, i = {}, 0
    for name, n in zip(BASE_NAMES, BASE_COUNTS):
        groups[name] = base[i:i + n]
        i += n
    for name, (y0, y1, divs) in CELL_ROWS.items():
        groups[name] = cell_frames(BASE, y0, y1, divs, BASE_COUNTS[BASE_NAMES.index(name)])
    for name, (y0, y1, divs) in COMP_ROWS.items():
        groups[name] = comp_frames(BASE, y0, y1, divs, BASE_COUNTS[BASE_NAMES.index(name)])
    # the walk is a run: the lowest foot of each frame is not always on the ground (flight frames) → every walk
    # frame keeps its drawn height above the row's common ground line instead of dropping its lowest pixel onto it
    ground = max(fr['root'][1] for fr in groups['walk'])
    for fr in groups['walk']:
        fr['root'] = (fr['root'][0], ground)
    # hurt: loose hit debris around the body; attack: keep the drawn slash arc (it touches the blade / cape)
    for fr in groups['hurt']:
        drop_strays(fr)
    for fr in groups['attack']:
        drop_strays(fr, reach=14)
    sc = IDLE_BODY / A.body_h(groups['idle'][0])
    report['notes'].append(f'base scale {sc:.3f}')
    rows = [(n, groups[n], sc) for n in BASE_NAMES]
    # skill rows that have arrived (character only — VFX sheets come separately): same on-screen body as the idle
    for name, file, counts in SKILL_ROWS:
        if name not in ENABLED or not os.path.exists(f'{SRC}/{FILES[file]}.png'):
            continue
        frs = A.sheet_frames(file, counts, False)
        for fr in frs:
            drop_strays(fr)
        if name == 'skill2':      # F4–F6 redrawn as a horizontal cut (user 2026-10) — derived frames, source untouched
            import kael_s2_edit
            frs = kael_s2_edit.apply(frs)
        for a0, a1 in COMMON_GROUND.get(name, []):
            g = max(fr['root'][1] for fr in frs[a0:a1])
            for fr in frs[a0:a1]:
                fr['root'] = (fr['root'][0], g)
        s = sc * A.body_h(groups['idle'][0]) / A.body_h(frs[0])
        s *= CLIP_SCALE.get(name, 1.0)
        rows.append((name, frs, s))
        report['notes'].append(f'{file}: {len(frs)} frames, scale {s:.3f}')
    cols = max(len(r[1]) for r in rows)
    probe = Image.new('RGBA', (B.CELL_W * cols, B.CELL_H * len(rows)), (0, 0, 0, 0))
    for r, (name, frs, s) in enumerate(rows):
        for c, fr in enumerate(frs):
            A.paste_frame(probe, fr, r, c, s, (0, 0))
    pa = np.array(probe)[..., 3]
    tx = {name: [A.torso_x(pa[r * B.CELL_H:(r + 1) * B.CELL_H, c * B.CELL_W:(c + 1) * B.CELL_W]) for c in range(len(frs))]
          for r, (name, frs, _) in enumerate(rows)}
    shifts = A.stabilise(tx)
    # the approved base rows keep the shifts they were built with (base rows only), skill rows are stabilised with them
    shifts.update(A.stabilise({k: v for k, v in tx.items() if k in BASE_NAMES}))
    # a planted cast (S1 brace): the torso stabiliser chases the hammer / widening stance → the feet may slide at most
    # SHIFT_MAX px so he stays planted
    for name, lim in SHIFT_MAX.items():
        if name in shifts:
            shifts[name] = [float(np.clip(v, -lim, lim)) for v in shifts[name]]
    report['shift_x'] = {k: [round(v, 1) for v in shifts[k]] for k in shifts}
    sheet = Image.new('RGBA', (B.CELL_W * cols, B.CELL_H * ATLAS_ROWS), (0, 0, 0, 0))
    for r, (name, frs, s) in enumerate(rows):
        report['rows'][name] = {'row': r, 'frames': len(frs),
                                'clipped': [A.paste_frame(sheet, fr, r, c, s, (shifts[name][c] + ROOT_SHIFT.get(name, [0] * 99)[c], 0))
                                            for c, fr in enumerate(frs)]}
    sheet.save(f'{OUT}/hero-kael.png', optimize=True)
    report['sheet'] = {'cols': cols, 'rows': ATLAS_ROWS, 'size': sheet.size}

    # the user's painted portrait (art/incoming/kael/art/portrait.png → public/portraits/kael.webp, done by hand) wins over
    # the crop — UI art lives beside the old incoming sources, never inside the canonical assets/heroes/Kael
    if os.path.exists('art/incoming/kael/art/portrait.png') or os.path.exists(f'{SRC}/art/portrait.png'):
        print(json.dumps(report, indent=1))
        return
    # portrait: head and shoulders, magenta keyed, on an ash-grey → burgundy / ember backdrop (Ashen Vanguard)
    ref, _ = B.load(REF)
    x0, y0, x1, y1 = FACE
    face = ref[y0:y1, x0:x1].copy()
    ys, xs = np.nonzero(face[..., 3] > 0)
    face = face[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    S = 288
    yy, xx = np.mgrid[0:S, 0:S]
    t = np.clip((yy / S) * 0.8 + (xx / S) * 0.2, 0, 1)[..., None]
    bg = np.zeros((S, S, 4), np.uint8)
    top, bot = np.array([26, 24, 30]), np.array([110, 34, 30])
    bg[..., :3] = (top * (1 - t) + bot * t).astype(np.uint8)
    glow = np.exp(-(((xx - S * 0.45) ** 2 + (yy - S * 0.35) ** 2) / (2 * (S * 0.3) ** 2)))[..., None]
    bg[..., :3] = np.clip(bg[..., :3] + glow * np.array([80, 56, 30]), 0, 255).astype(np.uint8)
    bg[..., 3] = 255
    portrait = Image.fromarray(bg)
    f = Image.fromarray(face.astype(np.uint8))
    k = S * 1.02 / f.height
    f = f.resize((round(f.width * k), round(f.height * k)), Image.LANCZOS)
    portrait.alpha_composite(f, ((S - f.width) // 2 + 10, S - f.height + 4))
    pa = np.array(portrait)
    pa[:3, :] = pa[-3:, :] = pa[:, :3] = pa[:, -3:] = [200, 160, 80, 255]
    Image.fromarray(pa).convert('RGB').save(f'{POUT}/kael.webp', quality=92)
    print(json.dumps(report, indent=1))


if __name__ == '__main__':
    main()
