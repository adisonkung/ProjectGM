"""Lucien Valthorne — provisional preview of the in-game clips + VFX layers (not a final Timeline Sync).

python3 tools/sprites/lucien_sync.py <out dir>
Renders from the game assets (public/sprites/hero-lucien.png + fx-lucien-*.png) with the timings / placements of
sprites.ts 'hero-lucien.png' (mirrored here — keep in step): 60 FPS, 2 × atlas px, Lucien on the left, an ally (Bai
Long) 2 cells right for S1 / S2, a foe 4 cells right for the attack. Writes <out>/lucien_<clip>.mp4 + a contact sheet
<out>/lucien_<clip>_sheet.png per clip.
"""
import json
import math
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

SP = Path('public/sprites')
REP = json.loads((Path(__file__).parent / 'lucien_vfx_report.json').read_text())
S = 2                   # preview px per atlas px
CELL = 80               # atlas px per board cell
FPS = 60
W, H = 900, 420
GROUND = 330            # preview y of the feet line
LX = 170                # preview x of Lucien's feet

HERO = Image.open(SP / 'hero-lucien.png').convert('RGBA')
ALLY = Image.open(SP / 'hero-bailong.png').convert('RGBA')
ULT_STEPS = [100] * 4 + [86] * 7 + [260] * 5 + [100] * 8 + [250, 250]
CLIPS = {
    # name: (row, frames, steps ms, events {name: step}, ally / foe distance in cells)
    'attack': (3, 19, [40] * 19, {'CAST_START': 0, 'DAMAGE': 8}, ('foe', 4)),
    'skill': (5, 27, [45] * 27, {'CAST_START': 0, 'DAMAGE': 6}, ('ally', 2)),
    'skill2': (6, 28, [64] * 28, {'CAST_START': 0, 'CHARGE_START': 3, 'DAMAGE': 9}, ('ally', 2)),
    'ult': (7, 26, ULT_STEPS, {'CAST_START': 0, 'CHARGE_START': 4, 'CHARGE_PEAK': 11, 'DAMAGE': 16}, ('ally', 2)),
}
# FX: (strip, trigger event, delay ms, frameMs, fadeOut ms, at, extra)
LAYERS = {
    'attack': [('atk-glow', 'CAST_START', 120, 50, 100, 'self', {})],
    'skill': [('s1-cross', 'CAST_START', 0, 45, 0, 'self', {}), ('s1-heal', 'DAMAGE', 0, 60, 0, 'target', {}),
              ('s1-gain', 'DAMAGE', 0, 50, 0, 'self', {})],
    'skill2': [('s2-source', 'CHARGE_START', 0, 100, 150, 'target', {}),
               ('s2-link', 'CHARGE_START', 0, 100, 150, 'target', {'span': True, 'dy': -22}),
               ('s2-absorb', 'DAMAGE', 0, 65, 0, 'self', {})],
    'ult': [('ult-charge', 'CHARGE_START', 0, 80, 0, 'self', {'under': True}),
            ('ult-aura', 'CHARGE_PEAK', 0, 120, 0, 'self', {'under': True}),
            ('ult-staff', 'CHARGE_START', 0, 75, 0, 'self', {}),
            ('ult-release', 'DAMAGE', 0, 60, 0, 'self', {}),
            ('ult-wave', 'DAMAGE', 0, 90, 0, 'self', {}), ('ult-wave', 'DAMAGE', 0, 90, 0, 'target', {})],
}
STRIPS = {}


def strip(name):
    if name not in STRIPS:
        r = REP[name]
        im = Image.open(SP / r['file']).convert('RGBA')
        STRIPS[name] = ([im.crop((i * r['w'], 0, (i + 1) * r['w'], r['h'])) for i in range(r['frames'])], r)
    return STRIPS[name]


def cell_frame(sheet, cw, row, col):
    return sheet.crop((col * cw, row * 170, (col + 1) * cw, (row + 1) * 170))


def paste_unit(cv, img, root, feet_x, flip=False):
    if flip:
        img = img.transpose(Image.FLIP_LEFT_RIGHT)
        root = (img.width - root[0], root[1])
    big = img.resize((img.width * S, img.height * S), Image.LANCZOS)
    cv.alpha_composite(big, (int(feet_x - root[0] * S), int(GROUND - root[1] * S)))


def paste_fx(cv, fr, r, x, y, alpha=1.0, angle=0.0, stretch=1.0):
    """pivot of the FX frame on preview (x, y); width = w × scale × 1.5 atlas px"""
    k = r['scale'] * 1.5 * S
    w, h = max(1, round(fr.width * k * stretch)), max(1, round(fr.height * k))
    im = fr.resize((w, h), Image.LANCZOS)
    if alpha < 1:
        im.putalpha(im.getchannel('A').point(lambda v: int(v * alpha)))
    px, py = r['pivot'][0] * w, r['pivot'][1] * h
    if angle:
        pad = Image.new('RGBA', (w * 2 + 4, w * 2 + 4))
        cx, cy = pad.width // 2, pad.height // 2
        pad.alpha_composite(im, (int(cx - px), int(cy - py)))
        im = pad.rotate(-angle, resample=Image.BICUBIC, center=(cx, cy))
        px, py = cx, cy
    cv.alpha_composite(im, (int(x - px), int(y - py)))


