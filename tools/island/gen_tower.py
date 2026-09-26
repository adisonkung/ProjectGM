"""The Tower: base variants + separate rune / glow / crystal / aura / shadow / particle layers."""
from __future__ import annotations

import math

import numpy as np
from PIL import Image, ImageDraw

from gen_build_kit import blank, bricks, finish, fill, mask_ellipse, mask_poly, mask_rect, moss_on, window
from pixart import C, CYAN, EMERALD, GOLD, METAL, MOSS, OUT, STONE, VIOLET, fbm, glow, outline, over, pad, strip

W, H = 84, 152
AX, AY = 42, 151  # anchor (bottom-centre) inside the canvas
WINDOWS = [(30, 92), (52, 70), (34, 66), (49, 98), (33, 46), (41, 45), (49, 46)]


def shaft_x(y):
    """left/right edge of the mid shaft at row y (tapered 36 → 28)"""
    t = (110 - y) / (110 - 56)
    half = 18 - 4 * t
    return AX - half, AX + half


def base(variant: str) -> np.ndarray:
    a = blank(W, H)
    dark = {'sealed': 1.8, 'awakened': 2.1, 'active': 2.3, 'corrupted': 2.0, 'ascended': 2.5}[variant]
    rng = np.random.default_rng(5)
    small = bricks(W, H, STONE, 11, bw=(4, 6), bh=3, x0=24, x1=60, base=dark, jitter=0.7)
    large = bricks(W, H, STONE, 12, bw=(6, 9), bh=4, x0=20, x1=64, base=dark - .1, jitter=0.6)
    # rubble + roots at the foot (irregular)
    from gen_nature import rock
    for (x, sz, sd) in [(10, 'medium', 1), (58, 'medium', 2), (22, 'small', 3), (66, 'small', 4), (4, 'small', 5)]:
        r = rock(sz, sd)
        a = over(a, r, x, H - r.shape[0])
    # plinth
    fill(a, mask_rect(W, H, 16, 140, 68, 147), bricks(W, H, STONE, 3, bw=(5, 8), bh=4, x0=16, x1=68, base=dark - .2))
    fill(a, mask_rect(W, H, 19, 135, 65, 139), bricks(W, H, STONE, 4, bw=(5, 8), bh=3, x0=19, x1=65, base=dark))
    # lower drum with sloped buttresses (right one broken → asymmetric)
    fill(a, mask_poly(W, H, [(20, 135), (22, 110), (62, 110), (64, 135)]), large)
    fill(a, mask_poly(W, H, [(12, 135), (20, 116), (22, 116), (22, 135)]), large)
    fill(a, mask_poly(W, H, [(64, 135), (64, 120), (69, 128), (71, 135)]), large)
    # mid shaft
    shaft = mask_poly(W, H, [(shaft_x(110)[0], 110), (shaft_x(56)[0], 56), (shaft_x(56)[1], 56), (shaft_x(110)[1], 110)])
    fill(a, shaft, small)
    # upper gallery (overhang) + corbels
    fill(a, mask_rect(W, H, 22, 42, 62, 55), bricks(W, H, STONE, 17, bw=(3, 5), bh=3, x0=22, x1=62, base=dark + .2))
    for x in range(23, 62, 4):
        a[56:58, x:x + 2] = STONE[int(dark)]
        a[58, x] = STONE[1]
    # crown + horns (asymmetric)
    fill(a, mask_poly(W, H, [(26, 42), (28, 31), (56, 31), (58, 42)]), bricks(W, H, STONE, 21, bw=(3, 5), bh=3, x0=26, x1=58, base=dark + .3))
    im = Image.fromarray(a); d = ImageDraw.Draw(im)
    for (x, hw, hh) in [(28, 3, 16), (35, 2, 9), (49, 2, 12), (56, 3, 7), (42, 2, 4)]:
        d.polygon([(x - hw, 31), (x - 1 + (x > 42), 31 - hh), (x + hw, 31)], fill=STONE[int(dark) + 1])
        d.line([(x - 1 + (x > 42), 31 - hh + 1), (x - hw + 1, 30)], fill=STONE[int(dark) + 2])
    d.polygon([(34, 32), (38, 26), (46, 26), (50, 32)], fill=GOLD[1] if variant == 'ascended' else STONE[1])
    a = np.array(im)
    # depth: right faces in shadow, left rim lit
    m = a[..., 3] > 0
    for y in range(28, 140):
        xs = np.where(m[y, 12:72])[0]
        if not len(xs): continue
        l, r = 12 + xs[0], 12 + xs[-1]
        seg = a[y, max(l, r - 5):r + 1]
        seg[seg[..., 3] > 0] = STONE[1]
        a[y, l] = STONE[min(5, int(dark) + 2)]
    # rings
    band = GOLD[2] if variant == 'ascended' else STONE[int(dark) + 1]
    band_d = GOLD[1] if variant == 'ascended' else STONE[1]
    for by, (l, r) in [(110, (19, 65)), (84, shaft_x(84)), (56, (21, 63))]:
        a[by - 1:by + 1, int(l):int(r) + 1] = band
        a[by + 1, int(l):int(r) + 1] = band_d
    # gate
    im = Image.fromarray(a); d = ImageDraw.Draw(im)
    d.rectangle([34, 121, 50, 135], fill=STONE[1]); d.ellipse([34, 114, 50, 128], fill=STONE[1])
    door = (18, 16, 26, 255) if variant == 'sealed' else (12, 28, 34, 255)
    d.rectangle([36, 122, 48, 135], fill=door); d.ellipse([36, 116, 48, 128], fill=door)
    if variant == 'sealed':
        for k in range(12):
            d.point((36 + k, 121 + k * 1.1), fill=METAL[3]); d.point((48 - k, 121 + k * 1.1), fill=METAL[2])
        d.rectangle([40, 126, 44, 130], fill=METAL[3]); d.point((42, 128), fill=METAL[0])
    a = np.array(im)
    for (x, y) in WINDOWS:
        a[y:y + 6, x:x + 2] = (12, 14, 24, 255)
        a[y - 1, x - 1:x + 3] = STONE[int(dark) + 2]
    for (x, y) in rune_pixels():
        a[y, x] = STONE[0]
    # ivy strands (fewer on later stages, none when restored)
    if variant != 'ascended':
        n_str = {'sealed': 9, 'awakened': 7, 'active': 5, 'corrupted': 7}[variant]
        for k in range(n_str):
            x = int(rng.integers(21, 63)); y = int(rng.integers(80, 125)); ln = int(rng.integers(8, 24))
            for i in range(ln):
                yy = y + i; xx = x + int(math.sin(i * 0.5 + k) * 1.2)
                if 0 <= yy < H and a[yy, xx, 3]:
                    a[yy, xx] = MOSS[1 + ((i + k) % 3 == 0)]
                    if i % 4 == 0 and a[yy, xx + 1, 3]: a[yy, xx + 1] = MOSS[2]
        # moss patches on ledges
        for by in (110, 135, 140):
            for x in range(18, 67):
                if rng.random() < (0.55 if variant == 'sealed' else 0.3) and a[by - 2, x, 3]:
                    a[by - 2, x] = MOSS[1 + int(rng.random() < .4)]
    if variant == 'corrupted':
        for (x0, y0) in [(28, 100), (54, 76), (44, 60), (30, 124)]:
            x, y = x0, y0
            for _ in range(16):
                if a[y, x, 3]: a[y, x] = VIOLET[1]
                x += int(np.sign(math.sin(x * 1.3 + y))); y += 1
    return finish(a)


