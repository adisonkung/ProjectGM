import { Component, ElementRef, computed, effect, input, untracked, viewChild } from '@angular/core';
import { HeroClass } from '../../core/models/hero';
import { Side } from '../../core/models/unit';

export type SpriteAnim = 'idle' | 'attack' | 'skill' | 'skill2' | 'hurt' | 'die';

/** แผ่น sprite: 10 คอลัมน์ x 6 แถว, ช่องละ 132x100 px */
const SHEET_COLS = 10;
const SHEET_ROWS = 6;
const ANIMS: Record<SpriteAnim, { row: number; frames: number }> = {
  idle: { row: 0, frames: 10 },
  hurt: { row: 1, frames: 6 },
  die: { row: 2, frames: 6 },
  attack: { row: 3, frames: 7 },
  skill: { row: 4, frames: 7 },
  skill2: { row: 5, frames: 5 },
};
const FRAME_MS = 85;

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

  private current?: Animation;
  private currentName: SpriteAnim = 'idle';

  constructor() {
    effect(() => {
      const name = this.anim();
      this.animKey();
      const el = this.sheet()?.nativeElement;
      if (el) untracked(() => this.play(el, name));
    });
  }

  private play(el: HTMLElement, name: SpriteAnim): void {
    const busy = this.current?.playState === 'running';
    // ไม่ขัดท่าโจมตี/สกิลด้วยท่าโดนตี และไม่ขยับอีกหลังตาย
    if (name === 'hurt' && busy && this.currentName !== 'idle' && this.currentName !== 'hurt') return;
    if (this.currentName === 'die' && name !== 'die' && name !== 'idle') return;

    const a = ANIMS[name];
    const y = (a.row / (SHEET_ROWS - 1)) * 100;
    const x = (i: number) => (i / (SHEET_COLS - 1)) * 100;
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
    if (!loop && !hold) this.current.onfinish = () => this.play(el, 'idle');
  }
}
