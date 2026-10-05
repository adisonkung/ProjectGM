"""Aurel — Bastion of Dawn: character clip (ult.png, 2 × 8) + the three supplied VFX → final visual reference.

Sources (art/incoming/aurel, not committed):
  ult.png          character, 16 frames (poses untouched; its own small glow kept)
  ult_charge.png   CHARGE VFX, 10 frames (spark → rings + wisps → peak F8 → compress F9 → star F10)
  ult_slam.png     GROUND SLAM FX, 10 frames (glow → peak F4: core + ring + vertical burst + dust → fade)
  ult_bastion.png  MAIN BASTION VFX, 18 frames in 2 rows (emerge → dome peak F9 → ring hold → fade)

Three phases, never blended from the start: charge gathers around Aurel (F2–F6) and compresses into the shield (F7)
→ slam bursts EXACTLY at the ground contact point G (F8 early, F9 peak, F10–F11 decay) → the bastion expands from G
(F9 emerge, F10 release, F11 peak, F12 hold, F13–F15 fade) · F16 clean.
Scale hierarchy (hero width W ≈ 190 source px of this sheet): charge ≈ 1.25 W · slam ≈ 1.75 W · bastion ≈ 2.75 W.
Layers: bastion (back) < slam (mid) < Aurel < compressed charge star (front) — the slam bursts behind his planted
shield (the shield / body stay readable), the field surrounds him. Alpha >= 200 = opaque (the AI haze and the dome's pale
fill dropped → open lattice), nearest scaling, fades by ordered dither.

Game: charge + slam are baked into the atlas row (aurel_v2.py → combine(with_bastion=False)); the bastion is too big
for the sheet cell and plays on the board's fx layer under the unit: bastion_strip() writes fx-aurel-bastion.png, its
frames laid out on the clip's own timing (FX 'aurel-bastion' in sprites.ts).
Usage (standalone reference sheet + strip): python3 tools/sprites/aurel_ult_vfx.py [src] [out dir] [sprite dir]
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, os.path.dirname(__file__))
import bailong as B  # noqa: E402

CUT = {
    'charge': ('ult_charge', [(110, 640, [92, 250, 440, 652, 885, 1119, 1358, 1618, 1868, 2063])]),
    'slam': ('ult_slam', [(150, 620, [100, 288, 494, 725, 1005, 1265, 1477, 1689, 1884, 2063])]),
    'bastion': ('ult_bastion', [(30, 400, [103, 272, 462, 679, 901, 1140, 1439, 1694, 1987]),
                                (400, 710, [168, 489, 749, 1005, 1249, 1466, 1689, 1890, 2069])]),
}
HERO_W = 190
# target width (hero widths) of each sheet's peak frame → one scale per sheet (its frames grow / shrink as drawn)
# slam: its peak is a tall vertical burst — sized so it stays ≈ 1.5 hero heights tall (≈ 1.3 W wide)
TARGET = {'charge': (8, 1.25), 'slam': (4, 1.3), 'bastion': (9, 2.75)}
ALPHA = 200
# ground contact point G: the planted shield's foot on the F9 slam pose (x from the feet root, on the ground line)
G_X = 75

# per character frame: [(sheet, vfx frame, anchor, opacity, layer)] · anchor 'aura' = around Aurel (chest / shield),
# 'shield' = the frame's shield front edge, 'G' = ground contact point (VFX bottom on the ground, centred on G)
PLAN = {
    1: [],
    2: [('charge', 1, 'aura', 0.7, 'mid')],                                  # a few tiny particles
    3: [('charge', 3, 'aura', 1.0, 'mid')],                                  # charge begins, close to the hero
    4: [('charge', 5, 'aura', 1.0, 'mid')],                                  # ring + upward wisps
    5: [('charge', 8, 'aura', 1.0, 'mid')],                                  # CHARGE PEAK
    6: [('charge', 9, 'aura', 0.9, 'mid')],                                  # compressing toward the shield
    7: [('charge', 10, 'shield', 1.0, 'front')],                              # power pulled into the shield
    8: [('slam', 2, 'G', 1.0, 'mid')],                                      # early contact glow
    9: [('bastion', 2, 'G', 1.0, 'back'), ('slam', 4, 'G', 1.0, 'mid')],    # SLAM PEAK + bastion emerges
    10: [('bastion', 6, 'G', 1.0, 'back'), ('slam', 5, 'G', 0.85, 'mid')],  # bastion release, slam decays
    11: [('bastion', 9, 'G', 1.0, 'back'), ('slam', 7, 'G', 0.6, 'mid')],   # BASTION PEAK
    12: [('bastion', 11, 'G', 1.0, 'back')],                                  # hold (ring, calmer)
    13: [('bastion', 13, 'G', 0.9, 'back')],                                  # decay
    14: [('bastion', 15, 'G', 0.8, 'back')],
    15: [('bastion', 17, 'G', 0.6, 'back')],
    16: [('bastion', 18, 'G', 0.35, 'back')],                                 # 1–2 residual particles
}
# bastion on the board: frames per 50 ms over the clip's F9 tail … F15 (steps 220 · 110 · 160 · 140 · 100 · 90 · 90)
BASTION_TIMELINE = [2, 4, 6, 8, 9, 9, 10, 11, 11, 12, 13, 14, 15, 16, 17]
BASTION_FRAME_MS = 50
CANVAS = (1300, 900)
ROOT = (560, 760)


def cut(sheet):
    name, rows = CUT[sheet]
    strip, meta = B.cut_vfx(name, rows, 'bottom', 1.0, min_alpha=48)
    a = np.array(strip)
    a[a[..., 3] < ALPHA] = 0
    a[a[..., 3] >= ALPHA, 3] = 255
    W = meta['w']
    out = []
    for k in range(meta['frames']):
        c = a[:, k * W:(k + 1) * W]
        m = c[..., 3] > 0
        ys, xs = np.nonzero(m)
        wh = m & (c[..., :3].min(-1) > 235)
        wy, wx = np.nonzero(wh if wh.sum() > 15 else m)
        out.append({'img': c, 'core': (float(wx.mean()), float(wy.mean())), 'box': (xs.min(), xs.max(), ys.min(), ys.max())})
    return out


def sheet_scale(frames, sheet):
    k, target = TARGET[sheet]
    x0, x1, _, _ = frames[k - 1]['box']
    return target * HERO_W / (x1 - x0)


def dither(a, opacity):
    h, w = a.shape[:2]
    bayer = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16
    a[np.tile(bayer, (h // 4 + 1, w // 4 + 1))[:h, :w] >= opacity, 3] = 0
    return a


def scaled(fx, s, opacity=1.0):
    img = Image.fromarray(fx['img'])
    a = np.array(img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.NEAREST))
    return dither(a, opacity) if opacity < 1 else a


def measure(img):
    """(shield front edge x, shield centre y, chest x, chest y) of a character frame, crop px"""
    m = ndimage.binary_opening(img[..., 3] >= 200, structure=np.ones((13, 13)))
    ys, xs = np.nonzero(m)
    top, bot = ys.min(), ys.max()
    band = (ys > top + 0.2 * (bot - top)) & (ys < top + 0.75 * (bot - top))
    ex = xs[band].max()
    ey = float(np.median(ys[band & (xs >= ex - 8)]))
    chest = (ys > top + 0.2 * (bot - top)) & (ys < top + 0.55 * (bot - top))
    return float(ex), ey, float(np.median(xs[chest])), float(np.median(ys[chest]))


def combine(chars, with_bastion=True):
    fx = {k: cut(k) for k in CUT}
    sc = {k: sheet_scale(fx[k], k) for k in CUT}
    out = []
    for i, fr in enumerate(chars):
        rx, ry = fr['root']
        ox, oy = ROOT[0] - rx, ROOT[1] - ry
        char = Image.new('RGBA', CANVAS, (0, 0, 0, 0))
        char.alpha_composite(Image.fromarray(fr['img']), (round(ox), round(oy)))
        back = Image.new('RGBA', CANVAS, (0, 0, 0, 0))
        mid = Image.new('RGBA', CANVAS, (0, 0, 0, 0))
        front = Image.new('RGBA', CANVAS, (0, 0, 0, 0))
        ex, ey, cx, cy = measure(fr['img'])
        for sheet, k, anchor, op, layer in PLAN[i + 1]:
            if sheet == 'bastion' and not with_bastion:
                continue
            f = fx[sheet][k - 1]
            s = sc[sheet]
            a = scaled(f, s, op)
            if anchor == 'aura':       # core between the chest and the shield, at chest / shield height
                px, py = ox + (cx + ex) / 2 - f['core'][0] * s, oy + (cy + ey) / 2 - f['core'][1] * s
            elif anchor == 'shield':   # compressed star on the shield's front edge
                px, py = ox + ex - f['core'][0] * s, oy + ey - f['core'][1] * s
            else:                      # G: bottom on the ground, core x on the contact point
                x0, x1, y0, y1 = f['box']
                px = ROOT[0] + G_X - (f['core'][0] if sheet == 'slam' else (x0 + x1) / 2) * s
                py = ROOT[1] + 2 - y1 * s
            {'back': back, 'mid': mid, 'front': front}[layer].alpha_composite(Image.fromarray(a), (round(px), round(py)))
        full = back.copy()
        full.alpha_composite(mid)
        full.alpha_composite(char)
        full.alpha_composite(front)
        under = back.copy()
        under.alpha_composite(mid)
        # layers for the atlas: VFX crisp (hard alpha after the downscale), the character keeps its own soft glow
        out.append({'img': np.array(full), 'char': np.array(char), 'root': ROOT, 'soft': True,
                    'layers': [(np.array(under), False), (np.array(char), True), (np.array(front), False)]})
    return out


def bastion_strip(out_dir, sheet_scale_px):
    """the bastion frames for the board fx layer, at the atlas' pixel scale (FX scale 1/1.5 → 1 strip px = 1 sheet
    px), bottom-centre pivot on the ground, laid out on the clip timeline (BASTION_TIMELINE × BASTION_FRAME_MS)"""
    fx = cut('bastion')
    s = sheet_scale(fx, 'bastion') * sheet_scale_px
    imgs = []
    for k in BASTION_TIMELINE:
        f = fx[k - 1]
        img = Image.fromarray(f['img']).convert('RGBa')
        img = np.array(img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.BOX).convert('RGBA'))
        img[img[..., 3] < 128] = 0
        img[img[..., 3] >= 128, 3] = 255
        x0, x1, y0, y1 = (v * s for v in f['box'])
        imgs.append((img, (x0 + x1) / 2, y1))
    W = round(max(max(cx, im.shape[1] - cx) for im, cx, _ in imgs) * 2) + 4
    H = round(max(by for _, _, by in imgs)) + 4
    strip = Image.new('RGBA', (W * len(imgs), H), (0, 0, 0, 0))
    for i, (im, cx, by) in enumerate(imgs):
        strip.alpha_composite(Image.fromarray(im), (i * W + round(W / 2 - cx), round(H - 2 - by)))
    strip.save(f'{out_dir}/fx-aurel-bastion.png', optimize=True)
    return {'frames': len(imgs), 'w': W, 'h': H, 'pivot': [0.5, round((H - 2) / H, 3)], 'scale': round(s, 4)}


def main():
    import aurel_v2 as A
    src = sys.argv[1] if len(sys.argv) > 1 else 'art/incoming/aurel'
    out_dir = sys.argv[2] if len(sys.argv) > 2 else '.'
    B.SRC = src
    frames = combine(A.sheet_frames('ult', [8, 8], True))
    union = np.zeros(CANVAS[::-1], bool)
    for f in frames:
        union |= f['img'][..., 3] > 0
    ys, xs = np.nonzero(union)
    pad = 12
    x0, x1, y0, y1 = xs.min() - pad, xs.max() + pad, ys.min() - pad, ys.max() + pad
    cw, ch = x1 - x0, y1 - y0
    sheet = Image.new('RGBA', (cw * 8, ch * 2), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.alpha_composite(Image.fromarray(f['img'][y0:y1, x0:x1]), ((i % 8) * cw, (i // 8) * ch))
    sheet.save(f'{out_dir}/aurel_bastion_of_dawn_combined.png', optimize=True)
    mag = Image.new('RGBA', sheet.size, (255, 0, 255, 255))
    mag.alpha_composite(sheet)
    mag.convert('RGB').save(f'{out_dir}/aurel_bastion_of_dawn_combined_magenta.png', optimize=True)
    print(json.dumps({'cell': [int(cw), int(ch)], 'root_in_cell': [int(ROOT[0] - x0), int(ROOT[1] - y0)], 'sheet': sheet.size,
                      'scales': {k: round(sheet_scale(cut(k), k), 3) for k in CUT}}))


if __name__ == '__main__':
    main()
