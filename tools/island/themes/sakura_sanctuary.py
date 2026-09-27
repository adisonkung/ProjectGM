"""
SAKURA SANCTUARY — cosmetic Island theme.

    python3 tools/island/generate.py sakura_sanctuary

A mountain sanctuary at dusk: cherry trees in full bloom, bamboo groves, vermilion roofs over white plaster, raked
gravel paths, stone tōrō lanterns, a jade tower glow and petals drifting on the wind.
Same slots / sizes / anchors as Default Forest — see generate.py and themes/common.py.
"""
from __future__ import annotations

import numpy as np
from PIL import Image, ImageDraw

from themes.common import (C, cap, cloud, disc, far_trees, floating_rock, fore_branch, fore_grass, grade, mist, motes_sheet, petal, px, ridges,
                           scatter, sky_gradient, slot_seed, sparkle, weather_tile)

PREFIX = 'sakura'
NAME = 'Sakura Sanctuary'

SAKURA = [C(74, 32, 60), C(116, 52, 86), C(162, 82, 116), C(204, 120, 150), C(232, 164, 188), C(250, 210, 224)]
SPIRIT = [C(90, 30, 80), C(150, 60, 130), C(210, 110, 180), C(240, 170, 220), C(252, 214, 240), C(255, 244, 252)]
BAMBOO = [C(24, 52, 32), C(40, 84, 44), C(66, 122, 58), C(104, 160, 78), C(150, 196, 110)]
STONE = [C(30, 30, 38), C(50, 50, 60), C(76, 74, 84), C(104, 102, 110), C(138, 134, 138), C(176, 170, 170)]
PETALS = [C(248, 196, 214), C(236, 160, 188), C(255, 226, 236)]
OUTLINE = C(28, 14, 26)

PALETTE = {
    'OUT': OUTLINE,
    'GRASS': [C(26, 48, 40), C(42, 72, 50), C(62, 98, 58), C(88, 124, 68), C(120, 150, 82), C(158, 178, 104)],
    'LEAF': SAKURA,
    'LEAF_WARM': [C(30, 44, 28), C(52, 72, 36), C(84, 104, 44), C(122, 136, 56), C(164, 166, 76), C(204, 196, 110)],
    'BLOSSOM': SPIRIT,
    'BARK': [C(30, 18, 22), C(52, 30, 34), C(78, 46, 46), C(106, 66, 60), C(136, 92, 80)],
    'WOOD': [C(40, 16, 18), C(72, 28, 28), C(108, 42, 36), C(146, 62, 46), C(180, 90, 64), C(206, 124, 92)],
    'STONE': STONE,
    'STONE_WARM': [C(40, 36, 40), C(64, 58, 62), C(94, 86, 88), C(126, 118, 116), C(160, 152, 146), C(194, 186, 176)],
    'DIRT': [C(60, 52, 50), C(92, 82, 76), C(126, 114, 102), C(158, 146, 128), C(186, 176, 154), C(212, 204, 184)],
    'ROOF_RED': [C(60, 14, 14), C(104, 24, 20), C(150, 40, 28), C(194, 62, 38), C(224, 94, 56)],
    'ROOF_SLATE': [C(16, 22, 28), C(26, 36, 44), C(40, 54, 62), C(58, 76, 84), C(82, 102, 108)],
    'PLASTER': [C(120, 110, 110), C(160, 150, 146), C(196, 188, 180), C(222, 216, 206), C(240, 236, 228)],
    'WATER': [C(14, 40, 52), C(20, 64, 78), C(34, 96, 106), C(56, 132, 136), C(96, 172, 166), C(170, 220, 208)],
    'EMERALD': [C(14, 46, 36), C(26, 86, 64), C(50, 140, 100), C(110, 200, 150), C(200, 245, 210)],
    'CLOTH_RED': [C(56, 10, 20), C(100, 18, 30), C(150, 30, 40), C(196, 52, 56)],
    'CLOTH_BLUE': [C(18, 20, 48), C(28, 34, 80), C(44, 56, 120), C(72, 86, 160)],
}
PETAL_CAP = [C(200, 120, 150), C(228, 160, 184), C(244, 196, 214), C(255, 228, 238)]


def bamboo(seed, w=30, h=44):
    P = px()
    rng = np.random.default_rng(seed)
    a = np.zeros((h, w, 4), np.uint8)
    im = Image.fromarray(a); d = ImageDraw.Draw(im)
    for i, x in enumerate([6, 11, 15, 20, 24]):
        top = int(rng.integers(2, 12))
        d.rectangle([x, top, x + 1, h - 2], fill=BAMBOO[2 + (i % 2)])
        d.line([(x, top), (x, h - 2)], fill=BAMBOO[4 if i % 2 else 3])
        for y in range(top + 4, h - 2, 6): d.line([(x - 1, y), (x + 2, y)], fill=BAMBOO[0])
        for k in range(3):
            y = top + 2 + k * 5; side = 1 if (k + i) % 2 else -1
            d.line([(x + (2 if side > 0 else -1), y), (x + side * 6, y + 2)], fill=BAMBOO[3])
            d.line([(x + (2 if side > 0 else -1), y + 1), (x + side * 5, y + 3)], fill=BAMBOO[1])
    return P.outline(P.pad(np.array(im)), OUTLINE)


