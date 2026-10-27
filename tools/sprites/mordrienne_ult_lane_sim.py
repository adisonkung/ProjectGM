"""Mordrienne Vale — Ult House of Ashes on the board (user 2026-10-27: "what does it look like with the foe on the top lane").

python3 tools/sprites/mordrienne_ult_lane_sim.py <out dir> [top|mid|bottom]
Board geometry as the game draws it: 80 px = 1 cell, 5 rows (2 scenery + 3 lanes), feet at 96 % of the cell, the board
clips everything above its top edge (`.board { overflow: hidden }`). The picture shows HEADROOM px above the board in grey
so the part the board cuts off is visible. Mordrienne stands in the middle lane, the target 3 cells ahead in the chosen
lane; FX timing = the game's (sprites.ts steps / frameMs). → <out>/mordrienne_ult_<lane>_lane_60fps.mp4 + _stills.png
"""
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).parent))
from mordrienne_ult_vfx import STEPS  # noqa: E402

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else 'tmp/mordrienne-ult-lane')
LANE = sys.argv[2] if len(sys.argv) > 2 else 'top'
OUT.mkdir(parents=True, exist_ok=True)
FPS, UP, CELL, COLS, ROWS, HEADROOM = 60, 2, 80, 9, 5, 90
W, BOARD_H = COLS * CELL, ROWS * CELL
H = HEADROOM + BOARD_H
SP = 'public/sprites/'
RES = 2
FK = 0.914286 * 1.5
PIV, AURA_PIV = 0.627219, 0.851449
at = lambda i: sum(STEPS[:i]) / 1000  # noqa: E731
CAST, CHARGE, ACT, HIT, END = at(1), at(15), at(26), at(29), at(31)
FIELD_LOOP = HIT + 0.25
N = int(round((HIT + 2.2) * FPS))


def feet(row):            # board row (0, 1 = scenery · 2 / 3 / 4 = lanes) → canvas y of the feet
    return HEADROOM + (row + 0.96) * CELL


def strip(name, n, k):
    img = Image.open(SP + name).convert('RGBA')
    w = img.width // n
    return [img.crop((i * w, 0, i * w + w, img.height)).resize((round(w * k), round(img.height * k)), Image.NEAREST)
            for i in range(n)]


ATLAS = Image.open(SP + 'hero-mordrienne.png').convert('RGBA')
GOB = Image.open(SP + 'enemy-goblin-fighter.png').convert('RGBA').crop((0, 0, 132, 100)).transpose(Image.FLIP_LEFT_RIGHT)
AURA = strip('fx-mordrienne-ult-aura.png', 49, 1 / RES)
CIRC = strip('fx-mordrienne-ult-circle.png', 10, 1 / RES)
CHG = strip('fx-mordrienne-ult-charge.png', 40, 1 / RES)
BURST = strip('fx-mordrienne-ult-burst.png', 10, FK)
FIELD = strip('fx-mordrienne-ult-field.png', 10, FK)
bg = Image.open('public/backgrounds/forest-1.webp').convert('RGBA')
BG = bg.resize((int(bg.width * BOARD_H / bg.height * 1.19), int(BOARD_H * 1.19)))
BG = BG.crop((0, BG.height - BOARD_H, W, BG.height))

