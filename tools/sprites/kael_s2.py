"""Kael Ashen Vanguard — Skill 2 Relentless Cross: VFX cut + 60 FPS preview + timeline JSON + in-game FX strips.

Canonical sources (assets/heroes/Kael — approved, never edited):
  character/kael_s2_character_14f.png  14 frames, 2 rows × 7 (row 6 of hero-kael.png, built by tools/sprites/kael.py;
                               F4–F6 redrawn as a horizontal cut by tools/sprites/kael_s2_edit.py — derived, source untouched)
  vfx/kael_s2_main_vfx.png     Main VFX, row 1 = horizontal cut arc 5 frames (hit 1) · row 2 = rising diagonal arc 6
                               frames (hit 2) — used per the user's decision (the folder is the authority, timeline v2
                               says impact-only)
  vfx/kael_s2_impact_vfx.png   Impact VFX, row 1 = ground burst 6 frames (hit 1) · row 2 = rising burst 6 frames (hit 2)
  timeline/kael_timeline_v2.json (skill_2): 14 frames at 12 FPS (provisional) · damage hit 1 F5 (horizontal cut) +
                               impact · damage hit 2 F10 (rising reverse diagonal cut) + impact

Timeline (60 FPS preview, 1 character frame = 5 T = 83.33 ms; 70 T = 1.17 s):
  F1 READY T00 · F2 PREPARE T05 · F3 WIND_UP_HORIZONTAL T10 · F4 RELEASE_HORIZONTAL T15 (main 1) ·
  F5 HIT_1 T20 (damage #1 40 % + impact 1) · F6 FOLLOW_THROUGH_1 T25 · F7 TRANSITION T30 · F8 RELOAD_RISING T35 ·
  F9 RELEASE_RISING T40 (main 2) · F10 HIT_2 T45 (damage #2 60 % (+20 % combo) + impact 2) · F11 FOLLOW_THROUGH_2 T50 ·
  F12 DECELERATE T55 · F13 RECOVERY T60 · F14 READY_END T65 → T69

In game: two DAMAGE events on the clip = kit S2 repeat 2 (weights 0.4 / 0.6, comboBonus 0.2) — each hit index resolves
once · `kl-s2-main1/2` = self on VFX_SPAWN #0 / #1 · `kl-s2-impact1/2` = target on impact hit 0 / 1.

Usage: python3 tools/sprites/kael_s2.py <out dir>
"""
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

SRC = 'assets/heroes/Kael'
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/kael_s2'
os.makedirs(OUT, exist_ok=True)
FPS, N, PER = 60, 70, 5                  # 14 character frames × 5 T (12 FPS provisional, timeline_v2)
CELL_W, CELL_H, ROOT = 260, 170, (130, 155)
W, H, UP = 430, 200, 3
GROUND, X0 = 168, 120
CELL_PX = 80
EX = X0 + CELL_PX                        # the target stands one cell ahead
REL1, HIT1, REL2, HIT2 = 15, 20, 40, 45   # F4 / F5 / F9 / F10
CHAR_SCALE = 0.256                       # VFX sheets drawn at the S1 sheet's scale (same canvas 1983 × 793)
MAIN_DX = 52                             # Main VFX cell centre ahead of his feet (the cut crosses the target line)
IMPACT_DX = -10                          # Impact VFX: at the target's contact side (toward Kael)
MAIN1_LIFT = 12                          # the horizontal arc (main row 1) rides at blade height (chest), not on the ground
VFX_GROW = 1.35                          # user 2026-10: S2 VFX bigger than the sheet's drawn scale

