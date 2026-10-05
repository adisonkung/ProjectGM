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
#   anchor 'edge' = this frame's shield front edge · 'P' = F7 contact point (the wave keeps travelling from there)
#   (dx, dy) source px from the anchor to the VFX's white core
PLAN = {
    1: [], 2: [], 3: [],
    4: [('force', 1, 0.55, 'edge', 6, 0, 0.85, 'back')],
    5: [('force', 2, 0.66, 'edge', 22, 0, 1.0, 'back')],
    6: [('force', 3, 0.74, 'edge', 46, 0, 1.0, 'back'), ('impact', 1, 0.62, 'edge', 22, 0, 1.0, 'front')],
    7: [('force', 5, 0.72, 'P', 72, 0, 1.0, 'back'), ('impact', 3, 0.78, 'P', 44, 0, 1.0, 'front')],
    8: [('force', 6, 0.74, 'P', 92, 0, 1.0, 'front'), ('impact', 4, 0.78, 'P', 40, 0, 1.0, 'front')],
    9: [('force', 7, 0.72, 'P', 96, 0, 0.95, 'front'), ('impact', 6, 0.72, 'P', 36, 0, 0.9, 'front')],
    10: [('force', 9, 0.62, 'P', 112, 0, 0.7, 'front'), ('impact', 8, 0.62, 'P', 40, 0, 0.6, 'front')],
}
CANVAS = (980, 640)
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


def combine(chars):
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
            place(back if layer == 'back' else front, fx[sheet][k - 1], sc, (ROOT[0] + base[0] + dx, ROOT[1] + base[1] + dy), op)
        full = back.copy()
        full.alpha_composite(char)
        full.alpha_composite(front)
        out.append({'img': np.array(full), 'char': np.array(char), 'root': ROOT})
    return out


def main():
    import aurel_v2 as A
    src = sys.argv[1] if len(sys.argv) > 1 else 'art/incoming/aurel'
    out_dir = sys.argv[2] if len(sys.argv) > 2 else '.'
    B.SRC = src
    frames = combine(A.sheet_frames('bash', [5, 5], False))
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
