"""
CURSED HOLLOW — cosmetic Island theme.

    python3 tools/island/generate.py cursed_hollow

A hollow under a blood moon: withered violet canopies, dead trees, giant glowcap mushrooms, bruised-plum roofs dripping
with toxic lichen, ash on the wind, will-o'-wisps, purple fog and cursed purple-green fire.
Same slots / sizes / anchors as Default Forest — see generate.py and themes/common.py.
"""
from __future__ import annotations

import math

import numpy as np
from PIL import Image, ImageDraw

from themes.common import (C, bands, cloud, disc, dot, drips, far_trees, floating_rock, fore_branch, fore_grass, grade, mist, motes_sheet, px, ridges,
                           scatter, sky_gradient, slot_seed, weather_tile)

PREFIX = 'cursed'
NAME = 'Cursed Hollow'

LICHEN = [C(34, 62, 30), C(60, 106, 40), C(100, 158, 52), C(150, 212, 80)]
SLIME = [C(70, 140, 50), C(130, 210, 80), C(200, 255, 150)]
GLOWCAP = [C(40, 16, 60), C(74, 28, 110), C(118, 50, 170), C(168, 90, 220), C(206, 150, 246), C(236, 210, 255)]
OUTLINE = C(8, 4, 12)

PALETTE = {
    'OUT': OUTLINE,
    'GRASS': [C(34, 28, 44), C(50, 42, 62), C(68, 58, 80), C(88, 76, 98), C(110, 96, 118), C(134, 120, 140)],
    'LEAF': [C(14, 8, 20), C(26, 14, 36), C(42, 22, 56), C(60, 34, 78), C(84, 50, 102), C(112, 72, 128)],
    'LEAF_WARM': [C(22, 22, 16), C(38, 36, 24), C(58, 52, 32), C(80, 70, 40), C(104, 90, 52), C(130, 112, 66)],
    'BLOSSOM': GLOWCAP,
    'BARK': [C(14, 12, 18), C(26, 22, 30), C(40, 34, 44), C(58, 50, 62), C(80, 72, 84)],
    'WOOD': [C(22, 20, 26), C(38, 34, 42), C(56, 50, 60), C(78, 70, 80), C(102, 94, 102), C(128, 120, 126)],
    'STONE': [C(18, 20, 24), C(30, 34, 40), C(46, 52, 58), C(66, 74, 80), C(90, 98, 104), C(118, 126, 130)],
    'STONE_WARM': [C(24, 20, 28), C(40, 34, 46), C(60, 52, 66), C(84, 74, 90), C(110, 100, 116), C(140, 130, 146)],
    'MOSS': LICHEN,
    'DIRT': [C(56, 50, 56), C(80, 72, 78), C(106, 98, 102), C(132, 124, 126), C(158, 150, 150), C(182, 176, 174)],
    'ROOF_RED': [C(26, 12, 26), C(44, 18, 42), C(66, 28, 62), C(90, 40, 84), C(116, 56, 106)],
    'ROOF_SLATE': [C(12, 12, 18), C(22, 22, 30), C(34, 34, 46), C(50, 50, 64), C(70, 70, 86)],
    'PLASTER': [C(46, 42, 50), C(70, 64, 74), C(96, 90, 98), C(124, 118, 124), C(150, 146, 150)],
    'METAL': [C(18, 18, 24), C(34, 34, 42), C(56, 56, 66), C(84, 84, 96), C(118, 118, 130)],
    'WATER': [C(12, 28, 20), C(18, 46, 30), C(28, 72, 40), C(46, 104, 52), C(80, 150, 70), C(150, 220, 120)],
    'FIRE': [C(50, 14, 70), C(100, 34, 150), C(160, 80, 220), C(170, 240, 160), C(230, 255, 220)],
    'EMERALD': [C(10, 40, 20), C(20, 80, 36), C(50, 150, 60), C(130, 230, 110), C(220, 255, 200)],
    'CLOTH_RED': [C(34, 8, 14), C(60, 12, 22), C(90, 20, 30), C(124, 32, 40)],
    'CLOTH_BLUE': [C(16, 24, 16), C(26, 40, 24), C(40, 62, 34), C(62, 90, 46)],
}


