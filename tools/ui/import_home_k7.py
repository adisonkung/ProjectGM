"""Export K7 PNG artwork to runtime WebP. Run from the repo root with Pillow and NumPy."""
from pathlib import Path

from PIL import Image

from import_gilded import unmix_black

SRC = Path('assets/ui/home-k7')
OUT = Path('public/ui/home-k7')
BACKGROUNDS = {
    'card_adventure_bg': (1680, 800),
    'card_arena_bg': (820, 448),
    'card_daily_bg': (820, 448),
}
SHEETS = {
    'fx_clash_spark': 3,
    'fx_compass_burst': 3,
    'fx_torch_loop': 2,
    'fx_small_spark': 3,
}
CARD_PARTS = ('adv_', 'arena_', 'daily_')


def export_sheet(im: Image.Image, rows: int) -> Image.Image:
    result = Image.new('RGBA', (4 * 256, rows * 256))
    alpha = unmix_black(im)
    for row in range(rows):
        for col in range(4):
            x, y = col * 512, row * 512
            cell = alpha.crop((x, y, x + 512, y + 512))
            result.paste(cell.resize((256, 256), Image.Resampling.LANCZOS), (col * 256, row * 256))
    return result


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for path in sorted(SRC.glob('*.png')):
        name = path.stem
        with Image.open(path) as source:
            if name in BACKGROUNDS:
                assert source.size == BACKGROUNDS[name], f'{name}: incorrect background size'
                art = source.convert('RGB')
                quality = 90
            elif name in SHEETS:
                rows = SHEETS[name]
                assert source.size == (2048, rows * 512), f'{name}: incorrect sheet size'
                art = export_sheet(source, rows)
                quality = 86
            else:
                assert source.size == (1024, 1024), f'{name}: incorrect part size'
                assert source.mode == 'RGBA', f'{name}: expected an alpha channel'
                side = 512 if name.startswith(CARD_PARTS) else 256
                art = source.resize((side, side), Image.Resampling.LANCZOS)
                quality = 90
            art.save(OUT / f'{name}.webp', quality=quality, method=6)


if __name__ == '__main__':
    main()
