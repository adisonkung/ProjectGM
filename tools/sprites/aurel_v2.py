"""Aurel — Dawn Bastion (v2 art) → hero-aurel.png + portrait.

Reuses the Bai Long import pipeline (tools/sprites/bailong.py): magenta / spill key, halo cut, per-row frames split
by a body-seeded watershed, feet root from the body mask (never the PNG bounds), area downscale, pixelated render.

Sources (art/incoming/aurel, not committed):
  base.png       idle 6 · move 8 · hurt 4 · attack 7 · death 6
  bash.png       Skill 1 Shield Bash, 2 × 5 = 10
  rush.png       Skill 2 Guardian Rush, 2 × 6 = 12
  ult.png        Ultimate Bastion of Dawn, 2 × 8 = 16 (holy glow kept translucent)
  reference.png  master reference on #FF00FF — the face close-up becomes the portrait

Atlas: 16 cols × 8 rows, cell 220 × 132, root (feet) at (110, 117), facing right — same cell / root as Bai Long.
Rows: 0 idle · 1 walk · 2 hurt · 3 attack · 4 die · 5 skill · 6 skill2 · 7 ult.
Every sheet is scaled so its first (ready) pose has the same body height as the base idle → one on-screen size.

Usage: python3 tools/sprites/aurel_v2.py [src dir] [sprite out dir] [portrait out dir]
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, os.path.dirname(__file__))
import bailong as B  # noqa: E402
import aurel_bash_vfx as BV  # noqa: E402
import aurel_rush_vfx as RV  # noqa: E402

SRC = sys.argv[1] if len(sys.argv) > 1 else 'art/incoming/aurel'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'public/sprites'
POUT = sys.argv[3] if len(sys.argv) > 3 else 'public/portraits'
B.SRC = SRC
# cell 260 wide (root kept at the centre): room for the Shield Bash VFX in front of the shield
B.CELL_W, B.CELL_H, B.FOOT = 260, 132, 15
B.ROOT_X, B.ROOT_Y = 130, 117
# body height of the base idle on screen (px): Aurel is a tank — a touch taller than Bai Long (≈ 75)
IDLE_BODY = 78
SEAM_FADE = 18
DRIFT = 0.6   # cost per px away from the grid line: seams stay near-vertical in dense dust

ROWS = [  # (name, file, frames per source row, soft glow)
    ('idle', 'base', None, False),
    ('skill', 'bash', [5, 5], False),
    ('skill2', 'rush', [6, 6], False),
    ('ult', 'ult', [8, 8], True),
]
BASE_COUNTS = [6, 8, 4, 7, 6]
BASE_NAMES = ['idle', 'walk', 'hurt', 'attack', 'die']


_markers = B.body_markers


def grid_markers(hard, want):
    """the skill sheets are even grids (2 × 5 / 6 / 8): seed each frame on the largest opened body blob inside a
    narrow strip at its slot centre — glow and dust between frames can no longer glue two bodies into one"""
    body = ndimage.binary_opening(hard, structure=np.ones((13, 13)))
    w = hard.shape[1] / want
    markers = np.zeros(hard.shape, np.int32)
    for k in range(want):
        cx = int((k + 0.5) * w)
        strip = np.zeros_like(body)
        strip[:, max(cx - int(w * 0.18), 0):cx + int(w * 0.18)] = True
        lab, n = ndimage.label(body & strip)
        if n == 0:
            return _markers(hard, want)
        sizes = ndimage.sum(body, lab, range(1, n + 1))
        markers[lab == int(np.argmax(sizes)) + 1] = k + 1
    return markers, want


def seam_labels(alpha, want, reach=44):
    """even grid with frames that only touch through glow / dust: split along the cheapest top-to-bottom seam
    (least alpha, may drift 1 px per row) within ±reach of each grid line — no straight cuts through a body"""
    h, w = alpha.shape
    cost = alpha.astype(float) + 1
    lab = np.zeros((h, w), np.int32)
    seams = []
    for k in range(1, want):
        b = int(k * w / want)
        lo, hi = b - reach, b + reach
        c = cost[:, lo:hi] + DRIFT * np.abs(np.arange(lo, hi) - b)[None, :]
        acc = c.copy()
        for y in range(1, h):
            prev = acc[y - 1]
            best = np.minimum(prev, np.minimum(np.r_[np.inf, prev[:-1]], np.r_[prev[1:], np.inf]))
            acc[y] += best
        x = int(np.argmin(acc[-1]))
        path = [x]
        for y in range(h - 1, 0, -1):
            cand = [(acc[y - 1, j], j) for j in (x - 1, x, x + 1) if 0 <= j < hi - lo]
            x = min(cand)[1]
            path.append(x)
        seams.append(np.array(path[::-1]) + lo)
    xs = np.arange(w)[None, :]
    lab[:] = 1
    near = np.full((h, w), 1e9)
    for s_ in seams:
        lab += xs >= s_[:, None]
        near = np.minimum(near, np.abs(xs - s_[:, None]))
    return lab, near


def torso_x(cell_a):
    """x of the chest (20–55 % down the body, sword / shield rims opened away) in cell px — the feet-span centre
    used as root swings with every stance change, the chest is what the eye tracks"""
    m = ndimage.binary_opening(cell_a >= 128, structure=np.ones((5, 5)))
    ys, xs = np.nonzero(m)
    top, bot = ys.min(), ys.max()
    band = (ys >= top + 0.2 * (bot - top)) & (ys <= top + 0.55 * (bot - top))
    return float(np.median(xs[band]))


# loops play in place: every frame's chest on the row mean. Actions keep their intended travel (a light
# 1-2-1 smoothing of the chest path) but lose the frame-to-frame wobble of the AI drawings, and start / end on the
# idle chest so idle → skill → idle does not jump.
LOOPS = {'idle', 'walk', 'hurt'}
MAX_SHIFT = 9


def stabilise(tx):
    home = float(np.mean(tx['idle']))
    out = {}
    for name, xs in tx.items():
        xs = np.array(xs)
        if name in LOOPS:
            want = np.full_like(xs, home)
        elif name == 'die':
            want = xs.copy()
            want[0] = home
            want[1:] = np.convolve(np.r_[xs[0], xs, xs[-1]], [0.25, 0.5, 0.25], 'valid')[1:]
        else:
            p = np.r_[home, xs, home]
            sm = np.convolve(np.r_[p[0], p, p[-1]], [0.25, 0.5, 0.25], 'valid')[1:-1]
            want = sm
            want[0] = want[-1] = home
        out[name] = list(np.clip(want - xs, -MAX_SHIFT, MAX_SHIFT))
    return out


def body_h(fr):
    m = ndimage.binary_opening(fr.get('char', fr['img'])[..., 3] >= B.ALPHA_CUT, structure=np.ones((9, 9)))
    ys = np.nonzero(m)[0]
    return ys.max() - ys.min()


def sheet_frames(file, counts, soft):
    im, _ = B.load(file)
    hard = im[..., 3] >= B.ALPHA_CUT
    cb = B.bands(hard)
    if len(cb) != len(counts):
        # touching rows: cut at the emptiest rows between the expected bands
        prof = hard.sum(1)
        n = len(counts)
        h = im.shape[0]
        cuts = []
        for k in range(1, n):
            lo, hi = int(h * (k - 0.35) / n), int(h * (k + 0.35) / n)
            cuts.append(lo + int(np.argmin(prof[lo:hi])))
        lims = [0] + cuts + [h]
        cb = []
        for y0, y1 in zip(lims[:-1], lims[1:]):
            ys = np.nonzero(hard[y0:y1].any(1))[0]
            cb.append((y0 + int(ys.min()), y0 + int(ys.max()) + 1))
    out = []
    B.body_markers = grid_markers if file != 'base' else _markers
    B.WS_OPEN = 7 if file != 'base' else 0
    ws = B.watershed
    for band, want in zip(cb, counts):
        if file == 'ult':   # dense holy glow glues the frames: seam split instead of the watershed
            al = im[band[0]:band[1], ..., 3]
            lab, near = seam_labels(al, want)
            # glow (not armour) fades out toward the seam → no hard cut edge in the light
            t = np.clip(near / SEAM_FADE, 0, 1)
            glow = al < 235
            al[glow] = (al[glow] * (t * t * (3 - 2 * t))[glow]).astype(np.uint8)
            B.watershed = lambda _e, _m, mask, lab=lab, al=al: lab * (al > 0)
        out += B.clip_frames(im, band, want, 'feet', soft)
        B.watershed = ws
    B.body_markers, B.WS_OPEN = _markers, 0
    return out


def main():
    report = {'notes': [], 'rows': {}}
    base = sheet_frames('base', BASE_COUNTS, False)
    groups, i = {}, 0
    for name, n in zip(BASE_NAMES, BASE_COUNTS):
        groups[name] = base[i:i + n]
        i += n
    sc_base = IDLE_BODY / body_h(groups['idle'][0])
    rows = [(n, groups[n], sc_base) for n in BASE_NAMES]
    for name, file, counts, soft in ROWS[1:]:
        frs = sheet_frames(file, counts, soft)
        if file == 'bash':   # Shield Bash: the supplied VFX strips placed on the clip (aurel_bash_vfx.py)
            frs = BV.combine(frs)
        if file == 'rush':   # Guardian Rush: main VFX travels with Aurel + collision burst (aurel_rush_vfx.py)
            frs = RV.combine(frs)
        sc = sc_base * body_h(groups['idle'][0]) / body_h(frs[0])
        rows.append((name, frs, sc))
        report['notes'].append(f'{file}: {len(frs)} frames, scale {sc:.3f}')
    report['notes'].insert(0, f'base scale {sc_base:.3f}')
    cols = max(len(r[1]) for r in rows)
    # pass 1: feet-root placement, only to measure where each frame's torso landed
    probe = Image.new('RGBA', (B.CELL_W * cols, B.CELL_H * len(rows)), (0, 0, 0, 0))
    for r, (name, frs, sc) in enumerate(rows):
        for c, fr in enumerate(frs):
            B.paste(probe, {**fr, 'img': fr.get('char', fr['img'])}, r, c, sc)
    pa = np.array(probe)[..., 3]
    tx = {name: [torso_x(pa[r * B.CELL_H:(r + 1) * B.CELL_H, c * B.CELL_W:(c + 1) * B.CELL_W]) for c in range(len(frs))]
          for r, (name, frs, _) in enumerate(rows)}
    shifts = stabilise(tx)
    report['torso_x'] = {k: [round(v, 1) for v in tx[k]] for k in tx}
    report['shift_x'] = {k: [round(v, 1) for v in shifts[k]] for k in shifts}
    # pass 2: the real atlas with the jitter taken out
    sheet = Image.new('RGBA', (B.CELL_W * cols, B.CELL_H * len(rows)), (0, 0, 0, 0))
    for r, (name, frs, sc) in enumerate(rows):
        report['rows'][name] = {'row': r, 'frames': len(frs),
                                'clipped': [B.paste(sheet, fr, r, c, sc, (shifts[name][c], 0)) for c, fr in enumerate(frs)]}
    sheet.save(f'{OUT}/hero-aurel.png', optimize=True)
    report['sheet'] = {'cols': cols, 'rows': len(rows), 'size': sheet.size}

    # portrait: the big face close-up of the reference (panel 7), magenta keyed, on a navy → dawn-gold backdrop
    ref, _ = B.load('reference')
    face = ref[648:978, 22:297].copy()
    a = face[..., 3]
    ys, xs = np.nonzero(a > 0)
    face = face[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    S = 288
    bg = np.zeros((S, S, 4), np.uint8)
    yy, xx = np.mgrid[0:S, 0:S]
    t = np.clip((yy / S) * 0.8 + (xx / S) * 0.2, 0, 1)[..., None]
    top, bot = np.array([34, 44, 84]), np.array([150, 112, 52])
    bg[..., :3] = (top * (1 - t) + bot * t).astype(np.uint8)
    glow = np.exp(-(((xx - S * 0.45) ** 2 + (yy - S * 0.35) ** 2) / (2 * (S * 0.3) ** 2)))[..., None]
    bg[..., :3] = np.clip(bg[..., :3] + glow * np.array([70, 60, 30]), 0, 255).astype(np.uint8)
    bg[..., 3] = 255
    portrait = Image.fromarray(bg)
    f = Image.fromarray(face)
    k = S * 1.05 / f.height
    f = f.resize((round(f.width * k), round(f.height * k)), Image.NEAREST)
    portrait.alpha_composite(f, (S - f.width + 6, S - f.height + 4))
    pa = np.array(portrait)
    pa[:3, :] = pa[-3:, :] = pa[:, :3] = pa[:, -3:] = [216, 162, 58, 255]
    Image.fromarray(pa).convert('RGB').save(f'{POUT}/aurel.webp', quality=92)
    print(json.dumps(report, indent=1))


if __name__ == '__main__':
    main()
