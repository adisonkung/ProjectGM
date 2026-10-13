"""Garrick Stoneward — Ultimate Hold the Gate: VFX cut + 60 FPS preview + timeline JSON + in-game FX strips.

Inputs (art/incoming/garrick, not committed):
  ult_vfx.png    the approved Ultimate Main VFX, 10 frames (5 + 5) on flat #FF00FF: gold-rune ground seal → ivory light
                 dome → lion-banner gates rise → the full royal-blue fortress with golden lion shields (peak) → walls
                 recede → seal fades
  ult_aura.png   the approved Ultimate Persistent Aura, 8 frames (4 + 4): the seal + dome with two lion-banner gates —
                 the lighter loop that stays for the buff
  public/sprites/hero-garrick.png row 7 (character, 14 frames, built by tools/sprites/garrick.py — nothing baked)

Production timeline (user spec 2026-10, 60 FPS, 96 frames F00–F95 = 1.60 s):
  A resolve / preparation F00–F17 · B bastion summoning F18–F35 (ULTIMATE CAST START F18, Main VFX begins) ·
  C fortress manifestation F36–F47 (FORTRESS MANIFESTATION F36) · D ULTIMATE ACTIVATION F48–F59 (F48 = team damage
  reduction + damage interception + taunt + stagger resistance, Main VFX peak) · E bastion settle F60–F77 (F60 Main →
  Aura transition) · F character recovery F78–F95 (F78 recovery, F95 cast complete). The buff (6 s) outlives the clip:
  the aura keeps looping until BUFF EXPIRE (F48 + 360 = F408) and fades.

In game: kit Ult = taunt RADIUS_2 + gate_ward (team -15 %, 25 % of each ally's damage redirected to Garrick) +
gate_stance (-20 %, unstoppable) on the clip's DAMAGE (F48) · `gr-ult-main` = on vfx at his feet, behind him (he stands
inside the fortress) · `gr-ult-aura` = on impact + 200 ms at his feet, behind him, a baked 6 s strip (intro → gates
breathe → fade) · the intercept is the engine's `soulLink` event (no separate FX asset yet).

Usage: python3 tools/sprites/garrick_ult.py <out dir>
"""
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

sys.path.insert(0, os.path.dirname(__file__))

SRC = 'art/incoming/garrick'
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/garrick_ult'
os.makedirs(OUT, exist_ok=True)
FPS, N = 60, 96
CELL_W, CELL_H, ROOT = 260, 170, (130, 155)
W, H, UP = 500, 210, 3
GROUND, X0 = 182, 230
CELL_PX = 80
CAST_T, MANIFEST_T, ACT_T, TRANS_T, REC_T, END_T = 18, 36, 48, 60, 78, 95
BUFF_S = 6.0
EXPIRE_T = ACT_T + round(BUFF_S * FPS)            # F408
AURA_DELAY_MS = 200                                # aura starts at F60 (0.2 s after the activation)
AURA_STEP_MS = 125
HIT_T = 84                                         # preview only: an enemy hits the ally behind him (redirect demo)
ALLY_X, EX = X0 - 120, X0 + 100

# ------------------------------------------------------------------ character (atlas row 7, game scale)
atlas = np.array(Image.open('public/sprites/hero-garrick.png').convert('RGBA'))
ROW = atlas[7 * CELL_H:8 * CELL_H]
CHAR = [(0, 5, 1), (6, 11, 2), (12, 17, 3), (18, 23, 4), (24, 29, 5), (30, 35, 6), (36, 41, 7), (42, 47, 8), (48, 53, 9),
        (54, 59, 10), (60, 68, 11), (69, 77, 12), (78, 86, 13), (87, 95, 14)]
