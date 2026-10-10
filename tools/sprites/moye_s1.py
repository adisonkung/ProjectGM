"""Mo Ye — Skill 1 Orchid Sever: VFX cut + 60 FPS preview + timeline JSON + in-game FX strips.

Inputs (art/incoming/moye, not committed):
  s1_vfx.png     main VFX, 8 frames in one row (crimson / black / white-pink crescent → crossing slash → petals)
  s1_impact.png  impact VFX, 8 frames in one row (star → X burst with petals → star)
  public/sprites/hero-moye.png row 5 (character, built by tools/sprites/moye.py — root motion baked per pose)

Timeline (user spec 2026-10, 60 FPS, T000–T047 = 0.80 s):
  A ready / load T000–T007 · B first slash T008–T019 (big right-hand blade, hit 1 T012) · C second slash T020–T031
  (small left-hand blade, hit 2 T024, impact peak T028) · D follow-through T032–T039 · E recovery T040–T047.
  Root: 0 → +12 px T008–T020, hold, back to +6 px by T047 (never a dash). Main VFX on the enemy centre (T012 crescent
  of the first cut → crossing slash peak T024), impact at the contact point (hit 1 T014 small, hit 2 T025 stronger).

Outputs:
  <out>/moye_s1_preview_60fps.mp4 · _50fps.gif · _contact.png · moye_s1_timeline.json (sync-sheet meta for
  tools/sprites/ult_sync_sheet.py)
  public/sprites/fx-moye-s1-main.png / -impact1.png / -impact2.png — the tracks resampled to 30 FPS in timeline order

Usage: python3 tools/sprites/moye_s1.py <out dir>
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
import bailong as B  # noqa: E402

B.SRC = 'art/incoming/moye'
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/moye_s1'
os.makedirs(OUT, exist_ok=True)
FPS, N = 60, 48
CELL_W, CELL_H, ROOT = 260, 170, (130, 155)
W, H, UP = 360, 200, 3                  # preview canvas (atlas px) · ×3 nearest
GROUND, X0 = 168, 120                   # Mo Ye's feet (pose 1) on the canvas
CELL_PX = 80                            # 1 board cell in atlas px
BODY = 74                               # idle body height (atlas px)
TARGET_X = X0 + CELL_PX                 # the enemy stands on the next cell
ENEMY_C = (TARGET_X - 6, GROUND - 40)   # enemy body centre (main VFX)
CONTACT = (TARGET_X - 14, GROUND - 42)  # blade contact on the enemy's front (impact VFX)

# ------------------------------------------------------------------ character (atlas row 5, game scale, root baked)
atlas = np.array(Image.open('public/sprites/hero-moye.png').convert('RGBA'))
ROW = atlas[5 * CELL_H:6 * CELL_H]
CHAR = [  # (from T, to T, pose C##)
    (0, 3, 1), (4, 5, 2), (6, 7, 3), (8, 10, 4), (11, 17, 5), (18, 22, 6), (23, 31, 7), (32, 39, 8), (40, 43, 9), (44, 47, 10)]
# root X (px forward) keys — the per-pose shift baked by moye.py ROOT_SHIFT samples this curve
ROOT_KEYS = [[0, 0], [8, 0], [20, 12], [32, 12], [47, 6]]


def root_x(t):
    for (a, va), (b, vb) in zip(ROOT_KEYS, ROOT_KEYS[1:]):
        if a <= t <= b:
            k = (t - a) / (b - a)
            k = k * k * (3 - 2 * k)
            return va + (vb - va) * k
    return ROOT_KEYS[-1][1]


def pose(c):
    return ROW[:, (c - 1) * CELL_W:c * CELL_W]


def char_at(t):
    return next(c for a, b, c in CHAR if a <= t <= b)


def blade_tip(c):
    """front-most opaque pixel in the arm band (20–70 % of the body) — where the leading blade is"""
    a = pose(c)[..., 3] >= 128
    ys, xs = np.nonzero(a)
    top, bot = ys.min(), ys.max()
    band = a.copy()
    band[:int(top + .2 * (bot - top))] = False
    band[int(top + .7 * (bot - top)):] = False
    bx = np.nonzero(band.any(0))[0].max()
    col = np.nonzero(band[:, bx])[0]
    return float(bx), float(col.mean())


TIP = {c: blade_tip(c) for c in range(1, 11)}

# ------------------------------------------------------------------ the training dummy that takes the cuts (preview only)
straw = np.array(Image.open('public/sprites/enemy-straw-recruit.png').convert('RGBA'))[0:100, 0:132][:, ::-1]


# ------------------------------------------------------------------ VFX strips
def load_vfx(name, thr=80):
    """crimson / pink VFX on #FF00FF: the shared magenta key (hue-based) eats the pink body of the slashes →
    key by RGB distance from the sheet's own background colour instead (hard alpha — pixel art)"""
    rgb = np.array(Image.open(f'{B.SRC}/{name}.png').convert('RGB')).astype(int)
    bg = np.median(np.concatenate([rgb[:8].reshape(-1, 3), rgb[-8:].reshape(-1, 3)]), 0)
    d = np.sqrt(((rgb - bg) ** 2).sum(-1))
    out = np.zeros(rgb.shape[:2] + (4,), np.uint8)
    out[..., :3] = rgb
    out[..., 3] = np.where(d > thr, 255, 0)
    # de-spill: edge pixels mixed with the magenta read purple — pull blue back toward the red / green of the pixel
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    spill = (b > g + 30) & (r > g + 30)
    out[..., 2] = np.where(spill, np.minimum(b, np.maximum(g + 20, (r * 0.55).astype(int))), b).astype(np.uint8)
    return out