def glowcap(seed, w=58, h=70):
    """special plant: a giant glowcap mushroom with luminous spots"""
    P = px()
    a = np.zeros((h, w, 4), np.uint8)
    im = Image.fromarray(a); d = ImageDraw.Draw(im)
    cx = w // 2
    d.polygon([(cx - 5, h - 2), (cx - 3, h * 0.42), (cx + 4, h * 0.42), (cx + 6, h - 2)], fill=C(170, 160, 180))
    d.line([(cx + 4, h * 0.45), (cx + 5, h - 3)], fill=C(120, 110, 132))
    d.line([(cx - 4, h * 0.45), (cx - 4, h - 3)], fill=C(206, 198, 214))
    for k in range(3): d.line([(cx - 3, h * 0.55 + k * 7), (cx + 4, h * 0.55 + k * 7 + 1)], fill=C(140, 130, 150))
    a = np.array(im)
    capm = P.shade_spheres(w, h, [(cx, h * 0.36, w * 0.46, h * 0.2), (cx - 8, h * 0.33, w * 0.26, h * 0.15)], GLOWCAP, seed=seed, texture=.12, flat=.1)
    capm[(np.mgrid[0:h, 0:w][0] > h * 0.46)] = 0
    a = P.over(a, capm)
    rng = np.random.default_rng(seed)
    for _ in range(9):
        x, y = int(cx + (rng.random() - .5) * w * 0.7), int(h * (0.22 + rng.random() * 0.2))
        if a[y, x, 3] > 0:
            a[y, x] = C(200, 255, 170); a[y, x + 1] = C(140, 230, 120)
    a = drips(P.pad(a), SLIME, seed, 4, 5, 0.6, 0.6)
    a = P.outline(a, OUTLINE)
    return P.over(P.glow(a.shape[1], a.shape[0], a.shape[1] / 2, a.shape[0] * 0.38, 30, (170, 110, 255), 0.35, 1.5), a)


def dead_sapling(seed, w=30, h=42):
    P = px()
    a = np.zeros((h, w, 4), np.uint8)
    im = Image.fromarray(a); d = ImageDraw.Draw(im)
    bark = PALETTE['BARK']
    d.line([(15, h - 2), (14, 14)], fill=bark[2], width=3)
    for (p, q) in [((14, 24), (5, 12)), ((15, 20), (25, 8)), ((14, 30), (6, 26)), ((15, 28), (24, 22)), ((6, 13), (3, 6)), ((24, 9), (27, 3))]:
        d.line([p, q], fill=bark[3], width=1)
    return P.outline(P.pad(np.array(im)), OUTLINE)


def small_glowcaps(seed, w=16, h=12):
    a = np.zeros((h, w, 4), np.uint8)
    for (x, y, r) in [(4, 6, 3), (10, 5, 4), (13, 7, 2)]:
        a[y:h - 1, x] = C(190, 180, 200)
        for dx in range(-r, r + 1): a[y - 1, x + dx] = GLOWCAP[3]
        for dx in range(-r + 1, r): a[y - 2, x + dx] = GLOWCAP[4]
        a[y - 2, x] = C(210, 255, 180)
    return a


def wisp_lantern(frames=4):
    """lantern flame recoloured: green will-o'-wisp glow"""
    P = px()
    out = []
    for f in range(frames):
        a = P.glow(18, 20, 9, 11, 9 - (f % 2), (150, 255, 140), 0.55 + 0.15 * (f % 3 == 0), 1.2)
        a[8:14, 7:11] = (*PALETTE['METAL'][1][:3], 255)
        a[9:13, 8:10] = (170, 255, 160, 255) if f % 2 else (230, 255, 220, 255)
        a[7, 8:10] = PALETTE['METAL'][2]; a[14, 7:11] = PALETTE['METAL'][2]
        out.append(a)
    return P.strip(out)


def sky(W, H):
    a = sky_gradient(W, H, [(0.0, (8, 4, 14)), (0.25, (22, 10, 34)), (0.38, (46, 18, 48)), (0.44, (74, 28, 54)), (0.5, (42, 16, 40)), (1.0, (10, 6, 14))],
                     stars=110, star_top=0.3)
    a = bands(a, [(0.3, 0.03, 0.006, 1.0, (80, 160, 90), 0.18, 0.05)])
    return disc(a, W * 0.76, H * 0.14, 14, (206, 64, 64), (230, 60, 70), 80, 0.5, ((170, 44, 50), -4, -3))


