"""Aurel — Shield Bash: character clip (bash.png, 2 × 5) + the two supplied VFX strips → one combined clip.

Sources (art/incoming/aurel, not committed):
  bash.png         character, 10 frames (poses untouched)
  bash_force.png   holy shield force, 10 frames (gather → crescent → peak → wave → fragments)
  bash_impact.png  contact flash, 8 frames (flash → ring + horizontal shock → debris → fade)

The VFX are only placed, never redrawn: alpha hardened at 128 (crisp pixel clusters, the AI glow haze dropped),
uniform scale per frame. Placement is relative to the character root (feet):
  F4–F6  at that frame's shield front edge (measured from the body mask)
  F7     peak at the shield contact point P (F7's front edge); F8–F10 travel forward from P
Layers: the force sits BEHIND the character (it reads as coming out of the shield), the contact flash in FRONT.

combine(chars) → per frame {'img': combined, 'char': character only (same canvas), 'root': (x, y)}
Usage (standalone sheet + preview): python3 tools/sprites/aurel_bash_vfx.py [src] [out dir]
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, os.path.dirname(__file__))
import bailong as B  # noqa: E402

FORCE_CENTRES = [95, 280, 486, 707, 975, 1235, 1481, 1690, 1890, 2063]
IMPACT_CENTRES = [142, 391, 693, 1013, 1301, 1576, 1820, 2072]

# per character frame (1-based): [(sheet, vfx frame 1-based, scale, anchor, dx, dy, opacity, layer)]
#   anchor 'edge' = this frame's shield front edge (main VFX stays attached to the shield) · 'P' = F7 contact point
#   (dx, dy) source px from the anchor to the VFX's white core · all layers in front of the character, impact over main
# Final visual reference spec: main VFX = holy force from the shield (grows F4–F6, strongest F7, breaks F8–F9);
# impact VFX = the collision only (peak F7 slightly in front of the shield, residual F8) · reach ≈ 1 hero width
PLAN = {
    1: [],
    2: [('force', 1, 0.12, 'edge', 2, 0, 0.6, 'front')],                       # 1–2 faint pixels at the rim
    3: [('force', 1, 0.2, 'edge', 2, 0, 0.7, 'front')],                        # tiny rim glow
    4: [('force', 1, 0.38, 'edge', 4, 0, 1.0, 'front')],                       # energy compressing on the front edge
    5: [('force', 2, 0.5, 'edge', 14, 0, 1.0, 'front')],                       # brighter, short streak, close
    6: [('force', 3, 0.8, 'edge', 42, 0, 1.0, 'front')],                       # main VFX spawns (early growth)
    7: [('force', 5, 0.95, 'edge', 92, -20, 1.0, 'front'),                      # CONTACT: main strongest
        ('impact', 3, 0.8, 'P', 165, 0, 1.0, 'front')],                        #   + impact peak where the enemy is
    8: [('force', 6, 0.9, 'edge', 110, 0, 1.0, 'front'),                       # main breaking apart
        ('impact', 5, 0.66, 'P', 165, 0, 0.9, 'front')],                       #   residual impact (decaying)
    9: [('force', 9, 0.7, 'edge', 80, 0, 0.8, 'front')],                       # few fading sparks
    10: [('force', 10, 0.5, 'edge', 60, 0, 0.45, 'front')],                    # 1–2 residual pixels
}
CANVAS = (1100, 700)
ROOT = (300, 520)


def vfx_frames(name, centres):
    strip, meta = B.cut_vfx(name, [(110, 640, centres)], 'center', 1.0, min_alpha=48)
    a = np.array(strip)
    a[a[..., 3] < 128] = 0                 # crisp: no translucent haze, no anti-aliased glow edge
    a[a[..., 3] >= 128, 3] = 255
    W = meta['w']
    out = []
    for k in range(len(centres)):
        c = a[:, k * W:(k + 1) * W]
        wh = (c[..., 3] > 0) & (c[..., :3].min(-1) > 235)
        ys, xs = np.nonzero(wh if wh.sum() > 20 else c[..., 3] > 0)
        out.append({'img': c, 'core': (float(xs.mean()), float(ys.mean()))})
    return out


def front_edge(img):
    """shield front edge: rightmost point of the body mask (sword / wind streaks opened away) at shield height"""
    m = ndimage.binary_opening(img[..., 3] >= 128, structure=np.ones((13, 13)))
    ys, xs = np.nonzero(m)
    top, bot = ys.min(), ys.max()
    band = (ys > top + 0.2 * (bot - top)) & (ys < top + 0.75 * (bot - top))
    xmax = xs[band].max()
    return float(xmax), float(np.median(ys[band & (xs >= xmax - 8)]))


def place(canvas, fx, scale, at, opacity):
    img = Image.fromarray(fx['img'])
    w, h = round(img.width * scale), round(img.height * scale)
    img = img.resize((w, h), Image.NEAREST)            # nearest: the clusters stay pixel-crisp, no smoothing
    a = np.array(img)
    if opacity < 1:
        # fade by thinning the clusters (ordered dither), not by translucency — stays crisp pixel art
        bayer = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16
        th = np.tile(bayer, (h // 4 + 1, w // 4 + 1))[:h, :w]
        a[th >= opacity, 3] = 0
    cx, cy = fx['core']
    canvas.alpha_composite(Image.fromarray(a), (round(at[0] - cx * scale), round(at[1] - cy * scale)))


def combine(chars, with_impact=False):
    fx = {'force': vfx_frames('bash_force', FORCE_CENTRES), 'impact': vfx_frames('bash_impact', IMPACT_CENTRES)}
    rel = []
    for fr in chars:
        ex, ey = front_edge(fr['img'])
        rel.append((ex - fr['root'][0], ey - fr['root'][1]))
    P = rel[6]
    out = []
    for i, fr in enumerate(chars):
        rx, ry = fr['root']
        char = Image.new('RGBA', CANVAS, (0, 0, 0, 0))
        char.alpha_composite(Image.fromarray(fr['img']), (round(ROOT[0] - rx), round(ROOT[1] - ry)))
        back = Image.new('RGBA', CANVAS, (0, 0, 0, 0))
        front = Image.new('RGBA', CANVAS, (0, 0, 0, 0))
        for sheet, k, sc, anchor, dx, dy, op, layer in PLAN[i + 1]:
            base = rel[i] if anchor == 'edge' else P
            place(back if layer == 'back' else front, fx[sheet][k - 1], sc,
                  (ROOT[0] + base[0] + dx, ROOT[1] + base[1] + dy), op)
        full = back.copy()
        full.alpha_composite(char)
        full.alpha_composite(front)
        out.append({'img': np.array(full), 'char': np.array(char), 'root': ROOT})
    return out


# game FX: the 8-frame contact burst, cut at the character's pixel scale so its star sits at shield height when its
# dust stands on the target's feet (FX scale 1/FX_SCALE → 1 strip px = 1 sheet px on the board)
IMPACT_CUT = 0.25


def impact_strip(out_dir):
    strip, meta = B.cut_vfx('bash_impact', [(110, 640, IMPACT_CENTRES)], 'bottom', 1.0, min_alpha=48)
    a = np.array(strip)
    a[a[..., 3] < 128] = 0
    a[a[..., 3] >= 128, 3] = 255
    W, H, n = meta['w'], meta['h'], len(IMPACT_CENTRES)
    w, h = round(W * IMPACT_CUT), round(H * IMPACT_CUT)
    out = Image.new('RGBA', (w * n, h), (0, 0, 0, 0))
    for k in range(n):
        f = Image.fromarray(a[:, k * W:(k + 1) * W]).convert('RGBa').resize((w, h), Image.BOX).convert('RGBA')
        f = np.array(f)
        f[f[..., 3] < 128] = 0                 # crisp pixel edges after the area downscale (like the character)
        f[f[..., 3] >= 128, 3] = 255
        out.paste(Image.fromarray(f), (k * w, 0))
    out.save(f'{out_dir}/fx-aurel-shield-bash-hit.png', optimize=True)
    return {'frames': n, 'w': w, 'h': h, 'pivot': [0.5, round((H - 2) / H, 3)]}


def main():
    import aurel_v2 as A
    src = sys.argv[1] if len(sys.argv) > 1 else 'art/incoming/aurel'
    out_dir = sys.argv[2] if len(sys.argv) > 2 else '.'
    B.SRC = src
    frames = combine(A.sheet_frames('bash', [5, 5], False), with_impact=True)
    # uniform cells around the union of every frame, root at the same spot in every cell
    union = np.zeros(CANVAS[::-1], bool)
    for f in frames:
        union |= f['img'][..., 3] > 0
    ys, xs = np.nonzero(union)
    pad = 12
    x0, x1, y0, y1 = xs.min() - pad, xs.max() + pad, ys.min() - pad, ys.max() + pad
    cw, ch = x1 - x0, y1 - y0
    sheet = Image.new('RGBA', (cw * 5, ch * 2), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.alpha_composite(Image.fromarray(f['img'][y0:y1, x0:x1]), ((i % 5) * cw, (i // 5) * ch))
    sheet.save(f'{out_dir}/aurel_shield_bash_combined.png', optimize=True)
    mag = Image.new('RGBA', sheet.size, (255, 0, 255, 255))
    mag.alpha_composite(sheet)
    mag.convert('RGB').save(f'{out_dir}/aurel_shield_bash_combined_magenta.png', optimize=True)
    print({'cell': (int(cw), int(ch)), 'root_in_cell': (int(ROOT[0] - x0), int(ROOT[1] - y0)), 'sheet': sheet.size})
    return frames, (x0, y0, x1, y1)


if __name__ == '__main__':
    main()
