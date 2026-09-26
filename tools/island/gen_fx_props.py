"""Animated FX sheets (smoke, fire, sparks, lantern, particles, water) and town / magic props."""
from __future__ import annotations

import math

import numpy as np
from PIL import Image, ImageDraw

from gen_build_kit import blank, bricks, fill, finish, mask_ellipse, mask_poly, mask_rect, planks
from pixart import (C, CLOTH_RED, CYAN, DIRT, EMERALD, FIRE, GOLD, METAL, MOSS, OUT, STONE, STONE_WARM, VIOLET, WATER, WOOD, fbm, glow,
                    outline, over, pad, ramp_map, shade_spheres, strip)


def D(a):
    return ImageDraw.Draw(im := Image.fromarray(a)), im


# ------------------------------------------------------------------ FX

def smoke_sheet(frames=8, w=26, h=56, seed=2, tint=(120, 116, 128)):
    """rising, expanding, dissipating puffs — seamless loop (each puff cycles once per loop)"""
    rng = np.random.default_rng(seed)
    puffs = [(i / 5, rng.random() * 2 - 1) for i in range(5)]
    out = []
    for f in range(frames):
        a = blank(w, h)
        sph = []
        alpha = []
        for (p, sway) in puffs:
            t = (p + f / frames) % 1
            y = h - 6 - t * (h - 12)
            x = w / 2 + sway * t * 5 + math.sin(t * 5 + p * 7) * 1.5
            r = 2.5 + t * 7
            sph.append((x, y, r, r * 0.85)); alpha.append(1 - t)
        for (s, al) in zip(sph, alpha):
            if al <= 0.05: continue
            ramp = [C(*[int(c * k) for c in tint]) for k in (0.45, 0.62, 0.8, 1.0)]
            blob = shade_spheres(w, h, [s], ramp, seed=seed, texture=.1, dither=.5)
            blob[..., 3] = np.where(blob[..., 3] > 0, int(200 * al), 0)
            a = over(a, blob)
        out.append(a)
    return strip(out)


def fire_sheet(frames=6, w=14, h=16, seed=1):
    rng = np.random.default_rng(seed)
    out = []
    for f in range(frames):
        a = blank(w, h)
        Y, X = np.mgrid[0:h, 0:w].astype(np.float32)
        n = fbm(w, h, 2, seed + f * 13, 2)
        shape = (np.abs(X - w / 2 + math.sin(f * 1.7) * 0.8) / (w / 2)) + (1 - Y / h) * 1.05 + (n - .5) * .5
        v = np.clip(1.2 - shape, 0, 0.999)
        m = v > 0.18
        rgb = ramp_map(np.clip(v * 1.1, 0, .999), FIRE, .5)
        a[m] = rgb[m]
        out.append(a)
    return strip(out)


def sparks_sheet(frames=6, w=20, h=18, seed=4):
    """short burst: a few bright pixels flying up and out, then gone"""
    rng = np.random.default_rng(seed)
    sp = [(rng.random() * 2 - 1, rng.random() * 0.8 + 0.6) for _ in range(7)]
    out = []
    for f in range(frames):
        a = blank(w, h)
        t = f / (frames - 1)
        for (vx, vy) in sp:
            x = int(w / 2 + vx * t * 9); y = int(h - 3 - vy * t * 13 + t * t * 6)
            if 0 <= x < w and 0 <= y < h and t < 0.95:
                a[y, x] = FIRE[4] if t < .5 else FIRE[3]
                if t < .4 and y + 1 < h: a[y + 1, x] = FIRE[2]
        out.append(a)
    return strip(out)


def lantern_sheet(frames=4):
    """small warm flame in a lantern cage + pixel halo (flicker)"""
    out = []
    for f in range(frames):
        a = glow(18, 20, 9, 11, 9 - (f % 2), (255, 200, 110), 0.55 + 0.15 * (f % 3 == 0), 1.2)
        a[8:14, 7:11] = (*METAL[1][:3], 255)
        a[9:13, 8:10] = FIRE[3] if f % 2 else FIRE[4]
        a[10 - (f == 2), 8] = FIRE[4]
        a[7, 8:10] = METAL[2]; a[14, 7:11] = METAL[2]
        out.append(a)
    return strip(out)


