"""Vaelric Phase A: bake five supplied 5x5 RGBA sheets; never modify source PNGs.

python3 tools/sprites/vaelric.py [source dir] [sprite output] [portrait output] [S1 source dir] [S2 source dir] [Ultimate source dir] [UI art ZIP or dir]
Default source: art/incoming/vaelric, with the six original filenames from Vaelric.zip.
User 2026-10-20 explicitly requires keeping the baked basic-attack slash/flash intact.
Supplied S1/S2 fill rows 5/6; vaelric_ult.py registers Ultimate in row7 after the base bake.
"""
import hashlib
import json
import sys
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image

import aurel_v2 as A
import bailong as B
from vaelric_art import read_sources, bake_ui

SOURCES = {'idle': 'idle', 'walk': 'run', 'hurt': 'hurt', 'attack': 'basic_attack', 'die': 'death'}
B.CELL_W, B.CELL_H, B.ROOT_X, B.ROOT_Y = 260, 170, 130, 155


def main():
    src = Path(sys.argv[1] if len(sys.argv) > 1 else 'art/incoming/vaelric')
    out = Path(sys.argv[2] if len(sys.argv) > 2 else 'public/sprites')
    portraits = Path(sys.argv[3] if len(sys.argv) > 3 else 'public/portraits')
    s1 = Path(sys.argv[4]) if len(sys.argv) > 4 else src / 's1'
    s2 = Path(sys.argv[5]) if len(sys.argv) > 5 else src / 's2'
    ult = Path(sys.argv[6]) if len(sys.argv) > 6 else src / 'ult'
    art = Path(sys.argv[7]) if len(sys.argv) > 7 else src / 'art'
    read_sources(art)  # Refuse to overwrite accepted UI art with a reference fallback.
    if not (ult / 'ulti_character.png').is_file():
        raise FileNotFoundError('Ultimate source required: refusing to overwrite accepted row7')
    required = [src / (name + '.png') for name in [*SOURCES.values(), 'master_reference']]
    required.extend([s1 / 's1_character.png', s2 / 's2_character.png'])
    for path in required:
        if not path.is_file():
            raise FileNotFoundError(path)
    hashes = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in required}
    groups = {}
    for kind, name in SOURCES.items():
        im = Image.open(src / (name + '.png')).convert('RGBA')
        if im.width != im.height or im.width % 5:
            raise ValueError(f'Expected square 5x5 grid: {name}')
        size = im.width // 5
        frames = []
        for i in range(25):
            x, y = i % 5 * size, i // 5 * size
            pixels = np.array(im.crop((x, y, x + size, y + size)))
            # Native alpha, not the green RGB stored underneath transparent source pixels.
            root = B.body_root(np.where(pixels[..., 3] >= B.ALPHA_CUT, 255, 0), 'mass')
            frames.append({'img': pixels, 'root': root})
        # One ground per clip preserves airborne running, crouching and collapse.
        ground = max(f['root'][1] for f in frames) if kind == 'walk' else frames[0]['root'][1]
        for fr in frames:
            fr['root'] = (fr['root'][0], ground)
        groups[kind] = frames
    scales = {kind: 78 / float(A.body_h(frames[0])) for kind, frames in groups.items()}
    # Run is crouched. Match the original idle's source scale rather than enlarging the bent posture.
    scales['walk'] = scales['idle']
    im = Image.open(s1 / 's1_character.png').convert('RGBA')
    if im.size != (5120, 5120):
        raise ValueError('Expected supplied S1 5120x5120, 5x5 grid')
    groups['skill'] = []
    for i in range(25):
        x, y = i % 5 * 1024, i // 5 * 1024
        pixels = np.array(im.crop((x, y, x + 1024, y + 1024)))
        root = B.body_root(np.where(pixels[..., 3] >= B.ALPHA_CUT, 255, 0), 'mass')
        groups['skill'].append({'img': pixels, 'root': root})
    ground = groups['skill'][0]['root'][1]
    for frame in groups['skill']:
        frame['root'] = (frame['root'][0], ground)
    # Equivalent standing endpoints, one scale for the whole skill; no frame-by-frame resizing.
    scales['skill'] = 78 / float(np.median([A.body_h(groups['skill'][0]), A.body_h(groups['skill'][-1])]))
    im = Image.open(s2 / 's2_character.png').convert('RGBA')
    if im.size != (7680, 7680):
        raise ValueError('Expected supplied S2 7680x7680, 5x5 grid')
    groups['skill2'] = []
    removed_white = []
    for i in range(25):
        x, y = i % 5 * 1536, i // 5 * 1536
        pixels = np.array(im.crop((x, y, x + 1536, y + 1536)))
        # User explicitly removed the three detached white fragments on F24; character / main slashes remain intact.
        if i == 23:
            if hashes['s2_character.png'] != '0cccb25c2ccbe865697ab4e5c062ae01561b70c8abfb22dcc7431c81f96b230f':
                raise ValueError('Review the F24 fragment masks for a changed S2 source')
            for box in [(765, 0, 788, 152), (1395, 328, 1536, 491), (944, 1250, 1115, 1427)]:
                x0, y0, x1, y1 = box
                removed_white.append(int(np.count_nonzero(pixels[y0:y1, x0:x1, 3])))
                pixels[y0:y1, x0:x1] = 0
        root = B.body_root(np.where(pixels[..., 3] >= B.ALPHA_CUT, 255, 0), 'mass')
        groups['skill2'].append({'img': pixels, 'root': root})
    ground = groups['skill2'][0]['root'][1]
    for frame in groups['skill2']:
        frame['root'] = (frame['root'][0], ground)
    scales['skill2'] = 78 / float(A.body_h(groups['skill2'][0]))
    # These supplied grids already register the waist across poses. Recomputing a root from
    # each silhouette includes the changing sword/flash and drags the body backwards.
    # Keep the first standing pose's source anchor for every action; preserve the drawn lean.
    for kind in ('attack', 'skill', 'skill2'):
        anchor = groups[kind][0]['root'][0]
        for frame in groups[kind]:
            frame['root'] = (anchor, frame['root'][1])
    probe = Image.new('RGBA', (260 * 25, 170 * 8))
    for row, (kind, frames) in enumerate(groups.items()):
        for col, fr in enumerate(frames):
            A.paste_frame(probe, fr, row, col, scales[kind], (0, 0))
    alpha = np.array(probe)[..., 3]
    torso = {kind: [A.torso_x(alpha[row*170:(row+1)*170, col*260:(col+1)*260])
                    for col in range(25)] for row, kind in enumerate(groups)}
    shifts = A.stabilise(torso)
    for kind in ('attack', 'skill', 'skill2'):
        # Align the first pose to idle once, never follow a baked flash's apparent chest.
        shifts[kind] = [shifts[kind][0]] * len(groups[kind])
    sheet = Image.new('RGBA', probe.size)
    clipped = []
    for row, (kind, frames) in enumerate(groups.items()):
        for col, fr in enumerate(frames):
            clipped.append(A.paste_frame(sheet, fr, row, col, scales[kind], (shifts[kind][col], 0)))
    if any(clipped):
        raise ValueError(f'Clipped visible source pixels: {clipped}')
    out.mkdir(parents=True, exist_ok=True)
    portraits.mkdir(parents=True, exist_ok=True)
    sheet.save(out / 'hero-vaelric.png', optimize=True)
    bake_ui(art, portraits.parent)
    subprocess.run([sys.executable, str(Path(__file__).with_name('vaelric_ult.py')), str(ult), str(out)], check=True)
    print(json.dumps({'sources': hashes, 'sheet': sheet.size, 'framesPerClip': 25,
                      'scales': scales, 'idleBody': 78, 's2RemovedWhitePixels': removed_white, 'clipped': sum(clipped)}, indent=2))


if __name__ == '__main__':
    main()