POSES = {1: ('RESOLVE', 'ยืนถือค้อนตั้ง', 'CAST_START F00'),
         2: ('STEADY', 'ตั้งสติ ขยับเท้า', ''),
         3: ('PLANT FEET', 'ปักเท้า', ''),
         4: ('BASTION STANCE', 'ย่อรับน้ำหนัก', 'ULTIMATE CAST START F18'),
         5: ('BASTION STANCE', 'กำค้อนสองมือ', ''),
         6: ('BASTION STANCE', 'ดันค้อนลงพื้น', ''),
         7: ('MANIFEST', 'ปักค้อน ย่อเต็มที่', 'FORTRESS MANIFESTATION F36'),
         8: ('HOLD', 'ค้างท่าป้อม', ''),
         9: ('ACTIVATION', 'ยืนหยัดเต็มกำลัง', 'ULTIMATE ACTIVATION F48'),
         10: ('ACTIVATION', 'ค้าง', ''),
         11: ('SETTLE', 'ก้มรับแรง', 'MAIN > AURA F60'),
         12: ('SETTLE', 'ค้างท่าป้อม', ''),
         13: ('RECOVERY', 'ผ่อนการ์ด', 'CHARACTER RECOVERY F78'),
         14: ('GUARDED STAND', 'ยืนถือค้อนตั้ง', 'CAST ANIMATION COMPLETE F95')}


def pose(c):
    return ROW[:, (c - 1) * CELL_W:c * CELL_W]


def char_at(t):
    return next((c for a, b, c in CHAR if a <= t <= b), CHAR[-1][2])


def step_of(t):
    for i, (a, b, _) in enumerate(CHAR):
        if a <= t <= b:
            return round(i + (t - a) / (b - a + 1), 3)
    return float(len(CHAR))


def cell(sheet, w, root, row=0):
    a = np.array(Image.open(f'public/sprites/{sheet}').convert('RGBA'))
    return a[row * CELL_H:(row + 1) * CELL_H, 0:w], root


ALLY = cell('hero-linxue.png', 260, (130, 155))
ENEMY = np.array(Image.open('public/sprites/enemy-goblin-fighter.png').convert('RGBA'))[0:100, 0:132][:, ::-1]
ENEMY_ROOT = (132 - 66, 86)


