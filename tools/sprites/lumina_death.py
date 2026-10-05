"""Lumina had no death row (the sheet has 7 rows; `die` reused the hurt row). This builds row 7 = death, 8 frames, from
her own hurt frames: recoil → knees give way → falls back → lies still, fading, with a few motes of light rising.
Pixel art stays crisp (nearest-neighbour only). Feet anchor of the sheet: x 66, y 86 in a 132 × 120 cell.

python3 tools/sprites/lumina_death.py   (idempotent: rebuilds row 7 from rows 0–6)"""
import os
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SHEET = os.path.join(ROOT, 'public', 'sprites', 'hero-lumina.png')
CW, CH, FX, FY = 132, 120, 66, 86

src = Image.open(SHEET).convert('RGBA')
base = src.crop((0, 0, CW * 8, CH * 7))  # rows 0–6 (drop an old row 7 if the script ran before)
hurt = [src.crop((i * CW, 2 * CH, (i + 1) * CW, 3 * CH)) for i in range(8)]


def pose(img, angle=0.0, sx=1.0, sy=1.0, dx=0, dy=0, alpha=1.0):
    """rotate (degrees, + = falls back / counter-clockwise) and squash around the feet, then shift"""
    w, h = img.size
    if sx != 1 or sy != 1:
        nw, nh = max(1, round(w * sx)), max(1, round(h * sy))
        sq = img.resize((nw, nh), Image.NEAREST)
        canvas = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        canvas.alpha_composite(sq, (round(FX - FX * sx), round(FY - FY * sy)))
        img = canvas
    if angle:
        img = img.rotate(angle, resample=Image.NEAREST, center=(FX, FY))
    # rest on the ground: the lowest opaque pixel sits on the feet line (+ a little, she slumps into the grass)
    ys = np.nonzero(np.asarray(img)[..., 3] > 40)[0]
    if ys.size and angle:
        dy += (FY + 5) - int(ys.max())
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    out.paste(img, (dx, dy), img)
    if alpha < 1:
        a = np.asarray(out).copy()
        a[..., 3] = (a[..., 3] * alpha).astype(np.uint8)
        out = Image.fromarray(a)
    return out


def motes(img, n, rise, seed):
    rng = np.random.default_rng(seed)
    a = np.asarray(img).copy()
    for _ in range(n):
        x = int(rng.integers(36, 100))
        y = int(78 - rise - rng.integers(0, 22))
        if 1 <= x < CW - 2 and 1 <= y < CH - 2:
            a[y, x] = (255, 246, 214, 255)
            for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                a[y + oy, x + ox] = (255, 226, 140, 150)
    return Image.fromarray(a)


eyes_shut = hurt[3]
frames = [
    pose(hurt[2]),                                   # hit
    pose(eyes_shut, angle=4, dx=-1),                 # recoil
    pose(eyes_shut, angle=8, sy=0.9, dx=-2),         # knees give way
    pose(eyes_shut, angle=22, sy=0.92, dx=2),        # sinking back
    pose(eyes_shut, angle=50, sy=0.9, dx=6),         # falling
    pose(eyes_shut, angle=78, sy=0.9, dx=10),        # down
    motes(pose(eyes_shut, angle=82, sy=0.88, dx=10, alpha=0.85), 4, 4, 1),
    motes(pose(eyes_shut, angle=82, sy=0.88, dx=10, alpha=0.6), 6, 14, 2),
]

sheet = Image.new('RGBA', (CW * 8, CH * 8), (0, 0, 0, 0))
sheet.alpha_composite(base, (0, 0))
for i, f in enumerate(frames):
    sheet.alpha_composite(f, (i * CW, 7 * CH))
sheet.save(SHEET, optimize=True)
print('hero-lumina.png', sheet.size, '— death row 7, 8 frames')