def cut(name, n):
    im = load_vfx(name)
    a = im[..., 3] > 0
    lab, k = ndimage.label(a)
    sizes = ndimage.sum(a, lab, range(1, k + 1))
    a &= np.isin(lab, 1 + np.nonzero(sizes >= 3)[0])
    im[..., 3] = np.where(a, im[..., 3], 0)
    cols = a.any(0)
    runs, x = [], 0
    while x < len(cols):
        if cols[x]:
            s = x
            while x < len(cols) and cols[x]:
                x += 1
            runs.append([s, x])
        x += 1
    # pieces of one frame (petals, a crescent tail) sit a few px apart — real frames are ≥ 25 px apart
    i = 0
    while i < len(runs) - 1:
        if runs[i + 1][0] - runs[i][1] <= 14:
            runs[i:i + 2] = [[runs[i][0], runs[i + 1][1]]]
        else:
            i += 1
    while len(runs) > n:
        gaps = [runs[i + 1][0] - runs[i][1] for i in range(len(runs) - 1)]
        i = int(np.argmin(gaps))
        runs[i:i + 2] = [[runs[i][0], runs[i + 1][1]]]
    # two frames touching (a crescent's tail on the next frame): split the widest run at its emptiest column
    occ = a.sum(0)
    while len(runs) < n:
        i = int(np.argmax([b - a0 for a0, b in runs]))
        a0, b = runs[i]
        lo, hi = a0 + int(.3 * (b - a0)), a0 + int(.7 * (b - a0))
        c = lo + int(np.argmin(occ[lo:hi]))
        runs[i:i + 1] = [[a0, c], [c, b]]
    assert len(runs) == n, (name, len(runs))
    ys = np.nonzero(a.any(1))[0]
    cy = (ys.min() + ys.max()) / 2
    out = []
    for x0, x1 in runs:
        fr = im[:, x0:x1]
        fy = np.nonzero(fr[..., 3].any(1))[0]
        core = fr[..., 3] > 200
        bright = core & (fr[..., :3].astype(int).sum(-1) > 600)     # the white-hot centre of the slash / burst
        pick = bright if bright.sum() > 6 else core
        cx = float(np.nonzero(pick.any(0))[0].mean()) if pick.any() else (x1 - x0) / 2
        y0, y1 = int(fy.min()), int(fy.max()) + 1
        out.append({'img': fr[y0:y1], 'cx': cx, 'cy': cy - y0})
    return out


MAIN = cut('s1_vfx', 8)
IMPACT = cut('s1_impact', 8)


def rows_h(fr):
    ys = np.nonzero(fr['img'][..., 3] > 0)[0]
    return ys.max() - ys.min()


# sizes: the first cut's crescent (main f4) ≈ 1.15 × body · impact hit 1 peak ≈ 0.55 × body, hit 2 ≈ 0.8 × body
# (below Skill 2 / Ultimate, per spec)
SC = {'main': 1.15 * BODY / rows_h(MAIN[3]),
      'imp1': 0.55 * BODY / rows_h(IMPACT[3]), 'imp2': 0.8 * BODY / rows_h(IMPACT[3])}