# ------------------------------------------------------------------ VFX (painted + glow → alpha unmixed)
def unmix(name):
    rgb = np.array(Image.open(f'{SRC}/{name}.png').convert('RGB')).astype(float)
    bg = np.median(rgb[:6].reshape(-1, 3), 0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    al = np.clip(1 - (np.minimum(r, b) - g) / (min(bg[0], bg[2]) - bg[1]), 0, 1)
    al = np.where(al < 0.08, 0, al)
    col = np.clip((rgb - (1 - al[..., None]) * bg) / np.maximum(al[..., None], 1e-3), 0, 255)
    out = np.zeros(rgb.shape[:2] + (4,), np.uint8)
    out[..., :3] = col
    out[..., 3] = (al * 255).astype(np.uint8)
    return out


def cut(name, rows):
    """one frame per x-slot · pivot = centre of the ground seal (the lowest of the widest rows in the lower part)"""
    im = unmix(name)
    out = []
    for y0, y1, divs in rows:
        xs = [0] + divs + [im.shape[1]]
        for a, b in zip(xs, xs[1:]):
            fr = im[y0:y1, a:b].copy()
            m = fr[..., 3] > 40
            lab, k = ndimage.label(m, np.ones((3, 3)))
            if k > 1:
                sizes = ndimage.sum(m, lab, range(1, k + 1))
                fr[~np.isin(lab, 1 + np.nonzero(sizes >= 6)[0]) & m] = 0
            ys, xx = np.nonzero(fr[..., 3] > 20)
            fr = fr[ys.min():ys.max() + 1, xx.min():xx.max() + 1]
            m = fr[..., 3] > 110
            h = m.shape[0]
            span = [(np.ptp(np.nonzero(m[y])[0]) if m[y].any() else 0) for y in range(h)]
            lo = int(h * 0.45)
            # the seal's widest row near the bottom (fortress walls / banners above can be as wide — take the lowest)
            top = max(span[lo:])
            cy = max(y for y in range(lo, h) if span[y] >= 0.92 * top)
            row = np.nonzero(m[cy])[0]
            out.append({'img': fr, 'px': (row.min() + row.max()) / 2, 'py': cy})
    return out


MAIN = cut('ult_vfx', [(190, 535, [278, 551, 833, 1101]), (545, 925, [347, 648, 918, 1180])])
AURA = cut('ult_aura', [(150, 500, [360, 719, 1078]), (570, 890, [360, 722, 1081])])


def size(fr, thr=60):
    ys, xs = np.nonzero(fr['img'][..., 3] > thr)
    return xs.max() - xs.min() + 1, ys.max() - ys.min() + 1


# sizes (preview / atlas px): the fortress peak (f6) ≈ 2.4 cells wide — team protection, far bigger than the S1 guard ·
# the persistent aura (f4) ≈ 1.7 cells wide
SC = {'main': 2.4 * CELL_PX / size(MAIN[5])[0], 'aura': 1.7 * CELL_PX / size(AURA[3])[0]}


def plan(keys):
    out = {}
    for (t0, f), (t1, _) in zip(keys, keys[1:]):
        for t in range(t0, t1):
            out[t] = f
    return out


# Main: seal F18 → dome F24 / F30 → gates rise F36 (MANIFESTATION) → walls F42 → FULL FORTRESS F48 (activation, held)
# → recedes F60 / F66 → seal fades F72 → gone F78
MAIN_PLAN = plan([(18, 1), (24, 2), (30, 3), (36, 4), (42, 5), (48, 6), (54, 7), (60, 8), (66, 9), (72, 10), (78, None)])


def aura_seq():
    """the 6 s aura strip (125 ms steps): seal (f1) → gates rise (f2–f4) → breathe f4 ↔ f7 → gates sink (f8)"""
    n = round((BUFF_S * 1000 - AURA_DELAY_MS) / AURA_STEP_MS)
    head, tail = [1, 2, 3], [8, 8]
    loop = [4, 5, 6, 7, 6, 5]
    body = [loop[i % len(loop)] for i in range(n - len(head) - len(tail))]
    return head + body + tail


AURA_SEQ = aura_seq()
AURA_T0 = ACT_T + round(AURA_DELAY_MS * FPS / 1000)          # F60


def aura_at(t):
    """(frame, alpha) of the aura at timeline frame t — fades in over F60–F72 while the Main VFX recedes, out at expiry"""
    if t < AURA_T0 or t >= EXPIRE_T + 18:
        return None
    k = min(len(AURA_SEQ) - 1, int((t - AURA_T0) * 1000 / FPS // AURA_STEP_MS))
    a = min(1.0, (t - AURA_T0 + 1) / 12)
    if t >= EXPIRE_T:
        a *= max(0.0, 1 - (t - EXPIRE_T) / 18)
    return AURA_SEQ[k], a


def tile(fr, s, alpha=1.0):
    img = Image.fromarray(fr['img'])
    img = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)
    a = np.array(img)
    a[..., 3] = (a[..., 3].astype(float) * alpha).astype(np.uint8)
    return a, fr['px'] * s, fr['py'] * s


def background():
    a = np.zeros((H, W, 4), np.uint8)
    yy = np.arange(H)[:, None]
    sky = np.clip(yy / GROUND, 0, 1)
    a[..., 0], a[..., 1], a[..., 2] = (16 + 16 * sky), (18 + 18 * sky), (34 + 26 * sky)
    g = yy >= GROUND
    a[..., 0] = np.where(g, 46, a[..., 0])
    a[..., 1] = np.where(g, 50, a[..., 1])
    a[..., 2] = np.where(g, 46, a[..., 2])
    a[GROUND, :, :3] = (82, 84, 72)
    for k in range(-4, 4):
        x = int(X0 - CELL_PX / 2 + k * CELL_PX)
        if 0 <= x < W:
            a[GROUND + 1:GROUND + 8, x, :3] = (96, 98, 84)
    a[..., 3] = 255
    return Image.fromarray(a)


BG = background()


def put(img, a, px, py, at):
    x, y = round(at[0] - px), round(at[1] - py)
    img.alpha_composite(Image.fromarray(a), (max(0, x), max(0, y)), (max(0, -x), max(0, -y)))
    return x, y


LOG = []


def ev(t, track, frame, op=1.0):
    LOG.append({'T': t, 'track': track, 'frame': frame, 'x': 0, 'y': 0, 'opacity': op, 'split': '-'})


def zoom(t):
    """preview-only camera push: +3 % toward Garrick F40–F48, held to F56, eased back by F70"""
    if t < 40 or t > 70:
        return 1.0
    if t <= 48:
        k = (t - 40) / 8
    elif t <= 56:
        k = 1.0
    else:
        k = 1 - (t - 56) / 14
    return 1 + 0.03 * (k * k * (3 - 2 * k))


def frame(t, log=True):
    img = BG.copy()
    dr = ImageDraw.Draw(img)
    # behind him: the fortress / aura (he stands inside the bastion)
    if t in MAIN_PLAN:
        a, px, py = tile(MAIN[MAIN_PLAN[t] - 1], SC['main'])
        x, y = put(img, a, px, py, (X0, GROUND))
        if log:
            LOG.append({'T': t, 'track': 'main', 'frame': MAIN_PLAN[t], 'x': x, 'y': y, 'opacity': 1, 'split': 'back', 'part': 'main'})
    au = aura_at(t)
    if au:
        a, px, py = tile(AURA[au[0] - 1], SC['aura'], au[1])
        x, y = put(img, a, px, py, (X0, GROUND))
        if log and t < N:
            LOG.append({'T': t, 'track': 'aura', 'frame': au[0], 'x': x, 'y': y, 'opacity': round(au[1], 2), 'split': 'back', 'part': 'aura'})
    spr, root = ALLY
    img.alpha_composite(Image.fromarray(spr), (ALLY_X - root[0], GROUND - root[1]))
    img.alpha_composite(Image.fromarray(pose(char_at(min(t, N - 1)))), (X0 - ROOT[0], GROUND - ROOT[1]))
    img.alpha_composite(Image.fromarray(ENEMY), (EX - ENEMY_ROOT[0], GROUND - ENEMY_ROOT[1]))
    if ACT_T <= t < EXPIRE_T:                        # taunt mark (UI, preview)
        cx, cy = EX + 2, GROUND - 74
        dr.polygon([(cx, cy - 7), (cx + 6, cy + 4), (cx - 6, cy + 4)], outline=(255, 170, 60), fill=(120, 40, 20))
    if HIT_T <= t <= HIT_T + 10:                     # damage interception demo: 25 % of the ally's hit goes to Garrick
        k = (t - HIT_T) / 10
        sx, sy = ALLY_X + 6, GROUND - 46
        ex, ey = X0 - 6, GROUND - 46
        mx = sx + (ex - sx) * min(1.0, k * 1.6)
        dr.line([(sx, sy), (mx, sy - 10 * np.sin(np.pi * min(1.0, k * 1.6)))], fill=(150, 200, 255), width=2)
        dr.ellipse([sx - 6, sy - 6, sx + 6, sy + 6], outline=(255, 120, 100))
        dr.text((ALLY_X - 22, GROUND - 104), '-75', fill=(255, 140, 120))
        dr.text((X0 - 14, GROUND - 112), '-25 INTERCEPT', fill=(150, 200, 255))
    if log and t < N:
        if t == CAST_T:
            ev(t, 'events', 1)
        if t == MANIFEST_T:
            ev(t, 'events', 2)
        if ACT_T <= t <= ACT_T + 1:
            for k in ('mitig', 'intercept', 'taunt', 'stagger', 'events'):
                ev(t, k, 1, 1.0 if t == ACT_T else 0.5)
        if t > ACT_T + 1:
            for k in ('mitig', 'intercept', 'taunt', 'stagger'):
                ev(t, k, 2, 0.35)
        if HIT_T <= t <= HIT_T + 2:
            ev(t, 'icfx', 1, 1.0 if t == HIT_T else 0.5)
        if ACT_T - 8 <= t <= 70:
            ev(t, 'camera', 1 if t < ACT_T else 2, round(zoom(t) - 1, 3) * 30 + 0.1)
        if t == END_T:
            ev(t, 'events', 3)
    z = zoom(t)
    if z != 1.0:
        w2, h2 = round(W * z), round(H * z)
        big = img.resize((w2, h2), Image.NEAREST)
        cx, cy = X0 * z, (GROUND - 40) * z
        l, u = round(cx - X0), round(cy - (GROUND - 40))
        img = big.crop((l, u, l + W, u + H))
    return img.resize((W * UP, H * UP), Image.NEAREST).convert('RGB')


frames = [frame(t) for t in range(N)]
tmp = tempfile.mkdtemp()
for i, f in enumerate(frames):
    f.save(f'{tmp}/f{i:03d}.png')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-i', f'{tmp}/f%03d.png', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                '-crf', '14', f'{OUT}/garrick_ult_preview_60fps.mp4'], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-i', f'{tmp}/f%03d.png', '-vf',
                'fps=30,scale=750:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=200[p];[b][p]paletteuse=dither=bayer',
                '-loop', '0', f'{OUT}/garrick_ult_preview_30fps.gif'], check=True)
