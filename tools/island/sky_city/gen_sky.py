"""Procedural sky layers for the Sky City (seamless in x): cloud sea, far floating islands, foreground wisps.
python3 tools/island/sky_city/gen_sky.py"""
import os
import numpy as np
from PIL import Image, ImageFilter, ImageOps

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
OUT = os.path.join(ROOT, 'public', 'island', 'sky_city')
rng = np.random.default_rng(7)


def periodic_noise(w, h, octaves, base=8, persistence=0.55):
    """value noise that tiles in x (bicubic-upsampled random grids with wrap)"""
    out = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        gx = base * 2 ** o
        gy = max(2, int(gx * h / w) + 1)
        g = rng.random((gy, gx)).astype(np.float32)
        g = np.concatenate([g, g[:, :3]], axis=1)  # wrap
        im = Image.fromarray(g).resize((int(w * (gx + 3) / gx), h), Image.BICUBIC)
        out += np.asarray(im)[:, :w] * amp
        tot += amp
        amp *= persistence
    return out / tot


def cloud_sea(w=2400, h=560):
    """stylised cumulus sea: soft shaded puffs (lit from the upper left), wrapped in x"""
    col = np.zeros((h, w, 3), np.float32) + np.array([140, 120, 190], np.float32)
    a = np.zeros((h, w), np.float32)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    puffs = []
    for row, (y0, r0, n) in enumerate([(0.30, 38, 110), (0.45, 50, 100), (0.62, 66, 90), (0.80, 84, 80), (0.97, 100, 70)]):
        for i in range(n):
            puffs.append((rng.random() * w, h * y0 + rng.normal(0, 18), r0 * (0.65 + rng.random() * 0.7), row))
    puffs.sort(key=lambda p: p[1])
    warm = np.array([255, 232, 205], np.float32); mid = np.array([214, 186, 232], np.float32); shade = np.array([132, 112, 186], np.float32)
    for (px, py, r, row) in puffs:
        for ox in (0, -w, w):
            cx = px + ox
            if cx + r < 0 or cx - r > w:
                continue
            x0, x1 = int(max(0, cx - r)), int(min(w, cx + r + 1)); y0, y1 = int(max(0, py - r)), int(min(h, py + r + 1))
            sx, sy = xx[y0:y1, x0:x1], yy[y0:y1, x0:x1]
            d = np.sqrt((sx - cx) ** 2 + ((sy - py) * 1.45) ** 2) / r
            inside = np.clip((1 - d) * 3.5, 0, 1)
            nz = np.sqrt(np.clip(1 - d ** 2, 0, 1))
            lx, ly = (sx - cx) / r, (sy - py) / r
            light = np.clip(-0.3 * lx - 0.9 * ly + 0.35 * nz + 0.15, 0, 1) ** 0.8
            depth = 0.75 + 0.25 * (py / h)
            c = shade[None, None] * (1 - light[..., None]) + mid[None, None] * light[..., None]
            c = c * (1 - light[..., None] ** 4) + warm[None, None] * light[..., None] ** 4
            c *= depth
            m = inside[..., None]
            col[y0:y1, x0:x1] = col[y0:y1, x0:x1] * (1 - m) + c * m
            a[y0:y1, x0:x1] = np.maximum(a[y0:y1, x0:x1], inside)
    yfade = np.clip((np.linspace(0, 1, h) - 0.12) * 5, 0, 1)[:, None]
    Image.fromarray(np.dstack([col, a * yfade * 255]).astype(np.uint8), 'RGBA').filter(ImageFilter.GaussianBlur(1.8)).save(os.path.join(OUT, "clouds.webp"), 'WEBP', quality=84)


def wisps(w=2400, h=320):
    n = periodic_noise(w, h, 5, base=4)
    y = np.linspace(-1, 1, h)[:, None]
    band = np.exp(-(y * 2.2) ** 2)
    a = np.clip((n - 0.45) * 2.4, 0, 1) * band
    a = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))).astype(np.float32)
    col = np.full((h, w, 3), [255, 246, 236], np.float32)
    Image.fromarray(np.dstack([col, a * 0.85]).astype(np.uint8), 'RGBA').save(os.path.join(OUT, 'wisps.webp'), 'WEBP', quality=80)


def far_islands(w=2600, h=420):
    base = Image.open(os.path.join(OUT, 'base.webp')).convert('RGBA')
    crops = [base.crop((90, 60, 760, 720)), base.crop((3000, 200, 3720, 790)), base.crop((380, 520, 1300, 1600)), base.crop((2500, 900, 3500, 1640))]
    strip = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    spots = [(0.02, 0.38, 0.22, False), (0.27, 0.52, 0.12, True), (0.43, 0.30, 0.16, False), (0.63, 0.55, 0.10, True), (0.78, 0.36, 0.19, True)]
    for i, (fx, fy, sc, flip) in enumerate(spots):
        c = crops[i % len(crops)]
        if flip:
            c = ImageOps.mirror(c)
        c = c.resize((int(c.width * sc * 2), int(c.height * sc * 2)), Image.LANCZOS)
        arr = np.asarray(c).astype(np.float32)
        haze = np.array([150, 150, 205], np.float32)
        k = 0.62 + 0.1 * (1 - sc / 0.22)
        arr[..., :3] = arr[..., :3] * (1 - k) + haze * k
        arr[..., 3] *= 0.85
        c = Image.fromarray(arr.astype(np.uint8), 'RGBA').filter(ImageFilter.GaussianBlur(0.8))
        x, y = int(fx * w), int(fy * h - c.height / 2)
        for dx in (0, -w):  # wrap
            strip.alpha_composite(c, (x + dx, max(0, y))) if x + dx + c.width > 0 else None
    strip.save(os.path.join(OUT, 'far_islands.webp'), 'WEBP', quality=80)


if __name__ == '__main__':
    cloud_sea()
    wisps()
    far_islands()
    print('ok')
