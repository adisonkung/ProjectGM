"""
CELESTIAL ISLE — cosmetic Island theme.

    python3 tools/island/generate.py celestial_isle

An island above the clouds in bright daylight: luminous meadows, white marble and gilded domes, silver-barked trees
with white-gold leaves, floating crystal plants, a divine white-gold forge flame and golden motes rising into the sky.
Same slots / sizes / anchors as Default Forest — see generate.py and themes/common.py.
"""
from __future__ import annotations

import numpy as np

from themes.common import (C, cap, cloud, disc, dot, far_trees, floating_rock, fore_branch, fore_grass, grade, mist, motes_sheet, petal, px, ridges,
                           scatter, shard_crown, sky_gradient, slot_seed, sparkle, weather_tile)

PREFIX = 'celestial'
NAME = 'Celestial Isle'

GOLD_LEAF = [C(96, 92, 88), C(140, 134, 116), C(186, 178, 146), C(222, 214, 180), C(244, 238, 210), C(255, 252, 236)]
STARLIGHT = [C(40, 60, 120), C(70, 110, 190), C(120, 170, 236), C(190, 220, 255), C(250, 236, 180), C(255, 252, 236)]
GILD = [C(170, 120, 40), C(214, 170, 70), C(244, 212, 120), C(255, 240, 190)]
OUTLINE = C(34, 32, 58)

PALETTE = {
    'OUT': OUTLINE,
    'GRASS': [C(52, 82, 76), C(78, 116, 96), C(112, 152, 112), C(150, 186, 128), C(190, 214, 152), C(228, 238, 188)],
    'LEAF': GOLD_LEAF,
    'LEAF_WARM': [C(40, 80, 96), C(64, 118, 132), C(96, 158, 166), C(140, 196, 196), C(186, 226, 220), C(226, 248, 242)],
    'BLOSSOM': [C(110, 70, 20), C(160, 110, 36), C(210, 160, 60), C(240, 204, 110), C(252, 232, 170), C(255, 250, 220)],
    'BARK': [C(70, 70, 84), C(104, 104, 118), C(140, 140, 152), C(176, 176, 186), C(212, 212, 220)],
    'WOOD': [C(80, 70, 60), C(120, 108, 92), C(160, 146, 122), C(196, 182, 154), C(224, 212, 186), C(244, 236, 214)],
    'STONE': [C(90, 94, 118), C(126, 130, 152), C(162, 166, 186), C(196, 198, 214), C(224, 224, 236), C(246, 246, 252)],
    'STONE_WARM': [C(104, 96, 100), C(142, 134, 134), C(178, 170, 166), C(208, 200, 192), C(232, 226, 216), C(250, 246, 238)],
    'MOSS': [C(150, 120, 50), C(190, 160, 70), C(226, 200, 110), C(250, 232, 160)],
    'DIRT': [C(110, 106, 120), C(146, 142, 156), C(180, 176, 188), C(208, 206, 214), C(230, 228, 234), C(248, 246, 250)],
    'ROOF_RED': [C(100, 62, 20), C(150, 100, 34), C(200, 148, 56), C(236, 192, 96), C(252, 226, 150)],
    'ROOF_SLATE': [C(20, 40, 90), C(34, 64, 130), C(52, 96, 170), C(84, 136, 206), C(130, 180, 234)],
    'PLASTER': [C(150, 150, 166), C(188, 188, 200), C(218, 218, 228), C(238, 238, 244), C(252, 252, 255)],
    'METAL': [C(90, 80, 60), C(140, 124, 86), C(196, 176, 120), C(230, 214, 170), C(252, 244, 220)],
    'WATER': [C(40, 90, 150), C(60, 130, 190), C(96, 170, 220), C(140, 206, 240), C(196, 236, 252), C(245, 252, 255)],
    'FIRE': [C(160, 110, 30), C(220, 170, 60), C(250, 220, 120), C(255, 246, 200), C(255, 255, 250)],
    'EMERALD': [C(20, 50, 100), C(36, 90, 160), C(70, 140, 220), C(140, 200, 255), C(220, 245, 255)],
    'CLOTH_RED': [C(20, 40, 90), C(34, 64, 140), C(56, 100, 190), C(96, 146, 230)],
    'CLOTH_BLUE': [C(150, 130, 90), C(200, 180, 130), C(236, 220, 170), C(252, 244, 214)],
}


def sky(W, H):
    a = sky_gradient(W, H, [(0.0, (60, 110, 200)), (0.28, (104, 164, 234)), (0.44, (178, 214, 246)), (0.56, (232, 238, 250)), (1.0, (214, 224, 246))])
    return disc(a, W * 0.78, H * 0.12, 10, (255, 252, 236), (255, 236, 180), 90, 0.55)


