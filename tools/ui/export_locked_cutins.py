"""Export immutable starter cut-ins and crop their generated two-layer VFX sheets.

--check verifies all hashes and decoded RGBA pixels without writing runtime assets.
"""
from pathlib import Path
import argparse
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / 'assets/ui/cutins/locked-five/manifest.json'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def export(row, check):
    source, output = ROOT / row['source'], ROOT / row['file']
    assert digest(source) == row['source_sha256'], source
    image = Image.open(source).convert('RGBA')
    assert image.size == (row['w'], row['h']), source
    if not check:
        output.parent.mkdir(parents=True, exist_ok=True)
        image.save(output, 'WEBP', lossless=True, exact=True, method=6)
    assert Image.open(output).convert('RGBA').tobytes() == image.tobytes(), output
    if check:
        assert digest(output) == row['runtime_sha256'], output
    else:
        row['runtime_sha256'] = digest(output)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--manifest', default=str(MANIFEST), help='Manifest path, relative to repository root or absolute')
    args = parser.parse_args()
    manifest = ROOT / args.manifest
    data = json.loads(manifest.read_text())
    for row in data:
        export(row, args.check)
        sheet_path = ROOT / row['sheet']
        assert digest(sheet_path) == row['sheet_sha256'], sheet_path
        sheet = Image.open(sheet_path).convert('RGBA')
        for layer in row['layers']:
            cropped = sheet.crop(tuple(layer['crop_box']))
            source = ROOT / layer['source']
            if not args.check and not source.exists():
                cropped.save(source)
            assert cropped.tobytes() == Image.open(source).convert('RGBA').tobytes(), source
            export(layer, args.check)
    if not args.check:
        manifest.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    print(f'Verified {len(data)} cut-ins and {sum(len(row["layers"]) for row in data)} alpha textures: immutable sources, lossless RGBA exports.')


if __name__ == '__main__':
    main()
