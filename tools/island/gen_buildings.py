"""Island buildings (base sprites per stage + light / window layers) and ruins for locked plots."""
from __future__ import annotations

import math

import numpy as np
from PIL import Image, ImageDraw

from gen_build_kit import blank, bricks, fill, finish, mask_ellipse, mask_poly, mask_rect, moss_on, planks, shingles, window
from gen_nature import rock, shadow
from pixart import (C, CLOTH_BLUE, CLOTH_RED, CYAN, DIRT, FIRE, GOLD, METAL, MOSS, OUT, PLASTER, ROOF_RED, ROOF_SLATE, STONE,
                    STONE_WARM, VIOLET, WOOD, fbm, glow, outline, over, pad, ramp_map, shade_spheres, strip)

WARM = C(250, 200, 110)
WARM_HI = C(255, 236, 170)


def D(a):
    return ImageDraw.Draw(im := Image.fromarray(a)), im


# ------------------------------------------------------------------ generic ruins (stage 0 of most plots)

def ruin_foundation(w, h, seed, charred=True, ramp=STONE_WARM):
    """broken foundation: low wall stubs, rubble, fallen / charred beams, weeds"""
    rng = np.random.default_rng(seed)
    a = blank(w, h)
    # footprint slab
    fill(a, mask_poly(w, h, [(4, h - 8), (10, h - 13), (w - 10, h - 13), (w - 4, h - 8), (w - 6, h - 2), (6, h - 2)]),
         bricks(w, h, ramp, seed, bw=(4, 7), bh=3, base=2.0))
    # wall stubs of uneven height
    x = 6
    while x < w - 10:
        sw = int(rng.integers(5, 12)); sh = int(rng.integers(3, 16)) if rng.random() < .7 else 0
        if sh:
            fill(a, mask_rect(w, h, x, h - 12 - sh, x + sw, h - 10), bricks(w, h, ramp, seed + x, bw=(3, 5), bh=3, base=2.3))
            # jagged top
            for k in range(sw):
                cut = int(abs(math.sin((x + k) * 1.9 + seed)) * 3)
                a[h - 12 - sh:h - 12 - sh + cut, x + k] = 0
        x += sw + int(rng.integers(2, 9))
    d, im = D(a)
    if charred:
        for _ in range(2):
            x0 = int(rng.integers(8, w - 24)); y0 = h - 6 - int(rng.integers(0, 5))
            d.line([(x0, y0), (x0 + int(rng.integers(12, 22)), y0 - int(rng.integers(3, 10)))], fill=WOOD[0], width=2)
    a = np.array(im)
    for _ in range(3):
        r = rock('small', int(rng.integers(0, 99)))
        a = over(a, r, int(rng.integers(0, w - r.shape[1])), h - r.shape[0])
    a = moss_on(a, seed, amount=0.55)
    return finish(a)


# ------------------------------------------------------------------ tavern / hero hall

TAVERN_W, TAVERN_H = 96, 78


