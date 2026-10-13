"""Garrick Stoneward — Skill 2 Hammerfall: VFX cut + 60 FPS preview + timeline JSON + in-game FX strips.

Inputs (art/incoming/garrick, not committed):
  s2_vfx.png     the approved Skill 2 Main VFX, 10 frames (5 + 5) on flat #FF00FF: ground dust → the hammer's swing arc
                 sweeps down → shattering stone burst at the contact point (peak) → shock ring spreads → fades
  s2_impact.png  the approved Skill 2 Impact VFX, 8 frames in a row: light pillar + stone shards erupt → peak →
                 dust ring → debris settles
  public/sprites/hero-garrick.png row 6 (character, 10 frames, built by tools/sprites/garrick.py — nothing baked)

Production timeline (user spec 2026-10, 60 FPS, 54 frames F00–F53 = 0.90 s):
  A ready / weight shift F00–F09 · B heavy wind-up F10–F23 (ANTICIPATION START F10) · C attack release F24–F30 (ATTACK
  RELEASE F24 + Main VFX begins) · D damage / impact F31–F36 (DAMAGE + BREAK + KNOCKBACK + IMPACT VFX F31, adjacent
  lanes take the shock on the same frame) · E follow-through / recovery F37–F53 (RECOVERY START F37, ANIMATION
  COMPLETE F53). Root 0 (heavy, planted) · hit-stop 50 ms + 4 px shake at F31.

In game: kit S2 = FRONT_T3 (main cell in front 180 %, lanes above / below 60 %), Break 70, knockback 1 — all on the
clip's DAMAGE (F31) · `gr-s2-main` = on vfx at the hammer's contact point (in front of his feet, over him) ·
`gr-s2-impact` = on impact at the primary's feet · `gr-s2-shock` = the same impact, smaller / lighter, on every other
unit the slam hit (`perHit` + `exceptPrimary`).

Usage: python3 tools/sprites/garrick_s2.py <out dir>
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
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/garrick_s2'
os.makedirs(OUT, exist_ok=True)
FPS, N = 60, 54
CELL_W, CELL_H, ROOT = 260, 170, (130, 155)
W, H, UP = 430, 200, 3
GROUND, X0 = 168, 100
CELL_PX = 80
BODY_W = 84
ANTIC_T, RELEASE_T, HIT_T, REC_T, END_T = 10, 24, 31, 37, 53
EX = X0 + CELL_PX                       # the primary stands in the cell in front of him
LANE_DY = 14                            # preview depth: the lanes above / below drawn 14 px up / down
HITSTOP_MS, SHAKE_PX, SHAKE_MS = 50, 4, 120

# ------------------------------------------------------------------ character (atlas row 6, game scale)
atlas = np.array(Image.open('public/sprites/hero-garrick.png').convert('RGBA'))
ROW = atlas[6 * CELL_H:7 * CELL_H]
CHAR = [(0, 4, 1), (5, 9, 2), (10, 15, 3), (16, 19, 4), (20, 23, 5), (24, 30, 6), (31, 36, 7), (37, 42, 8), (43, 47, 9),
        (48, 53, 10)]
POSES = {1: ('READY', 'ยืนถือค้อนต่ำ', 'CAST_START F00'),
         2: ('WEIGHT SHIFT', 'ย่อตัว ถ่ายน้ำหนัก', ''),
         3: ('WIND-UP', 'เหวี่ยงค้อนไปหลัง', 'ANTICIPATION START F10'),
         4: ('RAISE', 'ยกค้อนเหนือไหล่', ''),
         5: ('OVERHEAD', 'ค้อนสูงสุดเหนือหัว', 'ง้างสุด'),
         6: ('RELEASE', 'ฟาดค้อนลง', 'ATTACK RELEASE F24 · Main VFX เริ่ม'),
         7: ('CONTACT', 'หัวค้อนกระแทกพื้นหน้าตัว', 'DAMAGE · BREAK · KNOCKBACK · IMPACT F31'),
         8: ('FOLLOW-THROUGH', 'ค้อนไถไปข้างหน้า', 'RECOVERY START F37'),
         9: ('RECOVER', 'ดึงค้อนกลับ', ''),
         10: ('STANCE', 'กลับท่าพร้อมรบ', 'ANIMATION COMPLETE F53')}


def pose(c):
    return ROW[:, (c - 1) * CELL_W:c * CELL_W]


def char_at(t):
    return next((c for a, b, c in CHAR if a <= t <= b), CHAR[-1][2])


def step_of(t):
    for i, (a, b, _) in enumerate(CHAR):
        if a <= t <= b:
            return round(i + (t - a) / (b - a + 1), 3)
    return float(len(CHAR))


def contact_dx():
    """the hammer head's ground contact in the CONTACT pose (C07): the lowest blob right of his feet → px from the root"""
    a = pose(7)[..., 3] > 0
    bot = np.nonzero(a.any(1))[0].max()
    xs = np.nonzero(a[bot - 8:bot + 1, ROOT[0] + 12:].any(0))[0] + ROOT[0] + 12
    return float((xs.min() + xs.max()) / 2 - ROOT[0])


