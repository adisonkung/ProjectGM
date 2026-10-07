"""Yue Zheng — Skill 1 Iron Wall Taunt: VFX cut + 60 FPS preview + timeline JSON + in-game FX strips.

Inputs (art/incoming/yuezheng, not committed):
  s1_vfx.png     main VFX, 10 frames in one row (Mountain Seal shield wall: spark → arc → full wall → break → spark)
  s1_impact.png  impact VFX, 8 frames in one row (taunt / pressure burst — not enemy damage)
  public/sprites/hero-yuezheng.png row 5 (character, built by tools/sprites/yuezheng.py)

Timeline (user spec 2026-10, 60 FPS, T000–T059 = 1.00 s):
  A ready / brace T000–T011 · B shield anticipation T012–T025 · C taunt activation T026–T035 · D defensive hold
  T036–T047 · E recovery T048–T059. Main VFX spawns T026 on the shield's front centre (stable pivot), taunt + damage
  reduction apply T030, impact peaks T032 slightly in front of the shield, recovery T048. Character stays on its tile.

Outputs:
  <out>/yuezheng_s1_preview_60fps.mp4 · _50fps.gif · _contact.png · yuezheng_s1_timeline.json (with the sync-sheet
  meta: phases, poses, events, tracks, layers, notes → tools/sprites/ult_sync_sheet.py)
  public/sprites/fx-yuezheng-s1-main.png / fx-yuezheng-s1-impact.png — the tracks resampled to 30 FPS in timeline
  order (every 2nd T), frames at atlas px (FX scale 1 / FX_SCALE), so the game plays exactly the sheet's timing

Usage: python3 tools/sprites/yuezheng_s1.py <out dir>
"""
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, os.path.dirname(__file__))
import bailong as B  # noqa: E402

B.SRC = 'art/incoming/yuezheng'
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/yz_s1'
os.makedirs(OUT, exist_ok=True)
FPS, N = 60, 60
CELL_W, CELL_H, ROOT = 260, 170, (130, 155)
W, H, UP = 360, 200, 3                  # preview canvas (atlas px) · ×3 nearest
GROUND, X0 = 168, 120                   # feet on the canvas
CELL_PX = 80                            # 1 board cell in atlas px
BODY = 78                               # idle body height (atlas px)

# ------------------------------------------------------------------ character (atlas row 5, already game scale)
atlas = np.array(Image.open('public/sprites/hero-yuezheng.png').convert('RGBA'))
ROW = atlas[5 * CELL_H:6 * CELL_H]
CHAR = [  # (from T, to T, pose C##)
    (0, 5, 1), (6, 11, 2), (12, 16, 3), (17, 19, 4), (20, 25, 5), (26, 35, 6), (36, 47, 7), (48, 51, 8), (52, 55, 9), (56, 59, 10)]


def pose(c):
    return ROW[:, (c - 1) * CELL_W:c * CELL_W]


def shield_front(c):
    """front-centre of the shield in cell px: the right-most opaque column in the body band (25–80 % of the body),
    y = middle of the opaque run in that column"""
    a = pose(c)[..., 3] >= 128
    ys, xs = np.nonzero(a)
    top, bot = ys.min(), ys.max()
    band = a.copy()
    band[:int(top + .25 * (bot - top))] = False
    band[int(top + .8 * (bot - top)):] = False
    bx = np.nonzero(band.any(0))[0].max()
    col = np.nonzero(band[:, max(bx - 3, 0):bx + 1].any(1))[0]
    return float(bx), float((col.min() + col.max()) / 2)


FRONT = {c: shield_front(c) for c in range(1, 11)}


def char_at(t):
    return next(c for a, b, c in CHAR if a <= t <= b)


