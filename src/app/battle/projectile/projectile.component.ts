import { Component, ElementRef, afterNextRender, computed, inject, input, viewChild } from '@angular/core';
import { gridPosition, spriteUrl, stripGrid } from '../../core/data/sprite-files';
import { FX, PROJECTILE_SCALE, PX_TO_CELL } from '../../core/data/sprites';

/**
 * กระสุนที่บินจากผู้ยิงไปหาเป้า (ลูกธนู/ลูกแสง)
 * - host เลื่อนจากช่อง from ไปช่อง to ภายในเวลา flight (เป็นเส้นตรง)
 * - ภาพหมุนตามทิศที่บิน (ลบ angle0 = ทิศที่ภาพวาดชี้อยู่)
 * - ระหว่างบินวนเฟรม 0..n-2 เมื่อถึงแสดงเฟรมสุดท้าย (กระทบ) สั้น ๆ
 * ตำแหน่งเป็น % ของช่อง (เหมือน transform ของยูนิตบนกระดาน)
 */
@Component({
  selector: 'app-projectile',
  template: `<div #el class="p" [style.background-image]="'url(' + url() + ')'"
    [style.background-size]="grid().cols * 100 + '% ' + grid().rows * 100 + '%'" [style.width.%]="def().w * pxToCell * (def().scale ?? 1) * projScale"
    [style.aspect-ratio]="def().w + ' / ' + def().h" [style.transform]="'translate(-50%, -50%) rotate(' + rot() + 'deg)'"></div>`,
  styles: `
    :host { position: absolute; left: 0; top: 0; width: var(--cell); height: var(--cell); pointer-events: none; z-index: 105; }
    .p { position: absolute; left: 50%; top: 42%; background-repeat: no-repeat; }
  `,
})
export class ProjectileComponent {
  readonly name = input.required<string>();
  /** ตำแหน่งเริ่ม/จบ เป็นจำนวนช่องบนจอ (x = คอลัมน์, y = แถวรวมแถวฉาก) */
  readonly from = input.required<{ x: number; y: number }>();
  readonly to = input.required<{ x: number; y: number }>();
  /** เวลาบิน (ms ที่ความเร็ว x1) */
  readonly flight = input.required<number>();
  readonly speed = input(1);

  readonly el = viewChild.required<ElementRef<HTMLElement>>('el');
  readonly def = computed(() => FX[this.name()]);
  readonly grid = computed(() => stripGrid(this.def().file, this.def().frames));
  readonly url = computed(() => spriteUrl(this.def().file));
  readonly pxToCell = PX_TO_CELL;
  readonly projScale = PROJECTILE_SCALE;
  readonly rot = computed(() => {
    if (this.def().noRotate) return 0;
    const a = this.from(), b = this.to();
    return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI - (this.def().angle0 ?? 0);
  });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterNextRender(() => {
      const d = this.def();
      const a = this.from(), b = this.to();
      const t = (p: { x: number; y: number }) => `translate(${p.x * 100}%, ${p.y * 100}%)`;
      const ms = this.flight() / this.speed();
      const host = this.host.nativeElement;
      host.style.transform = t(b);
      host.animate([{ transform: t(a) }, { transform: t(b) }], { duration: ms, easing: 'linear' });
      const el = this.el().nativeElement;
      const flyFrames = Math.max(1, d.frames - 1);
      const g = this.grid();
      const x = (i: number) => gridPosition(i, g); // one-frame bolt: 0 % (no NaN)
      const k: Keyframe[] = [];
      for (let i = 0; i < flyFrames; i++) k.push({ offset: i / flyFrames, easing: 'steps(1, end)', backgroundPosition: x(i) });
      k.push({ offset: 1, backgroundPosition: x(flyFrames - 1) });
      el.style.backgroundPosition = x(d.frames - 1); // เฟรมกระทบ แสดงหลังบินถึง
      el.animate(k, { duration: Math.max(ms, 1), iterations: 1 });
    });
  }
}

/** ระยะเวลาที่ต้องเก็บกระสุนไว้บนจอ (บิน + โชว์เฟรมกระทบ) */
export function projectileLife(flight: number, speed = 1): number {
  return flight / speed + 140 / speed;
}
