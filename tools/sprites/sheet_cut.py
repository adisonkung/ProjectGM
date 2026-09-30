"""Cut a labelled grid sheet ("Row N / ANIM / K Frames" + numbered bars, painted checkerboard) into a game sheet.

Generic version of monster_sheet.py for the special-dungeon art (art/incoming/<id>.png):
  1. background = the painted checkerboard (monster_sheet.background), label column (x < labelEnd),
     label bars (pastel or grey strips spanning the row) and panel borders (long straight low-saturation runs),
  2. rows = vertical clusters of what is left (merged down to the expected row count),
  3. frames = k-means on the x of the row's blobs (k = expected frame count),
  4. every frame is anchored on its feet (median x of the lowest quarter) and the row's ground line,
     flipped when that row faces LEFT, scaled so the idle body is `height` px tall and packed into cells
     (feet 14 px above the cell bottom, centred). Cell size = the largest frame extent.

usage: python3 tools/sprites/sheet_cut.py <id> [<id> …]   (sources art/incoming/<id>.png)
Writes public/sprites/enemy-<id with ->.png, /tmp/cut-<id>.png (preview) and prints cellW / cellH.
"""
import json
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, __file__.rsplit('/', 1)[0])
from monster_sheet import background  # noqa: E402

FEET = 14

# rows: frames per row (sheet order idle, move, hurt, death, attack, skills…) · flip: rows (0-based) or (row, frame) drawn facing LEFT
CONFIG = {
    'straw_recruit': dict(labelEnd=172, rows=[4, 6, 3, 6, 6], flip=[0, 1, 2, 3, (4, 0), (4, 5)], height=67),  # idle/move/hurt/death + attack wind-up/recover face LEFT
    'crossbow_dummy': dict(labelEnd=170, rows=[4, 6, 3, 6, 6, 6], flip=[0, 1, 2, 3, 4, 5], height=67),
    'drill_sergeant': dict(labelEnd=172, rows=[4, 6, 3, 6, 6, 8], flip=[(2, 0)], height=88),  # hurt frame 1 only
    'brass_shishi': dict(labelEnd=180, rows=[4, 6, 3, 7, 6, 6, 6], flip=[0, 1, 2, 3, 4], height=112),
    'moonblade_ronin': dict(labelEnd=185, rows=[4, 6, 3, 7, 6, 6, 6], flip=[0, 1, 2, 3, 4, 5, 6], height=136),
    'astral_seraph': dict(labelEnd=118, rows=[4, 6, 3, 7, 6, 6, 10], flip=[], height=140, holes=False, pastelBars=False,
                          tones=[(235, 236, 238), (214, 215, 218), (220, 220, 222), (252, 252, 252)]),
}


def background_tones(rgb, tones, tol=14):
    """checker keyed by its exact tones (for art whose own colours are pale neutrals, e.g. a marble statue)"""
    d = np.stack([np.abs(rgb - np.array(t)).max(-1) for t in tones])
    sat = rgb.max(-1) - rgb.min(-1)
    cand = (d.min(0) <= tol) & (sat <= 10)
    which = d.argmin(0)
    lab, n = ndimage.label(cand)
    idx = np.arange(1, n + 1)
    size = ndimage.sum(cand, lab, idx)
    dark = ndimage.sum(cand & (which != 0), lab, idx)
    light = ndimage.sum(cand & (which == 0), lab, idx)
    keep = np.zeros(n + 1, bool)
    keep[1:] = size > 1500  # no 'two-tone pocket' rule: the statue's own face / robe use the same greys
    return keep[lab]


