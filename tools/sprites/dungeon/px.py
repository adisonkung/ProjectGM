"""Tiny pixel-art kit: shapes with auto 3-tone shading + dark outline, 16-bit chibi style."""
import numpy as np
from PIL import Image, ImageDraw
import colorsys

OUT = (26, 16, 30)


def hexc(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def tone(c, dl=0.0, ds=0.0, dh=0.0):
    r, g, b = [x / 255 for x in c]
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    h = (h + dh) % 1
    l = min(1, max(0, l + dl)); s = min(1, max(0, s + ds))
    return tuple(int(round(x * 255)) for x in colorsys.hls_to_rgb(h, l, s))


class Sprite:
    def __init__(self, w=64, h=64, k=1.0):
        self.k = k
        w, h = int(round(w * k)), int(round(h * k))
        self.w, self.h = w, h
        self.img = np.zeros((h, w, 4), np.uint8)
        self.occ = np.zeros((h, w), bool)

    # ---------- masks
    def _mask(self, fn):
        m = Image.new('L', (self.w, self.h), 0)
        fn(ImageDraw.Draw(m))
        return np.array(m) > 0

    def _s(self, v):
        return [c * self.k for c in v] if not isinstance(v[0], (tuple, list)) else [(x * self.k, y * self.k) for x, y in v]

    def ellipse(self, box, col, **kw):
        b = self._s(box)
        return self.shape(self._mask(lambda d: d.ellipse(b, fill=255)), col, **kw)

    def poly(self, pts, col, **kw):
        p = self._s(pts)
        return self.shape(self._mask(lambda d: d.polygon(p, fill=255)), col, **kw)

    def rect(self, box, col, **kw):
        b = self._s(box)
        b = [b[0], b[1], max(b[0], b[2] + self.k - 1), max(b[1], b[3] + self.k - 1)]
        return self.shape(self._mask(lambda d: d.rectangle(b, fill=255)), col, **kw)

    def line(self, pts, col, width=1, **kw):
        p = self._s(pts); w = max(1, int(round(width * self.k)))
        return self.shape(self._mask(lambda d: d.line(p, fill=255, width=w)), col, **kw)

    def ring(self, box, col, width=2, **kw):
        b = self._s(box); w = max(1, int(round(width * self.k)))
        return self.shape(self._mask(lambda d: d.ellipse(b, outline=255, width=w)), col, **kw)

    def shape(self, m, col, shade=True, edge=True, hi=0.14, lo=-0.16, flat=False):
        col = hexc(col) if isinstance(col, str) else col
        base = np.zeros((self.h, self.w, 3), np.uint8); base[:] = col
        if shade and not flat:
            # highlight: top-left rim ; shadow: bottom-right band
            b = max(2, int(round(2 * self.k))); sh = np.zeros_like(m); sh[:-b, :-b] = m[b:, b:]
            shadow = m & ~sh
            up = np.zeros_like(m); up[1:, 1:] = m[:-1, :-1]
            light = m & ~up
            dark = tone(col, lo); lite = tone(col, hi, 0.05)
            base[shadow] = dark
            base[light & ~shadow] = lite
        if edge:
            inner = m & ~(np.roll(m, 1, 0) & np.roll(m, -1, 0) & np.roll(m, 1, 1) & np.roll(m, -1, 1))
            # only draw inner edge where it borders already-painted pixels (keeps silhouette clean)
            border = inner & (np.roll(self.occ, 1, 0) | np.roll(self.occ, -1, 0) | np.roll(self.occ, 1, 1) | np.roll(self.occ, -1, 1))
            base[border] = tone(col, -0.32, -0.05)
        self.img[m, :3] = base[m]
        self.img[m, 3] = 255
        self.occ |= m
        return m

    def px(self, pts, col):
        col = hexc(col) if isinstance(col, str) else col
        n = max(1, int(round(self.k)))
        for x, y in pts:
            X, Y = int(round(x * self.k)), int(round(y * self.k))
            if 0 <= X < self.w and 0 <= Y < self.h:
                self.img[Y:Y + n, X:X + n, :3] = col; self.img[Y:Y + n, X:X + n, 3] = 255; self.occ[Y:Y + n, X:X + n] = True

    def outline(self, col=OUT):
        o = self.occ
        n = o.copy()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n |= np.roll(np.roll(o, dy, 0), dx, 1)
        ring = n & ~o
        self.img[ring, :3] = col; self.img[ring, 3] = 255
        self.occ |= ring
        return self

    def image(self, scale=4):
        im = Image.fromarray(self.img, 'RGBA')
        return im.resize((self.w * scale, self.h * scale), Image.NEAREST)


def glow_layer(w, h, draw_fn, blur=0):
    """FX helper: RGBA drawn with PIL directly (semi-transparent allowed)"""
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(im))
    return im
