"""Gallery preview of every Forest Arc clip as the game plays it (facing left, 2 device px per atlas px).

    python3 tools/sprites/forest_arc/preview.py <out dir>
"""
import json, subprocess, sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
TS = (ROOT / 'src/app/core/data/forest-arc-art.generated.ts').read_text()
anims = json.loads(TS.split('FOREST_ARC_ANIMATIONS: Record<string, AnimationConfig> = ')[1].split(';\n')[0])
out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
S, T, LBL = 2, 230, 16
tiles = []
for mid, a in anims.items():
    sh = Image.open(ROOT / 'public/sprites' / a['sheet']).convert('RGBA')
    cw, ch = a['cellW'], a['cellH']
    for name, c in a['clips'].items():
        fr = [sh.crop((i * cw, (c['row'] - 1) * ch, (i + 1) * cw, c['row'] * ch)).transpose(Image.FLIP_LEFT_RIGHT) for i in range(c['frames'])]
        ev = {e['frame']: e['event'] for e in c['events']}
        tiles.append((mid, name, fr, c['frameMs'], ev, name == 'death'))
cols = 9
rows = (len(tiles) + cols - 1) // cols
W, H = cols * T, rows * (T + LBL)
FPS, DUR = 30, 4.0
p = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', str(out / 'forest_arc_gallery.mp4')], stdin=subprocess.PIPE)
first = None
for k in range(int(FPS * DUR)):
    t = k / FPS
    cv = Image.new('RGB', (W, H), (52, 62, 50)); d = ImageDraw.Draw(cv)
    for i, (mid, name, fr, ms, ev, hold) in enumerate(tiles):
        x, y = (i % cols) * T, (i // cols) * (T + LBL)
        n = int(t * 1000 // ms)
        j = min(n, len(fr) - 1) if hold else n % len(fr)
        im = fr[j].resize((fr[j].width * S, fr[j].height * S), Image.NEAREST)
        if im.width > T or im.height > T:
            im.thumbnail((T, T), Image.NEAREST)
        d.rectangle((x, y, x + T - 1, y + T + LBL - 1), outline=(70, 82, 66))
        cv.paste(im, (x + (T - im.width) // 2, y + LBL + T - im.height), im)
        d.text((x + 4, y + 2), f'{mid} {name} {j + 1}/{len(fr)} {ev.get(j + 1, "")}', fill=(235, 235, 235))
    if first is None and t >= 0.5: first = cv.copy()
    p.stdin.write(cv.tobytes())
p.stdin.close(); p.wait()
first.save(out / 'forest_arc_gallery.png')
print(len(tiles), 'clips', W, H)
