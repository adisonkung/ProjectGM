"""Monster sheets from labelled grid art (the "Row N / ANIM / K Frames" layout used for the forest monsters).

The source art has a painted checkerboard (not real alpha), a label box on the left of every row and a
label bar under every frame. This script:
  1. keys out the checkerboard: bright neutral pixels in big regions, plus enclosed pockets that show both
     checker tones (e.g. between a bow and its string); highlights inside the outline stay,
  2. finds the label bars (pastel boxes) → the character band of each row and the frame splits,
  3. assigns every blob to a frame by its centre x, anchors frames on the body (median x of its lower half)
     and the row's ground line, flips to face right (the art faces LEFT) and packs 132×cellH cells
     (feet 14 px above the cell bottom, centre x=66).

usage: python3 tools/sprites/monster_sheet.py <id> <source.png> [out.png]
  ids: goblin_fighter, goblin_archer, forest_wolf, alpha_wolf
Writes public/sprites/enemy-<name>.png and /tmp/<id>-preview.png (+ the goblin arrow projectile).
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

CW, CX = 132, 66

# splits: approximate x of the panel borders between frames, per row (read off the sheet); each is snapped
# to the nearest detected vertical border line (±20 px). Blobs that cross a border are split per pixel.
CONFIG = {
    'goblin_fighter': dict(out='enemy-goblin-fighter.png', scale=0.47, cellH=100, splits=[
        [387, 599, 809], [387, 610, 837, 1067, 1297], [387, 597],
        [394, 617, 842, 1069, 1306], [393, 619, 842, 1072, 1309]]),
    'goblin_archer': dict(out='enemy-goblin-archer.png', scale=0.47, cellH=100, splits=[
        [385, 600, 810], [385, 610, 836, 1067, 1297], [385, 605],
        [392, 615, 840, 1068, 1305], [385, 615, 838, 1070, 1308]],
        # (row, frame, x) 0-based: in the release frame everything left of source x (in front of the bow)
        # is the flying arrow → cut out as the projectile sheet fx-goblin-arrow.png
        arrow=(4, 4, 1158)),
    'forest_wolf': dict(out='enemy-wolf.png', scale=0.47, cellH=100, splits=[
        [385, 608, 855], [366, 602, 836, 1062, 1294], [384, 612],
        [384, 614, 832, 1068, 1305], [386, 611, 836, 1063, 1311]]),
    'alpha_wolf': dict(out='enemy-alpha-wolf.png', scale=0.53, cellH=120, splits=[
        [405, 645, 882], [404, 642, 876, 1091, 1312], [407, 625],
        [380, 564, 756, 947, 1148, 1341], [401, 630, 858, 1084, 1306],
        [345, 518, 682, 848, 1016, 1179, 1352]]),
}
LABEL_END = 172  # the "Row N" boxes on the left


def neutral_bright(rgb, lo=190):
    mx, mn = rgb.max(-1), rgb.min(-1)
    return ((mx - mn) < 16) & (mx >= lo)


def background(rgb):
    cand = neutral_bright(rgb)
    lab, n = ndimage.label(cand)
    idx = np.arange(1, n + 1)
    size = ndimage.sum(cand, lab, idx)
    v = rgb.max(-1)
    dark = ndimage.sum(cand & (v < 232), lab, idx)  # checker tone ~210
    light = ndimage.sum(cand & (v >= 232), lab, idx)  # checker tone ~253
    keep_bg = (size > 2500) | ((size > 25) & (dark > size * 0.15) & (light > size * 0.15))
    bg = np.zeros(n + 1, bool)
    bg[1:] = keep_bg
    return bg[lab]


def snap_splits(rgb, top, bot, guess, tol=20):
    mx, mn = rgb.max(-1), rgb.min(-1)
    grey = (((mx - mn) < 34) & (mx > 90) & (mx < 236))[top:bot]
    lines = np.nonzero(grey.mean(0) > 0.6)[0]
    out = []
    for g in guess:
        near = lines[np.abs(lines - g) <= tol]
        out.append(float(near[np.argmin(np.abs(near - g))]) if len(near) else float(g))
    return out


def kmeans_1d(xs, ws, k, iters=60):
    order = np.argsort(xs)
    lo, hi = np.percentile(xs, 1), np.percentile(xs, 99)
    c = np.linspace(lo, hi, k)
    for _ in range(iters):
        lab = np.argmin(np.abs(xs[:, None] - c[None, :]), axis=1)
        new = np.array([np.average(xs[lab == j], weights=ws[lab == j]) if (lab == j).any() else c[j] for j in range(k)])
        if np.allclose(new, c):
            break
        c = new
    return np.sort(c)


def pastel(rgb):
    mx, mn = rgb.max(-1), rgb.min(-1)
    return ((mx - mn) >= 18) & (mn >= 150)


def label_bands(rgb):
    """y-ranges of the label bars (rows where many pastel pixels sit right of the row labels)"""
    p = pastel(rgb)[:, LABEL_END:]
    cnt = p.sum(1)
    on = cnt > p.shape[1] * 0.25
    bands, y = [], 0
    while y < len(on):
        if on[y]:
            y0 = y
            while y < len(on) and on[y]:
                y += 1
            if bands and y0 - bands[-1][1] < 20:  # a bar split by its text line
                bands[-1] = (bands[-1][0], y)
            elif y - y0 >= 8:
                bands.append((y0, y))
        y += 1
    return bands


def bar_splits(rgb, y0, y1, k):
    """x split lines between the k label bars of one row"""
    yc = (y0 + y1) // 2
    line = ~neutral_bright(rgb[yc - 2:yc + 3], 180).all(0)
    line[:LABEL_END] = False
    runs, x = [], 0
    while x < len(line):
        if line[x]:
            x0 = x
            # bars are solid; neighbouring bars are 2–4 px apart, so only bridge 1 px holes
            while x < len(line) and (line[x] or line[x + 1:x + 2].any()):
                x += 1
            if x - x0 > 40:
                runs.append((x0, x))
        x += 1
    if len(runs) != k:
        raise SystemExit(f'row at y={yc}: found {len(runs)} label bars, expected {k}: {runs}')
    return [(runs[i][1] + runs[i + 1][0]) / 2 for i in range(k - 1)], runs


def extract(mid, src, out=None):
    cfg = CONFIG[mid]
    rgb = np.array(Image.open(src).convert('RGB')).astype(int)
    fg = ~background(rgb)
    fg[:, :LABEL_END] = False
    bands = label_bands(rgb)
    if len(bands) != len(cfg['splits']):
        raise SystemExit(f'found {len(bands)} label rows {bands}, expected {len(cfg["splits"])}')
    CH, S = cfg['cellH'], cfg['scale']
    BASE_Y = CH - 14
    ncol = max(len(sp) + 1 for sp in cfg['splits'])
    sheet = Image.new('RGBA', (CW * ncol, CH * len(bands)), (0, 0, 0, 0))
    arrow_img = None
    prev = 0
    for i, ((ly0, ly1), guess) in enumerate(zip(bands, cfg['splits'])):
        k = len(guess) + 1
        top, bot = prev + 3, ly0 - 1
        prev = ly1
        band = np.zeros_like(fg)
        band[top:bot] = fg[top:bot]
        # the label bar's top edge (pastel/grey dots) touches the feet: keep only dark/saturated pixels there
        mx, mn = rgb.max(-1), rgb.min(-1)
        edge = np.zeros_like(fg)
        edge[bot - 6:bot] = True
        band &= ~(edge & ((mn >= 120) | ((mx - mn) < 30)))
        # thin panel border lines (grey, 1–3 px) — remove long straight runs
        band &= ~_lines(rgb, band)
        lab, n = ndimage.label(band, structure=np.ones((3, 3)))
        idx = np.arange(1, n + 1)
        sizes = ndimage.sum(band, lab, idx)
        coms = ndimage.center_of_mass(band, lab, idx)
        objs = ndimage.find_objects(lab)

        def keep(j):
            sl = objs[j]
            h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
            thin = min(h, w) <= 3 or (max(h, w) > 30 and sizes[j] < 0.12 * h * w and min(h, w) <= 6)
            return sizes[j] >= 20 and not thin

        big = [j for j in range(n) if keep(j)]
        splits = snap_splits(rgb, top, bot, guess)
        masks = [np.zeros_like(fg) for _ in range(k)]
        colframe = np.searchsorted(splits, np.arange(fg.shape[1]))  # frame of every source column
        for j in big:
            sl = objs[j]
            comp = lab[sl] == j + 1
            f0, f1 = colframe[sl[1].start], colframe[sl[1].stop - 1]
            if f0 == f1 or sizes[j] < 400:
                masks[int(np.searchsorted(splits, coms[j][1]))][sl] |= comp
            else:  # crosses a panel border: split per pixel column
                for f in range(f0, f1 + 1):
                    cm = comp & (colframe[sl[1]] == f)[None, :]
                    masks[f][sl] |= cm
        frames = []
        for f, m in enumerate(masks):
            if not m.any():
                raise SystemExit(f'row {i + 1}: frame {f + 1} is empty — centres {np.round(centres)}')
            cl, cn = ndimage.label(m, structure=np.ones((3, 3)))
            szs = ndimage.sum(m, cl, range(1, cn + 1))
            body = cl == (np.argmax(szs) + 1)
            if cfg.get('arrow', (None, None))[:2] == (i, f):
                cut = m.copy()
                cut[:, cfg['arrow'][2]:] = False
                arrow_img = _crop(rgb, cut, S)
                m = m & ~cut
                body &= m
            ys, xs = np.nonzero(body)
            lower = ys >= ys.min() + (ys.max() - ys.min()) * 0.5
            frames.append((m, float(np.median(xs[lower])), ys.max()))
        ground = int(np.median([b for *_, b in frames]))
        for f, (m, ax, _) in enumerate(frames):
            yy, xx = np.nonzero(m)
            ya, yb, xa, xb = yy.min(), yy.max() + 1, xx.min(), xx.max() + 1
            crop = np.zeros((yb - ya, xb - xa, 4), np.uint8)
            crop[..., :3] = rgb[ya:yb, xa:xb]
            crop[..., 3] = m[ya:yb, xa:xb] * 255
            img = Image.fromarray(crop).transpose(Image.FLIP_LEFT_RIGHT)  # the art faces left
            local = (xb - 1) - ax
            img = img.resize((max(1, round(img.width * S)), max(1, round(img.height * S))), Image.LANCZOS)
            px = round(f * CW + CX - local * S)
            py = round(i * CH + BASE_Y - (ground + 1 - ya) * S)
            layer = Image.new('RGBA', sheet.size, (0, 0, 0, 0))
            layer.paste(img, (px, py), img)
            la = np.array(layer)
            clip = np.zeros(la.shape[:2], bool)
            clip[i * CH:(i + 1) * CH, f * CW:(f + 1) * CW] = True
            lost = la[..., 3][~clip].sum() / max(1, la[..., 3].sum())
            if lost > 0.003:
                print(f'  ! row {i + 1} frame {f + 1}: {lost:.1%} outside the cell')
            la[~clip] = 0
            sheet.alpha_composite(Image.fromarray(la))
        print(f'row {i + 1}: {k} frames, band y {top}-{bot}, ground {ground}')
    out = out or f'public/sprites/{cfg["out"]}'
    sheet.save(out, optimize=True)
    print(out, sheet.size)
    if arrow_img is not None:
        # projectile sheet: 1 frame, pointing right (angle0 = 0)
        a = arrow_img
        pad = Image.new('RGBA', (a.width + 4, a.height + 4), (0, 0, 0, 0))
        pad.paste(a, (2, 2), a)
        pad.save('public/sprites/fx-goblin-arrow.png', optimize=True)
        print('public/sprites/fx-goblin-arrow.png', pad.size)
    prev_img = Image.new('RGBA', sheet.size, (52, 60, 78, 255))
    prev_img.alpha_composite(sheet)
    prev_img.resize((sheet.width * 2, sheet.height * 2), Image.NEAREST).save(f'/tmp/{mid}-preview.png')


def _lines(rgb, band):
    """long thin straight runs of grey (the panel borders): exactly horizontal/vertical, ≤ 4 px thick"""
    mx, mn = rgb.max(-1), rgb.min(-1)
    grey = band & ((mx - mn) < 34) & (mx > 90)
    h = ndimage.binary_opening(grey, structure=np.ones((1, 14)))
    v = ndimage.binary_opening(grey, structure=np.ones((14, 1)))
    thick = ndimage.binary_opening(grey, structure=np.ones((5, 5)))
    return ndimage.binary_dilation((h | v) & ~thick, iterations=1)


def _crop(rgb, part, S):
    yy, xx = np.nonzero(part)
    ya, yb, xa, xb = yy.min(), yy.max() + 1, xx.min(), xx.max() + 1
    crop = np.zeros((yb - ya, xb - xa, 4), np.uint8)
    crop[..., :3] = rgb[ya:yb, xa:xb]
    crop[..., 3] = part[ya:yb, xa:xb] * 255
    img = Image.fromarray(crop).transpose(Image.FLIP_LEFT_RIGHT)
    return img.resize((max(1, round(img.width * S)), max(1, round(img.height * S))), Image.LANCZOS)


if __name__ == '__main__':
    extract(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
