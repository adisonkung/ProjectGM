"""Mechanically extract already-generated icon sprites; never invent or repaint the item artwork.

python3 tools/dev/pack_hero_breakthrough_art.py [--partial]
Original imagegen sheets are immutable inputs. Separate generated sprites are located by alpha-connected bodies, each icon is
exported with >=10% transparent padding, and portrait/source/output hashes are recorded for review.
"""
import hashlib
import json
import sys
import zipfile
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / 'docs/art/hero-breakthrough/manifest.json'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def pack(partial=False):
    report = json.loads(MANIFEST.read_text())
    pending = [h['id'] for h in report['heroes'] if not (ROOT / h['sheet']).is_file()]
    if pending and not partial:
        raise ValueError('Missing generated sheets: ' + ', '.join(pending))
    entries = []
    for hero in report['heroes']:
        source = ROOT / hero['sheet']
        if not source.exists():
            continue
        if sha(ROOT / hero['portrait']) != hero['portrait_sha256']:
            raise ValueError('Portrait changed since generation began: ' + hero['id'])
        with Image.open(source) as original:
            if original.mode != 'RGBA':
                raise ValueError('Sheet has no genuine transparency: ' + str(source))
            sheet = original.copy()
        w, h = sheet.size
        if w != 1536 or h != 1024:
            raise ValueError(f'Unexpected sheet dimensions: {source}: {sheet.size}')
        alpha = np.array(sheet.getchannel('A'))
        if not np.any(alpha == 0) or alpha.max() < 240:
            raise ValueError('Invalid transparency/object opacity: ' + str(source))
        # Alpha-connected bodies avoid clipping tips when generated icons straddle a nominal grid line.
        # Assign detached shards to their nearest main sprite, then preserve the original RGBA pixels and soft edges.
        labels, count = ndimage.label(alpha >= 128)
        sizes = np.bincount(labels.ravel())
        primary = np.argsort(sizes[1:])[-6:] + 1
        centers = ndimage.center_of_mass(alpha >= 128, labels, list(primary))
        primary_cells = [int(cy >= h / 2) * 3 + min(2, int(cx / (w / 3))) for cy, cx in centers]
        if sorted(primary_cells) != list(range(6)) or min(sizes[primary]) < 20000:
            raise ValueError('Cannot isolate six complete generated sprites: ' + str(source))
        assignment = np.zeros(count + 1, dtype=np.uint8)
        component_centers = ndimage.center_of_mass(alpha >= 128, labels, list(range(1, count + 1)))
        for label_id, center in enumerate(component_centers, 1):
            nearest = min(range(6), key=lambda i: (center[0]-centers[i][0])**2 + (center[1]-centers[i][1])**2)
            assignment[label_id] = primary_cells[nearest] + 1
        owners = assignment[labels]
        _, indices = ndimage.distance_transform_edt(labels == 0, return_indices=True)
        owners = owners[indices[0], indices[1]]
        variants = []
        for cell in range(6):
            row, col = divmod(cell, 3)
            pixels_rgba = np.array(sheet)
            pixels_rgba[owners != cell + 1, 3] = 0
            area = Image.fromarray(pixels_rgba)
            box = area.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
            if box is None:
                raise ValueError('Empty generated sprite')
            box = (max(0, box[0]-4), max(0, box[1]-4), min(w, box[2]+4), min(h, box[3]+4))
            icon = area.crop(box)
            icon.thumbnail((408, 408), Image.Resampling.LANCZOS)
            canvas = Image.new('RGBA', (512, 512))
            canvas.alpha_composite(icon, ((512-icon.width)//2, (512-icon.height)//2))
            pixels = np.array(canvas.getchannel('A'))
            if any(np.any(edge) for edge in (pixels[:50], pixels[-50:], pixels[:, :50], pixels[:, -50:])):
                raise ValueError('Output lacks transparent safety padding')
            item = ('bt_stone_' if row == 0 else 'bt_fragment_') + str(col + 1)
            path = ROOT / 'public/items/heroes' / hero['id'] / f'{item}.webp'
            path.parent.mkdir(parents=True, exist_ok=True)
            canvas.save(path, format='WEBP', lossless=True, method=4)
            png = ROOT / 'work/hero-breakthrough/png' / hero['id'] / f'{item}.png'
            png.parent.mkdir(parents=True, exist_ok=True)
            canvas.save(png)
            variant = {'item': item, 'url': '/' + path.relative_to(ROOT / 'public').as_posix(),
                'png_archive_entry': hero['id'] + '/' + item + '.png', 'size': [512, 512], 'sha256': sha(path),
                'primary_component': int(primary[primary_cells.index(cell)]),
                'crop_rect': list(box), 'alpha_padding': 50}
            variants.append(variant)
            entries.append({'id': f'hero-breakthrough/{hero["id"]}/{item}', 'label': hero['id'] + ' · ' + item,
                'group': 'hero-breakthrough', 'url': variant['url'], 'status': 'art_ready', 'heroId': hero['id'], 'itemId': item})
        hero.update(status='art_ready', sheet_sha256=sha(source), variants=variants)
    report['status'] = 'art_ready' if not pending else 'generation_in_progress'
    report['assetCount'] = len(entries)
    MANIFEST.write_text(json.dumps(report, indent=2) + '\n')
    ts = '/** Generated by tools/dev/pack_hero_breakthrough_art.py. Art variants only, not inventory item IDs. */\n'
    ts += "import type { GeneratedArtEntry } from './generated-art';\n"
    ts += 'export interface HeroBreakthroughArtEntry extends GeneratedArtEntry { heroId: string; itemId: string; }\n'
    ts += 'export const HERO_BREAKTHROUGH_ART: readonly HeroBreakthroughArtEntry[] = ' + json.dumps(entries, indent=2) + ';\n'
    (ROOT / 'src/app/core/data/hero-breakthrough-art.ts').write_text(ts)
    if not pending:
        archive = ROOT / 'docs/art/hero-breakthrough/hero-breakthrough-icons.zip'
        with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
            for hero in report['heroes']:
                for variant in hero['variants']:
                    z.write(ROOT / 'work/hero-breakthrough/png' / variant['png_archive_entry'], variant['png_archive_entry'])
            z.writestr('manifest.json', json.dumps(report, indent=2))
            z.writestr('README.txt', '90 generated hero-bound breakthrough art variants: 15 heroes x (3 whole stones + 3 matching fragments).\n512x512 RGBA PNG with transparent padding. These are art variants, not new inventory IDs.\n')
    print(f'Packed {len(entries)} variants; pending sheets: {len(pending)}')


if __name__ == '__main__':
    pack('--partial' in sys.argv)