def masks(rgb, label_end, holes=True, pastel_bars=True, tones=None):
    bg = background_tones(rgb, tones) if tones else background(rgb)
    if holes:  # small enclosed checker pockets (between legs, under arms) that show only one tone
        mx0, mn0 = rgb.max(-1), rgb.min(-1)
        pale = (mn0 >= 228) & (mx0 - mn0 < 12) & ~bg
        lab, n = ndimage.label(pale)
        sizes = ndimage.sum(pale, lab, np.arange(1, n + 1))
        ok = np.zeros(n + 1, bool)
        ok[1:] = sizes >= 6
        bg |= ok[lab]
    mx, mn = rgb.max(-1), rgb.min(-1)
    sat = mx - mn
    H, W = bg.shape
    # label bars: pastel (light, a little colour) or flat mid grey, spanning most of the row
    b_r = rgb[..., 2] - rgb[..., 0]
    barish = ((sat < 14) & (mx > 70) & (mx < 180))
    if pastel_bars:
        barish |= (b_r >= 5) & (mn >= 150) & (sat < 70)
    frac = barish[:, label_end:].mean(1)
    on = ndimage.binary_dilation(frac > 0.3, iterations=2)
    bars = np.zeros_like(bg)
    bars[on] = True
    # panel borders: long straight low-saturation runs
    solid = ~bg & (sat < 40)
    h = ndimage.binary_opening(solid, structure=np.ones((1, 70)))
    v = ndimage.binary_opening(solid, structure=np.ones((70, 1)))
    thick = ndimage.binary_opening(solid, structure=np.ones((7, 7)))
    lines = ndimage.binary_dilation((h | v) & ~thick, iterations=2)
    fg = ~bg & ~bars & ~lines
    fg[:, :label_end] = False
    # pale pixels in the strip right under a bar = checker halo, not art
    strip = ndimage.binary_dilation(bars, structure=np.ones((17, 1))) & ~bars
    fg &= ~(strip & (sat < 14) & (mn > 200))
    # drop specks and label text remnants
    lab, n = ndimage.label(fg, structure=np.ones((3, 3)))
    sizes = ndimage.sum(fg, lab, np.arange(1, n + 1))
    keep = np.zeros(n + 1, bool)
    keep[1:] = sizes >= 12
    # pale leftovers hugging a label bar (the checker strip right under a bar)
    near_bar = ndimage.binary_dilation(bars, iterations=5)
    pale = (sat < 14) & (mn > 196)
    idx = np.arange(1, n + 1)
    touch = ndimage.sum(near_bar, lab, idx) > 0
    palefrac = ndimage.mean(pale, lab, idx)
    keep[1:] &= ~(touch & (palefrac > 0.6))
    # broken panel-border slivers: thin, straight, low saturation
    satmean = ndimage.mean(sat, lab, np.arange(1, n + 1))
    for j, sl in enumerate(ndimage.find_objects(lab)):
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if satmean[j] < 45 and ((w <= 5 and h >= 8) or (h <= 5 and w >= 20)):
            keep[j + 1] = False
    return keep[lab]


def row_bands(fg, n):
    cnt = fg.sum(1)
    on = cnt > 0
    segs, y = [], 0
    while y < len(on):
        if on[y]:
            y0 = y
            while y < len(on) and on[y:y + 4].any():
                y += 1
            segs.append([y0, y, int(cnt[y0:y].sum())])
        y += 1
    segs = [s for s in segs if s[2] > 30]
    while len(segs) > n:  # merge the pair with the smallest gap (a spark floating above a head, …)
        gaps = [segs[i + 1][0] - segs[i][1] + (0 if min(segs[i][2], segs[i + 1][2]) < 3000 else 10_000) for i in range(len(segs) - 1)]
        i = int(np.argmin(gaps))
        segs[i] = [segs[i][0], segs[i + 1][1], segs[i][2] + segs[i + 1][2]]
        del segs[i + 1]
    if len(segs) != n:
        raise SystemExit(f'found {len(segs)} rows, expected {n}: {segs}')
    return [(a, b) for a, b, _ in segs]


def kmeans_1d(xs, ws, k, iters=80):
    c = np.linspace(np.percentile(xs, 1), np.percentile(xs, 99), k)
    for _ in range(iters):
        lab = np.argmin(np.abs(xs[:, None] - c[None, :]), axis=1)
        new = np.array([np.average(xs[lab == j], weights=ws[lab == j]) if (lab == j).any() else c[j] for j in range(k)])
        if np.allclose(new, c):
            break
        c = new
    return np.sort(c)


def frames_of(fg, y0, y1, k):
    band = np.zeros_like(fg)
    band[y0:y1] = fg[y0:y1]
    lab, n = ndimage.label(band, structure=np.ones((3, 3)))
    idx = np.arange(1, n + 1)
    sizes = ndimage.sum(band, lab, idx)
    coms = np.array([c[1] for c in ndimage.center_of_mass(band, lab, idx)])
    centres = kmeans_1d(coms, sizes, k)
    # split lines half-way between centres; blobs crossing a line are split per column
    splits = (centres[1:] + centres[:-1]) / 2
    colf = np.searchsorted(splits, np.arange(fg.shape[1]))
    out = [np.zeros_like(fg) for _ in range(k)]
    for j in range(n):
        m = lab == j + 1
        xs = np.nonzero(m.any(0))[0]
        f0, f1 = colf[xs[0]], colf[xs[-1]]
        if f0 == f1 or sizes[j] < 300:
            out[int(np.searchsorted(splits, coms[j]))] |= m
        else:
            for f in range(f0, f1 + 1):
                out[f] |= m & (colf == f)[None, :]
    return out