def toro():
    """stone tōrō lantern — replaces the lantern post (same 10×34 canvas; the flame FX sits in the firebox)"""
    P = px()
    a = np.zeros((34, 10, 4), np.uint8)
    im = Image.fromarray(a); d = ImageDraw.Draw(im)
    d.rectangle([1, 30, 8, 33], fill=STONE[3]); d.line([(1, 30), (8, 30)], fill=STONE[4])
    d.rectangle([3, 15, 6, 29], fill=STONE[3]); d.line([(3, 15), (3, 29)], fill=STONE[4]); d.line([(6, 15), (6, 29)], fill=STONE[2])
    d.rectangle([1, 12, 8, 14], fill=STONE[4])
    d.rectangle([2, 6, 7, 11], fill=STONE[3]); d.rectangle([4, 8, 5, 10], fill=C(255, 214, 140))
    d.polygon([(0, 5), (2, 2), (7, 2), (9, 5)], fill=STONE[4]); d.line([(0, 5), (9, 5)], fill=STONE[2])
    d.rectangle([4, 0, 5, 1], fill=STONE[4])
    return P.outline(P.pad(np.array(im), 1), OUTLINE)


def spirit_sakura(orig_tree, seed):
    P = px()
    a = orig_tree('blossom', seed)
    a = scatter(a, 40, seed, [C(255, 240, 250), C(255, 214, 236)], mask=(a[..., 3] > 200) & (a[..., 0] > 180))
    h, w = a.shape[:2]
    return P.over(P.glow(w, h, w / 2, h * 0.4, 30, (255, 190, 230), 0.3, 1.5), a)


def sky(W, H):
    a = sky_gradient(W, H, [(0.0, (30, 24, 62)), (0.16, (58, 40, 92)), (0.28, (130, 80, 124)), (0.36, (214, 140, 146)), (0.42, (246, 196, 168)),
                            (0.48, (180, 128, 148)), (0.6, (70, 46, 78)), (1.0, (28, 20, 38))], stars=70, star_top=0.2)
    return disc(a, W * 0.7, H * 0.37, 11, (255, 232, 200), (255, 200, 170), 70, 0.45)


def patch(m):
    N, T, F = m['N'], m['T'], m['F']
    P = px()
    orig_tree, orig_bush, orig_lantern = N.tree, N.bush, F.lantern_post

    def tree(kind, seed):
        if kind == 'small': return bamboo(seed)
        if kind == 'blossom': return spirit_sakura(orig_tree, seed)
        return orig_tree(kind, seed)

    def bush(kind, seed):
        a = orig_bush(kind, seed)
        if kind == 'flowers':
            a = scatter(a, 12, seed, PETALS, mask=a[..., 3] > 200)
        return a

    N.tree, N.bush = tree, bush
    F.lantern_post = toro
    T.sky = sky
    T.mountains = lambda W, h=90, seed=3: ridges(W, h, [(30, 50, (92, 80, 130), (130, 110, 160), None, None, 2.2, 0),
                                                        (54, 34, (62, 56, 98), (96, 84, 130), None, None, 2.2, 0)], seed)
    T.forest_far = lambda W, h=64, seed=5: far_trees(W, h, [(96, 52, 86), (120, 64, 100), (146, 80, 114)], [(200, 130, 160), (220, 150, 176), (236, 170, 192)], 'round', seed)
    T.mist_band = lambda W, h=40: mist(W, h, (240, 200, 220), 90)
    T.fore_branch = lambda seed=2, flip=False: fore_branch(SAKURA, (50, 28, 30, 255), C(20, 8, 16), seed, flip, blossom=PETALS)
    T.fore_grass = lambda seed=4, w=90, h=26: fore_grass([C(22, 38, 28), C(40, 64, 44), C(76, 108, 64)], seed, w, h)
    F.cloud = lambda seed, w=70, h=22: cloud(seed, [C(120, 80, 110), C(160, 110, 130), C(200, 146, 150), C(232, 184, 176), C(248, 216, 200)], w, h)
    F.floating_rock = lambda seed, w=40, h=34: floating_rock(seed, [C(120, 50, 80), C(170, 80, 110), C(214, 124, 150), C(240, 170, 190)],
                                                             [C(40, 30, 40), C(62, 48, 58), C(88, 70, 80), C(116, 96, 104)], C(20, 10, 18), None, w, h)
    F.fireflies_sheet = lambda frames=8, w=160, h=90, n=10, seed=8: motes_sheet((255, 210, 228), (240, 150, 190), frames, w, h, n + 2, seed, rise=-8, cross=False)


def post(slot, category, arr, frames):
    seed = slot_seed(slot)
    if slot == 'terrain.ground':
        a = grade(arr, (1.0, 1.02, 0.95), 0.25, (40, 150))
        return scatter(a, 1400, 7, PETALS, mask=a[..., 3] > 200)
    if slot == 'road.layer':
        return scatter(arr, 500, 9, PETALS, mask=arr[..., 3] > 200)
    if frames > 1 or category not in ('building', 'prop', 'rock', 'ruin') or any(k in slot for k in ('light', 'glow', 'runes', 'crystal', 'magic.', 'shadow')):
        return arr
    # petals settled on roofs, ledges and stones
    return cap(arr, PETAL_CAP, 1, seed, prob=0.35 if category == 'building' else 0.25)


def extra(emit, L):
    emit('weather.petalsFar', 'fx', 'petals_far', weather_tile(160, 160, 34, 41, petal(PETALS)), anchor='top-left')
    emit('weather.petalsNear', 'fx', 'petals_near', weather_tile(220, 220, 14, 43, petal([C(255, 214, 230), C(246, 176, 204)])), anchor='top-left')
