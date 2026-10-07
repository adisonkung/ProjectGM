"""Yue Zheng — Skill 2 Tiger Gate Ram: VFX cut + 60 FPS preview + timeline JSON (sync-sheet meta) + in-game FX strips.

Inputs (art/incoming/yuezheng, not committed):
  s2_vfx.png     main VFX, 12 frames (shield-front crescent wave: spark → grows with the rush → max at the collision →
                 streaks dissolve) · the crescent's convex front points in the charge direction
  s2_impact.png  impact VFX, 8 frames (collision burst with rubble — at the enemy-contact point)
  public/sprites/hero-yuezheng.png row 6 (character, tools/sprites/yuezheng.py)

Timeline (user spec 2026-10, 60 FPS, T000–T051 = 0.87 s):
  A ready T000–T007 · B load T008–T017 · C charge T018–T031 · D collision T032–T037 · E push-through T038–T043 ·
  F recovery T044–T051. Root travel starts T018, ≈ 0.9 tile by the collision T032, stops after a short push-through.
  Damage / interrupt / stun / impact spawn T032 at the contact point, impact peak T034, shake peak T036.

Outputs: <out>/yuezheng_s2_preview_60fps.mp4 · _50fps.gif · _contact.png · yuezheng_s2_timeline.json
  public/sprites/fx-yuezheng-s2-main.png (the whole wave in front of Yue Zheng — user 2026-10) and fx-yuezheng-s2-impact.png — sync-sheet order at 30 FPS, atlas px.
  In game the CHARGE relocation happens at cast start (engine), so the main wave is baked relative to Yue Zheng's
  feet without the travel (it rides with him); the impact plays on the target, at the contact side.

Usage: python3 tools/sprites/yuezheng_s2.py <out dir>
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

B.SRC = 'art/incoming/yuezheng'
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/yz_s2'
os.makedirs(OUT, exist_ok=True)
FPS, N = 60, 52
CELL_W, CELL_H, ROOT = 260, 170, (130, 155)
W, H, UP = 400, 200, 3
GROUND, X0 = 168, 100
CELL_PX, BODY = 80, 78

atlas = np.array(Image.open('public/sprites/hero-yuezheng.png').convert('RGBA'))
ROW = atlas[6 * CELL_H:7 * CELL_H]
CHAR = [(0, 3, 1), (4, 7, 2), (8, 13, 3), (14, 17, 4), (18, 21, 5), (22, 24, 6), (25, 31, 7), (32, 37, 8),
        (38, 43, 9), (44, 46, 10), (47, 49, 11), (50, 51, 12)]
# root travel (atlas px, 80 = 1 tile): still until T018, fast ramp, 0.9 tile at the collision, short push, stop
TRAVEL = [(0, 0), (18, 0), (25, 26), (32, 72), (38, 80), (51, 80)]


def pose(c):
    return ROW[:, (c - 1) * CELL_W:c * CELL_W]


def shield_front(c):
    a = pose(c)[..., 3] >= 128
    ys, xs = np.nonzero(a)
    top, bot = ys.min(), ys.max()
    band = a.copy()
    band[:int(top + .25 * (bot - top))] = False
    band[int(top + .8 * (bot - top)):] = False
    bx = np.nonzero(band.any(0))[0].max()
    col = np.nonzero(band[:, max(bx - 3, 0):bx + 1].any(1))[0]
    return float(bx), float((col.min() + col.max()) / 2)


FRONT = {c: shield_front(c) for c in range(1, 13)}


def char_at(t):
    return next(c for a, b, c in CHAR if a <= t <= b)


def ease(u):
    return u * u * (3 - 2 * u)


def travel(t):
    for (a, va), (b, vb) in zip(TRAVEL, TRAVEL[1:]):
        if a <= t <= b:
            u = (t - a) / (b - a)
            # the rush accelerates (ease-in), the push-through decelerates (ease-out)
            k = u * u if a == 18 else (1 - (1 - u) ** 2) if a == 32 else ease(u)
            return va + (vb - va) * k
    return TRAVEL[-1][1]


def cut(name, n):
    im, _ = B.load(name)
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
        core = fr[..., 3] > 200
        cx = float(np.nonzero(core.any(0))[0].mean()) if core.any() else (x1 - x0) / 2
        fx = np.nonzero(fr[..., 3].any(0))[0]
        y0, y1 = int(fy.min()), int(fy.max()) + 1
        out.append({'img': fr[y0:y1], 'cx': cx, 'cy': cy - y0, 'front': float(fx.max())})
    return out


MAIN = cut('s2_vfx', 12)
IMPACT = cut('s2_impact', 8)


def rows_h(fr):
    ys = np.nonzero(fr['img'][..., 3] > 0)[0]
    return ys.max() - ys.min()


# the collision wave (main f8) ≈ 1.2 × body height · the impact peak (f4) ≈ 1.15 × body height (rubble included)
# (+20 % after review: "ขยายสกิลให้ใหญ่ขึ้นนิดนึง")
SC = {'main': 1.2 * BODY / rows_h(MAIN[7]), 'impact': 1.15 * BODY / rows_h(IMPACT[3])}

MAIN_PLAN, MAIN_A = {}, {}
for f, (a, b) in enumerate([(18, 19), (20, 21), (22, 23), (24, 25), (26, 27), (28, 29), (30, 31), (32, 34), (35, 37),
                            (38, 40), (41, 43), (44, 46)], 1):
    for t in range(a, b + 1):
        MAIN_PLAN[t] = f
        MAIN_A[t] = 1.0 if t < 44 else [0.7, 0.45, 0.2][t - 44]
IMP_PLAN = {32: 1, 33: 2, 34: 4, 35: 4, 36: 4, 37: 5, 38: 5, 39: 5, 40: 6, 41: 6, 42: 6, 43: 7, 44: 7, 45: 7, 46: 8, 47: 8, 48: 8}
IMP_A = {t: 1.0 if t < 46 else [0.75, 0.5, 0.25][t - 46] for t in IMP_PLAN}
# impact f3 is skipped: f2 → f4 at the peak (T034) keeps the burst sharp at 60 FPS
WAVE_LEAD = 4          # px the crescent's front sits ahead of the shield face
SHAKE = {32: (4, 0), 33: (-5, 2), 34: (6, -2), 35: (-7, 2), 36: (8, -3), 37: (-5, 2), 38: (3, -1), 39: (-1, 0)}
CONTACT = FRONT[8][0] - ROOT[0] + 10   # contact point x (from the feet) on the collision pose, before travel


def scaled(fr, s, alpha=1.0):
    img = Image.fromarray(fr['img'])
    img = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.NEAREST)
    a = np.array(img)
    a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)
    if alpha < 1:
        bayer = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16
        th = np.tile(bayer, (a.shape[0] // 4 + 1, a.shape[1] // 4 + 1))[:a.shape[0], :a.shape[1]]
        a[..., 3] = np.where(th < alpha, a[..., 3], 0)
    return a, fr['cx'] * s, fr['cy'] * s, fr['front'] * s


def main_place(t):
    """main wave tile + its top-left relative to the feet (no travel): the crescent front on the shield face + lead,
    vertical centre line on the shield centre"""
    a, cx, cy, front = scaled(MAIN[MAIN_PLAN[t] - 1], SC['main'], MAIN_A[t])
    fx, fy = FRONT[char_at(t)]
    return a, (fx - ROOT[0] + WAVE_LEAD - front, fy - ROOT[1] - cy), fx - ROOT[0]


def imp_place(t):
    a, cx, cy, _ = scaled(IMPACT[IMP_PLAN[t] - 1], SC['impact'], IMP_A[t])
    _, fy = FRONT[8]
    return a, (CONTACT - cx, fy - ROOT[1] - cy)


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
    for k in range(-1, 4):
        x = int(X0 - CELL_PX / 2 + k * CELL_PX)
        if 0 <= x < W:
            a[GROUND + 1:GROUND + 8, x, :3] = (80, 104, 82)
    a[..., 3] = 255
    return Image.fromarray(a)


LOG = []


def frame(t):
    img = background()
    rx = X0 + travel(t)
    back = front = None
    if t in MAIN_PLAN:
        a, (ox, oy), face = main_place(t)
        pos = (round(rx + ox), round(GROUND + oy))
        front = (Image.fromarray(a), pos)          # the whole wave in front of the character
        LOG.append({'T': t, 'track': 'main', 'frame': MAIN_PLAN[t], 'x': pos[0], 'y': pos[1], 'opacity': MAIN_A[t], 'split': 'front'})
    if back:
        img.alpha_composite(*back)
    img.alpha_composite(Image.fromarray(pose(char_at(t))), (round(rx) - ROOT[0], GROUND - ROOT[1]))
    if front:
        img.alpha_composite(*front)
    if t in IMP_PLAN:
        a, (ox, oy) = imp_place(t)
        cx = X0 + travel(32)              # the contact point stays where the collision happened
        pos = (round(cx + ox), round(GROUND + oy))
        img.alpha_composite(Image.fromarray(a), pos)
        LOG.append({'T': t, 'track': 'impact', 'frame': IMP_PLAN[t], 'x': pos[0], 'y': pos[1], 'opacity': IMP_A[t], 'split': 'front'})
    if t >= 32:
        LOG.append({'T': t, 'track': 'gameplay', 'frame': 1, 'x': 0, 'y': 0, 'opacity': 1.0 if t <= 34 else 0.45, 'split': '-'})
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
                '-crf', '14', f'{OUT}/yuezheng_s2_preview_60fps.mp4'], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-i', f'{tmp}/f%03d.png', '-vf',
                'fps=50,scale=800:-1:flags=neighbor,split[a][b];[a]palettegen=max_colors=160[p];[b][p]paletteuse=dither=none',
                '-loop', '0', f'{OUT}/yuezheng_s2_preview_50fps.gif'], check=True)
keys = [0, 8, 14, 18, 25, 30, 32, 34, 36, 40, 44, 51]
cw, ch = 400, 200
sheet = Image.new('RGB', (cw * 6, ch * 2))
dr = ImageDraw.Draw(sheet)
for i, t in enumerate(keys):
    sheet.paste(frames[t].resize((cw, ch), Image.NEAREST), ((i % 6) * cw, (i // 6) * ch))
    dr.text(((i % 6) * cw + 6, (i // 6) * ch + 4), f'T{t:03d} C{char_at(t):02d}', fill=(255, 255, 255))
sheet.save(f'{OUT}/yuezheng_s2_preview_contact.png')


# ------------------------------------------------------------------ in-game FX strips (30 FPS, timeline order)
def bake(tiles, name):
    """tiles: [(rgba, (ox, oy) top-left relative to the pivot)] → strip with the pivot at the same point in every tile"""
    l = max(-ox for _, (ox, _) in tiles)
    r = max(a.shape[1] + ox for a, (ox, _) in tiles)
    u = max(-oy for _, (_, oy) in tiles)
    d = max(a.shape[0] + oy for a, (_, oy) in tiles)
    w, h = int(np.ceil(l + r)) + 2, int(np.ceil(u + d)) + 2
    out = Image.new('RGBA', (w * len(tiles), h), (0, 0, 0, 0))
    for i, (a, (ox, oy)) in enumerate(tiles):
        out.alpha_composite(Image.fromarray(a), (i * w + round(l + ox) + 1, round(u + oy) + 1))
    out.save(f'public/sprites/{name}.png', optimize=True)
    return {'frames': len(tiles), 'w': w, 'h': h, 'frameMs': round(2000 / 60, 2), 'pivot': [round((l + 1) / w, 4), round((u + 1) / h, 4)]}


ts = sorted(MAIN_PLAN)[::2]
gm = bake([main_place(t)[:2] for t in ts], 'fx-yuezheng-s2-main')
gm.update({'dx': 0, 'dy': 27.25})   # pivot = the feet: board offset = feet anchor
it = sorted(IMP_PLAN)[::2]
imp_tiles = []
for t in it:
    a, (ox, oy) = imp_place(t)
    imp_tiles.append((a, (ox - CONTACT, oy)))       # pivot = the contact point
gi = bake(imp_tiles, 'fx-yuezheng-s2-impact')
_, fy8 = FRONT[8]
# on the target: the contact side is ~0.35 cell toward Yue Zheng, at the shield's height
gi.update({'dx': -35, 'dy': 27.25})   # pivot = the contact x at feet level (tiles are placed relative to the feet)
game_fx = {'main': gm, 'impact': gi}

# ------------------------------------------------------------------ timeline JSON + sheet meta
pf = []
for t in range(N):
    c = char_at(t)
    fx, fy = FRONT[c]
    rx = X0 + travel(t)
    pf.append({'T': t, 'char': f'C{c:02d}', 'drawnFrame': c, 'root': [round(rx, 1), GROUND],
               'spearTip': [round(rx + fx - ROOT[0], 1), GROUND + fy - ROOT[1]], 'center': [round(rx, 1), GROUND - BODY / 2]})
steps = [round((b - a + 1) * 1000 / 60) for a, b, _ in CHAR]
steps[-1] += round(N * 1000 / 60) - sum(steps)
meta = {
    'name': 'yuezheng_s2_sync_sheet',
    'title': 'Timeline Sync Sheet — Skill 2 Tiger Gate Ram  ·  Yue Zheng · Iron Mountain Bastion',
    'subtitle': '60 FPS · 52 frames (T000–T051) = 0.87 s · 1 column = 1 frame (16.7 ms) · shield charge · collision · stun · interrupt',
    'readme': ['Timeline Sync Sheet — Skill 2 Tiger Gate Ram · Yue Zheng', '',
               '60 FPS, 52 เฟรม (T000–T051) = 0.87 วินาที · ตัวละคร 12 ท่า + Main VFX (12 เฟรม) + Impact VFX (8 เฟรม) + จังหวะเกมเพลย์',
               'Frames = ทุกเฟรม (ตำแหน่ง root X = ระยะพุ่ง) · Character = ท่า C01–C12 + ความยาวในเกม · VFX Tracks / Events / Layers',
               'หน่วย: px = พิกเซลของแผ่นเกม (canvas 400×200, พื้น y = 168) · 80 px = 1 ช่องสนาม ≈ ความสูงตัวละครตอนยืน',
               'ที่มา: tools/sprites/yuezheng_s2.py → yuezheng_s2_timeline.json → tools/sprites/ult_sync_sheet.py'],
    'gameNote': 'Game ms = steps ของท่า skill2 ใน SHEETS hero-yuezheng.png (เท่ากับไทม์ไลน์นี้ รวม 867 ms)',
    'phases': [[0, 7, 'A', 'READY', [120, 130, 150], 'พร้อม'],
               [8, 17, 'B', 'LOAD', [70, 140, 220], 'โหลดแรง'],
               [18, 31, 'C', 'CHARGE', [220, 130, 50], 'พุ่งชน'],
               [32, 37, 'D', 'COLLISION', [215, 70, 70], 'ชน'],
               [38, 43, 'E', 'PUSH THROUGH', [200, 170, 60], 'ดันผ่าน'],
               [44, 51, 'F', 'RECOVERY', [90, 170, 120], 'กลับท่า']],
    'poses': {1: ['F1', 'ท่าการ์ดปกติ', 'CAST_START'], 2: ['F2', 'งอเข่าเล็กน้อย', ''],
              3: ['F3', 'ลดตัวลงหลังโล่', 'CROUCH_START'], 4: ['F4', 'ขาหลังโหลดแรงเต็มที่ โล่ชี้ไปหน้า', 'ANTICIPATION_PEAK'],
              5: ['F5', 'ก้าวระเบิดแรกไปหน้า', 'RUSH_START · MAIN_VFX_SPAWN'], 6: ['F6', 'เร่งโดยมีโล่นำ', ''],
              7: ['F7', 'ท่าพุ่งเต็มที่', 'FULL_SPEED'], 8: ['F8', 'ชนด้วยโล่ เต็มแรง (ค้าง 6 เฟรม)', 'DAMAGE · INTERRUPT · STUN · IMPACT'],
              9: ['F9', 'ดันผ่านหลังชน', 'PUSH_THROUGH'], 10: ['F10', 'ก้าวเบรก', 'RECOVERY_START'],
              11: ['F11', 'ยืดตัวกลับสู่การ์ด', ''], 12: ['F12', 'กลับท่ายืนมั่นคง', 'ANIMATION_END']},
    'gameSteps': steps,
    'hits': [32],
    'events': [[0, 'CAST_START', 'C01 · ท่าการ์ด'],
               [8, 'CROUCH_START', 'C03 · ลดตัวหลังโล่'],
               [14, 'ANTICIPATION_PEAK', 'C04 · ขาหลังโหลดแรง ค้าง 4 เฟรม'],
               [18, 'RUSH_START', 'C05 · เริ่มพุ่ง (root X เริ่มขยับ)'],
               [18, 'MAIN_VFX_SPAWN', 'คลื่นหน้าโล่เกิด เกาะหน้าโล่ตลอดการพุ่ง'],
               [25, 'FULL_SPEED', 'C07 · ความเร็วสูงสุด'],
               [32, 'DAMAGE', '150 % ATK · Break 60 · ในเกม = event DAMAGE step 7'],
               [32, 'INTERRUPT', 'ตัดร่ายเป้าหมาย'],
               [32, 'STUN_APPLY', 'สตัน 0.8 วิ (ถึง T080 หลังท่าจบ) + ผลัก 1 ช่อง'],
               [32, 'IMPACT_VFX_SPAWN', 'ระเบิดชนที่จุดสัมผัสศัตรู'],
               [34, 'IMPACT_PEAK', 'impact f4 (ข้าม f3)'],
               [36, 'CAMERA_SHAKE_PEAK', 'สั่น 8 px'],
               [38, 'PUSH_THROUGH', 'C09 · ดันต่อ +8 px แล้วหยุด'],
               [44, 'RECOVERY_START', 'C10 · เบรก'],
               [51, 'ANIMATION_END', 'C12 · กลับ idle']],
    'tracks': [['main', 'L3 Main VFX  shield wave', [120, 220, 210], 's2_vfx.png 12 fr → fx-yuezheng-s2-main',
                'front of the character (whole wave)', f'front of the crescent on the shield face + {WAVE_LEAD} px, rides with the rush',
                'f1–f7 grow T018–T031 · f8 max at the collision T032–T034 · f9–f12 dissolve to T046'],
               ['impact', 'L4 Impact VFX  collision', [240, 210, 120], 's2_impact.png 8 fr → fx-yuezheng-s2-impact', 'front',
                'enemy-contact point (shield face of C08 at the collision), stays put during the push',
                'f1 T032 · f2 T033 · f4 peak T034–T036 · f5–f8 fade to T048'],
               ['gameplay', 'L6 Gameplay  hit · interrupt · stun', [230, 90, 90], 'engine', '-',
                'primary target', 'T032 damage + interrupt + knockback 1 cell + stun 0.8 s (continues past the clip)']],
    'trackNames': {'main': 'คลื่นหน้าโล่', 'impact': 'ระเบิดชน', 'gameplay': 'ดาเมจ / ตัดร่าย / สตัน'},
    'layers': [[1, 'ตัวละคร (L1)'], [2, 'Root X พุ่งไปหน้า (L2)'], [3, 'Main VFX หน้าตัวละคร (L3)'],
               [4, 'Impact VFX หน้าสุด (L4)'], [5, 'สั่นกล้อง 5–8 px (L5)'], [6, 'จังหวะเกมเพลย์ (L6)']],
    'shake': {str(k): list(v) for k, v in SHAKE.items()},
    'thumbs': [0, 8, 14, 18, 25, 30, 32, 34, 36, 40, 44, 51],
    'thumbCrop': [30 * UP, 62 * UP, 290 * UP, 186 * UP],
    'travelLabel': 'L2 Root X (px, 80 = 1 ช่อง)', 'heightLabel': 'Y movement (px)',
    'notes': [
        'Root X: 0 จนถึง T018 > เร่งเร็ว (ease-in) > 72 px (0.9 ช่อง) ตอนชน T032 > ดันผ่านถึง 80 px T038 แล้วหยุด · Y = 0 (ขยับแค่ตามท่า)',
        f'Main VFX: ขอบหน้าของคลื่นอยู่หน้าโล่ {WAVE_LEAD} px ทุกเฟรม (เลื่อนไปกับตัว) · วาดทับหน้าตัวละครทั้งคลื่น · ขนาด 1.2 เท่าความสูงตัวตอนชน',
        'Impact VFX: เกิดที่จุดสัมผัสศัตรู T032 (หน้าโล่ของท่าชน) และอยู่กับที่ระหว่างดันผ่าน · สูงสุด T034',
        'ในเกม: DAMAGE / INTERRUPT / STUN ที่ step 7 (T032) · สั่น 7 px 130 ms ไม่มี hit-stop · การย้ายช่อง CHARGE ของเอนจินเกิดตอนเริ่มท่า',
        'แผ่น FX ในเกมเรียงตามไทม์ไลน์ 30 FPS · main ยึดเท้า (ไม่รวมระยะพุ่ง) · impact เล่นที่เป้า ฝั่งที่ชน (ถอยมา 0.35 ช่อง)',
    ],
}
json.dump({'fps': FPS, 'frames': N, 'canvas': [W, H], 'upscale': UP, 'ground': GROUND,
           'characterTiming': [{'from': a, 'to': b, 'char': f'C{c:02d}', 'drawnFrame': c} for a, b, c in CHAR],
           'rootTracks': {'travel': [list(k) for k in TRAVEL], 'height': [[0, 0], [51, 0]]},
           'perFrame': pf, 'vfx': LOG, 'sheet': meta, 'gameFx': game_fx},
          open(f'{OUT}/yuezheng_s2_timeline.json', 'w'), indent=1, ensure_ascii=False)
print(json.dumps({'scale': SC, 'front': FRONT, 'contact': CONTACT, 'gameFx': game_fx, 'steps': steps}, indent=1, default=float))
