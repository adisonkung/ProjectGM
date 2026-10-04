"""draw the sky-city layout (plots, nodes, edges, fx) over the art → /tmp/claude-0/city/layout.png"""
import json, os
from PIL import Image, ImageDraw
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
L = json.load(open(os.path.join(ROOT, 'src/app/core/data/island/sky-city-layout.json')))
im = Image.open(os.path.join(ROOT, 'art/incoming/city/master_static.png')).convert('RGB')
d = ImageDraw.Draw(im)
for k, p in L['plots'].items():
    x, y, w, h = p['hit']; d.rectangle((x, y, x + w, y + h), outline=(255, 255, 0), width=4)
    d.text((x + 6, y + 6), k, fill=(255, 255, 0))
N = L['nodes']
for a, b in L['edges']:
    d.line((*N[a], *N[b]), fill=(0, 255, 255), width=6)
for k, (x, y) in N.items():
    d.ellipse((x - 12, y - 12, x + 12, y + 12), fill=(255, 60, 60)); d.text((x + 14, y - 10), k, fill=(255, 255, 255))
im.resize((im.width // 2, im.height // 2)).save('/tmp/claude-0/city/layout.png')
