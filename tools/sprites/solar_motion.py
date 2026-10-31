import math
TAU=math.tau

def clamp(x):
    return max(0, min(1, x))

def smooth(x):
    x = clamp(x)
    return x * x * (3 - 2 * x)

def env(t, a, b, c, d):
    return smooth((t - a) / (b - a)) * (1 - smooth((t - c) / (d - c)))

def seq(a, b, p):
    return round(a + (b - a) * clamp(p))

def star(d, x, y, r, col):
    d.polygon([(x, y - r), (x + r * 0.24, y - r * 0.24), (x + r, y), (x + r * 0.24, y + r * 0.24), (x, y + r), (x - r * 0.24, y + r * 0.24), (x - r, y), (x - r * 0.24, y - r * 0.24)], fill=col)

def ellipse(d, x, y, rx, ry, col, width=1):
    d.ellipse((x - rx, y - ry, x + rx, y + ry), outline=col, width=width)

def bank1_blink(p):
    return [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14][min(10, int(clamp(p) * 11))]

def animation_pose(name, t, duration):
    hover = 4 * math.sin(TAU * t / duration)
    bank = 0
    idx = 0
    opening = 0
    angle = 3 * math.sin(TAU * t / duration)
    kick = 0
    tilt = 0
    dim = 1
    opacity = 1
    death = 0
    energy = 0
    ground = 0
    if name == 'idle':
        if 2.2 <= t < 2.85:
            idx = bank1_blink((t - 2.2) / 0.65)
        phase = 'FLOAT / BLINK / HALO IDLE'
    elif name == 'normal':
        if 0.65 <= t < 1.04:
            idx = seq(4, 9, (t - 0.65) / 0.39)
        elif 1.04 <= t < 1.25:
            idx = 9
        elif 1.25 <= t < 1.6:
            idx = seq(10, 14, (t - 1.25) / 0.35)
        elif t >= 1.6:
            idx = 14
        energy = env(t, 0.65, 1.1, 1.5, 1.6)
        opening = 0.03 * energy
        kick = 6 * env(t, 1.6, 1.64, 1.69, 1.87)
        phase = 'IDLE' if t < 0.65 else 'SHORT CHARGE' if t < 1.6 else 'SHOT / IMPACT' if t < 2.7 else 'RECOVER'
    elif name == 'skill-1':
        if 0.65 <= t < 1.15:
            idx = seq(4, 9, (t - 0.65) / 0.5)
        elif 1.15 <= t < 1.55:
            idx = 9
        elif 1.55 <= t < 1.95:
            idx = seq(10, 14, (t - 1.55) / 0.4)
        elif t >= 1.95:
            idx = 14
        energy = env(t, 0.6, 1.4, 2.1, 2.6)
        e = env(t, 0.6, 1.6, 3.5, 4.7)
        opening = 0.16 * e
        angle = -12 * e
        phase = 'PREPARE' if t < 1.2 else 'LOCK TWO TARGETS' if t < 2.1 else 'DELAYED SEALS' if t < 3.35 else 'DETONATE / RECOVER'
    elif name in ['skill-2', 'skill-3']:
        bank = 1
        release = 2.65 if name == 'skill-2' else 3.65
        if 0.65 <= t < 1.5:
            idx = seq(3, 16, (t - 0.65) / 0.85)
        elif 1.5 <= t < release - 0.35:
            idx = 21 if name == 'skill-2' else 28
        elif release - 0.35 <= t < release:
            idx = seq(33, 41, (t - release + 0.35) / 0.35)
        elif t >= release:
            idx = 41
        e = env(t, 0.6, 2.0, 5.0 if name == 'skill-2' else 4.15, 6.4)
        energy = env(t, 0.65, 1.7, release - 0.05, release + 0.05)
        opening = (0.09 if name == 'skill-2' else 0.34) * e
        angle = (55 if name == 'skill-2' else -24) * e
        if name == 'skill-3':
            ground = energy
        for start in [2.65, 3.6, 4.55] if name == 'skill-2' else [3.65]:
            kick += 7 * env(t, start, start + 0.04, start + 0.09, start + 0.3)
        phase = 'PREPARE' if t < 0.65 else 'CLOSE EYE / CHARGE' if t < release - 0.35 else 'REOPEN / FIRE' if t < release + 0.1 else 'LANES A > B > C' if name == 'skill-2' and t < 5.2 else 'RELEASE / RECOVER'
    elif name == 'hurt':
        z = env(t, 0.8, 0.82, 0.9, 1.18)
        kick = 9 * z
        tilt = -2.5 * z
        idx = 6 if z > 0.2 else 0
        dim = 1 + 0.55 * z
        phase = 'INCOMING HIT' if t < 0.8 else 'RECOIL / FLASH' if t < 1.2 else 'RECOVER'
    elif name == 'break':
        bank = 1
        e = env(t, 0.75, 1.15, 4.25, 5.5)
        opening = 0.13 * e
        angle = -9 * e
        hover += 28 * e
        dim = 1 - 0.52 * e
        tilt = math.sin(t * 28) * 2.5 * e
        energy = 0.12 * e
        if t < 0.75:
            idx = 0
        elif t < 1.15:
            idx = seq(10, 18, (t - 0.75) / 0.4)
        elif t < 4.25:
            idx = 25
        elif t < 4.85:
            idx = seq(33, 41, (t - 4.25) / 0.6)
        else:
            idx = 41
        phase = 'BREAK IMPACT' if t < 1.15 else 'CLOSED EYE / DISABLED HALO' if t < 4.25 else 'RECOVER'
    elif name == 'death':
        z = smooth((t - 0.75) / 3.2)
        death = z
        opening = 0.45 * z
        angle = -20 * z
        hover += 65 * z
        dim = 1 - 0.7 * z
        opacity = 1 - smooth((t - 2.4) / 1.7)
        if t < 0.7:
            idx = 0
        elif t < 1.2:
            idx = seq(4, 9, (t - 0.7) / 0.5)
        else:
            idx = 9
        phase = 'CORE SHUTDOWN' if t < 1.3 else 'HALO FALLS APART' if t < 3.5 else 'DISSOLVE'
    return dict(bank=bank, idx=idx, hover=hover, opening=opening, angle=angle, kick=kick, tilt=tilt, dim=dim, opacity=opacity, death=death, energy=energy, ground=ground, phase=phase)