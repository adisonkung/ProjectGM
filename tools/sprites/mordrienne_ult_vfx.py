"""Mordrienne Vale — Ult House of Ashes VFX bake for the Timeline Sync (user 2026-10-27). Never modifies the sources.

python3 tools/sprites/mordrienne_ult_vfx.py [source dir] [out dir]
Sources (assets/heroes/Mordrienne/vfx/, one row on a magenta key) — mapping by content:
  Mordrienne_ULT_MagicCircleDraw_VFX.png        8 f (star → broken ring → serpent-skull sigil)  → fx-mordrienne-ult-circle.png
  Mordrienne_ULT_ChargeHold_VFX.png             8 f (inward vortex, peak f5)                    → fx-mordrienne-ult-charge.png
  Mordrienne_ULT_FieldActivationBurst_VFX.png  10 f (small field → eruption f6 → settles)       → fx-mordrienne-ult-burst.png
  Mordrienne_ULT_HouseOfAshesField_Loop_VFX.png 10 f (field + intermittent skull-serpent)        → fx-mordrienne-ult-field.png
                                                 + fade-out at the field end                     → fx-mordrienne-ult-field-end.png

Character clip (sprites.ts hero-mordrienne.png row 7, STEPS below): draw the circle 0.05–1.03 s → raise 1.03 (CHARGE_START)
→ hold 1.21–1.66 → over the head (peak) → wand down 1.84 (release) → ground 2.02 (VFX_SPAWN = activation) → recovery.

* circle: small (pre-scaled, RES × atlas px, pixelated) centred on the circle she draws (atlas 166, 107): grows f1 → f8
  with the drawing, holds the full sigil, fades as she raises the wand (no ground field here)
* charge: small, at the raised wand tip (atlas 136, 48): f1 → f5 over the raise + hold, holds the peak until the release,
  collapses f6 → f8 in 90 ms at the wand-down frame
* burst / field / field-end: the artist's pixels (no resampling), one pivot = the star centre on the ground ring,
  the same scale for all three (ring → RING_ATLAS atlas px ≈ the 3 × 3 field) — the burst's last frames are the loop's
  first look, the loop's f10 → f1 is seamless, the end strip fades from the loop's f1
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from mordrienne_s1_vfx import blend, cells_around, width_of  # noqa: E402
from mordrienne_s2_vfx import cut  # noqa: E402

FX_SCALE, RES = 1.5, 2
STEPS = [50, *[70] * 14, 60, 60, 60, 450, 60, 60, 60, 45, 45, 45, 45, 90, 80, 80, 80, 80]
CAST, CHARGE_START, HOLD, RELEASE, ACTIVATE = 1, 15, 18, 22, 26
at = lambda i: sum(STEPS[:i])  # noqa: E731  ms

CIRCLE_PX = 56     # drawn sigil width at full size (atlas px) ≈ the circle her wand trail draws (~50 px)
CHARGE_PX = 50     # charge vortex width at its peak (atlas px)
RING_SRC = 175     # field ring diameter in the burst / loop sheets (source px)
RING_ATLAS = 200   # on the board: ~0.83 × the 3 × 3 field (80 px = 1 cell) — the skull-serpent stays readable
CIRCLE_MS = 98     # 10 keys from 0.05 s to the raise (1.03 s)
CHARGE_MS = 30

SHEETS = {
    'circle': ('Mordrienne_ULT_MagicCircleDraw_VFX.png', [75, 233, 422, 633, 858, 1098, 1330, 1555], 477, 'star'),
    'charge': ('Mordrienne_ULT_ChargeHold_VFX.png', [132, 392, 657, 927, 1216, 1511, 1781, 2038], 360, 'fixed'),
    'burst': ('Mordrienne_ULT_FieldActivationBurst_VFX.png',
              [98, 282, 472, 679, 891, 1146, 1412, 1656, 1863, 2063], 401, 'star'),
    'field': ('Mordrienne_ULT_HouseOfAshesField_Loop_VFX.png',
              [109, 331, 554, 777, 994, 1211, 1434, 1651, 1868, 2069], 389, 'star'),
}


def save(cells, seq, out: Path):
    H, W = cells[0].shape[:2]
    img = Image.new('RGBA', (W * len(seq), H))
    for i, (a, b, t, alpha) in enumerate(seq):
        img.paste(Image.fromarray(blend(cells[a], cells[b], t, alpha), 'RGBA'), (i * W, 0))
    img.save(out, optimize=True)
    return {'frames': len(seq), 'w': W, 'h': H}


def canvas(frames, extra=2):
    """unresampled common canvas around the pivot (pivot at the horizontal centre) → cells, pivot fraction"""
    hw = up = dn = 0
    for f, px, py in frames:
        ys, xs = np.nonzero(f[..., 3] > 8)
        if len(xs):
            hw = max(hw, px - xs.min(), xs.max() + 1 - px)
            up, dn = max(up, py - ys.min()), max(dn, ys.max() + 1 - py)
    W, U, D = 2 * int(np.ceil(hw)) + 2 * extra, int(np.ceil(up)) + extra, int(np.ceil(dn)) + extra
    H = U + D
    cells = []
    for f, px, py in frames:
        c = np.zeros((H, W, 4), np.float32)
        x0, y0 = int(round(px)) - W // 2, int(round(py)) - U
        src = f[max(0, y0):y0 + H, max(0, x0):x0 + W]
        c[max(0, -y0):max(0, -y0) + src.shape[0], max(0, -x0):max(0, -x0) + src.shape[1]] = np.clip(src, 0, 255)
        cells.append(c)
    return cells, [round((W // 2) / W, 6), round(U / H, 6)]


def small(frames, px_peak, peak):
    """pre-scaled (LANCZOS) cells at RES × atlas px, centred on each frame's pivot"""
    crop = []
    for f, cx, cy in frames:
        ys, xs = np.nonzero(f[..., 3] > 8)
        x0, y0 = xs.min(), ys.min()
        crop.append((f[y0:ys.max() + 1, x0:xs.max() + 1], cx - x0, cy - y0))
    s = px_peak * RES / width_of(crop[peak][0])
    cells, W, H = cells_around(crop, s)
    return cells


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    src = Path(args[0] if args else 'assets/heroes/Mordrienne/vfx')
    out = Path(args[1] if len(args) > 1 else 'public/sprites')
    out.mkdir(parents=True, exist_ok=True)
    fr = {k: cut(src / name, centres, ground, mode) for k, (name, centres, ground, mode) in SHEETS.items()}
    res = {}

    # magic circle: f1 → f8 across the drawing (CAST_START 0.05 → raise 1.03), the full sigil held for the last keys
    cells = small(fr['circle'], CIRCLE_PX, 7)
    seq = [(k, k, 0, 1.0) for k in range(8)] + [(7, 7, 0, 1.0), (7, 7, 0, 0.92)]
    res['circle'] = {**save(cells, seq, out / 'fx-mordrienne-ult-circle.png'), 'frameMs': CIRCLE_MS,
                     'span': [at(CAST), at(CAST) + len(seq) * CIRCLE_MS], 'raise': at(CHARGE_START)}

    # charge: grow f1 → f5 (cross-faded) from CHARGE_START to the end of the hold, hold the peak over the head,
    # collapse f6 → f8 at the release (wand-down) frame
    cells = small(fr['charge'], CHARGE_PX, 4)
    grow = (at(HOLD + 1) - at(CHARGE_START)) // CHARGE_MS
    hold = (at(RELEASE) - at(HOLD + 1)) // CHARGE_MS
    seq = []
    for i in range(grow):
        p = i / max(1, grow - 1) * 4
        a = int(np.floor(p))
        seq.append((a, min(4, a + 1), p - a, 1.0))
    seq += [(4, 4, 0, 1.0)] * hold + [(5, 5, 0, 0.9), (6, 6, 0, 0.7), (7, 7, 0, 0.45)]
    res['charge'] = {**save(cells, seq, out / 'fx-mordrienne-ult-charge.png'), 'frameMs': CHARGE_MS,
                     'peakAt': at(CHARGE_START) + grow * CHARGE_MS, 'collapseAt': at(CHARGE_START) + (grow + hold) * CHARGE_MS,
                     'release': at(RELEASE)}

    # burst + field + end on ONE canvas (same pivot / size) so the hand-off is pixel-exact
    both = fr['burst'] + fr['field']
    cells, pivot = canvas(both)
    burst, field = cells[:10], cells[10:]
    H, W = cells[0].shape[:2]
    save(burst, [(k, k, 0, 1.0) for k in range(10)], out / 'fx-mordrienne-ult-burst.png')
    save(field, [(k, k, 0, 1.0) for k in range(10)], out / 'fx-mordrienne-ult-field.png')
    # end: the loop's f1 (no skull) with the rune glow / smoke thinning, embers going out
    end = [(0, 0, 0, a) for a in (0.92, 0.8, 0.66, 0.52, 0.38, 0.26, 0.15, 0.07)]
    save(field, end, out / 'fx-mordrienne-ult-field-end.png')
    res['field'] = {'w': W, 'h': H, 'pivot': pivot, 'scale': round(RING_ATLAS / RING_SRC / FX_SCALE, 6),
                    'frames': {'burst': 10, 'field': 10, 'end': len(end)}}
    print(json.dumps(res, indent=1))


if __name__ == '__main__':
    main()