def window_flicker_sheet(frames=6):
    """a 1-px warm glow mask whose alpha wavers — rendered over window-light layers"""
    out = []
    for f in range(frames):
        k = [1, .92, .98, .85, 1, .95][f % 6]
        a = blank(4, 4); a[...] = (255, 214, 140, int(255 * k))
        out.append(a)
    return strip(out)


def particle_sheet(ramp, frames=8, w=40, h=64, n=8, seed=3):
    rng = np.random.default_rng(seed)
    motes = [(rng.random() * (w - 4) + 2, rng.random(), rng.random() * 0.6 + 0.5) for _ in range(n)]
    out = []
    for f in range(frames):
        a = blank(w, h)
        for (x, p, s) in motes:
            y = (1 - ((p + f / frames) % 1)) * (h - 3)
            xx = int(x + math.sin((p + f / frames) * math.tau) * 2); yy = int(y)
            fade = 1 - abs(y / h - 0.5) * 1.6
            if fade <= 0: continue
            a[yy, xx] = (*ramp[4 if fade > .6 else 3][:3], int(255 * min(1, fade + .2)))
            if fade > .5: a[yy + 1, xx] = (*ramp[2][:3], 150)
        out.append(a)
    return strip(out)


def fireflies_sheet(frames=8, w=160, h=90, n=10, seed=8):
    rng = np.random.default_rng(seed)
    flies = [(rng.random() * w, rng.random() * h, rng.random(), rng.random() * 3 + 2) for _ in range(n)]
    out = []
    for f in range(frames):
        a = blank(w, h)
        t = f / frames
        for (x, y, ph, amp) in flies:
            on = (math.sin((t + ph) * math.tau) + 1) / 2
            if on < 0.3: continue
            xx = int(x + math.sin((t + ph) * math.tau) * amp) % w; yy = int(y + math.cos((t + ph) * math.tau) * amp * .6) % h
            a[yy, xx] = (240, 240, 150, int(255 * on))
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if 0 <= xx + dx < w and 0 <= yy + dy < h: a[yy + dy, xx + dx] = (200, 220, 110, int(90 * on))
        out.append(a)
    return strip(out)


def water_sheet(w, h, mask, frames=4, seed=5):
    """animated water for a mask (stream): drifting highlight streaks"""
    out = []
    for f in range(frames):
        n = fbm(w, h, 3, seed, 2)
        Y, X = np.mgrid[0:h, 0:w].astype(np.float32)
        streak = (np.sin((Y * 0.55 - X * 0.2) + f / frames * math.tau) + 1) / 2
        v = np.clip(n * 0.55 + streak * 0.25, 0, .999)
        a = ramp_map(v, WATER[1:5], .7)
        hi = (streak > 0.93) & (n > 0.5)
        a[hi] = WATER[5]
        a[..., 3] = np.where(mask, 255, 0)
        out.append(a)
    return strip(out)


def cloud(seed, w=70, h=22):
    rng = np.random.default_rng(seed)
    sph = [(w * (0.2 + 0.6 * i / 4) + rng.random() * 4, h * 0.6 - rng.random() * 5, 6 + rng.random() * 7, 5 + rng.random() * 3) for i in range(5)]
    ramp = [C(52, 46, 78), C(76, 66, 104), C(108, 94, 130), C(146, 124, 150), C(186, 156, 164)]
    a = shade_spheres(w, h, sph, ramp, light=(-0.2, -1), seed=seed, texture=.08, flat=.2, dither=.6)
    a[..., 3] = np.where(a[..., 3] > 0, 200, 0)
    return a


def floating_rock(seed, w=40, h=34):
    """a small floating island chunk (distant, magical)"""
    a = blank(w, h)
    top = shade_spheres(w, h, [(w / 2, 9, w / 2 - 2, 6)], [C(24, 42, 36), C(36, 62, 46), C(52, 84, 56), C(76, 110, 66)], seed=seed, texture=.2, flat=.3)
    body = mask_poly(w, h, [(3, 9), (w - 3, 9), (w * 0.62, h - 2), (w * 0.45, h - 6)])
    rock = ramp_map(np.clip(np.linspace(.8, .1, h)[:, None].repeat(w, 1) + (fbm(w, h, 2, seed) - .5) * .4, 0, .99), [C(30, 26, 40), C(46, 40, 58), C(66, 58, 80), C(90, 80, 104)])
    a[body] = rock[body]
    a = over(a, top)
    return outline(pad(a, 1), C(14, 12, 24))