# ------------------------------------------------------------------ VFX strips
def cut(name, n):
    im, _ = B.load(name)
    a = im[..., 3] > 0
    # drop isolated specks of key noise
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
    # merge runs separated by small gaps until n frames remain
    while len(runs) > n:
        gaps = [runs[i + 1][0] - runs[i][1] for i in range(len(runs) - 1)]
        i = int(np.argmin(gaps))
        runs[i:i + 2] = [[runs[i][0], runs[i + 1][1]]]
    assert len(runs) == n, (name, len(runs))
    ys = np.nonzero(a.any(1))[0]
    cy = (ys.min() + ys.max()) / 2
    out = []
    for x0, x1 in runs:
        fr = im[:, x0:x1]
        fy = np.nonzero(fr[..., 3].any(1))[0]
        # each frame keeps the strip's common centre line (the pivot of the sheet), centred on its own core x
        core = fr[..., 3] > 200
        cx = float(np.nonzero(core.any(0))[0].mean()) if core.any() else (x1 - x0) / 2
        y0, y1 = int(fy.min()), int(fy.max()) + 1
        out.append({'img': fr[y0:y1], 'cx': cx, 'cy': cy - y0})
    return out


MAIN = cut('s1_vfx', 10)
IMPACT = cut('s1_impact', 8)
# size: the full wall (main f6) ≈ 1.15 × body height · the impact peak (f4) ≈ 1.0 × body height
def rows_h(fr):
    ys = np.nonzero(fr['img'][..., 3] > 0)[0]
    return ys.max() - ys.min()


SC = {'main': 1.15 * BODY / rows_h(MAIN[5]), 'impact': 0.85 * BODY / rows_h(IMPACT[3])}

# track plans: T → (frame 1-based, opacity)
MAIN_PLAN = {26: 1, 27: 2, 28: 3, 29: 4, 30: 5, 31: 5}
for t in range(32, 48):                   # defensive hold: the wall shimmers between f5 / f6
    MAIN_PLAN[t] = 6 if (t - 32) // 3 % 2 == 0 else 5
MAIN_PLAN.update({48: 7, 49: 7, 50: 7, 51: 8, 52: 8, 53: 8, 54: 9, 55: 9, 56: 9, 57: 10, 58: 10, 59: 10})
MAIN_A = {t: (0.85 if t == 26 else 1.0) if t < 57 else [0.7, 0.45, 0.2][t - 57] for t in MAIN_PLAN}
IMP_PLAN = {26: 1, 27: 1, 28: 2, 29: 2, 30: 3, 31: 3, 32: 4, 33: 4, 34: 4, 35: 5, 36: 5, 37: 5,
            38: 6, 39: 6, 40: 6, 41: 7, 42: 7, 43: 7, 44: 8, 45: 8, 46: 8}
IMP_A = {t: 1.0 if t < 44 else [0.8, 0.55, 0.3][t - 44] for t in IMP_PLAN}
IMPACT_AHEAD = 14                        # px in front of the shield face
SHAKE = {30: (2, 0), 31: (-2, 1), 32: (1, -1)}


def scaled(fr, s, alpha=1.0):
    img = Image.fromarray(fr['img'])
    img = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.NEAREST)
    a = np.array(img)
    a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)
    if alpha < 1:
        # pixel-art fade: ordered dither instead of translucency
        bayer = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16
        th = np.tile(bayer, (a.shape[0] // 4 + 1, a.shape[1] // 4 + 1))[:a.shape[0], :a.shape[1]]
        a[..., 3] = np.where(th < alpha, a[..., 3], 0)
    return a, fr['cx'] * s, fr['cy'] * s


def anchor_main(t):
    c = char_at(t)
    fx, fy = FRONT[c]
    return fx - ROOT[0], fy - ROOT[1]       # relative to the feet (x right, y up negative)


# the main VFX keeps ONE pivot (spec: stable) — the shield front at the activation pose C06, used for the whole track
MAIN_AT = (FRONT[6][0] - ROOT[0], FRONT[6][1] - ROOT[1])
IMP_AT = (MAIN_AT[0] + IMPACT_AHEAD, MAIN_AT[1])


def background():
    a = np.zeros((H, W, 4), np.uint8)
    yy = np.arange(H)[:, None]
    sky = np.clip(yy / GROUND, 0, 1)
    a[..., 0], a[..., 1], a[..., 2] = (18 + 20 * sky), (22 + 26 * sky), (40 + 30 * sky)
    g = yy >= GROUND
    a[..., 0] = np.where(g, 40, a[..., 0])
    a[..., 1] = np.where(g, 58, a[..., 1])
    a[..., 2] = np.where(g, 46, a[..., 2])
    a[GROUND, :, :3] = (62, 86, 64)
    # tile marks: Yue Zheng's tile and the one in front
    for k in range(-1, 3):
        x = int(X0 - CELL_PX / 2 + k * CELL_PX)
        if 0 <= x < W:
            a[GROUND + 1:GROUND + 8, x, :3] = (80, 104, 82)
    a[..., 3] = 255
    return Image.fromarray(a)


EVENTS_LOG = []


def frame(t):
    img = background()
    c = char_at(t)
    p = Image.fromarray(pose(c))
    img.alpha_composite(p, (X0 - ROOT[0], GROUND - ROOT[1]))
    for key, plan, alph, strip, at in (('main', MAIN_PLAN, MAIN_A, MAIN, MAIN_AT), ('impact', IMP_PLAN, IMP_A, IMPACT, IMP_AT)):
        if t not in plan:
            continue
        a, cx, cy = scaled(strip[plan[t] - 1], SC[key], alph[t])
        px, py = X0 + at[0] - cx, GROUND + at[1] - cy
        img.alpha_composite(Image.fromarray(a), (round(px), round(py)))
        EVENTS_LOG.append({'T': t, 'track': key, 'frame': plan[t], 'x': round(px), 'y': round(py), 'opacity': round(alph[t], 2),
                           'split': 'front'})
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
                '-crf', '14', f'{OUT}/yuezheng_s1_preview_60fps.mp4'], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-i', f'{tmp}/f%03d.png', '-vf',
                'fps=50,scale=720:-1:flags=neighbor,split[a][b];[a]palettegen=max_colors=160[p];[b][p]paletteuse=dither=none',
                '-loop', '0', f'{OUT}/yuezheng_s1_preview_50fps.gif'], check=True)
