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


def extras():
    """far islands strip, god rays (brightness → alpha), bird flap sheet (8 frames), dragon body + wing (flapped in CSS)"""
    from scipy import ndimage
    rgb, al = key(load('bg_far_islands'), lo=60, span=90)
    rgb, al = best_cut(rgb, al)
    # the islands were painted half-transparent over magenta: rebuild a lavender haze ramp from the green channel
    g = rgb[..., 1] / 255
    lo, hi = np.array([118, 112, 178.]), np.array([236, 230, 252.])
    rgb = lo + (hi - lo) * np.clip((g - 0.3) / 0.6, 0, 1)[..., None]
    save(rgb, al * 0.9, 'bg_far_islands')

    g = load('bg_god_rays')
    lum = g.max(axis=2)
    al = np.clip((lum - 8) / 230, 0, 1) ** 1.1
    col = g / np.maximum(lum[..., None], 1) * 255
    im = Image.fromarray(np.dstack([np.clip(col, 0, 255), al * 255]).astype(np.uint8), 'RGBA').resize((1400, 788), Image.LANCZOS)
    im.save(os.path.join(OUT, 'bg_god_rays.webp'), 'WEBP', quality=80, method=6)

    # birds: 8 cells on an even pitch, same box per frame (the art keeps the body at the same place in each cell)
    rgb, al = key(load('sheet_birds'))
    x0, pitch, cw, y0, y1 = 14, 269.7, 268, 196, 526
    frames = []
    for i in range(8):
        x = int(round(x0 + i * pitch))
        frames.append(Image.fromarray(np.dstack([np.clip(rgb[y0:y1, x:x + cw], 0, 255), al[y0:y1, x:x + cw] * 255]).astype(np.uint8), 'RGBA'))
    fw, fh = 120, round(120 * (y1 - y0) / cw)
    sheet = Image.new('RGBA', (fw * 8, fh))
    for i, f in enumerate(frames):
        sheet.paste(f.resize((fw, fh), Image.LANCZOS), (i * fw, 0))
    sheet.save(os.path.join(OUT, 'sheet_birds.webp'), 'WEBP', quality=88, method=6)
    print('birds', sheet.size)

    # dragon parts: largest component = body, next = first wing (the two wings are the same art)
    a = load('sprite_dragon_parts')
    rgb, al = key(a)
    fg = ndimage.binary_opening(al > 0.5, iterations=1)
    lab, k = ndimage.label(fg)
    sizes = ndimage.sum(fg, lab, range(1, k + 1))
    objs = ndimage.find_objects(lab)
    order = [i for i in np.argsort(sizes)[::-1][:3]]
    order.sort(key=lambda i: objs[i][1].start)  # body, wing A, wing B (left → right)
    for name, i in (('dragon_body', order[0]), ('dragon_wing', order[1])):
        sl = objs[i]
        m = ndimage.binary_dilation(lab[sl] == i + 1, iterations=2).astype(np.float32) * al[sl]
        im = Image.fromarray(np.dstack([np.clip(rgb[sl], 0, 255), m * 255]).astype(np.uint8), 'RGBA')
        im.save(os.path.join(OUT, f'{name}.webp'), 'WEBP', quality=88, method=6)
        print(name, im.size, 'at', sl[1].start, sl[0].start)


if __name__ == '__main__':
    main()
    extras()
