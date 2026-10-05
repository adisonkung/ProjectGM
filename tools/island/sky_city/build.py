"""
Sky City asset build (from the user's AI art):
  art/incoming/city/master_static.png  — everything built (moving parts removed), magenta background
  art/incoming/city/empty_plots_raw.png — same image with the landmark plots emptied (AI edit, same framing)

Output (public/island/sky_city/):
  base.webp            island with EMPTY plots (master everywhere except inside the plot zones), alpha
  b_<id>.webp          building layer = master pixels that differ from the empty version inside the zone, alpha, cropped
  m_water.png …        grey masks for code FX (waterfalls, crystals, canal water) at 1/2 scale
  far_*.webp, clouds   procedural sky layers
and src/app/core/data/sky-city.generated.ts (positions / sizes).

python3 tools/island/sky_city/build.py [--preview]
"""
import json, sys, os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
SRC = os.path.join(ROOT, 'art', 'incoming', 'city')
OUT = os.path.join(ROOT, 'public', 'island', 'sky_city')
TS = os.path.join(ROOT, 'src', 'app', 'core', 'data', 'sky-city.generated.ts')
os.makedirs(OUT, exist_ok=True)

# plot boxes in master pixels (x0, y0, x1, y1) — the green guide boxes, game building ids
PLOTS = {
    'ascension_shrine': (320, 80, 590, 390),
    'skill_shrine': (1220, 120, 1700, 500),
    'hero_hall': (680, 540, 1200, 880),
    'equipment_workshop': (2600, 360, 3060, 800),
    'expedition_dock': (3200, 290, 3670, 510),
    'endgame_facility': (1800, 740, 2000, 960),
    'challenge_board': (2060, 910, 2150, 1010),
    'training_ground': (2300, 860, 2880, 1140),
}
SPIRE = (2110, 0, 2430, 640)
GROW = 0.10          # zone = box grown by 10 %
FEATHER = 18         # px, base blend


def load(name):
    return np.asarray(Image.open(os.path.join(SRC, name)).convert('RGB')).astype(np.float32)


def key_alpha(a):
    """magenta → transparent (soft edge), with despill"""
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    m = np.clip(((np.minimum(r, b) - g) - 110) / 70, 0, 1)
    alpha = 1 - m
    out = a.copy()
    spill = alpha < 0.999
    lim = np.maximum(g, 0) + (np.minimum(r, b) - g) * alpha * 0.4
    for c in (0, 2):
        out[..., c] = np.where(spill, np.minimum(out[..., c], lim + (out[..., c] - lim) * alpha), out[..., c])
    al = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3))
    return out, np.asarray(al).astype(np.float32) / 255


def box_mask(shape, box, grow):
    h, w = shape
    x0, y0, x1, y1 = box
    gx, gy = (x1 - x0) * grow, (y1 - y0) * grow
    m = np.zeros((h, w), np.float32)
    m[int(max(0, y0 - gy)):int(min(h, y1 + gy)), int(max(0, x0 - gx)):int(min(w, x1 + gx))] = 1
    return m


def clean_mask(m):
    """keep the building silhouette: big connected parts, holes filled — drop redraw speckles around it"""
    from scipy import ndimage
    solid = m > 0.35
    solid = ndimage.binary_closing(solid, iterations=6)
    lab, n = ndimage.label(solid)
    if n == 0:
        return m
    sizes = ndimage.sum(solid, lab, range(1, n + 1))
    keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= max(sizes.max() * 0.06, 400)])
    keep = ndimage.binary_fill_holes(keep)
    keep = ndimage.binary_dilation(keep, iterations=3)
    soft = blur(keep.astype(np.float32), 2.0)
    return np.minimum(np.maximum(m, soft * 0.98), soft)


def blur(m, r):
    return np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))).astype(np.float32) / 255


def save_rgba(rgb, alpha, path, crop=None, q=86):
    im = Image.fromarray(np.dstack([np.clip(rgb, 0, 255), np.clip(alpha * 255, 0, 255)]).astype(np.uint8), 'RGBA')
    if crop:
        im = im.crop(crop)
    im.save(path, 'WEBP', quality=q, method=6)
    return im.size


