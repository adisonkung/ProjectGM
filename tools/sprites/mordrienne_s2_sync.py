"""Mordrienne Vale — S2 Cinderbind Hex: Timeline Sync preview + sheet (user 2026-10-26).

python3 tools/sprites/mordrienne_s2_sync.py <out dir>
Renders the GAME assets (hero-mordrienne.png row 6 with the in-game steps, fx-mordrienne-s2-{spawn,loop,burst}) at
game scale (1 atlas px = 1 px, 80 px = 1 cell) on a 60 FPS clock: two goblins 3–4 cells ahead, the 2 × 2 hex centred
between them on the ground line → <out>/mordrienne_s2_preview_60fps.mp4 + mordrienne_s2_timeline.json (with the
`sheet` block) → then run: python3 tools/sprites/ult_sync_sheet.py <json> <mp4> <out>
"""
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else 'tmp/mordrienne-s2-sync')
OUT.mkdir(parents=True, exist_ok=True)
FPS, UP = 60, 3
W, H, GROUND = 600, 230, 200
HERO_X, CELLS = 110, 3
TARGET_X = HERO_X + CELLS * 80
HEX_X = TARGET_X + 40                 # square2Center: half a column further, on the feet line
SP = 'public/sprites/'
ATLAS = Image.open(SP + 'hero-mordrienne.png').convert('RGBA')
GOB = Image.open(SP + 'enemy-goblin-fighter.png').convert('RGBA')
BG = Image.open('public/backgrounds/forest-1.webp').convert('RGBA')

# must match sprites.ts hero-mordrienne.png anims.skill2.steps / FX defs
STEPS = [50, *[50] * 7, 100, 50, 50, 50, *[70] * 6, 50, 50, 50, 50, 100, 90, 70, 70, 70, 70, 70, 80]
FX = {  # name: (file, frames, frameMs, fadeMs, pivot y, atlas px per baked px, layer)
    'spawn': ('fx-mordrienne-s2-spawn.png', 9, 27.78, 0, 0.723214, 0.75, 'under'),
    'loop': ('fx-mordrienne-s2-loop.png', 8, 77.5, 0, 0.67354, 0.75, 'under'),
    'burst': ('fx-mordrienne-s2-burst.png', 8, 50, 150, 0.85558, 0.6, 'under'),
}
at = lambda i: sum(STEPS[:i]) / 1000  # noqa: E731
CAST, STRIKE1, SPAWN, SPIN, STRIKE2, HIT, REC, END = at(1), at(7), at(8), at(12), at(22), at(23), at(24), at(30)
START = {'spawn': SPAWN, 'loop': SPIN, 'burst': STRIKE2}
N = int(round((END + 0.15) * FPS))
T = lambda s: int(round(s * FPS))  # noqa: E731


def frames_of(name):
    f, n, _, _, _, k, _ = FX[name]
    img = Image.open(SP + f).convert('RGBA')
    w = img.width // n
    return [img.crop((i * w, 0, i * w + w, img.height)).resize((round(w * k), round(img.height * k)), Image.NEAREST)
            for i in range(n)]


