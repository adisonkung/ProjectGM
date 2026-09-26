"""Shared building-drawing helpers (masks, bricks, planks, shingles, windows)."""
from __future__ import annotations

import math

import numpy as np
from PIL import Image, ImageDraw

from pixart import OUT, fbm, outline, over, pad


def mask_poly(w, h, pts) -> np.ndarray:
    im = Image.new('L', (w, h), 0)
    ImageDraw.Draw(im).polygon([(round(x), round(y)) for x, y in pts], fill=255)
    return np.array(im) > 0


def mask_rect(w, h, x0, y0, x1, y1) -> np.ndarray:
    m = np.zeros((h, w), bool)
    m[max(0, int(y0)):int(y1) + 1, max(0, int(x0)):int(x1) + 1] = True
    return m


def mask_ellipse(w, h, cx, cy, rx, ry) -> np.ndarray:
    Y, X = np.mgrid[0:h, 0:w].astype(np.float32)
    return ((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2 <= 1


def fill(a, m, tex):
    """paint texture (full-size RGBA or single colour) where mask"""
    if isinstance(tex, tuple):
        a[m] = tex
    else:
        a[m] = tex[m]
    return a


def lit(x, x0, x1, strength=1.6):
    """left-lit ramp offset (+ on the left, - on the right)"""
    t = (x - x0) / max(1, x1 - x0)
    return (0.5 - t) * strength


def bricks(w, h, ramp, seed, bw=(4, 7), bh=3, x0=0, x1=None, base=2.4, jitter=0.9, mortar=None):
    """running-bond stone bricks, left-lit, per-brick tone jitter"""
    x1 = w if x1 is None else x1
    rng = np.random.default_rng(seed)
    a = np.zeros((h, w, 4), np.uint8)
    mortar = mortar if mortar is not None else ramp[0]
    a[...] = mortar
    y = 0; row = 0
    while y < h:
        x = -int(rng.integers(0, bw[1])) if row % 2 else 0
        while x < w:
            L = int(rng.integers(bw[0], bw[1] + 1))
            cx = x + L / 2
            idx = base + lit(cx, x0, x1) + (rng.random() - 0.5) * 2 * jitter
            c = ramp[int(np.clip(round(idx), 1, len(ramp) - 1))]
            xs, xe = max(0, x), min(w, x + L - 1)
            if xe > xs:
                a[y:min(h, y + bh - 1), xs:xe] = c
                # top highlight pixel row on lit bricks
                if idx > base and y < h:
                    a[y, xs:xe] = ramp[int(np.clip(round(idx) + 1, 1, len(ramp) - 1))]
            x += L
        y += bh; row += 1
    return a


def planks(w, h, ramp, seed, pw=3, vertical=True, x0=0, x1=None, base=2.6):
    x1 = w if x1 is None else x1
    rng = np.random.default_rng(seed)
    a = np.zeros((h, w, 4), np.uint8)
    grain = fbm(w, h, 2, seed, 2)
    n = (w if vertical else h)
    i = 0
    while i < n:
        idx = base + (lit(i, x0, x1) if vertical else 0) + (rng.random() - .5) * 1.2
        for k in range(pw):
            if i + k >= n: break
            v = np.clip(idx + (grain[:, i + k] if vertical else grain[i + k, :]) * 0.8 - 0.4, 1, len(ramp) - 1)
            cols = np.array([ramp[int(round(t))] for t in v], np.uint8)
            if vertical: a[:, i + k] = cols
            else: a[i + k, :] = cols
        seam = i + pw
        if seam < n:
            if vertical: a[:, seam] = ramp[0]
            else: a[seam, :] = ramp[0]
        i += pw + 1
    return a


def shingles(w, h, ramp, seed, sw=4, sh=2, top_light=True):
    rng = np.random.default_rng(seed)
    a = np.zeros((h, w, 4), np.uint8)
    for r, y in enumerate(range(0, h, sh)):
        off = (r % 2) * (sw // 2)
        grad = (1 - y / max(1, h)) * 1.6 if top_light else 0
        for x in range(-off, w, sw):
            idx = 1.6 + grad + (rng.random() - .5) * 1.0
            c = ramp[int(np.clip(round(idx), 1, len(ramp) - 1))]
            xs, xe = max(0, x), min(w, x + sw - 1)
            if xe > xs: a[y:y + sh, xs:xe] = c
            if 0 <= x + sw - 1 < w: a[y:y + sh, x + sw - 1] = ramp[0]
        a[min(h - 1, y + sh - 1), :] = np.where(a[min(h - 1, y + sh - 1), :, 3:4] > 0, np.array(ramp[max(0, 1)], np.uint8), a[min(h - 1, y + sh - 1), :])
    return a


def window(a, x, y, w, h, frame, lit_col=None, dark_col=(20, 22, 34, 255), arch=False, mullion=True):
    """window into array a (lit_col = warm glass)"""
    d = ImageDraw.Draw(im := Image.fromarray(a))
    glass = lit_col or dark_col
    if arch:
        d.rectangle([x - 1, y + 2, x + w, y + h], fill=frame)
        d.ellipse([x - 1, y - 1, x + w, y + 5], fill=frame)
        d.rectangle([x, y + 2, x + w - 1, y + h - 1], fill=glass)
        d.ellipse([x, y, x + w - 1, y + 4], fill=glass)
    else:
        d.rectangle([x - 1, y - 1, x + w, y + h], fill=frame)
        d.rectangle([x, y, x + w - 1, y + h - 1], fill=glass)
    if mullion and w >= 3:
        d.line([(x + w // 2, y), (x + w // 2, y + h - 1)], fill=frame)
        if h >= 5: d.line([(x, y + h // 2), (x + w - 1, y + h // 2)], fill=frame)
    a[...] = np.array(im)
    if lit_col:  # hot-spot
        a[y + h - 2, x:x + max(1, w // 2)] = tuple(min(255, int(c * 1.15)) for c in lit_col[:3]) + (255,)
    return a


def moss_on(a, seed, amount=0.62, ramp=None, top_only=True, rows=3):
    from pixart import MOSS
    ramp = ramp or MOSS
    h, w = a.shape[:2]
    m = a[..., 3] > 0
    n = fbm(w, h, 2.5, seed, 2)
    sel = m & (n > amount)
    if top_only:
        top = np.zeros_like(m)
        for x in range(w):
            ys = np.where(m[:, x])[0]
            if len(ys): top[ys[0]:ys[0] + rows, x] = True
        sel &= top | (n > amount + 0.12)
    a[sel] = ramp[1 + int(seed % 2)]
    return a


def finish(a, out=True):
    return outline(pad(a, 1)) if out else pad(a, 1)


def blank(w, h):
    return np.zeros((h, w, 4), np.uint8)
