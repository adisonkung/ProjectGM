"""
DESERT OASIS — cosmetic Island theme.

    python3 tools/island/generate.py desert_oasis

A sandstone oasis town at sunset: golden dunes, palms and acacias around a turquoise spring, terracotta and turquoise
domes over adobe walls, cacti with a blooming Sunbloom giant, mesas on the horizon, a roaring furnace and sand on the wind.
Same slots / sizes / anchors as Default Forest — see generate.py and themes/common.py.
"""
from __future__ import annotations

import math

import numpy as np
from PIL import Image, ImageDraw

from themes.common import (C, cap, cloud, disc, dot, far_trees, floating_rock, fore_branch, fore_grass, grade, mist, motes_sheet, px, ridges, scatter,
                           sky_gradient, slot_seed, streak, weather_tile)

PREFIX = 'desert'
NAME = 'Desert Oasis'

PALM = [C(16, 38, 28), C(26, 60, 38), C(42, 88, 46), C(66, 118, 54), C(98, 148, 66), C(138, 176, 84)]
CACTUS = [C(20, 50, 34), C(34, 80, 48), C(54, 114, 62), C(84, 148, 78), C(126, 180, 100)]
BLOOM = [C(140, 34, 90), C(196, 60, 120), C(234, 110, 160), C(250, 170, 200)]
TRUNK = [C(50, 32, 22), C(80, 54, 34), C(112, 80, 48), C(146, 110, 66), C(178, 142, 90)]
SAND_CAP = [C(176, 132, 84), C(206, 164, 108), C(228, 192, 138), C(244, 216, 170)]
OUTLINE = C(30, 16, 12)

PALETTE = {
    'OUT': OUTLINE,
    'GRASS': [C(128, 90, 56), C(160, 118, 74), C(190, 148, 96), C(212, 174, 118), C(228, 196, 142), C(242, 216, 168)],
    'LEAF': PALM,
    'LEAF_WARM': [C(40, 42, 20), C(62, 64, 28), C(90, 90, 38), C(122, 118, 50), C(156, 146, 66), C(190, 176, 90)],
    'BLOSSOM': [C(90, 20, 60), C(140, 34, 90), C(196, 60, 120), C(234, 110, 160), C(250, 170, 200), C(255, 220, 236)],
    'BARK': TRUNK,
    'WOOD': [C(60, 40, 28), C(96, 66, 44), C(134, 98, 64), C(170, 132, 90), C(202, 168, 120), C(226, 200, 156)],
    'STONE': [C(80, 52, 38), C(118, 80, 54), C(156, 112, 72), C(192, 148, 98), C(220, 182, 130), C(240, 210, 166)],
    'STONE_WARM': [C(96, 70, 52), C(136, 104, 76), C(172, 138, 100), C(204, 172, 128), C(228, 200, 158), C(244, 224, 190)],
    'MOSS': [C(70, 70, 34), C(96, 96, 44), C(126, 122, 58), C(156, 150, 76)],
    'DIRT': [C(62, 36, 24), C(90, 54, 34), C(118, 74, 46), C(144, 94, 58), C(168, 116, 74), C(190, 138, 92)],
    'ROOF_RED': [C(70, 28, 18), C(110, 44, 26), C(150, 66, 36), C(186, 92, 52), C(214, 122, 74)],
    'ROOF_SLATE': [C(10, 50, 58), C(18, 82, 90), C(30, 116, 120), C(56, 156, 150), C(100, 196, 180)],
    'PLASTER': [C(120, 90, 64), C(160, 126, 92), C(196, 162, 122), C(222, 192, 152), C(240, 216, 180)],
    'WATER': [C(10, 54, 70), C(16, 86, 100), C(26, 122, 130), C(46, 160, 156), C(96, 200, 186), C(180, 240, 220)],
    'EMERALD': [C(8, 50, 56), C(16, 94, 100), C(34, 150, 150), C(100, 220, 200), C(210, 255, 240)],
    'CLOTH_RED': [C(90, 20, 14), C(140, 40, 20), C(190, 70, 30), C(228, 120, 50)],
    'CLOTH_BLUE': [C(16, 20, 56), C(26, 34, 94), C(40, 54, 140), C(66, 86, 184)],
}


