"""Lin Xue — Lotus Spirit Physician (3★ healer / support, remodel roster #5) → hero-linxue.png + portrait + the lotus
light projectile of her basic action.

First batch = base sheet only (skills use the Healer class ids and fall back to the attack clip until s1/s2/ult arrive).
Same import pipeline as Tang Xun (tools/sprites/tangxun.py: bailong.py + aurel_v2.py helpers, k-means body seeds).

Sources (art/incoming/linxue, not committed):
  base_raw.png   labelled sheet "Lin Xue — Base Combat Sprite Sheet" (v2, ~4.5 heads like the rest of the roster — the
                 first chibi sheet is kept as base_raw_chibi.png): idle 3 (titled 4) · move 6 · hurt 3 · attack 6 ·
                 death 5 on #FF00FF with a title bar, a dark row-label column, cell grid lines and "r-f" captions →
                 clean_base() keeps only the sprite bands (grid-line pixels keyed) → base.png
  reference.png  turnaround + staff parts + palette; the face close-up (bottom right) becomes the portrait
                 (only while art/portrait.png is missing) · the loose lotus head (bottom left) becomes fx-linxue-lotus.png
                 NO despill: her palette is full of pinks (lotus, ribbons) that a magenta despill would grey out

Atlas: cols = longest row × 8 rows (skill rows 5–7 reserved), cell 260 × 170, root (feet) at (130, 155), facing right.

Usage: python3 tools/sprites/linxue.py [src dir] [sprite out dir] [portrait out dir]
"""
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import bailong as B  # noqa: E402

SRC = sys.argv[1] if len(sys.argv) > 1 else 'art/incoming/linxue'
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
    """keyed-out pixels keep their magenta RGB: the BOX downscale would bleed it into the pink edges → make them dark
    (no despill — the pinks of the lotus / ribbons are hers)"""
    im, n = _load(name)
    im = im.copy()
    im[im[..., 3] == 0, :3] = (16, 12, 14)
    return im, n


# sprite bands of the labelled sheet (rows between the cell top line and the caption line) and the label column edge
SHEET_BANDS = [(51, 214), (245, 406), (436, 595), (623, 780), (809, 965)]
LABEL_X = 147


def clean_base():
    """base_raw.png → base.png: magenta outside the sprite bands / left of the label column, grid-line pixels keyed"""
    raw = np.array(Image.open(f'{SRC}/base_raw.png').convert('RGB')).astype(int)
    out = np.zeros_like(raw)
    out[...] = (245, 3, 246)
    r, g, b = raw[..., 0], raw[..., 1], raw[..., 2]
    line = (g > 12) & (r > 200) & (b > 200) & (g < 200)
    for y0, y1 in SHEET_BANDS:
        band = raw[y0:y1].copy()
        ln = line[y0:y1]
        cols = ln.mean(0) > 0.35                         # vertical cell dividers of this row
        kill = ln & cols[None, :]
        kill = ndimage.binary_dilation(kill, structure=np.ones((1, 3))) & (ln | (g[y0:y1] < 40))
        band[kill] = (245, 3, 246)
        out[y0:y1, LABEL_X:] = band[:, LABEL_X:]
    Image.fromarray(out.astype(np.uint8)).save(f'{SRC}/base.png')


# labelled skill sheets (title bar, a caption bar under every cell, thin pink cell dividers): keep only the cell
# interiors → <name>.png on flat magenta. rows = (y0, y1, divider x's) in source px
GRID_SHEETS = {
    # base v2 (2026-10, ~4.5-head proportions like the other heroes; the first chibi sheet = base_raw_chibi.png):
    # the robes / hair of neighbouring idle poses touch → split by the sheet's own cells too
    'base': [(51, 214, [373, 607, 841]), (245, 406, [373, 607, 841, 1070, 1299]), (436, 595, [373, 607, 841]),
             (623, 780, [364, 603, 820, 1052, 1289]), (809, 965, [373, 600, 852, 1133])],
    # S2 v2 (roster proportions, plain 5 × 2 grid, no captions; the chibi sheet = s2_char_raw_chibi.png)
    's2_char': [(2, 470, [337, 671, 1002, 1335]), (472, 940, [337, 671, 1002, 1335])],
    # Ult Returning Spring Rite: 10 + 11 cells (the sheet repeats the "16. Recover 3" caption → 21 poses)
    'ult_char': [(55, 461, [162, 321, 503, 684, 864, 1037, 1220, 1402, 1574]),
                 (493, 804, [182, 369, 560, 735, 885, 1034, 1180, 1327, 1475, 1617])],
}


