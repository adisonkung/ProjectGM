"""Lin Xue — Skill 1 Lotus Prayer: VFX cut + 60 FPS preview + timeline JSON + in-game FX strips.

Inputs (art/incoming/linxue, not committed):
  s1_vfx.png   the approved Heal Burst VFX, 8 frames on flat #FF00FF (spark → bud → bloom in a gold ring → peak burst
               with petals → petals scatter → fade) — pixel art with a soft pink glow
  public/sprites/hero-linxue.png row 5 (character, 10 frames, built by tools/sprites/linxue.py — nothing baked)

Production timeline (user spec 2026-10, 60 FPS, 45 frames T000–T044 ≈ 0.75 s):
  A target / ready T000–T006 (find lowest-HP ally T002, lock T006) · B prayer / anticipation T007–T017 (prayer T008,
  peak T014) · C release T018–T023 (staff / hand release point T022) · D primary heal T024–T029 (burst spawns on the
  primary T024, PRIMARY HEAL T025, burst peak T027) · E nearby heal T030–T035 (ally check T030, SPLASH HEAL T031 —
  lighter copy of the same burst, 65 % scale / 60 % opacity) · F recovery T036–T044. Root ≤ 4 px · no shake / zoom.

In game: kit S1 = repeat 2 on the clip's DAMAGE events (T025 primary only / T031 allies around it) · `lx-s1-bloom` =
on vfx at the primary (60 FPS strip) · `lx-s1-splash` = on impact hit 1, one copy per ally the splash healed except
the primary (`perHit` + `exceptPrimary`).

Usage: python3 tools/sprites/linxue_s1.py <out dir>
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

SRC = 'art/incoming/linxue'
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/linxue_s1'
os.makedirs(OUT, exist_ok=True)
FPS, N = 60, 45
CELL_W, CELL_H, ROOT = 260, 170, (130, 155)
W, H, UP = 430, 200, 3
GROUND, X0 = 168, 70
CELL_PX = 80
BODY = 80
T1X = X0 + 120                          # the primary (lowest-HP ally) 1.5 cells ahead of her
T2X = T1X + CELL_PX                     # an ally next to it (gets the splash heal)
TCY = GROUND - 40                       # ally body centre (the burst sits on the target centre)

# ------------------------------------------------------------------ character (atlas row 5, game scale)
atlas = np.array(Image.open('public/sprites/hero-linxue.png').convert('RGBA'))
ROW = atlas[5 * CELL_H:6 * CELL_H]
CHAR = [(0, 6, 1), (7, 9, 2), (10, 13, 3), (14, 17, 4), (18, 19, 5), (20, 21, 6), (22, 23, 7), (24, 35, 8), (36, 40, 9),
        (41, 44, 10)]
POSES = {1: ('READY', 'ยืนถือไม้เท้าบัว มองหาเพื่อน HP ต่ำสุด', 'CAST_START · FIND_LOWEST_HP_ALLY T002 · TARGET_LOCK T006'),
         2: ('PRAYER', 'หลับตา ดึงไม้เท้าเข้าหาตัว', 'PRAYER_START T008'),
         3: ('PRAYER', 'ประนมรวมพลังชี่ฤดูใบไม้ผลิ', ''),
         4: ('PRAYER', 'ก้มรวมสมาธิลึกสุด', 'ANTICIPATION_PEAK T014'),
         5: ('RELEASE', 'ยกไม้เท้า บัวบนหัวไม้เท้าเรือง', 'RELEASE_START T018'),
         6: ('RELEASE', 'ไม้เท้าสูงสุด', ''),
         7: ('RELEASE', 'ผายมือไปทางเพื่อน', 'STAFF_RELEASE_POINT T022'),
         8: ('HOLD', 'ค้างมือ ฮีลเป้าหลัก แล้วเพื่อนรอบตัว', 'PRIMARY HEAL T025 · SPLASH HEAL T031'),
         9: ('RECOVER', 'หลับตา ดึงมือกลับ', 'RECOVERY_START T036'),
         10: ('READY', 'กลับท่ายืน', 'ANIMATION_END T044')}
RELEASE_T, SPAWN_T, HEAL_T, PEAK_T, CHECK_T, SPLASH_T = 22, 24, 25, 27, 30, 31
ROOT_KEYS = [[0, 0], [18, 0], [22, 2], [35, 2], [44, 0]]   # a slight lean into the release (≤ 4 px)


def smooth(keys, t):
    for (a, va), (b, vb) in zip(keys, keys[1:]):
        if a <= t <= b:
            k = (t - a) / (b - a)
            return va + (vb - va) * k * k * (3 - 2 * k)
    return keys[-1][1]


def root_x(t):
    return smooth(ROOT_KEYS, t)


def pose(c):
    return ROW[:, (c - 1) * CELL_W:c * CELL_W]


def char_at(t):
    return next((c for a, b, c in CHAR if a <= t <= b), CHAR[-1][2])


def step_of(t):
    for i, (a, b, _) in enumerate(CHAR):
        if a <= t <= b:
            return round(i + (t - a) / (b - a + 1), 3)
    return float(len(CHAR))


def ally(sheet, cell_w, root):
    a = np.array(Image.open(f'public/sprites/{sheet}').convert('RGBA'))
    return a[0:CELL_H, 0:cell_w], root


ALLY1 = ally('hero-bailong.png', 220, (110, 155))
ALLY2 = ally('hero-yuezheng.png', 260, (130, 155))


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


CENTRES = [88, 270, 477, 695, 935, 1180, 1405, 1590]
BAND = (300, 660)
LOTUS_CY = 478                          # the lotus / ring centre row of the sheet (every frame shares it)


def cut():
    im = unmix('s1_vfx')
    im[:BAND[0]] = 0                    # the sheet's edges carry a faint off-key border — only the art band counts
    im[BAND[1]:] = 0
    im[:, :12] = 0
    im[:, -12:] = 0
    a = im[..., 3] > 20
    lab, k = ndimage.label(a, np.ones((3, 3)))
    cx = np.array(ndimage.center_of_mass(a, lab, np.arange(1, k + 1)))[:, 1]
    cen = np.array(CENTRES, float)
    owner = np.full(a.shape, -1)
    idx = np.argmin(np.abs(cx[:, None] - cen[None, :]), 1)
    owner[a] = idx[lab[a] - 1]
    out = []
    for j, c in enumerate(CENTRES):
        own = ndimage.binary_dilation(owner == j, iterations=2) & (im[..., 3] > 0)
        yy, xx = np.nonzero(own)
        x0, x1, y0, y1 = xx.min(), xx.max() + 1, yy.min(), yy.max() + 1
        fr = im[y0:y1, x0:x1].copy()
        fr[..., 3] = np.where(own[y0:y1, x0:x1], fr[..., 3], 0)
        out.append({'img': fr, 'px': c - x0, 'py': LOTUS_CY - y0})
    return out


LOTUS = cut()


def size(fr, thr=60):
    ys, xs = np.nonzero(fr['img'][..., 3] > thr)
    return xs.max() - xs.min() + 1, ys.max() - ys.min() + 1


# sizes (preview / atlas px): primary = the burst at 100 % (peak f5 ≈ 1.05 body wide), 100 % opacity · nearby allies =
# a lighter copy of the same asset (bud → bloom → petals, not the spark) at 65 % scale / 60 % opacity
SC = {'bloom': 1.05 * BODY / size(LOTUS[4])[0]}
SC['splash'] = SC['bloom'] * 0.65
SPLASH_ALPHA = 0.6


def plan(keys):
    out = {}
    for (t0, f), (t1, _) in zip(keys, keys[1:]):
        for t in range(t0, t1):
            out[t] = f
    return out


# T → frame (1-based): spawn T024 → heal T025 → peak (f5) T027 held → petals scatter → fade by T043
BLOOM_PLAN = plan([(24, 1), (25, 2), (26, 4), (27, 5), (31, 6), (35, 7), (39, 8), (44, None)])
# splash T031: starts at the bud (f3), smaller peak T033, fades by T042
SPLASH_PLAN = plan([(31, 3), (32, 4), (33, 5), (36, 6), (38, 7), (40, 8), (43, None)])


def tile(fr, s, alpha=1.0):
    img = Image.fromarray(fr['img'])
    img = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)
    a = np.array(img)
    a[..., 3] = (a[..., 3].astype(float) * alpha).astype(np.uint8)
    return a, fr['px'] * s, fr['py'] * s


def tracks_at(t):
    out = []
    if t in BLOOM_PLAN:
        a, px, py = tile(LOTUS[BLOOM_PLAN[t] - 1], SC['bloom'])
        out.append(('bloom', BLOOM_PLAN[t], a, px, py, (T1X, TCY), 1.0))
    if t in SPLASH_PLAN:
        a, px, py = tile(LOTUS[SPLASH_PLAN[t] - 1], SC['splash'], SPLASH_ALPHA)
        out.append(('splash', SPLASH_PLAN[t], a, px, py, (T2X, TCY + 4), SPLASH_ALPHA))
    return out


def background(t=None):
    a = np.zeros((H, W, 4), np.uint8)
    yy = np.arange(H)[:, None]
    sky = np.clip(yy / GROUND, 0, 1)
    a[..., 0], a[..., 1], a[..., 2] = (20 + 18 * sky), (18 + 20 * sky), (34 + 26 * sky)
    g = yy >= GROUND
    a[..., 0] = np.where(g, 40, a[..., 0])
    a[..., 1] = np.where(g, 54, a[..., 1])
    a[..., 2] = np.where(g, 46, a[..., 2])
    a[GROUND, :, :3] = (62, 86, 64)
    for k in range(-2, 4):
        x = int(T1X - CELL_PX / 2 + k * CELL_PX)
        if 0 <= x < W:
            a[GROUND + 1:GROUND + 8, x, :3] = (80, 104, 82)
    a[..., 3] = 255
    img = Image.fromarray(a)
    dr = ImageDraw.Draw(img)
    # L2 target selection (preview only): scan marker T002–T005, lock ring T006–T029 under the primary
    if t is not None and 2 <= t <= 29:
        c = (150, 255, 200) if t >= 6 else (120, 170, 150)
        w = 26 if t >= 6 else 20 + 2 * (t - 2)
        dr.ellipse([T1X - w, GROUND - 5, T1X + w, GROUND + 5], outline=c, width=1)
    if t is not None and CHECK_T <= t <= 35:
        dr.ellipse([T2X - 22, GROUND - 4, T2X + 22, GROUND + 4], outline=(120, 200, 170), width=1)
    for (spr, root), x in [(ALLY2, T2X), (ALLY1, T1X)]:
        img.alpha_composite(Image.fromarray(spr), (x - root[0], GROUND - root[1]))
    return img


def put(img, a, px, py, at):
    x, y = round(at[0] - px), round(at[1] - py)
    img.alpha_composite(Image.fromarray(a), (max(0, x), max(0, y)), (max(0, -x), max(0, -y)))
    return x, y


LOG = []


def ev(t, track, frame, op=1.0):
    LOG.append({'T': t, 'track': track, 'frame': frame, 'x': 0, 'y': 0, 'opacity': op, 'split': '-'})


def frame(t, log=True):
    img = background(t)
    c = char_at(t)
    img.alpha_composite(Image.fromarray(pose(c)), (round(X0 + root_x(t)) - ROOT[0], GROUND - ROOT[1]))
    for key, f, a, px, py, at, op in tracks_at(t):
        x, y = put(img, a, px, py, at)
        if log:
            LOG.append({'T': t, 'track': key, 'frame': f, 'x': x, 'y': y, 'opacity': round(op, 2), 'split': 'front', 'part': key})
    if log:
        if 2 <= t <= 5:
            ev(t, 'target', 1, 0.6)
        if 6 <= t <= 29:
            ev(t, 'target', 2, 1.0 if t == 6 else 0.5)
        if CHECK_T <= t <= 35:
            ev(t, 'target', 3, 1.0 if t == CHECK_T else 0.5)
        for h, k in [(HEAL_T, 1), (SPLASH_T, 2)]:
            if h <= t <= h + 1:
                ev(t, 'heal', k, 1.0 if t == h else 0.5)
        if 36 <= t <= 44:
            ev(t, 'recovery', 1, 0.6)
    return img.resize((W * UP, H * UP), Image.NEAREST).convert('RGB')


frames = [frame(t) for t in range(N)]
tmp = tempfile.mkdtemp()
for i, f in enumerate(frames):
    f.save(f'{tmp}/f{i:03d}.png')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-i', f'{tmp}/f%03d.png', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                '-crf', '14', f'{OUT}/linxue_s1_preview_60fps.mp4'], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-i', f'{tmp}/f%03d.png', '-vf',
                'fps=30,scale=645:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=200[p];[b][p]paletteuse=dither=bayer',
                '-loop', '0', f'{OUT}/linxue_s1_preview_30fps.gif'], check=True)
KEYS = [0, 6, 14, 18, 22, 24, 25, 27, 31, 33, 36, 44]
cw, ch = 430, 200
sheet = Image.new('RGB', (cw * 4, ch * 3))
dr = ImageDraw.Draw(sheet)
for i, t in enumerate(KEYS):
    sheet.paste(frames[t].resize((cw, ch), Image.NEAREST), ((i % 4) * cw, (i // 4) * ch))
    dr.text(((i % 4) * cw + 6, (i // 4) * ch + 4), f'T{t:03d} C{char_at(t):02d}', fill=(255, 255, 255))
sheet.save(f'{OUT}/linxue_s1_preview_contact.png')


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
    out.save(f'public/sprites/fx-linxue-s1-{name}.png', optimize=True)
    return {'frames': len(tiles), 'w': w, 'h': h, 'frameMs': round(frame_ms, 2), 'pivot': [round((l + 1) / w, 4), round((u + 1) / h, 4)]}


DY = round(27.25 + (TCY - GROUND) * 1.25, 2)
game_fx = {
    'bloom': {**bake('bloom', [tile(LOTUS[BLOOM_PLAN[t] - 1], SC['bloom']) for t in sorted(BLOOM_PLAN)]), 'dy': DY},
    'splash': {**bake('splash', [tile(LOTUS[SPLASH_PLAN[t] - 1], SC['splash'], SPLASH_ALPHA) for t in sorted(SPLASH_PLAN)]),
               'dy': round(DY + 4 * 1.25, 2)},
}
steps = [round((b - a + 1) * 1000 / FPS) for a, b, _ in CHAR]
steps[-1] += round(N * 1000 / FPS) - sum(steps)
sx = lambda t: step_of(t) if t < N - 1 else float(len(CHAR))
game = {'steps': steps,
        'events': {'CAST_START': 0, 'ANTICIPATION_PEAK': step_of(14), 'STRIKE_START': step_of(18), 'SKILL_ACTIVATE': step_of(RELEASE_T),
                   'VFX_SPAWN': step_of(SPAWN_T), 'DAMAGE': [step_of(HEAL_T), step_of(SPLASH_T)], 'RECOVERY_START': step_of(36)},
        'root': [[sx(t), round(root_x(t), 1), 0] for t in sorted({k[0] for k in ROOT_KEYS} | set(range(0, N, 4)) | {N - 1})]}

# ------------------------------------------------------------------ timeline JSON (+ sync-sheet meta)
pf = [{'T': t, 'char': f'C{char_at(t):02d}', 'drawnFrame': char_at(t), 'root': [round(X0 + root_x(t), 1), GROUND],
       'spearTip': [X0 + 24, GROUND - 70], 'center': [X0, GROUND - BODY / 2]} for t in range(N)]
meta = {
    'name': 'linxue_s1_sync_sheet',
    'readme': ['Timeline Sync Sheet — Skill 1 Lotus Prayer · Lin Xue (production)', '',
               '60 FPS, 45 เฟรม (T000–T044) ~ 0.75 วินาที · ตัวละคร 10 ท่า + Heal Burst 8 เฟรม (เป้าหลัก) + Splash (เพื่อนรอบตัว)',
               'Frames = ทุกเฟรม · Character = ท่า C01–C10 + ความยาวในเกม · VFX Tracks / Events / Layers',
               'หน่วย: px = พิกเซลของแผ่นเกม (canvas 430×200, พื้น y = 168) · 80 px = 1 ช่อง · เป้าหลักห่าง 1.5 ช่อง',
               'ที่มา: tools/sprites/linxue_s1.py > linxue_s1_timeline.json > tools/sprites/ult_sync_sheet.py'],
    'gameNote': 'Game ms = steps ของท่า skill ใน SHEETS hero-linxue.png (รวม 750 ms) · ฮีลเป้าหลัก T025 / รอบตัว T031 = repeat 2 ของ kit',
    'title': 'Timeline Sync Sheet — Skill 1 Lotus Prayer  ·  Lin Xue · Lotus Spirit Physician',
    'subtitle': '60 FPS · 45 frames (T000–T044) = 0.75 s · 1 column = 1 frame (16.7 ms) · primary heal T025 · nearby heal T031 · no shake / zoom',
    'phases': [[0, 6, 'A', 'TARGET / READY', [120, 130, 150], 'เลือกเป้า / พร้อม'],
               [7, 17, 'B', 'PRAYER / ANTICIPATION', [150, 120, 170], 'สวดภาวนา'],
               [18, 23, 'C', 'RELEASE', [90, 170, 140], 'ส่งพลัง'],
               [24, 29, 'D', 'PRIMARY HEAL', [230, 140, 180], 'ฮีลเป้าหลัก'],
               [30, 35, 'E', 'NEARBY HEAL', [240, 180, 205], 'ฮีลรอบตัว'],
               [36, 44, 'F', 'RECOVERY', [90, 170, 120], 'กลับท่า']],
    'poses': {c: [f'F{c}', f'{v[0]} — {v[1]}', v[2]] for c, v in POSES.items()},
    'gameSteps': steps,
    'hits': [HEAL_T, SPLASH_T],
    'events': [[0, 'CAST_START', 'C01'], [2, 'FIND_LOWEST_HP_ALLY', 'HP % ต่ำสุด'], [6, 'TARGET_LOCK', 'ล็อกเป้าหลัก'],
               [8, 'PRAYER_START', 'C02'], [14, 'ANTICIPATION_PEAK', 'C04'], [18, 'RELEASE_START', 'C05'],
               [22, 'STAFF_RELEASE_POINT', 'C07 ผายมือ'], [24, 'HEAL_BURST_VFX_SPAWN_PRIMARY', 'burst f1 ที่เป้า'],
               [25, 'PRIMARY_HEAL_APPLY', '100 % ATK + 8 %'], [27, 'HEAL_BURST_PEAK', 'f5'],
               [30, 'NEARBY_ALLY_CHECK', '3×3 รอบเป้า'], [31, 'SPLASH_HEAL_APPLY', '40 % + 3 % · 65 % / 60 %'],
               [36, 'RECOVERY_START', 'C09'], [44, 'ANIMATION_END', 'C10']],
    'lanes': 7,
    'tracks': [['target', 'L2 Target Selection', [150, 230, 200], 'LOWEST_HP_ALLY (HP % ต่ำสุด)', 'พื้น', 'ใต้เท้าเป้า',
                'T002 หาเป้า · T006 ล็อก · T030 เช็กเพื่อนรอบตัว'],
               ['bloom', 'L3 Heal Burst VFX — Primary', [250, 160, 205], 'fx-linxue-s1-bloom (s1_vfx.png 8 fr) 100 % / 100 %', 'L3 · หน้า',
                'กลางตัวเป้าหลัก', 'T024 เกิด > T025 ฮีล > T027 peak (ค้างถึง T030) > กลีบกระจาย > จาง T043'],
               ['splash', 'L4 Nearby Heal Instances', [255, 205, 225], 'fx-linxue-s1-splash (asset เดียวกัน f3–f8)', 'L4 · หน้า',
                'กลางตัวเพื่อนรอบเป้า (ไม่รวมเป้า)', 'T031 > peak T033 > จาง T042 · สเกล 65 % ความทึบ 60 %'],
               ['heal', 'L5 Healing Events', [120, 230, 160], 'engine repeat 2 (DAMAGE events)', '-', '-',
                'T025 เป้าหลัก 100 % ATK + 8 % · T031 รอบตัว 40 % + 3 %'],
               ['recovery', 'L6 Recovery', [90, 170, 120], 'ท่า C09–C10', '-', '-', 'T036 กลับท่า > T044 จบ']],
    'trackNames': {'target': 'เลือกเป้า', 'bloom': 'Heal Burst', 'splash': 'ฮีลรอบตัว', 'heal': 'ฮีล', 'recovery': 'กลับท่า'},
    'layers': [[1, 'ตัวละคร (L1)'], [2, 'เลือกเป้า (L2)'], [3, 'Heal Burst เป้าหลัก (L3)'], [4, 'ฮีลรอบตัว (L4)'],
               [5, 'ฮีล (L5)'], [6, 'กลับท่า (L6)']],
    'shake': {},
    'thumbs': [0, 6, 14, 22, 25, 27, 31, 33, 36, 44],
    'thumbLabels': {0: 'READY', 6: 'LOCK', 14: 'PRAYER', 22: 'RELEASE', 25: 'PRIMARY HEAL', 27: 'BURST PEAK', 31: 'SPLASH',
                    33: 'SPLASH PEAK', 36: 'RECOVERY', 44: 'END'},
    'thumbCrop': [20 * UP, 60 * UP, 425 * UP, 185 * UP],
    'travelLabel': 'L1 Root X (px) — ไม่เกิน 4 px เอนตัวเล็กน้อยตอนส่งพลัง', 'heightLabel': 'Y movement (px)',
    'notes': [
        'หลินเสวี่ยยืนที่เดิม (root ไม่เกิน 4 px) หันขวา — ไม่พุ่ง ไม่กระโดด ไม่มีวงพลังใหญ่รอบตัวเธอ',
        'เป้าหลัก = เพื่อน HP % ต่ำสุด · Heal Burst ติด pivot กลางตัวเป้า 100 % สเกล / 100 % ความทึบ',
        'ฮีลเป้าหลัก T025 (1 เฟรมหลัง burst เกิด) · peak T027 · ฮีลรอบตัว T031 (คนละจังหวะ, repeat 2 ของ kit)',
        'เพื่อนรอบตัว: asset เดียวกันแต่เริ่มที่ดอกตูม (f3) 65 % สเกล 60 % ความทึบ ไม่เล่นเต็มชุด — เป้าหลักเด่นกว่าชัด',
        'ไม่มีสั่นกล้อง ไม่มีซูม ไม่มี hit-stop (สกิลซัพพอร์ตปกติ)',
        'VFX ภาพพิกเซล + แสงชมพูนุ่ม: alpha / สีแยกจากพื้น magenta · แผ่นในเกม 60 FPS ทุกเฟรม',
    ],
}
json.dump({'fps': FPS, 'frames': N, 'canvas': [W, H], 'upscale': UP, 'ground': GROUND,
           'characterTiming': [{'from': a, 'to': b, 'char': f'C{c:02d}', 'drawnFrame': c} for a, b, c in CHAR],
           'rootTracks': {'travel': ROOT_KEYS, 'height': [[0, 0], [N - 1, 0]]},
           'perFrame': pf, 'vfx': LOG, 'sheet': meta, 'gameFx': game_fx, 'game': game},
          open(f'{OUT}/linxue_s1_timeline.json', 'w'), indent=1, ensure_ascii=False)
print(json.dumps({'scale': SC, 'gameFx': game_fx, 'game': game}, indent=1, default=float))
