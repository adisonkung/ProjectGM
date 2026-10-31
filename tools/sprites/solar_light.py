import math
from solar_motion import TAU,star,clamp

def charge_light(d, x, y, age, e, magnitude=1):
    speed = 2.1 + 1.2 * e
    clock = age * speed
    strength = clamp(e)
    for j in range(3):
        r = (68 + j * 15) * magnitude * (1 - 0.1 * e)
        tilt = j * 1.05 + 0.3
        pts = []
        for k in range(24):
            a = clock + j * TAU / 3 + k / 23 * 0.95
            u = r * math.cos(a)
            v = r * 0.4 * math.sin(a)
            pts.append((x + u * math.cos(tilt) - v * math.sin(tilt), y + u * math.sin(tilt) + v * math.cos(tilt)))
        d.line(pts, fill=(255, 204 + 12 * j, 103 + 22 * j, round((150 + 25 * j) * strength)), width=2)
        star(d, *pts[-1], 3.2 + j * 0.7, (255, 244, 185, round(240 * strength)))
    for j in range(42):
        progress = (age * (0.68 + 0.035 * (j % 4)) + j / 42) % 1
        pts = []
        for k in range(6):
            q = max(0, progress - k * 0.018)
            r = (18 + (1 - q) ** 1.5 * 112) * magnitude
            a = clock + j * 2.399963 + q * 2.4
            pts.append((x + r * math.cos(a), y + r * 0.78 * math.sin(a)))
        alpha = round((95 + 125 * progress) * strength)
        d.line(pts, fill=(255, 198 + int(35 * progress), 91 + int(70 * progress), alpha), width=1 if j % 3 else 2)
        if j % 5 == 0:
            star(d, *pts[0], 2 + progress * 2, (255, 242, 181, alpha))
    pulse = 0.5 + 0.5 * math.sin(age * 13)
    r = 13 + 5 * pulse
    for j in range(4):
        a = clock * 1.3 + j * TAU / 4
        xx = x + r * math.cos(a)
        yy = y + r * 0.8 * math.sin(a)
        star(d, xx, yy, 2.5, (255, 244, 190, round((100 + 110 * pulse) * strength)))