# track plans: T → frame (1-based)
MAIN_PLAN = {12: 1, 13: 2, 14: 3, 15: 3, 16: 4, 17: 4, 18: 4, 19: 4, 20: 5, 21: 5, 22: 5, 23: 5,
             24: 6, 25: 6, 26: 6, 27: 6, 28: 6, 29: 7, 30: 7, 31: 7, 32: 7, 33: 8, 34: 8, 35: 8, 36: 8, 37: 8}
MAIN_A = {t: 1.0 if t < 35 else [0.7, 0.45, 0.2][t - 35] for t in MAIN_PLAN}
IMP1_PLAN = {14: 1, 15: 2, 16: 3, 17: 3, 18: 4, 19: 7, 20: 7, 21: 8}
IMP1_A = {t: 1.0 if t < 21 else 0.5 for t in IMP1_PLAN}
IMP2_PLAN = {25: 1, 26: 2, 27: 3, 28: 4, 29: 4, 30: 4, 31: 5, 32: 5, 33: 6, 34: 6, 35: 7, 36: 7, 37: 8, 38: 8}
IMP2_A = {t: 1.0 if t < 37 else [0.6, 0.3][t - 37] for t in IMP2_PLAN}
SHAKE = {12: (2, 0), 13: (-2, 1), 14: (1, 0), 24: (3, -1), 25: (-3, 1), 26: (2, 0)}
HITS = [12, 24]
HITSTOP_MS = [17, 33]                   # game only: 1 / 2 display frames frozen on the hits


def scaled(fr, s, alpha=1.0):
    img = Image.fromarray(fr['img'])
    img = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.NEAREST)
    a = np.array(img)
    a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)
    if alpha < 1:
        bayer = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16
        th = np.tile(bayer, (a.shape[0] // 4 + 1, a.shape[1] // 4 + 1))[:a.shape[0], :a.shape[1]]
        a[..., 3] = np.where(th < alpha, a[..., 3], 0)
    return a, fr['cx'] * s, fr['cy'] * s


TRACKS = [  # key, plan, alpha, strip, scale key, anchor (canvas px)
    ('main', MAIN_PLAN, MAIN_A, MAIN, 'main', ENEMY_C),
    ('impact1', IMP1_PLAN, IMP1_A, IMPACT, 'imp1', CONTACT),
    ('impact2', IMP2_PLAN, IMP2_A, IMPACT, 'imp2', CONTACT),
]


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
    for k in range(-1, 3):
        x = int(X0 - CELL_PX / 2 + k * CELL_PX)
        if 0 <= x < W:
            a[GROUND + 1:GROUND + 8, x, :3] = (80, 104, 82)
    a[..., 3] = 255
    img = Image.fromarray(a)
    img.alpha_composite(Image.fromarray(straw), (TARGET_X - (132 - 66), GROUND - 86))
    return img


LOG = []


def frame(t):
    img = background()
    c = char_at(t)
    img.alpha_composite(Image.fromarray(pose(c)), (X0 - ROOT[0], GROUND - ROOT[1]))
    for key, plan, alph, strip, sk, at in TRACKS:
        if t not in plan:
            continue
        a, cx, cy = scaled(strip[plan[t] - 1], SC[sk], alph[t])
        px, py = at[0] - cx, at[1] - cy
        img.alpha_composite(Image.fromarray(a), (round(px), round(py)))
        LOG.append({'T': t, 'track': 'main' if key == 'main' else 'impact', 'frame': plan[t], 'x': round(px), 'y': round(py),
                    'opacity': round(alph[t], 2), 'split': 'front'})
    for h in HITS:
        if h <= t <= h + 1:
            LOG.append({'T': t, 'track': 'damage', 'frame': HITS.index(h) + 1, 'x': 0, 'y': 0, 'opacity': 1.0 if t == h else 0.5, 'split': '-'})
    if t in SHAKE:
        out = background()
        out.paste(img, SHAKE[t])
        img = out
    return img.resize((W * UP, H * UP), Image.NEAREST).convert('RGB')


frames = [frame(t) for t in range(N)]
tmp = tempfile.mkdtemp()
for i, f in enumerate(frames):
    f.save(f'{tmp}/f{i:03d}.png')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-i', f'{tmp}/f%03d.png', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                '-crf', '14', f'{OUT}/moye_s1_preview_60fps.mp4'], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-i', f'{tmp}/f%03d.png', '-vf',
                'fps=50,scale=720:-1:flags=neighbor,split[a][b];[a]palettegen=max_colors=160[p];[b][p]paletteuse=dither=none',
                '-loop', '0', f'{OUT}/moye_s1_preview_50fps.gif'], check=True)
