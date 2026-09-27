"""
Shared building blocks for cosmetic Island theme modules (tools/island/themes/<id>.py).

Every helper keeps the input size (post passes) or draws a fresh asset (generators) — they never read or change the
layout. `pixart` is imported lazily: a theme module is imported BEFORE its palette is patched into pixart.
"""
from __future__ import annotations

import math

import numpy as np
from PIL import Image, ImageDraw

C = lambda *rgb: (*rgb, 255)  # noqa: E731


def px():
    import pixart
    return pixart


def slot_seed(slot: str, mod: int = 97) -> int:
    return sum(map(ord, slot)) % mod


# ------------------------------------------------------------------ post passes (same size in → same size out)

def cap(a: np.ndarray, ramp4, depth: int = 2, seed: int = 0, lip: float = 0.0, prob: float = 1.0) -> np.ndarray:
    """paint a layer (snow, petals, sand, gold leaf …) onto the top-facing surface of every opaque column run.
    `prob` < 1 makes it patchy (petals / sand dust)."""
    a = a.copy()
    h, w = a.shape[:2]
    op = a[..., 3] > 200
    above = np.zeros_like(op); above[1:] = op[:-1]
    top = op & ~above
    rng = np.random.default_rng(seed)
    ys, xs = np.where(top)
    for y, x in zip(ys, xs):
        if prob < 1 and rng.random() > prob: continue
        d = depth + (1 if rng.random() < 0.35 else 0) - (1 if rng.random() < 0.15 else 0)
        lit = 3 if (x > 0 and not op[y, x - 1]) or (x + 1 < w and op[y, x + 1] and not op[max(0, y - 1), x + 1]) else 2
        for k in range(max(1, d)):
            yy = y + k
            if yy >= h or not op[yy, x]: break
            a[yy, x] = ramp4[max(0, lit - k)]
    if lip:
        flat = top & np.roll(top, 1, 1) & np.roll(top, -1, 1)
        ys, xs = np.where(flat)
        for y, x in zip(ys, xs):
            if y > 0 and rng.random() < lip and a[y - 1, x, 3] == 0: a[y - 1, x] = ramp4[2]
    return a


