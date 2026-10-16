import { TestBed } from '@angular/core/testing';
import { FxSpriteComponent } from '../../battle/fx-sprite/fx-sprite.component';
import { SPRITE_ATLAS } from './sprite-atlas';
import { gridCell, gridPosition, spriteUrl, stripGrid } from './sprite-files';
import { FX, SHEETS } from './sprites';

/** optimised sprite files (tools/sprites/optimize.py → sprite-atlas.ts) */
describe('sprite files (optimised atlas)', () => {
  it('every sheet and FX file has an optimised entry (re-run `npm run sprites:optimize` after a bake)', () => {
    const files = new Set([...Object.keys(SHEETS), ...Object.values(FX).map(d => d.file)]);
    for (const f of files) expect(SPRITE_ATLAS[f]).withContext(f).toBeDefined();
    expect(spriteUrl('hero-kael.png')).toMatch(/^sprites\/opt\/hero-kael\.(webp|png)$/);
    expect(spriteUrl('not-optimised.png')).toBe('sprites/not-optimised.png');
  });

  it('re-packed strips hold every frame; plain strips stay one row', () => {
    for (const d of Object.values(FX)) {
      const g = stripGrid(d.file, d.stripFrames ?? d.frames);
      expect(g.cols * g.rows).withContext(d.file).toBeGreaterThanOrEqual(d.stripFrames ?? d.frames);
      expect(g.cols * g.rows - (d.stripFrames ?? d.frames)).withContext(d.file).toBeLessThan(g.cols);
    }
    expect(stripGrid('fx-kael-ult-wave.png', 20)).toEqual({ cols: 9, rows: 3 });
    expect(stripGrid('fx-kael-s1-main.png', 10)).toEqual({ cols: 10, rows: 1 });
  });

  it('grid positions: column / row → background-position %', () => {
    const g = { cols: 9, rows: 3 };
    expect(gridCell(10, g)).toEqual([1, 1]);
    expect(gridPosition(10, g)).toBe('12.5% 50%');
    expect(gridPosition(0, { cols: 1, rows: 1 })).toBe('0% 0%');
    expect(gridPosition(4, { cols: 5, rows: 1 })).toBe('100% 0%');
  });

  it('the DOM FX plays a re-packed strip frame by frame through the grid', () => {
    const fixture = TestBed.createComponent(FxSpriteComponent);
    fixture.componentRef.setInput('name', 'kl-ult-wave');
    fixture.detectChanges();
    TestBed.flushEffects?.();
    fixture.detectChanges();
    const el = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.fx')!;
    expect(el.style.backgroundSize).toBe('900% 300%');
    expect(el.style.backgroundImage).toContain('sprites/opt/fx-kael-ult-wave');
  });
});
