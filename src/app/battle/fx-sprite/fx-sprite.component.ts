import { Component, ElementRef, afterNextRender, computed, input, viewChild } from '@angular/core';
import { FX, FX_SCALE, PX_TO_CELL } from '../../core/data/sprites';

/** เล่นเอฟเฟกต์สกิลหนึ่งรอบแล้วหายไป (ผู้เรียกลบออกจากรายการเองตาม fxDuration) */
@Component({
  selector: 'app-fx-sprite',
  template: `<div #el class="fx" [style.background-image]="'url(sprites/' + def().file + ')'"
    [style.background-size]="strip() * 100 + '% 100%'" [style.width.%]="def().w * pxToCell * (def().scale ?? 1) * fxScale"
    [style.aspect-ratio]="def().w + ' / ' + def().h" [style.left]="'calc(50% + ' + (offset()?.[0] ?? def().dx ?? 0) * (flip() ? -1 : 1) + '%)'"
    [style.top]="'calc(50% + ' + (offset()?.[1] ?? def().dy ?? 0) + '%)'" [style.transform-origin]="origin()" [class.pixelated]="!!def().pixelated"
    [style.transform]="'translate(' + -pivot()[0] * 100 + '%, ' + -pivot()[1] * 100 + '%) rotate(' + angle() + 'deg)' + (flip() ? ' scaleX(-1)' : '')"></div>`,
  styles: `
    :host { position: absolute; inset: 0; pointer-events: none; }
    .fx { position: absolute; background-repeat: no-repeat; opacity: 0; }
    .pixelated { image-rendering: pixelated; }
  `,
})
export class FxSpriteComponent {
  readonly name = input.required<string>();
  /** ทิศทาง (องศา) สำหรับเอฟเฟกต์ที่พุ่ง; 0 = หันขวา */
  readonly angle = input(0);
  readonly speed = input(1);
  /** ผู้ใช้หันซ้าย: กลับภาพและค่า dx (ใช้กับเอฟเฟกต์ที่ตัวเอง) */
  readonly flip = input(false);
  /** resolved [dx, dy] (owner anchor + FX offset, `fxOffset()`); default = the FX's own dx / dy */
  readonly offset = input<[number, number] | undefined>(undefined);

  readonly el = viewChild.required<ElementRef<HTMLElement>>('el');
  readonly def = computed(() => FX[this.name()]);
  /** anchor point inside the frame (default centre): sits on dx/dy, flip / rotate turn around it */
  readonly pivot = computed(() => this.def().pivot ?? [0.5, 0.5]);
  /** frames in the file (a segment of a longer strip plays frames from → from + frames − 1) */
  readonly strip = computed(() => this.def().stripFrames ?? this.def().frames);
  readonly origin = computed(() => `${this.pivot()[0] * 100}% ${this.pivot()[1] * 100}%`);
  readonly pxToCell = PX_TO_CELL;
  readonly fxScale = FX_SCALE;

  constructor() {
    afterNextRender(() => {
      const d = this.def();
      const n = this.strip();
      const pos = (i: number) => (n > 1 ? (i / (n - 1)) * 100 : 0);
      this.el().nativeElement.animate(
        [
          { backgroundPosition: `${pos(d.from ?? 0)}% 0%`, opacity: 1 },
          { backgroundPosition: `${pos((d.from ?? 0) + d.frames - 1)}% 0%`, opacity: 1 },
        ],
        // steps(n, jump-none) = n ค่า 0% … 100% ตรงกับ n เฟรมพอดี
        // (ถ้าใช้ n-1 ตำแหน่งจะคร่อมระหว่างเฟรม เห็นครึ่งเฟรมข้าง ๆ เป็นรอยตัดแนวตั้ง)
        { duration: fxDuration(this.name(), this.speed()), easing: `steps(${d.frames}, jump-none)`, fill: 'none' },
      );
    });
  }
}

export function fxDuration(name: string, speed = 1): number {
  const d = FX[name];
  return d ? (d.frames * d.frameMs) / speed : 0;
}
