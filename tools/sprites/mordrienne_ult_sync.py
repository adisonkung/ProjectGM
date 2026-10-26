"""Mordrienne Vale — Ult House of Ashes: Timeline Sync preview + sheet (user 2026-10-27).

python3 tools/sprites/mordrienne_ult_sync.py <out dir>
Renders the GAME assets (hero-mordrienne.png row 7 with the in-game steps, fx-mordrienne-ult-*) at game scale
(1 atlas px = 1 px, 80 px = 1 cell) on a 60 FPS clock: goblins on the 3 × 3 field 3 cells ahead → the field opens at
the burst peak and keeps looping after she is back to idle → <out>/mordrienne_ult_preview_60fps.mp4 +
mordrienne_ult_timeline.json (with the `sheet` block) → then: python3 tools/sprites/ult_sync_sheet.py <json> <mp4> <out>
"""
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).parent))
from mordrienne_ult_vfx import STEPS  # noqa: E402

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else 'tmp/mordrienne-ult-sync')
OUT.mkdir(parents=True, exist_ok=True)
FPS, UP = 60, 3
W, H, GROUND = 640, 300, 250
HERO_X, CELLS = 110, 3
FIELD_X = HERO_X + CELLS * 80
SP = 'public/sprites/'
ATLAS = Image.open(SP + 'hero-mordrienne.png').convert('RGBA')
GOB = Image.open(SP + 'enemy-goblin-fighter.png').convert('RGBA')
BG = Image.open('public/backgrounds/forest-1.webp').convert('RGBA')
RES = 2
FK = 0.761905 * 1.5   # field atlas px per baked px

at = lambda i: sum(STEPS[:i]) / 1000  # noqa: E731
CAST, CHARGE, PEAK, RELEASE, ACT, REC, HIT, END = at(1), at(15), at(19), at(22), at(26), at(27), at(29), at(31)
FIELD_LOOP = HIT + 0.25
N = int(round((END + 1.0) * FPS))
T = lambda s: int(round(s * FPS))  # noqa: E731


def strip(name, n, k):
    img = Image.open(SP + name).convert('RGBA')
    w = img.width // n
    return [img.crop((i * w, 0, i * w + w, img.height)).resize((round(w * k), round(img.height * k)), Image.NEAREST)
            for i in range(n)]


CIRC = strip('fx-mordrienne-ult-circle.png', 10, 1 / RES)
CHG = strip('fx-mordrienne-ult-charge.png', 30, 1 / RES)
BURST = strip('fx-mordrienne-ult-burst.png', 10, FK)
FIELD = strip('fx-mordrienne-ult-field.png', 10, FK)
PIV = 0.681818


def clip_frame(t):
    ms, acc = t * 1000, 0
    for i, s in enumerate(STEPS):
        if ms < acc + s:
            return i
        acc += s
    return None


def put(c, im, x, y, a=1.0):
    if a < 1:
        im = im.copy()
        im.putalpha(im.getchannel('A').point(lambda v: int(v * a)))
    c.alpha_composite(im, (int(round(x)), int(round(y))))


def render(t):
    bg = BG.resize((int(BG.width * 380 / BG.height), 380)).crop((160, 70, 160 + W, 70 + H))
    c = bg.copy()
    log = []
    # ground layer: burst then the field loop, both centred on the field cell
    dt = t - ACT
    if 0 <= dt < 0.5:
        i = int(dt / 0.05)
        f = BURST[i]
        put(c, f, FIELD_X - f.width / 2, GROUND - PIV * f.height)
        log.append(('burst', i + 1, 1.0))
    if t >= FIELD_LOOP:
        i = int((t - FIELD_LOOP) / 0.09583) % 10
        f = FIELD[i]
        put(c, f, FIELD_X - f.width / 2, GROUND - PIV * f.height)
        log.append(('field', i + 1, 1.0))
    g = GOB.crop((0, 0, 132, 100)).transpose(Image.FLIP_LEFT_RIGHT)
    for gx in (FIELD_X, FIELD_X + 80):
        put(c, g, gx - 66, GROUND - 86)
    k = clip_frame(t)
    hero = ATLAS.crop((k * 260, 7 * 170, k * 260 + 260, 8 * 170)) if k is not None else ATLAS.crop((0, 0, 260, 170))
    put(c, hero, HERO_X - 130, GROUND - 155)
    # magic circle at the drawn circle (atlas 166, 107), 98 ms keys + 120 ms fade
    dt = t - CAST
    if 0 <= dt < 0.98 + 0.12:
        i = min(9, int(dt / 0.098))
        a = 1.0 if dt < 0.98 else 1 - ((dt - 0.98) / 0.12) ** 2
        f = CIRC[i]
        put(c, f, HERO_X - 130 + 166 - f.width / 2, GROUND - 155 + 107 - f.height / 2, a)
        log.append(('circle', i + 1, round(a, 2)))
    # charge at the raised wand tip (atlas 136, 48), 30 ms keys
    dt = t - CHARGE
    if 0 <= dt < 0.9:
        i = int(dt / 0.03)
        f = CHG[i]
        put(c, f, HERO_X - 130 + 136 - f.width / 2, GROUND - 155 + 48 - f.height / 2)
        log.append(('charge', i + 1, 1.0))
    return c, k, log


