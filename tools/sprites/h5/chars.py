import sys
from rows import bands
from extract_char import extract
SCALE = {'knight': 0.62, 'berserk': 0.78, 'plague': 0.68, 'reaper': 0.78, 'necro': 0.95}
CHAR = ['idle', 'walk', 'hurt', 'die', 'attack', 'skill', 'skill2', 'ult']
from grid import centres, LABEL_END
CENTRES = {}
SPLITS = {}
def run(h):
    b, lx = bands(h)
    rows = [(n, b[n][0], b[n][1], 8) for n in CHAR]
    # rows are not contiguous (effect rows in between): blank the effect rows first
    import numpy as np
    from PIL import Image
    im = np.array(Image.open(f'{h}.png'))
    for n in ('fx1', 'fx2', 'fxu'):
        y0, y1 = b[n]; im[y0:y1] = 0
    Image.fromarray(im).save(f'/tmp/{h}-chars.png')
    C = centres(h)
    lab = [(b[n][0], b[n][1], LABEL_END[h][n]) for n in b]
    extract(f'/tmp/{h}-chars.png', lab, rows, im.shape[0], SCALE[h], f'out/hero-{h}.png', centres=C, splits=SPLITS.get(h), CH=120)
if __name__ == '__main__':
    for h in sys.argv[1:]:
        run(h)
