"""Procedural 8-frame FX for Alpha Howl (fx-alpha-howl.png, 128x96 per frame).
Frame 5 (index 4) is the activation burst — it must line up with SKILL_ACTIVATE (see castTimeline()).
python3 tools/sprites/fx_alpha_howl.py"""
from PIL import Image, ImageDraw, ImageFilter
import math

W, H, N = 128, 96, 8
sheet = Image.new('RGBA', (W * N, H), (0, 0, 0, 0))
cx, cy = 64, 52
for i in range(N):
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    # build-up (0..3) → burst (4) → fading rings (5..7)
    if i < 4:
        k = (i + 1) / 4
        r = 10 + 8 * k
        d.ellipse([cx - r, cy - r * 0.8, cx + r, cy + r * 0.8], fill=(255, 120, 60, int(70 * k)))
        for j in range(3):
            a = 2 * math.pi * (j / 3 + i * 0.08)
            px, py = cx + math.cos(a) * (26 - 14 * k), cy + math.sin(a) * (20 - 10 * k)
            d.ellipse([px - 2, py - 2, px + 2, py + 2], fill=(255, 210, 150, 220))
    else:
        k = (i - 4) / 3  # 0 at burst
        for j, base in enumerate((18, 32, 46)):
            r = base + 14 * k
            alpha = int(255 * (1 - k) * (1 - j * 0.25))
            w = max(2, int(5 - 3 * k))
            d.arc([cx - r, cy - r * 0.75, cx + r, cy + r * 0.75], 200, 520, fill=(255, 90 + j * 40, 50, alpha), width=w)
        if i == 4:
            d.ellipse([cx - 16, cy - 13, cx + 16, cy + 13], fill=(255, 235, 200, 230))
    glow = layer.filter(ImageFilter.GaussianBlur(3))
    sheet.alpha_composite(glow, (i * W, 0))
    sheet.alpha_composite(layer, (i * W, 0))
sheet.save('public/sprites/fx-alpha-howl.png')
print('ok')