def main():
    master = load('master_static.png')
    empty = load('empty_plots_raw.png')
    H, W = master.shape[:2]
    mrgb, malpha = key_alpha(master)
    ergb, ealpha = key_alpha(empty)

    meta = {'world': {'w': W, 'h': H}, 'buildings': {}}
    zones = np.zeros((H, W), np.float32)
    layers = {}
    diff = np.abs(mrgb - ergb).mean(axis=2) / 255 + np.abs(malpha - ealpha)
    diff = blur(np.clip((diff - 0.07) / 0.10, 0, 1), 2.5)
    for bid, box in PLOTS.items():
        zone = box_mask((H, W), box, GROW)
        zones = np.maximum(zones, zone)
        # building = where the master differs from the empty plot, inside the zone, cleaned up
        m = diff * zone
        im = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(3))
        m = np.asarray(im.filter(ImageFilter.GaussianBlur(1.5))).astype(np.float32) / 255
        m = np.clip(m * 1.6, 0, 1) * malpha
        m = clean_mask(m)
        ys, xs = np.where(m > 0.04)
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        layers[bid] = (m, (int(x0), int(y0), int(x1), int(y1)))

    # base: master outside the zones, empty plots inside (feathered seam)
    z = blur(zones, FEATHER) * zones + 0 * zones
    z = np.maximum(blur(zones, FEATHER), 0)
    z = np.clip(z * 1.0, 0, 1)
    base_rgb = mrgb * (1 - z[..., None]) + ergb * z[..., None]
    base_a = malpha * (1 - z) + ealpha * z
    save_rgba(base_rgb, base_a, os.path.join(OUT, 'base.webp'), q=84)

    for bid, (m, crop) in layers.items():
        x0, y0, x1, y1 = crop
        size = save_rgba(mrgb, m, os.path.join(OUT, f'b_{bid}.webp'), crop=crop, q=88)
        # ground line (for depth sorting): lowest opaque row near the box bottom
        meta['buildings'][bid] = {'src': f'island/sky_city/b_{bid}.webp', 'x': x0, 'y': y0, 'w': size[0], 'h': size[1],
                                  'box': list(PLOTS[bid])}

    # spire overlay (upper part, above the roofline) — the game tints it per tower stage (sealed → ascended)
    sx0, sy0, sx1, sy1 = SPIRE
    fade = np.ones((H, W), np.float32)
    ramp = np.clip((sy1 - np.arange(H)) / 120, 0, 1)[:, None]
    sp_a = malpha * box_mask((H, W), SPIRE, 0) * ramp
    save_rgba(mrgb, sp_a, os.path.join(OUT, 'spire.webp'), crop=SPIRE, q=88)
    meta['spire'] = {'src': 'island/sky_city/spire.webp', 'x': sx0, 'y': sy0, 'w': sx1 - sx0, 'h': sy1 - sy0}

    # FX masks at 1/2 scale (grey): waterfalls (bright, low-saturation, blue-white), crystals (saturated violet / cyan, bright)
    hsv = np.asarray(Image.fromarray(mrgb.astype(np.uint8)).convert('HSV')).astype(np.float32)
    hh, ss, vv = hsv[..., 0] * 360 / 255, hsv[..., 1] / 255, hsv[..., 2] / 255
    r, g, b = mrgb[..., 0], mrgb[..., 1], mrgb[..., 2]
    water = ((vv > 0.72) & (ss < 0.32) & (b >= r - 4) & (b > g - 10)) * malpha
    yy = np.arange(H)[:, None] / H
    falls = water * (yy > 0.25)
    crystals = ((ss > 0.45) & (vv > 0.55) & (((hh > 190) & (hh < 290)))) * malpha * (yy > 0.55)
    canal = ((hh > 175) & (hh < 210) & (ss > 0.25) & (vv > 0.6)) * malpha * (yy < 0.62)

    def save_mask(m, name, rad=1.2):
        im = Image.fromarray((np.clip(m, 0, 1) * 255).astype(np.uint8)).resize((W // 2, H // 2), Image.BILINEAR)
        im = im.filter(ImageFilter.GaussianBlur(rad))
        # white + alpha (CSS mask-image uses alpha in every browser; luminance masks are not universal)
        # cropped to the painted area (+ pad): a full-world masked layer re-composited every frame stutters
        a = np.asarray(im)
        ys, xs = np.nonzero(a > 24)
        x0, y0 = max(0, xs.min() - 8), max(0, ys.min() - 8)
        x1, y1 = min(a.shape[1], xs.max() + 9), min(a.shape[0], ys.max() + 9)
        im = im.crop((x0, y0, x1, y1))
        rgba = Image.new('RGBA', im.size, (255, 255, 255, 0))
        rgba.putalpha(im)
        rgba.save(os.path.join(OUT, name), optimize=True)
        meta.setdefault('masks', {})[name[2:-4]] = {'src': 'island/sky_city/' + name, 'x': int(x0) * 2, 'y': int(y0) * 2, 'w': int(x1 - x0) * 2, 'h': int(y1 - y0) * 2}
    save_mask(falls, 'm_falls.png')
    save_mask(crystals, 'm_crystals.png', 2)
    save_mask(canal, 'm_water.png')

    # picker thumbnail: the finished city over a dusk gradient
    th = Image.fromarray(np.dstack([np.clip(mrgb, 0, 255), malpha * 255]).astype(np.uint8), 'RGBA').resize((480, 216), Image.LANCZOS)
    grad = np.linspace(0, 1, 216)[:, None, None] * np.array([215, 140, 150], np.float32) + (1 - np.linspace(0, 1, 216)[:, None, None]) * np.array([40, 30, 90], np.float32)
    bg = Image.fromarray(np.repeat(grad, 480, axis=1).astype(np.uint8)).convert('RGBA')
    bg.alpha_composite(th)
    bg.convert('RGB').save(os.path.join(OUT, 'thumb.webp'), 'WEBP', quality=82)

    with open(TS, 'w') as f:
        f.write('// GENERATED by tools/island/sky_city/build.py — do not edit\n')
        f.write('export const SKY_CITY_ART = ' + json.dumps(meta, indent=1) + ' as const;\n')
    print('ok', W, H, {k: v['w'] for k, v in meta['buildings'].items()})

    if '--preview' in sys.argv:
        pv = Image.open(os.path.join(OUT, 'base.webp')).convert('RGBA')
        bg = Image.new('RGBA', pv.size, (40, 30, 70, 255)); bg.alpha_composite(pv)
        bg.convert('RGB').resize((W // 2, H // 2)).save('/tmp/claude-0/city/pv_base.png')
        for bid, v in meta['buildings'].items():
            bg.alpha_composite(Image.open(os.path.join(OUT, f'b_{bid}.webp')).convert('RGBA'), (v['x'], v['y']))
        bg.convert('RGB').resize((W // 2, H // 2)).save('/tmp/claude-0/city/pv_full.png')


if __name__ == '__main__':
    main()
