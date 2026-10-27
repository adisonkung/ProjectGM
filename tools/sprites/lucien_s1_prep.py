"""Lucien Valthorne — Skill 1 sources prep (user 2026-10-27, held for a future hero task; not in the game yet).

python3 tools/sprites/lucien_s1_prep.py <out dir>
Sources (tracked, never modified): assets/heroes/Lucien/skill/lucien_s1_sheet_{a,b}.png — the same 56-frame staff-raise
cast (8 × 7 cells of 512 px) on junk backgrounds (a: magenta / grey / white boxes / pink circles, b: transparent green +
white boxes / pink circles) · assets/heroes/Lucien/vfx/Lucien_S1_StaffCross_VFX.png — 10 frames (5 × 2) holy cross
with a red gem on a magenta key (f1–f5 grow, f6–f10 shrink).
Background cut: per cell, background-like colours (magenta / grey-white / their blends / transparent) flood-filled from
the cell border + enclosed pockets, keep the character piece (+ thick pieces next to it), drop pale / pink thin strands
and specks, 1.5 px feathered edge, pale rim faded, magenta spill (blue above green) pulled out. Sheet b is used (keeps
the thin staff rays / censer chains); frames 4 and 43 come from sheet a (sheet b has source debris there).
VFX: unmixed from the magenta key, glow kept gold (red ≥ green), dark smoke kept warm; the gem of each VFX frame is
placed on the staff head tracked in every clip frame (centroid of the top 40 px of the staff side), grow with the
raise → pulse f4/f5 at the top → shrink while lowering → stays on the head until the staff is planted (user) → fades.
Writes <out>/lucien_s1_clean_sheet.png, staff_track.json, vfx_map.json, lucien_s1_preview.mp4 (20 FPS, provisional).
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

SRC = Path('assets/heroes/Lucien')
C = 512
USE_A = {4, 43}
M = np.array([251, 16, 251], float)
VFX_SCALE = 0.55   # VFX source px → clip cell px (peak frame ≈ half the character's height)


def bg_candidates(a):
    rgb = a[..., :3].astype(int)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = rgb.max(-1), rgb.min(-1)
    mag = (r - g > 90) & (b - g > 90) & (abs(r - b) < 60)
    # grey ↔ white (and their blends): low saturation, light
    grey = (mx - mn < 16) & (mx > 140)
    white = grey
    # magenta blended with grey / white (antialiased circle / box edges): r ≈ b, both above g, light
    mix = (abs(r - b) < 30) & (np.minimum(r, b) - g > 12) & (np.minimum(r, b) > 140)
    mag = mag | mix
    clear = a[..., 3] < 8
    return mag | grey | white | clear


def cut_cell(a):
    cand = bg_candidates(a)
    lab, n = ndimage.label(cand, np.ones((3, 3)))
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    # second pass: background-like regions enclosed between arm/staff and body (big enough, not tiny highlights)
    for k in range(1, n + 1):
        if k in border:
            continue
        m = lab == k
        if m.sum() > 40:
            bg |= m
    fg = ~bg
    # keep only the character: the largest foreground piece + pieces close to it (staff ornaments, loose cape tips)
    flab, fn = ndimage.label(fg, np.ones((3, 3)))
    if fn > 1:
        sizes = ndimage.sum(fg, flab, range(1, fn + 1))
        main = flab == (int(np.argmax(sizes)) + 1)
        near = ndimage.binary_dilation(main, iterations=6)
        keep = main.copy()
        for k in range(1, fn + 1):
            m = flab == k
            if sizes[k - 1] >= 120 and (m & near).any():
                # thin line pieces (box / circle edges) are long and 1–3 px thick: drop them
                d = ndimage.distance_transform_edt(m)
                if d.max() >= 2.5:
                    keep |= m
        fg = keep
    # thin strands (≤ 2 px) that are pale / pinkish = edges of the box / circle, not the art (chains and staff
    # rays are saturated gold / dark and stay)
    rgb0 = a[..., :3].astype(int)
    mx0, mn0 = rgb0.max(-1), rgb0.min(-1)
    paleish = ((mx0 - mn0 < 70) & (mx0 > 150)) | (rgb0[..., 2] > rgb0[..., 1] + 10)
    opened = ndimage.binary_opening(fg, np.ones((3, 3)), iterations=1)
    strands = fg & ~ndimage.binary_dilation(opened, iterations=1)
    fg &= ~(strands & paleish)
    # pale specks left after that: small pieces away from the body
    flab, fn = ndimage.label(fg, np.ones((3, 3)))
    if fn > 1:
        sizes = ndimage.sum(fg, flab, range(1, fn + 1))
        for k in range(1, fn + 1):
            if sizes[k - 1] < 25:
                fg[flab == k] = False
    # soft edge: alpha from distance to the background (1 px feather) + magenta / white halo pull
    dist = ndimage.distance_transform_edt(fg)
    alpha = np.clip(dist / 1.5, 0, 1)
    # edge decontamination: the outer 2 px that are pale (white-box / grey blend) fade out
    rim = (dist > 0) & (dist <= 2.0)
    pale = (mx0 - mn0 < 40) & (mx0 > 185)
    alpha[rim & pale] *= 0.25
    out = a.astype(float).copy()
    rgb = out[..., :3]
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    # magenta spill: the character's palette (gold / brown / red / cream / black) never has blue above green, so blue
    # above green is leaked magenta → pull blue down to green; strong magenta also loses alpha
    over = np.clip(b - g, 0, None)
    strong = np.clip((np.minimum(r, b) - g - 70) / 80, 0, 1)
    b -= over
    alpha = alpha * (1 - strong)
    out[..., 3] = alpha * a[..., 3] * (a[..., 3] > 8)
    return np.clip(out, 0, 255).astype(np.uint8)


def unmix(c):
    # alpha = how far the pixel is from the magenta key, per channel relative to the room it has
    # foreground raises green and/or lowers red / blue relative to the key; small JPEG noise is cut off
    a = np.maximum.reduce([np.clip((c[..., 1] - M[1]) / (255 - M[1]), 0, 1),
                           np.clip((M[0] - c[..., 0]) / M[0], 0, 1), np.clip((M[2] - c[..., 2]) / M[2], 0, 1)])
    a = np.clip((a - 0.08) / 0.92, 0, 1)
    f = (c - (1 - a[..., None]) * M) / np.maximum(a[..., None], 1e-3)
    f = np.clip(f, 0, 255)
    # magenta spill on the soft glow: the art is gold / white / red / dark smoke — blue above green is spill
    over = np.clip(f[..., 2] - f[..., 1], 0, None)
    f[..., 2] -= over * 0.85
    # gold / white glow: red never below green (unmixing magenta otherwise leaves a green cast on the soft edges)
    f[..., 0] = np.maximum(f[..., 0], f[..., 1] * 1.12)
    f[..., 2] = np.minimum(f[..., 2], f[..., 1] * 0.85)
    # dark smoke wisps: keep them a warm dark (no green / purple cast)
    lum = f.mean(-1)
    dark = np.clip((120 - lum) / 60, 0, 1)[..., None]
    warm = np.stack([lum * 1.15, lum * 0.95, lum * 0.8], -1)
    f = f * (1 - dark) + warm * dark
    return np.clip(np.dstack([f, a * 255]), 0, 255).astype(np.uint8)


# clip frame → VFX frame (None = hidden): grow with the raise, pulse at the top, shrink while lowering,
# stay on the staff head until it is planted (user 2026-10-27), then fade
seq = ([None] * 4 + [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4] + [3, 3, 4, 4] * 4 + [5, 5, 5, 6, 6, 6, 6, 6, 6, 6]
       + [6, 6, 7, 7, 7, 7, 7, 7, 8] + [8, 9, 9] + [None] * 3)
fade = {50: 0.75, 51: 0.5, 52: 0.25}


def clean_frames():
    sheets = {k: np.array(Image.open(SRC / f'skill/lucien_s1_sheet_{k}.png').convert('RGBA')) for k in 'ab'}
    out = []
    for k in range(56):
        r, c = divmod(k, 8)
        a = sheets['a' if k in USE_A else 'b'][r * C:(r + 1) * C, c * C:(c + 1) * C]
        out.append(Image.fromarray(cut_cell(a)))
    return out


def staff_track(frames):
    track = []
    for f in frames:
        a = np.array(f.getchannel('A')) > 128
        ys, xs = np.nonzero(a)
        right = a.copy()
        right[:, :int(np.median(xs)) + 15] = False      # the staff is held on his front side
        ry, rx = np.nonzero(right)
        sel = ry < ry.min() + 40
        track.append((float(rx[sel].mean()), float(ry[sel].mean())))
    return track


def vfx_cells():
    src = np.array(Image.open(SRC / 'vfx/Lucien_S1_StaffCross_VFX.png').convert('RGB')).astype(float)
    H, W = src.shape[:2]
    rgba = unmix(src)
    cells, gems = [], []
    for r in range(2):
        for c in range(5):
            x0, y0, x1, y1 = (int(round(c * W / 5)), int(round(r * H / 2)), int(round((c + 1) * W / 5)), int(round((r + 1) * H / 2)))
            s = src[y0:y1, x0:x1]
            red = (s[..., 0] > 170) & (s[..., 1] < 90) & (s[..., 2] < 110)
            lab, n = ndimage.label(red)
            big = int(np.argmax(ndimage.sum(red, lab, range(1, n + 1)))) + 1
            gy, gx = ndimage.center_of_mass(lab == big)
            cells.append(Image.fromarray(rgba[y0:y1, x0:x1].copy()))
            gems.append((float(gx), float(gy)))
    return cells, gems


def main(out: Path):
    out.mkdir(parents=True, exist_ok=True)
    frames = clean_frames()
    sheet = Image.new('RGBA', (8 * C, 7 * C))
    for k, f in enumerate(frames):
        r, c = divmod(k, 8)
        sheet.paste(f, (c * C, r * C))
    sheet.save(out / 'lucien_s1_clean_sheet.png', optimize=True)
    track = staff_track(frames)
    cells, gems = vfx_cells()
    assert len(seq) == 56
    json.dump(track, open(out / 'staff_track.json', 'w'))
    json.dump({'seq': seq, 'gems': gems, 'fade': fade, 'scale': VFX_SCALE}, open(out / 'vfx_map.json', 'w'))
    VW, VH = 900, 480
    bg = Image.open('public/backgrounds/forest-1.webp').convert('RGBA')
    bgr = bg.resize((int(bg.width * VH * 1.5 / bg.height), int(VH * 1.5))).crop((0, int(VH * 0.5), VW, int(VH * 1.5)))
    v = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', f'{VW}x{VH}', '-r', '20',
                          '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', str(out / 'lucien_s1_preview.mp4')],
                         stdin=subprocess.PIPE)
    for _ in range(3):
        for k, f in enumerate(frames):
            big = Image.new('RGBA', (C, C))
            big.alpha_composite(f)
            if seq[k] is not None:
                cell, g = cells[seq[k]], gems[seq[k]]
                vf = cell.resize((int(cell.width * VFX_SCALE), int(cell.height * VFX_SCALE)), Image.LANCZOS)
                if k in fade:
                    vf.putalpha(vf.getchannel('A').point(lambda v_, m=fade[k]: int(v_ * m)))
                tx, ty = track[k]
                big.alpha_composite(vf, (int(round(tx - g[0] * VFX_SCALE)), int(round(ty - g[1] * VFX_SCALE))))
            cv = Image.new('RGBA', (VW, VH), (34, 40, 56, 255))
            cv.alpha_composite(big.crop((40, 0, 480, 440)), (5, 20))
            right = bgr.crop((VW // 2, 0, VW, VH)).copy()
            sm = big.crop((40, 0, 480, 440)).resize((180, 180), Image.LANCZOS)
            right.alpha_composite(sm, ((VW // 2 - 180) // 2, VH - 180 - 70))
            cv.paste(right, (VW // 2, 0))
            v.stdin.write(cv.tobytes())
    v.stdin.close()
    v.wait()
    print(out)


if __name__ == '__main__':
    main(Path(sys.argv[1] if len(sys.argv) > 1 else 'tmp/lucien-s1'))
