"""Draeven Ultimate — Blood Dominion VFX (user 2026-10-26). Never modifies the source PNGs.

python3 tools/sprites/draeven_ult_vfx.py [source dir] [out dir]
Sources (assets/heroes/Draeven/vfx/, 8 frames in one row on a magenta key, 2172 × 724 each):
  Draeven_ULT_ChargeAura_VFX.png         → fx-draeven-ult-body.png      crimson-black aura around him (charge)
  Draeven_ULT_SwordCharge_VFX.png        → fx-draeven-ult-sword.png     aura coil along the blade only (no sword drawn)
  Draeven_ULT_FinalImpactBurst_VFX.png   → fx-draeven-ult-impact.png    ground detonation, F1 = max size, then decay
  Draeven_ULT_BloodDominion_Loop_VFX.png → fx-draeven-ult-dominion.png  Blood Dominion status loop
(The earlier draeven_ult_charge_aura.png stays tracked but is replaced by these — user 2026-10-26.)

Frames are cut by connected pieces (nothing clipped at a slot edge). Body aura / dominion loop / impact: every frame on its
ground-ring centre = the ground pivot. Sword aura: the coil's long axis (PCA of the biggest frame) is turned onto the
blade of the charge-hold pose (atlas row 7 step 15: tip (127, 60) → hilt (167, 67)) and scaled to BLADE_COVER × the
blade length; every frame (its own coil centroid) is centred on the blade centre. Baked at RES × atlas px (FxDef scale 1/3 = 1 atlas px).
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from draeven_s1_vfx import RES, ring, unmix  # noqa: E402
from draeven_s2_vfx import pieces, runs, to_img  # noqa: E402

N = 8
CELL = 80
BODY_RING = 108             # body aura ring (biggest frame f7) in atlas px — around his feet, he stays visible
DOMINION_RING = 104         # loop ring, like the S1 taunt loop
IMPACT_W = 2.6 * CELL       # final impact F1 spread — over the 2 × 3 cells in front
# final impact: F1 max at once, F1–F3 over 0.2 s, decay F4–F6 to 0.45 s, residual F7–F8 to 0.7 s (50 ms frames)
IMPACT_SEQ = [0, 0, 1, 2, 3, 3, 4, 4, 5, 6, 6, 6, 7, 7]
BLADE = ((127, 60), (167, 67))  # tip → hilt in the atlas cell (hold pose)
BLADE_COVER = 1.55


def ground_strip(frames, target, peak, seq=None, ground=(0, 1, N - 2, N - 1)):
    rings = [ring(f[..., 3]) for f in frames]
    scale = target * RES / rings[peak][2]
    ry = float(np.median([rings[k][1] for k in ground]))
    placed = []
    for f, (cx, _, _) in zip(frames, rings):
        img = to_img(f, scale)
        placed.append((img, cx * scale, ry * scale, img.getbbox()))
    half = int(np.ceil(max(max(px - b[0], b[2] - px) for _, px, _, b in placed))) + 2
    up = max(py - b[1] for _, _, py, b in placed)
    down = max(b[3] - py for _, _, py, b in placed)
    cw, ch, top = 2 * half, int(np.ceil(up + down)) + 4, int(np.ceil(up)) + 2
    order = seq or list(range(len(frames)))
    strip = Image.new('RGBA', (cw * len(order), ch))
    for k, f in enumerate(order):
        img, px, py, _ = placed[f]
        strip.alpha_composite(img, (int(round(k * cw + half - px)), int(round(top - py))))
    return strip, {'frames': len(order), 'w': cw, 'h': ch, 'pivot': [0.5, round(top / ch, 4)], 'scale': round(scale, 4)}


def load(path: Path):
    im = unmix(np.array(Image.open(path).convert('RGB')))
    im[-30:] = 0
    return pieces(im, [(a + b) / 2 for a, b in runs(im)])


def sword(frames):
    big = frames[-2]  # f7, the fullest coil
    ys, xs = np.nonzero(big[..., 3] > 60)
    cx, cy = xs.mean(), ys.mean()
    ev, evec = np.linalg.eigh(np.cov(np.vstack([xs - cx, ys - cy])))
    ax = evec[:, np.argmax(ev)]
    proj = (xs - cx) * ax[0] + (ys - cy) * ax[1]
    length = np.percentile(proj, 99) - np.percentile(proj, 1)
    (tx, ty), (hx, hy) = BLADE
    blade_len = np.hypot(hx - tx, hy - ty)
    scale = BLADE_COVER * blade_len * RES / length
    rot = np.degrees(np.arctan2(ax[1], ax[0])) - np.degrees(np.arctan2(hy - ty, hx - tx))
    out = []
    for f in frames:
        # each frame is drawn in its own slot: centre it on its own coil (alpha-weighted centroid)
        a = f[..., 3].astype(float)
        fy, fx = np.nonzero(a > 60)
        fcx, fcy = (fx.mean(), fy.mean()) if len(fx) else (cx, cy)
        img = Image.fromarray(np.clip(f, 0, 255).astype(np.uint8), 'RGBA')
        pad = Image.new('RGBA', (1400, 1400))
        pad.paste(img, (int(700 - fcx), int(700 - fcy)))
        r = pad.rotate(rot, resample=Image.BICUBIC, center=(700, 700))
        n = int(round(1400 * scale))
        out.append(r.resize((n, n), Image.LANCZOS))
    c = out[0].size[0] / 2
    box = None
    for f in out:
        bb = f.getbbox()
        if bb:
            box = bb if box is None else (min(box[0], bb[0]), min(box[1], bb[1]), max(box[2], bb[2]), max(box[3], bb[3]))
    hw = int(np.ceil(max(c - box[0], box[2] - c))) + 2
    hh = int(np.ceil(max(c - box[1], box[3] - c))) + 2
    cells = [f.crop((int(c - hw), int(c - hh), int(c + hw), int(c + hh))) for f in out]
    W, H = cells[0].size
    strip = Image.new('RGBA', (W * N, H))
    for i, cell in enumerate(cells):
        strip.paste(cell, (i * W, 0))
    centre = ((tx + hx) / 2, (ty + hy) / 2)
    return strip, {'frames': N, 'w': W, 'h': H, 'pivot': [0.5, 0.5], 'rotate': round(float(rot), 1),
                   'scale': round(float(scale), 4), 'bladeCentre': centre}


def main():
    src = Path(sys.argv[1] if len(sys.argv) > 1 else 'assets/heroes/Draeven/vfx')
    out = Path(sys.argv[2] if len(sys.argv) > 2 else 'public/sprites')
    out.mkdir(parents=True, exist_ok=True)
    s, m = ground_strip(load(src / 'Draeven_ULT_ChargeAura_VFX.png'), BODY_RING, 6, ground=(0, 1, 2))
    s.save(out / 'fx-draeven-ult-body.png', optimize=True); print('body', m)
    s, m = sword(load(src / 'Draeven_ULT_SwordCharge_VFX.png'))
    s.save(out / 'fx-draeven-ult-sword.png', optimize=True); print('sword', m)
    s, m = ground_strip(load(src / 'Draeven_ULT_FinalImpactBurst_VFX.png'), IMPACT_W, 0, IMPACT_SEQ, ground=(5, 6, 7))
    s.save(out / 'fx-draeven-ult-impact.png', optimize=True); print('impact', m)
    s, m = ground_strip(load(src / 'Draeven_ULT_BloodDominion_Loop_VFX.png'), DOMINION_RING, 3)
    s.save(out / 'fx-draeven-ult-dominion.png', optimize=True); print('dominion', m)


if __name__ == '__main__':
    main()
