"""Sky City background layers from the user's AI art (art/incoming/city/bg/*.png → public/island/sky_city/bg_*.webp).
  bg_sky_dusk      opaque sky (resized)
  bg_cloud_bank    magenta-keyed cumulus strip, made seamless (edge cross-fade)
  bg_cloud_sea     magenta-keyed cloud sea strip, seamless
  fg_cloud_wisps   white wisps on black → alpha from brightness, seamless
  sprite_sky_whale magenta-keyed, cropped
python3 tools/island/sky_city/bg_layers.py"""
import os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
SRC = os.path.join(ROOT, 'art', 'incoming', 'city', 'bg')
OUT = os.path.join(ROOT, 'public', 'island', 'sky_city')


def load(n):
    return np.asarray(Image.open(os.path.join(SRC, n + '.png')).convert('RGB')).astype(np.float32)


def key(a, lo=95, span=80):
    """magenta → alpha; pulls the pink spill out of soft edges"""
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mag = np.minimum(r, b) - g
    alpha = 1 - np.clip((mag - lo) / span, 0, 1)
    # magenta must be both r and b high — keeps violet/purple art (b high, r lower) opaque
    alpha = np.where((r > 200) & (b > 200) & (g < 90), alpha, 1.0)
    out = a.copy()
    edge = alpha < 0.999
    gray = g + (np.minimum(r, b) - g) * 0.35
    for c in (0, 2):
        out[..., c] = np.where(edge, gray + (out[..., c] - gray) * alpha, out[..., c])
    al = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3))).astype(np.float32) / 255
    return out, al


def seamless(rgb, al, overlap):
    """cross-fade the right edge into the left one → width - overlap, tiles without a seam"""
    w = rgb.shape[1]
    t = np.linspace(0, 1, overlap)[None, :, None]
    o_rgb, o_al = rgb[:, :w - overlap].copy(), al[:, :w - overlap].copy()
    o_rgb[:, :overlap] = rgb[:, :overlap] * t + rgb[:, w - overlap:] * (1 - t)
    o_al[:, :overlap] = al[:, :overlap] * t[..., 0] + al[:, w - overlap:] * (1 - t[..., 0])
    return o_rgb, o_al


def best_cut(rgb, al, search=500, overlap=90):
    """trim both ends so the seam joins two similar columns (alpha profile + colour), then cross-fade a little"""
    w = rgb.shape[1]
    sig = np.concatenate([al * 3, rgb.mean(axis=2) / 255 * al], axis=0)
    best = None
    for i in range(0, search, 4):
        left = sig[:, i:i + overlap]
        for j in range(w - search, w - overlap, 4):
            d = np.abs(left - sig[:, j:j + overlap]).mean()
            if best is None or d < best[0]:
                best = (d, i, j)
    _, i, j = best
    return seamless(rgb[:, i:j + overlap], al[:, i:j + overlap], overlap)


def save(rgb, al, name, height=None, q=84):
    im = Image.fromarray(np.dstack([np.clip(rgb, 0, 255), np.clip(al * 255, 0, 255)]).astype(np.uint8), 'RGBA')
    if height:
        im = im.resize((round(im.width * height / im.height), height), Image.LANCZOS)
    im.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=q, method=6)
    print(name, im.size)


def main():
    sky = Image.open(os.path.join(SRC, 'bg_sky_dusk.png')).convert('RGB')
    sky.resize((2560, round(2560 * sky.height / sky.width)), Image.LANCZOS).save(os.path.join(OUT, 'bg_sky_dusk.webp'), 'WEBP', quality=86, method=6)

    for name in ('bg_cloud_bank', 'bg_cloud_sea'):
        rgb, al = key(load(name))
        rgb, al = best_cut(rgb, al)
        save(rgb, al, name)

    w = load('fg_cloud_wisps')
    lum = w.mean(axis=2)
    al = np.clip((lum - 14) / 190, 0, 1) ** 0.9
    col = np.full_like(w, 255) * np.array([1, 0.97, 0.93], np.float32)
    col, al = seamless(col, al, 100)
    save(col, al, 'fg_cloud_wisps')

    rgb, al = key(load('sprite_sky_whale'))
    ys, xs = np.where(al > 0.05)
    crop = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    im = Image.fromarray(np.dstack([np.clip(rgb, 0, 255), al * 255]).astype(np.uint8), 'RGBA').crop(crop)
    im = im.resize((1100, round(1100 * im.height / im.width)), Image.LANCZOS)
    im.save(os.path.join(OUT, 'sprite_sky_whale.webp'), 'WEBP', quality=88, method=6)
    print('whale', im.size)


if __name__ == '__main__':
    main()