CONTACT_DX = contact_dx()
# the swing arc + first burst read too close to his body at the bare contact point (user 2026-10): the Main VFX sits
# MAIN_PUSH px further ahead of the hammer contact
MAIN_PUSH = 20
CX = X0 + CONTACT_DX + MAIN_PUSH        # Main VFX anchor on the preview ground

ENEMY = np.array(Image.open('public/sprites/enemy-goblin-fighter.png').convert('RGBA'))[0:100, 0:132][:, ::-1]
ENEMY_ROOT = (132 - 66, 86)
DIM = ENEMY.copy()
DIM[..., :3] = (DIM[..., :3] * 0.62).astype(np.uint8)


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


def cut(name, rows, modes):
    """rows = [(y0, y1, divs)] — one frame per x-slot · pivot per frame: 'base' = centre of the ground contact (the
    bottom rows of a burst) · 'ring' = centre of the widest row (a shock ring on the ground)"""
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
            out.append(fr)
    frames = []
    for fr, mode in zip(out, modes):
        m = fr[..., 3] > 110
        h = m.shape[0]
        if mode == 'ring':
            span = [(np.ptp(np.nonzero(m[y])[0]) if m[y].any() else 0) for y in range(h)]
            lo = int(h * 0.35)
            cy = lo + int(np.argmax(span[lo:]))
            row = np.nonzero(m[cy])[0]
            cx = (row.min() + row.max()) / 2
        else:
            # the densest bright mass in the bottom 18 % = the burst's root on the ground
            band = m[int(h * 0.82):]
            col = band.sum(0).astype(float)
            col = np.convolve(col, np.ones(41) / 41, 'same')
            cx = float(np.argmax(col))
            cy = h - 1 - 0.04 * h
        frames.append({'img': fr, 'px': cx, 'py': cy})
    return frames


MAIN = cut('s2_vfx', [(0, 405, [428, 786, 1238, 1645]), (405, 690, [562, 1006, 1398, 1784])],
           ['base', 'base', 'base', 'base', 'base', 'ring', 'ring', 'ring', 'ring', 'ring'])
IMPACT = cut('s2_impact', [(170, 600, [182, 424, 780, 1094, 1388, 1661, 1917])],
             ['base', 'base', 'base', 'ring', 'ring', 'ring', 'ring', 'ring'])


def size(fr, thr=60):
    ys, xs = np.nonzero(fr['img'][..., 3] > thr)
    return xs.max() - xs.min() + 1, ys.max() - ys.min() + 1