# ------------------------------------------------------------------ props

def barrel():
    a = shade_spheres(12, 14, [(6, 7, 5.5, 6.5)], WOOD, seed=2, texture=.12, flat=.3)
    a[3, :][a[3, :, 3] > 0] = METAL[1]; a[10, :][a[10, :, 3] > 0] = METAL[1]
    a[0:2, 2:10] = WOOD[4]
    return outline(pad(a, 1))


def crate(s=10):
    a = blank(s, s)
    a[...] = WOOD[3]; a[0, :] = WOOD[4]; a[:, 0] = WOOD[4]; a[-1, :] = WOOD[1]; a[:, -1] = WOOD[1]
    for k in range(s): a[k, k] = WOOD[2]
    return outline(pad(a, 1))


def lantern_post():
    a = blank(10, 34)
    d, im = D(a)
    d.line([(4, 33), (4, 6)], fill=METAL[1], width=2); d.line([(4, 6), (8, 6)], fill=METAL[1])
    d.rectangle([2, 32, 7, 33], fill=STONE[2])
    d.rectangle([6, 7, 9, 13], fill=METAL[1])
    return outline(pad(np.array(im), 1))


def signpost():
    a = blank(22, 26)
    d, im = D(a)
    d.line([(10, 25), (10, 4)], fill=WOOD[2], width=2)
    d.polygon([(2, 6), (18, 5), (21, 8), (18, 11), (2, 11)], fill=WOOD[3]); d.line([(4, 8), (15, 8)], fill=WOOD[1])
    d.polygon([(19, 14), (4, 13), (1, 16), (4, 19), (19, 19)], fill=WOOD[3]); d.line([(7, 16), (17, 16)], fill=WOOD[1])
    return outline(pad(np.array(im), 1))


def bench():
    a = blank(24, 10)
    d, im = D(a)
    d.rectangle([1, 3, 22, 5], fill=WOOD[3]); d.line([(1, 3), (22, 3)], fill=WOOD[4])
    for x in (3, 19): d.line([(x, 6), (x, 9)], fill=WOOD[1], width=2)
    return outline(pad(np.array(im), 1))


def table():
    a = blank(22, 14)
    d, im = D(a)
    d.rectangle([1, 5, 20, 7], fill=WOOD[3]); d.line([(1, 5), (20, 5)], fill=WOOD[4])
    for x in (3, 17): d.line([(x, 8), (x, 13)], fill=WOOD[1], width=2)
    d.rectangle([5, 2, 7, 4], fill=C(200, 170, 110)); d.rectangle([13, 2, 15, 4], fill=METAL[3]); d.point((10, 4), fill=CLOTH_RED[2])
    return outline(pad(np.array(im), 1))


def cart():
    a = blank(34, 20)
    d, im = D(a)
    d.polygon([(4, 6), (28, 6), (26, 13), (6, 13)], fill=WOOD[3]); d.line([(4, 6), (28, 6)], fill=WOOD[4])
    for x in range(8, 26, 5): d.line([(x, 7), (x, 12)], fill=WOOD[2])
    d.line([(28, 10), (33, 14)], fill=WOOD[2], width=2)
    d.ellipse([7, 11, 15, 19], fill=WOOD[1]); d.ellipse([9, 13, 13, 17], fill=WOOD[3]); d.point((11, 15), fill=METAL[3])
    d.polygon([(8, 6), (12, 1), (18, 2), (22, 6)], fill=C(150, 120, 80))  # sacks
    return outline(pad(np.array(im), 1))


def firewood():
    a = blank(20, 12)
    d, im = D(a)
    for i, (x, y) in enumerate([(2, 8), (7, 8), (12, 8), (4, 4), (9, 4), (7, 0)]):
        d.ellipse([x, y, x + 5, y + 4], fill=WOOD[2]); d.ellipse([x + 1, y + 1, x + 3, y + 3], fill=WOOD[4])
    return outline(pad(np.array(im), 1))


