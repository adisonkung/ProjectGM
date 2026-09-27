"""
FROZEN KINGDOM — cosmetic Island theme.

    python3 tools/island/generate.py frozen_kingdom

An ancient magical kingdom asleep under snow and blue ice: snow-capped pines and roofs, glacial stream, cold blue
forge fire, rime instead of moss, aurora night sky over icy peaks, drifting snow.

Same drawing code and the SAME semantic slots as Default Forest (generate.py), so every building keeps its size,
anchor, footprint and FX anchors. What this module changes:
  PALETTE  — swapped into pixart before the generators import it (grass → snow, leaves → frost pine, moss → rime,
             fire → blue flame, water → glacial ice, roofs → royal blue, banners → blue / silver …)
  patch()  — replaces individual generators (snow pines, frostglass tree, winter bushes, aurora sky, icy peaks, sled …)
  post()   — per-asset pass: snow caps on top surfaces, icicles under eaves, cold colour grade for stray warm pixels
  extra()  — theme-only slots (snowfall weather tiles, blue forge crystal)
Nothing here touches the layout, plots, navigation, unlocks or save data.
"""
from __future__ import annotations

import math

import numpy as np
from PIL import Image, ImageDraw

PREFIX = 'frozen'
NAME = 'Frozen Kingdom'

C = lambda *rgb: (*rgb, 255)  # noqa: E731

# ------------------------------------------------------------------ palette (cold night, snow + blue ice)

SNOW = [C(52, 64, 96), C(84, 102, 138), C(128, 148, 182), C(170, 188, 216), C(206, 220, 238), C(232, 240, 250)]
PINE = [C(10, 22, 34), C(16, 36, 50), C(24, 54, 66), C(38, 76, 84), C(60, 102, 108), C(96, 136, 142)]
FROST_LEAF = [C(24, 32, 52), C(40, 54, 80), C(64, 84, 114), C(98, 120, 150), C(140, 160, 186), C(190, 204, 222)]
ICE = [C(26, 52, 92), C(42, 88, 136), C(72, 134, 180), C(116, 182, 216), C(170, 222, 240), C(226, 248, 255)]
BARK = [C(22, 20, 30), C(38, 34, 46), C(58, 52, 64), C(82, 76, 88), C(112, 106, 118)]
WOOD = [C(28, 26, 38), C(48, 44, 58), C(72, 64, 78), C(100, 90, 102), C(132, 122, 130), C(166, 158, 164)]
STONE = [C(22, 26, 42), C(38, 46, 68), C(58, 70, 96), C(86, 100, 126), C(122, 136, 160), C(166, 180, 204)]
STONE_WARM = [C(28, 32, 48), C(48, 54, 74), C(76, 84, 106), C(106, 116, 140), C(142, 152, 176), C(182, 192, 214)]
RIME = [C(92, 114, 144), C(134, 156, 184), C(180, 198, 220), C(222, 234, 246)]
PATH = [C(34, 40, 60), C(56, 64, 88), C(84, 94, 120), C(114, 124, 150), C(146, 156, 182), C(176, 186, 210)]
ROOF_BLUE = [C(16, 22, 50), C(26, 36, 80), C(38, 54, 112), C(56, 78, 146), C(82, 106, 176)]
ROOF_SLATE = [C(16, 18, 34), C(28, 32, 56), C(44, 50, 80), C(64, 72, 106), C(90, 100, 134)]
PLASTER = [C(60, 70, 96), C(92, 104, 132), C(128, 142, 168), C(166, 180, 204), C(202, 214, 230)]
METAL = [C(28, 32, 46), C(52, 60, 78), C(86, 98, 118), C(130, 144, 164), C(186, 200, 218)]
WATER = [C(22, 48, 82), C(36, 80, 122), C(62, 124, 168), C(104, 172, 208), C(160, 214, 236), C(222, 246, 255)]
FIRE = [C(18, 36, 110), C(34, 84, 196), C(70, 150, 236), C(150, 214, 255), C(232, 248, 255)]
GLACIAL = [C(10, 40, 62), C(20, 80, 112), C(40, 142, 182), C(110, 212, 242), C(214, 250, 255)]
BANNER_BLUE = [C(20, 26, 62), C(32, 44, 100), C(50, 70, 146), C(82, 110, 190)]
BANNER_SILVER = [C(74, 84, 114), C(120, 132, 162), C(170, 182, 206), C(220, 228, 242)]
OUTLINE = C(12, 14, 28)

