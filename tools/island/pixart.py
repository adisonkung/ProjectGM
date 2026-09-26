"""
Tiny procedural pixel-art toolkit for the Home Island asset pack.

Everything is drawn at native resolution (1 px = pixelScale world units) with hard edges, a fixed palette,
ordered (Bayer) dithering between palette ramps and dark selective outlines — the 16-bit look.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
from PIL import Image, ImageDraw

# ------------------------------------------------------------------ palette (Ancient Forest, dusk)

OUT = (22, 16, 28, 255)
C = lambda *rgb: (*rgb, 255)

GRASS = [C(18, 32, 28), C(28, 48, 36), C(40, 64, 42), C(54, 80, 48), C(72, 98, 56), C(96, 118, 64)]
LEAF = [C(14, 28, 30), C(22, 46, 42), C(34, 70, 52), C(54, 98, 62), C(86, 130, 74), C(128, 164, 90)]
LEAF_WARM = [C(22, 30, 24), C(40, 54, 34), C(66, 82, 42), C(100, 112, 52), C(140, 140, 66), C(180, 170, 90)]
BLOSSOM = [C(46, 26, 44), C(78, 42, 66), C(118, 64, 90), C(162, 96, 116), C(196, 134, 144), C(226, 176, 178)]
BARK = [C(28, 18, 20), C(46, 30, 28), C(70, 46, 36), C(98, 68, 48), C(128, 94, 64)]
WOOD = [C(36, 22, 20), C(62, 38, 28), C(92, 58, 38), C(126, 84, 52), C(164, 116, 72), C(196, 150, 96)]
STONE = [C(26, 26, 36), C(44, 44, 58), C(66, 66, 82), C(92, 92, 106), C(124, 122, 132), C(160, 156, 160)]
STONE_WARM = [C(34, 28, 30), C(56, 48, 48), C(82, 72, 68), C(110, 100, 90), C(142, 132, 116), C(176, 166, 146)]
MOSS = [C(30, 48, 30), C(48, 74, 38), C(74, 104, 48), C(106, 134, 60)]
DIRT = [C(34, 26, 26), C(54, 42, 38), C(76, 60, 48), C(98, 80, 60), C(120, 100, 74), C(142, 122, 90)]
ROOF_RED = [C(40, 18, 22), C(68, 30, 32), C(98, 44, 42), C(128, 62, 52), C(156, 86, 66)]
ROOF_SLATE = [C(24, 26, 40), C(38, 42, 62), C(56, 62, 88), C(80, 88, 114), C(108, 116, 140)]
PLASTER = [C(70, 58, 52), C(104, 88, 74), C(138, 118, 94), C(170, 150, 118), C(196, 180, 146)]
METAL = [C(30, 30, 38), C(54, 56, 66), C(86, 90, 100), C(126, 130, 138), C(176, 180, 184)]
WATER = [C(14, 26, 44), C(20, 40, 62), C(30, 58, 84), C(46, 84, 110), C(80, 124, 146), C(150, 190, 200)]
FIRE = [C(120, 30, 20), C(190, 70, 30), C(236, 130, 44), C(250, 196, 90), C(255, 240, 180)]
GOLD = [C(70, 46, 20), C(118, 82, 32), C(176, 132, 52), C(226, 186, 92), C(252, 232, 160)]
CYAN = [C(16, 44, 64), C(28, 86, 110), C(50, 150, 170), C(110, 214, 224), C(200, 250, 250)]
VIOLET = [C(34, 20, 58), C(62, 36, 110), C(106, 66, 180), C(160, 118, 236), C(222, 196, 255)]
EMERALD = [C(14, 44, 40), C(24, 84, 70), C(46, 140, 110), C(100, 210, 160), C(200, 255, 220)]
CLOTH_RED = [C(50, 16, 24), C(90, 26, 34), C(134, 42, 44), C(176, 66, 56)]
CLOTH_BLUE = [C(20, 24, 50), C(34, 42, 86), C(52, 66, 124), C(80, 98, 160)]

BAYER4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], dtype=np.float32) / 16.0 - 0.5 + 1 / 32


# ------------------------------------------------------------------ canvas

@dataclass
class Canvas:
    img: Image.Image

    @staticmethod
    def new(w: int, h: int) -> 'Canvas':
        return Canvas(Image.new('RGBA', (w, h), (0, 0, 0, 0)))

    @property
    def w(self) -> int: return self.img.width

    @property
    def h(self) -> int: return self.img.height

    @property
    def d(self) -> ImageDraw.ImageDraw: return ImageDraw.Draw(self.img)

    def arr(self) -> np.ndarray: return np.array(self.img)

    def set(self, a: np.ndarray) -> 'Canvas':
        self.img = Image.fromarray(a.astype(np.uint8), 'RGBA'); return self

    def paste(self, other: 'Canvas | Image.Image', x: int, y: int) -> 'Canvas':
        im = other.img if isinstance(other, Canvas) else other
        self.img.alpha_composite(im, (int(x), int(y))); return self

    def px(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h: self.img.putpixel((int(x), int(y)), c)

    def rect(self, x0, y0, x1, y1, c): self.d.rectangle([x0, y0, x1, y1], fill=c); return self

    def poly(self, pts, c): self.d.polygon([(int(round(x)), int(round(y))) for x, y in pts], fill=c); return self

    def line(self, pts, c, w=1): self.d.line([(int(round(x)), int(round(y))) for x, y in pts], fill=c, width=w); return self

    def ellipse(self, x0, y0, x1, y1, c): self.d.ellipse([x0, y0, x1, y1], fill=c); return self

    def save(self, path: str): self.img.save(path)


# ------------------------------------------------------------------ noise

def value_noise(w: int, h: int, cell: float, seed: int, tile: bool = False) -> np.ndarray:
    """smooth 0..1 value noise; `tile` makes it wrap on both axes"""
    rng = np.random.default_rng(seed)
    gw, gh = max(2, int(math.ceil(w / cell)) + 1), max(2, int(math.ceil(h / cell)) + 1)
    if tile:
        gw, gh = max(2, round(w / cell)), max(2, round(h / cell))
    g = rng.random((gh + 1, gw + 1)).astype(np.float32)
    if tile:
        g[-1, :] = g[0, :]; g[:, -1] = g[:, 0]
    ys = np.linspace(0, gh if tile else (h / cell), h, endpoint=not tile)[:, None]
    xs = np.linspace(0, gw if tile else (w / cell), w, endpoint=not tile)[None, :]
    x0, y0 = np.floor(xs).astype(int), np.floor(ys).astype(int)
    x0 = np.clip(x0, 0, gw - 1); y0 = np.clip(y0, 0, gh - 1)
    fx, fy = xs - x0, ys - y0
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy)
    a = g[y0, x0]; b = g[y0, x0 + 1]; c = g[y0 + 1, x0]; d = g[y0 + 1, x0 + 1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def fbm(w, h, cell, seed, octaves=3, tile=False):
    out = np.zeros((h, w), np.float32); amp = 1.0; tot = 0
    for o in range(octaves):
        out += value_noise(w, h, max(1.5, cell / (2 ** o)), seed + o * 101, tile) * amp
        tot += amp; amp *= 0.5
    return out / tot


def bayer(w, h, ox=0, oy=0):
    return np.tile(BAYER4, (h // 4 + 2, w // 4 + 2))[oy % 4: oy % 4 + h, ox % 4: ox % 4 + w]


def ramp_map(v: np.ndarray, ramp: list, dither: float = 1.0, ox=0, oy=0) -> np.ndarray:
    """map values 0..1 onto a palette ramp with ordered dithering → RGBA array"""
    h, w = v.shape
    n = len(ramp)
    idx = np.clip(np.floor(v * n + bayer(w, h, ox, oy) * dither), 0, n - 1).astype(int)
    pal = np.array(ramp, np.uint8)
    return pal[idx]


# ------------------------------------------------------------------ shaded volumes

def shade_spheres(w, h, spheres, ramp, light=(-0.55, -0.75), seed=1, texture=0.18, tex_cell=2.5, rim=0.0, flat=0.0, dither=0.6):
    """
    Union of shaded spheres/ellipsoids: [(cx, cy, rx, ry)], lit from `light` — the core of trees, bushes, rocks.
    Returns RGBA array. `texture` = high-frequency noise (leaf clumps / stone grain).
    """
    lx, ly = light; ll = math.hypot(lx, ly); lx, ly = lx / ll, ly / ll
    Y, X = np.mgrid[0:h, 0:w].astype(np.float32)
    val = np.full((h, w), -1.0, np.float32)
    for (cx, cy, rx, ry) in spheres:
        dx, dy = (X - cx) / rx, (Y - cy) / ry
        r2 = dx * dx + dy * dy
        inside = r2 <= 1
        nz = np.sqrt(np.clip(1 - r2, 0, 1))
        lam = np.clip(-(dx * lx + dy * ly) * 0.8 + nz * 0.55, 0, 1.2)
        v = np.where(inside, 0.12 + lam * 0.78 * (1 - flat) + flat * 0.5, -1)
        val = np.maximum(val, v)
    mask = val >= 0
    tex = fbm(w, h, tex_cell, seed, 2) - 0.5
    v = np.clip(val + tex * texture * 2, 0, 0.999)
    if rim:
        v = np.clip(v + rim * (Y / h - 0.5), 0, 0.999)
    rgba = ramp_map(v, ramp, dither)
    rgba[..., 3] = np.where(mask, 255, 0)
    return rgba


def outline(a: np.ndarray, color=OUT, sides='all', inner_dark=None) -> np.ndarray:
    """1-px outline outside the alpha mask (selout-ish: darker where it touches dark pixels)"""
    m = a[..., 3] > 0
    grown = np.zeros_like(m)
    shifts = [(0, 1), (0, -1), (1, 0), (-1, 0)]
    for dy, dx in shifts:
        grown |= np.roll(np.roll(m, dy, 0), dx, 1)
    edge = grown & ~m
    out = a.copy()
    out[edge] = color
    return out


def pad(a: np.ndarray, p=1) -> np.ndarray:
    return np.pad(a, ((p, p), (p, p), (0, 0)))


def to_canvas(a: np.ndarray) -> Canvas:
    return Canvas(Image.fromarray(a.astype(np.uint8), 'RGBA'))


def over(dst: np.ndarray, src: np.ndarray, x=0, y=0) -> np.ndarray:
    """alpha-over src onto dst at (x, y) (hard alpha)"""
    h, w = src.shape[:2]
    H, W = dst.shape[:2]
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(W, x + w), min(H, y + h)
    if x1 <= x0 or y1 <= y0: return dst
    s = src[y0 - y:y1 - y, x0 - x:x1 - x]
    d = dst[y0:y1, x0:x1]
    a = s[..., 3:4] / 255.0
    d[..., :3] = (s[..., :3] * a + d[..., :3] * (1 - a)).astype(np.uint8)
    d[..., 3] = np.maximum(d[..., 3], s[..., 3])
    return dst


def glow(w, h, cx, cy, r, color, strength=1.0, falloff=2.0) -> np.ndarray:
    """soft light blob (for light / aura layers — additive-looking via CSS blend)"""
    Y, X = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.sqrt((X - cx) ** 2 + (Y - cy) ** 2) / r
    a = np.clip(1 - d, 0, 1) ** falloff * strength
    # quantize alpha in steps so light stays "pixel"
    a = np.floor(a * 8) / 8 * 0.8
    out = np.zeros((h, w, 4), np.uint8)
    out[..., 0], out[..., 1], out[..., 2] = color[0], color[1], color[2]
    out[..., 3] = np.clip(a * 255, 0, 255).astype(np.uint8)
    return out


def texture_rect(w, h, ramp, cell=3, seed=0, bias=0.0, contrast=1.0) -> np.ndarray:
    v = np.clip((fbm(w, h, cell, seed, 2) - 0.5) * contrast + 0.5 + bias, 0, 0.999)
    return ramp_map(v, ramp)


def strip(frames: list[np.ndarray]) -> np.ndarray:
    """horizontal sprite sheet"""
    h = max(f.shape[0] for f in frames)
    w = max(f.shape[1] for f in frames)
    out = np.zeros((h, w * len(frames), 4), np.uint8)
    for i, f in enumerate(frames):
        out[h - f.shape[0]:, i * w:i * w + f.shape[1]] = f
    return out