def to_green_light(a):
    """warm window light → sickly green (cursed interiors)"""
    a = a.copy()
    m = a[..., 3] > 0
    r, g, b = a[m, 0].astype(int), a[m, 1].astype(int), a[m, 2].astype(int)
    a[m, 0] = (g * 0.62).astype(np.uint8); a[m, 1] = np.clip(r * 0.98, 0, 255).astype(np.uint8); a[m, 2] = (b * 0.7).astype(np.uint8)
    return a


def patch(m):
    N, T, F = m['N'], m['T'], m['F']
    P = px()
    orig_tree, orig_bush = N.tree, N.bush

    def tree(kind, seed):
        if kind == 'small': return dead_sapling(seed)
        if kind == 'blossom': return glowcap(seed)
        a = orig_tree(kind, seed)
        return scatter(a, 6, seed, [C(160, 255, 140)], mask=(a[..., 3] > 200) & (a[..., 2] > 60))

    def bush(kind, seed):
        if kind == 'mushrooms': return P.outline(P.pad(small_glowcaps(seed)), OUTLINE)
        a = orig_bush(kind, seed)
        if kind == 'flowers': a = scatter(a, 10, seed, [C(150, 60, 200), C(110, 40, 160)], mask=a[..., 3] > 200)
        return a

    N.tree, N.bush = tree, bush
    T.sky = sky
    T.mountains = lambda W, h=90, seed=3: ridges(W, h, [(24, 60, (30, 20, 40), (70, 40, 80), None, None, 4.0, 0),
                                                        (48, 40, (20, 14, 28), (46, 30, 58), None, None, 4.0, 0)], seed)
    T.forest_far = lambda W, h=64, seed=5: far_trees(W, h, [(20, 14, 26), (28, 20, 36), (38, 28, 48)], [(60, 90, 60), (70, 110, 70), (90, 140, 80)], 'dead', seed)
    T.mist_band = lambda W, h=40: mist(W, h, (120, 80, 150), 130)
    T.fore_branch = lambda seed=2, flip=False: fore_branch(PALETTE['LEAF'], (20, 16, 24, 255), C(4, 2, 8), seed, flip)
    T.fore_grass = lambda seed=4, w=90, h=26: fore_grass([C(20, 18, 26), C(40, 36, 48), C(84, 76, 92)], seed, w, h)
    F.cloud = lambda seed, w=70, h=22: cloud(seed, [C(20, 12, 28), C(36, 22, 46), C(56, 34, 68), C(80, 52, 92), C(106, 74, 116)], w, h, 200)
    F.floating_rock = lambda seed, w=40, h=34: floating_rock(seed, LICHEN, [C(16, 14, 22), C(28, 24, 36), C(42, 36, 52), C(60, 52, 70)], OUTLINE, SLIME, w, h)
    F.fireflies_sheet = lambda frames=8, w=160, h=90, n=10, seed=8: motes_sheet((190, 255, 170), (90, 210, 100), frames, w, h, n, seed, rise=6)
    F.lantern_sheet = wisp_lantern


def post(slot, category, arr, frames):
    seed = slot_seed(slot)
    if slot in ('building.tavern.light', 'building.forge.light', 'fx.windowFlicker'):
        return to_green_light(arr)
    if slot == 'terrain.ground':
        a = grade(arr, (0.95, 0.86, 1.12), 0.6, (20, 170))
        return scatter(a, 260, 5, [C(150, 240, 130), C(120, 60, 170)], mask=a[..., 3] > 200)
    if category in ('terrain', 'road'):
        return grade(arr, (0.95, 0.86, 1.12), 0.5, (20, 170))
    if frames > 1 or category not in ('building', 'prop', 'rock', 'ruin') or any(k in slot for k in ('light', 'glow', 'runes', 'crystal', 'magic.', 'shadow')):
        return arr
    a = grade(arr, (0.95, 0.86, 1.12), 0.55, (15, 170))
    if category == 'building':
        a = drips(a, SLIME, seed % 13, 4, 4, 0.8, 0.45)  # toxic lichen dripping from eaves
    return a


def extra(emit, L):
    ash = [C(120, 112, 124), C(90, 84, 96), C(150, 144, 150)]
    emit('weather.ash', 'fx', 'ash', weather_tile(180, 180, 44, 51, dot(ash, 1, (110, 200))), anchor='top-left')
    emit('weather.embers', 'fx', 'embers', weather_tile(220, 220, 12, 53, dot([C(190, 110, 255), C(150, 255, 150)], 2, (160, 240))), anchor='top-left')