def drips(a: np.ndarray, ramp3, seed: int = 0, max_len: int = 5, every: int = 3, below_frac: float = 0.82, chance: float = 1.0) -> np.ndarray:
    """hang drips (icicles, slime, vines, light threads) under overhangs above the ground band"""
    a = a.copy()
    h, w = a.shape[:2]
    op = a[..., 3] > 200
    rng = np.random.default_rng(seed)
    for x in range(1, w - 1):
        if (x + seed) % every: continue
        if chance < 1 and rng.random() > chance: continue
        for y in range(2, int(h * below_frac)):
            if op[y, x] and not op[y + 1: y + 5, x].any() and y + 5 < h:
                n = int(rng.integers(2, max_len + 1))
                for k in range(1, n + 1):
                    if y + k >= h: break
                    a[y + k, x] = ramp3[min(2, k // 2)] if k < n else ramp3[2]
                break
    return a


def rgb_to_hsv(rgb):
    r, g, b = [rgb[..., i] / 255.0 for i in range(3)]
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b)
    d = mx - mn
    h = np.zeros_like(mx)
    m = d > 1e-6
    rm = m & (mx == r); gm = m & (mx == g) & ~rm; bm = m & ~rm & ~gm
    h[rm] = ((g - b)[rm] / d[rm]) % 6
    h[gm] = (b - r)[gm] / d[gm] + 2
    h[bm] = (r - g)[bm] / d[bm] + 4
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    return h * 60, s, mx


def grade(a: np.ndarray, tint=(1.0, 1.0, 1.0), amount: float = 0.5, hue_range=(0, 360), min_sat: float = 0.1, lift: float = 0.0) -> np.ndarray:
    """pull non-emissive pixels whose hue is in `hue_range` toward (luminance × tint) — stray hard-coded colours of the
    shared generators follow the theme. Bright + saturated pixels (windows, lanterns, flames) are left alone."""
    a = a.copy()
    rgb = a[..., :3].astype(np.float32)
    h, s, v = rgb_to_hsv(rgb)
    lo, hi = hue_range
    in_hue = (h >= lo) & (h <= hi) if lo <= hi else (h >= lo) | (h <= hi)
    sel = (a[..., 3] > 0) & (s > min_sat) & in_hue & ~((v > 0.82) & (s > 0.35))
    lum = rgb @ np.array([0.3, 0.55, 0.15], np.float32)
    target = np.stack([lum * tint[0], lum * tint[1], lum * tint[2]], -1) + lift
    rgb[sel] = rgb[sel] * (1 - amount) + target[sel] * amount
    a[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    return a


def multiply(a: np.ndarray, mul=(1, 1, 1), add=(0, 0, 0)) -> np.ndarray:
    a = a.copy()
    m = a[..., 3] > 0
    a[m, :3] = np.clip(a[m, :3].astype(np.float32) * np.array(mul) + np.array(add), 0, 255).astype(np.uint8)
    return a


def sparkle(a: np.ndarray, n: int, seed: int, color=(244, 250, 255), mask=None) -> np.ndarray:
    a = a.copy()
    rng = np.random.default_rng(seed)
    m = a[..., 3] > 200 if mask is None else mask
    ys, xs = np.where(m)
    if not len(xs): return a
    for i in rng.choice(len(xs), min(n, len(xs)), replace=False):
        a[ys[i], xs[i], :3] = color
    return a


def scatter(a: np.ndarray, n: int, seed: int, cols, mask=None, size=1) -> np.ndarray:
    """sprinkle small coloured flecks (petals, pebbles, ash) on opaque pixels"""
    a = a.copy()
    rng = np.random.default_rng(seed)
    h, w = a.shape[:2]
    m = a[..., 3] > 200 if mask is None else mask
    ys, xs = np.where(m)
    if not len(xs): return a
    for i in rng.choice(len(xs), min(n, len(xs)), replace=False):
        c = cols[int(rng.integers(0, len(cols)))]
        for dx in range(size):
            if xs[i] + dx < w and m[ys[i], xs[i] + dx]: a[ys[i], xs[i] + dx, :3] = c[:3]
    return a


# ------------------------------------------------------------------ background generators

def sky_gradient(W, H, stops, stars=0, star_top=0.36, seed=4, q=9.0) -> np.ndarray:
    P = px()
    Y = np.linspace(0, 1, H)[:, None].repeat(W, 1)
    rgb = np.zeros((H, W, 3), np.float32)
    for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
        m = (Y >= t0) & (Y <= t1)
        k = ((Y - t0) / max(1e-6, t1 - t0))[..., None]
        rgb = np.where(m[..., None], np.array(c0) * (1 - k) + np.array(c1) * k, rgb)
    rgb = np.floor(rgb / q + P.bayer(W, H)[..., None] * 0.9 + 0.5) * q
    a = np.zeros((H, W, 4), np.uint8)
    a[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8); a[..., 3] = 255
    rng = np.random.default_rng(seed)
    for _ in range(stars):
        x, y = int(rng.integers(0, W)), int(rng.integers(0, int(H * star_top)))
        v = int(rng.integers(140, 245)); a[y, x, :3] = (v, v, min(255, v + 12))
    return a


def disc(a: np.ndarray, cx, cy, r, color, glow_color=None, glow_r=None, glow_s=0.4, shade=None) -> np.ndarray:
    """sun / moon: optional soft glow, flat disc, optional crescent shade"""
    P = px()
    H, W = a.shape[:2]
    if glow_color: a = P.over(a, P.glow(W, H, cx, cy, glow_r or r * 4, glow_color, glow_s, 1.4))
    Yi, Xi = np.mgrid[0:H, 0:W].astype(np.float32)
    m = (Xi - cx) ** 2 + (Yi - cy) ** 2 <= r * r
    a[m, :3] = color
    if shade:
        sc, sdx, sdy = shade
        a[m & ((Xi - cx - sdx) ** 2 + (Yi - cy - sdy) ** 2 <= r * r * 0.7), :3] = sc
    return a


def bands(a: np.ndarray, specs, seed=21) -> np.ndarray:
    """translucent sinuous ribbons (aurora, sun rays, sand haze): [(y0, amp, freq, phase, color, strength, thickness)]"""
    P = px()
    H, W = a.shape[:2]
    Yi, Xi = np.mgrid[0:H, 0:W].astype(np.float32)
    n = P.fbm(W, H, 30, seed, 3)
    rgb = a[..., :3].astype(np.float32)
    for (y0, amp, freq, ph, col, strength, thick) in specs:
        cy = (y0 + amp * np.sin(Xi * freq + ph) + (n - .5) * 0.05) * H
        dy = Yi - cy
        band = np.exp(-np.abs(dy) / (H * thick))
        curtain = 0.6 + 0.4 * np.sin(Xi * 0.13 + ph * 3 + n * 6) ** 2
        k = (band * curtain * strength)[..., None]
        rgb = rgb * (1 - k * 0.35) + np.array(col) * k
    a = a.copy()
    a[..., :3] = np.clip(np.floor(rgb / 6 + P.bayer(W, H)[..., None] * 0.8 + 0.5) * 6, 0, 255).astype(np.uint8)
    return a


def ridges(W, h, layers, seed=3) -> np.ndarray:
    """distant ranges: [(base, amp, body, rim, cap_color|None, cap_shadow|None, sharpness, flat_top)]"""
    P = px()
    a = np.zeros((h, W, 4), np.uint8)
    for li, (base, amp, body, rim, capc, capsh, sharp, flat) in enumerate(layers):
        n = P.fbm(W, 1, 36 - li * 10, seed + li, 4)[0]
        peaks = np.abs(np.sin(np.arange(W) * (0.022 + li * 0.013) + seed + li)) ** sharp
        top = (base + (1 - n) * amp * 0.55 - peaks * amp * 0.6)
        if flat:  # mesas: quantize heights into plateaus with steep sides
            top = np.round(top / flat) * flat
        top = top.astype(int)
        rag = P.fbm(W, 1, 3, seed + 9 + li, 2)[0]
        for x in range(W):
            t = max(0, top[x])
            a[t:, x, :3] = body; a[t:, x, 3] = 255
            if x > 0 and top[x - 1] > top[x]: a[t:t + 5, x, :3] = rim
            a[t, x, :3] = rim
            if capc:
                depth = int(max(0, (base + amp * 0.35 - t)) * 0.55 + 2 + rag[x] * 4)
                slope = top[min(W - 1, x + 2)] - top[max(0, x - 2)]
                col = capc if slope > 0 else capsh
                for k in range(depth):
                    if t + k >= h: break
                    a[t + k, x, :3] = col
    return a


def far_trees(W, h, cols, tip_cols, shape='round', seed=5) -> np.ndarray:
    """distant tree line silhouettes: shape = 'pine' | 'round' | 'palm' | 'dead'"""
    a = np.zeros((h, W, 4), np.uint8)
    rng = np.random.default_rng(seed)
    Yg, Xg = np.ogrid[0:h, 0:W]
    for layer in range(3):
        x = int(rng.integers(0, 6))
        while x < W + 10:
            base = h - 4 - (2 - layer) * 7 - int(rng.integers(0, 6))
            if shape == 'pine':
                hh = int(rng.integers(14, 24)) + (2 - layer) * 3
                half = hh * 0.34
                m = (Yg >= base - hh) & (Yg <= base) & (np.abs(Xg - x) <= (Yg - base + hh) / hh * half)
                step = int(half * 1.5) + 1
            elif shape == 'palm':
                hh = int(rng.integers(16, 26)) + (2 - layer) * 3
                lean = rng.random() * 4 - 2
                trunk = (Yg >= base - hh) & (Yg <= base) & (np.abs(Xg - x - lean * (base - Yg) / hh) <= 1)
                cx, cy = x + lean, base - hh
                fr = np.zeros((h, W), bool)
                for ang in np.linspace(math.pi * 0.95, math.pi * 2.05, 7):
                    for t in np.linspace(0, 1, 12):
                        px_ = int(cx + math.cos(ang) * t * 9); py_ = int(cy + math.sin(ang) * t * 5 + t * t * 5)
                        if 0 <= px_ < W and 0 <= py_ < h: fr[py_, px_] = True; fr[min(h - 1, py_ + 1), px_] = True
                m = trunk | fr
                step = int(rng.integers(12, 26))
            elif shape == 'dead':
                hh = int(rng.integers(12, 22)) + (2 - layer) * 3
                m = (Yg >= base - hh) & (Yg <= base) & (np.abs(Xg - x) <= 1)
                for k in range(3):
                    yb = base - int(hh * (0.45 + k * 0.18)); side = 1 if k % 2 else -1
                    for t in range(6 - k):
                        yy, xx = yb - t, x + side * t
                        if 0 <= yy < h and 0 <= xx < W: m[yy, xx] = True
                step = int(rng.integers(6, 14))
            else:
                r = int(rng.integers(5, 11)) + (3 - layer) * 2
                cy = int(base - 6 - r * 0.6)
                m = ((Xg - x) ** 2) / (r * r) + ((Yg - cy) ** 2) / ((r * 1.1) ** 2) <= 1
                m = m | ((Yg >= cy) & (Yg <= base) & (np.abs(Xg - x) <= 1))
                step = int(r * 1.3)
            a[m, :3] = cols[layer]; a[m, 3] = 255
            tops = m & ~np.roll(m, 1, 0)
            a[tops & (Xg < x), :3] = tip_cols[layer]
            x += step + int(rng.integers(1, 4))
    a[h - 6:, :, :3] = np.where(a[h - 6:, :, 3:4] > 0, np.array(cols[2]), a[h - 6:, :, :3])
    return a


def mist(W, h, color, alpha=100):
    P = px()
    a = np.zeros((h, W, 4), np.uint8)
    n = P.fbm(W, h, 16, 4, 3)
    v = np.clip((1 - np.abs(np.linspace(-1, 1, h))[:, None]) * 0.9 * (0.5 + n), 0, 1)
    v = np.floor(v * 6 + P.bayer(W, h) * 0.8) / 6
    a[..., :3] = color; a[..., 3] = np.clip(v * alpha, 0, 255).astype(np.uint8)
    return a


def cloud(seed, ramp5, w=70, h=22, alpha=190):
    P = px()
    rng = np.random.default_rng(seed)
    sph = [(w * (0.2 + 0.6 * i / 4) + rng.random() * 4, h * 0.6 - rng.random() * 5, 6 + rng.random() * 7, 5 + rng.random() * 3) for i in range(5)]
    a = P.shade_spheres(w, h, sph, ramp5, light=(-0.2, -1), seed=seed, texture=.08, flat=.2, dither=.6)
    a[..., 3] = np.where(a[..., 3] > 0, alpha, 0)
    return a


def floating_rock(seed, top_ramp4, body_ramp4, outline_col, drip_ramp=None, w=40, h=34):
    P = px()
    a = np.zeros((h, w, 4), np.uint8)
    top = P.shade_spheres(w, h, [(w / 2, 9, w / 2 - 2, 6)], top_ramp4, seed=seed, texture=.15, flat=.3)
    im = Image.new('L', (w, h), 0)
    ImageDraw.Draw(im).polygon([(3, 9), (w - 3, 9), (w * 0.62, h - 2), (w * 0.45, h - 6)], fill=255)
    body = np.array(im) > 0
    rock = P.ramp_map(np.clip(np.linspace(.8, .1, h)[:, None].repeat(w, 1) + (P.fbm(w, h, 2, seed) - .5) * .4, 0, .99), body_ramp4)
    a[body] = rock[body]
    a = P.over(a, top)
    a = P.pad(a, 1)
    if drip_ramp: a = drips(a, drip_ramp, seed, 4, 3, 0.9)
    return P.outline(a, outline_col)


def fore_branch(crown_ramp6, branch_col, outline_col, seed=2, flip=False, capr=None, blossom=None):
    P = px()
    import gen_nature as N
    w, h = 120, 60
    a = np.zeros((h, w, 4), np.uint8)
    im = Image.fromarray(a); d = ImageDraw.Draw(im)
    d.line([(0, 6), (40, 14), (80, 10), (118, 22)], fill=branch_col, width=4)
    a = np.array(im)
    sph = [(20, 18, 16, 10), (46, 24, 18, 12), (74, 20, 15, 10), (100, 30, 14, 10), (60, 36, 10, 8), (30, 32, 12, 8)]
    a = P.over(a, N.crown(w, h, sph, crown_ramp6, seed, tex=.28))
    if capr: a = cap(a, capr, 3, seed)
    if blossom: a = scatter(a, 120, seed, blossom, size=2)
    a = P.outline(a, outline_col)
    return a[:, ::-1] if flip else a


def fore_grass(cols3, seed=4, w=90, h=26):
    rng = np.random.default_rng(seed)
    a = np.zeros((h, w, 4), np.uint8)
    for i in range(70):
        x = rng.random() * w; hh = rng.integers(8, h); bend = rng.random() * 5 - 2.5
        for k in range(int(hh)):
            t = k / hh
            xx, yy = int(x + bend * t * t), h - 1 - k
            if 0 <= xx < w: a[yy, xx] = cols3[0] if t < .5 else cols3[1] if t < .85 else cols3[2]
    return a


# ------------------------------------------------------------------ FX sheets / weather tiles

def motes_sheet(color, halo, frames=8, w=160, h=90, n=12, seed=8, rise=0.0, cross=True):
    """ambient motes (replaces fireflies): twinkle, optional slow rise (px per loop)"""
    P = px()
    rng = np.random.default_rng(seed)
    motes = [(rng.random() * w, rng.random() * h, rng.random(), rng.random() * 3 + 2) for _ in range(n)]
    out = []
    for f in range(frames):
        a = np.zeros((h, w, 4), np.uint8)
        t = f / frames
        for (x, y, ph, amp) in motes:
            on = (math.sin((t + ph) * math.tau) + 1) / 2
            if on < 0.3: continue
            xx = int(x + math.sin((t + ph) * math.tau) * amp) % w
            yy = int(y - t * rise + math.cos((t + ph) * math.tau) * amp * .4) % h
            a[yy, xx] = (*color, int(255 * on))
            if cross and on > 0.7:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    if 0 <= xx + dx < w and 0 <= yy + dy < h: a[yy + dy, xx + dx] = (*halo, int(120 * on))
        out.append(a)
    return P.strip(out)


def weather_tile(w: int, h: int, n: int, seed: int, painter) -> np.ndarray:
    """seamless (both axes) tile; painter(a, x, y, rng) draws one particle with wrap-around"""
    rng = np.random.default_rng(seed)
    a = np.zeros((h, w, 4), np.uint8)
    for _ in range(n): painter(a, int(rng.integers(0, w)), int(rng.integers(0, h)), rng)
    return a


def put(a, x, y, c):
    h, w = a.shape[:2]
    a[y % h, x % w] = c


def petal(cols):
    def p(a, x, y, rng):
        c = cols[int(rng.integers(0, len(cols)))]
        al = int(200 + rng.random() * 55)
        put(a, x, y, (*c[:3], al)); put(a, x + 1, y, (*c[:3], al))
        if rng.random() < 0.6: put(a, x + 1, y + 1, (*c[:3], al // 2))
    return p


def dot(cols, size=1, alpha=(150, 255)):
    def p(a, x, y, rng):
        c = cols[int(rng.integers(0, len(cols)))]
        al = int(alpha[0] + rng.random() * (alpha[1] - alpha[0]))
        for dx in range(size):
            for dy in range(size): put(a, x + dx, y + dy, (*c[:3], al))
    return p


def streak(cols, length=4, alpha=(90, 190)):
    """horizontal wind streak (sand)"""
    def p(a, x, y, rng):
        c = cols[int(rng.integers(0, len(cols)))]
        al = int(alpha[0] + rng.random() * (alpha[1] - alpha[0]))
        for k in range(length): put(a, x + k, y, (*c[:3], int(al * (1 - k / (length + 1)))))
    return p


# ------------------------------------------------------------------ plants

def shard_crown(w, h, seed, ramp6, trunk_col, trunk_dark, center=(0.5, 0.3), n=24, core=True, halo=(150, 220, 255), outline_col=None, trunk=True):
    """crystal-shard crown on a slim trunk (special plants: Frostglass / Starlight trees)"""
    P = px()
    rng = np.random.default_rng(seed)
    a = np.zeros((h, w, 4), np.uint8)
    cx = int(w * center[0]); ccy = h * center[1]
    if trunk:
        im = Image.fromarray(a); d = ImageDraw.Draw(im)
        d.polygon([(cx - 2, h - 2), (cx - 1, h * 0.42), (cx + 1, h * 0.42), (cx + 2, h - 2)], fill=trunk_col)
        d.line([(cx + 1, h - 3), (cx + 1, int(h * 0.5))], fill=trunk_dark)
        for (x1, y1) in [(cx - 14, h * 0.38), (cx + 15, h * 0.42), (cx - 6, h * 0.3), (cx + 7, h * 0.28)]:
            d.line([(cx, h * 0.55), (x1, y1)], fill=trunk_col, width=2)
        a = np.array(im)
    if core: a = P.over(a, P.shade_spheres(w, h, [(cx, ccy + 5, w * 0.2, h * 0.12)], ramp6, seed=seed, texture=.1, flat=.2))
    shards = []
    for i in range(n):
        ang = -math.pi / 2 + (i / (n - 1) - 0.5) * 3.4 + (rng.random() - .5) * 0.25
        r0 = 2 + rng.random() * 5
        ln = 8 + rng.random() * 9 - abs(ang + math.pi / 2) * 2.2
        shards.append((cx + math.cos(ang) * r0, ccy + math.sin(ang) * r0 * 0.7 + 6, ang, max(5.0, ln), 2.0 + rng.random() * 1.6))
    shards.sort(key=lambda s: s[1])
    for (bx, by, ang, ln, hw) in shards:
        tx, ty = bx + math.cos(ang) * ln, by + math.sin(ang) * ln
        nx, ny = -math.sin(ang) * hw, math.cos(ang) * hw
        s_im = Image.fromarray(np.zeros((h, w, 4), np.uint8)); sd = ImageDraw.Draw(s_im)
        sd.polygon([(bx + nx, by + ny), (tx, ty), (bx - nx, by - ny)], fill=ramp6[3])
        sd.polygon([(bx + nx, by + ny), (tx, ty), (bx, by)], fill=ramp6[4] if nx < 0 or ny < 0 else ramp6[2])
        sd.line([(bx, by), (tx, ty)], fill=ramp6[5])
        a = P.over(a, np.array(s_im))
    a = P.outline(P.pad(a), outline_col or ramp6[0])
    return P.over(P.glow(a.shape[1], a.shape[0], a.shape[1] / 2, a.shape[0] * center[1], 24, halo, 0.35, 1.5), a)