def tavern(stage: int) -> np.ndarray:
    """1 = tavern, 2 = hero hall"""
    w, h = TAVERN_W, TAVERN_H
    a = blank(w, h)
    hall = stage >= 2
    roof = ROOF_SLATE if hall else ROOF_RED
    # right side face (depth) — planks in shadow
    fill(a, mask_poly(w, h, [(74, 68), (74, 30), (86, 24), (86, 64)]), planks(w, h, WOOD, 4, pw=2, base=1.6))
    # foundation
    fill(a, mask_rect(w, h, 8, 66, 76, 77), bricks(w, h, STONE_WARM, 5, bw=(4, 7), bh=3, x0=8, x1=76, base=2.2))
    fill(a, mask_poly(w, h, [(76, 77), (76, 66), (88, 60), (88, 71)]), bricks(w, h, STONE_WARM, 6, bw=(3, 5), bh=3, base=1.4))
    # ground floor plaster
    fill(a, mask_rect(w, h, 11, 44, 74, 66), ramp_map(np.clip(fbm(w, h, 3, 2) * .5 + .45 - np.linspace(0, .3, w)[None, :], 0, .99), PLASTER))
    # upper floor (jettied)
    fill(a, mask_rect(w, h, 8, 28, 77, 44), ramp_map(np.clip(fbm(w, h, 3, 3) * .5 + .5 - np.linspace(0, .3, w)[None, :], 0, .99), PLASTER))
    d, im = D(a)
    beam = WOOD[1]; beam_l = WOOD[2]
    # timber frame
    for x in (11, 30, 55, 73):
        d.line([(x, 44), (x, 66)], fill=beam, width=2)
    for x in (8, 26, 42, 60, 76):
        d.line([(x, 28), (x, 44)], fill=beam, width=2)
    d.line([(8, 44), (77, 44)], fill=beam_l, width=2); d.line([(11, 65), (74, 65)], fill=beam, width=1)
    for (x0, x1) in [(8, 26), (60, 76)]:
        d.line([(x0 + 1, 43), (x1 - 1, 29)], fill=beam, width=1)
    # overhang shadow
    d.line([(11, 46), (74, 46)], fill=PLASTER[0])
    # roof (side-gable band) + ridge
    a = np.array(im)
    rpts = [(2, 30), (12, 8), (80, 8), (90, 30)]
    fill(a, mask_poly(w, h, rpts), shingles(w, h, roof, 7, sw=4, sh=2))
    fill(a, mask_poly(w, h, [(80, 8), (90, 30), (90, 26), (84, 10)]), roof[1])
    d, im = D(a)
    d.line([(12, 8), (80, 8)], fill=roof[4 if hall else 3], width=1)
    d.line([(2, 30), (90, 30)], fill=roof[0], width=1)
    # dormer
    d.polygon([(40, 22), (46, 13), (52, 22)], fill=roof[2]); d.rectangle([42, 19, 50, 26], fill=PLASTER[2])
    d.rectangle([44, 20, 48, 25], fill=WARM)
    # chimney (stone) — top centre = FX anchor
    a = np.array(im)
    fill(a, mask_rect(w, h, 66, 0, 74, 16), bricks(w, h, STONE_WARM, 9, bw=(3, 4), bh=3, x0=66, x1=74, base=2.6))
    a[0:2, 65:76] = STONE_WARM[3]
    if hall:  # second chimney + gold trim + banners on the gable
        fill(a, mask_rect(w, h, 16, 3, 22, 14), bricks(w, h, STONE_WARM, 19, bw=(3, 4), bh=3, base=2.6))
        a[8, 12:80] = GOLD[3]; a[30, 2:90] = GOLD[2]
    # windows (dark here; the light layer makes them glow)
    for (x, y, ww, hh) in [(17, 50, 8, 8), (59, 50, 8, 8), (14, 33, 6, 6), (32, 33, 6, 6), (64, 33, 6, 6)]:
        a = window(a, x, y, ww, hh, WOOD[1], dark_col=(46, 30, 26, 255))
    # door
    d, im = D(a)
    d.rectangle([37, 49, 48, 66], fill=WOOD[1]); d.ellipse([37, 46, 48, 54], fill=WOOD[1])
    d.rectangle([39, 51, 46, 66], fill=WOOD[3]); d.ellipse([39, 48, 46, 55], fill=WOOD[3])
    d.line([(42, 50), (42, 66)], fill=WOOD[2]); d.point((45, 59), fill=GOLD[3])
    # lantern bracket (the flame is an FX layer)
    d.line([(31, 50), (34, 50)], fill=METAL[1]); d.rectangle([30, 51, 32, 55], fill=METAL[1])
    # hanging sign
    d.line([(4, 40), (10, 40)], fill=WOOD[1]); d.rectangle([2, 42, 11, 49], fill=WOOD[3]); d.rectangle([3, 43, 10, 48], fill=WOOD[2])
    d.point((5, 45), fill=GOLD[3]); d.point((8, 45), fill=GOLD[3]); d.line([(5, 46), (8, 46)], fill=GOLD[2])
    a = np.array(im)
    a = moss_on(a, 3, amount=0.72)
    return finish(a)


def tavern_lights(stage: int) -> np.ndarray:
    a = blank(TAVERN_W, TAVERN_H)
    for (x, y, ww, hh) in [(17, 50, 8, 8), (59, 50, 8, 8), (14, 33, 6, 6), (32, 33, 6, 6), (64, 33, 6, 6), (44, 20, 5, 6)]:
        a = window(a, x, y, ww, hh, WOOD[1], lit_col=WARM)
    a[51:66, 39:47] = (*WARM[:3], 120)  # door crack light
    halo = glow(TAVERN_W, TAVERN_H, 42, 70, 26, WARM, 0.35, 1.4)
    return pad(over(halo, a), 1)


