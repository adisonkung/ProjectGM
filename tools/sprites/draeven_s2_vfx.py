"""Draeven S2 Sovereign's Reprisal VFX (user 2026-10-26). Never modifies the source PNGs.

python3 tools/sprites/draeven_s2_vfx.py [source dir] [out dir]
Sources (assets/heroes/Draeven/vfx/, 8 frames in one row on a magenta key):
  Draeven_S2_Charge_VFX.png      (2172 × 724) → fx-draeven-s2-charge.png  ground ring + crimson swirl around him
  Draeven_S2_CrimsonWave_VFX.png (2508 × 627) → fx-draeven-s2-wave.png    the slash on the column in front of him
No separate impact VFX (user: cancelled).

Charge: every frame on its ground-ring centre = his ground pivot (same method as draeven_s1_vfx.py).
Wave: F1 is the biggest (the sword has already swung — no build-up), then it shrinks away IN PLACE (user 2026-10-26
review: no travel — it stays put and fades). Review 2: the slash sits ONE cell ahead — centred on the middle of the
front cell (his lane), F1 two cells tall so it reaches half-way into the lanes above and below (the damage column:
up / front / down). Every frame keeps its box centre on that point (WAVE_CX ahead of the feet, WAVE_CY above them). Baked at RES × atlas px — FxDef scale 1/3 (× FX_SCALE 1.5) = 1/RES atlas px.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).parent))
from draeven_s1_vfx import RES, clean, ring, unmix  # noqa: E402

N = 8
CHARGE_RING = 112      # ring width of the peak frame (f7) in atlas px — ~1.4 cells around his feet
CHARGE_PEAK = 6
CELL = 80              # atlas px per board cell
WAVE_H = 2 * CELL      # F1 height: half of the lane above + the front cell + half of the lane below
WAVE_CX = CELL         # centre of the front cell, ahead of his feet
WAVE_CY = 0.2725 * CELL  # the cell centre above the feet (feet sit at dy 27.25 % of a cell)
# drawn frame centres along the wave sheet (the small late frames break into pieces, so they are given, not searched)
WAVE_CENTRES = [272, 700, 1045, 1358, 1640, 1905, 2165, 2412]


def pieces(im: np.ndarray, centres) -> list:
    """every connected piece goes to the drawn frame whose centre is nearest — nothing is cut at a slot edge"""
    al = im[..., 3]
    lab, n = ndimage.label(ndimage.binary_dilation(al > 25, iterations=2))
    owner = np.zeros(n + 1, int)
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        xs = np.nonzero(lab[sl] == i)[1] + sl[1].start
        owner[i] = int(np.argmin(np.abs(np.asarray(centres) - xs.mean())))
    out = []
    for k in range(len(centres)):
        part = np.where(((lab > 0) & (owner[lab] == k))[..., None], im, 0)
        part[..., 3] = clean(part[..., 3])
        out.append(part)
    return out


def runs(im: np.ndarray):
    cols = im[..., 3].max(0) > 25
    out, x, W = [], 0, len(cols)
    while x < W:
        if cols[x]:
            e = x
            while e < W and cols[e]:
                e += 1
            out.append((x, e))
            x = e
        x += 1
    return sorted(sorted(out, key=lambda r: r[1] - r[0])[-N:])


def to_img(a: np.ndarray, scale: float) -> Image.Image:
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')
    return img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.LANCZOS)


def charge(src: Path, out: Path):
    im = unmix(np.array(Image.open(src).convert('RGB')))
    im[-30:] = 0
    frames = pieces(im, [(a + b) / 2 for a, b in runs(im)])
    rings = [ring(f[..., 3]) for f in frames]
    scale = CHARGE_RING * RES / rings[CHARGE_PEAK][2]
    ry = float(np.median([rings[k][1] for k in (0, 1, 2)]))  # the early frames: only the ring is wide
    placed = []
    for f, (cx, _, _) in zip(frames, rings):
        img = to_img(f, scale)
        placed.append((img, cx * scale, ry * scale, img.getbbox()))
    half = int(np.ceil(max(max(px - b[0], b[2] - px) for _, px, _, b in placed))) + 2
    up = max(py - b[1] for _, _, py, b in placed)
    down = max(b[3] - py for _, _, py, b in placed)
    cw, ch, top = 2 * half, int(np.ceil(up + down)) + 4, int(np.ceil(up)) + 2
    strip = Image.new('RGBA', (cw * N, ch))
    for k, (img, px, py, _) in enumerate(placed):
        strip.alpha_composite(img, (int(round(k * cw + half - px)), int(round(top - py))))
    strip.save(out, optimize=True)
    return {'frames': N, 'w': cw, 'h': ch, 'pivot': [0.5, round(top / ch, 4)], 'scale': round(scale, 4)}


def wave(src: Path, out: Path):
    im = unmix(np.array(Image.open(src).convert('RGB')))
    im[-20:] = 0
    frames = pieces(im, WAVE_CENTRES)
    boxes = []
    for f in frames:
        ys, xs = np.nonzero(f[..., 3] > 40)
        boxes.append((xs.min(), ys.min(), xs.max(), ys.max()))
    b0 = boxes[0]
    scale = WAVE_H * RES / (b0[3] - b0[1])
    imgs = [to_img(f, scale) for f in frames]
    cx, cy = WAVE_CX * RES, -WAVE_CY * RES  # frame centre relative to his feet (baked px, y down)
    # each frame's box centre sits on (cx, cy); the canvas is the union around the feet
    placed = []
    for img in imgs:
        bx0, by0, bx1, by1 = img.getbbox()
        placed.append((img, cx - (bx0 + bx1) / 2, cy - (by0 + by1) / 2))
    left = int(np.floor(min(0, min(x + i.getbbox()[0] for i, x, _ in placed)))) - 2
    right = int(np.ceil(max(x + i.getbbox()[2] for i, x, _ in placed))) + 2
    top = int(np.floor(min(y + i.getbbox()[1] for i, _, y in placed))) - 2
    bottom = int(np.ceil(max(0, max(y + i.getbbox()[3] for i, _, y in placed)))) + 2
    cw, ch = right - left, bottom - top
    strip = Image.new('RGBA', (cw * N, ch))
    for k, (img, x, y) in enumerate(placed):
        strip.alpha_composite(img, (int(round(k * cw + x - left)), int(round(y - top))))
    strip.save(out, optimize=True)
    return {'frames': N, 'w': cw, 'h': ch, 'pivot': [round(-left / cw, 4), round(-top / ch, 4)], 'scale': round(scale, 4)}


def main():
    src = Path(sys.argv[1] if len(sys.argv) > 1 else 'assets/heroes/Draeven/vfx')
    out = Path(sys.argv[2] if len(sys.argv) > 2 else 'public/sprites')
    out.mkdir(parents=True, exist_ok=True)
    print('charge', charge(src / 'Draeven_S2_Charge_VFX.png', out / 'fx-draeven-s2-charge.png'))
    print('wave', wave(src / 'Draeven_S2_CrimsonWave_VFX.png', out / 'fx-draeven-s2-wave.png'))


if __name__ == '__main__':
    main()