def rune_pixels():
    """glyph pixels up the shaft centre (between the bands)"""
    out = []
    glyphs = [
        [(0, 0), (1, 1), (0, 2), (-1, 1), (0, 3)],
        [(-1, 0), (0, 0), (1, 0), (0, 1), (0, 2), (-1, 3), (1, 3)],
        [(0, 0), (0, 1), (1, 2), (-1, 2), (0, 3)],
        [(-1, 0), (1, 0), (0, 1), (-1, 2), (1, 2)],
    ]
    y = 60; gi = 0
    while y < 106:
        if y in range(81, 88):
            y += 1; continue
        for (dx, dy) in glyphs[gi % 4]:
            out.append((AX + dx, y + dy))
        y += 6; gi += 1
    # gate arch runes
    for k in range(-6, 7, 2):
        out.append((AX + k, 114 if abs(k) < 4 else 116))
    return out


def rune_overlay(ramp=EMERALD, level=1.0) -> np.ndarray:
    a = blank(W, H)
    for (x, y) in rune_pixels():
        a[y, x] = ramp[3]
    # soft pixel halo
    g = blank(W, H)
    for (x, y) in rune_pixels():
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if not a[y + dy, x + dx, 3]:
                g[y + dy, x + dx] = (*ramp[2][:3], int(140 * level))
    return pad(over(g, a), 1)