def render(clip, out: Path):
    row, n, steps, ev, (other, dist) = CLIPS[clip]
    t_ev = {k: sum(steps[:int(v)]) / 1000 for k, v in ev.items()}
    total = sum(steps) / 1000 + 0.6
    ox = LX + dist * CELL * S
    bg = Image.new('RGBA', (W, H), (36, 40, 54, 255))
    d = ImageDraw.Draw(bg)
    d.rectangle((0, GROUND, W, H), fill=(54, 62, 52, 255))
    frames = []
    for fi in range(int(total * FPS)):
        t = fi / FPS
        acc, col = 0.0, n - 1
        for i, s in enumerate(steps):
            acc += s / 1000
            if t < acc:
                col = i
                break
        cv = bg.copy()
        layers = []
        for name, trig, delay, fms, fade, at, extra in LAYERS[clip]:
            fr, r = strip(name)
            lt = t - t_ev[trig] - delay / 1000
            if lt < 0:
                continue
            k = int(lt * 1000 // fms)
            a = 1.0
            if k >= len(fr):
                over = lt * 1000 - len(fr) * fms
                if over > fade:
                    continue
                k, a = len(fr) - 1, 1 - over / max(1, fade)
            x0 = LX if at == 'self' else ox
            dy = extra.get('dy', 27.25)
            y = GROUND + (dy - 27.25) * 0.8 * S
            if extra.get('span'):
                length = abs(ox - LX)
                base = r['w'] * r['scale'] * 1.5 * S
                layers.append((extra.get('under', False), fr[k], r, ox, y, a, 180.0, length / base))
            else:
                layers.append((extra.get('under', False), fr[k], r, x0, y, a, 0.0, 1.0))
        for L in [l for l in layers if l[0]]:
            paste_fx(cv, *L[1:])
        ally = cell_frame(ALLY, 220, 0, 0)
        paste_unit(cv, ally, (110, 155), ox, flip=(other == 'foe'))
        paste_unit(cv, cell_frame(HERO, 260, row, col), (130, 155), LX)
        for L in [l for l in layers if not l[0]]:
            paste_fx(cv, *L[1:])
        if clip == 'attack' and t >= t_ev['DAMAGE']:
            br = REP['bolt']
            bf = Image.open(SP / br['file']).convert('RGBA')
            mz = REP['anchor']['muzzleAtlas']
            sx, sy = LX + (mz[0] - 130) * S, GROUND + (mz[1] - 155) * S
            ex, ey = ox - 20, GROUND - 40 * S
            fl = abs(ex - sx) / (CELL * S) / 8.0          # ~8 cells/s
            u = (t - t_ev['DAMAGE']) / fl
            if u < 1:
                k = min(3, int(u * 4))
                x, y = sx + (ex - sx) * u, sy + (ey - sy) * u
            elif u < 1 + 0.14 / fl:
                k, x, y = 4, ex, ey
            else:
                k = None
            if k is not None:
                fr = bf.crop((k * br['w'], 0, (k + 1) * br['w'], br['h']))
                kk = br['scale'] * 1.3 * S
                im = fr.resize((round(fr.width * kk), round(fr.height * kk)), Image.LANCZOS)
                cv.alpha_composite(im, (int(x - im.width / 2), int(y - im.height / 2)))
        ImageDraw.Draw(cv).text((10, 8), f'{clip}  T{fi:03d}  {t:.2f}s  F{col}', fill=(230, 230, 230, 255))
        frames.append(cv)
    v = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', f'{W}x{H}',
                          '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18',
                          str(out / f'lucien_{clip}.mp4')], stdin=subprocess.PIPE)
    for f in frames:
        v.stdin.write(f.tobytes())
    v.stdin.close()
    v.wait()
    # contact sheet: 12 evenly spaced frames
    pick = np.linspace(0, len(frames) - 1, 12).astype(int)
    tw, th = W // 2, H // 2
    sheet = Image.new('RGBA', (tw * 4, th * 3))
    for i, p in enumerate(pick):
        sheet.paste(frames[p].resize((tw, th)), ((i % 4) * tw, (i // 4) * th))
    sheet.convert('RGB').save(out / f'lucien_{clip}_sheet.png')


if __name__ == '__main__':
    out = Path(sys.argv[1] if len(sys.argv) > 1 else 'tmp/lucien-sync')
    out.mkdir(parents=True, exist_ok=True)
    for c in (sys.argv[2:] or CLIPS):
        render(c, out)
        print(out / f'lucien_{c}.mp4')
