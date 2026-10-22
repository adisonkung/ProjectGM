"""Walk-row stabiliser (user 2026-10-22: heroes' runs jitter / sway side to side).

python3 tools/sprites/walk_stabilize.py <id> [--write] [--preview out.gif]

Each frame of the hero's walk row (SHEETS row 1) is matched to frame 0 on the head + chest only (template match on the
upper body, ±MAX_DX px sideways, ±MAX_DY px vertically), then the frame is shifted so the upper body stays put — legs,
cape and weapon keep their drawn motion. Feet are then re-planted on the original ground row. Idempotent: an already
stable row measures ~0 px and is left as is. Re-run after <id>.py re-bakes the sheet, then `npm run sprites:optimize`.
"""
import re
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

MAX_DX, MAX_DY = 18, 4


def sheet_info(hero: str):
    src = Path('src/app/core/data/sprites.ts').read_text()
    i = src.index(f"'hero-{hero}.png': {{")
    cols, rows, cw, ch = map(int, re.compile(r"cols: (\d+), rows: (\d+), cellW: (\d+), cellH: (\d+)").search(src, i).groups())
    n = int(re.compile(r"walk: \{ row: (\d+), frames: (\d+)").search(src, i).group(2))
    return cols, rows, cw, ch, n


def gray(cell):
    a = cell[..., 3:4].astype(np.float32) / 255
    g = (cell[..., :3].astype(np.float32) * a).mean(-1)
    return np.dstack([g, a[..., 0] * 255]).astype(np.float32)


def measure(frames):
    """per-frame (dx, dy) that moves the upper body onto frame 0's"""
    f0 = frames[0]
    ys, xs = np.nonzero(f0[..., 3] > 96)
    top, bot = ys.min(), ys.max()
    h = bot - top
    y0, y1 = top, top + int(h * 0.45)
    head = f0[y0:y0 + int(h * 0.2), :, 3] > 96
    cx = int(np.nonzero(head.any(0))[0].mean())
    x0, x1 = max(0, cx - 22), min(f0.shape[1], cx + 22)
    tmpl = gray(f0[y0:y1, x0:x1])
    out = []
    for f in frames:
        best = (-9, 0, 0)
        for dy in range(-MAX_DY, MAX_DY + 1):
            for dx in range(-MAX_DX, MAX_DX + 1):
                ya, xa = y0 + dy, x0 + dx
                if ya < 0 or xa < 0 or ya + (y1 - y0) > f.shape[0] or xa + (x1 - x0) > f.shape[1]:
                    continue
                win = gray(f[ya:ya + (y1 - y0), xa:xa + (x1 - x0)])
                a, b = tmpl.ravel() - tmpl.mean(), win.ravel() - win.mean()
                score = float(a @ b / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-6))
                if score > best[0]:
                    best = (score, dx, dy)
        out.append((best[1], best[2], best[0]))
    return out


def shift(cell, dx, dy):
    m = np.float32([[1, 0, dx], [0, 1, dy]])
    return cv2.warpAffine(cell, m, (cell.shape[1], cell.shape[0]), flags=cv2.INTER_NEAREST, borderValue=(0, 0, 0, 0))


def main():
    hero = sys.argv[1]
    write = '--write' in sys.argv
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    path = Path(f'public/sprites/hero-{hero}.png')
    cols, rows, cw, ch, n = sheet_info(hero)
    im = np.array(Image.open(path).convert('RGBA'))
    row = 1
    frames = [im[row * ch:(row + 1) * ch, i * cw:(i + 1) * cw].copy() for i in range(n)]
    ground = [np.nonzero(f[..., 3] > 96)[0].max() for f in frames]
    m = measure(frames)
    fixed = []
    for f, (dx, dy, sc), g in zip(frames, m, ground):
        s = shift(f, -dx, -dy)
        # keep the feet on the original ground row (vertical bob stays drawn by the legs, not the whole body)
        g2 = np.nonzero(s[..., 3] > 96)[0].max()
        s = shift(s, 0, g - g2)
        fixed.append(s)
    print(hero, 'shifts (dx, dy, score):', [(int(a), int(b), round(c, 2)) for a, b, c in m])
    if prev:
        bg = (46, 58, 44, 255)
        out = []
        for k in range(n * 3):
            i = k % n
            can = Image.new('RGBA', (cw * 2, ch), bg)
            can.alpha_composite(Image.fromarray(frames[i]), (0, 0))
            can.alpha_composite(Image.fromarray(fixed[i]), (cw, 0))
            out.append(can.crop((40, 40, cw * 2 - 40, ch)).resize(((cw * 2 - 80) * 2, (ch - 40) * 2), Image.NEAREST).convert('RGB'))
        out[0].save(prev, save_all=True, append_images=out[1:], duration=90, loop=0)
    if write:
        for i, f in enumerate(fixed):
            im[row * ch:(row + 1) * ch, i * cw:(i + 1) * cw] = f
        Image.fromarray(im).save(path, optimize=True)
        print('written', path)


if __name__ == '__main__':
    main()