def palm(seed, w, h, lean=0.1, fronds=8):
    """curved ringed trunk + arching fronds + coconuts"""
    P = px()
    rng = np.random.default_rng(seed)
    a = np.zeros((h, w, 4), np.uint8)
    im = Image.fromarray(a); d = ImageDraw.Draw(im)
    base_x, top_y = w / 2 - lean * h * 0.4, h * 0.28
    pts = []
    for i in range(24):
        t = i / 23
        x = base_x + lean * h * 0.8 * t * t + math.sin(t * 3) * 1.5
        y = h - 2 - (h - 2 - top_y) * t
        pts.append((x, y))
    for i, (x, y) in enumerate(pts):
        r = 3.2 - i / 23 * 1.4
        d.ellipse([x - r, y - 2, x + r, y + 2], fill=TRUNK[2 + (i % 2)])
        d.line([(x - r + 1, y), (x - r + 1, y + 1)], fill=TRUNK[4])
    cx, cy = pts[-1]
    angs = np.linspace(math.pi * 1.05, math.pi * 1.95, fronds) + (rng.random(fronds) - .5) * 0.2
    for k, ang in enumerate(list(angs) + [math.pi * 0.95, math.pi * 0.05]):
        ln = w * (0.36 + rng.random() * 0.12)
        prev = (cx, cy)
        for s in range(1, 13):
            t = s / 12
            x = cx + math.cos(ang) * ln * t
            y = cy + math.sin(ang) * ln * t * 0.55 + (t * t) * ln * 0.45
            col = PALM[2 + (s % 2)] if t < .8 else PALM[4]
            d.line([prev, (x, y)], fill=col, width=3 if t < .6 else 2)
            # leaflets
            d.line([(x, y), (x + math.cos(ang + 1.9) * 3, y + 3)], fill=PALM[1])
            prev = (x, y)
    for (dx, dy) in [(-2, 3), (2, 3), (0, 5)]:
        d.ellipse([cx + dx - 2, cy + dy - 2, cx + dx + 1, cy + dy + 1], fill=C(90, 58, 30))
    a = np.array(im)
    a = P.outline(P.pad(a), OUTLINE)
    return a


def acacia(seed, w=54, h=66):
    P = px()
    a = np.zeros((h, w, 4), np.uint8)
    im = Image.fromarray(a); d = ImageDraw.Draw(im)
    cx = w // 2
    d.line([(cx, h - 2), (cx - 1, h * 0.45)], fill=TRUNK[2], width=3)
    for (x1, y1) in [(cx - 16, h * 0.3), (cx + 14, h * 0.28), (cx - 4, h * 0.26)]:
        d.line([(cx, h * 0.5), (x1, y1)], fill=TRUNK[3], width=2)
    a = np.array(im)
    import gen_nature as N
    crown = N.crown(w, h, [(cx, h * 0.24, w * 0.46, h * 0.09), (cx - 12, h * 0.26, w * 0.2, h * 0.07), (cx + 12, h * 0.22, w * 0.2, h * 0.07)], PALETTE['LEAF_WARM'], seed, tex=.3)
    a = P.over(a, crown)
    return P.outline(P.pad(a), OUTLINE)