atlas = np.array(Image.open('public/sprites/hero-kael.png').convert('RGBA'))
ROW = atlas[6 * CELL_H:7 * CELL_H]
CHAR = [(i * PER, i * PER + PER - 1, i + 1) for i in range(14)]
POSES = {1: ('READY', 'ยืนพร้อม', 'CAST_START'),
         2: ('PREPARE_FIRST_CUT', 'เตรียมฟันแรก', ''),
         3: ('WIND_UP_HORIZONTAL', 'ง้างดาบไปด้านหลัง', 'ANTICIPATION'),
         4: ('RELEASE_HORIZONTAL', 'กวาดดาบ (ใบดาบหันเข้าหาจอ)', 'VFX_SPAWN main 1'),
         5: ('HIT_1_HORIZONTAL_CUT', 'ฟันแนวนอนผ่านเป้า', 'DAMAGE #1 + impact 1'),
         6: ('FOLLOW_THROUGH_1', 'ดาบเลยไปฝั่งไกล', ''),
         7: ('TRANSITION_TO_REVERSE', 'ลดดาบลงต่ำ', ''),
         8: ('RELOAD_RISING_CUT', 'ดาบต่ำ เตรียมเสย', ''),
         9: ('RELEASE_RISING_CUT', 'เสยขึ้น', 'VFX_SPAWN main 2'),
         10: ('HIT_2_RISING_DIAGONAL', 'ฟันเสยเฉียงผ่านเป้า', 'DAMAGE #2 + impact 2'),
         11: ('FOLLOW_THROUGH_2', 'ดาบขึ้นสูง', ''),
         12: ('DECELERATE', 'ชะลอ', ''),
         13: ('RECOVERY', 'ลดดาบ', 'RECOVERY'),
         14: ('READY_END', 'กลับท่าพร้อม', '')}


def pose(c):
    return ROW[:, (c - 1) * CELL_W:c * CELL_W]


def char_at(t):
    return next((c for a, b, c in CHAR if a <= t <= b), CHAR[-1][2])


def step_of(t):
    return round(t / PER, 3)


ENEMY = np.array(Image.open('public/sprites/enemy-goblin-fighter.png').convert('RGBA'))[0:100, 0:132][:, ::-1]
ENEMY_ROOT = (132 - 66, 86)


# ------------------------------------------------------------------ VFX (alpha unmixed from the magenta key)
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


def dividers(m, n, win=70):
    """x dividers between n poses: the emptiest column near each k/n of the width (art is never split evenly)"""
    w = m.shape[1]
    col = np.convolve(m.sum(0).astype(float), np.ones(5) / 5, 'same')
    return [int(k * w / n) - win + int(np.argmin(col[int(k * w / n) - win:int(k * w / n) + win])) for k in range(1, n)]


def cut(name, counts):
    """counts per row (e.g. 5 + 6); each blob goes whole to the slot its centre falls in (a blob is only split when it really spans
    two slots); pivot = slot centre x on the sheet row's ground line"""
    im = unmix(name)
    hard = im[..., 3] > 40
    h = im.shape[0]
    rows = hard.sum(1)
    mid = int(h * 0.35) + int(np.argmin(rows[int(h * 0.35):int(h * 0.65)]))   # emptiest row between the two rows
    out = []
    for (y0, y1), per_row in zip([(0, mid), (mid, h)], counts):
        band = im[y0:y1]
        m = hard[y0:y1]
        divs = dividers(m, per_row)
        edges = [0] + divs + [band.shape[1]]
        lab, k = ndimage.label(band[..., 3] > 0, np.ones((3, 3)))
        slot = np.digitize(np.arange(band.shape[1]), divs)
        own = np.full(lab.shape, -1)
        for i in range(1, k + 1):
            sel = lab == i
            ks, cnt = np.unique(np.broadcast_to(slot, lab.shape)[sel], return_counts=True)
            if len(ks) > 1 and np.sort(cnt)[-2] >= 0.15 * sel.sum():
                own[sel] = np.broadcast_to(slot, lab.shape)[sel]
            else:
                own[sel] = ks[np.argmax(cnt)]
        row = []
        for s in range(per_row):
            fr = band.copy()
            fr[own != s] = 0
            # specks of a neighbouring row / stray streaks far from this frame's art: drop (kept within 60 px of the mass)
            ml, mk = ndimage.label(fr[..., 3] > 12, np.ones((3, 3)))
            if mk > 1:
                sz = ndimage.sum(np.ones(ml.shape), ml, range(1, mk + 1))
                big = ml == 1 + int(np.argmax(sz))
                near = ndimage.binary_dilation(big, iterations=60)
                for i in range(1, mk + 1):
                    if sz[i - 1] < 400 and not (near & (ml == i)).any():
                        fr[ml == i] = 0
            ys, xs = np.nonzero(fr[..., 3] > 12)
            fy0, fy1, fx0, fx1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
            cx = (edges[s] + edges[s + 1]) / 2
            row.append({'img': fr[fy0:fy1, fx0:fx1], 'px': cx - fx0, 'fy0': fy0, 'fy1': fy1})
        # the row's ground = the lowest edge of its cleaned frames (a stray speck near the band edge used to set it,
        # leaving the art floating) → the rising cut scoops up off the ground, bursts sit on it
        ground = max(f['fy1'] for f in row) - 1
        for f in row:
            out.append({'img': f['img'], 'px': f['px'], 'py': ground - f['fy0']})
    return out