# sizes (preview / atlas px): Main burst peak (f5) ≈ 1.35 × his body width · Impact peak (f3) ≈ 1.15 × body width ·
# adjacent-lane shock = the impact at 55 % scale / 60 % opacity
SC = {'main': 1.35 * BODY_W / size(MAIN[4])[0], 'impact': 1.15 * BODY_W / size(IMPACT[2])[0]}
SC['shock'] = SC['impact'] * 0.55
SHOCK_ALPHA = 0.6


def plan(keys):
    out = {}
    for (t0, f), (t1, _) in zip(keys, keys[1:]):
        for t in range(t0, t1):
            out[t] = f
    return out


# Main: dust at the contact point F24 → swing arc F26 / F28 / F30 → STONE BURST F31 → shock ring F34 → fades by F53
MAIN_PLAN = plan([(24, 1), (26, 2), (28, 3), (30, 4), (31, 5), (34, 6), (38, 7), (42, 8), (46, 9), (50, 10), (54, None)])
# Impact on the primary: erupts F31 → peak F33 (held to F36) → dust ring → settles by F53
IMPACT_PLAN = plan([(31, 1), (32, 2), (33, 3), (37, 4), (40, 5), (43, 6), (46, 7), (49, 8), (53, None)])


def knock_x(t):
    """preview of the engine's 1-cell knockback: the primary glides one cell back F31–F40"""
    if t < HIT_T:
        return 0.0
    k = min(1.0, (t - HIT_T) / 9)
    return CELL_PX * (1 - (1 - k) ** 3)


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
    a[..., 0], a[..., 1], a[..., 2] = (18 + 16 * sky), (20 + 18 * sky), (36 + 24 * sky)
    g = yy >= GROUND - LANE_DY
    a[..., 0] = np.where(g, 46, a[..., 0])
    a[..., 1] = np.where(g, 50, a[..., 1])
    a[..., 2] = np.where(g, 46, a[..., 2])
    for gy in (GROUND - LANE_DY, GROUND, GROUND + LANE_DY):
        a[gy, :, :3] = (70, 72, 62) if gy != GROUND else (82, 84, 72)
    for k in range(-2, 5):
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


def shake(t):
    """preview of the impact feel: hit-stop 50 ms (F31–F33 held in the game) then a 4 px shake decaying over 120 ms"""
    if not HIT_T <= t < HIT_T + round(SHAKE_MS * FPS / 1000):
        return 0, 0
    k = 1 - (t - HIT_T) / (SHAKE_MS * FPS / 1000)
    return round(SHAKE_PX * k * (1 if (t - HIT_T) % 2 == 0 else -1)), round(SHAKE_PX * 0.5 * k * (1 if (t - HIT_T) % 3 else -1))


