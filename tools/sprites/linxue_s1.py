"""Lin Xue — Skill 1 Lotus Prayer: VFX cut + 60 FPS preview + timeline JSON + in-game FX strips.

Inputs (art/incoming/linxue, not committed):
  s1_vfx.png   the lotus bloom, 8 frames on flat #FF00FF (spark → bud → bloom in a gold ring → peak burst with petals →
               petals scatter → fade) — pixel art with a soft pink glow
  public/sprites/hero-linxue.png row 5 (character, 10 frames, built by tools/sprites/linxue.py — nothing baked)

Timeline (60 FPS, T000–T059 = 1.00 s — user 2026-10 standard: character and VFX separate layers, Lin Xue faces right,
mostly stationary, target VFX follows the target pivot):
  A ready T000–T004 · B prayer (eyes closed, staff drawn in) T005–T022 (peak T018) · C staff raised, lotus head glows
  T023–T034 (peak T030) · D palm out = release T035 (the bloom spawns on the ally) → heal T043 at the bloom peak · light
  heal on the allies around it at the same hit (smaller lotus) · E recovery T047–T059. Root 0 px.

In game: `lx-s1-bloom` = on vfx at the target (the healed ally) · `lx-s1-splash` = on impact, one copy per ally the
heal reached except the primary (`perHit` + `exceptPrimary`).

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
FPS, N = 60, 60
CELL_W, CELL_H, ROOT = 260, 170, (130, 155)
W, H, UP = 430, 200, 3
GROUND, X0 = 168, 70
CELL_PX = 80
BODY = 80
T1X = X0 + 120                          # the healed ally 1.5 cells ahead of her
T2X = T1X + CELL_PX                     # an ally next to it (gets the light heal)
TCY = GROUND - 40                       # ally body centre (the bloom sits on the chest)

# ------------------------------------------------------------------ character (atlas row 5, game scale)
atlas = np.array(Image.open('public/sprites/hero-linxue.png').convert('RGBA'))
ROW = atlas[5 * CELL_H:6 * CELL_H]
CHAR = [(0, 4, 1), (5, 10, 2), (11, 16, 3), (17, 22, 4), (23, 28, 5), (29, 34, 6), (35, 38, 7), (39, 46, 8), (47, 52, 9),
        (53, 59, 10)]
POSES = {1: ('READY', 'ยืนถือไม้เท้าบัว มือซ้ายผายเบา ๆ', 'CAST_START'),
         2: ('PRAYER', 'หลับตา ดึงไม้เท้าเข้าหาตัว', 'PRAYER_START T005'),
         3: ('PRAYER', 'ประนมรวมพลังชี่ฤดูใบไม้ผลิ', ''),
         4: ('PRAYER', 'ก้มรวมสมาธิลึกสุด', 'ANTICIPATION_PEAK T018'),
         5: ('RAISE', 'ยกไม้เท้า ดอกบัวบนหัวไม้เท้าเรือง', 'CHARGE_START T023'),
         6: ('RAISE', 'ไม้เท้าสูงสุด บัวสว่างสุด', 'CHARGE_PEAK T030'),
         7: ('RELEASE', 'ผายมือไปทางเพื่อน ส่งบัว', 'SKILL_ACTIVATE / VFX_SPAWN T035'),
         8: ('HOLD', 'ค้างมือ บัวบานบนตัวเพื่อน', 'HEAL T043'),
         9: ('RECOVER', 'หลับตา ดึงมือกลับ', 'RECOVERY_START T047'),
         10: ('READY', 'กลับท่ายืน', 'ANIMATION_END T059')}
RELEASE_T, HEAL_T = 35, 43


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


# sizes (preview / atlas px): the peak burst (f5) ≈ 1.05 body wide on the healed ally · splash (light heal) 55 %
SC = {'bloom': 1.05 * BODY / size(LOTUS[4])[0]}
SC['splash'] = SC['bloom'] * 0.55
SPLASH_ALPHA = 0.85

# T → frame (1-based) · the bloom peaks (f5) on the heal T043 and lingers while the petals scatter
BLOOM_KEYS = [(35, 1), (37, 2), (39, 3), (41, 4), (43, 5), (47, 6), (51, 7), (55, 8), (59, None)]
BLOOM_PLAN = {}
for (t0, f), (t1, _) in zip(BLOOM_KEYS, BLOOM_KEYS[1:]):
    for t in range(t0, t1):
        BLOOM_PLAN[t] = f
SPLASH_PLAN = {HEAL_T + k: f for k, f in enumerate([1, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8])}


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


def background():
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
    for (spr, root), x in [(ALLY2, T2X), (ALLY1, T1X)]:
        img.alpha_composite(Image.fromarray(spr), (x - root[0], GROUND - root[1]))
    return img


def put(img, a, px, py, at):
    x, y = round(at[0] - px), round(at[1] - py)
    img.alpha_composite(Image.fromarray(a), (max(0, x), max(0, y)), (max(0, -x), max(0, -y)))
    return x, y


LOG = []


def frame(t, log=True):
    img = background()
    c = char_at(t)
    img.alpha_composite(Image.fromarray(pose(c)), (X0 - ROOT[0], GROUND - ROOT[1]))
    for key, f, a, px, py, at, op in tracks_at(t):
        x, y = put(img, a, px, py, at)
        if log:
            LOG.append({'T': t, 'track': key, 'frame': f, 'x': x, 'y': y, 'opacity': round(op, 2), 'split': 'front', 'part': key})
    if log:
        if HEAL_T <= t <= HEAL_T + 1:
            LOG.append({'T': t, 'track': 'heal', 'frame': 1, 'x': 0, 'y': 0, 'opacity': 1.0 if t == HEAL_T else 0.5, 'split': '-'})
        if 23 <= t <= 34:
            LOG.append({'T': t, 'track': 'qi', 'frame': 1 if t < 30 else 2, 'x': 0, 'y': 0, 'opacity': 0.6 if t < 30 else 1.0, 'split': '-'})
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
KEYS = [0, 8, 18, 26, 30, 35, 39, 43, 45, 49, 53, 57]
cw, ch = 430, 200
sheet = Image.new('RGB', (cw * 4, ch * 3))
dr = ImageDraw.Draw(sheet)
for i, t in enumerate(KEYS):
    sheet.paste(frames[t].resize((cw, ch), Image.NEAREST), ((i % 4) * cw, (i // 4) * ch))
    dr.text(((i % 4) * cw + 6, (i // 4) * ch + 4), f'T{t:03d} C{char_at(t):02d}', fill=(255, 255, 255))
sheet.save(f'{OUT}/linxue_s1_preview_contact.png')


# ------------------------------------------------------------------ in-game strips (30 FPS timeline order)
def bake(name, tiles, frame_ms=2000 / 60):
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
    'bloom': {**bake('bloom', [tile(LOTUS[BLOOM_PLAN[t] - 1], SC['bloom']) for t in sorted(BLOOM_PLAN)[::2]]), 'dy': DY},
    'splash': {**bake('splash', [tile(LOTUS[SPLASH_PLAN[t] - 1], SC['splash'], SPLASH_ALPHA) for t in sorted(SPLASH_PLAN)[::2]]),
               'dy': round(DY + 4 * 1.25, 2)},
}
steps = [round((b - a + 1) * 1000 / FPS) for a, b, _ in CHAR]
steps[-1] += round(N * 1000 / FPS) - sum(steps)
game = {'steps': steps,
        'events': {'CAST_START': 0, 'ANTICIPATION_PEAK': step_of(18), 'CHARGE_START': step_of(23), 'CHARGE_PEAK': step_of(30),
                   'SKILL_ACTIVATE': step_of(RELEASE_T), 'VFX_SPAWN': step_of(RELEASE_T), 'DAMAGE': step_of(HEAL_T),
                   'RECOVERY_START': step_of(47)}}

# ------------------------------------------------------------------ timeline JSON (+ sync-sheet meta)
pf = [{'T': t, 'char': f'C{char_at(t):02d}', 'drawnFrame': char_at(t), 'root': [X0, GROUND], 'spearTip': [X0 + 24, GROUND - 70],
       'center': [X0, GROUND - BODY / 2]} for t in range(N)]
meta = {
    'name': 'linxue_s1_sync_sheet',
    'readme': ['Timeline Sync Sheet — Skill 1 Lotus Prayer · Lin Xue', '',
               '60 FPS, 60 เฟรม (T000–T059) = 1.00 วินาที · ตัวละคร 10 ท่า + Lotus Bloom 8 เฟรม (เป้า) + Splash (เพื่อนรอบตัว)',
               'Frames = ทุกเฟรม · Character = ท่า C01–C10 + ความยาวในเกม · VFX Tracks / Events / Layers',
               'หน่วย: px = พิกเซลของแผ่นเกม (canvas 430×200, พื้น y = 168) · 80 px = 1 ช่อง · เพื่อนที่ถูกฮีลห่าง 1.5 ช่อง',
               'ที่มา: tools/sprites/linxue_s1.py → linxue_s1_timeline.json → tools/sprites/ult_sync_sheet.py'],
    'gameNote': 'Game ms = steps ของท่า skill ใน SHEETS hero-linxue.png (รวม 1000 ms) · บัวบาน = fx-linxue-s1-bloom ที่เป้า (on vfx)',
    'title': 'Timeline Sync Sheet — Skill 1 Lotus Prayer  ·  Lin Xue · Lotus Spirit Physician',
    'subtitle': '60 FPS · 60 frames (T000–T059) = 1.00 s · 1 column = 1 frame (16.7 ms) · release T035 · heal T043 at the bloom peak',
    'phases': [[0, 4, 'A', 'READY', [120, 130, 150], 'พร้อม'],
               [5, 22, 'B', 'PRAYER', [150, 120, 170], 'สวดภาวนา'],
               [23, 34, 'C', 'RAISE / QI GATHER', [90, 170, 140], 'ยกไม้เท้า รวมชี่'],
               [35, 46, 'D', 'RELEASE / BLOOM', [230, 140, 180], 'ส่งบัว / บัวบาน'],
               [47, 59, 'E', 'RECOVERY', [90, 170, 120], 'กลับท่า']],
    'poses': {c: [f'F{c}', f'{v[0]} — {v[1]}', v[2]] for c, v in POSES.items()},
    'gameSteps': steps,
    'hits': [HEAL_T],
    'events': [[0, 'CAST_START', 'C01'], [5, 'PRAYER_START', 'C02 หลับตา'], [18, 'ANTICIPATION_PEAK', 'C04'],
               [23, 'CHARGE_START', 'C05 ยกไม้เท้า'], [30, 'CHARGE_PEAK', 'C06 บัวเรือง'], [35, 'SKILL_ACTIVATE', 'C07 ผายมือ'],
               [35, 'VFX_SPAWN', 'บัว f1 ที่เพื่อน'], [41, 'BLOOM', 'f4'], [43, 'HEAL', 'f5 peak · 100 % ATK + 8 %'],
               [43, 'SPLASH_HEAL', 'เพื่อนรอบตัว 40 % + 3 %'], [47, 'RECOVERY_START', 'C09'], [59, 'ANIMATION_END', 'C10']],
    'lanes': 6,
    'tracks': [['qi', 'L3 Staff Qi (ในภาพตัวละคร)', [240, 170, 210], 'ภาพตัวละคร C05–C06', 'L1', 'หัวไม้เท้าบัว', 'บัวเรือง T023 → สว่างสุด T030'],
               ['bloom', 'L4 Lotus Bloom VFX', [250, 160, 205], 'fx-linxue-s1-bloom (s1_vfx.png 8 fr)', 'L4 · หน้า',
                'กลางตัวเพื่อนที่ถูกฮีล', 'T035 ประกาย → T039 ดอกตูม + วง → T043 บานสุด + กลีบ = ฮีล → T047–T058 กลีบกระจาย จาง'],
               ['heal', 'L5 Heal Event', [120, 230, 160], 'engine HEAL PRIMARY + ADJACENT_8', '-', '-', 'T043 เป้า 100 % ATK + 8 % · รอบตัว 40 % + 3 %'],
               ['splash', 'L6 Splash Lotus', [255, 205, 225], 'fx-linxue-s1-splash (บัวเดียวกัน 55 %)', 'L6 · หน้า',
                'เพื่อนรอบตัวเป้า (ไม่รวมเป้า)', 'T043 → T056 บัวเล็ก จางกว่า']],
    'trackNames': {'qi': 'ชี่ไม้เท้า', 'bloom': 'บัวบาน', 'heal': 'ฮีล', 'splash': 'บัวรอบตัว'},
    'layers': [[1, 'ตัวละคร (L1)'], [2, 'Root X (L2)'], [3, 'ชี่ไม้เท้า (L3)'], [4, 'บัวบาน (L4)'], [5, 'ฮีล (L5)'],
               [6, 'บัวรอบตัว (L6)']],
    'shake': {},
    'thumbs': [0, 18, 30, 35, 41, 43, 49, 57],
    'thumbLabels': {0: 'READY', 18: 'PRAYER', 30: 'QI PEAK', 35: 'RELEASE', 41: 'BLOOM', 43: 'HEAL', 49: 'PETALS', 57: 'RECOVERY'},
    'thumbCrop': [20 * UP, 60 * UP, 425 * UP, 185 * UP],
    'travelLabel': 'L2 Root X (px) — 0 ยืนนิ่งขณะร่าย', 'heightLabel': 'Y movement (px)',
    'notes': [
        'หลินเสวี่ยยืนที่เดิมตลอด (root 0) หันขวา เท้าอยู่เส้นพื้นเดิม — ไม่มี VFX ใหญ่ในภาพตัวละคร',
        'บัวเกิดที่ตัวเพื่อน HP ต่ำสุด (ติด pivot ของเป้า) ตอนผายมือ T035 · ฮีลลงตอนบัวบานสุด T043',
        'เพื่อนรอบตัวเป้า (3×3) ได้ฮีลเบาพร้อมกัน + บัวเล็ก 55 % จางกว่า · เป้าหลักไม่ได้บัวเล็กซ้ำ',
        'ไม่มี hit-stop / สั่นกล้อง (ฮีล ไม่ใช่การโจมตี)',
        'VFX ภาพพิกเซล + แสงชมพูนุ่ม: alpha / สีแยกจากพื้น magenta ย่อแบบเนียน',
    ],
}
json.dump({'fps': FPS, 'frames': N, 'canvas': [W, H], 'upscale': UP, 'ground': GROUND,
           'characterTiming': [{'from': a, 'to': b, 'char': f'C{c:02d}', 'drawnFrame': c} for a, b, c in CHAR],
           'rootTracks': {'travel': [[0, 0], [N - 1, 0]], 'height': [[0, 0], [N - 1, 0]]},
           'perFrame': pf, 'vfx': LOG, 'sheet': meta, 'gameFx': game_fx, 'game': game},
          open(f'{OUT}/linxue_s1_timeline.json', 'w'), indent=1, ensure_ascii=False)
print(json.dumps({'scale': SC, 'gameFx': game_fx, 'game': game}, indent=1, default=float))