def clean_grid(name, rows, pad=4, edge=7):
    raw = np.array(Image.open(f'{SRC}/{name}_raw.png').convert('RGB'))
    out = np.zeros_like(raw)
    out[...] = (245, 3, 246)
    w = raw.shape[1]
    for y0, y1, divs in rows:
        xs = [edge] + divs + [w - edge]
        for a, b in zip(xs, xs[1:]):
            out[y0 + pad:y1 - pad, a + pad:b - pad] = raw[y0 + pad:y1 - pad, a + pad:b - pad]
    Image.fromarray(out).save(f'{SRC}/{name}.png')


B.load = load_dark

CELL_SPLIT = {'base', 's2_char', 'ult_char'}   # frames = the sheet's own cells (no watershed: neighbours' staffs / ribbons cross)


def grid_frames(file, counts):
    """one frame per captioned cell: every pixel belongs to the cell it was drawn in"""
    im, _ = B.load(file)
    hard = im[..., 3] >= B.ALPHA_CUT
    out = []
    bm, ws = B.body_markers, B.watershed
    for (y0, y1, divs), want in zip(GRID_SHEETS[file], counts):
        ys = np.nonzero(hard[y0:y1].any(1))[0]
        band = (y0 + int(ys.min()), y0 + int(ys.max()) + 1)
        bins = np.digitize(np.arange(im.shape[1]), divs) + 1
        full = np.broadcast_to(bins[None, :], (band[1] - band[0], im.shape[1]))
        B.body_markers = lambda h, n, full=full: (np.where(h, full, 0), n)
        B.watershed = lambda _e, _m, mask=None, full=full: np.where(mask, full, 0)
        out += B.clip_frames(im, band, want, 'feet', False)
    B.body_markers, B.watershed = bm, ws
    for fr in out:
        drop_strays(fr, reach=6)      # a neighbour's ribbon tip / sparkle that crossed the cell edge
    return out


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

# height of the base idle on screen (px, the lotus staff head included) — Bai Long ≈ 75, Yue Zheng 78, Mo Ye 74,
# Tang Xun 78 · Lin Xue v2 base: 82 px with the lotus staff head, width / area ≈ Yue Zheng (hair + sleeves)
IDLE_BODY = 80
BASE_COUNTS = [3, 6, 3, 6, 5]
BASE_NAMES = ['idle', 'walk', 'hurt', 'attack', 'die']
ATLAS_ROWS = 8          # 5 base rows + skill / skill2 / ult (empty until their sheets arrive)
SKILL_ROWS: list = [  # (anim, file, frames per source row) — rows 5, 6, 7 as the skill sheets arrive
    ('skill', 's1_char', [10]),   # S1 Lotus Prayer: ready → eyes closed prayer → staff raised (lotus glows) → palm out
    ('skill2', 's2_char', [5, 5]),
    ('ult', 'ult_char', [10, 11]),   # Ult Returning Spring Rite: ready → prayer → invoke → channel ×5 → release → recover
   # S2 Spirit Mend: ready → raise staff → channel → gather → release (staff out) → recover
]
COMMON_GROUND: dict = {}
HEAD_LOCK = {'skill', 'skill2', 'ult'}
HEAD_LOCK_MAX = {'ult': 4}
SPECK = 20          # px — smaller loose islands on the skill rows are key leftovers
ROOT_SHIFT: dict = {}
# face close-up of the reference sheet (x0, y0, x1, y1) in source px
FACE = (980, 560, 1446, 1084)
# the loose lotus head of the staff (bottom left of the reference) — the basic-action projectile
LOTUS = (36, 586, 186, 676)


def lotus_projectile():
    """the lotus head → fx-linxue-lotus.png (1 frame, a glowing bloom ~22 px; round, so angle0 is irrelevant)"""
    ref, _ = B.load('reference')
    x0, y0, x1, y1 = LOTUS
    k = ref[y0:y1, x0:x1].copy()
    ys, xs = np.nonzero(k[..., 3] > 0)
    k = k[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    img = Image.fromarray(k.astype(np.uint8))
    s = 22 / img.width
    img = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.BOX)
    a = np.array(img)
    a[..., 3] = np.where(a[..., 3] >= 96, 255, 0)
    Image.fromarray(a).save(f'{OUT}/fx-linxue-lotus.png', optimize=True)
    return a.shape[1], a.shape[0]


