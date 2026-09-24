import { Component, ElementRef, computed, effect, inject, input, untracked, viewChild } from '@angular/core';
import { ANIM_FALLBACK, FRAME_MS, IDLE_FRAME_MS, SHEETS, SheetDef, SpriteAnim } from '../../core/data/sprites';
import { HeroClass } from '../../core/models/hero';
import { Side } from '../../core/models/unit';

export type { SpriteAnim } from '../../core/data/sprites';

/** ท่าที่ขัดท่าอื่นไม่ได้ (เดิน/โดนตี จะไม่แทรกท่าโจมตีหรือสกิล) */
const LOW: SpriteAnim[] = ['idle', 'walk', 'hurt'];

/**
 * ท่าขยับทั้งตัว (ใช้ translate/scale/filter ของ host) สำหรับตัวที่ไม่มีแถวท่านั้นในแผ่น:
 * เดินแบบกระเด้ง และท่าโจมตี/สกิล/โดนตีของโทเคนที่ยังไม่มี sprite
 */
const MOTION: Partial<Record<SpriteAnim, { frames: Keyframe[]; ms: number }>> = {
  walk: { frames: [{ translate: '0 0' }, { translate: '0 -9%' }, { translate: '0 0' }], ms: 300 },
  attack: { frames: [{ scale: '1' }, { scale: '1.14' }, { scale: '1' }], ms: 200 },
  skill: { frames: [{ scale: '1', filter: 'none' }, { scale: '1.25', filter: 'brightness(1.8)' }, { scale: '1', filter: 'none' }], ms: 380 },
  hurt: { frames: [{ filter: 'brightness(2.4)', translate: '3% 0' }, { filter: 'none', translate: '0 0' }], ms: 180 },
};
MOTION.skill2 = MOTION.skill;
MOTION.ult = { ...MOTION.skill!, ms: 560 };

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
  /** หันซ้าย (แผ่น sprite วาดหันขวา) */
  readonly flip = input(false);

  readonly sheet = viewChild<ElementRef<HTMLElement>>('sheet');
  /** ชั้นที่สองสำหรับท่ายืน: แสดงเฟรมถัดไปแล้วค่อย ๆ เฟดเข้า ให้การหายใจลื่นขึ้น */
  readonly blend = viewChild<ElementRef<HTMLElement>>('blend');
  readonly rarity = computed(() => `var(--r${this.star() ?? 1})`);
  readonly def = computed<SheetDef | undefined>(() => SHEETS[this.sprite() ?? '']);
  readonly bgSize = computed(() => {
    const d = this.def();
    return d ? `${d.cols * 100}% ${d.rows * 100}%` : null;
  });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private current?: Animation;
  private blendAnims: Animation[] = [];
  /** เริ่มท่ายืนคนละจังหวะ ทุกตัวจะได้ไม่หายใจพร้อมกัน */
  private readonly phase = Math.random();
  private motion?: Animation;
  private currentName: SpriteAnim = 'idle';

  constructor() {
    effect(() => {
      const name = this.anim();
      this.animKey();
      const el = this.sheet()?.nativeElement;
      const def = this.def();
      untracked(() => {
        if (el && def) this.play(el, def, name);
        this.move(def, name);
      });
    });
  }

  /** ขยับทั้งตัวเมื่อแผ่นไม่มีท่านั้น (ไม่มีแผ่นเลย = ใช้ทุกท่า, มีแผ่น = เฉพาะท่าเดิน) */
  private move(def: SheetDef | undefined, name: SpriteAnim): void {
    if (def?.anims[name] || (def && name !== 'walk')) return;
    const m = MOTION[name];
    if (!m || typeof this.host.nativeElement.animate !== 'function') return;
    this.motion?.cancel();
    this.motion = this.host.nativeElement.animate(m.frames, { duration: m.ms / this.speed(), easing: 'ease-out' });
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
    this.stopBlend();
    this.currentName = name;
    if (loop) {
      this.playIdle(el, a.frames, a.ms ?? IDLE_FRAME_MS, x, y);
      return;
    }
    this.current = el.animate(
      [{ backgroundPosition: `0% ${y}%` }, { backgroundPosition: `${x(frames)}% ${y}%` }],
      {
        duration: (a.frames * (a.ms ?? FRAME_MS)) / this.speed(),
        easing: `steps(${frames})`,
        iterations: 1,
        fill: hold ? 'forwards' : 'none',
      },
    );
    if (!hold) this.current.onfinish = () => this.play(el, def, 'idle');
  }

  /**
   * ท่ายืน: ช้ากว่าท่าอื่น (ไม่เร่งตามความเร็วการต่อสู้) และเฟดเฟรมถัดไปทับทีละน้อย
   * ชั้นล่างโชว์เฟรม i, ชั้นบนโชว์เฟรม i+1 แล้วค่อย ๆ ชัดขึ้นจนถึงเวลาเปลี่ยนเฟรม
   */
  private playIdle(el: HTMLElement, n: number, ms: number, x: (i: number) => number, y: number): void {
    const duration = n * ms;
    const steps = (shift: number): Keyframe[] => {
      const k: Keyframe[] = [];
      for (let i = 0; i < n; i++) {
        k.push({ offset: i / n, easing: 'steps(1, end)', backgroundPosition: `${x((i + shift) % n)}% ${y}%` });
      }
      k.push({ offset: 1, backgroundPosition: `${x((n - 1 + shift) % n)}% ${y}%` });
      return k;
    };
    const start = this.phase * duration;
    this.current = el.animate(steps(0), { duration, iterations: Infinity });
    this.current.currentTime = start;
    const blend = this.blend()?.nativeElement;
    if (!blend || n < 2) return;
    const pos = blend.animate(steps(1), { duration, iterations: Infinity });
    const fade = blend.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms, iterations: Infinity, easing: 'ease-in-out' });
    pos.currentTime = start;
    fade.currentTime = start;
    this.blendAnims = [pos, fade];
  }

  private stopBlend(): void {
    for (const a of this.blendAnims) a.cancel();
    this.blendAnims = [];
  }
}
