"""Draeven S1 Blood Debt VFX (user 2026-10-26). Never modifies the source PNGs.

python3 tools/sprites/draeven_s1_vfx.py [source dir] [out dir]
Sources (assets/heroes/Draeven/vfx/, 8 frames in one row on a magenta key, 2172 × 724 each):
  Draeven_S1_TauntActivation_VFX.png    → fx-draeven-s1-activation.png  (one shot when the taunt lands)
  Draeven_S1_TauntLoop_VFX.png          → fx-draeven-s1-loop.png        (Blood Debt status loop)
  Draeven_S1_CrimsonSpikeEruption_VFX.png → fx-draeven-s1-eruption.png  (Blood Reprisal burst)

All three spawn on Draeven's ground pivot (centre of the feet). Each frame is aligned so the centre of its ground ring
(the widest row of the lower part of the frame) lands on the strip pivot; the size is set from the ring of the peak
frame (TARGET = ring width in atlas px; 80 atlas px = one board cell). Baked at RES × atlas px — FxDef scale 1/3 with
FX_SCALE 1.5 draws 1 baked px = 1/RES atlas px.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

N, RES = 8, 2
SHEETS = {
    # name: (source, out, ring width of the peak frame in atlas px, peak frame)
    'activation': ('Draeven_S1_TauntActivation_VFX.png', 'fx-draeven-s1-activation.png', 118, 4),
    'loop': ('Draeven_S1_TauntLoop_VFX.png', 'fx-draeven-s1-loop.png', 104, 4),
    # the spikes fan out sideways around him — the peak spread ~2.7 cells (Blood Reprisal reaches 1 cell around him)
    'eruption': ('Draeven_S1_CrimsonSpikeEruption_VFX.png', 'fx-draeven-s1-eruption.png', 170, 4),
}


def unmix(rgb: np.ndarray) -> np.ndarray:
    rgb = rgb.astype(float)
    bg = np.median(rgb[:6].reshape(-1, 3), 0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    al = np.clip(1 - (np.minimum(r, b) - g) / (min(bg[0], bg[2]) - bg[1]), 0, 1)
    al = np.where(al < 0.1, 0, al)
    col = np.clip((rgb - (1 - al[..., None]) * bg) / np.maximum(al[..., None], 1e-3), 0, 255)
    # magenta spill on the soft edges: pull blue down to the red/green balance of a red glow
    col[..., 2] = np.minimum(col[..., 2], np.maximum(col[..., 1], col[..., 0] * 0.55))
    return np.dstack([col, al * 255])


def clean(a: np.ndarray) -> np.ndarray:
    m = a > 25
    lab, n = ndimage.label(ndimage.binary_dilation(m, iterations=6))
    if n:
        sizes = ndimage.sum(m, lab, range(1, n + 1))
        keep = np.isin(lab, 1 + np.nonzero(sizes >= 40)[0])
        a = np.where(keep, a, 0)
    return a


def ring(a: np.ndarray):
    """centre (x, y) and width of the ground ring: the widest alpha row in the lower half of the drawn frame"""
    rows = np.nonzero((a > 60).any(1))[0]
    top, bot = rows.min(), rows.max()
    best = (0, bot, 0, 0)
    for y in range(int(top + (bot - top) * 0.5), bot + 1):
        xs = np.nonzero(a[y] > 60)[0]
        if len(xs) and xs[-1] - xs[0] > best[0]:
            best = (xs[-1] - xs[0], y, xs[0], xs[-1])
    w, y, x0, x1 = best
    return (x0 + x1) / 2, y, w


def build(src: Path, out: Path, target: float, peak: int):
    im = unmix(np.array(Image.open(src).convert('RGB')))
    im[-30:] = 0  # noisy bottom edge of the key
    h, W = im.shape[:2]
    slot = W / N
    frames, rings = [], []
    for k in range(N):
        part = im[:, int(round(k * slot)):int(round((k + 1) * slot))].copy()
        part[..., 3] = clean(part[..., 3])
        frames.append(part)
        rings.append(ring(part[..., 3]))
    scale = target * RES / rings[peak][2]
    # one ground line for the whole strip, from the small first/last frames (there the widest row is the ring itself)
    ry = float(np.median([rings[k][1] for k in (0, 1, N - 2, N - 1)]))
    placed = []
    for f, (cx, _, _) in zip(frames, rings):
        img = Image.fromarray(np.clip(f, 0, 255).astype(np.uint8), 'RGBA')
        sw, sh = int(round(img.width * scale)), int(round(img.height * scale))
        img = img.resize((sw, sh), Image.LANCZOS)
        placed.append((img, cx * scale, ry * scale))
    # common cell around the pivot
    left = max(px for _, px, _ in placed); right = max(i.width - px for i, px, _ in placed)
    up = max(py for _, _, py in placed); down = max(i.height - py for i, _, py in placed)
    boxes = [i.getbbox() for i, _, _ in placed]
    left = max(px - b[0] for (i, px, py), b in zip(placed, boxes) if b)
    right = max(b[2] - px for (i, px, py), b in zip(placed, boxes) if b)
    up = max(py - b[1] for (i, px, py), b in zip(placed, boxes) if b)
    down = max(b[3] - py for (i, px, py), b in zip(placed, boxes) if b)
    half = int(np.ceil(max(left, right))) + 2
    cw, ch = 2 * half, int(np.ceil(up + down)) + 4
    top = int(np.ceil(up)) + 2
    strip = Image.new('RGBA', (cw * N, ch))
    for k, (img, px, py) in enumerate(placed):
        strip.alpha_composite(img, (int(round(k * cw + half - px)), int(round(top - py))))
    strip.save(out, optimize=True)
    return {'frames': N, 'w': cw, 'h': ch, 'pivot': [0.5, round(top / ch, 4)], 'scale': round(scale, 4),
            'ringPeak': rings[peak][2]}


def main():
    src = Path(sys.argv[1] if len(sys.argv) > 1 else 'assets/heroes/Draeven/vfx')
    out = Path(sys.argv[2] if len(sys.argv) > 2 else 'public/sprites')
    out.mkdir(parents=True, exist_ok=True)
    for name, (s, o, target, peak) in SHEETS.items():
        print(name, build(src / s, out / o, target, peak))


if __name__ == '__main__':
    main()