keys = [0, 6, 10, 12, 16, 20, 24, 28, 32, 36, 40, 47]
cw, ch = 360, 200
sheet = Image.new('RGB', (cw * 6, ch * 2))
dr = ImageDraw.Draw(sheet)
for i, t in enumerate(keys):
    sheet.paste(frames[t].resize((cw, ch), Image.NEAREST), ((i % 6) * cw, (i // 6) * ch))
    dr.text(((i % 6) * cw + 6, (i // 6) * ch + 4), f'T{t:03d} C{char_at(t):02d}', fill=(255, 255, 255))
sheet.save(f'{OUT}/moye_s1_preview_contact.png')


# ------------------------------------------------------------------ in-game FX strips (30 FPS, timeline order)
def bake(plan, alph, strip, sk, name, at):
    ts = sorted(plan)[::2]
    tiles = [scaled(strip[plan[t] - 1], SC[sk], alph[t]) for t in ts]
    l = max(cx for _, cx, _ in tiles)
    r = max(a.shape[1] - cx for a, cx, _ in tiles)
    u = max(cy for _, _, cy in tiles)
    d = max(a.shape[0] - cy for a, _, cy in tiles)
    w, h = int(np.ceil(l + r)) + 2, int(np.ceil(u + d)) + 2
    out = Image.new('RGBA', (w * len(tiles), h), (0, 0, 0, 0))
    for i, (a, cx, cy) in enumerate(tiles):
        out.alpha_composite(Image.fromarray(a), (i * w + round(l - cx) + 1, round(u - cy) + 1))
    out.save(f'public/sprites/fx-moye-s1-{name}.png', optimize=True)
    pivot = ((l + 1) / w, (u + 1) / h)
    # at: 'target' — offset of the pivot from the TARGET's cell centre in % of a cell (its feet at +27.25 %,
    # 1 atlas px = 1.25 %); negative x = toward Mo Ye (the board mirrors it with her facing)
    return {'frames': len(tiles), 'w': w, 'h': h, 'frameMs': round(2000 / 60, 2), 'pivot': [round(pivot[0], 4), round(pivot[1], 4)],
            'dx': round((at[0] - TARGET_X) * 1.25, 2), 'dy': round(27.25 + (at[1] - GROUND) * 1.25, 2),
            'startT': min(plan), 'delayMsAfterHit': round((min(plan) - (12 if name != 'impact2' else 24)) * 1000 / 60)}


game_fx = {name: bake(plan, alph, strip, sk, name, at) for name, plan, alph, strip, sk, at in TRACKS}

# ------------------------------------------------------------------ timeline JSON (+ sync-sheet meta)
pf = []
for t in range(N):
    c = char_at(t)
    fx, fy = TIP[c]
    pf.append({'T': t, 'char': f'C{c:02d}', 'drawnFrame': c, 'root': [round(X0 + root_x(t), 1), GROUND],
               'spearTip': [X0 + fx - ROOT[0], GROUND + fy - ROOT[1]], 'center': [X0, GROUND - BODY / 2]})
steps = [round((b - a + 1) * 1000 / 60) for a, b, _ in CHAR]
steps[-1] += 800 - sum(steps)
meta = {
    'name': 'moye_s1_sync_sheet',
    'readme': ['Timeline Sync Sheet — Skill 1 Orchid Sever · Mo Ye', '',
               '60 FPS, 48 เฟรม (T000–T047) = 0.80 วินาที · ตัวละคร 10 ท่า + Main VFX (8 เฟรม) + Impact VFX (8 เฟรม × 2 จังหวะ)',
               'Frames = ทุกเฟรม · Character = ท่า C01–C10 + ความยาวในเกม · VFX Tracks / Events / Layers',
               'หน่วย: px = พิกเซลของแผ่นเกม (canvas 360×200, พื้น y = 168) · 80 px = 1 ช่องสนาม · หุ่นฝึกยืนช่องถัดไป',
               'ที่มา: tools/sprites/moye_s1.py → moye_s1_timeline.json → tools/sprites/ult_sync_sheet.py'],
    'gameNote': 'Game ms = steps ของท่า skill ใน SHEETS hero-moye.png (เท่ากับไทม์ไลน์นี้ รวม 800 ms)',
    'title': 'Timeline Sync Sheet — Skill 1 Orchid Sever  ·  Mo Ye · Shadow Orchid Blade',
    'subtitle': '60 FPS · 48 frames (T000–T047) = 0.80 s · 1 column = 1 frame (16.7 ms) · 2 hits T012 / T024 · character + Main VFX + Impact VFX',
    'phases': [[0, 7, 'A', 'READY / LOAD', [120, 130, 150], 'พร้อม / ง้าง'],
               [8, 19, 'B', 'FIRST SLASH', [215, 70, 90], 'ฟันแรก ดาบใหญ่'],
               [20, 31, 'C', 'SECOND SLASH', [190, 40, 110], 'ฟันสอง ดาบเล็ก'],
               [32, 39, 'D', 'FOLLOW-THROUGH', [200, 170, 60], 'ส่งแรงต่อ'],
               [40, 47, 'E', 'RECOVERY', [90, 170, 120], 'กลับท่า']],
    'poses': {1: ['F1', 'ท่าพร้อม ดาบใหญ่มือขวา / ดาบเล็กมือซ้าย', 'CAST_START'],
              2: ['F2', 'ย่อตัวโหลดน้ำหนัก', ''],
              3: ['F3', 'ยกดาบใหญ่ (มือขวา) เหนือไหล่', 'ANTICIPATION T006'],
              4: ['F4', 'ก้าวพุ่ง ดาบใหญ่เริ่มฟัน', 'SLASH_1_START T008'],
              5: ['F5', 'ดาบใหญ่ฟันสุดแขน (ค้าง 7 เฟรม)', 'DAMAGE_HIT_1 T012 · MAIN_VFX_SPAWN_1'],
              6: ['F6', 'บิดตัวส่งดาบเล็ก', 'SLASH_2_START T020'],
              7: ['F7', 'ดาบเล็ก (มือซ้าย) แทงตัดปิด (ค้าง 9 เฟรม)', 'DAMAGE_HIT_2 T024 · MAIN_VFX_PEAK'],
              8: ['F8', 'ส่งแรงต่อ ดึงดาบกลับ', 'FOLLOW_THROUGH T032'],
              9: ['F9', 'ยืดตัวกลับ', 'RECOVERY_START T040'],
              10: ['F10', 'กลับท่าพร้อมรบ', 'ANIMATION_END T047']},
    'gameSteps': steps,
    'hits': HITS,
    'events': [[0, 'CAST_START', 'C01 · ท่าพร้อม'],
               [6, 'ANTICIPATION', 'C03 · ยกดาบใหญ่ ง้างสุด'],
               [8, 'SLASH_1_START', 'C04 · ก้าวพุ่ง ดาบใหญ่นำ'],
               [12, 'DAMAGE_HIT_1', 'ดาบใหญ่โดน 45 % · สั่น 2 px'],
               [12, 'MAIN_VFX_SPAWN_1', 'เสี้ยวพระจันทร์ที่กลางตัวศัตรู'],
               [14, 'IMPACT_VFX_SPAWN_1', 'ประกายเล็ก-กลางที่จุดสัมผัส'],
               [20, 'SLASH_2_START', 'C06 · บิดตัวส่งดาบเล็ก'],
               [24, 'DAMAGE_HIT_2', 'ดาบเล็กโดน 55 % · สั่น 3 px'],
               [24, 'MAIN_VFX_PEAK', 'รอยฟันไขว้ (X) สูงสุด'],
               [25, 'IMPACT_VFX_SPAWN_2', 'ประกายจังหวะสอง แรงกว่า'],
               [28, 'IMPACT_PEAK', 'impact จังหวะสองสูงสุด'],
               [32, 'FOLLOW_THROUGH', 'C08 · ส่งแรงต่อ'],
               [40, 'RECOVERY_START', 'C09'],
               [47, 'ANIMATION_END', 'C10 · กลับ idle']],
    'tracks': [['main', 'L3 Skill 1 Main VFX', [235, 90, 130], 'fx-moye-s1-main (s1_vfx.png 8 fr)', 'L3 · front, on the enemy',
                'pivot = enemy body centre (white-hot core of each frame)', 'f1 spark T012 · f2–f4 crescent (1st cut, big) T013–T019 · f5 T020 · f6 crossing X peak T024–T028 · f7–f8 petals fade to T037'],
               ['impact', 'L4 Skill 1 Impact VFX', [255, 200, 140], 'fx-moye-s1-impact1 / impact2 (s1_impact.png 8 fr)', 'L4 · front',
                'contact point on the enemy front', 'hit 1 T014–T021 (0.55 body, small) · hit 2 T025–T038 (0.8 body, peak T028)'],
               ['damage', 'L5 Damage events', [230, 90, 90], 'engine', '-', '-', 'T012 hit 1 (45 %) · T024 hit 2 (55 %) — same target']],
    'trackNames': {'main': 'รอยฟันกล้วยไม้', 'impact': 'ประกายกระทบ', 'damage': 'ดาเมจ'},
    'layers': [[1, 'ตัวละคร (L1)'], [2, 'Root X (L2)'], [3, 'Main VFX บนศัตรู (L3)'], [4, 'Impact VFX จุดสัมผัส (L4)'],
               [5, 'ดาเมจ (L5)'], [6, 'สั่นกล้อง (L6)']],
    'shake': {str(k): list(v) for k, v in SHAKE.items()},
    'thumbs': [0, 6, 12, 24, 28, 40, 47],
    'thumbLabels': {0: 'READY', 6: 'ANTICIPATION', 12: 'HIT 1', 24: 'HIT 2', 28: 'IMPACT PEAK', 40: 'RECOVERY', 47: 'END'},
    'thumbCrop': [60 * UP, 50 * UP, 270 * UP, 186 * UP],
    'travelLabel': 'L2 Root X (px) — ก้าวเข้า 12 แล้วคืน 6', 'heightLabel': 'Y movement (px)',
    'notes': [
        'มือ: ดาบใหญ่อยู่มือขวา / ดาบเล็กอยู่มือซ้ายเสมอ — ฟันแรก (T012) นำด้วยดาบใหญ่ C05 · ฟันสอง (T024) ปิดด้วยดาบเล็ก C07 · ห้ามสลับมือ',
        'VFX anchor: Main = กลางตัวศัตรู (เสี้ยวแรกใหญ่ > รอยไขว้เล็กเร็ว) · Impact = จุดสัมผัสหน้าศัตรู · ห้ามเกิดไกลจากเป้า',
        'Damage: 2 จังหวะ T012 / T024 แบ่ง 45 / 55 % ของดาเมจ S1 คลาส (event DAMAGE ของท่า = step 4.14 / 6.11) · เป้าเดียวกัน ตายก่อน = จังหวะสองไม่ลง',
        'Hit-stop (ในเกม): 17 ms ฟันแรก · 33 ms ฟันสอง — preview นี้ไม่หยุดเฟรม',
        'Root: 0 > +12 px T008–T020 · ค้าง · คืนเหลือ +6 px T047 (อบในแผ่น sprite ต่อท่า, ไม่ใช่ dash, ไม่เปลี่ยนช่อง)',
        'Camera shake: 2 px T012–T014 · 3 px T024–T026 · Impact S1 เล็กกว่า S2 / Ultimate เสมอ',
    ],
}
json.dump({'fps': FPS, 'frames': N, 'canvas': [W, H], 'upscale': UP, 'ground': GROUND,
           'characterTiming': [{'from': a, 'to': b, 'char': f'C{c:02d}', 'drawnFrame': c} for a, b, c in CHAR],
           'rootTracks': {'travel': ROOT_KEYS, 'height': [[0, 0], [N - 1, 0]]},
           'perFrame': pf, 'vfx': LOG, 'sheet': meta, 'gameFx': game_fx},
          open(f'{OUT}/moye_s1_timeline.json', 'w'), indent=1, ensure_ascii=False)
print(json.dumps({'scale': SC, 'tip': TIP, 'gameFx': game_fx, 'steps': steps}, indent=1, default=float))