HERO_ROW, HERO_COL = 3, 1
T_ROW = {'top': 2, 'mid': 3, 'bottom': 4}[LANE]
T_COL = HERO_COL + 3
HX, HY = (HERO_COL + 0.5) * CELL, feet(HERO_ROW)
FX_X, FY = (T_COL + 0.5) * CELL, feet(T_ROW)


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
    c = Image.new('RGBA', (W, H), (34, 34, 40, 255))
    c.alpha_composite(BG, (0, HEADROOM))
    d = ImageDraw.Draw(c)
    for r in (2, 3, 4):
        d.line([(0, HEADROOM + r * CELL), (W, HEADROOM + r * CELL)], fill=(255, 255, 255, 40))
    # ground FX (under every unit): burst, then the field loop
    if 0 <= t - ACT < 0.5:
        f = BURST[int((t - ACT) / 0.05)]
        put(c, f, FX_X - f.width / 2, FY - PIV * f.height)
    if t >= FIELD_LOOP:
        f = FIELD[int((t - FIELD_LOOP) / 0.09583) % 10]
        put(c, f, FX_X - f.width / 2, FY - PIV * f.height)
    dt = t - CAST
    if 0 <= dt < 49 * 0.05 + 0.08:
        f = AURA[min(48, int(dt / 0.05))]
        put(c, f, HX - f.width / 2, HY - AURA_PIV * f.height, 1.0 if dt < 2.45 else 1 - ((dt - 2.45) / 0.08) ** 2)
    units = [(T_ROW, 'gob', T_COL), (T_ROW, 'gob', T_COL + 1), (HERO_ROW, 'hero', HERO_COL)]
    for row, kind, col in sorted(units):
        if kind == 'gob':
            put(c, GOB, (col + 0.5) * CELL - 66, feet(row) - 86)
        else:
            k = clip_frame(t)
            hero = ATLAS.crop((k * 260, 7 * 170, k * 260 + 260, 8 * 170)) if k is not None else ATLAS.crop((0, 0, 260, 170))
            put(c, hero, HX - 130, HY - 155)
    if 0 <= dt < 1.1:
        f = CIRC[min(9, int(dt / 0.098))]
        put(c, f, HX - 130 + 171 - f.width / 2, HY - 155 + 107 - f.height / 2, 1.0 if dt < 0.98 else 1 - ((dt - 0.98) / 0.12) ** 2)
    if 0 <= t - CHARGE < 1.2:
        f = CHG[int((t - CHARGE) / 0.03)]
        put(c, f, HX - 130 + 136 - f.width / 2, HY - 155 + 48 - f.height / 2)
    # what the board cuts: everything above its top edge, greyed out
    head = c.crop((0, 0, W, HEADROOM)).convert('L').convert('RGBA')
    head.putalpha(110)
    shade = Image.new('RGBA', (W, HEADROOM), (34, 34, 40, 255))
    shade.alpha_composite(head)
    c.paste(shade, (0, 0))
    d = ImageDraw.Draw(c)
    for x in range(0, W, 16):
        d.line([(x, HEADROOM), (x + 8, HEADROOM)], fill=(255, 80, 80, 255), width=2)
    d.text((6, HEADROOM - 14), 'board top edge - above this line is cut off in game', fill=(255, 120, 120, 255))
    return c


def main():
    name = f'mordrienne_ult_{LANE}_lane'
    vid = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s',
                            f'{W * UP}x{H * UP}', '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                            '-crf', '16', str(OUT / f'{name}_60fps.mp4')], stdin=subprocess.PIPE)
    keep = {round(ACT * FPS) + 6: 'burst', round(HIT * FPS): 'burst peak = damage', round(FIELD_LOOP * FPS) + 20: 'field loop',
            round(FIELD_LOOP * FPS) + 26: 'field loop (skull)'}
    stills = []
    for i in range(N):
        t = i / FPS
        img = render(t)
        big = img.resize((W * UP, H * UP), Image.NEAREST)
        ImageDraw.Draw(big).text((10, H * UP - 20), f'{LANE} lane  T{i:03d}  {t:.3f}s', fill='white')
        vid.stdin.write(big.tobytes())
        if i in keep:
            stills.append((img, keep[i]))
    vid.stdin.close()
    vid.wait()
    sheet = Image.new('RGBA', (W * 2, H * 2), (0, 0, 0, 255))
    for j, (img, lab) in enumerate(stills[:4]):
        im = img.copy()
        ImageDraw.Draw(im).text((8, H - 18), lab, fill='white')
        sheet.paste(im, ((j % 2) * W, (j // 2) * H))
    sheet.save(OUT / f'{name}_stills.png')
    print(OUT / f'{name}_60fps.mp4')


if __name__ == '__main__':
    main()
