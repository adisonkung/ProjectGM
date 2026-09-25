"""Generic sprite-sheet extractor for AI character sheets (real alpha, labels on the left).

Every solid blob is given to a row (by its centre y) and then to a frame inside that row
(k-means on blob centres, N frames per row), glow is given to the nearest solid pixel,
and each frame is anchored on its torso (median x of the middle band) and the row's ground line.

usage: from extract_char import extract
extract(src, label_x, rows=[(name, y_lo, y_hi, n_frames), ...], y_end, scale, out)
Output: cells 132x100, feet y=86, centre x=66, facing right.
"""
import numpy as np
from PIL import Image
from scipy import ndimage

CW, CX = 132, 66
CORE, REACH, ERODE = 90, 22, 1


def kmeans_1d(xs, ws, k, lo, hi, iters=40):
    c = np.linspace(lo, hi, k + 2)[1:-1] if k > 1 else np.array([(lo + hi) / 2])
    for _ in range(iters):
        lab = np.argmin(np.abs(xs[:, None] - c[None, :]), axis=1)
        new = np.array([np.average(xs[lab == j], weights=ws[lab == j]) if (lab == j).any() else c[j] for j in range(k)])
        if np.allclose(new, c):
            break
        c = new
    return np.sort(c)


def extract(src, label_x, rows, y_end, scale, out, anchor_band=(0.45, 0.85), report=True, centres=None, splits=None, CH=100):
    BASE_Y = CH - 14  # feet 14 px above the cell bottom, same as the 132x100 sheets
    A = np.array(Image.open(src).convert('RGBA')).astype(float)
    if isinstance(label_x, int):
        A[:, :label_x] = 0
    else:  # per-row label widths: [(y0, y1, x), ...]
        for y0, y1, x in label_x:
            A[y0:y1, :x] = 0
    A[y_end:] = 0
    A[A[..., 3] < 20] = 0
    alpha = A[..., 3]
    core = alpha >= CORE
    # erode before labelling so thin bridges (a sword tip touching the next frame) don't merge frames
    seed = ndimage.binary_erosion(core, iterations=ERODE)
    lab, n = ndimage.label(seed, structure=np.ones((3, 3)))
    idx = np.arange(1, n + 1)
    sizes = ndimage.sum(seed, lab, idx)
    coms = np.array(ndimage.center_of_mass(seed, lab, idx))
    # row of every blob: the band whose centre is nearest
    def frame_at(name, c, x):
        # explicit split lines win over nearest-centre (for frames whose weapon reaches far to one side)
        if splits and name in splits:
            return int(np.searchsorted(splits[name], x))
        return int(np.argmin(np.abs(c - x)))

    rc = np.array([(lo + hi) / 2 for _, lo, hi, _ in rows])
    row_of = np.full(n + 1, -1)
    for j in range(n):
        if sizes[j] < 3:
            continue
        y = coms[j][0]
        inside = [i for i, (_, lo, hi, _) in enumerate(rows) if lo <= y <= hi]
        row_of[j + 1] = inside[0] if inside else int(np.argmin(np.abs(rc - y)))
    frame_of = np.full(n + 1, -1)
    row_centres = []
    for i, (name, lo, hi, k) in enumerate(rows):
        js = [j for j in range(n) if row_of[j + 1] == i]
        xs = np.array([coms[j][1] for j in js]); ws = np.array([sizes[j] for j in js])
        c = np.array(centres[name]) if centres and name in centres else kmeans_1d(xs, ws, k, xs.min(), xs.max())
        row_centres.append(c)
        for j in js:
            frame_of[j + 1] = i * 100 + frame_at(name, c, coms[j][1])
    owner_core = frame_of[lab]
    # blobs that bridge two frames (a sword crossing into the next frame) or two rows: split per pixel
    objs = ndimage.find_objects(lab)
    spacing = min(np.median(np.diff(c)) for c in row_centres if len(c) > 1)
    for j, sl in enumerate(objs):
        if sl is None:
            continue
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        rh = min(hi - lo for _, lo, hi, _ in rows)
        if w <= spacing * 1.05 and h <= rh * 1.05:
            continue
        yy, xx = np.nonzero(lab[sl] == j + 1)
        yy = yy + sl[0].start; xx = xx + sl[1].start
        for y, x in zip(yy, xx):
            inside = [i for i, (_, lo, hi, _) in enumerate(rows) if lo <= y < hi]
            i = inside[0] if inside else int(np.argmin(np.abs(rc - y)))
            owner_core[y, x] = i * 100 + frame_at(rows[i][0], row_centres[i], x)
    dist, (iy, ix) = ndimage.distance_transform_edt(~seed, return_indices=True)
    owner = owner_core[iy, ix]
    owner[(alpha <= 0) | (dist > REACH)] = -1

    ncols = max(k for *_, k in rows)
    sheet = Image.new('RGBA', (CW * ncols, CH * len(rows)), (0, 0, 0, 0))
    problems = []
    for i, (name, lo, hi, k) in enumerate(rows):
        frames = []
        for f in range(k):
            m = owner == i * 100 + f
            # drop small loose bits (tips of a neighbour's sword that crossed the split)
            fl, fn = ndimage.label(ndimage.binary_dilation(m, iterations=2))
            if fn > 1:
                szs = ndimage.sum(m, fl, range(1, fn + 1))
                keep = [q + 1 for q, sz in enumerate(szs) if sz >= max(szs) * 0.08]
                m &= np.isin(fl, keep)
            ys, xs = np.nonzero(m & (alpha >= 150))
            if len(ys) == 0:
                frames.append(None); continue
            frames.append((m, ys, xs))
        bottoms = [fr[1].max() for fr in frames if fr]
        ground = int(np.median(bottoms))
        for f, fr in enumerate(frames):
            if not fr:
                problems.append(f'{name}[{f}] empty'); continue
            m, ys, xs = fr
            top, bot = ys.min(), ys.max()
            band = (ys >= top + (bot - top) * anchor_band[0]) & (ys <= top + (bot - top) * anchor_band[1])
            ax = float(np.median(xs[band])) if band.any() else float(np.median(xs))
            yy, xx = np.nonzero(m)
            y0, y1, x0, x1 = yy.min(), yy.max() + 1, xx.min(), xx.max() + 1
            crop = A[y0:y1, x0:x1].copy()
            crop[~m[y0:y1, x0:x1]] = 0
            img = Image.fromarray(np.clip(crop, 0, 255).astype(np.uint8))
            img = img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.LANCZOS)
            px = round(f * CW + CX - (ax - x0) * scale)
            py = round(i * CH + BASE_Y - (ground + 1 - y0) * scale)
            layer = Image.new('RGBA', sheet.size, (0, 0, 0, 0))
            layer.paste(img, (px, py), img)
            la = np.array(layer)
            clip = np.zeros(la.shape[:2], bool)
            clip[i * CH:(i + 1) * CH, f * CW:(f + 1) * CW] = True
            lost = la[..., 3][~clip].sum() / max(1, la[..., 3].sum())
            if lost > 0.01:
                problems.append(f'{name}[{f}] {lost:.0%} outside cell')
            la[~clip] = 0
            sheet.alpha_composite(Image.fromarray(la))
    sheet.save(out, optimize=True)
    if report:
        print(out, sheet.size, 'rows', [r[0] for r in rows])
        for (name, *_), c in zip(rows, row_centres):
            print('  ', name, [int(x) for x in c])
        for p in problems:
            print('  !', p)
    return sheet