def main():
    vid = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s',
                            f'{W * UP}x{H * UP}', '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                            '-crf', '16', str(OUT / 'mordrienne_ult_preview_60fps.mp4')], stdin=subprocess.PIPE)
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
                    'spearTip': [FIELD_X, GROUND], 'center': [HERO_X, GROUND - 40]})
        chars.append(cf)
        for track, fr, op in log:
            under = track in ('burst', 'field')
            vfx.append({'T': i, 'track': track, 'frame': fr, 'opacity': op, 'layer': 'back' if under else 'front',
                        'split': 'under' if under else 'over'})
    vid.stdin.close()
    vid.wait()
    runs, a = [], 0
    for i in range(1, N + 1):
        if i == N or chars[i] != chars[a]:
            runs.append((a, i - 1, chars[a]))
            a = i
    desc = {1: ('ท่าพร้อม', 'T000 idle'), 2: ('เริ่มวาดวงเวท', 'CAST_START · MagicCircleDraw'),
            9: ('วาดวง', 'วงเวทก่อตัว'), 15: ('วาดวงเสร็จ', 'ซิกิลงู-กะโหลกเต็มวง'),
            16: ('ยกคทาขึ้น', 'CHARGE_START · ChargeHold · วงเวทจาง'), 19: ('ค้างชาร์จ 0.45 วิ', 'พลังหมุนเข้าจุดกลาง'),
            20: ('คทาข้ามหัว', 'CHARGE_PEAK'), 23: ('ฟาดคทาลง', 'STRIKE_START · charge ยุบ'),
            27: ('คทาถึงพื้น', 'VFX_SPAWN · FieldActivationBurst ที่สนามเป้า'), 28: ('กลับท่า', 'RECOVERY_START'),
            30: ('กลับท่า', 'DAMAGE = burst peak · สนามเปิด'), 31: ('กลับท่ายืน', 'ท่าจบ'), idle: ('idle', 'สนามยังอยู่ต่อเอง')}
    poses = {str(c): [f'Ult clip {c - 1}' if c < idle else 'idle', *desc.get(c, ('', ''))] for c in range(1, idle + 1)}
    ev = [[0, 'IDLE', 'C01'], [T(CAST), 'CAST_START · CIRCLE', 'C02 วาดวงเวท'],
          [T(CHARGE), 'CHARGE_START · CHARGE HOLD', 'C16 ยกคทา'], [T(at(18)), 'HOLD', 'ค้าง 0.45 วิ'],
          [T(PEAK), 'CHARGE_PEAK', 'คทาข้ามหัว'], [T(RELEASE), 'RELEASE · WAND DOWN', 'charge ยุบ 90 ms'],
          [T(ACT), 'ACTIVATION · BURST', 'C27 คทาถึงพื้น'], [T(REC), 'RECOVERY_START', 'C28'],
          [T(HIT), 'DAMAGE (opening pulse)', 'burst peak f6 · FIELD_STARTED'],
          [T(HIT), 'HEX MARK BURST · ASH CURSE', 'ตัวที่ติด Hex โดนเพิ่ม · DEF/ATK/Cast ลด'],
          [T(FIELD_LOOP), 'FIELD LOOP', 'burst → loop (ภาพเดียวกัน)'], [T(END), 'IDLE', f'ท่าจบ {END:.2f}s'],
          [T(HIT + 1), 'PULSE 1', 'ทุก 1 วิ (0…5)']]
    meta = {
        'name': 'mordrienne_ult_sync_sheet',
        'readme': ['Timeline Sync Sheet — Ultimate House of Ashes · Mordrienne Vale', '',
                   f'60 FPS · {N} frames · clip {END:.2f} s · activation {ACT:.2f} s · field opens {HIT:.2f} s (6 s)',
                   'หน่วย: px = พิกเซลแผ่นเกม · 80 px = 1 ช่อง', 'ที่มา: tools/sprites/mordrienne_ult_sync.py > ult_sync_sheet.py'],
        'gameNote': 'Game ms = steps ของท่า ult ใน SHEETS hero-mordrienne.png · สนาม = FIELD ของเอนจิน (pulseOnStart: '
                    'ดาเมจ + ดีบัฟครั้งแรกตอนเปิด แล้วทุก 1 วิ รวม 6 ครั้ง) · ภาพลูป/จางท้ายผูกกับสนาม (fieldFx)',
        'title': 'Timeline Sync Sheet — Ultimate House of Ashes  ·  Mordrienne Vale',
        'subtitle': f'60 FPS · 1 column = 1 frame (16.7 ms) · circle T{T(CAST):03d} · charge T{T(CHARGE):03d} · '
                    f'activation T{T(ACT):03d} · field T{T(HIT):03d} · Deep Emerald Curse + Black Ash + Broken Hex',
        'phases': [[0, T(CAST) - 1, 'A', 'IDLE', [120, 130, 150], 'ยืน'],
                   [T(CAST), T(CHARGE) - 1, 'B', 'DRAW MAGIC CIRCLE', [60, 170, 110], 'วาดวงเวท'],
                   [T(CHARGE), T(PEAK) - 1, 'C', 'RAISE + CHARGE HOLD', [40, 150, 100], 'ยกคทา + ค้างชาร์จ'],
                   [T(PEAK), T(ACT) - 1, 'D', 'PEAK → WAND DOWN', [70, 200, 130], 'ข้ามหัว → ฟาดลง'],
                   [T(ACT), T(FIELD_LOOP) - 1, 'E', 'FIELD ACTIVATION', [30, 220, 130], 'ระเบิดสนาม + ดาเมจ/ดีบัฟ'],
                   [T(FIELD_LOOP), N - 1, 'F', 'HOUSE OF ASHES LOOP', [50, 140, 90], 'สนามค้าง 6 วิ · ตัวละครสู้ต่อ']],
        'poses': poses,
        'gameSteps': STEPS,
        'hits': [T(HIT), T(HIT + 1)],
        'events': ev,
        'lanes': 4,
        'tracks': [['circle', 'L2 MagicCircleDraw', [80, 210, 140], 'fx-mordrienne-ult-circle (10 × 98 ms + fade 120)', 'over',
                    'วงที่คทาวาด (atlas 166,107)', f'T{T(CAST):03d} ก่อตัว → ซิกิลเต็ม → จางตอนยกคทา'],
                   ['charge', 'L3 ChargeHold', [40, 200, 120], 'fx-mordrienne-ult-charge (30 × 30 ms)', 'over',
                    'ปลายคทาท่ายก (atlas 136,48)', f'T{T(CHARGE):03d} หมุนเข้า → peak ค้าง → ยุบ T{T(RELEASE):03d}'],
                   ['burst', 'L4 FieldActivationBurst', [40, 235, 140], 'fx-mordrienne-ult-burst (10 × 50 ms)', 'under',
                    'กลางสนาม 3 × 3 บนพื้น', f'T{T(ACT):03d} เปิด → peak f6 T{T(HIT):03d} = ดาเมจ → คลายเป็นลูป'],
                   ['field', 'L5 HouseOfAshes Loop', [30, 160, 90], 'fx-mordrienne-ult-field (10 × 95.8 ms, 6 รอบ)', 'under',
                    'จุดเดียวกัน', 'ลูปจนสนามหมด (6 วิ) แล้วจางด้วย field-end'],
                   ['events', 'L6 Gameplay Events', [200, 200, 200], 'engine', '-', '-',
                    'ดาเมจเปิดสนาม + Hex Mark burst + ดีบัฟ · pulse ทุก 1 วิ']],
        'trackNames': {'circle': 'Magic Circle', 'charge': 'Charge Hold', 'burst': 'Activation Burst',
                       'field': 'Field Loop', 'events': 'อีเวนต์'},
        'layers': [[1, 'Burst / Field (ใต้ตัวละคร)'], [2, 'ตัวละคร (L1)'], [3, 'Circle / Charge (หน้าตัว)'], [4, 'อีเวนต์']],
        'shake': {},
        'thumbs': [0, T(0.5), T(0.95), T(1.15), T(1.6), T(1.75), T(1.9), T(ACT), T(HIT), T(FIELD_LOOP) + 4, T(END) + 10, N - 1],
        'thumbLabels': {0: 'IDLE', T(0.5): 'DRAW', T(0.95): 'CIRCLE FULL', T(1.15): 'RAISE', T(1.6): 'CHARGE HOLD',
                        T(1.75): 'PEAK', T(1.9): 'WAND DOWN', T(ACT): 'ACTIVATION', T(HIT): 'HIT (peak)',
                        T(FIELD_LOOP) + 4: 'FIELD LOOP', T(END) + 10: 'BACK TO IDLE', N - 1: 'FIELD STAYS'},
        'thumbCrop': [30 * UP, 0, 620 * UP, 290 * UP],
        'travelLabel': 'L1 Root X (px) — 0 (ยืนที่เดิม)', 'heightLabel': 'Root Y (px) — 0',
        'notes': ['ไม่ได้วาดตัวละคร/VFX ใหม่ — จัดจังหวะ วงเวท ชาร์จ การเปิดสนาม ดาเมจ ลูป ดีบัฟ และการกลับท่าเท่านั้น',
                  'วงเวทอยู่ตรงวงที่คทาวาด ไม่ใช่สนามบนพื้น · จางตอนยกคทา · ChargeHold เล็ก รวมศูนย์ที่ปลายคทา ไม่มีงูยักษ์',
                  'ค้างท่าชูคทา 0.45 วิ ให้เห็นการชาร์จ · peak ตอนคทาข้ามหัว · ยุบใน 90 ms ตอนคทาฟาดลง',
                  'คทาถึงพื้น = ระเบิดเปิดสนามที่กลางพื้นที่เป้า · peak f6 = ดาเมจแรก + Hex Mark burst + DEF/ATK/Cast ลด',
                  'burst กับลูปใช้ผืนภาพ จุดกลาง และขนาดเดียวกัน — เฟรมท้ายของ burst = หน้าตาเฟรมแรกของลูป',
                  'สนามอยู่ 6 วิ ดาเมจ + ดีบัฟทุก 1 วิ (รวมครั้งเปิด = 6 ครั้ง เท่าเดิม) · ตัวละครกลับไปสู้ปกติทันที',
                  'หมดเวลา: ลูปจบที่เฟรมไม่มีหัวกะโหลกพอดี แล้วจางด้วย field-end (รูนหรี่ ควันบางลง) ไม่ตัดทิ้งทันที',
                  'pixel art: วงเวท/ชาร์จอบที่ 2 × atlas · burst/ลูปใช้พิกเซลศิลปินตรง ๆ · วาด pixelated ไม่มี blur/AA']}
    json.dump({'fps': FPS, 'frames': N, 'canvas': [W, H], 'upscale': UP, 'ground': GROUND,
               'characterTiming': [{'from': a, 'to': b, 'char': f'C{c:02d}', 'drawnFrame': c} for a, b, c in runs],
               'rootTracks': {'travel': [[0, 0], [N - 1, 0]], 'height': [[0, 0], [N - 1, 0]]},
               'perFrame': per, 'vfx': vfx, 'sheet': meta},
              open(OUT / 'mordrienne_ult_timeline.json', 'w'), indent=1, ensure_ascii=False)
    print({'T': {'cast': T(CAST), 'charge': T(CHARGE), 'peak': T(PEAK), 'release': T(RELEASE), 'act': T(ACT),
                 'hit': T(HIT), 'loop': T(FIELD_LOOP), 'end': T(END)}, 'N': N})


if __name__ == '__main__':
    main()
