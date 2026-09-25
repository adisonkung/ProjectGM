import numpy as np
from PIL import Image
NAMES = ['idle', 'walk', 'hurt', 'die', 'attack', 'skill', 'fx1', 'skill2', 'fx2', 'ult', 'fxu']
LABELS = {
 'knight': ([69,184,304,398,509,621,730,829,919,1008,1103], 148),
 'berserk': ([63,163,265,379,493,606,726,844,960,1080,1230], 182),
 'plague': ([74,179,292,399,513,633,750,868,976,1080,1204], 132),
 'reaper': ([56,157,258,355,463,566,652,726,800,879,969], 162),
 'necro': ([54,134,221,300,388,477,562,654,744,835,946], 192),
}
def bands(hero):
    c, lx = LABELS[hero]
    H = Image.open(f'{hero}.png').height
    out = {}
    for i, n in enumerate(NAMES):
        lo = 0 if i == 0 else (c[i-1] + c[i]) // 2
        hi = H if i == len(c) - 1 else (c[i] + c[i+1]) // 2
        out[n] = (lo, hi)
    return out, lx