keys = [0, 12, 20, 26, 28, 30, 32, 36, 44, 48, 54, 59]
cw, ch = 360, 200
sheet = Image.new('RGB', (cw * 6, ch * 2))
from PIL import ImageDraw  # noqa: E402
dr = ImageDraw.Draw(sheet)
for i, t in enumerate(keys):
    sheet.paste(frames[t].resize((cw, ch), Image.NEAREST), ((i % 6) * cw, (i // 6) * ch))
    dr.text(((i % 6) * cw + 6, (i // 6) * ch + 4), f'T{t:03d} C{char_at(t):02d}', fill=(255, 255, 255))
sheet.save(f'{OUT}/yuezheng_s1_preview_contact.png')

# ------------------------------------------------------------------ in-game FX strips (30 FPS, timeline order)
def bake(plan, alph, strip, key, at):
    ts = sorted(plan)[::2]
    tiles = [scaled(strip[plan[t] - 1], SC[key], alph[t]) for t in ts]
    # common box around the pivot so the pivot is the same point in every tile
    l = max(cx for _, cx, _ in tiles)
    r = max(a.shape[1] - cx for a, cx, _ in tiles)
    u = max(cy for _, _, cy in tiles)
    d = max(a.shape[0] - cy for a, _, cy in tiles)
    w, h = int(np.ceil(l + r)) + 2, int(np.ceil(u + d)) + 2
    out = Image.new('RGBA', (w * len(tiles), h), (0, 0, 0, 0))
    for i, (a, cx, cy) in enumerate(tiles):
        out.alpha_composite(Image.fromarray(a), (i * w + round(l - cx) + 1, round(u - cy) + 1))
    out.save(f'public/sprites/fx-yuezheng-s1-{key}.png', optimize=True)
    pivot = ((l + 1) / w, (u + 1) / h)
    return {'frames': len(tiles), 'w': w, 'h': h, 'frameMs': round(2000 / 60, 2), 'pivot': [round(pivot[0], 4), round(pivot[1], 4)],
            # board offset of the pivot: % of a cell from the cell centre (feet at +27.25 %, 1 atlas px = 1.25 %)
            'dx': round(at[0] * 1.25, 2), 'dy': round(27.25 + at[1] * 1.25, 2)}


game_fx = {'main': bake(MAIN_PLAN, MAIN_A, MAIN, 'main', MAIN_AT), 'impact': bake(IMP_PLAN, IMP_A, IMPACT, 'impact', IMP_AT)}

# ------------------------------------------------------------------ timeline JSON (+ sync-sheet meta)
pf = []
for t in range(N):
    c = char_at(t)
    fx, fy = FRONT[c]
    pf.append({'T': t, 'char': f'C{c:02d}', 'drawnFrame': c, 'root': [X0, GROUND],
               'spearTip': [X0 + fx - ROOT[0], GROUND + fy - ROOT[1]], 'center': [X0, GROUND - BODY / 2]})
steps = [round((b - a + 1) * 1000 / 60) for a, b, _ in CHAR]
steps[-1] += 1000 - sum(steps)
meta = {
    'name': 'yuezheng_s1_sync_sheet',
    'readme': ['Timeline Sync Sheet — Skill 1 Iron Wall Taunt · Yue Zheng', '',
               '60 FPS, 60 เฟรม (T000–T059) = 1.00 วินาที · ตัวละคร 10 ท่า + Main VFX (10 เฟรม) + Impact VFX (8 เฟรม)',
               'Frames = ทุกเฟรม · Character = ท่า C01–C10 + ความยาวในเกม · VFX Tracks / Events / Layers',
               'หน่วย: px = พิกเซลของแผ่นเกม (canvas 360×200, พื้น y = 168) · 80 px = 1 ช่องสนาม · ตัวละครไม่เคลื่อนที่',
               'ที่มา: tools/sprites/yuezheng_s1.py → yuezheng_s1_timeline.json → tools/sprites/ult_sync_sheet.py'],
    'gameNote': 'Game ms = steps ของท่า skill ใน SHEETS hero-yuezheng.png (เท่ากับไทม์ไลน์นี้ รวม 1,000 ms)',
    'title': 'Timeline Sync Sheet — Skill 1 Iron Wall Taunt  ·  Yue Zheng · Iron Mountain Bastion',
    'subtitle': '60 FPS · 60 frames (T000–T059) = 1.00 s · 1 column = 1 frame (16.7 ms) · character + Main VFX + Impact VFX',
    'phases': [[0, 11, 'A', 'READY / BRACE', [120, 130, 150], 'พร้อม / ตั้งหลัก'],
               [12, 25, 'B', 'SHIELD ANTICIPATION', [70, 140, 220], 'ง้างโล่'],
               [26, 35, 'C', 'TAUNT ACTIVATION', [215, 70, 70], 'ยั่วยุ'],
               [36, 47, 'D', 'DEFENSIVE HOLD', [200, 170, 60], 'ค้างตั้งรับ'],
               [48, 59, 'E', 'RECOVERY', [90, 170, 120], 'กลับท่า']],
    'poses': {1: ['F1', 'ตั้งการ์ดปกติ', 'CAST_START'], 2: ['F2', 'ลดจุดศูนย์ถ่วงเล็กน้อย', ''],
              3: ['F3', 'เท้าหลังยัน โล่เริ่มเคลื่อนไปหน้า', 'BRACE_START'], 4: ['F4', 'โล่ยกขึ้น ลำตัวเกร็ง', ''],
              5: ['F5', 'ง้างรับเต็มที่ น้ำหนักอยู่หลังโล่ (ค้าง)', 'ANTICIPATION'],
              6: ['F6', 'ดันโล่ไปหน้า ท่ายั่วยุเต็มที่ (ค้าง 10 เฟรม)', 'SKILL_ACTIVATION · MAIN_VFX_SPAWN · TAUNT_APPLY T030'],
              7: ['F7', 'ค้างแรงกดดันหน้าโล่ (12 เฟรม)', 'DEFENSIVE_HOLD'], 8: ['F8', 'ถอยแรงเล็กน้อยแบบควบคุม', 'RECOVERY_START'],
              9: ['F9', 'โล่กลับสู่ท่าการ์ด', ''], 10: ['F10', 'กลับท่าพร้อมรบ', 'ANIMATION_END']},
    'gameSteps': steps,
    'hits': [30],
    'events': [[0, 'CAST_START', 'C01 · ท่าการ์ดปกติ'],
               [12, 'BRACE_START', 'C03 · เท้าหลังยัน โล่เริ่มเคลื่อน'],
               [20, 'ANTICIPATION', 'C05 · ง้างรับเต็มที่ ค้าง 6 เฟรม'],
               [26, 'SKILL_ACTIVATION', 'C06 · ดันโล่ไปหน้า'],
               [26, 'MAIN_VFX_SPAWN', 'กำแพงตราผนึกเกิดที่หน้าโล่ (pivot คงที่)'],
               [30, 'TAUNT_APPLY', 'ศัตรูรอบตัว (RADIUS_2) ต้องตีเยว่เจิ้ง 3 วิ · = DAMAGE ของท่าในเกม'],
               [30, 'DAMAGE_REDUCTION_APPLY', 'taunt_guard รับดาเมจ ×0.60'],
               [32, 'IMPACT_VFX_PEAK', 'แรงกดดันหน้าโล่สูงสุด · สั่น 2 px T030–T032'],
               [36, 'DEFENSIVE_HOLD', 'C07 · กำแพงค้าง (สลับ f5/f6 ทุก 3 เฟรม)'],
               [48, 'RECOVERY_START', 'C08 · กำแพงแตกออก f7'],
               [59, 'ANIMATION_END', 'C10 · กลับ idle']],
    'tracks': [['main', 'L2 Main VFX  shield wall', [120, 220, 210], 'fx-yuezheng-s1-main (s1_vfx.png 10 fr)', 'L2 · front of the character',
                'pivot = shield front-centre of C06 (stable)', 'f1–f5 grow T026–T031 · f5/f6 shimmer hold T032–T047 · f7 break T048 · f8–f10 fade'],
               ['impact', 'L3 Impact VFX  pressure', [240, 210, 120], 'fx-yuezheng-s1-impact (s1_impact.png 8 fr)', 'L3 · front',
                f'centre {IMPACT_AHEAD} px in front of the shield', 'f1–f3 T026–T031 · f4 peak T032–T034 · f5–f8 fade to T046']],
    'trackNames': {'main': 'กำแพงตราผนึก', 'impact': 'แรงกดดัน / ยั่วยุ'},
    'layers': [[1, 'ตัวละคร (L1)'], [2, 'Main VFX หน้าโล่ (L2)'], [3, 'Impact VFX หน้าโล่ (L3)'], [4, 'สั่นกล้อง 2 px (L4)']],
    'shake': {str(k): list(v) for k, v in SHAKE.items()},
    'thumbs': [0, 12, 20, 26, 30, 32, 36, 44, 48, 54, 59],
    'thumbCrop': [60 * UP, 62 * UP, 250 * UP, 186 * UP],
    'travelLabel': 'X movement (px) — ยืนช่องเดิม', 'heightLabel': 'Y movement (px)',
    'notes': [
        'ตัวละครไม่เคลื่อนที่ (X = 0, Y = 0 ตลอดท่า) — ยืนช่องเดิม เท้ายึดพื้น ความหนักมาจากการค้างท่า C05 / C06 / C07',
        'Main VFX: pivot เดียวทั้งท่า = หน้าโล่จุดกึ่งกลางของท่า C06 · เกิด T026 พร้อมดันโล่ · ค้างตลอดช่วงตั้งรับ · แตก T048 ตอนเริ่มถอย',
        f'Impact VFX: กลางห่างหน้าโล่ {IMPACT_AHEAD} px · แทนแรงกดดัน/การยั่วยุ ไม่ใช่ดาเมจศัตรู · สูงสุด T032',
        'ในเกม: TAUNT + damage reduction ลงที่ T030 (event DAMAGE ที่ step 5.4 ของท่า) · สั่น 2 px 50 ms ไม่มี hit-stop',
        'แผ่น FX ในเกมเรียงเฟรมตามไทม์ไลน์นี้ที่ 30 FPS (ทุก 2 T) = เล่นตรงชีตโดยไม่ต้องตั้งเวลาเพิ่ม',
    ],
}
json.dump({'fps': FPS, 'frames': N, 'canvas': [W, H], 'upscale': UP, 'ground': GROUND,
           'characterTiming': [{'from': a, 'to': b, 'char': f'C{c:02d}', 'drawnFrame': c} for a, b, c in CHAR],
           'rootTracks': {'travel': [[0, 0], [59, 0]], 'height': [[0, 0], [59, 0]]},
           'perFrame': pf, 'vfx': EVENTS_LOG, 'sheet': meta, 'gameFx': game_fx},
          open(f'{OUT}/yuezheng_s1_timeline.json', 'w'), indent=1, ensure_ascii=False)
print(json.dumps({'scale': SC, 'front': FRONT, 'mainAt': MAIN_AT, 'gameFx': game_fx, 'steps': steps}, indent=1, default=float))
