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

Skill 2 / Ultimate (optional, used when the files exist):
  sweep_char.png    Sweeping Moon character clip, 2 rows x 6 = 12 frames  → atlas row 6 (skill2)
  sweep_vfx.png     Sweeping Moon crescent (7 + 6 = 13 frames)            → fx-bailong-sweeping-moon.png
  sweep_impact.png  Sweeping Moon contact FX (4 + 4)                      → fx-bailong-sweeping-moon-hit.png
  ult_char.png      Nine Dragon Sequence character clip, 4 x 5 = 20 frames → atlas row 7 (ult), qi glow kept (soft alpha)
  ult_charge.png    charge aura around the body (5 + 5)                   → fx-bailong-nine-dragon-charge.png
  ult_main.png      main ultimate VFX, 4 x 7 = 28 frames (3 strike segments) → fx-bailong-nine-dragon.png
  ult_impact.png    final contact burst (4 + 4 + 4)                       → fx-bailong-nine-dragon-impact.png
  Frames that touch (spear / qi across neighbours) are split by a watershed seeded on each body / core, never by
  straight cuts. VFX frames are aligned per sheet (left-centre crescent, centre, bottom-centre ground bursts).

Usage: python3 tools/sprites/bailong.py <dir with reference/base/thrust/vfx.png> <out dir>
Prints the measured weapon-tip anchor (for FX dx/dy) and the per-frame crop report.
"""
import json
import sys

import numpy as np
from PIL import Image
from scipy import ndimage
from skimage.segmentation import watershed

SRC = sys.argv[1] if len(sys.argv) > 1 else 'art/incoming/bailong'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'public/sprites'

CELL_W, CELL_H, FOOT = 220, 132, 15        # wide cell: the spear may overflow the 132 px body cell
ROOT_X, ROOT_Y = CELL_W // 2, CELL_H - FOOT
BASE_SCALE = 0.396                          # base sheet: +10 % over the first pass (user, 2026-10-05) — body ≈ Jin / Shade on screen
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
    if fr.get('soft'):
        img = resize_rgba(img, w, h)
        a = np.array(img)
        a[a[..., 3] < 24] = 0                                 # translucent qi glow kept, faint haze out
    else:
        img = img.resize((w, h), Image.BOX)
        a = np.array(img)
        a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)      # crisp pixel edges after the area downscale
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


def body_markers(hard, want):
    body = ndimage.binary_opening(hard, structure=np.ones((13, 13)))
    lab, n = ndimage.label(body)
    sizes = ndimage.sum(body, lab, range(1, n + 1))
    keep = sorted(range(n), key=lambda i: -sizes[i])[:want]
    keep = sorted(keep, key=lambda i: ndimage.center_of_mass(body, lab, i + 1)[1])
    markers = np.zeros(hard.shape, np.int32)
    for k, i in enumerate(keep):
        markers[lab == i + 1] = k + 1
    return markers, len(keep)


# manual fixes where a spear tip lies ON the next frame's body (no automatic rule can tell them apart):
# (x0, y0, x1, y1) in source px → frame k of that band, only for pixels passing the colour test
CLIP_FIXES = {
    # Sweeping Moon row 2: F9 spear + head + tassel lie on F10's sash, F10 / F11 tips on the next robe
    'sweep_char': [(830, 721, 962, 765, 2, 'not_blue'), (840, 760, 900, 801, 2, 'not_blue'),
                   (1050, 800, 1112, 845, 3, 'not_blue'), (1290, 812, 1342, 860, 4, 'not_blue')],
    # Nine Dragon row 3: F13 spear + glow run into F14's hair, F14's crescent arc / F15's spear tip
    'ult_char': [(740, 690, 905, 748, 2, 'any'), (905, 680, 925, 748, 2, 'not_dark'), (1060, 620, 1112, 700, 3, 'any'), (1112, 695, 1165, 740, 4, 'not_blue')],
}


def clip_frames(im, band, want, mode='feet', soft=False, fixes=()):
    """one row band of a character clip → `want` frames. Each pixel belongs to the body it is connected to through
    the thickest path (watershed on the distance map, seeded on the bodies): a spear tip touching the next frame's
    robe stays with its own hands. soft = keep the semi-transparent qi glow (alpha >= 24), assigned to the nearest frame"""
    y0, y1 = band
    a = im[y0:y1, ..., 3]
    hard = a >= ALPHA_CUT
    markers, n = body_markers(hard, want)
    assert n == want, (band, n, want)
    dist = ndimage.distance_transform_edt(hard)
    lab = watershed(-dist, markers, mask=hard)
    # strays not connected to any body (sparks, glow) → nearest labelled pixel
    keep = (a >= 24) if soft else hard
    _, (iy, ix) = ndimage.distance_transform_edt(lab == 0, return_indices=True)
    full = lab[iy, ix]
    full[~keep] = 0
    rgb = im[y0:y1, ..., :3].astype(int)
    for fx0, fy0, fx1, fy1, k, rule in fixes:
        if not (y0 <= fy0 < y1):
            continue
        sub = np.zeros(full.shape, bool)
        sub[fy0 - y0:fy1 - y0, fx0:fx1] = True
        if rule == 'not_blue':
            sub &= ~((rgb[..., 2] > rgb[..., 0] + 50) & (rgb[..., 2] > 110))
        elif rule == 'not_dark':
            sub &= rgb.mean(-1) > 70
        full[sub & keep] = k + 1
    fr = []
    for k in range(1, want + 1):
        own = full == k
        ys, xs = np.nonzero(own)
        x0, x1 = int(xs.min()), int(xs.max()) + 1
        crop = im[y0:y1, x0:x1].copy()
        crop[~own[:, x0:x1]] = 0
        if not soft:
            crop[..., 3] = np.where(crop[..., 3] >= ALPHA_CUT, 255, 0)
        else:
            # dark AI halo out, light qi glow kept translucent
            lum = crop[..., :3].astype(int).mean(-1)
            crop[(crop[..., 3] < 200) & (lum < 90), 3] = 0
            crop[crop[..., 3] >= 200, 3] = 255
        rx, ry = body_root(np.where(crop[..., 3] >= ALPHA_CUT, 255, 0), mode)
        fr.append({'img': crop, 'root': (rx, ry), 'box': (x0, y0, x1, y1), 'soft': soft})
    return fr


def resize_rgba(img, w, h):
    """area downscale with premultiplied alpha (no dark fringe on translucent glow)"""
    return img.convert('RGBa').resize((w, h), Image.BOX).convert('RGBA')


def cut_vfx(name, rows, align, scale, min_alpha=16, flip=False):
    """VFX sheet → one strip. rows = [(y_from, y_to, [frame centre x, …]), …]. Every core blob (alpha >= 200) seeds
    the frame whose centre is nearest; the rest of the glow joins its seed by a watershed on the alpha (frames split
    along their dimmest valley, not along straight lines). align: 'left' (pivot left-centre), 'center', 'bottom'."""
    im, _ = load(name)
    a = im[..., 3].astype(int)
    im[a < min_alpha] = 0
    a = im[..., 3].astype(int)
    slots = [(r, c, y0, y1, cx) for r, (y0, y1, xs) in enumerate(rows) for c, cx in enumerate(xs)]
    # seeds: every core pixel (alpha >= 200) → nearest frame centre of its row (a beam joining two frames is split
    # half way between their centres, not handed whole to one of them)
    core = a >= 200
    markers = np.zeros(a.shape, np.int32)
    ys, xs = np.nonzero(core)
    for r, (y0, y1, centres) in enumerate(rows):
        sel = (ys >= y0) & (ys < y1)
        first = sum(len(rw[2]) for rw in rows[:r])
        cx = np.array(centres)
        k = np.abs(xs[sel][:, None] - cx[None, :]).argmin(1)
        markers[ys[sel], xs[sel]] = first + k + 1
    smooth = ndimage.gaussian_filter(a.astype(float), 2)
    seg = watershed(-smooth, markers, mask=a > 0)
    # islands with no seed → nearest slot centre
    rest = (a > 0) & (seg == 0)
    rl, rn = ndimage.label(rest)
    for i, (cy, cx) in enumerate(ndimage.center_of_mass(rest, rl, range(1, rn + 1))):
        cand = [k for k, (_, _, y0, y1, _) in enumerate(slots) if y0 <= cy < y1] or list(range(len(slots)))
        seg[rl == i + 1] = min(cand, key=lambda k: abs(slots[k][4] - cx)) + 1
    frames = []
    for k in range(len(slots)):
        own = seg == k + 1
        ys, xs = np.nonzero(own)
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        crop = im[y0:y1, x0:x1].copy()
        crop[~own[y0:y1, x0:x1]] = 0
        img = Image.fromarray(crop)
        img = resize_rgba(img, max(1, round(img.width * scale)), max(1, round(img.height * scale)))
        if flip:
            img = img.transpose(Image.FLIP_LEFT_RIGHT)
        frames.append(img)
    W = max(f.width for f in frames) + 4
    H = max(f.height for f in frames) + 4
    strip = Image.new('RGBA', (W * len(frames), H), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        if align == 'left':
            ox, oy = 2, (H - f.height) // 2
        elif align == 'bottom':
            ox, oy = (W - f.width) // 2, H - 2 - f.height
        else:
            ox, oy = (W - f.width) // 2, (H - f.height) // 2
        strip.alpha_composite(f, (i * W + ox, oy))
    pivot = {'left': [round(2 / W, 3), 0.5], 'bottom': [0.5, round((H - 2) / H, 3)], 'center': [0.5, 0.5]}[align]
    return strip, {'frames': len(frames), 'w': W, 'h': H, 'pivot': pivot, 'scale': scale}


# frame centres / row bands read off the sheets (source px)
VFX_SHEETS = {
    'sweep_vfx': ('fx-bailong-sweeping-moon.png', 'left', 0.45, [
        (0, 590, [95, 245, 415, 600, 820, 1060, 1290]),
        (590, 1086, [190, 520, 790, 1010, 1190, 1350])]),
    'sweep_impact': ('fx-bailong-sweeping-moon-hit.png', 'center', 0.4, [
        (0, 600, [160, 470, 840, 1240]),
        (600, 1086, [210, 590, 930, 1270])]),
    'ult_charge': ('fx-bailong-nine-dragon-charge.png', 'bottom', 0.35, [
        (0, 350, [206, 624, 1043, 1504, 1944]),
        (350, 724, [206, 630, 1086, 1542, 1955])]),
    'ult_main': ('fx-bailong-nine-dragon.png', 'center', 0.7, [
        (0, 222, [115, 345, 575, 815, 1035, 1265, 1510]),
        (222, 440, [160, 450, 690, 900, 1085, 1305, 1535]),
        (440, 680, [105, 310, 530, 740, 945, 1180, 1480]),
        (680, 941, [215, 615, 815, 1030, 1235, 1400, 1580])]),
    'ult_impact': ('fx-bailong-nine-dragon-impact.png', 'bottom', 0.45, [
        (0, 380, [165, 510, 865, 1240]),
        (380, 770, [225, 590, 945, 1280]),
        (770, 1086, [210, 560, 900, 1260])]),
}


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
    # Skill 2 / Ultimate character clips: same root, same on-screen size as the base sheet (body height of the
    # ready stance matched to the base idle) — the spectacle comes from the VFX layers, never a bigger hero
    import os
    for name, file, counts, soft in [('skill2', 'sweep_char', [6, 6], False), ('ult', 'ult_char', [5, 5, 5, 5], True)]:
        if not os.path.exists(f'{SRC}/{file}.png'):
            continue
        cim, _ = load(file)
        cb = bands(cim[..., 3] >= ALPHA_CUT)
        assert len(cb) == len(counts), (file, cb)
        frs = [f for band, want in zip(cb, counts) for f in clip_frames(cim, band, want, 'feet', soft, CLIP_FIXES.get(file, ()))]
        sc = BASE_SCALE * body_h(base_fr['idle'][0]) / body_h(frs[0])
        report['notes'].append(f'{file}: {len(frs)} frames, scale {sc:.3f}')
        rows.append((name, frs, sc))
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
    import os
    for src, (out, align, sc, rows_cfg) in VFX_SHEETS.items():
        if not os.path.exists(f'{SRC}/{src}.png'):
            continue
        strip, info = cut_vfx(src, rows_cfg, align, sc)
        strip.save(f'{OUT}/{out}', optimize=True)
        report[out] = info
    # named anchors measured on the clips (px from the root, x forward, up = above the feet)
    report['anchors'] = {'weaponTip(skill f6)': report['weaponTip']}
    print(json.dumps(report, indent=1, default=str))


if __name__ == '__main__':
    main()
