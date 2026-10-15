"""Kael Ashen Vanguard — Skill 1 Sundering Edge: VFX cut + 60 FPS preview + timeline JSON + in-game FX strips.

Canonical sources (assets/heroes/Kael — approved, never edited):
  vfx/kael_s1_main_vfx.png     Main VFX, 10 frames (5 + 5) on flat #FF00FF: thin crescent → widening slash arc with
                               stone debris → peak (f5) → arc breaks into streaks → fades (f10)
  vfx/kael_s1_impact_vfx.png   Impact VFX, 10 frames (5 + 5): spike at the contact → ground burst with rocks (peak f3)
                               → swirl of debris → fades (f10)
  public/sprites/hero-kael.png row 5 = character/kael_s1_character.png (10 frames, built by tools/sprites/kael.py)
  timeline/kael_timeline_v2.json (skill_1): 10 frames at 12 FPS (provisional) · vfx_spawn skill1_main F6 (anchor
                               sword_swing) · damage hit_index 1 F7 (melee) · vfx_spawn skill1_impact F7 (target_contact)

Timeline (60 FPS preview, 1 character frame = 5 T = 83.33 ms; 50 T = 0.833 s):
  F1 READY T00 · F2 LOWER_STANCE T05 · F3 DRAW_BACK T10 · F4 WIND_UP T15 · F5 MAX_ANTICIPATION T20 ·
  F6 ATTACK_RELEASE T25 (Main VFX spawns) · F7 HIT_1 T30 (damage once + Impact VFX) · F8 FOLLOW_THROUGH T35 ·
  F9 RECOVERY T40 · F10 READY_END T45 → T49

VFX placement keeps the artist's in-cell layout: every frame is cut with its whole cell, the pivot = the cell's
horizontal centre on the row's ground line (lowest debris row of that sheet row) → frames keep their authored motion.
Both VFX sheets are drawn at the character sheet's scale → baked at the S1 character's game scale (kael.py notes).

In game: `kl-s1-main` = self on vfx (F6), drawn in front of Kael at the sword swing · `kl-s1-impact` = target on
impact hit 0 (F7, after the damage resolved — one impact per damaged target).

Usage: python3 tools/sprites/kael_s1.py <out dir>
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
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/kael_s1'
os.makedirs(OUT, exist_ok=True)
FPS, N, PER = 60, 50, 5                  # 10 character frames × 5 T (12 FPS provisional, timeline_v2)
CELL_W, CELL_H, ROOT = 260, 170, (130, 155)
W, H, UP = 430, 200, 3
GROUND, X0 = 168, 120
CELL_PX = 80
EX = X0 + CELL_PX                        # the target stands one cell ahead
RELEASE_T, HIT_T = 25, 30                # F6 / F7
CHAR_SCALE = 0.256                       # kael.py: S1 character scale (s1_char: 10 frames, scale 0.256)
MAIN_DX = 56                             # Main VFX cell centre ahead of his feet: the arc's head + ground burst at the sword tip / contact
IMPACT_DX = -10                          # Impact VFX: at the target's contact side (toward Kael)

atlas = np.array(Image.open('public/sprites/hero-kael.png').convert('RGBA'))
ROW = atlas[5 * CELL_H:6 * CELL_H]
CHAR = [(i * PER, i * PER + PER - 1, i + 1) for i in range(10)]
POSES = {1: ('READY', 'ยืนพร้อม ดาบต่ำ', 'CAST_START'),
         2: ('LOWER_STANCE', 'ย่อตัว', ''),
         3: ('DRAW_BACK', 'ยกดาบขึ้น', ''),
         4: ('WIND_UP', 'ง้างดาบเหนือไหล่', ''),
         5: ('MAX_ANTICIPATION', 'ง้างสุด', 'ANTICIPATION'),
         6: ('ATTACK_RELEASE', 'ฟันลงเฉียง', 'VFX_SPAWN skill1_main'),
         7: ('HIT_1', 'ดาบผ่านเป้า', 'DAMAGE #1 + skill1_impact'),
         8: ('FOLLOW_THROUGH', 'ตามดาบ', ''),
         9: ('RECOVERY', 'ถอนดาบ', 'RECOVERY'),
         10: ('READY_END', 'กลับท่าพร้อม', '')}


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


def cut(name, per_row=5):
    """5 + 5 frames; each blob goes whole to the slot its centre falls in (a blob is only split when it really spans
    two slots); pivot = slot centre x on the sheet row's ground line"""
    im = unmix(name)
    hard = im[..., 3] > 40
    h = im.shape[0]
    rows = hard.sum(1)
    mid = int(h * 0.35) + int(np.argmin(rows[int(h * 0.35):int(h * 0.65)]))   # emptiest row between the two rows
    out = []
    for y0, y1 in [(0, mid), (mid, h)]:
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
        ground = int(np.nonzero(m.any(1))[0].max())
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
            out.append({'img': fr[fy0:fy1, fx0:fx1], 'px': cx - fx0, 'py': ground - fy0})
    return out