def frame(t, log=True):
    img = BG.copy()
    kx = knock_x(t)
    # the lane above (a dimmed foe drawn behind) · the primary (front cell, his lane) · the lane below (empty — the shock
    # still shows where it lands)
    img.alpha_composite(Image.fromarray(DIM), (EX - ENEMY_ROOT[0], GROUND - LANE_DY - ENEMY_ROOT[1]))
    if t in IMPACT_PLAN and IMPACT_PLAN[t] <= 6:
        a, px, py = tile(IMPACT[IMPACT_PLAN[t] - 1], SC['shock'], SHOCK_ALPHA)
        x, y = put(img, a, px, py, (EX, GROUND - LANE_DY))
        if log:
            LOG.append({'T': t, 'track': 'shock', 'frame': IMPACT_PLAN[t], 'x': x, 'y': y, 'opacity': SHOCK_ALPHA, 'split': 'front', 'part': 'shock'})
    img.alpha_composite(Image.fromarray(pose(char_at(t))), (X0 - ROOT[0], GROUND - ROOT[1]))
    img.alpha_composite(Image.fromarray(ENEMY), (round(EX + kx) - ENEMY_ROOT[0], GROUND - ENEMY_ROOT[1]))
    if t in MAIN_PLAN:
        a, px, py = tile(MAIN[MAIN_PLAN[t] - 1], SC['main'])
        x, y = put(img, a, px, py, (CX, GROUND))
        if log:
            LOG.append({'T': t, 'track': 'main', 'frame': MAIN_PLAN[t], 'x': x, 'y': y, 'opacity': 1, 'split': 'front', 'part': 'main'})
    if t in IMPACT_PLAN:
        a, px, py = tile(IMPACT[IMPACT_PLAN[t] - 1], SC['impact'])
        x, y = put(img, a, px, py, (EX, GROUND))
        if log:
            LOG.append({'T': t, 'track': 'impact', 'frame': IMPACT_PLAN[t], 'x': x, 'y': y, 'opacity': 1, 'split': 'front', 'part': 'impact'})
    if t in IMPACT_PLAN and IMPACT_PLAN[t] <= 6:
        a, px, py = tile(IMPACT[IMPACT_PLAN[t] - 1], SC['shock'], SHOCK_ALPHA)
        put(img, a, px, py, (EX, GROUND + LANE_DY))
    if log:
        if RELEASE_T <= t <= HIT_T:
            ev(t, 'contact', 1 if t < HIT_T else 2, 0.4 if t < HIT_T else 1.0)
        if HIT_T <= t <= HIT_T + 1:
            for k in ('damage', 'break'):
                ev(t, k, 1, 1.0 if t == HIT_T else 0.5)
        if HIT_T <= t <= HIT_T + 9:
            ev(t, 'knock', 1, 0.5)
        if HIT_T <= t < HIT_T + 3:
            ev(t, 'feel', 1, 1.0)
        elif HIT_T + 3 <= t < HIT_T + 8:
            ev(t, 'feel', 2, 0.5)
    dx, dy = shake(t)
    if dx or dy:
        moved = Image.new('RGBA', img.size, (0, 0, 0, 255))
        moved.alpha_composite(img, (max(0, dx), max(0, dy)), (max(0, -dx), max(0, -dy)))
        img = moved
    return img.resize((W * UP, H * UP), Image.NEAREST).convert('RGB')


frames = [frame(t) for t in range(N)]
tmp = tempfile.mkdtemp()
for i, f in enumerate(frames):
    f.save(f'{tmp}/f{i:03d}.png')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-i', f'{tmp}/f%03d.png', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                '-crf', '14', f'{OUT}/garrick_s2_preview_60fps.mp4'], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-i', f'{tmp}/f%03d.png', '-vf',
                'fps=30,scale=645:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=200[p];[b][p]paletteuse=dither=bayer',
                '-loop', '0', f'{OUT}/garrick_s2_preview_30fps.gif'], check=True)
