"""Skill-FX strips from labelled panels on a painted checkerboard (art/incoming/fx_*.png) → public/sprites/fx-<id>.png

Alpha is rebuilt from how far a pixel is from the neutral checker: colour (saturation), brighter than the
light checker tone (white cores) or darker than the dark tone (smoke). The colour is un-mixed from a mid-grey
backdrop so faint glows keep their hue on dark battle scenes. All frames share one crop box (the union of
their content) so the animation does not wobble; the strip is scaled to `height` px.

usage: python3 tools/sprites/fx_cut.py [id …]   → prints the FX table rows (w / h) to paste into sprites.ts
"""
import sys

import numpy as np
from PIL import Image

CONFIG = {
    # panels: (x0, x1) per frame · y: (y0, y1) content band (label bar excluded) · bgHi: brightest checker tone
    'lions-roar': dict(src='fx_lions_roar.png', y=(6, 107), bgHi=255, height=96,
                       panels=[(175, 383), (394, 603), (614, 828), (835, 1057), (1069, 1286), (1298, 1525)]),
    'crescent-iaido': dict(src='fx_CRESCENT_IAIDO.png', y=(6, 87), bgHi=255, height=72,
                           panels=[(164, 328), (339, 527), (538, 730), (737, 916), (927, 1110), (1122, 1303)]),
    'mirror-stance': dict(src='fx_MIRROR_STANCE.png', y=(6, 73), bgHi=255, height=96,
                          panels=[(165, 337), (344, 526), (534, 720), (732, 915), (927, 1110), (1122, 1303)]),
    'starfall': dict(src='fx_ STARFALL.png', y=(2, 404), bgHi=240, height=192,
                     panels=[(120, 316), (321, 514), (519, 702), (707, 895), (900, 1149), (1155, 1405)]),
    'judgement-beam': dict(src='fx_JUDGEMENT_BEAM.png', y=(0, 316), bgHi=240, height=192,
                           panels=[(120, 316), (321, 514), (519, 702), (707, 895), (900, 1088), (1094, 1405)]),
}


def alpha_of(rgb, bg_hi):
    mx, mn = rgb.max(-1), rgb.min(-1)
    sat = mx - mn
    a_sat = np.clip((sat - 12) / 55, 0, 1)
    a_bright = np.clip((mx - bg_hi - 2) / max(6, 255 - bg_hi - 2), 0, 1) if bg_hi < 250 else np.zeros_like(a_sat)
    a_dark = np.clip((196 - mx) / 90, 0, 1)
    a = np.maximum(np.maximum(a_sat, a_bright), a_dark)
    # panel borders: straight dark low-saturation columns / rows
    border = (sat < 45) & (mx < 150)
    cols = border.mean(0) > 0.35
    rows = border.mean(1) > 0.35
    a[:, cols] = 0
    a[rows, :] = 0
    a[:, np.convolve(cols, [1, 1, 1], 'same') > 0] *= 0  # anti-aliased edge of the line
    a[a < 0.06] = 0
    return a


def cut(fid):
    c = CONFIG[fid]
    rgb = np.asarray(Image.open(f'art/incoming/{c["src"]}').convert('RGB')).astype(float)
    y0, y1 = c['y']
    frames = []
    for x0, x1 in c['panels']:
        p = rgb[y0:y1, x0:x1]
        a = alpha_of(p, c['bgHi'])
        frames.append((p, a))
    # shared box: union of content, frames aligned on their panel centres
    W = max(p.shape[1] for p, _ in frames)
    H = y1 - y0
    union = np.zeros((H, W), bool)
    padded = []
    for p, a in frames:
        off = (W - p.shape[1]) // 2
        P = np.zeros((H, W, 3))
        A = np.zeros((H, W))
        P[:, off:off + p.shape[1]] = p
        A[:, off:off + p.shape[1]] = a
        union |= A > 0.1
        padded.append((P, A))
    ys, xs = np.nonzero(union)
    ya, yb, xa, xb = max(0, ys.min() - 2), min(H, ys.max() + 3), max(0, xs.min() - 2), min(W, xs.max() + 3)
    S = c['height'] / (yb - ya)
    fw, fh = round((xb - xa) * S), c['height']
    strip = Image.new('RGBA', (fw * len(padded), fh), (0, 0, 0, 0))
    backdrop = 225.0
    for i, (P, A) in enumerate(padded):
        P, A = P[ya:yb, xa:xb], A[ya:yb, xa:xb]
        safe = np.maximum(A, 0.2)[..., None]
        col = np.clip((P - (1 - safe) * backdrop) / safe, 0, 255)  # un-mix from the grey checker
        img = np.dstack([col, A * 255]).astype(np.uint8)
        im = Image.fromarray(img, 'RGBA').resize((fw, fh), Image.LANCZOS)
        strip.paste(im, (i * fw, 0))
    strip.save(f'public/sprites/fx-{fid}.png', optimize=True)
    prev = Image.new('RGBA', strip.size, (40, 46, 60, 255))
    prev.alpha_composite(strip)
    prev.save(f'/tmp/fx-{fid}.png')
    # where the content sits in the frame (0..1) — for dx / dy
    ua = np.asarray(strip)[..., 3] > 30
    yy, xx = np.nonzero(ua[:, (len(padded) - 1) * fw:])
    print(f"  '{fid}': w {fw} h {fh} · last frame content x {xx.min() / fw:.2f}–{xx.max() / fw:.2f}, y {yy.min() / fh:.2f}–{yy.max() / fh:.2f}")


if __name__ == '__main__':
    for f in sys.argv[1:] or CONFIG:
        cut(f)
