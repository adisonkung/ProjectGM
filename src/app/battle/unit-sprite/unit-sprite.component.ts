import { Component, ElementRef, computed, effect, input, untracked, viewChild } from '@angular/core';
import { ANIM_FALLBACK, SHEETS, SheetDef, SpriteAnim } from '../../core/data/sprites';
import { HeroClass } from '../../core/models/hero';
import { Side } from '../../core/models/unit';

export type { SpriteAnim } from '../../core/data/sprites';

const FRAME_MS = 85;
/** ท่าที่ขัดท่าอื่นไม่ได้ (เดิน/โดนตี จะไม่แทรกท่าโจมตีหรือสกิล) */
const LOW: SpriteAnim[] = ['idle', 'walk', 'hurt'];

@Component({
  selector: 'app-unit-sprite',
  templateUrl: './unit-sprite.component.html',
  styleUrl: './unit-sprite.component.scss',
})
export class UnitSpriteComponent {
  readonly cls = input.required<HeroClass>();
  readonly side = input<Side>('ally');
  readonly sprite = input<string | undefined>();
  readonly star = input<number | undefined>();
  readonly boss = input(false);
  readonly anim = input<SpriteAnim>('idle');
  /** เปลี่ยนค่านี้เพื่อสั่งเล่นท่าเดิมซ้ำ */
  readonly animKey = input(0);
  readonly speed = input(1);

  readonly sheet = viewChild<ElementRef<HTMLElement>>('sheet');
  readonly rarity = computed(() => `var(--r${this.star() ?? 1})`);
  readonly def = computed<SheetDef | undefined>(() => SHEETS[this.sprite() ?? '']);
  readonly bgSize = computed(() => {
    const d = this.def();
    return d ? `${d.cols * 100}% ${d.rows * 100}%` : null;
  });

  private current?: Animation;
  private currentName: SpriteAnim = 'idle';

  constructor() {
    effect(() => {
      const name = this.anim();
      this.animKey();
      const el = this.sheet()?.nativeElement;
      const def = this.def();
      if (el && def) untracked(() => this.play(el, def, name));
    });
  }

  private play(el: HTMLElement, def: SheetDef, want: SpriteAnim): void {
    // แผ่นไม่มีท่านี้: ใช้ท่าใกล้เคียงแทน
    let name: SpriteAnim | null = want;
    while (name && !def.anims[name]) name = ANIM_FALLBACK[name];
    if (!name) return;

    const busy = this.current?.playState === 'running';
    if (LOW.includes(name) && name !== 'idle' && busy && !LOW.includes(this.currentName)) return;
    // ไม่ขยับอีกหลังตาย (ยกเว้นรีเซ็ตกลับท่ายืน)
    if (this.currentName === 'die' && name !== 'die' && name !== 'idle') return;

    const a = def.anims[name]!;
    const y = def.rows > 1 ? (a.row / (def.rows - 1)) * 100 : 0;
    const x = (i: number) => (i / (def.cols - 1)) * 100;
    const hold = name === 'die';
    const loop = name === 'idle';
    const frames = hold ? a.frames - 1 : a.frames;

    this.current?.cancel();
    this.currentName = name;
    this.current = el.animate(
      [{ backgroundPosition: `0% ${y}%` }, { backgroundPosition: `${x(frames)}% ${y}%` }],
      {
        duration: (a.frames * FRAME_MS) / this.speed(),
        easing: `steps(${frames})`,
        iterations: loop ? Infinity : 1,
        fill: hold ? 'forwards' : 'none',
      },
    );
    if (!loop && !hold) this.current.onfinish = () => this.play(el, def, 'idle');
  }
}