def patch(m):
    N, T, F = m['N'], m['T'], m['F']
    P = px()
    orig_tree, orig_bush = N.tree, N.bush

    def tree(kind, seed):
        if kind == 'blossom':  # special plant: Starlight Tree
            return shard_crown(60, 74, seed, STARLIGHT, C(230, 230, 240), C(170, 170, 190), halo=(255, 236, 170))
        if kind == 'small':  # floating crystal plant on a small marble base
            a = shard_crown(30, 42, seed, STARLIGHT, C(0, 0, 0), C(0, 0, 0), center=(0.5, 0.58), n=12, trunk=False, halo=(200, 230, 255))
            h, w = a.shape[:2]
            base = np.zeros_like(a)
            base[h - 5:h - 1, w // 2 - 6:w // 2 + 6] = PALETTE['STONE'][4]
            base[h - 5, w // 2 - 6:w // 2 + 6] = PALETTE['STONE'][5]
            return P.over(base, a)
        a = orig_tree(kind, seed)
        return sparkle(a, 6, seed, (255, 244, 190), mask=(a[..., 3] > 200) & (a[..., 0] > 200))

    def bush(kind, seed):
        a = orig_bush(kind, seed)
        if kind == 'flowers': a = scatter(a, 12, seed, [C(255, 250, 230), C(250, 220, 140)], mask=a[..., 3] > 200)
        if kind == 'mushrooms':
            a = scatter(a, 30, seed, [C(160, 210, 255), C(220, 240, 255)], mask=a[..., 3] > 200)
        return a

    N.tree, N.bush = tree, bush
    T.sky = sky
    # cloud banks instead of mountains
    T.mountains = lambda W, h=90, seed=3: ridges(W, h, [(34, 44, (226, 230, 248), (255, 255, 255), None, None, 1.2, 0),
                                                        (56, 30, (196, 206, 236), (236, 240, 252), None, None, 1.2, 0)], seed)
    T.forest_far = lambda W, h=64, seed=5: far_trees(W, h, [(170, 176, 214), (190, 196, 228), (210, 214, 240)], [(236, 238, 252), (244, 246, 255), (252, 252, 255)], 'round', seed)
    T.mist_band = lambda W, h=40: mist(W, h, (250, 250, 255), 150)
    T.fore_branch = lambda seed=2, flip=False: fore_branch(GOLD_LEAF, (150, 150, 170, 255), C(60, 56, 80), seed, flip)
    T.fore_grass = lambda seed=4, w=90, h=26: fore_grass([C(60, 96, 84), C(110, 150, 110), C(210, 226, 160)], seed, w, h)
    F.cloud = lambda seed, w=70, h=22: cloud(seed, [C(170, 176, 210), C(200, 206, 232), C(226, 230, 246), C(244, 246, 252), C(255, 255, 255)], w, h, 225)
    F.floating_rock = lambda seed, w=40, h=34: floating_rock(seed, PALETTE['GRASS'][2:], PALETTE['STONE'][1:5], C(60, 60, 96),
                                                             [C(214, 170, 70), C(244, 212, 120), C(255, 240, 190)], w, h)
    F.fireflies_sheet = lambda frames=8, w=160, h=90, n=10, seed=8: motes_sheet((255, 240, 180), (250, 210, 120), frames, w, h, n + 2, seed, rise=10)


def post(slot, category, arr, frames):
    seed = slot_seed(slot)
    if slot == 'terrain.ground':
        a = grade(arr, (0.98, 1.0, 1.08), 0.35, (0, 60))  # warm browns of the shared code → soft marble / cloud tones
        return scatter(a, 700, 3, [C(255, 244, 190), C(255, 255, 255)], mask=a[..., 3] > 200)
    if category in ('terrain', 'road'):
        return grade(arr, (0.98, 1.0, 1.08), 0.35, (0, 60))
    if frames > 1 or category not in ('building', 'prop', 'rock', 'ruin') or any(k in slot for k in ('light', 'glow', 'runes', 'crystal', 'magic.', 'shadow')):
        return arr
    a = grade(arr, (1.02, 1.0, 1.06), 0.45, (0, 60))
    # gilded top edges
    return cap(a, GILD, 1, seed, prob=0.8 if category == 'building' else 0.5)


def extra(emit, L):
    emit('weather.motesFar', 'fx', 'motes_far', weather_tile(160, 160, 30, 61, dot([C(255, 240, 180), C(255, 255, 230)], 1, (140, 230))), anchor='top-left')
    emit('weather.feathers', 'fx', 'feathers', weather_tile(220, 220, 8, 63, petal([C(255, 255, 255), C(236, 240, 252)])), anchor='top-left')