def fountain():
    """old plaza fountain: stone basin + weathered statue (water surface animates separately)"""
    w, h = 46, 44
    a = blank(w, h)
    fill(a, mask_ellipse(w, h, 23, 36, 21, 7), bricks(w, h, STONE_WARM, 3, bw=(3, 5), bh=2, base=2.4))
    fill(a, mask_ellipse(w, h, 23, 34, 17, 5), (18, 36, 56, 255))
    fill(a, mask_rect(w, h, 20, 12, 26, 34), bricks(w, h, STONE_WARM, 4, bw=(3, 3), bh=3, x0=20, x1=26, base=2.6))
    d, im = D(a)
    d.ellipse([18, 8, 28, 14], fill=STONE_WARM[3])
    d.polygon([(21, 8), (22, 1), (24, 0), (25, 8)], fill=STONE_WARM[3]); d.ellipse([21, -1, 25, 3], fill=STONE_WARM[4])
    a = np.array(im)
    m = (fbm(w, h, 2, 6) > .64) & (a[..., 3] > 0)
    a[m] = MOSS[1]
    return finish(a)


def fountain_water(frames=4):
    w, h = 36, 12
    m = mask_ellipse(w, h, 18, 6, 16, 4.5)
    sheet = water_sheet(w, h, m, frames, seed=11)
    # falling water stream from the statue lip
    return sheet


def campfire_base():
    a = blank(20, 10)
    d, im = D(a)
    for i, x in enumerate(range(2, 18, 3)):
        d.ellipse([x, 5, x + 3, 8], fill=STONE[2 + (i % 2)])
    d.line([(5, 7), (15, 4)], fill=WOOD[1], width=2); d.line([(5, 4), (15, 7)], fill=WOOD[2], width=2)
    return outline(pad(np.array(im), 1))


def bridge():
    """small wooden bridge seen from slightly above (spans the stream)"""
    w, h = 56, 30
    a = blank(w, h)
    deck = mask_poly(w, h, [(2, 14), (54, 8), (54, 20), (2, 26)])
    a[deck] = planks(w, h, WOOD, 5, pw=3, vertical=True, base=2.9)[deck]
    d, im = D(a)
    d.line([(2, 14), (54, 8)], fill=WOOD[4]); d.line([(2, 26), (54, 20)], fill=WOOD[1])
    for x in (4, 18, 34, 50):
        y = int(14 - x * 6 / 52)
        d.line([(x, y), (x, y - 7)], fill=WOOD[2], width=2)
        d.line([(x, y + 12), (x, y + 5)], fill=WOOD[1], width=2)
    d.line([(4, 7), (50, 1)], fill=WOOD[3]); d.line([(4, 19), (50, 13)], fill=WOOD[2])
    return outline(pad(np.array(im), 1))


def stone_stairs():
    w, h = 24, 26
    a = blank(w, h)
    for i in range(6):
        y = 2 + i * 4
        a[y:y + 3, 1:23] = STONE_WARM[4 - (i % 2)]
        a[y + 3, 1:23] = STONE_WARM[1]
    return outline(pad(a, 1))


def mushroom_glow():
    a = blank(14, 10)
    for (x, y, r) in [(3, 6, 2), (8, 5, 3), (12, 7, 1)]:
        a[y:9, x] = C(200, 220, 210)
        for dx in range(-r, r + 1): a[y - 1, x + dx] = CYAN[3]
        for dx in range(-r + 1, r): a[y - 2, x + dx] = CYAN[4]
    return outline(pad(a, 1))


def rune_stone_glow():
    """magic prop: standing stone with glowing rune (glow is baked light pixels)"""
    a = blank(14, 24)
    d, im = D(a)
    d.polygon([(2, 23), (2, 8), (5, 2), (9, 1), (12, 6), (12, 23)], fill=STONE[2])
    a = np.array(im)
    m = a[..., 3] > 0
    sh = ramp_map(np.clip(np.linspace(.9, .15, 14)[None, :].repeat(24, 0) + (fbm(14, 24, 2, 3) - .5) * .3, 0, .99), STONE)
    a[m] = sh[m]
    for (x, y) in [(7, 7), (6, 8), (8, 8), (7, 9), (7, 12), (6, 13), (8, 13), (7, 15)]:
        a[y, x] = VIOLET[3]
    return outline(pad(a, 1))