FR = {k: frames_of(k) for k in FX}
_tip = Image.open(SP + 'fx-mordrienne-s2-tip.png').convert('RGBA')
TIP = [_tip.crop((i * 80, 0, i * 80 + 80, _tip.height)).resize((40, _tip.height // 2), Image.NEAREST) for i in range(7)]


def clip_frame(t):
    ms, acc = t * 1000, 0
    for i, s in enumerate(STEPS):
        if ms < acc + s:
            return i
        acc += s
    return None


def put(canvas, im, x, y, alpha=1.0):
    if alpha < 1:
        im = im.copy()
        im.putalpha(im.getchannel('A').point(lambda v: int(v * alpha)))
    canvas.alpha_composite(im, (int(round(x)), int(round(y))))


def fx_pose(name, t):
    _, n, ms, fade, py, _, _ = FX[name]
    dt = (t - START[name]) * 1000
    if dt < 0:
        return None
    i = int(dt // ms)
    if i < n:
        return i, 1.0
    if fade and dt < n * ms + fade:
        return n - 1, 1 - ((dt - n * ms) / fade) ** 2
    return None


def render(t):
    bg = BG.resize((int(BG.width * 340 / BG.height), 340)).crop((180, 100, 180 + W, 100 + H))
    c = bg.copy()
    log = []

    def draw_fx(layer):
        for name in FX:
            if FX[name][6] != layer:
                continue
            pose = fx_pose(name, t)
            if not pose:
                continue
            f = FR[name][pose[0]]
            put(c, f, HEX_X - f.width / 2, GROUND - FX[name][4] * f.height, pose[1])
            log.append((name, pose[0] + 1, round(pose[1], 2)))

    draw_fx('under')
    g = GOB.crop((0, 0, 132, 100)).transpose(Image.FLIP_LEFT_RIGHT)
    for gx in (TARGET_X, TARGET_X + 80):
        put(c, g, gx - 66, GROUND - 86)
    k = clip_frame(t)
    hero = ATLAS.crop((k * 260, 6 * 170, k * 260 + 260, 7 * 170)) if k is not None else ATLAS.crop((0, 0, 260, 170))
    put(c, hero, HERO_X - 130, GROUND - 155)
    draw_fx('over')
    # wand-tip strike flash (self, attached): centre on the strike pose's tip (atlas 181, 101)
    for k0, start in ((0, SPAWN), (1, STRIKE2)):
        dt = (t - start) * 1000
        n = len(TIP)
        if 0 <= dt < n * 35 + 80:
            i = min(n - 1, int(dt // 35))
            a = 1.0 if dt < n * 35 else 1 - ((dt - n * 35) / 80) ** 2
            f = TIP[i]
            put(c, f, HERO_X - 130 + 181 - f.width / 2, GROUND - 155 + 101 - f.height / 2, a)
            log.append(('tip', i + 1, round(a, 2)))
    return c, k, log


def main():
    vid = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s',
                            f'{W * UP}x{H * UP}', '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                            '-crf', '16', str(OUT / 'mordrienne_s2_preview_60fps.mp4')], stdin=subprocess.PIPE)
    per, vfx, chars = [], [], []
    idle = len(STEPS) + 1
    for i in range(N):
        t = i / FPS
        img, k, log = render(t)
        big = img.resize((W * UP, H * UP), Image.NEAREST)
        ImageDraw.Draw(big).text((10, 8), f'T{i:03d}  {t:.3f}s', fill='white')
        vid.stdin.write(big.tobytes())
        cf = (k + 1) if k is not None else idle
        per.append({'T': i, 'char': f'C{cf:02d}', 'drawnFrame': cf, 'root': [HERO_X, GROUND],
                    'spearTip': [HEX_X, GROUND], 'center': [HERO_X, GROUND - 40]})
        chars.append(cf)
        for track, fr, op in log:
            lay = FX[track][6] if track in FX else 'over'
            vfx.append({'T': i, 'track': track, 'frame': fr, 'opacity': op,
                        'layer': 'back' if lay == 'under' else 'front', 'split': lay})
    vid.stdin.close()
    vid.wait()
    runs, a = [], 0
    for i in range(1, N + 1):
        if i == N or chars[i] != chars[a]:
            runs.append((a, i - 1, chars[a]))
            a = i
    desc = {1: ('ท่าพร้อม', 'T000 idle'), 2: ('เริ่มท่า', 'CAST_START 0.05'), 8: ('ง้างไม้', 'STRIKE_START #1'),
            9: ('ตีครั้งที่ 1 (F13)', 'VFX_SPAWN #0 · GroundHexSpawn ใต้พื้นที่เป้า'), 10: ('ค้างท่าตี', ''),
            13: ('ควงไม้ที่อก', 'CHARGE_START · GroundHexLoop (ชาร์จ ไม่มีดาเมจ)'), 19: ('ยกไม้', ''),
            22: ('ง้างตีครั้งที่ 2', 'STRIKE_START #2'),
            23: ('ตีครั้งที่ 2 (F32)', 'VFX_SPAWN #1 · Loop หยุด · HexActivationBurst'),
            24: ('ค้าง = burst peak', 'DAMAGE · Slow · ATK/Cast down · Root ถ้ามี Hex Mark'),
            25: ('กลับท่า', 'RECOVERY_START'), 30: ('กลับท่ายืน', 'ท่าจบ'), idle: ('idle', 'ต่อ idle')}
    poses = {str(c): [f'S2 clip {c - 1}' if c < idle else 'idle', *desc.get(c, ('', ''))] for c in range(1, idle + 1)}
    ev = [[0, 'IDLE', 'C01'], [T(CAST), 'CAST_START', 'C02 เริ่มท่า'], [T(STRIKE1), 'STRIKE_START #1', 'C08'],
          [T(SPAWN), 'STRIKE 1 · HEX SPAWN', 'C09 · วงเฮ็กซ์เกิดบนพื้น (ไม่ติดตัว)'],
          [T(SPIN), 'CHARGE_START · HEX LOOP', 'C13 ควงไม้ · วงชาร์จ'],
          [T(at(21)), 'STRIKE_START #2', 'C22'],
          [T(STRIKE2), 'STRIKE 2 · ACTIVATION', 'C23 · loop หยุดทันที · burst เกิด'],
          [T(HIT), 'DAMAGE (magic AoE)', 'burst peak f3'], [T(HIT), 'SLOW · ATK/CAST DOWN · ROOT*', '*เฉพาะเป้าที่ติด Hex Mark'],
          [T(REC), 'RECOVERY_START', 'C25'], [T(END), 'IDLE', f'clip end {END:.2f}s']]
    burst_end = STRIKE2 + (8 * 50 + 150) / 1000
    meta = {
        'name': 'mordrienne_s2_sync_sheet',
        'readme': ['Timeline Sync Sheet — Skill 2 Cinderbind Hex · Mordrienne Vale', '',
                   f'60 FPS · {N} frames · clip {END:.2f} s · strike 1 {SPAWN:.2f} s · strike 2 {STRIKE2:.2f} s · hit {HIT:.2f} s',
                   'หน่วย: px = พิกเซลแผ่นเกม · 80 px = 1 ช่อง', 'ที่มา: tools/sprites/mordrienne_s2_sync.py > ult_sync_sheet.py'],
        'gameNote': 'Game ms = steps ของท่า skill2 ใน SHEETS hero-mordrienne.png · VFX วางบนพื้นกลางพื้นที่ 2 × 2 (SQUARE_2) จุดเดียวกันทั้ง 3 ชั้น',
        'title': 'Timeline Sync Sheet — Skill 2 Cinderbind Hex  ·  Mordrienne Vale',
        'subtitle': f'60 FPS · 1 column = 1 frame (16.7 ms) · spawn T{T(SPAWN):03d} · loop T{T(SPIN):03d} · '
                    f'activation T{T(STRIKE2):03d} · hit T{T(HIT):03d} · Deep Emerald Curse + Black Ash + Broken Hex',
        'phases': [[0, T(CAST) - 1, 'A', 'IDLE', [120, 130, 150], 'ยืน'],
                   [T(CAST), T(SPAWN) - 1, 'B', 'WIND-UP', [80, 150, 120], 'ยกไม้ง้าง'],
                   [T(SPAWN), T(SPIN) - 1, 'C', 'STRIKE 1 · HEX SPAWN', [60, 190, 110], 'ตีพื้น = วางวงเฮ็กซ์'],
                   [T(SPIN), T(STRIKE2) - 1, 'D', 'SPIN · HEX LOOP', [40, 160, 100], 'ควงไม้ = ชาร์จวง (ไม่มีดาเมจ)'],
                   [T(STRIKE2), T(REC) - 1, 'E', 'STRIKE 2 · ACTIVATION + HIT', [30, 220, 130], 'ระเบิดวง + ดาเมจ/ดีบัฟ'],
                   [T(REC), N - 1, 'F', 'RECOVERY → IDLE', [110, 120, 130], 'burst จางจนหมด · กลับท่ายืน']],
        'poses': poses,
        'gameSteps': STEPS,
        'hits': [T(HIT)],
        'events': ev,
        'lanes': 4,
        'tracks': [['spawn', 'L2 GroundHexSpawn', [70, 200, 120], 'fx-mordrienne-s2-spawn (9 × 27.8 ms)', 'under',
                    'กลางพื้นที่ 2 × 2 บนพื้น', f'T{T(SPAWN):03d} วงเล็ก → วงเต็ม f7 → T{T(SPIN) - 1:03d} จบพอดีตอนควง'],
                   ['loop', 'L3 GroundHexLoop', [40, 170, 100], 'fx-mordrienne-s2-loop (8 × 77.5 ms)', 'under',
                    'จุดเดียวกัน', f'T{T(SPIN):03d} → T{T(STRIKE2) - 1:03d} หนึ่งรอบหายใจ · หยุดทันทีที่ตีครั้งที่ 2'],
                   ['burst', 'L4 HexActivationBurst', [40, 230, 140], 'fx-mordrienne-s2-burst (8 × 50 ms + fade 150)', 'over',
                    'จุดเดียวกัน', f'T{T(STRIKE2):03d} ปะทุ → peak f3 T{T(HIT):03d} = ดาเมจ → สลาย f8 → หมด T{T(burst_end):03d}'],
                   ['tip', 'L5 Wand-tip Flash', [120, 255, 170], 'fx-mordrienne-s2-tip (7 × 35 ms + fade 80)', 'over',
                    'ปลายคทาท่าตี', f'แสงเขียวที่ปลายคทาตอนตีทั้ง 2 ครั้ง T{T(SPAWN):03d} / T{T(STRIKE2):03d}'],
                   ['events', 'L6 Gameplay Events', [200, 200, 200], 'engine', '-', '-',
                    'DAMAGE ครั้งเดียวที่ burst peak · ไม่มี impact VFX ซ้ำ']],
        'trackNames': {'spawn': 'Hex Spawn', 'loop': 'Hex Loop', 'burst': 'Activation Burst', 'tip': 'Wand Flash', 'events': 'อีเวนต์'},
        'layers': [[1, 'Hex Spawn / Loop (ใต้ตัวละคร)'], [2, 'ตัวละคร (L1)'], [3, 'Activation Burst (L4)'], [4, 'Wand-tip Flash (L5)'], [5, 'อีเวนต์ (L6)']],
        'shake': {},
        'thumbs': [0, T(at(5)), T(SPAWN) + 3, T(SPAWN) + 13, T(SPIN) + 12, T(at(20)), T(STRIKE2), T(HIT), T(HIT) + 9,
                   T(REC) + 12, T(END)],
        'thumbLabels': {0: 'IDLE', T(at(5)): 'WIND-UP', T(SPAWN) + 3: 'STRIKE 1', T(SPAWN) + 13: 'HEX SPAWN',
                        T(SPIN) + 12: 'SPIN · LOOP', T(at(20)): 'RAISE', T(STRIKE2): 'STRIKE 2', T(HIT): 'HIT (peak)',
                        T(HIT) + 9: 'DECAY', T(REC) + 12: 'RECOVERY', T(END): 'IDLE'},
        'thumbCrop': [40 * UP, 10 * UP, 560 * UP, 220 * UP],
        'travelLabel': 'L1 Root X (px) — 0 (ยืนที่เดิม)', 'heightLabel': 'Root Y (px) — 0',
        'notes': ['ไม่ได้วาดตัวละคร/VFX ใหม่ — จัดจังหวะ ตำแหน่งบนพื้น ลูป การปลดวง ดาเมจ/ดีบัฟ และการกลับท่าเท่านั้น',
                  'ตีครั้งแรก = วางวงเฮ็กซ์บนพื้นกลางพื้นที่ 2 × 2 รอบเป้า (ไม่ติดตัว Mordrienne, ไม่ตามเป้า)',
                  'ควงไม้ = วงชาร์จอยู่ที่เดิม ไม่มีดาเมจหลัก · ตีครั้งที่ 2 = หยุดลูปทันที + ระเบิดวงที่จุดเดียวกัน',
                  'ดาเมจเวทครั้งเดียวที่ peak ของ burst: AoE + Slow + ATK Down + Cast Speed Down · Root เฉพาะตัวที่ติด Hex Mark อยู่ก่อน',
                  'ทั้ง 3 ชั้นใช้ศูนย์กลาง/เส้นผ่านศูนย์กลางวงเดียวกัน (~150 px = 1.9 ช่อง) · burst เล่นจนสลายครบ ไม่มี impact VFX ที่สอง',
                  'แสงเขียวที่ปลายคทาตอนตีทั้ง 2 ครั้ง = ซิกิลเขียวมรกตของ S1 CastCharge (สีเดียวกับสกิล) ติดตัว Mordrienne',
                  'pixel art: ใช้พิกเซลของศิลปินตรง ๆ ไม่ย่อ/ขยายตอนอบ · วาด pixelated (nearest) ไม่มี blur/AA']}
    json.dump({'fps': FPS, 'frames': N, 'canvas': [W, H], 'upscale': UP, 'ground': GROUND,
               'characterTiming': [{'from': a, 'to': b, 'char': f'C{c:02d}', 'drawnFrame': c} for a, b, c in runs],
               'rootTracks': {'travel': [[0, 0], [N - 1, 0]], 'height': [[0, 0], [N - 1, 0]]},
               'perFrame': per, 'vfx': vfx, 'sheet': meta},
              open(OUT / 'mordrienne_s2_timeline.json', 'w'), indent=1, ensure_ascii=False)
    print({k: round(v, 3) for k, v in dict(cast=CAST, spawn=SPAWN, spin=SPIN, strike2=STRIKE2, hit=HIT, rec=REC, end=END).items()},
          {'T': [T(SPAWN), T(SPIN), T(STRIKE2), T(HIT), T(REC), T(END)], 'N': N})


if __name__ == '__main__':
    main()
