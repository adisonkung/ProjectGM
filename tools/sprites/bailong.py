"""Bai Long (White Dragon Spear) — import the user's four source images into game assets.

The four images have different jobs and are NEVER merged into one picture:
  reference.png  (image 1) master visual reference on #FF00FF — not imported, only checked for the palette
  base.png       (image 2) base combat sheet: idle 6 · move 8 · hurt 4 · attack 6 · death 7
  thrust.png     (image 3) Dragon Thrust CHARACTER animation, 2 rows x 5 = 10 frames
  vfx.png        (image 4) Dragon Thrust VFX (white/blue dragon qi), 2 columns x 7 rows = 14 frames, row-major

Outputs (public/sprites):
  hero-bailong.png            character atlas: rows idle, walk, hurt, attack, die, skill (Dragon Thrust)
                              cell CELL_W x CELL_H, root (feet, bottom-centre) at (CELL_W/2, CELL_H-15), facing right
  fx-bailong-dragon-thrust.png  separate VFX strip, pivot = the tail of the dragon (left-centre), travels left -> right

Pipeline per image: magenta chroma key -> alpha (any #FF00FF-ish pixel), soft dark halo removed (alpha hardened for
the character, glow kept for the VFX), frames found as blobs per row band (small sparkles join the nearest frame),
root = feet found on the body mask with the spear shaft opened away (never from the PNG bounds), area-average
downscale (rendering uses nearest-neighbour), every frame pasted at the same root.

Usage: python3 tools/sprites/bailong.py <dir with reference/base/thrust/vfx.png> <out dir>
Prints the measured weapon-tip anchor (for FX dx/dy) and the per-frame crop report.
"""
import json
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

SRC = sys.argv[1] if len(sys.argv) > 1 else 'art/incoming/bailong'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'public/sprites'

CELL_W, CELL_H, FOOT = 200, 120, 15        # wide cell: the spear may overflow the 132 px body cell
ROOT_X, ROOT_Y = CELL_W // 2, CELL_H - FOOT
BASE_SCALE = 0.36                           # base sheet: body ~66 px tall like Jin / Ragnar
ALPHA_CUT = 96                              # below = the soft dark halo of the AI render → transparent

report = {'frames': {}, 'notes': []}


def load(name):
    im = np.array(Image.open(f'{SRC}/{name}.png').convert('RGBA')).astype(np.int16)
    # magenta chroma key (#FF00FF ± tolerance, incl. anti-aliased magenta fringe)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    key = (r > 180) & (b > 180) & (g < 90) & (np.abs(r - b) < 70)
    im[key, 3] = 0
    return im.astype(np.uint8), int(key.sum())


def harden(im):
    out = im.copy()
    out[..., 3] = np.where(im[..., 3] >= ALPHA_CUT, 255, 0)
    return out


def bands(mask, cuts=None):
    rows = mask.any(1)
    out, y = [], 0
    while y < len(rows):
        if rows[y]:
            y0 = y
            while y < len(rows) and rows[y]:
                y += 1
            if y - y0 > 10:
                out.append([y0, y])
        y += 1
    return out


def split_band(mask, y0, y1, want):
    """blobs in one row band → `want` frames: (x0, x1, own-pixel mask) — sparkles join the nearest frame, far strays drop"""
    m = mask[y0:y1]
    # raw 4-connected blobs: neighbouring frames whose spear tips almost touch stay apart (no dilation here)
    lab, n = ndimage.label(m)
    objs = ndimage.find_objects(lab)
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    order = sorted(range(n), key=lambda i: -sizes[i])
    big = sorted(order[:want], key=lambda i: objs[i][1].start)
    frames = [[objs[i][1].start, objs[i][1].stop, [i + 1]] for i in big]
    for i in order[want:]:
        cx = (objs[i][1].start + objs[i][1].stop) / 2
        gap = lambda j: 0 if frames[j][0] <= cx <= frames[j][1] else min(abs(cx - frames[j][0]), abs(cx - frames[j][1]))
        k = min(range(want), key=gap)
        if gap(k) > 40 or sizes[i] < 4:
            continue
        f = frames[k]
        f[0], f[1] = min(f[0], objs[i][1].start), max(f[1], objs[i][1].stop)
        f[2].append(i + 1)
    return [(x0, x1, np.isin(lab, ids)) for x0, x1, ids in frames]


def body_root(crop_a, mode):
    """root of one frame from its body mask (spear shaft + hair strands opened away): (x, y) in crop px"""
    m = crop_a > 0
    body = ndimage.binary_opening(m, structure=np.ones((13, 13)))
    if body.sum() < 200:
        body = m
    ys, xs = np.nonzero(body)
    foot_y = ys.max()
    if mode == 'mass':
        return float(np.median(xs)), float(foot_y)
    low = ys >= foot_y - 0.15 * (foot_y - ys.min())
    return float((xs[low].min() + xs[low].max()) / 2), float(foot_y)