# the sheet's source clip: the cast + 2 extra moments past it (persistent buff F200 · buff expire F412) as frames 96 / 97
extra = [frame(200, False), frame(EXPIRE_T + 4, False)]
for i, f in enumerate(extra):
    f.save(f'{tmp}/f{N + i:03d}.png')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-i', f'{tmp}/f%03d.png', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                '-crf', '14', f'{OUT}/garrick_ult_sheet_source.mp4'], check=True)
KEYS = [0, 18, 30, 36, 42, 48, 54, 60, 70, 78, 84, 95]
cw, ch = W, H
sheet = Image.new('RGB', (cw * 4, ch * 4))
dr = ImageDraw.Draw(sheet)
for i, (t, im) in enumerate([(t, frames[t]) for t in KEYS] + [(200, extra[0]), (EXPIRE_T + 4, extra[1])]):
    sheet.paste(im.resize((cw, ch), Image.NEAREST), ((i % 4) * cw, (i // 4) * ch))
    dr.text(((i % 4) * cw + 6, (i // 4) * ch + 4), f'F{t:02d} C{char_at(min(t, N - 1)):02d}' + ('  (buff)' if t >= N else ''),
            fill=(255, 255, 255))
sheet.save(f'{OUT}/garrick_ult_preview_contact.png')


# ------------------------------------------------------------------ in-game strips
def bake(name, tiles, frame_ms=1000 / 60):
    l = max(px for _, px, _ in tiles)
    r = max(a.shape[1] - px for a, px, _ in tiles)
    u = max(py for _, _, py in tiles)
    d = max(a.shape[0] - py for a, _, py in tiles)
    w, h = int(np.ceil(l + r)) + 2, int(np.ceil(u + d)) + 2
    out = Image.new('RGBA', (w * len(tiles), h), (0, 0, 0, 0))
    for k, (a, px, py) in enumerate(tiles):
        out.alpha_composite(Image.fromarray(a), (k * w + round(l - px) + 1, round(u - py) + 1))
    out.save(f'public/sprites/fx-garrick-ult-{name}.png', optimize=True)
    return {'frames': len(tiles), 'w': w, 'h': h, 'frameMs': round(frame_ms, 2), 'pivot': [round((l + 1) / w, 4), round((u + 1) / h, 4)]}


# Main at 30 FPS (the drawn frames hold 6 timeline frames each — every other one is enough), the aura at 125 ms steps
aura_tiles = [tile(AURA[f - 1], SC['aura'], min(1.0, (k + 1) / 2)) for k, f in enumerate(AURA_SEQ)]
game_fx = {
    'main': bake('main', [tile(MAIN[MAIN_PLAN[t] - 1], SC['main']) for t in sorted(MAIN_PLAN)[::2]], 1000 / 30),
    'aura': bake('aura', aura_tiles, AURA_STEP_MS),
}
steps = [round((b - a + 1) * 1000 / FPS) for a, b, _ in CHAR]
steps[-1] += round(N * 1000 / FPS) - sum(steps)
game = {'steps': steps,
        'events': {'CAST_START': 0, 'CHARGE_START': step_of(CAST_T), 'VFX_SPAWN': step_of(CAST_T), 'CHARGE_PEAK': step_of(MANIFEST_T),
                   'SKILL_ACTIVATE': step_of(ACT_T), 'DAMAGE': step_of(ACT_T), 'RECOVERY_START': step_of(REC_T)},
        'impact': {'hitStopMs': 60, 'shakePx': 2, 'shakeMs': 120}}

# ------------------------------------------------------------------ timeline JSON (+ sync-sheet meta)
pf = [{'T': t, 'char': f'C{char_at(t):02d}', 'drawnFrame': char_at(t), 'root': [X0, GROUND],
       'spearTip': [X0, GROUND], 'center': [X0, GROUND - 40]} for t in range(N)]
meta = {
    'name': 'garrick_ult_sync_sheet',
    'readme': ['Timeline Sync Sheet — Ultimate Hold the Gate · Garrick Stoneward (production)', '',
               '60 FPS, 96 เฟรม (F00–F95) = 1.60 วินาที · ตัวละคร 14 ท่า + Main VFX 10 เฟรม (ป้อมปราการ) + Persistent Aura 8 เฟรม (วนตามบัฟ 6 วิ)',
               'Frames = ทุกเฟรม · Character = ท่า C01–C14 + ความยาวในเกม · VFX Tracks / Events / Layers',
               'หน่วย: px = พิกเซลของแผ่นเกม (canvas 500×210, พื้น y = 182) · 80 px = 1 ช่อง · หลินเสวี่ยยืนหลัง 1.5 ช่อง (เพื่อนที่ถูกรับดาเมจแทน)',
               'ที่มา: tools/sprites/garrick_ult.py > garrick_ult_timeline.json > tools/sprites/ult_sync_sheet.py'],
    'gameNote': 'Game ms = steps ของท่า ult ใน SHEETS hero-garrick.png (รวม 1600 ms) · ผลทั้งหมดลงที่ DAMAGE F48 · บัฟ 6 วิ '
                'อยู่ต่อหลังจบท่า (หมด F408) · Intercept = event soulLink ของเอนจิน (runtime)',
    'title': 'Timeline Sync Sheet — Ultimate Hold the Gate  ·  Garrick Stoneward · The Iron Bell',
    'subtitle': '60 FPS · 96 frames (F00–F95) = 1.60 s · 1 column = 1 frame (16.7 ms) · ULTIMATE ACTIVATION F48 · '
                'buff 6 s outlives the clip (expire F408) · team protection, no damage burst · root 0',
    'phases': [[0, 17, 'A', 'RESOLVE / PREPARATION', [120, 130, 150], 'ตั้งสติ ปักเท้า'],
               [18, 35, 'B', 'BASTION SUMMONING', [70, 110, 210], 'เรียกป้อม'],
               [36, 47, 'C', 'FORTRESS MANIFESTATION', [200, 170, 80], 'ป้อมปรากฏ'],
               [48, 59, 'D', 'ULTIMATE ACTIVATION', [235, 210, 120], 'บัฟทั้งทีมเริ่ม'],
               [60, 77, 'E', 'BASTION SETTLE', [100, 140, 220], 'Main > Aura'],
               [78, 95, 'F', 'CHARACTER RECOVERY', [100, 160, 130], 'กลับท่า ออร่าวนต่อ']],
    'poses': {c: [f'F{c}', f'{v[0]} — {v[1]}', v[2]] for c, v in POSES.items()},
    'gameSteps': steps,
    'hits': [ACT_T],
    'events': [[0, 'CAST_START', 'C01'], [CAST_T, 'ULTIMATE CAST START', 'C04 · Main VFX f1'],
               [MANIFEST_T, 'FORTRESS MANIFESTATION', 'f4 ประตูสิงโต'], [ACT_T, 'ULTIMATE ACTIVATION', 'ป้อมเต็ม f6'],
               [ACT_T, 'APPLY TEAM DAMAGE REDUCTION', 'gate_ward -15 %'], [ACT_T, 'ENABLE DAMAGE INTERCEPTION', '25 % > การ์ริก'],
               [ACT_T, 'APPLY TAUNT', 'RADIUS_2'], [ACT_T, 'APPLY STAGGER RESISTANCE', 'gate_stance unstoppable'],
               [TRANS_T, 'BEGIN MAIN VFX > AURA', 'aura f1 เฟดเข้า'], [REC_T, 'CHARACTER RECOVERY', 'C13'],
               [HIT_T, 'INTERCEPT (dynamic)', 'ตัวอย่าง: เพื่อนโดนตี'], [END_T, 'CAST ANIMATION COMPLETE', 'C14 · บัฟอยู่ต่อ']],
    'lanes': 8,
    'tracks': [['main', 'L2 Ultimate Main VFX', [245, 210, 120], 'fx-garrick-ult-main (ult_vfx.png 10 fr, 30 FPS)', 'L2 · หลังตัวละคร',
                'เท้าการ์ริก (กลางป้อม)', 'F18 ตรา > F36 ประตูสิงโต > F48 ป้อมเต็ม peak > F60 ลดลง > จาง F77'],
               ['aura', 'L3 Persistent Aura Loop', [130, 170, 255], 'fx-garrick-ult-aura (ult_aura.png 8 fr, 125 ms)',
                'L3 · หลังตัวละคร', 'เท้าการ์ริก', 'F60 เฟดเข้า > ประตูหายใจ f4–f7 > BUFF EXPIRE F408 จาง'],
               ['mitig', 'L4 Team Mitigation Buff', [120, 200, 255], 'gate_ward รับดาเมจ ×0.85 ทั้งทีม 6 วิ', '-', 'เพื่อนทุกคน',
                'F48 > F408'],
               ['intercept', 'L5 Damage Interception', [150, 190, 255], 'gate_ward damageTransfer 0.25 > การ์ริก', '-',
                'เพื่อน > การ์ริก', 'F48 > F408 (จบเองถ้าการ์ริกล้ม)'],
               ['taunt', 'L6 Taunt', [255, 150, 90], 'taunted RADIUS_2', '-', 'ศัตรูรอบตัว 2 ช่อง', 'F48 (3 วิ)'],
               ['stagger', 'L7 Stagger Resistance Buff', [255, 220, 140], 'gate_stance ×0.8 + unstoppable 6 วิ', '-', 'ตัวการ์ริก',
                'F48 > F408 · ไม่ติดสตัน/ตรึง/ผลัก'],
               ['icfx', 'L8 Intercept Trigger FX (optional)', [180, 210, 255], 'event soulLink (ยังไม่มี asset)', '-',
                'เพื่อนที่โดน + การ์ริก', 'runtime ทุกครั้งที่โอนดาเมจ — ตัวอย่าง F84'],
               ['camera', 'L9 Camera / Time Emphasis', [255, 255, 255], 'AnimDef.impact', '-', '-',
                'push 3 % F40–F70 (พรีวิว) · hit-stop 60 ms + สั่น 2 px ที่ F48'],
               ['events', 'L10 Gameplay Events', [200, 200, 200], 'engine', '-', '-', 'F18 cast · F36 manifest · F95 complete']],
    'trackNames': {'main': 'Main VFX', 'aura': 'Aura Loop', 'mitig': 'ลดดาเมจทีม', 'intercept': 'รับดาเมจแทน', 'taunt': 'ยั่วยุ',
                   'stagger': 'ต้านเซ', 'icfx': 'Intercept FX', 'camera': 'กล้อง', 'events': 'อีเวนต์'},
    'layers': [[1, 'Main VFX (หลัง)'], [2, 'Aura (หลัง)'], [3, 'ตัวละคร'], [4, 'ป้าย/marker (หน้า)']],
    'shake': {str(ACT_T): [2, 0], str(ACT_T + 1): [-2, 1], str(ACT_T + 2): [1, -1], str(ACT_T + 3): [-1, 0]},
    'thumbs': [0, 24, 36, 48, 84, N + 1],
    'thumbLabels': {0: 'ULTIMATE READY', 24: 'BASTION SUMMONING', 36: 'FORTRESS MANIFESTATION', 48: 'ACTIVATION PEAK',
                    84: 'PERSISTENT BUFF ACTIVE', N + 1: 'BUFF EXPIRATION'},
    'thumbCaptions': {str(N + 1): f'F{EXPIRE_T}  (buff end)'},
    'thumbCrop': [70 * UP, 20 * UP, 400 * UP, 205 * UP],
    'travelLabel': 'L1 Root X (px) — 0 (ปักหลัก)', 'heightLabel': 'Root Y (px) — 0',
    'notes': [
        'ป้องกันทั้งทีม ไม่ใช่ระเบิดโจมตี: ไม่มีดาเมจ ไม่มีฮีล ไม่มีอมตะ — การ์ริกยืนปักหลัก (root 0) เป็นป้อมของทีม',
        'F48 = จุดเดียวที่ระบบทำงาน: ทีมรับดาเมจ -15 % · 25 % ของดาเมจที่เพื่อนรับโอนมาที่การ์ริก · ยั่วยุรอบตัว 2 ช่อง · ต้านเซ (ไม่ติดสตัน/ตรึง/ผลัก)',
        'Main VFX (ป้อมปราการสิงโต) กับ Aura เป็นคนละ track คนละ strip: Main ครั้งเดียว F18–F77 · Aura เฟดเข้า F60 วนจนบัฟหมด F408',
        'ป้อมใหญ่ ~2.4 ช่อง (S1 Guard Aura ~1.15 ตัว) — ภาษาภาพทีม: กำแพงน้ำเงิน ตราสิงโตทอง แสงงาช้าง · วาดหลังตัวละคร (เขายืนในป้อม)',
        'Intercept FX = runtime ทุกครั้งที่ดาเมจถูกโอน (event soulLink) — ยังไม่มี asset แยก · พรีวิวแสดงเส้นโอนตัวอย่างที่ F84',
        'กล้อง push 3 % F40–F70 = พรีวิวเท่านั้น · ในเกม hit-stop 60 ms + สั่น 2 px ที่ F48 · บัฟอยู่ต่อหลังท่าจบ F95',
    ],
}
json.dump({'fps': FPS, 'frames': N, 'canvas': [W, H], 'upscale': UP, 'ground': GROUND,
           'characterTiming': [{'from': a, 'to': b, 'char': f'C{c:02d}', 'drawnFrame': c} for a, b, c in CHAR],
           'rootTracks': {'travel': [[0, 0], [N - 1, 0]], 'height': [[0, 0], [N - 1, 0]]},
           'perFrame': pf, 'vfx': LOG, 'sheet': meta, 'gameFx': game_fx, 'game': game},
          open(f'{OUT}/garrick_ult_timeline.json', 'w'), indent=1, ensure_ascii=False)
print(json.dumps({'scale': SC, 'gameFx': game_fx, 'game': game, 'aura': len(AURA_SEQ)}, indent=1, default=float))
