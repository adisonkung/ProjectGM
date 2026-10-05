"""Aurel — Guardian Rush: character clip (rush.png, 2 × 6) + the supplied main / impact VFX → one combined clip.

Sources (art/incoming/aurel, not committed):
  rush.png         character, 12 frames (poses untouched)
  rush_main.png    holy force wrapping the shield + wake behind, 12 frames (spark → wedge → peak F7 → fragments)
  rush_impact.png  collision burst, 8 frames (flash → peak F3 → crescent ring → streaks → dust → fade)

Final visual reference spec: the main VFX travels WITH Aurel — its front (the shield wedge) is pinned just ahead of
each frame's shield edge and its dust stands on the ground, the wake trails behind him; the impact appears only at the
collision (peak F8, aftershock F9) slightly in front of the shield. Same rules as aurel_bash_vfx.py: VFX only placed,
never redrawn · alpha >= 128 opaque · nearest scaling · fades by ordered dither.

combine(chars) → per frame {'img', 'char', 'root'} (aurel_v2.py builds the atlas row from it)
Usage (standalone reference sheet): python3 tools/sprites/aurel_rush_vfx.py [src] [out dir]
"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import bailong as B  # noqa: E402
from aurel_bash_vfx import front_edge, vfx_frames  # noqa: E402

MAIN_CENTRES = [76, 200, 347, 521, 705, 915, 1160, 1412, 1611, 1796, 1944, 2085]
IMPACT_CENTRES = [125, 364, 695, 1032, 1318, 1580, 1827, 2052]

# per character frame (1-based): [(sheet, vfx frame, scale, anchor, mode, dx, dy, opacity)]
#   anchor 'edge' = this frame's shield front edge · 'P' = F8 collision point (shield edge on the contact pose)
#   mode 'core'  = the VFX's white core on the point
#        'wrap'  = the VFX's front (right edge) on the point x, its core on the shield's height → the wedge hugs the
#                  shield, the wake runs back along Aurel
#   layers: main VFX BEHIND the character (wedge shows around / ahead of the shield, the wake behind his silhouette,
#   body stays readable) · impact in FRONT
PLAN = {
    1: [],
    2: [('main', 1, 0.22, 'edge', 'core', 2, 0, 0.6)],                         # 1–2 faint pixels on the rim
    3: [('main', 1, 0.4, 'edge', 'core', 4, 0, 1.0)],                          # thin rim + tiny sparks
    4: [('main', 2, 0.7, 'edge', 'wrap', 30, 0, 1.0)],                         # force compressing on the shield
    5: [('main', 3, 0.92, 'edge', 'wrap', 48, 0, 1.0)],                        # drive start: attached, dust behind
    6: [('main', 5, 1.05, 'edge', 'wrap', 62, 0, 1.0)],                        # rush start: wrap + short wake
    7: [('main', 6, 1.12, 'edge', 'wrap', 68, 0, 1.0)],                        # full rush: one moving object
    8: [('main', 7, 1.18, 'edge', 'wrap', 72, 0, 1.0),                         # COLLISION: main max
        ('impact', 3, 0.62, 'P', 'core', 165, 0, 1.0)],                        #   + impact peak in front of the shield
    9: [('main', 8, 1.05, 'edge', 'wrap', 52, 0, 1.0),                         # aftershock: main breaking
        ('impact', 5, 0.55, 'P', 'core', 170, 0, 0.85)],                       #   fading pressure streaks
    10: [('main', 9, 0.9, 'edge', 'wrap', 30, 0, 0.85)],                       # brake: fragments + dust
    11: [('main', 11, 0.66, 'edge', 'wrap', 8, 0, 0.55)],                      # residual particles
    12: [],
}
# source px behind the shield's front edge where the main VFX switches from over Aurel to behind him: only the
# wedge ahead of the shield rim is drawn over him — the shield itself stays readable
SHIELD_W = 18
# the wedge's core sits this much above the measured front-edge point (= the shield's centre line)
WRAP_DY = -14
CANVAS = (1100, 700)
ROOT = (420, 560)


def bbox(a):
    ys, xs = np.nonzero(a[..., 3] > 0)
    return xs.min(), xs.max(), ys.min(), ys.max()


def place(canvas, fx, scale, at, mode, opacity, ground):
    img = Image.fromarray(fx['img'])
    w, h = round(img.width * scale), round(img.height * scale)
    a = np.array(img.resize((w, h), Image.NEAREST))
    if opacity < 1:
        bayer = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16
        a[np.tile(bayer, (h // 4 + 1, w // 4 + 1))[:h, :w] >= opacity, 3] = 0
    x0, x1, y0, y1 = bbox(a)
    cx, cy = fx['core'][0] * scale, fx['core'][1] * scale
    if mode == 'core':
        px, py = at[0] - cx, at[1] - cy
    else:  # wrap
        px, py = at[0] - x1, at[1] + WRAP_DY - cy
    canvas.alpha_composite(Image.fromarray(a), (round(px), round(py)))


def combine(chars, with_impact=True):
    fx = {'main': vfx_frames('rush_main', MAIN_CENTRES), 'impact': vfx_frames('rush_impact', IMPACT_CENTRES)}
    rel = []
    for fr in chars:
        ex, ey = front_edge(fr['img'])
        rel.append((ex - fr['root'][0], ey - fr['root'][1]))
    P = rel[7]
    out = []
    for i, fr in enumerate(chars):
        rx, ry = fr['root']
        char = Image.new('RGBA', CANVAS, (0, 0, 0, 0))
        char.alpha_composite(Image.fromarray(fr['img']), (round(ROOT[0] - rx), round(ROOT[1] - ry)))
        main = Image.new('RGBA', CANVAS, (0, 0, 0, 0))
        hit = Image.new('RGBA', CANVAS, (0, 0, 0, 0))
        for sheet, k, sc, anchor, mode, dx, dy, op in PLAN[i + 1]:
            if sheet == 'impact' and not with_impact:
                continue
            base = rel[i] if anchor == 'edge' else P
            place(hit if sheet == 'impact' else main, fx[sheet][k - 1], sc,
                  (ROOT[0] + base[0] + dx, ROOT[1] + base[1] + dy), mode, op, ROOT[1] + 2 + dy)
        # main VFX split at the back of the shield: the wedge around the shield is drawn OVER Aurel (bright shield-front
        # aura), the wake behind that line goes BEHIND him (body silhouette stays readable)
        split = round(ROOT[0] + rel[i][0] - SHIELD_W)
        m = np.array(main)
        behind, over = m.copy(), m.copy()
        behind[:, split:] = 0
        over[:, :split] = 0
        full = Image.fromarray(behind)
        full.alpha_composite(char)
        full.alpha_composite(Image.fromarray(over))
        full.alpha_composite(hit)
        out.append({'img': np.array(full), 'char': np.array(char), 'root': ROOT})
    return out


def main():
    import aurel_v2 as A
    src = sys.argv[1] if len(sys.argv) > 1 else 'art/incoming/aurel'
    out_dir = sys.argv[2] if len(sys.argv) > 2 else '.'
    B.SRC = src
    frames = combine(A.sheet_frames('rush', [6, 6], False))
    union = np.zeros(CANVAS[::-1], bool)
    for f in frames:
        union |= f['img'][..., 3] > 0
    ys, xs = np.nonzero(union)
    pad = 12
    x0, x1, y0, y1 = xs.min() - pad, xs.max() + pad, ys.min() - pad, ys.max() + pad
    cw, ch = x1 - x0, y1 - y0
    sheet = Image.new('RGBA', (cw * 6, ch * 2), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.alpha_composite(Image.fromarray(f['img'][y0:y1, x0:x1]), ((i % 6) * cw, (i // 6) * ch))
    sheet.save(f'{out_dir}/aurel_guardian_rush_combined.png', optimize=True)
    mag = Image.new('RGBA', sheet.size, (255, 0, 255, 255))
    mag.alpha_composite(sheet)
    mag.convert('RGB').save(f'{out_dir}/aurel_guardian_rush_combined_magenta.png', optimize=True)
    print({'cell': (int(cw), int(ch)), 'root_in_cell': (int(ROOT[0] - x0), int(ROOT[1] - y0)), 'sheet': sheet.size})


if __name__ == '__main__':
    main()