def cactus(seed, w=30, h=44, bloom=False):
    P = px()
    a = np.zeros((h, w, 4), np.uint8)
    im = Image.fromarray(a); d = ImageDraw.Draw(im)
    cx = w // 2
    tw = max(3, w // 7)
    d.rounded_rectangle([cx - tw, int(h * 0.12), cx + tw, h - 2], radius=tw, fill=CACTUS[2])
    for side, (y0, y1, ln) in ((-1, (0.5, 0.28, 0.3)), (1, (0.62, 0.38, 0.28))):
        ay = int(h * y0); x_out = cx + side * int(w * ln)
        d.rounded_rectangle([min(cx, x_out) - 1, ay - tw + 1, max(cx, x_out) + 1, ay + 1], radius=2, fill=CACTUS[2])
        d.rounded_rectangle([x_out - tw + 1, int(h * y1), x_out + tw - 1, ay + 1], radius=tw - 1, fill=CACTUS[2])
    a = np.array(im)
    m = a[..., 3] > 0
    X = np.mgrid[0:h, 0:w][1]
    ribs = (X % 3 == 0)
    a[m & ribs] = CACTUS[1]
    a[m & (X < cx - tw + 2)] = CACTUS[3]
    rng = np.random.default_rng(seed)
    ys, xs = np.where(m)
    for i in rng.choice(len(xs), min(len(xs), 14), replace=False): a[ys[i], xs[i]] = C(236, 226, 190)
    if bloom:
        for (bx, by) in [(cx, int(h * 0.1)), (cx + int(w * 0.28), int(h * 0.36)), (cx - int(w * 0.3), int(h * 0.26))]:
            for dx, dy, c in [(0, 0, BLOOM[3]), (-1, 0, BLOOM[2]), (1, 0, BLOOM[2]), (0, -1, BLOOM[2]), (0, 1, BLOOM[1]), (-1, -1, BLOOM[1]), (1, -1, BLOOM[1])]:
                if 0 <= by + dy < h and 0 <= bx + dx < w: a[by + dy, bx + dx] = c
            a[by, bx] = C(255, 236, 150)
    a = P.outline(P.pad(a), OUTLINE)
    if bloom:
        a = P.over(P.glow(a.shape[1], a.shape[0], a.shape[1] / 2, a.shape[0] * 0.2, 24, (255, 150, 200), 0.3, 1.5), a)
    return a


def agave(seed, w=22, h=16):
    P = px()
    a = np.zeros((h, w, 4), np.uint8)
    im = Image.fromarray(a); d = ImageDraw.Draw(im)
    for i, ang in enumerate(np.linspace(-2.8, -0.35, 7)):
        x1, y1 = 11 + math.cos(ang) * 10, 15 + math.sin(ang) * 13
        d.polygon([(10, 15), (x1, y1), (12, 15)], fill=CACTUS[2 + (i % 2)])
        d.line([(11, 14), (x1, y1)], fill=CACTUS[4])
    return P.outline(P.pad(np.array(im)), OUTLINE)


def sky(W, H):
    a = sky_gradient(W, H, [(0.0, (40, 26, 70)), (0.2, (90, 50, 100)), (0.32, (190, 90, 90)), (0.4, (244, 150, 80)), (0.46, (252, 204, 124)),
                            (0.54, (206, 124, 90)), (1.0, (62, 30, 40))], stars=40, star_top=0.16)
    return disc(a, W * 0.3, H * 0.43, 16, (255, 230, 170), (255, 170, 90), 90, 0.55)


def patch(m):
    N, T, F = m['N'], m['T'], m['F']
    P = px()
    orig_tree, orig_bush = N.tree, N.bush

    def tree(kind, seed):
        if kind == 'large_a': return palm(seed, 80, 104, 0.12, 9)
        if kind == 'large_b': return palm(seed, 88, 98, -0.14, 9)
        if kind == 'medium_a': return acacia(seed)
        if kind == 'medium_b': return palm(seed, 46, 78, 0.08, 7)
        if kind == 'small': return cactus(seed)
        if kind == 'blossom': return cactus(seed, 50, 72, bloom=True)  # special plant: Sunbloom giant cactus
        return orig_tree(kind, seed)

    def bush(kind, seed):
        if kind == 'fern': return agave(seed)
        a = orig_bush(kind, seed)
        if kind == 'flowers': a = scatter(a, 12, seed, [C(250, 180, 60), C(240, 110, 60), C(255, 230, 120)], mask=a[..., 3] > 200)
        if kind == 'mushrooms': return P.outline(P.pad(cactus(seed, 16, 12)[1:-1, 1:-1]), OUTLINE)
        return a

    N.tree, N.bush = tree, bush
    T.sky = sky
    T.mountains = lambda W, h=90, seed=3: ridges(W, h, [(34, 50, (150, 70, 50), (196, 110, 70), None, None, 1.5, 8),
                                                        (56, 32, (110, 50, 40), (150, 76, 56), None, None, 1.5, 6)], seed)
    T.forest_far = lambda W, h=64, seed=5: far_trees(W, h, [(70, 36, 40), (90, 46, 46), (110, 58, 52)], [(160, 90, 70), (180, 104, 78), (200, 120, 86)], 'palm', seed)
    T.mist_band = lambda W, h=40: mist(W, h, (230, 180, 130), 90)
    T.fore_branch = lambda seed=2, flip=False: fore_branch(PALM, (60, 40, 26, 255), C(12, 8, 6), seed, flip)
    T.fore_grass = lambda seed=4, w=90, h=26: fore_grass([C(90, 60, 30), C(140, 100, 50), C(200, 160, 90)], seed, w, h)
    F.cloud = lambda seed, w=70, h=22: cloud(seed, [C(120, 60, 70), C(170, 90, 80), C(214, 130, 96), C(240, 176, 120), C(252, 214, 160)], w, h, 200)
    F.floating_rock = lambda seed, w=40, h=34: floating_rock(seed, PALETTE['GRASS'][2:], PALETTE['STONE'][1:5], OUTLINE, None, w, h)
    F.fireflies_sheet = lambda frames=8, w=160, h=90, n=10, seed=8: motes_sheet((255, 232, 160), (240, 180, 90), frames, w, h, n, seed, rise=0, cross=False)
    orig_smoke = F.smoke_sheet
    F.smoke_sheet = lambda frames=8, w=26, h=56, seed=2, tint=None: orig_smoke(frames, w, h, seed, (170, 150, 130))


def post(slot, category, arr, frames):
    seed = slot_seed(slot)
    if slot == 'terrain.ground':
        a = grade(arr, (1.12, 0.98, 0.82), 0.4, (60, 200))  # greens / blues of the shared code → sand
        return scatter(a, 900, 13, [C(150, 104, 66), C(236, 212, 170)], mask=a[..., 3] > 200)
    if category in ('terrain', 'road'):
        return grade(arr, (1.12, 0.98, 0.82), 0.4, (60, 200))
    if frames > 1 or category not in ('building', 'prop', 'rock', 'ruin') or any(k in slot for k in ('light', 'glow', 'runes', 'crystal', 'magic.', 'shadow')):
        return arr
    a = grade(arr, (1.12, 0.98, 0.82), 0.4, (60, 200))
    # sand dust settled on ledges
    return cap(a, SAND_CAP, 1, seed, prob=0.5)


def extra(emit, L):
    sand = [C(230, 196, 140), C(210, 170, 110), C(246, 220, 170)]
    emit('weather.sandFar', 'fx', 'sand_far', weather_tile(160, 120, 50, 71, dot(sand, 1, (100, 190))), anchor='top-left')
    emit('weather.sandNear', 'fx', 'sand_near', weather_tile(220, 160, 22, 73, streak(sand, 5, (80, 170))), anchor='top-left')
