"""Blade Trace ("ดาบพันรอย") finisher FX from the user's sheet art/incoming/fx/blade_trace_slashes.png (black background):
8 crescent slashes → public/fx/blade-slash-1..8.webp, fire ring → public/fx/blade-fire-ring.webp (brightness → alpha).
python3 tools/sprites/blade_trace_fx.py"""
import os
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
a = np.asarray(Image.open(os.path.join(ROOT, 'art/incoming/fx/blade_trace_slashes.png')).convert('RGB')).astype(np.float32)
OUT = os.path.join(ROOT, 'public/fx')
H, W = a.shape[:2]
mx, mn = a.max(axis=2), a.min(axis=2)
sat = (mx - mn) / np.maximum(mx, 1)
yy = np.arange(H)[:, None] * np.ones((1, W))
fg = mx > 30
ring = fg & ((yy >= 590) | ((yy >= 540) & (sat > 0.5)))  # the fire ring is the bottom band (orange)
cream = fg & ~ring


def save(m, name, sl):
    sub, m = a[sl], m[sl]
    lum = sub.max(axis=2)
    al = np.clip((lum - 12) / 200, 0, 1) * m
    col = sub / np.maximum(lum[..., None], 1) * 255
    Image.fromarray(np.dstack([np.clip(col, 0, 255), al * 255]).astype(np.uint8), 'RGBA').save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=88, method=6)


lab, k = ndimage.label(ndimage.binary_dilation(cream, iterations=12))
objs = ndimage.find_objects(lab)
sizes = ndimage.sum(cream, lab, range(1, k + 1))
pieces = sorted([(objs[i], (lab == i + 1) & cream) for i in range(k) if sizes[i] > 5000], key=lambda t: (t[0][0].start // 250, t[0][1].start))
for n, (sl, m) in enumerate(pieces):
    save(ndimage.binary_dilation(m, iterations=3), f'blade-slash-{n + 1}', sl)
ys, xs = np.where(ring)
save(ndimage.binary_dilation(ring, iterations=3), 'blade-fire-ring', (slice(ys.min(), ys.max() + 1), slice(xs.min(), xs.max() + 1)))
print(len(pieces), 'slashes + ring')
