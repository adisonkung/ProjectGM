"""Garrick Stoneward — Skill 1 Brace for Impact: VFX cut + 60 FPS preview + timeline JSON + in-game FX strips.

Inputs (art/incoming/garrick, not committed):
  s1_vfx.png   the approved Skill 1 Main VFX, 10 frames (5 + 5) on flat #FF00FF: gold rune ring → light spikes → crystal
               guard wings + golden sword crest (peak, stone debris) → wings break → ring fades
  s1_aura.png  the Skill 1 Guard Aura, 8 frames in a row: small gold ring → spikes rise → crescent guard → settle
               (a loop: f1 ≈ f8)
  public/sprites/hero-garrick.png row 5 (character, 10 frames, built by tools/sprites/garrick.py — nothing baked)

Production timeline (user spec 2026-10, 60 FPS, 66 frames F00–F65 = 1.10 s):
  A preparation F00–F17 (lowers his centre of gravity) · B guard activation F18–F29 (BRACE START F18, plants the hammer,
  Main VFX rises around him) · C defensive stance active F30–F49 (SKILL ACTIVATION F30 = damage reduction + taunt +
  Guard Aura loop starts) · D character settle F50–F65 (CAST COMPLETE F65; the aura keeps looping on its own).
  First-hit stagger = runtime (the first qualifying foe hit during the stance), never a fixed animation frame.

In game: the kit's effects land on the clip's DAMAGE event (F30) · `gr-s1-main` = on vfx at his feet, drawn IN FRONT of him
(user 2026-10: the skill reads over the hero) · `gr-s1-aura` = on impact at his feet, also in front, 4 loops × 0.75 s =
the 3 s guard (taunt_guard / brace_counter) then fades.

Usage: python3 tools/sprites/garrick_s1.py <out dir>
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
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/garrick_s1'
os.makedirs(OUT, exist_ok=True)
FPS, N = 60, 66
CELL_W, CELL_H, ROOT = 260, 170, (130, 155)
W, H, UP = 430, 200, 3
GROUND, X0 = 168, 120
CELL_PX = 80
BODY_W = 84                             # his idle width at game scale (cape + hammer)
EX = X0 + 118                            # the enemy he taunts stands one cell ahead
ACT_T, BRACE_T, END_T = 30, 18, 65
HIT_T = 56                              # preview only: the first enemy hit during the stance (dynamic in game)
AURA_MS = 93.75                         # 8 frames × 93.75 ms = 0.75 s per loop → 4 loops = the 3 s guard

# ------------------------------------------------------------------ character (atlas row 5, game scale)
atlas = np.array(Image.open('public/sprites/hero-garrick.png').convert('RGBA'))
ROW = atlas[5 * CELL_H:6 * CELL_H]
CHAR = [(0, 5, 1), (6, 11, 2), (12, 17, 3), (18, 22, 4), (23, 26, 5), (27, 29, 6), (30, 37, 7), (38, 49, 8), (50, 57, 9),
        (58, 65, 10)]
POSES = {1: ('READY', 'ยืนถือค้อนข้างตัว', 'CAST_START F00'),
         2: ('LOWER', 'ย่อตัว ลดจุดศูนย์ถ่วง', ''),
         3: ('GRIP', 'กำด้ามค้อนสองมือ', ''),
         4: ('BRACE START', 'ยกค้อนขึ้นตั้ง', 'CAST / BRACE START F18'),
         5: ('BRING DOWN', 'ดึงค้อนลงหน้าตัว', ''),
         6: ('PLANT', 'ปักค้อนตั้งตรงหน้าตัว', 'Main VFX ขึ้นรอบตัว'),
         7: ('GUARD', 'ตั้งการ์ด ก้มรับแรง', 'SKILL ACTIVATION F30 · DR · TAUNT · AURA'),
         8: ('GUARD HOLD', 'ค้างท่าตั้งรับ', ''),
         9: ('SETTLE', 'ผ่อนเข้าท่าตั้งรับ', 'CHARACTER SETTLE F50'),
         10: ('SETTLED', 'ยืนถือค้อน — ออร่ายังวนต่อ', 'CHARACTER CAST COMPLETE F65')}


def pose(c):
    return ROW[:, (c - 1) * CELL_W:c * CELL_W]


def char_at(t):
    return next((c for a, b, c in CHAR if a <= t <= b), CHAR[-1][2])


def step_of(t):
    for i, (a, b, _) in enumerate(CHAR):
        if a <= t <= b:
            return round(i + (t - a) / (b - a + 1), 3)
    return float(len(CHAR))


ENEMY = np.array(Image.open('public/sprites/enemy-goblin-fighter.png').convert('RGBA'))[0:100, 0:132][:, ::-1]
ENEMY_ROOT = (132 - 66, 86)


# ------------------------------------------------------------------ VFX (pixel art + soft glow → alpha unmixed)
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
    """rows = [(y0, y1, divs)] — one frame per x-slot; pivot = the ring centre (widest alpha row in the lower part)"""
    im = unmix(name)
    out = []
    for y0, y1, divs in rows:
        xs = [0] + divs + [im.shape[1]]
        for a, b in zip(xs, xs[1:]):
            fr = im[y0:y1, a:b].copy()
            m = fr[..., 3] > 40
            lab, k = ndimage.label(m, np.ones((3, 3)))
            if k > 1:                     # keep the frame's art, drop specks from the neighbour slot edge
                sizes = ndimage.sum(m, lab, range(1, k + 1))
                keep = 1 + np.nonzero(sizes >= 6)[0]
                fr[~np.isin(lab, keep) & m] = 0
            ys, xx = np.nonzero(fr[..., 3] > 20)
            fy0, fy1, fx0, fx1 = ys.min(), ys.max() + 1, xx.min(), xx.max() + 1
            fr = fr[fy0:fy1, fx0:fx1]
            m = fr[..., 3] > 90
            h = m.shape[0]
            span = [(np.ptp(np.nonzero(m[y])[0]) if m[y].any() else 0) for y in range(h)]
            lo = int(h * 0.45)
            cy = lo + int(np.argmax(span[lo:]))
            row = np.nonzero(m[cy])[0]
            cx = (row.min() + row.max()) / 2
            out.append({'img': fr, 'px': cx, 'py': cy})
    return out


MAIN = cut('s1_vfx', [(150, 545, [292, 570, 850, 1118]), (555, 960, [290, 595, 888, 1175])])
AURA = cut('s1_aura', [(170, 490, [298, 617, 938, 1252, 1572, 1889, 2215])])


def size(fr, thr=60):
    ys, xs = np.nonzero(fr['img'][..., 3] > thr)
    return xs.max() - xs.min() + 1, ys.max() - ys.min() + 1


# sizes (preview / atlas px): Main VFX peak (f5) ≈ 1.5 × his body width · Guard Aura peak (f5) ≈ 1.15 × body width
SC = {'main': 1.5 * BODY_W / size(MAIN[4])[0], 'aura': 1.15 * BODY_W / size(AURA[4])[0]}


def plan(keys):
    out = {}
    for (t0, f), (t1, _) in zip(keys, keys[1:]):
        for t in range(t0, t1):
            out[t] = f
    return out


# Main VFX: rune ring F20 → spikes F23 / F26 → guard wings F28 → PEAK F30 (activation) → hold / break → ring fades F53
MAIN_PLAN = plan([(20, 1), (23, 2), (26, 3), (28, 4), (30, 5), (35, 6), (39, 7), (43, 8), (47, 9), (51, 10), (54, None)])


def aura_frame(t):
    """Guard Aura loop from F30 (frame 1 at activation), 93.75 ms per frame — independent of the cast clip"""
    if t < ACT_T:
        return None
    return int(((t - ACT_T) * 1000 / FPS) // AURA_MS) % 8 + 1


def aura_alpha(t):
    return min(1.0, 0.35 + 0.65 * (t - ACT_T) / 6) if t >= ACT_T else 0.0


def tile(fr, s, alpha=1.0, part=None):
    img = Image.fromarray(fr['img'])
    img = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)
    a = np.array(img)
    a[..., 3] = (a[..., 3].astype(float) * alpha).astype(np.uint8)
    px, py = fr['px'] * s, fr['py'] * s
    if part is not None:                 # back = above the ring centre line (behind him) · front = the ring's near half
        cut_y = int(round(py))
        if part == 'back':
            a[cut_y:, :, 3] = 0
        else:
            a[:cut_y, :, 3] = 0
    return a, px, py


def tracks_at(t):
    out = []
    if t in MAIN_PLAN:
        a, px, py = tile(MAIN[MAIN_PLAN[t] - 1], SC['main'])
        out.append(('main', MAIN_PLAN[t], a, px, py, 'front'))
    f = aura_frame(t)
    if f:
        a, px, py = tile(AURA[f - 1], SC['aura'], aura_alpha(t))
        out.append(('aura', f, a, px, py, 'front'))
    return out


def background(t):
    a = np.zeros((H, W, 4), np.uint8)
    yy = np.arange(H)[:, None]
    sky = np.clip(yy / GROUND, 0, 1)
    a[..., 0], a[..., 1], a[..., 2] = (18 + 16 * sky), (20 + 18 * sky), (36 + 24 * sky)
    g = yy >= GROUND
    a[..., 0] = np.where(g, 46, a[..., 0])
    a[..., 1] = np.where(g, 50, a[..., 1])
    a[..., 2] = np.where(g, 46, a[..., 2])
    a[GROUND, :, :3] = (82, 84, 72)
    for k in range(-2, 5):
        x = int(X0 - CELL_PX / 2 + k * CELL_PX)
        if 0 <= x < W:
            a[GROUND + 1:GROUND + 8, x, :3] = (96, 98, 84)
    a[..., 3] = 255
    return Image.fromarray(a)


def put(img, a, px, py, at):
    x, y = round(at[0] - px), round(at[1] - py)
    img.alpha_composite(Image.fromarray(a), (max(0, x), max(0, y)), (max(0, -x), max(0, -y)))
    return x, y


LOG = []


def ev(t, track, frame, op=1.0):
    LOG.append({'T': t, 'track': track, 'frame': frame, 'x': 0, 'y': 0, 'opacity': op, 'split': '-'})


def frame(t, log=True):
    img = background(t)
    dr = ImageDraw.Draw(img)
    # the enemy he taunts (preview only): lunges in for the first hit at F56, staggered after
    lunge = 6 if HIT_T - 2 <= t <= HIT_T else 0
    sx = -3 if HIT_T + 1 <= t <= HIT_T + 9 and (t - HIT_T) % 2 else 0
    img.alpha_composite(Image.fromarray(ENEMY), (EX - lunge + sx - ENEMY_ROOT[0], GROUND - ENEMY_ROOT[1]))
    if t >= ACT_T:                       # taunt mark over the enemy (UI marker, preview only)
        k = 1.0 if t < ACT_T + 4 else 0.7
        cx, cy = EX + 2, GROUND - 74
        dr.polygon([(cx, cy - 7), (cx + 6, cy + 4), (cx - 6, cy + 4)], outline=(255, int(170 * k), 60), fill=(120, 40, 20))
        dr.line([(cx, cy - 3), (cx, cy + 1)], fill=(255, 220, 120))
    if HIT_T <= t <= HIT_T + 9:          # first-hit stagger marker at the contact point (runtime: float 'เซ')
        cx, cy = EX - 22, GROUND - 40
        r = 5 + (t - HIT_T)
        dr.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(255, 210, 90))
        dr.text((EX - 12, GROUND - 98), 'STAGGER', fill=(255, 210, 90))
    tr = tracks_at(t)
    c = char_at(t)
    img.alpha_composite(Image.fromarray(pose(c)), (X0 - ROOT[0], GROUND - ROOT[1]))
    # the whole skill VFX is drawn IN FRONT of Garrick (user 2026-10) — the dome is see-through, he still reads
    for key, f, a, px, py, part in tr:
        x, y = put(img, a, px, py, (X0, GROUND))
        if log:
            LOG.append({'T': t, 'track': key, 'frame': f, 'x': x, 'y': y, 'opacity': round(aura_alpha(t) if key == 'aura' else 1, 2),
                        'split': 'front', 'part': key})
    if log:
        if t == BRACE_T:
            ev(t, 'events', 1)
        if ACT_T <= t <= ACT_T + 1:
            for k in ('taunt', 'dr', 'events'):
                ev(t, k, 1, 1.0 if t == ACT_T else 0.5)
        if t > ACT_T + 1:
            ev(t, 'dr', 2, 0.35)
            ev(t, 'taunt', 2, 0.35)
        if ACT_T <= t < HIT_T:
            ev(t, 'stagger', 1, 0.3)
        if HIT_T <= t <= HIT_T + 1:
            ev(t, 'stagger', 2, 1.0 if t == HIT_T else 0.5)
        if t == END_T:
            ev(t, 'events', 2)
    return img.resize((W * UP, H * UP), Image.NEAREST).convert('RGB')


frames = [frame(t) for t in range(N)]
tmp = tempfile.mkdtemp()
for i, f in enumerate(frames):
    f.save(f'{tmp}/f{i:03d}.png')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-i', f'{tmp}/f%03d.png', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                '-crf', '14', f'{OUT}/garrick_s1_preview_60fps.mp4'], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-i', f'{tmp}/f%03d.png', '-vf',
                'fps=30,scale=645:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=200[p];[b][p]paletteuse=dither=bayer',
                '-loop', '0', f'{OUT}/garrick_s1_preview_30fps.gif'], check=True)
KEYS = [0, 8, 18, 23, 28, 30, 34, 42, 50, 56, 60, 65]
cw, ch = 430, 200
sheet = Image.new('RGB', (cw * 4, ch * 3))
dr = ImageDraw.Draw(sheet)
for i, t in enumerate(KEYS):
    sheet.paste(frames[t].resize((cw, ch), Image.NEAREST), ((i % 4) * cw, (i // 4) * ch))
    dr.text(((i % 4) * cw + 6, (i // 4) * ch + 4), f'F{t:02d} C{char_at(t):02d}', fill=(255, 255, 255))
sheet.save(f'{OUT}/garrick_s1_preview_contact.png')


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
    out.save(f'public/sprites/fx-garrick-s1-{name}.png', optimize=True)
    return {'frames': len(tiles), 'w': w, 'h': h, 'frameMs': round(frame_ms, 2), 'pivot': [round((l + 1) / w, 4), round((u + 1) / h, 4)]}


game_fx = {}
game_fx['main'] = bake('main', [tile(MAIN[MAIN_PLAN[t] - 1], SC['main']) for t in sorted(MAIN_PLAN)])
game_fx['aura'] = bake('aura', [tile(AURA[k], SC['aura']) for k in range(8)], AURA_MS)
steps = [round((b - a + 1) * 1000 / FPS) for a, b, _ in CHAR]
steps[-1] += round(N * 1000 / FPS) - sum(steps)
game = {'steps': steps,
        'events': {'CAST_START': 0, 'ANTICIPATION_PEAK': step_of(12), 'STRIKE_START': step_of(BRACE_T), 'VFX_SPAWN': step_of(20),
                   'SKILL_ACTIVATE': step_of(ACT_T), 'DAMAGE': step_of(ACT_T), 'RECOVERY_START': step_of(50)}}

# ------------------------------------------------------------------ timeline JSON (+ sync-sheet meta)
pf = [{'T': t, 'char': f'C{char_at(t):02d}', 'drawnFrame': char_at(t), 'root': [X0, GROUND],
       'spearTip': [X0 + 24, GROUND - 70], 'center': [X0, GROUND - 40]} for t in range(N)]
meta = {
    'name': 'garrick_s1_sync_sheet',
    'readme': ['Timeline Sync Sheet — Skill 1 Brace for Impact · Garrick Stoneward (production)', '',
               '60 FPS, 66 เฟรม (F00–F65) = 1.10 วินาที · ตัวละคร 10 ท่า + Main VFX 10 เฟรม + Guard Aura 8 เฟรม (วนตามระยะบัฟ)',
               'Frames = ทุกเฟรม · Character = ท่า C01–C10 + ความยาวในเกม · VFX Tracks / Events / Layers',
               'หน่วย: px = พิกเซลของแผ่นเกม (canvas 430×200, พื้น y = 168) · 80 px = 1 ช่อง · ศัตรูที่ถูกยั่วยุห่าง ~1 ช่อง',
               'ที่มา: tools/sprites/garrick_s1.py > garrick_s1_timeline.json > tools/sprites/ult_sync_sheet.py'],
    'gameNote': 'Game ms = steps ของท่า skill ใน SHEETS hero-garrick.png (รวม 1100 ms) · DR + Taunt + Counter ลงที่ DAMAGE F30 · '
                'Guard Aura วน 4 รอบ × 0.75 วิ = 3 วิ ตามบัฟ · Stagger = runtime (ตีโดนครั้งแรก)',
    'title': 'Timeline Sync Sheet — Skill 1 Brace for Impact  ·  Garrick Stoneward · The Iron Bell',
    'subtitle': '60 FPS · 66 frames (F00–F65) = 1.10 s · 1 column = 1 frame (16.7 ms) · activation F30 (DR + taunt + guard aura) · '
                'first-hit stagger = runtime · no root motion / shake',
    'phases': [[0, 17, 'A', 'PREPARATION', [120, 130, 150], 'ย่อตัวเตรียมรับ'],
               [18, 29, 'B', 'GUARD ACTIVATION', [200, 170, 90], 'ปักค้อน ตั้งการ์ด'],
               [30, 49, 'C', 'DEFENSIVE STANCE ACTIVE', [90, 140, 230], 'ลดดาเมจ + ยั่วยุ + ออร่า'],
               [50, 65, 'D', 'CHARACTER SETTLE', [110, 160, 130], 'เข้าท่า ออร่าวนต่อ']],
    'poses': {c: [f'F{c}', f'{v[0]} — {v[1]}', v[2]] for c, v in POSES.items()},
    'gameSteps': steps,
    'hits': [ACT_T],
    'events': [[0, 'CAST_START', 'C01'], [BRACE_T, 'CAST / BRACE START', 'C04 ยกค้อน'], [20, 'MAIN_VFX_SPAWN', 'f1 วงรูนที่เท้า'],
               [27, 'HAMMER_PLANT', 'C06'], [ACT_T, 'SKILL_ACTIVATION', 'Main VFX peak f5'], [ACT_T, 'APPLY_DAMAGE_REDUCTION', 'taunt_guard 3 วิ'],
               [ACT_T, 'APPLY_TAUNT', 'FRONT_ARC'], [ACT_T, 'START_GUARD_AURA_LOOP', 'aura f1 · 0.75 วิ/รอบ'],
               [50, 'CHARACTER_SETTLE', 'C09'], [54, 'MAIN_VFX_END', 'f10 จางหมด'],
               [HIT_T, 'FIRST_HIT_STAGGER (dynamic)', 'ตัวอย่าง — runtime'], [END_T, 'CHARACTER CAST COMPLETE', 'C10']],
    'lanes': 7,
    'tracks': [['main', 'L2 Skill 1 Main VFX', [235, 200, 110], 'fx-garrick-s1-main (s1_vfx.png 10 fr)',
                'L2 · หน้าตัวละคร', 'เท้าการ์ริก (กลางวงพื้น)', 'F20 วงรูน > F28 ปีกการ์ด > F30 peak > แตก > จาง F53'],
               ['aura', 'L3 Guard Aura Loop', [150, 190, 255], 'fx-garrick-s1-aura (s1_aura.png 8 fr)',
                'L3 · หน้าตัวละคร', 'เท้าการ์ริก', 'F30 เริ่ม · 93.75 ms/เฟรม = 0.75 วิ/รอบ · วนตามบัฟ 3 วิ (4 รอบ) แล้วจาง'],
               ['taunt', 'L4 Taunt Activation', [255, 150, 90], 'APPLY_STATUS taunted · FRONT_ARC', '-', 'ศัตรูด้านหน้า',
                'F30 ยั่วยุ 3 วิ'],
               ['dr', 'L5 Damage Reduction Buff', [120, 200, 255], 'taunt_guard (DR 40 %) 3 วิ', '-', 'ตัวการ์ริก',
                'F30 เริ่ม · อยู่ต่อหลังจบท่า'],
               ['stagger', 'L6 First-Hit Stagger Trigger', [255, 210, 90], 'brace_counter > stagger 0.6 วิ', '-',
                'จุดสัมผัสของศัตรูที่ตี', 'armed F30 · ยิงเมื่อโดนตีครั้งแรก (runtime) — ตัวอย่างที่ F56'],
               ['events', 'L7 Gameplay Events', [200, 200, 200], 'engine (DAMAGE event = activation)', '-', '-',
                'F18 brace start · F30 activation · F65 cast complete']],
    'trackNames': {'main': 'Main VFX', 'aura': 'Guard Aura', 'taunt': 'ยั่วยุ', 'dr': 'ลดดาเมจ', 'stagger': 'Stagger',
                   'events': 'อีเวนต์'},
    'layers': [[1, 'ตัวละคร (L1)'], [2, 'Main VFX (L2)'], [3, 'Guard Aura (L3)'], [4, 'ยั่วยุ (L4)'], [5, 'ลดดาเมจ (L5)'],
               [6, 'Stagger (L6)'], [7, 'อีเวนต์ (L7)']],
    'shake': {},
    'thumbs': [0, 12, 18, 23, 28, 30, 38, 50, 56, 65],
    'thumbLabels': {0: 'READY', 12: 'LOWER', 18: 'BRACE START', 23: 'BRING DOWN', 28: 'PLANT', 30: 'ACTIVATION',
                    38: 'GUARD', 50: 'SETTLE', 56: 'FIRST HIT', 65: 'GUARDING'},
    'thumbCrop': [30 * UP, 50 * UP, 330 * UP, 190 * UP],
    'travelLabel': 'L1 Root X (px) — 0 (ยืนที่เดิม ไม่ขยับ)', 'heightLabel': 'Root Y (px) — 0',
    'notes': [
        'สกิลป้องกัน ไม่ใช่ท่าโจมตี: การ์ริกยืนที่เดิม (root 0) หันขวา ไม่กระโดด ไม่หมุน — ย่อ > ปักค้อน > ตั้งการ์ด',
        'F30 = จุดเดียวที่ระบบทำงาน: ลดดาเมจ (taunt_guard) + ยั่วยุศัตรูด้านหน้า + ติดอาวุธ counter + เริ่ม Guard Aura',
        'Main VFX ครั้งเดียว (F20–F53) ยึดเท้า วาดหน้าตัวละครทั้งชิ้น — โดมโปร่ง ตัวละครยังอ่านออก · Guard Aura ก็อยู่หน้าตัว',
        'Guard Aura = บัฟที่คงอยู่ แยกจากท่าร่าย: วนต่อหลังจบท่า (F65) จนครบ 3 วิของบัฟ แล้วจาง',
        'Stagger ไม่ผูกกับเฟรม: ศัตรูตัวแรกที่ตีโดนระหว่างตั้งรับ = เซ 0.6 วิ ครั้งเดียวต่อการร่าย (ตัวอย่างในพรีวิว F56)',
        'Stagger FX ยังไม่มี asset แยก — runtime แสดงป้ายลอย "เซ" ที่ศัตรู · ไม่มีสั่นกล้อง/ซูม/hit-stop',
    ],
}
json.dump({'fps': FPS, 'frames': N, 'canvas': [W, H], 'upscale': UP, 'ground': GROUND,
           'characterTiming': [{'from': a, 'to': b, 'char': f'C{c:02d}', 'drawnFrame': c} for a, b, c in CHAR],
           'rootTracks': {'travel': [[0, 0], [N - 1, 0]], 'height': [[0, 0], [N - 1, 0]]},
           'perFrame': pf, 'vfx': LOG, 'sheet': meta, 'gameFx': game_fx, 'game': game},
          open(f'{OUT}/garrick_s1_timeline.json', 'w'), indent=1, ensure_ascii=False)
print(json.dumps({'scale': SC, 'gameFx': game_fx, 'game': game,
                  'pivots': [(round(f['px']), round(f['py']), f['img'].shape[:2]) for f in MAIN + AURA]}, indent=1, default=float))