# ------------------------------------------------------------------ equipment workshop / forge

SHOP_W, SHOP_H = 100, 84


def workshop(stage: int) -> np.ndarray:
    """1 small workshop · 2 forge · 3 magical forge"""
    w, h = SHOP_W, SHOP_H
    a = blank(w, h)
    big = stage >= 2
    roof = ROOF_SLATE if big else [C(58, 44, 30), C(88, 66, 40), C(118, 92, 54), C(150, 120, 70), C(180, 150, 92)]  # thatch
    # side face
    fill(a, mask_poly(w, h, [(78, 76), (78, 40), (90, 34), (90, 70)]), bricks(w, h, STONE_WARM, 4, bw=(3, 5), bh=3, base=1.3))
    # stone ground floor
    fill(a, mask_rect(w, h, 10, 48, 78, 79), bricks(w, h, STONE_WARM, 5, bw=(5, 8), bh=4, x0=10, x1=78, base=2.3))
    # timber upper
    fill(a, mask_rect(w, h, 12, 34, 76, 48), planks(w, h, WOOD, 6, pw=3, base=2.8, x0=12, x1=76))
    d, im = D(a)
    d.line([(12, 48), (76, 48)], fill=WOOD[1], width=2)
    a = np.array(im)
    # roof
    fill(a, mask_poly(w, h, [(4, 36), (14, 16), (82, 16), (92, 36)]), shingles(w, h, roof, 11, sw=5 if not big else 4, sh=2))
    fill(a, mask_poly(w, h, [(82, 16), (92, 36), (92, 32), (86, 18)]), roof[1])
    a[16, 14:82] = roof[3]; a[36, 4:92] = roof[0]
    # chimney (top centre at (71, 1)) — taller for the forge
    top = 1
    fill(a, mask_rect(w, h, 66, top, 76, 30), bricks(w, h, STONE, 13, bw=(3, 4), bh=3, x0=66, x1=76, base=2.2))
    a[top:top + 2, 65:78] = STONE[3]
    # forge opening (arched) — fire is an FX layer
    d, im = D(a)
    d.rectangle([20, 58, 40, 79], fill=STONE[1]); d.ellipse([20, 51, 40, 66], fill=STONE[1])
    d.rectangle([23, 60, 37, 79], fill=(26, 12, 10, 255)); d.ellipse([23, 54, 37, 66], fill=(26, 12, 10, 255))
    d.rectangle([24, 72, 36, 79], fill=(60, 22, 14, 255))  # coals bed
    # door
    d.rectangle([52, 58, 62, 79], fill=WOOD[1]); d.rectangle([53, 60, 61, 79], fill=WOOD[3]); d.line([(57, 60), (57, 79)], fill=WOOD[2])
    a = np.array(im)
    a = window(a, 50, 38, 8, 7, WOOD[1], dark_col=(40, 26, 22, 255))
    # props outside
    d, im = D(a)
    # anvil
    d.rectangle([42, 76, 48, 79], fill=METAL[1]); d.polygon([(39, 72), (51, 72), (49, 75), (41, 75)], fill=METAL[2]); d.line([(40, 72), (50, 72)], fill=METAL[4])
    # quench barrel
    d.rectangle([4, 70, 12, 79], fill=WOOD[2]); d.line([(4, 73), (12, 73)], fill=METAL[1]); d.line([(4, 77), (12, 77)], fill=METAL[1]); d.rectangle([5, 70, 11, 71], fill=C(40, 70, 90))
    a = np.array(im)
    if big:
        # crates + ore pile + weapon rack
        for (x, y, s) in [(82, 70, 9), (90, 72, 7), (86, 62, 8)]:
            cr = crate(s)
            a = over(a, cr, x, y - 1 + (9 - s))
        ore = shade_spheres(16, 8, [(4, 5, 4, 3), (9, 4, 4, 3), (13, 6, 3, 2)], STONE, seed=4, texture=.25)
        ore[(ore[..., 3] > 0) & (fbm(16, 8, 1.5, 9) > .7)] = C(200, 150, 80)
        a = over(a, ore, 64, 74)
    if stage >= 3:  # arcane runes on the chimney + crystal
        for y in range(8, 28, 4):
            a[y, 70:72] = VIOLET[3]
        a[34:36, 30:34] = VIOLET[3]
    a = moss_on(a, 8, amount=0.74)
    return finish(a)