MAIN = cut('vfx/kael_s2_main_vfx', [5, 6])
IMPACT = cut('vfx/kael_s2_impact_vfx', [6, 6])
SC = CHAR_SCALE * VFX_GROW


def plan(keys):
    out = {}
    for (t0, f), (t1, _) in zip(keys, keys[1:]):
        for t in range(t0, t1):
            if f:
                out[t] = f
    return out


# hit 1 (horizontal): main row 1 f1–f5 from F4 (T15), peak f3 on the contact F5 (T20) · impact row 1 f1–f6 from T20
# hit 2 (rising): main row 2 f6–f11 from F9 (T40), peak f9 on the contact F10 (T45) · impact row 2 f7–f12 from T45
MAIN_PLAN = plan([(15, 1), (17, 2), (20, 3), (24, 4), (28, 5), (32, None), (40, 6), (42, 7), (44, 8), (45, 9), (49, 10), (53, 11),
                  (57, None)])
IMPACT_PLAN = plan([(20, 1), (22, 2), (24, 3), (27, 4), (30, 5), (33, 6), (36, None), (45, 7), (47, 8), (49, 9), (52, 10),
                    (55, 11), (58, 12), (61, None)])


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
    a[..., 0], a[..., 1], a[..., 2] = (26 + 16 * sky), (22 + 14 * sky), (30 + 18 * sky)
    g = yy >= GROUND
    a[..., 0] = np.where(g, 46, a[..., 0])
    a[..., 1] = np.where(g, 46, a[..., 1])
    a[..., 2] = np.where(g, 44, a[..., 2])
    a[GROUND, :, :3] = (84, 80, 72)
    for k in range(-2, 5):
        x = int(X0 - CELL_PX / 2 + k * CELL_PX)
        if 0 <= x < W:
            a[GROUND + 1:GROUND + 8, x, :3] = (98, 94, 84)
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
    img = background()
    dr = ImageDraw.Draw(img)
    hit = HIT1 <= t <= HIT1 + 6 or HIT2 <= t <= HIT2 + 6
    hs = HIT1 if t < HIT2 else HIT2
    sx = (-3 if (t - hs) % 2 else 2) if hit else 0
    img.alpha_composite(Image.fromarray(ENEMY), (EX + sx - ENEMY_ROOT[0], GROUND - ENEMY_ROOT[1]))
    img.alpha_composite(Image.fromarray(pose(char_at(t))), (X0 - ROOT[0], GROUND - ROOT[1]))
    if t in MAIN_PLAN:
        a, px, py = tile(MAIN[MAIN_PLAN[t] - 1], SC)
        x, y = put(img, a, px, py, (X0 + MAIN_DX, GROUND - (MAIN1_LIFT if MAIN_PLAN[t] <= 5 else 0)))
        if log:
            LOG.append({'T': t, 'track': 'main', 'frame': MAIN_PLAN[t], 'x': x, 'y': y, 'opacity': 1, 'split': 'front', 'part': 'main'})
    if t in IMPACT_PLAN:
        a, px, py = tile(IMPACT[IMPACT_PLAN[t] - 1], SC)
        x, y = put(img, a, px, py, (EX + IMPACT_DX, GROUND))
        if log:
            LOG.append({'T': t, 'track': 'impact', 'frame': IMPACT_PLAN[t], 'x': x, 'y': y, 'opacity': 1, 'split': 'front', 'part': 'impact'})
    if hit:
        dr.text((EX - 14, GROUND - 100), 'HIT 1' if t < HIT2 else 'HIT 2', fill=(255, 220, 140))
    if log:
        if t == 0:
            ev(t, 'events', 1)
        if t in (REL1, REL2):
            ev(t, 'events', 2)
        for i, ht in enumerate((HIT1, HIT2)):
            if ht <= t <= ht + 1:
                ev(t, 'damage', i + 1, 1.0 if t == ht else 0.5)
        if t == 60:
            ev(t, 'events', 3)
    return img.resize((W * UP, H * UP), Image.NEAREST).convert('RGB')