KEYS = [0, 6, 12, 20, 24, 28, 31, 33, 37, 43, 48, 53]
cw, ch = 430, 200
sheet = Image.new('RGB', (cw * 4, ch * 3))
dr = ImageDraw.Draw(sheet)
for i, t in enumerate(KEYS):
    sheet.paste(frames[t].resize((cw, ch), Image.NEAREST), ((i % 4) * cw, (i // 4) * ch))
    dr.text(((i % 4) * cw + 6, (i // 4) * ch + 4), f'F{t:02d} C{char_at(t):02d}', fill=(255, 255, 255))
sheet.save(f'{OUT}/garrick_s2_preview_contact.png')


# ------------------------------------------------------------------ in-game strips (60 FPS — every timeline frame)
def bake(name, tiles, frame_ms=1000 / 60):
    l = max(px for _, px, _ in tiles)
    r = max(a.shape[1] - px for a, px, _ in tiles)
    u = max(py for _, _, py in tiles)
    d = max(a.shape[0] - py for a, _, py in tiles)
    w, h = int(np.ceil(l + r)) + 2, int(np.ceil(u + d)) + 2
    out = Image.new('RGBA', (w * len(tiles), h), (0, 0, 0, 0))
    for k, (a, px, py) in enumerate(tiles):
        out.alpha_composite(Image.fromarray(a), (k * w + round(l - px) + 1, round(u - py) + 1))
    out.save(f'public/sprites/fx-garrick-s2-{name}.png', optimize=True)
    return {'frames': len(tiles), 'w': w, 'h': h, 'frameMs': round(frame_ms, 2), 'pivot': [round((l + 1) / w, 4), round((u + 1) / h, 4)]}


game_fx = {
    'main': {**bake('main', [tile(MAIN[MAIN_PLAN[t] - 1], SC['main']) for t in sorted(MAIN_PLAN)]), 'dx': round((CONTACT_DX + MAIN_PUSH) * 1.25, 2)},
    'impact': bake('impact', [tile(IMPACT[IMPACT_PLAN[t] - 1], SC['impact']) for t in sorted(IMPACT_PLAN)]),
    'shock': bake('shock', [tile(IMPACT[IMPACT_PLAN[t] - 1], SC['shock'], SHOCK_ALPHA) for t in sorted(IMPACT_PLAN) if IMPACT_PLAN[t] <= 6]),
}
steps = [round((b - a + 1) * 1000 / FPS) for a, b, _ in CHAR]
steps[-1] += round(N * 1000 / FPS) - sum(steps)
game = {'steps': steps,
        'events': {'CAST_START': 0, 'ANTICIPATION_PEAK': step_of(ANTIC_T), 'STRIKE_START': step_of(RELEASE_T),
                   'VFX_SPAWN': step_of(RELEASE_T), 'DAMAGE': step_of(HIT_T), 'IMPACT': step_of(HIT_T), 'RECOVERY_START': step_of(REC_T)},
        'impact': {'hitStopMs': HITSTOP_MS, 'shakePx': SHAKE_PX, 'shakeMs': SHAKE_MS}}

# ------------------------------------------------------------------ timeline JSON (+ sync-sheet meta)
pf = [{'T': t, 'char': f'C{char_at(t):02d}', 'drawnFrame': char_at(t), 'root': [X0, GROUND],
       'spearTip': [round(CX), GROUND], 'center': [X0, GROUND - 40]} for t in range(N)]
meta = {
    'name': 'garrick_s2_sync_sheet',
    'readme': ['Timeline Sync Sheet — Skill 2 Hammerfall · Garrick Stoneward (production)', '',
               '60 FPS, 54 เฟรม (F00–F53) = 0.90 วินาที · ตัวละคร 10 ท่า + Main VFX 10 เฟรม + Impact VFX 8 เฟรม (+ Shock เลนข้าง)',
               'Frames = ทุกเฟรม · Character = ท่า C01–C10 + ความยาวในเกม · VFX Tracks / Events / Layers',
               f'หน่วย: px = พิกเซลของแผ่นเกม (canvas 430×200, พื้น y = 168) · 80 px = 1 ช่อง · หัวค้อนกระแทกพื้นหน้าเท้า {CONTACT_DX:.0f} px · '
               'เลนบน/ล่างแสดงเป็นความลึก ±14 px',
               'ที่มา: tools/sprites/garrick_s2.py > garrick_s2_timeline.json > tools/sprites/ult_sync_sheet.py'],
    'gameNote': 'Game ms = steps ของท่า skill2 ใน SHEETS hero-garrick.png (รวม 900 ms, ไม่รวม hit-stop 50 ms) · '
                'DAMAGE / BREAK 70 / KNOCKBACK 1 ช่อง / Shock เลนข้าง ลงพร้อมกันที่ F31',
    'title': 'Timeline Sync Sheet — Skill 2 Hammerfall  ·  Garrick Stoneward · The Iron Bell',
    'subtitle': '60 FPS · 54 frames (F00–F53) = 0.90 s · 1 column = 1 frame (16.7 ms) · DAMAGE / BREAK / KNOCKBACK F31 · '
                'hit-stop 50 ms + shake 4 px · root 0',
    'phases': [[0, 9, 'A', 'READY / WEIGHT SHIFT', [120, 130, 150], 'ถ่ายน้ำหนัก'],
               [10, 23, 'B', 'HEAVY WIND-UP', [170, 140, 90], 'ง้างค้อน'],
               [24, 30, 'C', 'ATTACK RELEASE', [230, 170, 80], 'ฟาดลง'],
               [31, 36, 'D', 'DAMAGE / IMPACT', [235, 95, 70], 'กระแทก'],
               [37, 53, 'E', 'FOLLOW-THROUGH / RECOVERY', [100, 160, 130], 'กลับท่า']],
    'poses': {c: [f'F{c}', f'{v[0]} — {v[1]}', v[2]] for c, v in POSES.items()},
    'gameSteps': steps,
    'hits': [HIT_T],
    'events': [[0, 'CAST_START', 'C01'], [ANTIC_T, 'ANTICIPATION START', 'C03 ง้าง'], [RELEASE_T, 'ATTACK RELEASE', 'C06 · Main VFX f1'],
               [HIT_T, 'DAMAGE FRAME', 'ช่องหน้า 180 %'], [HIT_T, 'BREAK APPLICATION', 'Break 70 · ตัดร่าย'],
               [HIT_T, 'KNOCKBACK APPLICATION', 'ผลัก 1 ช่อง'], [HIT_T, 'IMPACT VFX SPAWN', 'เท้าเป้า + shock เลนข้าง'],
               [REC_T, 'RECOVERY START', 'C08'], [END_T, 'ANIMATION COMPLETE', 'C10']],
    'lanes': 6,
    'tracks': [['contact', 'L2 Hammer Contact / Weapon Anchor', [235, 220, 170], f'จุดหัวค้อนแตะพื้น (+{CONTACT_DX:.0f} px หน้าเท้า)', '-',
                'หัวค้อน / จุดสัมผัส', 'F24 ค้อนเริ่มฟาด > F31 แตะพื้น (contact)'],
               ['main', 'L3 Skill 2 Main VFX', [245, 200, 110], 'fx-garrick-s2-main (s2_vfx.png 10 fr)', 'L3 · หน้าตัวละคร',
                f'หน้าจุดหัวค้อนแตะพื้น +{MAIN_PUSH} px', 'F24 ฝุ่น > F26–F30 รอยเหวี่ยง > F31 หินแตก peak > F34 วงกระแทก > จาง F53'],
               ['impact', 'L4 Skill 2 Impact VFX', [255, 150, 90], 'fx-garrick-s2-impact (s2_impact.png 8 fr)', 'L4 · หน้า',
                'เท้าเป้าหลัก', 'F31 ปะทุ > F33 peak (ค้างถึง F36) > วงฝุ่น > จาง F52'],
               ['damage', 'L5 Primary Target Damage', [235, 95, 70], 'DAMAGE FRONT_T3 main 180 %', '-', 'ช่องหน้าตัว (ทุกตัวในช่อง)',
                'F31'],
               ['shock', 'L6 Adjacent Cell Shock Damage', [255, 190, 140], 'FRONT_T3 splash 60 % · fx-garrick-s2-shock', 'L6 · หน้า',
                'เท้าศัตรูเลนบน/ล่าง', 'F31 · impact 55 % สเกล 60 % ความทึบ'],
               ['break', 'L7 Break / Knockback', [150, 190, 255], 'interrupt + Break 70 · KNOCKBACK 1', '-', 'เป้าหลัก',
                'F31 Break ลง (ตัดร่ายได้) · ผลักถอย 1 ช่อง'],
               ['knock', 'L7b Knockback travel', [120, 160, 230], 'board glide', '-', 'เป้าหลัก', 'F31–F40 ไถลถอย 1 ช่อง'],
               ['feel', 'L8 Hitstop / Camera Shake', [255, 255, 255], 'AnimDef.impact', '-', '-',
                f'F31 hit-stop {HITSTOP_MS} ms > สั่น {SHAKE_PX} px {SHAKE_MS} ms']],
    'trackNames': {'contact': 'Hammer contact', 'main': 'Main VFX', 'impact': 'Impact VFX', 'damage': 'ดาเมจเป้าหลัก',
                   'shock': 'Shock เลนข้าง', 'break': 'Break', 'knock': 'Knockback', 'feel': 'Hitstop/Shake'},
    'layers': [[1, 'ตัวละคร (L1)'], [2, 'Contact (L2)'], [3, 'Main VFX (L3)'], [4, 'Impact (L4)'], [5, 'ดาเมจ (L5)'],
               [6, 'Shock (L6)'], [7, 'Break/Knockback (L7)'], [8, 'Hitstop/Shake (L8)']],
    'shake': {str(t): list(shake(t)) for t in range(N) if shake(t) != (0, 0)},
    'thumbs': [0, 6, 12, 20, 24, 28, 31, 33, 37, 53],
    'thumbLabels': {0: 'READY', 6: 'WEIGHT SHIFT', 12: 'WIND-UP', 20: 'OVERHEAD', 24: 'RELEASE', 28: 'SWING',
                    31: 'DAMAGE / BREAK', 33: 'IMPACT PEAK', 37: 'RECOVERY', 53: 'COMPLETE'},
    'thumbCrop': [20 * UP, 30 * UP, 330 * UP, 195 * UP],
    'travelLabel': 'L1 Root X (px) — 0 (ยืนปักหลัก ไม่พุ่ง)', 'heightLabel': 'Root Y (px) — 0',
    'notes': [
        'แทงก์เกราะหนัก: ยืนที่เดิม (root 0) ไม่พุ่ง ไม่กระโดด — ถ่ายน้ำหนัก > ง้างค้อนหลัง > เหนือหัว > ฟาดลงช่องหน้าตัว',
        'ค้อนชิ้นเดียวแข็ง: ด้าม/หัว/ตำแหน่งมือตามภาพที่อนุมัติ ไม่ยืดไม่บิด · ภาพตัวละครกับ VFX แยกกันตอน runtime',
        'F31 = DAMAGE + BREAK 70 + KNOCKBACK 1 ช่อง + IMPACT VFX + Shock เลนบน/ล่าง (60 %) ลงพร้อมกัน',
        f'Main VFX ยึดหน้าจุดหัวค้อนแตะพื้น {MAIN_PUSH} px (= {CONTACT_DX + MAIN_PUSH:.0f} px หน้าเท้า) · Impact VFX ยึดเท้าเป้าหลัก · Shock = impact ย่อ 55 % / 60 % บนศัตรูเลนข้าง',
        f'Hitstop {HITSTOP_MS} ms + สั่นกล้อง {SHAKE_PX} px {SHAKE_MS} ms ที่ F31 (ไม่นับรวมใน 0.90 วิ) · ไม่มีซูม',
        'พรีวิว: เลนบนมีศัตรูสีหม่นเหลื่อม -14 px, เลนล่าง (+14 px) ว่าง — shock ยังแสดงจุดที่ลง · ผลักถอย = ไถล 1 ช่อง F31–F40 (บนกระดานจริงเลื่อนตามเอนจิน)',
    ],
}
json.dump({'fps': FPS, 'frames': N, 'canvas': [W, H], 'upscale': UP, 'ground': GROUND,
           'characterTiming': [{'from': a, 'to': b, 'char': f'C{c:02d}', 'drawnFrame': c} for a, b, c in CHAR],
           'rootTracks': {'travel': [[0, 0], [N - 1, 0]], 'height': [[0, 0], [N - 1, 0]]},
           'perFrame': pf, 'vfx': LOG, 'sheet': meta, 'gameFx': game_fx, 'game': game},
          open(f'{OUT}/garrick_s2_timeline.json', 'w'), indent=1, ensure_ascii=False)
print(json.dumps({'scale': SC, 'contact': CONTACT_DX, 'gameFx': game_fx, 'game': game}, indent=1, default=float))
