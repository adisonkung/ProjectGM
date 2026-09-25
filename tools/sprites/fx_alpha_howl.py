"""Alpha Howl FX (fx-alpha-howl.png) from the user's labelled 8-frame sheet ("ALPHA HOWL FX", painted checkerboard).

usage: python3 tools/sprites/fx_alpha_howl.py <source.png>

- alpha: from colour saturation / darkness (the glow is gold-brown on a grey/white checker); pale cores that are
  enclosed by the arcs are filled in so the peak frame keeps its white-hot centre
- frames are split at the panel borders; every frame is anchored on its wave origin (the right edge of the
  content in the art, where the wolf's mouth is) and flipped so the wave travels RIGHT (game flips for enemies)
- frame 5 = FX PEAK = SKILL_ACTIVATE (MONSTER_SKILLS.alpha_howl.fx.activationFrame, see castTimeline())
Output cell: W×H (printed) — copy into FX['alpha-howl'].
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

SPLITS = [349, 528, 750, 1020, 1366, 1674, 1951]  # panel borders (source px)
X0, Y0, Y1 = 180, 140, 558  # right of the row label box, above the label bars
SCALE = 0.4
PAD = 6


def main(src):
    rgb = np.array(Image.open(src).convert('RGB')).astype(float)
    mx, mn = rgb.max(-1), rgb.min(-1)
    sat = mx - mn
    a = np.clip((sat - 14) / 55, 0, 1)
    a = np.maximum(a, np.clip((170 - mx) / 90, 0, 1))  # dark debris / outlines
    solid = a > 0.35
    core = ndimage.binary_fill_holes(ndimage.binary_closing(solid, iterations=2)) & ~solid
    a[core & (mx > 238)] = 0.95  # enclosed white-hot centres (checker grey ~210 stays out)
    a[:Y0] = 0
    a[Y1:] = 0
    a[:, :X0] = 0
    # drop specks (checker noise) — keep blobs of a few px and up
    lab, n = ndimage.label(a > 0.2)
    sizes = ndimage.sum(np.ones_like(a), lab, range(1, n + 1))
    small = np.isin(lab, np.nonzero(sizes < 6)[0] + 1)
    a[small] = 0
    # un-blend from the light background so the semi-transparent edge doesn't carry grey
    bgc = 232.0
    col = np.where(a[..., None] > 0.02, (rgb - (1 - a[..., None]) * bgc) / np.maximum(a[..., None], 0.02), 0)
    col = np.clip(col, 0, 255)
    col[core & (mx > 238)] = (255, 246, 214)  # warm white-hot core (reads as grey on dark fields otherwise)

    edges = [X0] + SPLITS + [rgb.shape[1]]
    frames = []
    for i in range(8):
        x0, x1 = edges[i], edges[i + 1]
        fa = a[:, x0:x1]
        ys, xs = np.nonzero(fa > 0.2)
        # wave origin: right edge of the main content (98th percentile ignores stray debris)
        ox = x0 + np.percentile(xs, 98)
        frames.append((x0, x1, ox, ys.min() if len(ys) else Y0, ys.max() if len(ys) else Y1))
    top = min(f[3] for f in frames) - PAD
    bot = max(f[4] for f in frames) + PAD
    reach = max(f[2] - f[0] for f in frames) + PAD  # how far content reaches behind the origin
    W = int(np.ceil(reach * SCALE)) + 2 * PAD
    H = int(np.ceil((bot - top) * SCALE))
    sheet = Image.new('RGBA', (W * 8, H), (0, 0, 0, 0))
    for i, (x0, x1, ox, *_) in enumerate(frames):
        crop = np.zeros((bot - top, x1 - x0, 4), np.uint8)
        crop[..., :3] = col[top:bot, x0:x1]
        crop[..., 3] = (a[top:bot, x0:x1] * 255).astype(np.uint8)
        img = Image.fromarray(crop).transpose(Image.FLIP_LEFT_RIGHT)  # wave travels right
        img = img.resize((max(1, round(img.width * SCALE)), H), Image.LANCZOS)
        origin_in_img = (x1 - 1 - ox) * SCALE  # after the flip
        px = round(i * W + PAD - origin_in_img)
        layer = Image.new('RGBA', sheet.size, (0, 0, 0, 0))
        layer.paste(img, (px, 0), img)
        la = np.array(layer)
        la[:, : i * W] = 0
        la[:, (i + 1) * W:] = 0
        sheet.alpha_composite(Image.fromarray(la))
    sheet.save('public/sprites/fx-alpha-howl.png', optimize=True)
    print('public/sprites/fx-alpha-howl.png', sheet.size, 'cell', W, H, 'origin x', PAD)
    prev = Image.new('RGBA', sheet.size, (40, 48, 64, 255))
    prev.alpha_composite(sheet)
    prev.save('/tmp/alpha-howl-preview.png')


if __name__ == '__main__':
    main(sys.argv[1])