MAIN = cut('vfx/kael_s1_main_vfx')
IMPACT = cut('vfx/kael_s1_impact_vfx')
SC = CHAR_SCALE


def plan(keys):
    out = {}
    for (t0, f), (t1, _) in zip(keys, keys[1:]):
        for t in range(t0, t1):
            if f:
                out[t] = f
    return out


# Main VFX: spawns F6 (T25) thin → widens → PEAK f5 at the hit F7 (T30) → breaks into streaks → gone T49
MAIN_PLAN = plan([(25, 1), (26, 2), (27, 3), (28, 4), (30, 5), (33, 6), (36, 7), (39, 8), (42, 9), (45, 10), (48, None)])
# Impact VFX: F7 (T30) spike → burst peak f3 T34 → debris swirl → gone T52 (plays past the clip, it is a board FX)
IMPACT_PLAN = plan([(30, 1), (32, 2), (34, 3), (37, 4), (40, 5), (42, 6), (44, 7), (46, 8), (48, 9), (50, 10), (52, None)])


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
    hit = HIT_T <= t <= HIT_T + 6
    sx = (-3 if (t - HIT_T) % 2 else 2) if hit else 0
    img.alpha_composite(Image.fromarray(ENEMY), (EX + sx - ENEMY_ROOT[0], GROUND - ENEMY_ROOT[1]))
    img.alpha_composite(Image.fromarray(pose(char_at(t))), (X0 - ROOT[0], GROUND - ROOT[1]))
    if t in MAIN_PLAN:
        a, px, py = tile(MAIN[MAIN_PLAN[t] - 1], SC)
        x, y = put(img, a, px, py, (X0 + MAIN_DX, GROUND))
        if log:
            LOG.append({'T': t, 'track': 'main', 'frame': MAIN_PLAN[t], 'x': x, 'y': y, 'opacity': 1, 'split': 'front', 'part': 'main'})
    if t in IMPACT_PLAN:
        a, px, py = tile(IMPACT[IMPACT_PLAN[t] - 1], SC)
        x, y = put(img, a, px, py, (EX + IMPACT_DX, GROUND))
        if log:
            LOG.append({'T': t, 'track': 'impact', 'frame': IMPACT_PLAN[t], 'x': x, 'y': y, 'opacity': 1, 'split': 'front', 'part': 'impact'})
    if hit:
        dr.text((EX - 14, GROUND - 100), 'HIT 1', fill=(255, 220, 140))
    if log:
        if t == 0:
            ev(t, 'events', 1)
        if t == RELEASE_T:
            ev(t, 'events', 2)
        if HIT_T <= t <= HIT_T + 1:
            ev(t, 'damage', 1, 1.0 if t == HIT_T else 0.5)
            ev(t, 'break', 1, 1.0 if t == HIT_T else 0.5)
        if t == 40:
            ev(t, 'events', 3)
    return img.resize((W * UP, H * UP), Image.NEAREST).convert('RGB')


frames = [frame(t) for t in range(N + 4)]
tmp = tempfile.mkdtemp()
for i, f in enumerate(frames):
    f.save(f'{tmp}/f{i:03d}.png')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-i', f'{tmp}/f%03d.png', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                '-crf', '14', f'{OUT}/kael_s1_preview_60fps.mp4'], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-i', f'{tmp}/f%03d.png', '-vf',
                'fps=30,scale=645:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=200[p];[b][p]paletteuse=dither=bayer',
                '-loop', '0', f'{OUT}/kael_s1_preview_30fps.gif'], check=True)