def workshop_lights(stage: int) -> np.ndarray:
    a = blank(SHOP_W, SHOP_H)
    a = window(a, 50, 38, 8, 7, WOOD[1], lit_col=WARM)
    halo = glow(SHOP_W, SHOP_H, 30, 70, 30, FIRE[2], 0.5, 1.3)
    a = over(halo, a)
    a[54:79, 23:38] = np.where(a[54:79, 23:38, 3:4] > 0, a[54:79, 23:38], a[54:79, 23:38])
    return pad(a, 1)


def crate(s=9):
    a = blank(s, s)
    a[...] = WOOD[3]
    a[0, :] = WOOD[4]; a[:, 0] = WOOD[4]; a[-1, :] = WOOD[1]; a[:, -1] = WOOD[1]
    for k in range(s): a[k, k] = WOOD[2]
    return outline(pad(a, 1))


# ------------------------------------------------------------------ skill shrine (arcane, cyan)

SKILL_W, SKILL_H = 70, 100


def skill_shrine(stage: int) -> np.ndarray:
    w, h = SKILL_W, SKILL_H
    a = blank(w, h)
    # round dais
    fill(a, mask_ellipse(w, h, 35, 92, 30, 7), bricks(w, h, STONE, 3, bw=(3, 6), bh=2, base=2.0))
    fill(a, mask_ellipse(w, h, 35, 89, 26, 5), bricks(w, h, STONE, 4, bw=(3, 6), bh=2, base=2.8))
    # back arch pavilion (stage 2)
    if stage >= 2:
        for x in (8, 58):
            fill(a, mask_rect(w, h, x, 52, x + 5, 88), bricks(w, h, STONE, 7 + x, bw=(3, 4), bh=3, x0=x, x1=x + 5, base=2.6))
        d, im = D(a)
        d.arc([6, 34, 64, 74], 180, 360, fill=STONE[3], width=4); d.arc([7, 35, 63, 73], 190, 350, fill=STONE[4], width=1)
        a = np.array(im)
    # obelisk (tapered) with carved rune grooves
    top = 30 if stage >= 1 else 50
    ob = mask_poly(w, h, [(28, 88), (30, top + 6), (35, top), (40, top + 6), (42, 88)])
    fill(a, ob, bricks(w, h, STONE, 9, bw=(3, 4), bh=4, x0=28, x1=42, base=2.4))
    for y in range(top + 8, 86, 5):
        a[y, 34:36] = STONE[0]; a[y + 2, 35] = STONE[0]
    if stage == 0:  # snapped top + debris
        d, im = D(a); d.polygon([(44, 88), (50, 80), (56, 84), (52, 89)], fill=STONE[3]); a = np.array(im)
    # lectern with open book (right)
    d, im = D(a)
    d.line([(52, 76), (52, 88)], fill=WOOD[2], width=2); d.polygon([(47, 74), (57, 72), (57, 75), (47, 77)], fill=WOOD[3])
    if stage >= 1:
        d.polygon([(47, 72), (52, 70), (52, 73), (47, 75)], fill=C(226, 216, 190)); d.polygon([(52, 70), (57, 69), (57, 72), (52, 73)], fill=C(206, 196, 170))
    a = np.array(im)
    a = moss_on(a, 5, amount=0.66 if stage else 0.5)
    return finish(a)


