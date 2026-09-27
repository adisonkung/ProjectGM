"""JADE QUAKE (Brass Shishi) — ground shockwave FX, 6 frames, drawn in code to sit with the user's lion art.

Frame 1–2: jade light gathers under the paws · 3: impact (cracks + burst, the SKILL_ACTIVATE frame) ·
4–6: a flattened jade ring runs out to ~2 cells and fades, rock chips fly and settle.
usage: python3 tools/sprites/fx_jade_quake.py → public/sprites/fx-jade-quake.png (6 × 192×96)
"""
import math
import random

from PIL import Image, ImageDraw, ImageFilter

W, H, N = 192, 96, 6
CX, CY = W // 2, 70  # ground point under the lion's paws
JADE = (63, 210, 154)
JADE_HI = (190, 255, 220)
JADE_DK = (20, 110, 80)
GOLD = (255, 214, 102)
ROCK = (150, 128, 96)


def ellipse(d, cx, cy, rx, ry, **kw):
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], **kw)


def frame(i, rnd):
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    top = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    t = ImageDraw.Draw(top)
    if i < 2:  # gathering
        r = 14 + i * 8
        ellipse(g, CX, CY, r, r * 0.35, fill=JADE + (90 + 50 * i,))
        for k in range(6 + 4 * i):
            a = rnd.uniform(0, 2 * math.pi)
            d = rnd.uniform(r * 0.6, r * 1.6)
            x, y = CX + math.cos(a) * d, CY + math.sin(a) * d * 0.35 - rnd.uniform(0, 10)
            t.rectangle([x, y, x + 1, y + 1], fill=JADE_HI + (230,))
    elif i == 2:  # impact
        ellipse(g, CX, CY, 58, 20, fill=JADE + (190,))
        ellipse(g, CX, CY - 10, 30, 30, fill=JADE_HI + (210,))
        for k in range(8):  # dust puffs
            x = CX + rnd.choice([-1, 1]) * rnd.uniform(30, 56)
            ellipse(g, x, CY - rnd.uniform(2, 8), rnd.uniform(7, 11), rnd.uniform(5, 8), fill=(200, 190, 160, 150))
        for k in range(9):  # ground cracks
            a = math.pi * (k / 8.0) + rnd.uniform(-0.15, 0.15)
            x0, y0 = CX, CY
            for s in range(4):
                x1 = x0 + math.cos(a) * 9 * (1 if k % 2 else -1)
                y1 = y0 + math.sin(a) * 3 * (1 if k < 4 else -1) + rnd.uniform(-1, 1)
                t.line([x0, y0, x1, y1], fill=JADE_DK + (255,), width=2)
                t.line([x0, y0 - 1, x1, y1 - 1], fill=JADE_HI + (255,), width=1)
                x0, y0 = x1, y1
        for k in range(16):  # upward shards
            x = CX + rnd.uniform(-40, 40)
            h = rnd.uniform(14, 40) * (1 - abs(x - CX) / 70)
            t.polygon([(x - 3, CY + 2), (x + 3, CY + 2), (x, CY - h)], fill=JADE + (255,), outline=JADE_DK + (255,))
    else:  # ring running out
        p = (i - 2) / 3.0
        rx, ry = 40 + 52 * p, 14 + 16 * p
        a = int(255 * (1.15 - p))
        ellipse(g, CX, CY, rx, ry, outline=JADE + (min(255, a),), width=11)
        ellipse(g, CX, CY, rx * 0.8, ry * 0.8, fill=JADE + (int(a * 0.25),))
        ellipse(t, CX, CY, rx, ry, outline=JADE_HI + (min(255, a),), width=3)
        ellipse(t, CX, CY, rx - 5, ry - 2, outline=JADE_DK + (min(255, int(a * 0.8)),), width=1)
        for k in range(14):
            ang = rnd.uniform(0, 2 * math.pi)
            x = CX + math.cos(ang) * rx * rnd.uniform(0.7, 1.05)
            y = CY + math.sin(ang) * ry * rnd.uniform(0.7, 1.05) - rnd.uniform(0, 22) * (1 - p)
            c = ROCK if k % 3 else GOLD
            t.rectangle([x, y, x + 2, y + 2], fill=c + (min(255, a + 40),))
    glow = glow.filter(ImageFilter.GaussianBlur(2.2))
    glow.alpha_composite(top)
    return glow


def main():
    rnd = random.Random(7)
    strip = Image.new('RGBA', (W * N, H), (0, 0, 0, 0))
    for i in range(N):
        strip.alpha_composite(frame(i, rnd), (i * W, 0))
    strip.save('public/sprites/fx-jade-quake.png', optimize=True)
    prev = Image.new('RGBA', strip.size, (40, 46, 60, 255))
    prev.alpha_composite(strip)
    prev.resize((strip.width * 2, strip.height * 2), Image.NEAREST).save('/tmp/fx-jade-quake.png')


if __name__ == '__main__':
    main()