KEYS = [0, 10, 20, 25, 27, 30, 32, 34, 38, 42, 46, 52]
cw, ch = 430, 200
sheet = Image.new('RGB', (cw * 4, ch * 3))
dr = ImageDraw.Draw(sheet)
for i, t in enumerate(KEYS):
    sheet.paste(frames[t].resize((cw, ch), Image.NEAREST), ((i % 4) * cw, (i // 4) * ch))
    dr.text(((i % 4) * cw + 6, (i // 4) * ch + 4), f'T{t:03d} F{char_at(t):02d}', fill=(255, 255, 255))
sheet.save(f'{OUT}/kael_s1_preview_contact.png')


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
    out.save(f'{OUT}/fx-kael-s1-{name}.png', optimize=True)
    return {'frames': len(tiles), 'w': w, 'h': h, 'frameMs': round(frame_ms, 2), 'pivot': [round((l + 1) / w, 4), round((u + 1) / h, 4)]}


game_fx = {
    'main': bake('main', [tile(MAIN[MAIN_PLAN[t] - 1], SC) for t in sorted(MAIN_PLAN)]),
    'impact': bake('impact', [tile(IMPACT[IMPACT_PLAN[t] - 1], SC) for t in sorted(IMPACT_PLAN)]),
}
steps = [round((b - a + 1) * 1000 / FPS) for a, b, _ in CHAR]
steps[-1] += round(N * 1000 / FPS) - sum(steps)
game = {'steps': steps,
        'events': {'CAST_START': 0, 'ANTICIPATION_PEAK': step_of(20), 'STRIKE_START': step_of(RELEASE_T), 'VFX_SPAWN': step_of(RELEASE_T),
                   'DAMAGE': step_of(HIT_T), 'IMPACT': step_of(HIT_T), 'RECOVERY_START': step_of(40)},
        'mainDx': round(MAIN_DX / CELL_PX * 100, 2), 'impactDx': round(-IMPACT_DX / CELL_PX * 100, 2)}

pf = [{'T': t, 'char': f'C{char_at(t):02d}', 'drawnFrame': char_at(t), 'root': [X0, GROUND],
       'spearTip': [X0 + 66, GROUND - 40], 'center': [X0, GROUND - 40]} for t in range(N)]
meta = {
    'name': 'kael_s1_sync_sheet',
    'readme': ['Timeline Sync Sheet — Skill 1 Sundering Edge · Kael Ashen Vanguard', '',
               '60 FPS พรีวิว · 10 ท่า × 5 T (12 FPS ชั่วคราวตาม timeline_v2) = 50 เฟรม T000–T049 = 0.83 วินาที',
               'ตัวละคร 10 ท่า + Main VFX 10 เฟรม + Impact VFX 10 เฟรม · ดาเมจครั้งเดียว F7 (T030)',
               'หน่วย: px = พิกเซลของแผ่นเกม (canvas 430×200, พื้น y = 168) · 80 px = 1 ช่อง · เป้าห่าง 1 ช่อง',
               'ที่มา: assets/heroes/Kael (ไม่แก้ไฟล์ต้นฉบับ) > tools/sprites/kael_s1.py > kael_s1_timeline.json > tools/sprites/ult_sync_sheet.py'],
    'gameNote': 'Game ms = steps ของท่า skill ใน SHEETS hero-kael.png (รวม 833 ms) · ดาเมจ 220 % + Break 60 + ×1.3 ใส่เป้าที่มีการ์ด ลงที่ DAMAGE F7 ครั้งเดียว',
    'title': 'Timeline Sync Sheet — Skill 1 Sundering Edge  ·  Kael Ashen Vanguard',
    'subtitle': '60 FPS · 50 frames (T000–T049) = 0.83 s · 1 column = 1 frame (16.7 ms) · 1 character frame = 5 columns (12 FPS) · '
                'Main VFX F6 · damage + impact F7',
    'phases': [[0, 9, 'A', 'READY / LOWER', [120, 130, 150], 'ตั้งท่า ย่อตัว'],
               [10, 24, 'B', 'WIND-UP', [200, 170, 90], 'ยกดาบ ง้างสุด F5'],
               [25, 34, 'C', 'RELEASE / HIT', [230, 110, 90], 'ฟันลง F6 · โดน F7'],
               [35, 49, 'D', 'FOLLOW / RECOVER', [110, 160, 130], 'ตามดาบ กลับท่า']],
    'poses': {c: [f'F{c}', f'{v[0]} — {v[1]}', v[2]] for c, v in POSES.items()},
    'gameSteps': steps,
    'hits': [HIT_T],
    'events': [[0, 'CAST_START', 'F1'], [20, 'MAX_ANTICIPATION', 'F5'], [RELEASE_T, 'VFX_SPAWN skill1_main', 'F6 ฟันลง'],
               [HIT_T, 'DAMAGE #1', 'F7 ครั้งเดียว'], [HIT_T, 'VFX_SPAWN skill1_impact', 'ที่จุดสัมผัสเป้า'],
               [HIT_T, 'BREAK 60 / GUARD ×1.3', 'ถ้าเป้ากำลังร่ายที่ต้อง Break / มีการ์ด'], [40, 'RECOVERY', 'F9'],
               [49, 'CLIP END', 'F10']],
    'lanes': 5,
    'tracks': [['main', 'L2 Main VFX (skill1_main)', [235, 160, 90], 'fx-kael-s1-main (kael_s1_main_vfx.png 10 fr)',
                'L2 · หน้าตัวละคร', f'หน้าเท้าเคล +{MAIN_DX} px (แนวฟันดาบ)', 'F6 T025 เกิด > peak f5 T030 > แตก > จาง T047'],
               ['impact', 'L3 Impact VFX (skill1_impact)', [255, 200, 120], 'fx-kael-s1-impact (kael_s1_impact_vfx.png 10 fr)',
                'L3 · หน้าเป้า', f'เท้าเป้า {IMPACT_DX:+d} px (ด้านที่โดน)', 'F7 T030 > peak f3 T034 > เศษหิน > จาง T051'],
               ['damage', 'L4 Damage #1', [255, 110, 90], 'DAMAGE SINGLE 220 %', '-', 'เป้าหลัก', 'F7 ครั้งเดียว ไม่ซ้ำ'],
               ['break', 'L5 Break / Guard bonus', [150, 190, 255], 'Break 60 (break-only) · ×1.3 vs guard', '-', 'เป้าหลัก', 'F7'],
               ['events', 'L6 Gameplay Events', [200, 200, 200], 'engine', '-', '-', 'F1 cast · F6 release · F9 recovery']],
    'trackNames': {'main': 'Main VFX', 'impact': 'Impact VFX', 'damage': 'ดาเมจ', 'break': 'Break', 'events': 'อีเวนต์'},
    'layers': [[1, 'ตัวละคร (L1)'], [2, 'Main VFX (L2)'], [3, 'Impact VFX (L3)'], [4, 'ดาเมจ (L4)'], [5, 'Break (L5)'], [6, 'อีเวนต์ (L6)']],
    'shake': {str(HIT_T): [2, 0], str(HIT_T + 1): [-2, 0], str(HIT_T + 2): [1, 0]},
    'thumbs': [0, 10, 20, 25, 30, 34, 40, 49],
    'thumbLabels': {0: 'READY', 10: 'DRAW BACK', 20: 'MAX ANTICIPATION', 25: 'RELEASE', 30: 'HIT 1', 34: 'IMPACT PEAK',
                    40: 'RECOVERY', 49: 'READY END'},
    'thumbCrop': [30 * UP, 40 * UP, 330 * UP, 190 * UP],
    'travelLabel': 'L1 Root X (px) — 0 (ยืนที่เดิม)', 'heightLabel': 'Root Y (px) — 0',
    'notes': [
        'ฟันหนักเป้าเดียว: ดาเมจลงครั้งเดียวที่ F7 (T030) — ตายก่อนถึง F7 / ท่าถูกยกเลิก = ไม่มีดาเมจ',
        'Main VFX เกิด F6 ที่แนวฟันหน้าเคล ยอดสุด f5 ตรงจังหวะโดน F7 · Impact VFX เกิด F7 ที่เป้า (หลังดาเมจคำนวณแล้ว)',
        'ภาพ VFX ทั้งสองแผ่นวาดสเกลเดียวกับแผ่นตัวละคร > อบที่สเกลเดียวกับท่า S1 ในเกม · ไม่แก้ไฟล์ต้นฉบับ',
        '12 FPS เป็นค่าชั่วคราวตาม timeline_v2 — เปลี่ยนได้ที่ steps ในเกมโดยไม่ต้องแก้ภาพ',
        'ไม่มี root motion · สั่นเบา 2 px ตอนโดน (ไม่มี hit-stop)',
    ],
}
json.dump({'fps': FPS, 'frames': N, 'canvas': [W, H], 'upscale': UP, 'ground': GROUND,
           'characterTiming': [{'from': a, 'to': b, 'char': f'C{c:02d}', 'drawnFrame': c} for a, b, c in CHAR],
           'rootTracks': {'travel': [[0, 0], [N - 1, 0]], 'height': [[0, 0], [N - 1, 0]]},
           'perFrame': pf, 'vfx': [x for x in LOG if x['T'] < N], 'sheet': meta, 'gameFx': game_fx, 'game': game},
          open(f'{OUT}/kael_s1_timeline.json', 'w'), indent=1, ensure_ascii=False)
print(json.dumps({'gameFx': game_fx, 'game': game}, indent=1, default=float))
