"""Trees, vegetation, rocks, ruins for the Ancient Forest island pack."""
from __future__ import annotations

import math

import numpy as np

from pixart import (BARK, BLOSSOM, C, DIRT, GRASS, LEAF, LEAF_WARM, MOSS, OUT, STONE, STONE_WARM, CYAN, GOLD, VIOLET, fbm, outline,
                    over, pad, ramp_map, shade_spheres, glow)


def shadow(w, h, cx, cy, rx, ry, alpha=90):
    Y, X = np.mgrid[0:h, 0:w].astype(np.float32)
    m = ((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2 <= 1
    a = np.zeros((h, w, 4), np.uint8)
    a[m] = (8, 10, 16, alpha)
    return a


def trunk(w, h, x0, top, bottom, width, seed, lean=0.0, roots=True):
    """flared trunk + roots, bark ramp, left-lit"""
    a = np.zeros((h, w, 4), np.uint8)
    rng = np.random.default_rng(seed)
    Y, X = np.mgrid[0:h, 0:w].astype(np.float32)
    t = np.clip((Y - top) / max(1, bottom - top), 0, 1)
    cx = x0 + lean * (1 - t) * (bottom - top)
    half = width / 2 * (0.75 + 0.25 * t + (0.9 * t ** 6 if roots else 0))
    m = (Y >= top) & (Y <= bottom) & (np.abs(X - cx) <= half)
    if roots:
        for side in (-1, 1):
            for k in range(2):
                rx = cx + side * (half * (0.8 + 0.6 * k))
                rm = (Y >= bottom - 4 + k * 2) & (Y <= bottom) & (np.abs(X - (x0 + side * (width * (0.7 + 0.45 * k)))) <= 2.2 - k * 0.6)
                m |= rm
    u = np.clip((X - (cx - half)) / np.maximum(1, 2 * half), 0, 1)
    stripes = fbm(w, h, 1.6, seed, 2)
    v = np.clip(0.95 - u * 0.75 + (stripes - 0.5) * 0.45, 0, 0.999)
    rgba = ramp_map(v, BARK)
    a[m] = rgba[m]
    return a


def crown(w, h, spheres, ramp, seed, tex=0.24):
    """big masses + many small leaf clumps (each its own tiny lit sphere) → readable pixel foliage"""
    rng = np.random.default_rng(seed)
    base = shade_spheres(w, h, spheres, ramp, seed=seed, texture=0.06, tex_cell=3, dither=0.45)
    clumps = []
    for (cx, cy, rx, ry) in spheres:
        n = int(rx * ry / 22) + 3
        for _ in range(n):
            ang = rng.random() * math.tau
            rr = math.sqrt(rng.random()) * 0.82
            x, y = cx + math.cos(ang) * rx * rr, cy + math.sin(ang) * ry * rr
            r = 2.6 + rng.random() * 2.4
            clumps.append((x, y, r, r * 0.8))
    cl = shade_spheres(w, h, clumps, ramp, seed=seed + 1, texture=0.04, dither=0.35)
    inside = base[..., 3] > 0
    # clumps only brighten the mass (keep silhouette from big spheres, small bumps allowed at the edge)
    m = (cl[..., 3] > 0)
    lum_b = base[..., :3].astype(int).sum(-1); lum_c = cl[..., :3].astype(int).sum(-1)
    take = m & (~inside | (lum_c > lum_b - 30))
    base[take] = cl[take]
    return base


def tree(kind: str, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    shadow_args = None
    if kind == 'large_a':
        w, h = 84, 100
        shadow_args = (w, h, 42, 95, 30, 5)
        a = np.zeros((h, w, 4), np.uint8)
        a = over(a, trunk(w, h, 42, 46, 95, 11, seed, lean=0.04))
        sph = [(42, 34, 26, 20), (24, 44, 17, 14), (60, 44, 19, 15), (32, 22, 16, 13), (54, 22, 17, 14), (42, 52, 22, 11), (14, 52, 9, 8), (71, 54, 10, 8)]
        a = over(a, crown(w, h, sph, LEAF, seed))
        # hanging moss strands
        for x in (22, 30, 58, 64):
            y0 = 52 + int(rng.integers(0, 4))
            for y in range(y0, y0 + int(rng.integers(5, 11))):
                if a[y, x, 3]: continue
                a[y, x] = MOSS[1 + (y % 2)]
    elif kind == 'large_b':
        w, h = 92, 96
        shadow_args = (w, h, 46, 91, 32, 5)
        a = np.zeros((h, w, 4), np.uint8)
        a = over(a, trunk(w, h, 44, 40, 91, 13, seed, lean=-0.05))
        # twisted side branch
        for i in range(14):
            x, y = 44 + i, 58 - int(i * 0.8)
            a[y:y + 3, x:x + 2] = BARK[2 + (i % 2)]
        sph = [(36, 32, 24, 18), (62, 30, 22, 17), (48, 18, 18, 14), (20, 42, 15, 12), (74, 44, 15, 11), (48, 44, 24, 12), (64, 58, 8, 6)]
        a = over(a, crown(w, h, sph, LEAF_WARM, seed, tex=0.28))
    elif kind == 'medium_a':
        w, h = 52, 70
        shadow_args = (w, h, 26, 66, 18, 4)
        a = np.zeros((h, w, 4), np.uint8)
        a = over(a, trunk(w, h, 26, 34, 66, 6, seed))
        sph = [(26, 24, 17, 16), (15, 34, 11, 10), (37, 34, 12, 10), (26, 40, 14, 8)]
        a = over(a, crown(w, h, sph, LEAF, seed))
    elif kind == 'medium_b':
        # conifer
        w, h = 44, 76
        shadow_args = (w, h, 22, 72, 14, 4)
        a = np.zeros((h, w, 4), np.uint8)
        a = over(a, trunk(w, h, 22, 56, 72, 5, seed, roots=False))
        sph = []
        for i, (y, r) in enumerate([(14, 6), (22, 9), (31, 12), (41, 15), (51, 17)]):
            sph += [(22, y, r, 6 + i), (22 - r * 0.4, y + 3, r * 0.7, 5), (22 + r * 0.4, y + 3, r * 0.7, 5)]
        a = over(a, crown(w, h, sph, LEAF, seed, tex=0.3))
    elif kind == 'small':
        w, h = 30, 40
        shadow_args = (w, h, 15, 37, 10, 3)
        a = np.zeros((h, w, 4), np.uint8)
        a = over(a, trunk(w, h, 15, 20, 37, 4, seed, roots=False))
        a = over(a, crown(w, h, [(15, 15, 10, 10), (9, 21, 7, 6), (21, 21, 7, 6)], LEAF, seed))
    elif kind == 'dead':
        w, h = 46, 64
        shadow_args = (w, h, 23, 60, 14, 3)
        a = np.zeros((h, w, 4), np.uint8)
        a = over(a, trunk(w, h, 23, 18, 60, 7, seed, lean=0.06))
        branches = [((22, 30), (8, 16)), ((24, 26), (38, 10)), ((22, 40), (6, 34)), ((25, 36), (40, 28)), ((12, 22), (6, 12)), ((34, 16), (40, 6))]
        from PIL import Image, ImageDraw
        im = Image.fromarray(a); d = ImageDraw.Draw(im)
        for (p, q) in branches:
            d.line([p, q], fill=BARK[2], width=2); d.line([(p[0] - 1, p[1]), (q[0] - 1, q[1])], fill=BARK[3], width=1)
        a = np.array(im)
    elif kind == 'blossom':
        w, h = 60, 72
        shadow_args = (w, h, 30, 68, 20, 4)
        a = np.zeros((h, w, 4), np.uint8)
        a = over(a, trunk(w, h, 30, 38, 68, 7, seed, lean=-0.08))
        sph = [(30, 26, 19, 16), (16, 36, 12, 10), (44, 36, 13, 10), (24, 16, 11, 9), (38, 16, 11, 9), (30, 42, 15, 8)]
        a = over(a, crown(w, h, sph, BLOSSOM, seed, tex=0.3))
    else:
        raise ValueError(kind)
    body = outline(pad(a))
    sh = pad(shadow(*shadow_args, alpha=80))
    sh[body[..., 3] > 0] = 0
    return over(sh, body)


def bush(kind, seed):
    if kind == 'a':
        w, h = 30, 18
        sph = [(10, 11, 8, 6), (19, 9, 9, 7), (24, 12, 6, 5)]
        a = shade_spheres(w, h, sph, LEAF, seed=seed, texture=0.28)
    elif kind == 'b':
        w, h = 24, 16
        a = shade_spheres(w, h, [(12, 9, 10, 7), (6, 11, 5, 4)], LEAF_WARM, seed=seed, texture=0.3)
        rng = np.random.default_rng(seed)
        for _ in range(5):  # berries
            y, x = int(rng.integers(4, 12)), int(rng.integers(3, 21))
            if a[y, x, 3]: a[y, x] = C(170, 60, 70)
    elif kind == 'fern':
        w, h = 22, 16
        a = np.zeros((h, w, 4), np.uint8)
        from PIL import Image, ImageDraw
        im = Image.fromarray(a); d = ImageDraw.Draw(im)
        for i, ang in enumerate([-2.4, -2.0, -1.6, -1.2, -0.8]):
            x0, y0 = 11, 15
            for s in range(10):
                x = x0 + math.cos(ang) * s * 1.1; y = y0 + math.sin(ang) * s * 1.1 + s * s * 0.03
                d.point((x, y), fill=LEAF[2 + (s % 3 == 0)])
                d.point((x + 1, y + 1), fill=LEAF[1])
        a = np.array(im)
    elif kind == 'tall_grass':
        w, h = 18, 20
        a = np.zeros((h, w, 4), np.uint8)
        rng = np.random.default_rng(seed)
        for i in range(11):
            x = 2 + i * 1.4 + rng.random(); hh = rng.integers(10, 19); bend = rng.random() * 3 - 1.5
            for s in range(int(hh)):
                t = s / hh
                xx, yy = int(x + bend * t * t), h - 1 - s
                a[yy, xx] = GRASS[min(5, 2 + int(t * 3.5))]
    elif kind == 'flowers':
        w, h = 20, 10
        a = np.zeros((h, w, 4), np.uint8)
        rng = np.random.default_rng(seed)
        cols = [C(210, 190, 110), C(170, 120, 200), C(220, 140, 120), C(200, 200, 220)]
        for i in range(8):
            x, y = int(rng.integers(1, 19)), int(rng.integers(4, 9))
            a[y:h, x] = GRASS[3]
            c = cols[int(rng.integers(0, 4))]
            a[y - 1, x] = c; a[y, x - 1 if x > 0 else x] = c
    elif kind == 'mushrooms':
        w, h = 16, 10
        a = np.zeros((h, w, 4), np.uint8)
        for (x, y, r, col) in [(4, 6, 3, C(150, 60, 60)), (10, 5, 4, C(170, 120, 60)), (13, 7, 2, C(140, 70, 90))]:
            a[y:h - 1, x] = C(210, 200, 180)
            for dx in range(-r, r + 1):
                a[y - 1, x + dx] = col
            for dx in range(-r + 1, r):
                a[y - 2, x + dx] = col
            a[y - 2, x - 1] = C(230, 220, 200)
    elif kind == 'moss':
        w, h = 28, 8
        Y, X = np.mgrid[0:h, 0:w].astype(np.float32)
        m = ((X - 14) / 14) ** 2 + ((Y - 4) / 4) ** 2 <= 1
        v = fbm(w, h, 2, seed, 2)
        a = ramp_map(np.clip(v, 0, 0.99), MOSS)
        a[..., 3] = np.where(m & (v > 0.35), 255, 0)
        return a
    else:
        raise ValueError(kind)
    return outline(pad(a))


def rock(kind, seed):
    if kind == 'small':
        w, h = 14, 10; sph = [(7, 6, 6, 4)]
    elif kind == 'medium':
        w, h = 24, 16; sph = [(11, 9, 10, 7), (17, 11, 6, 5)]
    elif kind == 'large_mossy':
        w, h = 40, 28; sph = [(18, 16, 16, 12), (28, 18, 11, 9), (10, 21, 8, 6)]
    elif kind == 'cluster':
        w, h = 36, 20; sph = [(9, 12, 8, 7), (20, 10, 9, 8), (29, 14, 6, 5), (15, 16, 5, 3)]
    else:
        raise ValueError(kind)
    a = shade_spheres(w, h, sph, STONE, seed=seed, texture=0.2, tex_cell=2.5)
    if kind in ('large_mossy', 'medium'):
        # moss on top-facing parts
        Y, X = np.mgrid[0:h, 0:w]
        top = np.zeros((h, w), bool)
        for x in range(w):
            col = np.where(a[:, x, 3] > 0)[0]
            if len(col): top[col[0]:col[0] + (4 if kind == 'large_mossy' else 2), x] = True
        mv = fbm(w, h, 2, seed + 5, 2)
        mm = top & (mv > 0.38) & (a[..., 3] > 0)
        moss = ramp_map(np.clip(mv, 0, .99), MOSS)
        a[mm] = moss[mm]
    return outline(pad(a))


def ruin(kind, seed):
    from PIL import Image, ImageDraw
    if kind == 'pillar':
        w, h = 18, 44
        a = np.zeros((h, w, 4), np.uint8)
        body = ramp_map(np.clip(np.linspace(0.85, 0.15, w)[None, :].repeat(h, 0) + (fbm(w, h, 2, seed) - .5) * .3, 0, .99), STONE_WARM)
        m = np.zeros((h, w), bool)
        m[10:40, 4:14] = True; m[38:44, 2:16] = True; m[6:10, 3:15] = True
        # broken top
        for x in range(3, 15):
            cut = 6 + int(abs(math.sin(x * 1.7 + seed)) * 6)
            m[:cut, x] = False
        a[m] = body[m]
        for y in range(12, 38, 2): a[y, 6] = STONE_WARM[1]; a[y, 11] = STONE_WARM[1]  # flutes
        mm = (fbm(w, h, 2, seed + 3) > .6) & m
        a[mm] = MOSS[2]
    elif kind == 'wall':
        w, h = 44, 26
        a = np.zeros((h, w, 4), np.uint8)
        rng = np.random.default_rng(seed)
        for row in range(5):
            y = h - 5 - row * 5
            x = -(row % 2) * 4
            while x < w:
                bw = int(rng.integers(6, 10))
                top_limit = 24 - int(abs(math.sin((x + 3) * 0.13 + seed)) * 16)
                if y >= h - top_limit - 2 or row < 2:
                    col = STONE_WARM[int(rng.integers(2, 5))]
                    a[max(0, y):y + 4, max(0, x):min(w, x + bw - 1)] = col
                    a[y + 3, max(0, x):min(w, x + bw - 1)] = STONE_WARM[1]
                x += bw
        m = a[..., 3] > 0
        mm = (fbm(w, h, 3, seed + 2) > .62) & m
        a[mm] = MOSS[1]
    elif kind == 'slab':
        w, h = 30, 12
        a = shade_spheres(w, h, [(15, 6, 14, 5)], STONE_WARM, seed=seed, texture=.15, flat=.5)
        for x in range(6, 24, 4): a[5, x] = CYAN[1]; a[6, x + 1] = CYAN[1]
    elif kind == 'runestone':
        w, h = 16, 28
        a = np.zeros((h, w, 4), np.uint8)
        im = Image.fromarray(a); d = ImageDraw.Draw(im)
        d.polygon([(3, 27), (2, 10), (5, 3), (9, 1), (13, 5), (14, 27)], fill=STONE[3])
        a = np.array(im)
        m = a[..., 3] > 0
        sh = ramp_map(np.clip(np.linspace(.9, .2, w)[None, :].repeat(h, 0) + (fbm(w, h, 2, seed) - .5) * .25, 0, .99), STONE)
        a[m] = sh[m]
        for (x, y) in [(7, 8), (8, 9), (7, 10), (9, 12), (8, 14), (7, 15), (8, 16), (9, 18), (7, 20)]:
            a[y, x] = CYAN[3]
    elif kind == 'statue':
        w, h = 22, 42
        a = np.zeros((h, w, 4), np.uint8)
        im = Image.fromarray(a); d = ImageDraw.Draw(im)
        d.rectangle([3, 34, 18, 41], fill=STONE[3])  # plinth
        d.polygon([(6, 34), (7, 18), (5, 12), (9, 8), (13, 8), (16, 12), (14, 18), (15, 34)], fill=STONE[3])  # robed figure
        d.ellipse([8, 2, 14, 9], fill=STONE[3])
        d.polygon([(14, 14), (19, 6), (20, 7), (16, 16)], fill=STONE[3])  # raised arm (broken)
        a = np.array(im)
        m = a[..., 3] > 0
        a[14:26, 14:20][a[14:26, 14:20, 3] > 0] = 0  # broken off
        m = a[..., 3] > 0
        sh = ramp_map(np.clip(np.linspace(.95, .2, w)[None, :].repeat(h, 0) + (fbm(w, h, 2, seed) - .5) * .3, 0, .99), STONE)
        a[m] = sh[m]
        mm = (fbm(w, h, 2, seed + 7) > .6) & m
        a[mm] = MOSS[1]
    else:
        raise ValueError(kind)
    return outline(pad(a))


def crystal_cluster(seed, ramp=VIOLET):
    from PIL import Image, ImageDraw
    w, h = 22, 22
    a = np.zeros((h, w, 4), np.uint8)
    im = Image.fromarray(a); d = ImageDraw.Draw(im)
    for (x, top, hw, c) in [(7, 6, 3, 2), (13, 2, 3, 3), (17, 10, 2, 2), (4, 12, 2, 2)]:
        d.polygon([(x - hw, 21), (x - hw, top + 3), (x, top), (x + hw, top + 3), (x + hw, 21)], fill=ramp[c])
        d.line([(x, top + 1), (x, 20)], fill=ramp[c + 1])
    a = np.array(im)
    return outline(pad(a))
