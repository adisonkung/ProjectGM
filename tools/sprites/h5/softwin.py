"""For effects whose frames overlap (smoke clouds): cut a window around each frame centre and
fade it out towards the edges instead of splitting at a hard line."""
import numpy as np
from PIL import Image

def build_soft(src, y0, y1, centres, half, scale, out, x_min=0, alpha_min=20, pad=6):
    A = np.array(Image.open(src).convert('RGBA')).astype(float)[y0:y1]
    A[A[..., 3] < alpha_min] = 0
    A[:, :x_min] = 0
    W = A.shape[1]
    xs = np.arange(-half, half)
    fade = np.clip((half - np.abs(xs)) / (half * 0.35), 0, 1) ** 1.5
    tiles = []
    for c in centres:
        t = np.zeros((A.shape[0], 2 * half, 4))
        lo, hi = c - half, c + half
        s0, s1 = max(0, lo), min(W, hi)
        t[:, s0 - lo:s1 - lo] = A[:, s0:s1]
        t[..., 3] *= fade[None, :]
        tiles.append(t)
    al = np.max([t[..., 3] for t in tiles], axis=0)
    ys = np.nonzero(al.max(1) > 6)[0]
    top, bot = ys.min(), ys.max() + 1
    cw = round(2 * half * scale) + 2 * pad
    ch = round((bot - top) * scale) + 2 * pad
    sheet = Image.new('RGBA', (cw * len(tiles), ch), (0, 0, 0, 0))
    for k, t in enumerate(tiles):
        img = Image.fromarray(np.clip(t[top:bot], 0, 255).astype(np.uint8))
        img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
        sheet.alpha_composite(img, (k * cw + pad, pad))
    sheet.save(out, optimize=True)
    return cw, ch
