"""Mordrienne Vale — S2 Cinderbind Hex VFX bake for the Timeline Sync (user 2026-10-26). Never modifies the sources.

python3 tools/sprites/mordrienne_s2_vfx.py [source dir] [out dir]
Sources (assets/heroes/Mordrienne/vfx/, one row on a magenta key, pixel art):
  Mordrienne_S2_GroundHexSpawn_VFX.png     9 frames → fx-mordrienne-s2-spawn.png  (small ring f1 → full hex f7 → settle)
  Mordrienne_S2_GroundHexLoop_VFX.png      8 frames → fx-mordrienne-s2-loop.png   (charging hex, one breathing cycle)
  Mordrienne_S2_HexActivationBurst_VFX.png 8 frames → fx-mordrienne-s2-burst.png  (eruption f1–f3 peak → decay f8)
  Mordrienne_S1_CastCharge_VFX.png         reused  → fx-mordrienne-s2-tip.png    (green flash on the wand tip, each strike)

No resampling: every frame is copied at the artist's pixel size (drawn pixelated at runtime). One ground pivot per
sheet = the centre of the hex ring on the ground plane (spawn / loop: the star centre on the horizontal star line;
burst: the centre of the lower ring ellipse), so the three play on the SAME world point with the SAME ring diameter:
the FxDef scale of each sheet maps its ring to RING_ATLAS atlas px (≈ 1.9 cells = the 2 × 2 footprint).
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).parent))
from mordrienne_s1_vfx import unmix, cut as cut_s1, cells_around, strip, width_of  # noqa: E402

FX_SCALE = 1.5
RES = 2
TIP_PX = 36  # wand-tip strike flash at its peak (atlas px) — the S1 CastCharge sigil, the same Deep Emerald
RING_ATLAS = 150  # hex-ring diameter on the board (atlas px, 80 px = 1 cell)

# per sheet: frame x centres (source px, read off the sheets), the ground line y (ring centre), the ring diameter
# (source px, measured on the full-size frames), the frame whose star axis gives the pivot x ('star') or fixed centres
SHEETS = {
    'spawn': ('Mordrienne_S2_GroundHexSpawn_VFX.png', [114, 337, 554, 776, 999, 1249, 1510, 1776, 2031], 373, 200, 'star'),
    'loop': ('Mordrienne_S2_GroundHexLoop_VFX.png', [141, 407, 673, 950, 1222, 1493, 1770, 2036], 373, 200, 'star'),
    'burst': ('Mordrienne_S2_HexActivationBurst_VFX.png', [173, 494, 868, 1220, 1542, 1826, 2112, 2374], 466, 250, 'fixed'),
}


def cut(path: Path, centres, ground: int, mode: str):
    """→ [(frame RGBA float, pivot x, pivot y)] in source px. Connected pieces go to the nearest frame centre; pieces
    that join neighbouring frames (smoke) are split column-wise at the midpoints."""
    im = unmix(np.array(Image.open(path).convert('RGB')))
    im[:6] = 0
    im[-6:] = 0
    im[:, :6] = 0
    im[:, -6:] = 0
    al = im[..., 3]
    centres = np.array(centres, float)
    n = len(centres)
    lab, cnt = ndimage.label(ndimage.binary_dilation(al > 20, iterations=2))
    sizes = ndimage.sum(al > 20, lab, range(1, cnt + 1))
    frames = [np.zeros_like(im) for _ in range(n)]
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        if sizes[i - 1] < 10:
            continue
        m = lab[sl] == i
        xs = np.nonzero(m)[1] + sl[1].start
        if ((centres >= xs.min()) & (centres <= xs.max())).sum() > 1:
            cols = np.arange(sl[1].start, sl[1].stop)
            owner = np.argmin(np.abs(cols[:, None] - centres[None]), 1)
            for k in np.unique(owner):
                mk = m & (owner == k)[None, :]
                frames[k][sl] = np.where(mk[..., None], im[sl], frames[k][sl])
            continue
        k = int(np.argmin(np.abs(centres - xs.mean())))
        frames[k][sl] = np.where(m[..., None], im[sl], frames[k][sl])
    out = []
    for k, f in enumerate(frames):
        cx = centres[k]
        if mode == 'star':
            # the vertical star axis: the brightest column near the slot centre
            br = (f[..., 3] > 200) & (f[..., 1] > 150)
            x0 = int(cx - 60)
            colsum = br[ground - 60:ground + 60, x0:x0 + 120].sum(0)
            if colsum.max() > 8:
                cx = x0 + float(np.argmax(colsum))
        out.append((f, cx, float(ground)))
    return out


def bake(frames, out: Path):
    """common canvas around the pivot for every frame (no resampling) → strip; returns the FxDef numbers"""
    half_w = half_up = half_dn = 0
    for f, px, py in frames:
        ys, xs = np.nonzero(f[..., 3] > 8)
        if not len(xs):
            continue
        half_w = max(half_w, px - xs.min(), xs.max() + 1 - px)
        half_up = max(half_up, py - ys.min())
        half_dn = max(half_dn, ys.max() + 1 - py)
    W = 2 * int(np.ceil(half_w)) + 4
    up, dn = int(np.ceil(half_up)) + 2, int(np.ceil(half_dn)) + 2
    H = up + dn
    cells = []
    for f, px, py in frames:
        c = np.zeros((H, W, 4), np.uint8)
        x0, y0 = int(round(px)) - W // 2, int(round(py)) - up
        src = f[max(0, y0):y0 + H, max(0, x0):x0 + W]
        c[max(0, -y0):max(0, -y0) + src.shape[0], max(0, -x0):max(0, -x0) + src.shape[1]] = np.clip(src, 0, 255)
        cells.append(c)
    Image.fromarray(np.hstack(cells), 'RGBA').save(out, optimize=True)
    return {'frames': len(cells), 'w': W, 'h': H, 'pivot': [round((W // 2) / W, 6), round(up / H, 6)]}


def build_tip(src: Path, out: Path):
    """green flash on the wand tip at each strike: the S1 CastCharge sigil (same emerald palette) — f3 → f5 peak held
    → collapse f6–f8 fading. Pivot = the sigil core, baked at RES × atlas px"""
    frames = cut_s1(src / 'Mordrienne_S1_CastCharge_VFX.png')
    cells, W, H = cells_around(frames, TIP_PX * RES / width_of(frames[4][0]))
    seq = [(2, 2, 0, 1.0), (3, 3, 0, 1.0), (4, 4, 0, 1.0), (4, 4, 0, 1.0), (5, 5, 0, 0.95), (6, 6, 0, 0.8),
           (7, 7, 0, 0.6)]
    strip(cells, seq).save(out, optimize=True)
    return {'frames': len(seq), 'w': W, 'h': H, 'scale': round(1 / (FX_SCALE * RES), 5)}


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    src = Path(args[0] if args else 'assets/heroes/Mordrienne/vfx')
    out = Path(args[1] if len(args) > 1 else 'public/sprites')
    out.mkdir(parents=True, exist_ok=True)
    res = {}
    for key, (name, centres, ground, ring, mode) in SHEETS.items():
        r = bake(cut(src / name, centres, ground, mode), out / f'fx-mordrienne-s2-{key}.png')
        # baked px → atlas px = RING_ATLAS / ring; FxDef width % = w · PX_TO_CELL · scale · FX_SCALE
        r['scale'] = round(RING_ATLAS / ring / FX_SCALE, 6)
        res[key] = r
    res['tip'] = build_tip(src, out / 'fx-mordrienne-s2-tip.png')
    print(json.dumps(res, indent=1))


if __name__ == '__main__':
    main()