frames = [frame(t) for t in range(N + 4)]
tmp = tempfile.mkdtemp()
for i, f in enumerate(frames):
    f.save(f'{tmp}/f{i:03d}.png')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-i', f'{tmp}/f%03d.png', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                '-crf', '14', f'{OUT}/kael_s2_preview_60fps.mp4'], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-i', f'{tmp}/f%03d.png', '-vf',
                'fps=30,scale=645:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=200[p];[b][p]paletteuse=dither=bayer',
                '-loop', '0', f'{OUT}/kael_s2_preview_30fps.gif'], check=True)
KEYS = [0, 10, 15, 20, 24, 30, 35, 40, 45, 49, 55, 65]
cw, ch = 430, 200
sheet = Image.new('RGB', (cw * 4, ch * 3))
dr = ImageDraw.Draw(sheet)
for i, t in enumerate(KEYS):
    sheet.paste(frames[t].resize((cw, ch), Image.NEAREST), ((i % 4) * cw, (i // 4) * ch))
    dr.text(((i % 4) * cw + 6, (i // 4) * ch + 4), f'T{t:03d} F{char_at(t):02d}', fill=(255, 255, 255))
sheet.save(f'{OUT}/kael_s2_preview_contact.png')


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
    out.save(f'{OUT}/fx-kael-s2-{name}.png', optimize=True)
    return {'frames': len(tiles), 'w': w, 'h': h, 'frameMs': round(frame_ms, 2), 'pivot': [round((l + 1) / w, 4), round((u + 1) / h, 4)]}


game_fx = {
    'main1': bake('main1', [tile(MAIN[MAIN_PLAN[t] - 1], SC) for t in sorted(MAIN_PLAN) if t < 35]),
    'main2': bake('main2', [tile(MAIN[MAIN_PLAN[t] - 1], SC) for t in sorted(MAIN_PLAN) if t >= 35]),
    'impact1': bake('impact1', [tile(IMPACT[IMPACT_PLAN[t] - 1], SC) for t in sorted(IMPACT_PLAN) if t < 40]),
    'impact2': bake('impact2', [tile(IMPACT[IMPACT_PLAN[t] - 1], SC) for t in sorted(IMPACT_PLAN) if t >= 40]),
}
steps = [round((b - a + 1) * 1000 / FPS) for a, b, _ in CHAR]
steps[-1] += round(N * 1000 / FPS) - sum(steps)
game = {'steps': steps,
        'events': {'CAST_START': 0, 'ANTICIPATION_PEAK': step_of(10), 'STRIKE_START': [step_of(REL1), step_of(REL2)],
                   'VFX_SPAWN': [step_of(REL1), step_of(REL2)], 'DAMAGE': [step_of(HIT1), step_of(HIT2)],
                   'IMPACT': [step_of(HIT1), step_of(HIT2)], 'RECOVERY_START': step_of(60)},
        'mainDx': round(MAIN_DX / CELL_PX * 100, 2), 'main1Dy': round(27.25 - MAIN1_LIFT / CELL_PX * 100, 2), 'impactDx': round(-IMPACT_DX / CELL_PX * 100, 2)}

pf = [{'T': t, 'char': f'C{char_at(t):02d}', 'drawnFrame': char_at(t), 'root': [X0, GROUND],
       'spearTip': [X0 + 60, GROUND - 45], 'center': [X0, GROUND - 40]} for t in range(N)]
meta = {
    'name': 'kael_s2_sync_sheet',
    'readme': ['Timeline Sync Sheet — Skill 2 Relentless Cross · Kael Ashen Vanguard', '',
               '60 FPS พรีวิว · 14 ท่า × 5 T (12 FPS ชั่วคราวตาม timeline_v2) = 70 เฟรม T000–T069 = 1.17 วินาที',
               'ตัวละคร 14 ท่า (2 × 7) + Main VFX 5 + 6 เฟรม + Impact VFX 6 + 6 เฟรม · ดาเมจ 2 ครั้ง F5 / F10',
               'F4–F6 แก้ใบดาบให้เป็นฟันแนวนอน (ไฟล์อนุพันธ์ ไม่แตะต้นฉบับ: tools/sprites/kael_s2_edit.py)',
               'ที่มา: assets/heroes/Kael > tools/sprites/kael_s2.py > kael_s2_timeline.json > tools/sprites/ult_sync_sheet.py'],
    'gameNote': 'Game ms = steps ของท่า skill2 ใน SHEETS hero-kael.png (รวม 1167 ms) · 170 % แบ่ง 40 / 60 % · ครั้งที่ 2 +20 % ถ้าโดนเป้าเดิมทั้งคู่',
    'title': 'Timeline Sync Sheet — Skill 2 Relentless Cross  ·  Kael Ashen Vanguard',
    'subtitle': '60 FPS · 70 frames (T000–T069) = 1.17 s · 1 character frame = 5 columns (12 FPS) · hit 1 F5 horizontal cut · '
                'hit 2 F10 rising reverse diagonal cut',
    'phases': [[0, 14, 'A', 'READY / WIND-UP', [120, 130, 150], 'ตั้งท่า ง้างดาบ'],
               [15, 29, 'B', 'HORIZONTAL CUT', [230, 110, 90], 'กวาด F4 · โดน F5 · ตามดาบ F6'],
               [30, 39, 'C', 'TRANSITION', [200, 170, 90], 'ลดดาบต่ำ เตรียมเสย'],
               [40, 54, 'D', 'RISING CUT', [235, 130, 70], 'เสย F9 · โดน F10 · ตามดาบ F11'],
               [55, 69, 'E', 'RECOVER', [110, 160, 130], 'ชะลอ กลับท่า']],
    'poses': {c: [f'F{c}', f'{v[0]} — {v[1]}', v[2]] for c, v in POSES.items()},
    'gameSteps': steps,
    'hits': [HIT1, HIT2],
    'events': [[0, 'CAST_START', 'F1'], [10, 'WIND_UP', 'F3'], [REL1, 'VFX_SPAWN main 1', 'F4 กวาดแนวนอน'],
               [HIT1, 'DAMAGE #1 (40 %)', 'F5 + impact 1'], [REL2, 'VFX_SPAWN main 2', 'F9 เสยขึ้น'],
               [HIT2, 'DAMAGE #2 (60 % +combo)', 'F10 + impact 2'], [60, 'RECOVERY', 'F13'], [69, 'CLIP END', 'F14']],
    'lanes': 5,
    'tracks': [['main', 'L2 Main VFX (skill2_main)', [235, 160, 90], 'fx-kael-s2-main1 / main2 (kael_s2_main_vfx.png 5 + 6 fr)',
                'L2 · หน้าตัวละคร', f'หน้าเท้าเคล +{MAIN_DX} px', 'F4 T015 แถว 1 (แนวนอน) · F9 T040 แถว 2 (เสยขึ้น) · peak ตรงจังหวะโดน'],
               ['impact', 'L3 Impact VFX (skill2_impact)', [255, 200, 120], 'fx-kael-s2-impact1 / impact2 (kael_s2_impact_vfx.png 6 + 6 fr)',
                'L3 · หน้าเป้า', f'เท้าเป้า {IMPACT_DX:+d} px', 'F5 T020 (แถว 1) · F10 T045 (แถว 2)'],
               ['damage', 'L4 Damage #1 / #2', [255, 110, 90], 'DAMAGE SINGLE 170 % × 0.4 / 0.6', '-', 'เป้าหลัก',
                'F5 ครั้งที่ 1 · F10 ครั้งที่ 2 (+20 % ถ้าเป้าเดิม) — แต่ละครั้งลงครั้งเดียว'],
               ['events', 'L5 Gameplay Events', [200, 200, 200], 'engine', '-', '-', 'F1 cast · F4/F9 release · F13 recovery']],
    'trackNames': {'main': 'Main VFX', 'impact': 'Impact VFX', 'damage': 'ดาเมจ', 'events': 'อีเวนต์'},
    'layers': [[1, 'ตัวละคร (L1)'], [2, 'Main VFX (L2)'], [3, 'Impact VFX (L3)'], [4, 'ดาเมจ (L4)'], [5, 'อีเวนต์ (L5)']],
    'shake': {str(HIT1): [2, 0], str(HIT1 + 1): [-2, 0], str(HIT2): [3, 0], str(HIT2 + 1): [-3, 0], str(HIT2 + 2): [1, 0]},
    'thumbs': [0, 10, 15, 20, 25, 35, 40, 45, 50, 65],
    'thumbLabels': {0: 'READY', 10: 'WIND UP', 15: 'RELEASE 1', 20: 'HIT 1', 25: 'FOLLOW 1', 35: 'RELOAD', 40: 'RELEASE 2',
                    45: 'HIT 2', 50: 'FOLLOW 2', 65: 'READY END'},
    'thumbCrop': [30 * UP, 30 * UP, 330 * UP, 190 * UP],
    'travelLabel': 'L1 Root X (px) — 0 (ยืนที่เดิม)', 'heightLabel': 'Root Y (px) — 0',
    'notes': [
        'ดาเมจ 2 ครั้ง: F5 ฟันแนวนอน 40 % · F10 ฟันเสยเฉียง 60 % (+20 % ถ้าครั้งแรกโดนเป้าเดียวกัน) — แต่ละครั้งลงครั้งเดียว',
        'ตายก่อนถึงจังหวะ / ท่าถูกยกเลิก = จังหวะที่เหลือไม่ลง · เป้าตายหลังครั้งแรก = ครั้งที่ 2 ไม่ลง',
        'Main VFX แถว 1 (แนวนอน) เกิด F4 / แถว 2 (เสยขึ้น) เกิด F9 · Impact แถว 1 / 2 เกิดที่เป้าตอนโดน',
        'F4–F6: ใบดาบแก้เป็นมุมหดสั้นตามแนวกวาด + รอยดาบแนวนอน (ไฟล์อนุพันธ์) — ภาพต้นฉบับไม่ถูกแก้',
        '12 FPS เป็นค่าชั่วคราว · ไม่มี root motion · สั่นเบา 2 / 3 px',
    ],
}
json.dump({'fps': FPS, 'frames': N, 'canvas': [W, H], 'upscale': UP, 'ground': GROUND,
           'characterTiming': [{'from': a, 'to': b, 'char': f'C{c:02d}', 'drawnFrame': c} for a, b, c in CHAR],
           'rootTracks': {'travel': [[0, 0], [N - 1, 0]], 'height': [[0, 0], [N - 1, 0]]},
           'perFrame': pf, 'vfx': [x for x in LOG if x['T'] < N], 'sheet': meta, 'gameFx': game_fx, 'game': game},
          open(f'{OUT}/kael_s2_timeline.json', 'w'), indent=1, ensure_ascii=False)
print(json.dumps({'gameFx': game_fx, 'game': game}, indent=1, default=float))