PALETTE = {
    'OUT': OUTLINE,
    'GRASS': SNOW, 'LEAF': PINE, 'LEAF_WARM': FROST_LEAF, 'BLOSSOM': ICE,
    'BARK': BARK, 'WOOD': WOOD, 'STONE': STONE, 'STONE_WARM': STONE_WARM, 'MOSS': RIME, 'DIRT': PATH,
    'ROOF_RED': ROOF_BLUE, 'ROOF_SLATE': ROOF_SLATE, 'PLASTER': PLASTER, 'METAL': METAL,
    'WATER': WATER, 'FIRE': FIRE, 'EMERALD': GLACIAL,
    'CLOTH_RED': BANNER_BLUE, 'CLOTH_BLUE': BANNER_SILVER,
    # GOLD / CYAN / VIOLET stay: tower states + shrines keep their identity (ascended = gold, corrupted = violet)
}

# snow on top surfaces (lit from the upper left)
SNOWCAP = [C(118, 138, 176), C(166, 184, 214), C(208, 222, 240), C(240, 246, 252)]
ICICLE = [C(120, 176, 214), C(176, 222, 244), C(232, 250, 255)]


# ------------------------------------------------------------------ helpers

def _px():
    import pixart
    return pixart


def _frames(arr: np.ndarray, n: int):
    w = arr.shape[1] // n
    return [arr[:, i * w:(i + 1) * w] for i in range(n)], w


def snowcap(a: np.ndarray, depth: int = 2, seed: int = 0, lip: float = 0.0) -> np.ndarray:
    """paint snow onto the top-facing surface of every opaque column run (silhouette tops + ledges)"""
    a = a.copy()
    h, w = a.shape[:2]
    op = a[..., 3] > 200
    above = np.zeros_like(op); above[1:] = op[:-1]
    top = op & ~above  # first opaque pixel of a run (open sky above it)
    rng = np.random.default_rng(seed)
    ys, xs = np.where(top)
    for y, x in zip(ys, xs):
        d = depth + (1 if rng.random() < 0.35 else 0) - (1 if rng.random() < 0.15 else 0)
        # left-lit: brighter on the left half of each run
        lit = 3 if (x > 0 and not op[y, x - 1]) or (x + 1 < w and op[y, x + 1] and not op[max(0, y - 1), x + 1]) else 2
        for k in range(max(1, d)):
            yy = y + k
            if yy >= h or not op[yy, x]: break
            a[yy, x] = SNOWCAP[max(0, lit - k)]
    if lip:  # a thin overhang of snow one pixel above flat tops
        flat = top & np.roll(top, 1, 1) & np.roll(top, -1, 1)
        ys, xs = np.where(flat)
        for y, x in zip(ys, xs):
            if y > 0 and rng.random() < lip and a[y - 1, x, 3] == 0: a[y - 1, x] = SNOWCAP[2]
    return a