def frames_of(im, band_list, counts, names, modes):
    """frames per row band; a blob belongs to the band holding its centre (a spear tip poking into the row above
    stays with its own frame)"""
    mask = im[..., 3] > 0
    lab, n = ndimage.label(mask)
    cys = ndimage.center_of_mass(mask, lab, range(1, n + 1))
    out = {}
    for (y0, y1), want, name, mode in zip(band_list, counts, names, modes):
        ids = [i + 1 for i, (cy, _) in enumerate(cys) if y0 <= cy < y1]
        rm = np.isin(lab, ids)
        ys = np.nonzero(rm.any(1))[0]
        ry0, ry1 = int(ys.min()), int(ys.max()) + 1
        fr = []
        for x0, x1, own in split_band(rm, ry0, ry1, want):
            crop = im[ry0:ry1, x0:x1].copy()
            crop[~own[:, x0:x1]] = 0
            rx, ry = body_root(crop[..., 3], mode)
            fr.append({'img': crop, 'root': (rx, ry), 'box': (x0, ry0, x1, ry1)})
        out[name] = fr
    return out


def paste(sheet, fr, row, col, scale, root_shift=(0, 0)):
    img = Image.fromarray(fr['img'])
    w, h = max(1, round(img.width * scale)), max(1, round(img.height * scale))
    img = img.resize((w, h), Image.BOX)
    a = np.array(img)
    a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)          # crisp pixel edges after the area downscale
    img = Image.fromarray(a)
    rx, ry = fr['root']
    px = round(col * CELL_W + ROOT_X - rx * scale + root_shift[0])
    py = round(row * CELL_H + ROOT_Y - (ry + 1) * scale + root_shift[1])
    layer = Image.new('RGBA', sheet.size, (0, 0, 0, 0))
    layer.alpha_composite(img, (max(px, 0), max(py, 0)), (max(-px, 0), max(-py, 0)))
    clip = np.zeros(sheet.size[::-1], np.uint8)
    clip[row * CELL_H:(row + 1) * CELL_H, col * CELL_W:(col + 1) * CELL_W] = 255
    la = np.array(layer)
    lost = int(((la[..., 3] > 0) & (clip == 0)).sum())
    la[..., 3] = np.minimum(la[..., 3], clip)
    sheet.alpha_composite(Image.fromarray(la))
    return lost