def main():
    clean_base()
    for name, rows in GRID_SHEETS.items():
        if name != 'base' and os.path.exists(f'{SRC}/{name}_raw.png'):
            clean_grid(name, rows)
    report = {'notes': [], 'rows': {}}
    base = grid_frames('base', BASE_COUNTS)
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
        frs = grid_frames(file, counts) if file in CELL_SPLIT else A.sheet_frames(file, counts, False)
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
    # a stationary cast: the torso stabiliser follows the reaching arm / raised staff → lock the HEAD instead
    # (left of the staff, the hair band just under the bun) so she stays planted while the arms move
    for r, (name, frs, _) in enumerate(rows):
        if name not in HEAD_LOCK:
            continue
        hx = []
        for c in range(len(frs)):
            cell = pa[r * B.CELL_H:(r + 1) * B.CELL_H, c * B.CELL_W:(c + 1) * B.CELL_W][:, :B.ROOT_X + 12] > 0
            top = np.nonzero(cell.any(1))[0].min()
            hx.append(np.nonzero(cell[top + 10:top + 26])[1].mean())
        ref = float(np.mean(hx))
        lim = HEAD_LOCK_MAX.get(name, 99)    # a lean is a pose, not drift: never slide the feet more than this
        shifts[name] = [float(np.clip(ref - h, -lim, lim)) for h in hx]
    report['shift_x'] = {k: [round(v, 1) for v in shifts[k]] for k in shifts}
    sheet = Image.new('RGBA', (B.CELL_W * cols, B.CELL_H * ATLAS_ROWS), (0, 0, 0, 0))
    for r, (name, frs, s) in enumerate(rows):
        report['rows'][name] = {'row': r, 'frames': len(frs),
                                'clipped': [B.paste(sheet, fr, r, c, s, (shifts[name][c] + ROOT_SHIFT.get(name, [0] * 99)[c], 0))
                                            for c, fr in enumerate(frs)]}
    # sheer ribbons over the magenta key break into loose pink specks: drop tiny islands on the skill rows
    arr = np.array(sheet)
    for r in range(len(BASE_NAMES), len(rows)):
        band = arr[r * B.CELL_H:(r + 1) * B.CELL_H]
        lab, n = ndimage.label(band[..., 3] > 0, np.ones((3, 3)))
        if n:
            size = ndimage.sum(np.ones(lab.shape), lab, range(1, n + 1))
            band[np.isin(lab, 1 + np.nonzero(size < SPECK)[0])] = 0
    sheet = Image.fromarray(arr)
    sheet.save(f'{OUT}/hero-linxue.png', optimize=True)
    report['lotus'] = lotus_projectile()
    report['sheet'] = {'cols': cols, 'rows': ATLAS_ROWS, 'size': sheet.size}

    # the user's painted portrait (art/portrait.png → public/portraits/linxue.webp, done by hand) wins over the crop
    if os.path.exists(f'{SRC}/art/portrait.png'):
        print(json.dumps(report, indent=1))
        return
    # portrait: face close-up, magenta keyed, on a pale jade → lotus-pink backdrop (Lotus Spring Qi)
    ref, _ = B.load('reference')
    x0, y0, x1, y1 = FACE
    face = ref[y0:y1, x0:x1].copy()
    ys, xs = np.nonzero(face[..., 3] > 0)
    face = face[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    S = 288
    yy, xx = np.mgrid[0:S, 0:S]
    t = np.clip((yy / S) * 0.8 + (xx / S) * 0.2, 0, 1)[..., None]
    bg = np.zeros((S, S, 4), np.uint8)
    top, bot = np.array([30, 58, 54]), np.array([120, 70, 96])
    bg[..., :3] = (top * (1 - t) + bot * t).astype(np.uint8)
    glow = np.exp(-(((xx - S * 0.45) ** 2 + (yy - S * 0.35) ** 2) / (2 * (S * 0.3) ** 2)))[..., None]
    bg[..., :3] = np.clip(bg[..., :3] + glow * np.array([70, 90, 70]), 0, 255).astype(np.uint8)
    bg[..., 3] = 255
    portrait = Image.fromarray(bg)
    f = Image.fromarray(face.astype(np.uint8))
    k = S * 1.02 / f.height
    f = f.resize((round(f.width * k), round(f.height * k)), Image.LANCZOS)
    portrait.alpha_composite(f, ((S - f.width) // 2 + 10, S - f.height + 4))
    pa = np.array(portrait)
    pa[:3, :] = pa[-3:, :] = pa[:, :3] = pa[:, -3:] = [150, 210, 180, 255]
    Image.fromarray(pa).convert('RGB').save(f'{POUT}/linxue.webp', quality=92)
    print(json.dumps(report, indent=1))


if __name__ == '__main__':
    main()
