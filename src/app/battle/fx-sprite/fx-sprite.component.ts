import { Component, ElementRef, afterNextRender, computed, input, viewChild } from '@angular/core';
import { FX, PX_TO_CELL } from '../../core/data/sprites';

/** เล่นเอฟเฟกต์สกิลหนึ่งรอบแล้วหายไป (ผู้เรียกลบออกจากรายการเองตาม fxDuration) */
@Component({
  selector: 'app-fx-sprite',
  template: `<div #el class="fx" [style.background-image]="'url(sprites/' + def().file + ')'"
    [style.background-size]="def().frames * 100 + '% 100%'" [style.width.%]="def().w * pxToCell * (def().scale ?? 1)"
    [style.aspect-ratio]="def().w + ' / ' + def().h" [style.left]="'calc(50% + ' + (def().dx ?? 0) + '%)'"
    [style.top]="'calc(50% + ' + (def().dy ?? 0) + '%)'" [style.transform]="'translate(-50%, -50%) rotate(' + angle() + 'deg)'"></div>`,
  styles: `
    :host { position: absolute; inset: 0; pointer-events: none; }
    .fx { position: absolute; background-repeat: no-repeat; opacity: 0; }
  `,
})
export class FxSpriteComponent {
  readonly name = input.required<string>();
  /** ทิศทาง (องศา) สำหรับเอฟเฟกต์ที่พุ่ง; 0 = หันขวา */
  readonly angle = input(0);
  readonly speed = input(1);

  readonly el = viewChild.required<ElementRef<HTMLElement>>('el');
  readonly def = computed(() => FX[this.name()]);
  readonly pxToCell = PX_TO_CELL;

  constructor() {
    afterNextRender(() => {
      const d = this.def();
      this.el().nativeElement.animate(
        [
          { backgroundPosition: '0% 0%', opacity: 1 },
          { backgroundPosition: '100% 0%', opacity: 1 },
        ],
        { duration: fxDuration(this.name(), this.speed()), easing: `steps(${d.frames - 1}, jump-none)`, fill: 'none' },
      );
    });
  }
}

export function fxDuration(name: string, speed = 1): number {
  const d = FX[name];
  return d ? (d.frames * d.frameMs) / speed : 0;
}