def cut(mid):
    cfg = CONFIG[mid]
    rgb = np.array(Image.open(f'art/incoming/{mid}.png').convert('RGB')).astype(int)
    fg = masks(rgb, cfg['labelEnd'], cfg.get('holes', True), cfg.get('pastelBars', True), cfg.get('tones'))
    bands = row_bands(fg, len(cfg['rows']))
    rows = []
    for r, ((y0, y1), k) in enumerate(zip(bands, cfg['rows'])):
        fr = frames_of(fg, y0, y1, k)
        info = []
        for m in fr:
            # stray specks far from the figure (border crumbs) — drop
            cl, cn = ndimage.label(m, structure=np.ones((3, 3)))
            if cn > 1:
                szs = ndimage.sum(m, cl, range(1, cn + 1))
                body = ndimage.binary_dilation(cl == np.argmax(szs) + 1, iterations=18)
                for j in range(cn):
                    if szs[j] < 200 and not (body & (cl == j + 1)).any():
                        m &= cl != j + 1
            ys, xs = np.nonzero(m)
            if not len(ys):
                raise SystemExit(f'{mid} row {r + 1}: empty frame')
            low = ys >= ys.max() - (ys.max() - ys.min()) * 0.25
            info.append(dict(m=m, ax=float(np.median(xs[low])), bottom=int(ys.max()), top=int(ys.min()), x0=int(xs.min()), x1=int(xs.max())))
        ground = int(np.median([i['bottom'] for i in info]))
        rows.append((ground, info))
        print(f'  row {r + 1}: y {y0}-{y1} · {k} frames · ground {ground}')
    idle = rows[0][1][0]
    S = cfg['height'] / (idle['bottom'] - idle['top'] + 1)
    # cell size from the largest extent around the anchor
    left = right = up = 0.0
    for ground, info in rows:
        for i in info:
            l, rr = (i['ax'] - i['x0']) * S, (i['x1'] - i['ax']) * S
            left, right, up = max(left, l, rr), max(right, l, rr), max(up, (ground - i['top']) * S)
    cw = int(np.ceil((max(left, right) + 4) * 2 / 2) * 2)
    ch = int(np.ceil(up + FEET + 6))
    cw, ch = max(cw, 132), max(ch, 100)
    ncol = max(cfg['rows'])
    sheet = Image.new('RGBA', (cw * ncol, ch * len(rows)), (0, 0, 0, 0))
    for r, (ground, info) in enumerate(rows):
        for f, i in enumerate(info):
            m = i['m']
            ys, xs = np.nonzero(m)
            ya, yb, xa, xb = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
            crop = np.zeros((yb - ya, xb - xa, 4), np.uint8)
            crop[..., :3] = rgb[ya:yb, xa:xb]
            crop[..., 3] = m[ya:yb, xa:xb] * 255
            img = Image.fromarray(crop)
            local = i['ax'] - xa
            if r in cfg['flip'] or (r, f) in cfg['flip']:
                img = img.transpose(Image.FLIP_LEFT_RIGHT)
                local = (xb - 1 - xa) - local
            img = img.resize((max(1, round(img.width * S)), max(1, round(img.height * S))), Image.LANCZOS)
            px = round(f * cw + cw / 2 - local * S)
            py = round(r * ch + (ch - FEET) - (ground + 1 - ya) * S)
            layer = Image.new('RGBA', sheet.size, (0, 0, 0, 0))
            layer.paste(img, (px, py), img)
            la = np.array(layer)
            clip = np.zeros(la.shape[:2], bool)
            clip[r * ch:(r + 1) * ch, f * cw:(f + 1) * cw] = True
            la[~clip] = 0
            sheet.alpha_composite(Image.fromarray(la))
    out = f'public/sprites/enemy-{mid.replace("_", "-")}.png'
    # 256-colour palette (the art is pixel art; keeps the big boss sheets light)
    sheet.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(out, optimize=True)
    prev = Image.new('RGBA', sheet.size, (52, 60, 78, 255))
    for r in range(len(rows)):  # cell grid + ground line
        for f in range(ncol):
            for x in range(f * cw, (f + 1) * cw):
                prev.putpixel((x, (r + 1) * ch - FEET), (90, 100, 120, 255))
    prev.alpha_composite(sheet)
    prev.save(f'/tmp/cut-{mid}.png')
    print(f'{mid}: {out} cell {cw}×{ch} scale {S:.3f}')
    return dict(cellW=cw, cellH=ch, rows=cfg['rows'])


if __name__ == '__main__':
    meta = {m: cut(m) for m in (sys.argv[1:] or CONFIG)}
    print(json.dumps(meta))
