"""Tang Xun — Whispering Blade (3★ ranged hidden-weapon specialist, remodel roster #4) → hero-tangxun.png + portrait
+ the throwing-knife projectile.

First batch = base sheet only (skills use the Archer class ids and fall back to the attack clip until s1/s2/ult arrive).
Same import pipeline as Mo Ye (tools/sprites/moye.py: bailong.py + aurel_v2.py helpers, k-means body seeds, stray cut).

Sources (art/incoming/tangxun, not committed):
  base.png       idle 6 · walk (run) 8 · hurt 3 · attack (throw) 8 · die 6 (on #FF00FF) — the knife in flight drawn
                 between the throw frames is NOT part of the character (dropped as a stray; the projectile is separate)
  reference.png  turnaround + knives + bracers + palette; the face close-up (bottom right) becomes the portrait
                 (only while art/portrait.png is missing) · the flying knife (top middle) becomes fx-tangxun-knife.png

Atlas: cols = longest row × 8 rows (skill rows 5–7 reserved), cell 260 × 170, root (feet) at (130, 155), facing right.

Usage: python3 tools/sprites/tangxun.py [src dir] [sprite out dir] [portrait out dir]
"""
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import bailong as B  # noqa: E402

SRC = sys.argv[1] if len(sys.argv) > 1 else 'art/incoming/tangxun'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'public/sprites'
POUT = sys.argv[3] if len(sys.argv) > 3 else 'public/portraits'
B.SRC = SRC
B.CELL_W, B.CELL_H, B.FOOT = 260, 170, 15
B.ROOT_X, B.ROOT_Y = 130, 155
import aurel_v2 as A  # noqa: E402  (after the cell constants: shares sheet_frames / torso_x / stabilise / body_h)

B.SRC = SRC          # aurel_v2 sets its own source dir on import

from scipy import ndimage  # noqa: E402

_load = B.load


def load_despill(name):
    """Tang Xun has no magenta / purple in his palette (jade, navy, black, brown, skin): the purple-tinted fringe the
    key leaves on his dark hair / robe edges is pulled back to neutral (85 % of the common r / b excess over g removed)"""
    im, n = _load(name)
    px = im.astype(np.int16)
    r, g, b = px[..., 0], px[..., 1], px[..., 2]
    tint = np.minimum(r - g, b - g)
    m = (px[..., 3] > 0) & (tint > 4)
    cut = (tint * 0.85).astype(np.int16)
    px[..., 0] = np.where(m, r - cut, r)
    px[..., 2] = np.where(m, b - cut, b)
    # keyed-out pixels keep their magenta RGB: the BOX downscale would bleed it into the edges → make them dark
    px[px[..., 3] == 0, :3] = (12, 14, 16)
    return px.astype(np.uint8), n


B.load = load_despill


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


A._markers = cluster_markers
A.grid_markers = cluster_markers   # skill rows: the same seeding (blades cross into the neighbour frames)

# body height of the base idle on screen (px) — Bai Long ≈ 75, Yue Zheng 78, Mo Ye 74 · Tang Xun tall and lean
IDLE_BODY = 78
BASE_COUNTS = [6, 8, 3, 8, 6]
BASE_NAMES = ['idle', 'walk', 'hurt', 'attack', 'die']
ATLAS_ROWS = 8          # 5 base rows + skill / skill2 / ult (empty until their sheets arrive)
SKILL_ROWS: list = [  # (anim, file, frames per source row) — rows 5, 6, 7 as the skill sheets arrive
    ('skill', 's1_char', [10]),
]
COMMON_GROUND: dict = {}
ROOT_SHIFT: dict = {}
# face close-up of the reference sheet (x0, y0, x1, y1) in source px
FACE = (1040, 572, 1422, 1056)
# the knife in flight (with its speed lines) on the reference sheet — the attack projectile
KNIFE = (1080, 236, 1232, 280)


def knife_projectile():
    """the flying knife → fx-tangxun-knife.png (1 frame, points right = angle0 0), magenta keyed, cropped tight"""
    ref, _ = B.load('reference')
    x0, y0, x1, y1 = KNIFE
    k = ref[y0:y1, x0:x1].copy()
    ys, xs = np.nonzero(k[..., 3] > 0)
    k = k[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    img = Image.fromarray(k.astype(np.uint8))
    s = 0.2                                  # ~30 px long: a touch above the base sheet scale so it reads in flight
    img = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.BOX)
    a = np.array(img)
    a[..., 3] = np.where(a[..., 3] >= 96, 255, 0)
    Image.fromarray(a).save(f'{OUT}/fx-tangxun-knife.png', optimize=True)
    return a.shape[1], a.shape[0]


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
    # the knife in flight between the throw frames is not part of the character (the projectile draws it)
    for fr in groups['attack']:
        drop_strays(fr)
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
    sheet.save(f'{OUT}/hero-tangxun.png', optimize=True)
    report['knife'] = knife_projectile()
    report['sheet'] = {'cols': cols, 'rows': ATLAS_ROWS, 'size': sheet.size}

    # the user's painted portrait (art/portrait.png → public/portraits/tangxun.webp, done by hand) wins over the crop
    if os.path.exists(f'{SRC}/art/portrait.png'):
        print(json.dumps(report, indent=1))
        return
    # portrait: face close-up, magenta keyed, on a night-black → jade backdrop (Whispering Blade)
    ref, _ = B.load('reference')
    x0, y0, x1, y1 = FACE
    face = ref[y0:y1, x0:x1].copy()
    ys, xs = np.nonzero(face[..., 3] > 0)
    face = face[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    S = 288
    yy, xx = np.mgrid[0:S, 0:S]
    t = np.clip((yy / S) * 0.8 + (xx / S) * 0.2, 0, 1)[..., None]
    bg = np.zeros((S, S, 4), np.uint8)
    top, bot = np.array([14, 22, 26]), np.array([22, 92, 70])
    bg[..., :3] = (top * (1 - t) + bot * t).astype(np.uint8)
    glow = np.exp(-(((xx - S * 0.45) ** 2 + (yy - S * 0.35) ** 2) / (2 * (S * 0.3) ** 2)))[..., None]
    bg[..., :3] = np.clip(bg[..., :3] + glow * np.array([30, 70, 58]), 0, 255).astype(np.uint8)
    bg[..., 3] = 255
    portrait = Image.fromarray(bg)
    f = Image.fromarray(face.astype(np.uint8))
    k = S * 1.02 / f.height
    f = f.resize((round(f.width * k), round(f.height * k)), Image.LANCZOS)
    portrait.alpha_composite(f, ((S - f.width) // 2 + 10, S - f.height + 4))
    pa = np.array(portrait)
    pa[:3, :] = pa[-3:, :] = pa[:, :3] = pa[:, -3:] = [90, 190, 150, 255]
    Image.fromarray(pa).convert('RGB').save(f'{POUT}/tangxun.webp', quality=92)
    print(json.dumps(report, indent=1))


if __name__ == '__main__':
    main()