def icicles(a: np.ndarray, seed: int = 0, max_len: int = 5, every: int = 3, below_frac: float = 0.82) -> np.ndarray:
    """hang icicles under overhangs (opaque pixel with ≥ 4 transparent pixels below it), above the ground band"""
    a = a.copy()
    h, w = a.shape[:2]
    op = a[..., 3] > 200
    rng = np.random.default_rng(seed)
    for x in range(1, w - 1):
        if (x + seed) % every: continue
        for y in range(2, int(h * below_frac)):
            if op[y, x] and not op[y + 1: y + 5, x].any() and y + 5 < h:
                n = int(rng.integers(2, max_len + 1))
                for k in range(1, n + 1):
                    if y + k >= h: break
                    a[y + k, x] = ICICLE[min(2, k // 2)] if k < n else ICICLE[2]
                if rng.random() < 0.4 and not op[y + 1, x + 1]: a[y + 1, x + 1] = ICICLE[0]
                break
    return a


def _rgb_to_hsv(rgb):
    r, g, b = [rgb[..., i] / 255.0 for i in range(3)]
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b)
    d = mx - mn
    h = np.zeros_like(mx)
    m = d > 1e-6
    rm = m & (mx == r); gm = m & (mx == g) & ~rm; bm = m & ~rm & ~gm
    h[rm] = ((g - b)[rm] / d[rm]) % 6
    h[gm] = (b - r)[gm] / d[gm] + 2
    h[bm] = (r - g)[bm] / d[bm] + 4
    h = h * 60
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    return h, s, mx


def cool_grade(a: np.ndarray, amount: float = 0.7) -> np.ndarray:
    """pull stray warm / green pixels (hard-coded colours in the shared generators) toward the cold palette.
    Emissive pixels (bright + saturated: windows, lantern glass, fire) are left alone."""
    a = a.copy()
    rgb = a[..., :3].astype(np.float32)
    h, s, v = _rgb_to_hsv(rgb)
    warm = (a[..., 3] > 0) & (s > 0.12) & ((h < 165) | (h > 330)) & ~((v > 0.82) & (s > 0.35))
    lum = rgb @ np.array([0.3, 0.55, 0.15], np.float32)
    cold = np.stack([lum * 0.82, lum * 0.92, np.minimum(255, lum * 1.18 + 10)], -1)
    k = amount
    rgb[warm] = rgb[warm] * (1 - k) + cold[warm] * k
    a[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    return a


def sparkle(a: np.ndarray, n: int, seed: int, mask=None) -> np.ndarray:
    a = a.copy()
    rng = np.random.default_rng(seed)
    h, w = a.shape[:2]
    m = a[..., 3] > 200 if mask is None else mask
    ys, xs = np.where(m)
    if not len(xs): return a
    for i in rng.choice(len(xs), min(n, len(xs)), replace=False):
        a[ys[i], xs[i], :3] = (244, 250, 255)
    return a


# ------------------------------------------------------------------ nature

def pine(w: int, h: int, seed: int, tiers: int = 5, trunk_frac: float = 0.13, width: float = 1.0) -> np.ndarray:
    """tiered snow pine: dark frost-green tiers with drooping serrated tips, snow on every tier's shoulders"""
    P = _px()
    rng = np.random.default_rng(seed)
    a = np.zeros((h, w, 4), np.uint8)
    Y, X = np.mgrid[0:h, 0:w].astype(np.float32)
    cx = w / 2 - 0.5
    ground = h - 2
    crown_bottom = ground - h * trunk_frac
    crown_top = 1.0
    H = crown_bottom - crown_top
    # trunk
    tw = max(2.0, w * 0.075)
    tm = (Y >= crown_bottom - 6) & (Y <= ground) & (np.abs(X - cx) <= tw / 2 + (Y - crown_bottom) * 0.04)
    tv = np.clip(0.8 - (X - (cx - tw / 2)) / (tw + 1) * 0.6 + (P.fbm(w, h, 1.5, seed, 2) - .5) * .3, 0, .999)
    a[tm] = P.ramp_map(tv, BARK)[tm]
    tier_id = np.full((h, w), -1, np.int16)
    val = np.zeros((h, w), np.float32)
    noise = P.fbm(w, h, 2.2, seed + 3, 2)
    for i in range(tiers):
        f0, f1 = i / tiers, (i + 1) / tiers
        bot = crown_bottom - H * f0 * 0.9
        top = crown_bottom - H * f1 - H * 0.16 if i < tiers - 1 else crown_top
        half = (w / 2 - 1.5) * width * (1 - f0 * 0.72)
        frac = (Y - top) / max(1.0, bot - top)
        dx = np.abs(X - cx)
        jag = ((X.astype(int) + i * 2 + seed) % 3 == 0) * 1.0 + (noise - .5) * 2.2
        droop = 2.2 * (dx / max(1.0, half)) ** 2
        serr = ((X.astype(int) + i) % 4 < 2) * 1.2
        m = (frac >= 0) & (dx <= half * np.clip(frac, 0, 1) ** 0.95 + jag) & (Y <= bot + droop - serr)
        tier_id[m] = i
        # left-lit, darker toward the underside and the right
        v = 0.62 - (X - cx) / max(1.0, half) * 0.24 - np.clip(frac, 0, 1) * 0.22 + (noise - .5) * .28
        val[m] = v[m]
    crown = tier_id >= 0
    a[crown] = P.ramp_map(np.clip(val, 0, .999), PINE, .6)[crown]
    a[crown, 3] = 255
    # snow: top 2–3 px of every tier's own surface (only where that tier is the visible one)
    for i in range(tiers):
        mi = tier_id == i
        up = np.zeros_like(mi); up[1:] = mi[:-1]
        surf = mi & ~up
        depth = 2 + (i == tiers - 1)
        for k in range(depth):
            s = np.zeros_like(surf); s[k:] = surf[:h - k] if k else surf
            s &= mi
            if k == depth - 1: s &= (P.bayer(w, h) + noise * .6) > -0.1
            shade = np.where(X < cx, 3 - k, 2 - k)
            for lv in range(4):
                sel = s & (np.clip(shade, 0, 3) == lv)
                a[sel] = SNOWCAP[lv]
    a = sparkle(a, 3 + w // 20, seed, mask=(a[..., 3] > 0) & (a[..., 2] > 230))
    a = P.outline(P.pad(a), OUTLINE)
    return a


def frostglass_tree(seed: int, w: int = 60, h: int = 72) -> np.ndarray:
    """theme-special plant: a pale birch-like trunk crowned with glowing ice-crystal shards"""
    P = _px()
    rng = np.random.default_rng(seed)
    a = np.zeros((h, w, 4), np.uint8)
    im = Image.fromarray(a); d = ImageDraw.Draw(im)
    cx = w // 2
    d.polygon([(cx - 2, h - 2), (cx - 1, h * 0.42), (cx + 1, h * 0.42), (cx + 2, h - 2)], fill=PLASTER[3])
    d.line([(cx + 1, h - 3), (cx + 1, int(h * 0.5))], fill=PLASTER[1])
    for y in range(int(h * 0.5), h - 4, 5): d.line([(cx - 2, y), (cx, y)], fill=BARK[1])
    for (x0, y0, x1, y1) in [(cx, h * 0.55, cx - 14, h * 0.38), (cx, h * 0.6, cx + 15, h * 0.42), (cx, h * 0.48, cx - 6, h * 0.3), (cx, h * 0.5, cx + 7, h * 0.28)]:
        d.line([(x0, y0), (x1, y1)], fill=PLASTER[2], width=2)
    a = np.array(im)
    # crystal shards radiating from the crown
    shards = []
    ccx, ccy = cx, h * 0.3
    for i in range(24):
        ang = -math.pi / 2 + (i / 23 - 0.5) * 3.4 + (rng.random() - .5) * 0.25
        r0 = 2 + rng.random() * 5
        ln = 8 + rng.random() * 9 - abs(ang + math.pi / 2) * 2.2
        bx, by = ccx + math.cos(ang) * r0, ccy + math.sin(ang) * r0 * 0.7 + 6
        shards.append((bx, by, ang, max(5.0, ln), 2.0 + rng.random() * 1.6))
    # a solid ice core behind the shards
    core = P.shade_spheres(w, h, [(ccx, ccy + 5, 12, 9)], ICE, seed=seed, texture=.1, flat=.2)
    a = P.over(a, core)
    shards.sort(key=lambda s: s[1])
    for (bx, by, ang, ln, hw) in shards:
        tx, ty = bx + math.cos(ang) * ln, by + math.sin(ang) * ln
        nx, ny = -math.sin(ang) * hw, math.cos(ang) * hw
        s_im = Image.fromarray(np.zeros((h, w, 4), np.uint8)); sd = ImageDraw.Draw(s_im)
        sd.polygon([(bx + nx, by + ny), (tx, ty), (bx - nx, by - ny)], fill=ICE[3])
        sd.polygon([(bx + nx, by + ny), (tx, ty), (bx, by)], fill=ICE[4] if nx < 0 or ny < 0 else ICE[2])
        sd.line([(bx, by), (tx, ty)], fill=ICE[5])
        a = P.over(a, np.array(s_im))
    a = P.outline(P.pad(a), C(18, 36, 72))
    halo = P.glow(a.shape[1], a.shape[0], a.shape[1] / 2, a.shape[0] * 0.34, 24, (150, 220, 255), 0.35, 1.5)
    return P.over(halo, a)


def dead_frozen(orig_tree, seed):
    a = orig_tree('dead', seed)
    a = snowcap(a, 2, seed)
    return icicles(a, seed, 3, 4, 0.7)


def winter_reeds(seed, w=18, h=20):
    rng = np.random.default_rng(seed)
    a = np.zeros((h, w, 4), np.uint8)
    cols = [C(120, 118, 128), C(156, 150, 150), C(190, 186, 184), C(226, 230, 238)]
    for i in range(11):
        x = 2 + i * 1.4 + rng.random(); hh = rng.integers(9, 19); bend = rng.random() * 3 - 1.5
        for s in range(int(hh)):
            t = s / hh
            xx, yy = int(x + bend * t * t), h - 1 - s
            a[yy, min(w - 1, xx)] = cols[min(3, int(t * 4))]
    return a


def frost_flowers(seed, w=20, h=10):
    rng = np.random.default_rng(seed)
    a = np.zeros((h, w, 4), np.uint8)
    cols = [C(200, 230, 255), C(160, 190, 250), C(214, 196, 250), C(240, 246, 255)]
    for i in range(8):
        x, y = int(rng.integers(2, 18)), int(rng.integers(4, 9))
        a[y:h, x] = PINE[3]
        c = cols[int(rng.integers(0, 4))]
        a[y - 1, x] = C(255, 255, 255)
        for dx, dy in ((-1, 0), (1, 0), (0, -2)):
            a[y - 1 + dy, x + dx] = c
    return a


def ice_sprouts(seed, w=16, h=12):
    a = np.zeros((h, w, 4), np.uint8)
    im = Image.fromarray(a); d = ImageDraw.Draw(im)
    for (x, top, hw) in [(4, 4, 2), (9, 1, 2), (13, 6, 1)]:
        d.polygon([(x - hw, h - 1), (x, top), (x + hw, h - 1)], fill=ICE[3])
        d.line([(x, top + 1), (x, h - 2)], fill=ICE[5])
        d.point((x - hw, h - 1), fill=ICE[1])
    return np.array(im)


# ------------------------------------------------------------------ background

def sky(W, H):
    P = _px()
    Y = np.linspace(0, 1, H)[:, None].repeat(W, 1)
    stops = [(0.0, (6, 10, 28)), (0.2, (12, 22, 52)), (0.34, (22, 44, 82)), (0.42, (40, 72, 110)), (0.48, (32, 58, 96)),
             (0.6, (18, 30, 60)), (1.0, (8, 12, 26))]
    rgb = np.zeros((H, W, 3), np.float32)
    for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
        m = (Y >= t0) & (Y <= t1)
        k = ((Y - t0) / (t1 - t0))[..., None]
        rgb = np.where(m[..., None], np.array(c0) * (1 - k) + np.array(c1) * k, rgb)
    # aurora: sinuous ribbons with vertical curtains, green-cyan → violet
    Yi, Xi = np.mgrid[0:H, 0:W].astype(np.float32)
    n = P.fbm(W, H, 30, 21, 3)
    for (y0, amp, freq, ph, col, strength) in [(0.16, 0.05, 0.0065, 0.3, (90, 230, 190), 0.55), (0.22, 0.04, 0.009, 2.1, (110, 200, 255), 0.45),
                                              (0.12, 0.035, 0.005, 4.0, (170, 130, 255), 0.35)]:
        cy = (y0 + amp * np.sin(Xi * freq + ph) + (n - .5) * 0.05) * H
        dy = Yi - cy
        band = np.exp(-np.clip(dy, 0, None) / (H * 0.07)) * (dy > -3) * np.clip(1 + dy / 3, 0, 1)
        curtain = 0.55 + 0.45 * np.sin(Xi * 0.21 + ph * 3 + n * 6) ** 2
        k = (band * curtain * strength)[..., None]
        rgb = rgb * (1 - k * 0.35) + np.array(col) * k
    q = 9.0
    rgb = np.floor(rgb / q + P.bayer(W, H)[..., None] * 0.9 + 0.5) * q
    a = np.zeros((H, W, 4), np.uint8)
    a[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8); a[..., 3] = 255
    rng = np.random.default_rng(4)
    for _ in range(260):
        x, y = int(rng.integers(0, W)), int(rng.integers(0, int(H * 0.36)))
        v = int(rng.integers(140, 245)); a[y, x, :3] = (v, min(255, v + 8), 255)
        if rng.random() < 0.08:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if 0 <= x + dx < W and 0 <= y + dy < H: a[y + dy, x + dx, :3] = (v // 2 + 40, v // 2 + 60, 200)
    # small cold moon
    mg = P.glow(W, H, W * 0.22, H * 0.08, 18, (200, 226, 255), 0.35, 1.4)
    a = P.over(a, mg)
    moon = (Xi - W * 0.22) ** 2 + (Yi - H * 0.08) ** 2 <= 20
    a[moon, :3] = (232, 242, 255)
    a[moon & ((Xi - W * 0.22 + 1.5) ** 2 + (Yi - H * 0.08 + 1) ** 2 <= 9), :3] = (206, 222, 246)
    return a


def mountains(W, h=90, seed=3):
    P = _px()
    a = np.zeros((h, W, 4), np.uint8)
    for layer, (base, amp, rock, rock_hi, snow, snow_sh) in enumerate([
            (26, 58, (44, 58, 92), (70, 88, 124), (196, 214, 238), (130, 150, 190)),
            (50, 38, (28, 38, 66), (48, 60, 92), (160, 180, 214), (100, 118, 158))]):
        n = P.fbm(W, 1, 36 - layer * 12, seed + layer, 4)[0]
        peaks = np.abs(np.sin(np.arange(W) * (0.024 + layer * 0.014) + seed)) ** 2.4
        top = (base + (1 - n) * amp * 0.55 - peaks * amp * 0.6).astype(int)
        rag = P.fbm(W, 1, 3, seed + 9 + layer, 2)[0]
        for x in range(W):
            t = max(0, top[x])
            a[t:, x, :3] = rock; a[t:, x, 3] = 255
            # left-facing slopes lit
            if x > 0 and top[x - 1] > top[x]: a[t:t + 6, x, :3] = rock_hi
            snow_depth = int(max(0, (base + amp * 0.35 - t)) * 0.55 + 2 + rag[x] * 4)
            slope = top[min(W - 1, x + 2)] - top[max(0, x - 2)]
            col = snow if slope > 0 else snow_sh
            for k in range(snow_depth):
                y = t + k
                if y >= h: break
                a[y, x, :3] = col if k < snow_depth - 1 else tuple((np.array(col) + np.array(rock)) // 2)
    return a


def forest_far(W, h=64, seed=5):
    a = np.zeros((h, W, 4), np.uint8)
    rng = np.random.default_rng(seed)
    cols = [(16, 28, 44), (22, 38, 56), (30, 50, 68)]
    snow = [(112, 132, 166), (140, 160, 192), (170, 190, 218)]
    Yg, Xg = np.ogrid[0:h, 0:W]
    for layer in range(3):
        x = int(rng.integers(0, 6))
        while x < W + 10:
            hh = int(rng.integers(14, 24)) + (2 - layer) * 3 + (10 if rng.random() < 0.06 else 0)
            base = h - 4 - (2 - layer) * 7 - int(rng.integers(0, 6))
            top = base - hh
            half = hh * 0.34
            m = (Yg >= top) & (Yg <= base) & (np.abs(Xg - x) <= (Yg - top) / hh * half + ((Yg - top) % 5 == 4) * 1.2)
            m[base:, max(0, x - 1):x + 2] = True
            a[m, :3] = cols[layer]; a[m, 3] = 255
            tops = m & ~np.roll(m, 1, 0)
            a[tops, :3] = snow[layer]
            a[tops & (Xg < x), :3] = tuple(min(255, c + 30) for c in snow[layer])
            x += int(half * 1.5) + int(rng.integers(1, 4))
    a[h - 6:, :, :3] = np.where(a[h - 6:, :, 3:4] > 0, np.array(cols[2]), a[h - 6:, :, :3])
    return a


def mist_band(W, h=40):
    P = _px()
    a = np.zeros((h, W, 4), np.uint8)
    n = P.fbm(W, h, 16, 4, 3)
    v = np.clip((1 - np.abs(np.linspace(-1, 1, h))[:, None]) * 0.9 * (0.5 + n), 0, 1)
    v = np.floor(v * 6 + P.bayer(W, h) * 0.8) / 6
    a[..., :3] = (176, 200, 236); a[..., 3] = np.clip(v * 100, 0, 255).astype(np.uint8)
    return a


def cloud(seed, w=70, h=22):
    P = _px()
    rng = np.random.default_rng(seed)
    sph = [(w * (0.2 + 0.6 * i / 4) + rng.random() * 4, h * 0.6 - rng.random() * 5, 6 + rng.random() * 7, 5 + rng.random() * 3) for i in range(5)]
    ramp = [C(44, 58, 92), C(70, 88, 124), C(104, 122, 156), C(144, 162, 192), C(186, 200, 224)]
    a = P.shade_spheres(w, h, sph, ramp, light=(-0.2, -1), seed=seed, texture=.08, flat=.2, dither=.6)
    a[..., 3] = np.where(a[..., 3] > 0, 190, 0)
    return a


def floating_rock(seed, w=40, h=34):
    P = _px()
    a = np.zeros((h, w, 4), np.uint8)
    top = P.shade_spheres(w, h, [(w / 2, 9, w / 2 - 2, 6)], [C(130, 150, 186), C(170, 188, 216), C(208, 222, 240), C(236, 244, 252)], seed=seed, texture=.12, flat=.3)
    body_im = Image.new('L', (w, h), 0)
    ImageDraw.Draw(body_im).polygon([(3, 9), (w - 3, 9), (w * 0.62, h - 2), (w * 0.45, h - 6)], fill=255)
    body = np.array(body_im) > 0
    rock = P.ramp_map(np.clip(np.linspace(.8, .1, h)[:, None].repeat(w, 1) + (P.fbm(w, h, 2, seed) - .5) * .4, 0, .99), [C(24, 30, 52), C(38, 48, 76), C(58, 70, 102), C(84, 98, 130)])
    a[body] = rock[body]
    a = P.over(a, top)
    a = icicles(P.pad(a, 1), seed, 4, 3, 0.9)
    return P.outline(a, C(10, 12, 26))


def fore_branch(seed=2, flip=False):
    """snowy pine bough hanging into the top corner of the frame"""
    P = _px()
    import gen_nature as N
    w, h = 120, 60
    a = np.zeros((h, w, 4), np.uint8)
    im = Image.fromarray(a); d = ImageDraw.Draw(im)
    d.line([(0, 6), (40, 14), (80, 10), (118, 22)], fill=(30, 26, 36, 255), width=4)
    a = np.array(im)
    sph = [(20, 18, 16, 9), (46, 24, 18, 11), (74, 20, 15, 9), (100, 30, 14, 9), (60, 34, 10, 7), (30, 30, 12, 7)]
    dark = [C(6, 14, 22), C(10, 22, 32), C(16, 34, 44), C(24, 50, 58), C(38, 70, 78), C(60, 96, 104)]
    a = P.over(a, N.crown(w, h, sph, dark, seed, tex=.3))
    a = snowcap(a, 3, seed)
    a = P.outline(a, C(4, 8, 14))
    return a[:, ::-1] if flip else a


def fore_grass(seed=4, w=90, h=26):
    rng = np.random.default_rng(seed)
    a = np.zeros((h, w, 4), np.uint8)
    for i in range(70):
        x = rng.random() * w; hh = rng.integers(8, h); bend = rng.random() * 5 - 2.5
        for k in range(int(hh)):
            t = k / hh
            xx, yy = int(x + bend * t * t), h - 1 - k
            if 0 <= xx < w: a[yy, xx] = (C(16, 26, 40) if t < .5 else C(40, 58, 80) if t < .85 else C(150, 174, 206))
    return a


# ------------------------------------------------------------------ FX / props

def snow_motes(frames=8, w=160, h=90, n=12, seed=8):
    """replaces fireflies: slow ice glints that twinkle as a small cross"""
    rng = np.random.default_rng(seed)
    motes = [(rng.random() * w, rng.random() * h, rng.random(), rng.random() * 3 + 2) for _ in range(n)]
    out = []
    for f in range(frames):
        a = np.zeros((h, w, 4), np.uint8)
        t = f / frames
        for (x, y, ph, amp) in motes:
            on = (math.sin((t + ph) * math.tau) + 1) / 2
            if on < 0.3: continue
            xx = int(x + math.sin((t + ph) * math.tau) * amp) % w; yy = int(y + t * 6 + math.cos((t + ph) * math.tau) * amp * .4) % h
            a[yy, xx] = (236, 248, 255, int(255 * on))
            if on > 0.75:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    if 0 <= xx + dx < w and 0 <= yy + dy < h: a[yy + dy, xx + dx] = (150, 210, 255, int(120 * on))
        out.append(a)
    return _px().strip(out)


def sled():
    """replaces the cart: a wooden sled with runners, a tied bundle and snow"""
    P = _px()
    a = np.zeros((20, 34, 4), np.uint8)
    im = Image.fromarray(a); d = ImageDraw.Draw(im)
    d.line([(3, 17), (27, 17)], fill=METAL[3], width=1)
    d.arc([22, 9, 32, 19], 270, 90, fill=METAL[3])
    d.line([(6, 13), (6, 17)], fill=WOOD[1]); d.line([(20, 13), (20, 17)], fill=WOOD[1])
    d.polygon([(3, 10), (28, 10), (27, 13), (4, 13)], fill=WOOD[3]); d.line([(3, 10), (28, 10)], fill=WOOD[4])
    d.rectangle([7, 4, 19, 10], fill=BANNER_BLUE[2]); d.line([(7, 4), (19, 4)], fill=BANNER_BLUE[3])
    d.line([(13, 4), (13, 10)], fill=WOOD[1]); d.line([(7, 7), (19, 7)], fill=WOOD[1])
    d.line([(1, 16), (0, 11)], fill=WOOD[2])
    a = snowcap(np.array(im), 1, 7)
    return P.outline(P.pad(a, 1), OUTLINE)


def snowfall_tile(w: int, h: int, n: int, size: int, seed: int, alpha: int) -> np.ndarray:
    """seamless (both axes) snowfall tile — scrolled by CSS for the SNOW weather preset"""
    rng = np.random.default_rng(seed)
    a = np.zeros((h, w, 4), np.uint8)
    for _ in range(n):
        x, y = int(rng.integers(0, w)), int(rng.integers(0, h))
        v = int(rng.integers(210, 256))
        al = int(alpha * (0.6 + 0.4 * rng.random()))
        for dx in range(size):
            for dy in range(size):
                a[(y + dy) % h, (x + dx) % w] = (v, v, 255, al)
        if size > 1 and rng.random() < 0.5:
            a[(y - 1) % h, x % w] = (v, v, 255, al // 3)
    return a


# ------------------------------------------------------------------ generate.py hooks

def patch(m):
    N, T, F, B = m['N'], m['T'], m['F'], m['B']
    P = _px()
    orig_tree, orig_bush, orig_materials, orig_smoke = N.tree, N.bush, T.materials, F.smoke_sheet

    def tree(kind, seed):
        sizes = {'large_a': (80, 104, 6, 1.0), 'large_b': (90, 100, 6, 1.05), 'medium_a': (52, 74, 5, 1.0), 'medium_b': (42, 80, 5, 0.92), 'small': (30, 42, 4, 1.0)}
        if kind in sizes:
            w, h, tiers, wd = sizes[kind]
            return pine(w, h, seed, tiers, width=wd)
        if kind == 'dead': return dead_frozen(orig_tree, seed)
        if kind == 'blossom': return frostglass_tree(seed)
        return orig_tree(kind, seed)

    def bush(kind, seed):
        if kind == 'tall_grass': return P.outline(P.pad(winter_reeds(seed)), OUTLINE)
        if kind == 'flowers': return P.outline(P.pad(frost_flowers(seed)), OUTLINE)
        if kind == 'mushrooms': return P.outline(P.pad(ice_sprouts(seed)), C(16, 36, 70))
        a = orig_bush(kind, seed)
        return snowcap(a, 2, seed) if kind in ('a', 'b') else a

    def materials():
        M = orig_materials()
        # smooth wind-packed snow (grass tufts would read as noise on snow)
        M['grass_a'] = T.grass_tile(11, tufts=False)
        M['grass_b'] = T.grass_tile(12, shift=0.08, tufts=False)
        # "moss grass" variant → wind-polished ice sheet · dark grass → blue-shadowed snow
        M['grass_c'] = T.grass_tile(14, ramp=[C(60, 96, 140), C(84, 132, 176), C(116, 170, 206), C(150, 200, 228), C(190, 228, 244), C(228, 246, 255)], tufts=False)
        return M

    N.tree, N.bush, T.materials = tree, bush, materials
    orig_cc = N.crystal_cluster
    N.crystal_cluster = lambda seed, ramp=None: orig_cc(seed, ICE_CRYSTAL)
    T.sky, T.mountains, T.forest_far, T.mist_band = sky, mountains, forest_far, mist_band
    T.fore_branch, T.fore_grass = fore_branch, fore_grass
    F.cloud, F.floating_rock, F.fireflies_sheet, F.cart = cloud, floating_rock, snow_motes, sled
    F.smoke_sheet = lambda frames=8, w=26, h=56, seed=2, tint=None: orig_smoke(frames, w, h, seed, (200, 218, 240))  # cold vapor


ICE_CRYSTAL = [C(24, 52, 96), C(44, 96, 150), C(80, 150, 204), C(140, 206, 240), C(214, 246, 255)]


NO_SNOW = ('light', 'glow', 'runes', 'crystal', 'magic.')


def post(slot: str, category: str, arr: np.ndarray, frames: int) -> np.ndarray:
    """per-asset pass (same size in → same size out: footprints / anchors never change)"""
    h = arr.shape[0]
    seed = sum(map(ord, slot)) % 97
    if slot == 'terrain.ground':
        a = cool_grade(arr, 0.85)
        g = (a[..., 1] > a[..., 2] + 12) & (a[..., 3] > 0)  # plateau rim + stray greens → snow highlight
        a[g, :3] = SNOWCAP[2][:3]
        return sparkle(a, 900, 11, mask=(a[..., 3] > 0) & (a[..., 2] > 200))
    if slot == 'road.layer':
        # trodden paths: darker, bluer packed snow so roads stay readable against fresh snow
        a = cool_grade(arr, 0.8)
        m = a[..., 3] > 0
        a[m, :3] = np.clip(a[m, :3].astype(np.float32) * np.array([0.74, 0.78, 0.86]), 0, 255).astype(np.uint8)
        return a
    if category in ('terrain', 'road'):
        return cool_grade(arr, 0.8)
    if frames > 1 or category not in ('building', 'prop', 'rock', 'ruin') or any(k in slot for k in NO_SNOW):
        return arr  # FX sheets, lights, overlays, trees / veg (drawn cold already), background
    a = cool_grade(arr, 0.7)
    if 'shadow' in slot: return a
    big = category == 'building' or h > 60
    a = snowcap(a, 3 if big else 2 if h > 18 else 1, seed, lip=0.35 if big else 0)
    if category == 'building':
        a = icicles(a, seed % 13, 5 if big else 3)
    return a


def extra(emit, L):
    import gen_tower as TW
    emit('weather.snowFar', 'fx', 'snow_far', snowfall_tile(160, 160, 70, 1, 31, 190), anchor='top-left')
    emit('weather.snowNear', 'fx', 'snow_near', snowfall_tile(200, 200, 26, 2, 37, 235), anchor='top-left')
    # blue forge crystal floating over the workshop's forge (theme-only slot; Default Forest has none → layer skipped)
    emit('building.forge.crystal', 'building', 'forge_crystal', TW.crystal([C(18, 40, 96), C(36, 84, 180), C(70, 150, 236), C(150, 214, 255), C(236, 250, 255)]), anchor='center')