def main():
    ref, ref_keyed = load('reference')
    report['notes'].append(f'reference: {ref_keyed} magenta px keyed (visual reference only, not imported)')

    base, k1 = load('base')
    base = harden(base)
    bm = base[..., 3] > 0
    bb = bands(bm)
    # hurt / attack / death bands touch → split the merged band at the emptiest rows
    if len(bb) == 3:
        y0, y1 = bb[2]
        prof = bm[y0:y1].sum(1)
        cuts = []
        for lo, hi in [(150, 220), (350, 420)]:
            cuts.append(y0 + lo + int(np.argmin(prof[lo:hi])))
        bb = bb[:2] + [[y0, cuts[0]], [cuts[0], cuts[1]], [cuts[1], y1]]
        report['notes'].append(f'base: rows 3-5 touch, split at y={cuts}')
    names = ['idle', 'walk', 'hurt', 'attack', 'die']
    base_fr = frames_of(base, bb, [6, 8, 4, 6, 7], names, ['feet', 'mass', 'feet', 'feet', 'feet'])

    th, k2 = load('thrust')
    th = harden(th)
    tb = bands(th[..., 3] > 0)
    thr = frames_of(th, tb, [5, 5], ['s1', 's2'], ['feet', 'feet'])
    skill = thr['s1'] + thr['s2']

    # scale image 3 to the base sheet: match the body height of the full lunge (base attack f3 ↔ thrust f6)
    def body_h(fr):
        m = ndimage.binary_opening(fr['img'][..., 3] > 0, structure=np.ones((13, 13)))
        ys = np.nonzero(m)[0]
        return ys.max() - ys.min()
    th_scale = BASE_SCALE * body_h(base_fr['attack'][3]) / body_h(skill[6])
    report['notes'].append(f'thrust scale {th_scale:.3f} (base {BASE_SCALE})')

    rows = [('idle', base_fr['idle'], BASE_SCALE), ('walk', base_fr['walk'], BASE_SCALE), ('hurt', base_fr['hurt'], BASE_SCALE),
            ('attack', base_fr['attack'], BASE_SCALE), ('die', base_fr['die'], BASE_SCALE), ('skill', skill, th_scale)]
    cols = max(len(r[1]) for r in rows)
    sheet = Image.new('RGBA', (CELL_W * cols, CELL_H * len(rows)), (0, 0, 0, 0))
    for r, (name, frs, sc) in enumerate(rows):
        report['frames'][name] = []
        for c, fr in enumerate(frs):
            lost = paste(sheet, fr, r, c, sc)
            report['frames'][name].append({'src_box': fr['box'], 'root': [round(v, 1) for v in fr['root']], 'clipped_px': lost})
    sheet.save(f'{OUT}/hero-bailong.png', optimize=True)

    # weapon tip at the VFX_SPAWN frame (skill f6): rightmost body-row pixel of the spear, relative to the root
    a = np.array(sheet)[5 * CELL_H:6 * CELL_H, 6 * CELL_W:7 * CELL_W, 3] > 0
    ys, xs = np.nonzero(a)
    tip_x = xs.max()
    tip_y = int(np.median(ys[xs >= tip_x - 3]))
    report['weaponTip'] = {'frame': 6, 'x': int(tip_x - ROOT_X), 'up': int(ROOT_Y - tip_y)}

    # ---------------------------------------------------------------- VFX (separate strip)
    vfx, k3 = load('vfx')
    va = vfx[..., 3].astype(int)
    vfx[va < 10, 3] = 0                                     # drop the faint haze around the glow
    vfx[vfx[..., 3] == 0, :3] = 0
    # row bands per column (core only) → each row holds a left and a right frame; the long right-column dragons
    # start left of the image middle, so L/R are split at the emptiest column of that row, not at width/2
    W = vfx.shape[1] // 2
    tiles = []
    for col in range(2):
        core = vfx[:, col * W:(col + 1) * W, 3] > 150
        merged = []
        for y0, y1 in bands(core):
            if merged and y0 - merged[-1][1] < 12:
                merged[-1][1] = y1
            else:
                merged.append([y0, y1])
        merged = [b for b in merged if b[1] - b[0] > 8]
        assert len(merged) == 7, (col, merged)
        tiles.append(merged)
    VFX_SCALE = 0.4
    frames = []
    alpha = vfx[..., 3].astype(int)
    for r in range(7):
        y0 = min(tiles[0][r][0], tiles[1][r][0])
        y1 = max(tiles[0][r][1], tiles[1][r][1])
        # vertical limits: half way to the neighbouring rows (no bits of the row above / below)
        top = 0 if r == 0 else (y0 + max(tiles[0][r - 1][1], tiles[1][r - 1][1])) // 2
        bot = vfx.shape[0] if r == 6 else (y1 + min(tiles[0][r + 1][0], tiles[1][r + 1][0])) // 2
        prof = (alpha[top:bot] > 60).sum(0)
        split = 500 + int(np.argmin(prof[500:900]))
        report['notes'].append(f'vfx row {r + 1}: L/R split at x={split}')
        for x0, x1 in [(0, split), (split, vfx.shape[1])]:
            half = vfx[top:bot, x0:x1].copy()
            core = half[..., 3] > 200
            ys, xs = np.nonzero(core)
            # pivot = tail end of the dragon's core line (left-centre), y = core line centre
            frames.append((half, int(np.percentile(xs, 1)), float(np.median(ys))))
    sc = VFX_SCALE
    L = max(px for _, px, _ in frames)                        # glow / sparks left of the pivot
    R = max(h.shape[1] - px for h, px, _ in frames)
    U = max(py for _, _, py in frames)
    D = max(h.shape[0] - py for h, _, py in frames)
    lm = min(L, 60)                                           # keep ≤ 60 src px of tail glow behind the pivot
    fw, fh = round((lm + R) * sc) + 2, round((max(U, D) * 2) * sc) + 2
    fh = min(fh, round(160 * sc) * 2)
    strip = Image.new('RGBA', (fw * len(frames), fh), (0, 0, 0, 0))
    pivot = (round(lm * sc), fh // 2)
    for i, (half, px, py) in enumerate(frames):
        img = Image.fromarray(half)
        img = img.resize((max(1, round(img.width * sc)), max(1, round(img.height * sc))), Image.BOX)
        ox = i * fw + pivot[0] - round(px * sc)
        oy = pivot[1] - round(py * sc)
        layer = Image.new('RGBA', strip.size, (0, 0, 0, 0))
        layer.alpha_composite(img, (max(ox, 0), max(oy, 0)), (max(-ox, 0), max(-oy, 0)))
        la = np.array(layer)
        clip = np.zeros(la.shape[:2], bool)
        clip[:, i * fw:(i + 1) * fw] = True
        la[~clip, 3] = 0
        strip.alpha_composite(Image.fromarray(la))
    strip.save(f'{OUT}/fx-bailong-dragon-thrust.png', optimize=True)
    report['vfx'] = {'frames': len(frames), 'w': fw, 'h': fh, 'pivot': [round(pivot[0] / fw, 3), round(pivot[1] / fh, 3)], 'scale': sc}
    report['sheet'] = {'cols': cols, 'rows': len(rows), 'cellW': CELL_W, 'cellH': CELL_H, 'size': sheet.size}
    print(json.dumps(report, indent=1, default=str))


main()