def skill_runes(stage: int) -> np.ndarray:
    a = blank(SKILL_W, SKILL_H)
    top = 30 if stage >= 1 else 50
    for y in range(top + 8, 86, 5):
        a[y, 34:36] = CYAN[3]; a[y + 2, 35] = CYAN[4]
    # ground rune ring
    Y, X = np.mgrid[0:SKILL_H, 0:SKILL_W].astype(np.float32)
    d = np.sqrt(((X - 35) / 24) ** 2 + ((Y - 89) / 4.2) ** 2)
    ring = (np.abs(d - 1) < 0.09) & (((X.astype(int) // 3) % 2) == 0)
    a[ring] = CYAN[2]
    a = over(glow(SKILL_W, SKILL_H, 35, 60, 26, CYAN[2], 0.35, 1.6), a)
    return pad(a, 1)


# ------------------------------------------------------------------ ascension shrine (violet / gold, spiritual)

ASC_W, ASC_H = 78, 74


def ascension_shrine(stage: int) -> np.ndarray:
    w, h = ASC_W, ASC_H
    a = blank(w, h)
    # stepped altar
    for i, (x0, x1, y0, y1) in enumerate([(14, 64, 66, 73), (20, 58, 60, 66), (27, 51, 54, 60)]):
        fill(a, mask_rect(w, h, x0, y0, x1, y1), bricks(w, h, STONE_WARM, 3 + i, bw=(4, 7), bh=3, x0=x0, x1=x1, base=2.2 + i * .3))
        a[y0, x0:x1 + 1] = STONE_WARM[4]
    # altar top basin
    d, im = D(a)
    d.rectangle([31, 48, 47, 54], fill=STONE_WARM[3]); d.rectangle([33, 46, 45, 48], fill=GOLD[2] if stage >= 1 else STONE_WARM[2])
    a = np.array(im)
    # asymmetric broken pillars
    for (x, top, cut) in [(4, 8 if stage >= 2 else 14, True), (66, 30, True)]:
        fill(a, mask_rect(w, h, x, top, x + 7, 73), bricks(w, h, STONE_WARM, 20 + x, bw=(3, 4), bh=3, x0=x, x1=x + 7, base=2.5))
        for k in range(8):
            c = int(abs(math.sin((x + k) * 2.3)) * 5)
            a[top:top + c, x + k] = 0
        a[73, x - 1:x + 9] = STONE_WARM[1]
    if stage >= 2:  # restored lintel fragment with gold inlay
        a[14:17, 4:24] = STONE_WARM[3]; a[15, 6:22] = GOLD[3]
    a = moss_on(a, 11, amount=0.6 if stage else 0.45)
    return finish(a)


def ascension_rune_circle(frames=8) -> np.ndarray:
    """ground rune circle (rotates: dashes shift each frame)"""
    w, h = 70, 20
    Y, X = np.mgrid[0:h, 0:w].astype(np.float32)
    out = []
    for f in range(frames):
        a = blank(w, h)
        ang = np.arctan2((Y - h / 2) * 3.2, X - w / 2)
        d = np.sqrt(((X - w / 2) / 33) ** 2 + ((Y - h / 2) / 9) ** 2)
        seg = ((ang / math.tau * 24 + f * 3 / frames) % 2) < 1.1
        a[(np.abs(d - 1) < 0.07) & seg] = VIOLET[3]
        a[(np.abs(d - 0.72) < 0.08)] = (*GOLD[2][:3], 200)
        out.append(a)
    return strip(out)


# ------------------------------------------------------------------ endgame memorial · challenge board · expedition dock

def memorial(stage: int) -> np.ndarray:
    w, h = 48, 64
    a = blank(w, h)
    fill(a, mask_poly(w, h, [(4, 63), (8, 56), (40, 56), (44, 63)]), bricks(w, h, STONE, 2, bw=(4, 6), bh=3, base=2.0))
    if stage == 0:
        a = moss_on(a, 2, amount=0.5)
        d, im = D(a); d.line([(12, 58), (20, 61), (26, 57)], fill=STONE[0]); a = np.array(im)
        return finish(a)
    fill(a, mask_rect(w, h, 14, 48, 34, 56), bricks(w, h, STONE, 3, bw=(4, 6), bh=3, x0=14, x1=34, base=2.6))
    fill(a, mask_poly(w, h, [(18, 48), (20, 14), (24, 8), (28, 14), (30, 48)]), bricks(w, h, STONE, 5, bw=(3, 4), bh=4, x0=18, x1=30, base=2.8))
    d, im = D(a)
    # embedded sword (gold hilt)
    d.line([(24, 20), (24, 44)], fill=METAL[4]); d.line([(20, 22), (28, 22)], fill=GOLD[3]); d.point((24, 18), fill=GOLD[4])
    # wreath
    d.arc([15, 40, 33, 54], 200, 340, fill=MOSS[2], width=2)
    a = np.array(im)
    a[48, 14:35] = GOLD[2]
    return finish(a)


def challenge_board(stage: int) -> np.ndarray:
    w, h = 44, 44
    a = blank(w, h)
    d, im = D(a)
    if stage == 0:
        d.line([(10, 43), (12, 24)], fill=WOOD[2], width=2); d.line([(30, 43), (30, 34)], fill=WOOD[2], width=2)
        d.polygon([(6, 30), (26, 22), (28, 27), (8, 35)], fill=WOOD[3])
        a = np.array(im); return finish(a)
    for x in (8, 34):
        d.line([(x, 43), (x, 12)], fill=WOOD[1], width=3)
    d.rectangle([5, 14, 38, 34], fill=WOOD[2]); d.rectangle([7, 16, 36, 32], fill=WOOD[3])
    d.polygon([(3, 14), (21, 6), (40, 14)], fill=ROOF_RED[2]); d.line([(3, 14), (40, 14)], fill=ROOF_RED[0])
    for (x, y, c) in [(9, 18, C(224, 214, 186)), (18, 17, C(210, 200, 170)), (27, 19, C(230, 220, 196)), (12, 25, C(214, 204, 178)), (25, 26, C(226, 208, 170))]:
        d.rectangle([x, y, x + 6, y + 5], fill=c); d.line([(x + 1, y + 2), (x + 4, y + 2)], fill=C(120, 100, 90)); d.point((x + 3, y), fill=CLOTH_RED[2])
    a = np.array(im)
    return finish(a)


def dock(stage: int) -> np.ndarray:
    """broken airship moored at a pier over the island edge (inactive in Patch 1)"""
    w, h = 118, 66
    a = blank(w, h)
    d, im = D(a)
    # pier posts + deck (extends right over the edge)
    for x in (12, 34, 58, 82):
        d.line([(x, 65), (x, 50)], fill=WOOD[1], width=3)
    a = np.array(im)
    fill(a, mask_poly(w, h, [(4, 52), (96, 48), (98, 53), (6, 57)]), planks(w, h, WOOD, 3, pw=3, vertical=True, base=2.8))
    d, im = D(a)
    # hull (tilted, cracked)
    hull = [(52, 30), (110, 24), (104, 40), (86, 46), (60, 44)]
    d.polygon(hull, fill=WOOD[2]); d.line([(52, 30), (110, 24)], fill=WOOD[4]); d.line([(60, 36), (106, 31)], fill=WOOD[1])
    for x in range(60, 104, 8): d.line([(x, 31), (x + 1, 44)], fill=WOOD[1])
    if stage == 0:
        d.polygon([(76, 44), (82, 36), (86, 46)], fill=(16, 12, 18, 255))  # hole
    else:
        d.rectangle([74, 36, 84, 42], fill=WOOD[4]); d.line([(74, 39), (84, 39)], fill=WOOD[2])  # patch
    # mast + deflated envelope
    d.line([(80, 26), (74, 4)], fill=WOOD[1], width=2)
    env = [(60, 22), (70, 8), (96, 6), (112, 14), (104, 22), (84, 26)] if stage else [(58, 26), (66, 16), (90, 14), (108, 22), (96, 28), (74, 28)]
    d.polygon(env, fill=C(120, 104, 86)); d.line(env[:3], fill=C(170, 150, 120))
    for x in range(66, 106, 9): d.line([(x, 12 + (x % 5)), (x + 3, 26)], fill=C(92, 78, 66))
    # ropes
    d.line([(58, 49), (70, 30)], fill=C(150, 130, 100)); d.line([(34, 50), (60, 32)], fill=C(150, 130, 100))
    if stage >= 1:  # scaffolding
        for x in (54, 100):
            d.line([(x, 48), (x, 16)], fill=WOOD[3], width=1)
        d.line([(54, 18), (100, 16)], fill=WOOD[3]); d.line([(54, 32), (100, 30)], fill=WOOD[3])
    a = np.array(im)
    a = moss_on(a, 6, amount=0.7)
    return finish(a)


# ------------------------------------------------------------------ training ground props

def dummy():
    w, h = 14, 26
    a = blank(w, h)
    d, im = D(a)
    d.line([(7, 25), (7, 6)], fill=WOOD[2], width=2)
    d.line([(1, 11), (13, 11)], fill=WOOD[2], width=2)
    d.ellipse([3, 12, 11, 22], fill=C(170, 140, 90)); d.ellipse([4, 2, 10, 8], fill=C(170, 140, 90))
    d.line([(3, 16), (11, 16)], fill=C(110, 80, 50)); d.point((6, 5), fill=OUT); d.point((8, 5), fill=OUT)
    a = np.array(im); a[12:22, 3:6][a[12:22, 3:6, 3] > 0] = C(196, 168, 110)
    return finish(a)


def archery_target():
    w, h = 18, 24
    a = blank(w, h)
    d, im = D(a)
    d.line([(4, 23), (7, 12)], fill=WOOD[1], width=2); d.line([(14, 23), (11, 12)], fill=WOOD[1], width=2)
    for r, c in [(8, C(200, 190, 160)), (6, CLOTH_RED[2]), (4, C(220, 210, 180)), (2, CLOTH_RED[3])]:
        d.ellipse([9 - r, 10 - r, 9 + r, 10 + r], fill=c)
    d.line([(11, 8), (16, 3)], fill=WOOD[3]); d.point((16, 3), fill=C(220, 220, 220))
    return finish(np.array(im))


def weapon_rack():
    w, h = 22, 20
    a = blank(w, h)
    d, im = D(a)
    d.line([(2, 19), (2, 4)], fill=WOOD[2], width=2); d.line([(19, 19), (19, 4)], fill=WOOD[2], width=2)
    d.line([(1, 6), (21, 6)], fill=WOOD[3], width=2); d.line([(1, 15), (21, 15)], fill=WOOD[1])
    for x, c in [(6, METAL[3]), (10, METAL[4]), (14, METAL[3]), (17, WOOD[3])]:
        d.line([(x, 17), (x, 1)], fill=c); d.point((x, 1), fill=METAL[4])
    return finish(np.array(im))


def fence(n=3, broken=False, seed=1):
    rng = np.random.default_rng(seed)
    w, h = n * 8 + 2, 13
    a = blank(w, h)
    d, im = D(a)
    for i in range(n + 1):
        x = i * 8 + 1; top = 1 + (int(rng.integers(3, 8)) if broken and rng.random() < .5 else 0)
        d.line([(x, 12), (x, top)], fill=WOOD[2], width=2)
    if not broken:
        d.line([(1, 4), (w - 2, 4)], fill=WOOD[3]); d.line([(1, 8), (w - 2, 8)], fill=WOOD[3])
    else:
        d.line([(1, 7), (w // 2, 9)], fill=WOOD[3])
    return finish(np.array(im))


def practice_mat():
    w, h = 64, 20
    Y, X = np.mgrid[0:h, 0:w].astype(np.float32)
    m = ((X - w / 2) / (w / 2 - 1)) ** 2 + ((Y - h / 2) / (h / 2 - 1)) ** 2 <= 1
    a = ramp_map(np.clip(fbm(w, h, 2.5, 3) * .6 + .3, 0, .99), DIRT, 0.8)
    a[..., 3] = np.where(m, 255, 0)
    ring = np.abs(np.sqrt(((X - w / 2) / (w / 2 - 6)) ** 2 + ((Y - h / 2) / (h / 2 - 3)) ** 2) - 1) < 0.08
    a[ring & m] = C(200, 186, 150)
    return a


def banner_sheet(cloth=CLOTH_RED, frames=6, emblem=GOLD):
    """flag on a pole (cloth waves)"""
    w, h = 16, 34
    out = []
    for f in range(frames):
        a = blank(w, h)
        a[0:34, 1:3] = WOOD[2]; a[0, 0:4] = GOLD[3]
        for y in range(3, 22):
            wave = math.sin(f / frames * math.tau + y * 0.35) * 1.4
            length = 11 + wave
            for x in range(3, int(3 + length)):
                shade = 1 + (1 if (x + int(wave)) % 5 < 3 else 0)
                a[y, x] = cloth[min(3, shade + (y < 6))]
            a[y, int(3 + length)] = cloth[0]
        for (x, y) in [(7, 9), (8, 10), (6, 10), (7, 11), (7, 13)]:
            a[y, x + int(math.sin(f / frames * math.tau + y * .35) * .7)] = emblem[3]
        out.append(outline(pad(a, 1)))
    return strip(out)