def glow_overlay(ramp=CYAN) -> np.ndarray:
    """window + gate light (window flicker animates this layer)"""
    a = blank(W, H)
    for (x, y) in WINDOWS:
        a[y:y + 6, x:x + 2] = ramp[3]
        a[y + 1:y + 5, x] = ramp[4]
    a[122:136, 37:48] = (*ramp[2][:3], 150)
    a[117:122, 38:47] = (*ramp[2][:3], 150)
    a[134:136, 37:48] = ramp[3]
    return pad(a, 1)


def crystal(ramp=EMERALD) -> np.ndarray:
    """floating crown crystal (its own layer so it can bob + flicker)"""
    w, h = 16, 22
    a = blank(w, h)
    im = Image.fromarray(a); d = ImageDraw.Draw(im)
    d.polygon([(8, 0), (14, 8), (8, 21), (2, 8)], fill=ramp[2])
    d.polygon([(8, 0), (8, 21), (2, 8)], fill=ramp[3])
    d.polygon([(8, 0), (5, 8), (8, 12)], fill=ramp[4])
    d.line([(2, 8), (14, 8)], fill=ramp[1])
    a = np.array(im)
    return outline(pad(a, 1), ramp[0])


def shadow() -> np.ndarray:
    a = blank(W + 30, 14)
    m = mask_ellipse(W + 30, 14, (W + 30) / 2, 7, (W + 30) / 2 - 1, 6)
    a[m] = (6, 8, 14, 110)
    return a


def aura_sheet(ramp=EMERALD, frames=8, strength=1.0, corrupt=False) -> np.ndarray:
    """slow breathing aura around the tower body (8 frames, loop)"""
    w, h = 110, 160
    out = []
    for f in range(frames):
        t = f / frames
        breathe = 0.75 + 0.25 * math.sin(t * math.tau)
        a = glow(w, h, w / 2, h * 0.55, 56 * (0.92 + 0.08 * breathe), ramp[2], strength * 0.8 * breathe, 1.3)
        # tall inner column
        col = glow(w, h, w / 2, h * 0.42, 34, ramp[3], strength * 0.55 * breathe, 1.8)
        a = over(a, col)
        # wisps
        rng = np.random.default_rng(f + (99 if corrupt else 0))
        for k in range(6):
            ang = (k / 6 + t) * math.tau
            x = int(w / 2 + math.cos(ang) * 30); y = int(h * 0.6 - ((t * 60 + k * 23) % 90))
            c = (VIOLET if corrupt and k % 2 else ramp)[3]
            if 0 <= y < h - 1 and 0 <= x < w - 1:
                a[y:y + 2, x] = c; a[y, x + 1] = c
        out.append(a)
    return strip(out)


def particle_sheet(ramp=EMERALD, frames=8, w=40, h=70, n=7, seed=3) -> np.ndarray:
    """small motes drifting upward (loop)"""
    rng = np.random.default_rng(seed)
    motes = [(rng.random() * (w - 4) + 2, rng.random(), rng.random() * 0.6 + 0.5) for _ in range(n)]
    out = []
    for f in range(frames):
        a = blank(w, h)
        for (x, p, s) in motes:
            y = (1 - ((p + f / frames * s) % 1)) * (h - 3)
            xx = int(x + math.sin((p + f / frames) * math.tau) * 2)
            yy = int(y)
            fade = 1 - abs(y / h - 0.5) * 1.6
            if fade <= 0: continue
            c = (*ramp[4 if fade > .6 else 3][:3], int(255 * min(1, fade + .2)))
            a[yy, xx] = c
            if fade > .5: a[yy + 1, xx] = (*ramp[2][:3], 160)
        out.append(a)
    return strip(out)


def pulse_sheet(ramp=EMERALD, frames=10) -> np.ndarray:
    """occasional energy pulse: expanding ring (played rarely)"""
    w, h = 140, 60
    out = []
    Y, X = np.mgrid[0:h, 0:w].astype(np.float32)
    for f in range(frames):
        t = (f + 1) / frames
        r = 10 + t * 62
        d = np.sqrt(((X - w / 2) / r) ** 2 + ((Y - h / 2) / (r * 0.38)) ** 2)
        ring = (np.abs(d - 1) < 0.08)
        a = blank(w, h)
        a[ring] = (*ramp[3][:3], int(230 * (1 - t) + 20))
        out.append(a)
    return strip(out)
