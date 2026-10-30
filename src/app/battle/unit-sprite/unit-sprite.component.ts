import { unitGeometry } from '../render/unit-geometry';
import { spriteUrl } from '../../core/data/sprite-files';
import { Component, ElementRef, computed, effect, inject, input, untracked, viewChild } from '@angular/core';
import { ANIM_FALLBACK, FRAME_MS, IDLE_FRAME_MS, SHEETS, SheetDef, SpriteAnim } from '../../core/data/sprites';
import { MockVisual } from '../../core/data/visuals';
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
  /** token icon override (e.g. 'wolf'); default = class icon */
  readonly icon = input<string | undefined>(undefined);
  /** placeholder shape for monsters without art (core/data/visuals.ts) */
  readonly mock = input<MockVisual | undefined>(undefined);
  readonly anim = input<SpriteAnim>('idle');
  /** เปลี่ยนค่านี้เพื่อสั่งเล่นท่าเดิมซ้ำ */
  readonly animKey = input(0);
  readonly speed = input(1);
  /** หันซ้าย (แผ่น sprite วาดหันขวา) */
  readonly flip = input(false);
  /** ท่า `cast`: เวลาร่าย (วินาทีเกม) — เฟรม CAST_START→SKILL_ACTIVATE ยืดให้พอดี */
  readonly castTime = input<number | undefined>();
  /** ท่า `cast`: clip ของสกิลที่กำลังร่าย (แผ่นที่มีหลายท่าร่าย) */
  readonly castClip = input<string | undefined>();
  /** เล่นทับท่าที่กำลังเล่นอยู่ (เช่น ถูกตัดร่าย → ท่าโดนตีทันที) */
  readonly force = input(false);
  /**
   * กำลังเดินอยู่ไหม (หน้า battle คิดจากตำแหน่งที่เปลี่ยนทุก tick): กำหนดค่า = ท่าเดินวนต่อเนื่องตราบที่ยังเดิน
   * (ไม่เริ่มรอบใหม่ทุกก้าว) แล้วกลับท่ายืนตอนหยุด · ท่าโจมตี/สกิลจบระหว่างเดิน → เดินต่อ · ไม่กำหนด = ท่าเดินแบบเล่นรอบเดียว (sprite lab)
   */
  readonly moving = input<boolean | undefined>(undefined);
  /** ground speed while walking (cells / game s): the walk cycle plays at pace / AnimDef.pace (feet keep up with the ground) */
  readonly pace = input<number | undefined>(undefined);

  readonly sheet = viewChild<ElementRef<HTMLElement>>('sheet');
  readonly rarity = computed(() => `var(--r${this.star() ?? 1})`);
  readonly def = computed<SheetDef | undefined>(() => SHEETS[this.sprite() ?? '']);
  /** the optimised file the game serves (core/data/sprite-files.ts) */
  readonly geometry = computed(() => unitGeometry(this.def() ?? {}));
  readonly url = computed(() => spriteUrl(this.sprite() ?? ''));
  readonly bgSize = computed(() => {
    const d = this.def();
    return d ? `${d.cols * 100}% ${d.rows * 100}%` : null;
  });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private current?: Animation;
  /** เริ่มท่ายืนคนละจังหวะ ทุกตัวจะได้ไม่หายใจพร้อมกัน */
  private readonly phase = Math.random();
  private motion?: Animation;
  /** runtime opacity curve of the playing clip (AnimDef.opacity) */
  private fade?: Animation;
  /** runtime root motion of the playing clip (AnimDef.root) */
  private lift?: Animation;
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
    // the walk cycle follows the ground speed (smoothly, no restart)
    effect(() => {
      this.pace();
      untracked(() => this.syncWalkRate());
    });
    // start / stop the walk loop with the movement (only when the parent drives `moving`)
    effect(() => {
      const m = this.moving();
      const el = this.sheet()?.nativeElement;
      const def = this.def();
      untracked(() => {
        if (m === undefined || !el || !def) return;
        if (m && this.currentName === 'idle') this.play(el, def, 'walk');
        else if (!m && this.currentName === 'walk') this.play(el, def, 'idle');
        if (m && !def.anims.walk) this.bob(true);
        else if (!m) this.bob(false);
      });
    });
  }

  /** walk loop rate = real ground speed / the pace the cycle was drawn for (clamped: never frozen, never a blur) */
  private walkRate(): number {
    const p = this.pace();
    const ref = this.def()?.anims.walk?.pace;
    return ref == null || p == null || p <= 0 ? 1 : Math.min(1.7, Math.max(0.55, p / ref));
  }
  private syncWalkRate(): void {
    if (this.currentName !== 'walk' || this.moving() === undefined || !this.current) return;
    const r = this.walkRate();
    // setting playbackRate keeps the current time: the cycle continues from the same pose, only faster / slower
    if (Math.abs(this.current.playbackRate - r) > 0.03) this.current.playbackRate = r;
  }

  /** sheets without a walk row: bounce the whole body while moving (looping) */
  private bobbing = false;
  private bob(on: boolean): void {
    if (on === this.bobbing || typeof this.host.nativeElement.animate !== 'function') return;
    this.bobbing = on;
    this.motion?.cancel();
    if (on) this.motion = this.host.nativeElement.animate(MOTION.walk!.frames, { duration: MOTION.walk!.ms / this.speed(), iterations: Infinity });
  }

  /** what to fall back to when an action clip ends */
  private rest(): SpriteAnim {
    return this.moving() ? 'walk' : 'idle';
  }

  /** ขยับทั้งตัวเมื่อแผ่นไม่มีท่านั้น (ไม่มีแผ่นเลย = ใช้ทุกท่า, มีแผ่น = เฉพาะท่าเดิน) */
  private move(def: SheetDef | undefined, name: SpriteAnim): void {
    if (def?.anims[name] || (def && name !== 'walk')) return;
    if (name === 'walk' && this.moving() !== undefined) return; // movement-driven bounce (bob)
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
    // movement-driven walk: never restart the cycle on every step, and no walk while standing still
    if (name === 'walk' && this.moving() !== undefined) {
      if (!this.moving() || (this.currentName === 'walk' && busy)) return;
    }
    if (!this.force() && LOW.includes(name) && name !== 'idle' && busy && !LOW.includes(this.currentName)) return;
    // ไม่ขยับอีกหลังตาย (ยกเว้นรีเซ็ตกลับท่ายืน)
    if (this.currentName === 'die' && name !== 'die' && name !== 'idle') return;

    const a = (name === 'cast' && def.casts?.[this.castClip() ?? '']) || def.anims[name]!;
    const y = def.rows > 1 ? (a.row / (def.rows - 1)) * 100 : 0;
    const x = (i: number) => (i / (def.cols - 1)) * 100;
    const hold = name === 'die';
    const loop = name === 'idle';
    const walkLoop = name === 'walk' && this.moving() !== undefined;
    const frames = hold ? a.frames - 1 : a.frames;

    this.current?.cancel();
    this.fade?.cancel();
    this.fade = undefined;
    this.lift?.cancel();
    this.lift = undefined;
    this.currentName = name;
    if (name === 'cast' && a.castStart != null && a.activate != null) {
      this.playCast(el, def, a, x, y);
      return;
    }
    if (loop) {
      this.playIdle(el, a.seq ?? Array.from({ length: a.frames }, (_, i) => i), a.ms ?? IDLE_FRAME_MS, x, y);
      return;
    }
    if (a.seq && a.steps) {
      this.playSteps(el, def, a.seq, a.steps, x, y, hold);
      if (a.opacity?.length) this.playFade(el, a.steps, a.opacity);
      if (a.root?.length) this.playRoot(el, def, a.steps, a.root);
      return;
    }
    this.current = el.animate(
      [{ backgroundPosition: `0% ${y}%` }, { backgroundPosition: `${x(frames)}% ${y}%` }],
      {
        duration: (a.frames * (a.ms ?? FRAME_MS)) / this.speed(),
        easing: `steps(${frames})`,
        iterations: walkLoop ? Infinity : 1,
        fill: hold ? 'forwards' : 'none',
      },
    );
    if (walkLoop) this.current.playbackRate = this.walkRate();
    if (!hold && !walkLoop) this.current.onfinish = () => this.play(el, def, this.rest());
  }

  /**
   * ท่ายืน: ช้ากว่าท่าอื่น ไม่เร่งตามความเร็วการต่อสู้ และเล่นตามลำดับ `seq`
   * (เฟรมยืนจากแผ่น AI ไม่ต่อเนื่องกันทุกเฟรม — ตัดเฟรมที่กระตุกออก เรียงให้ต่างกันน้อยที่สุด)
   * ไม่เฟดซ้อนเฟรม เพราะจะเห็นเป็นภาพซ้อน
   */
  /**
   * ท่าร่ายของมอนสเตอร์ (castTimeline): เฟรม CAST_START ขึ้นทันที, เฟรมถึง SKILL_ACTIVATE ยืดให้ครบเวลาร่าย,
   * แล้วเล่นเฟรมที่เหลือ (ฟื้นตัว) ตามจังหวะปกติ — จบแล้วกลับท่ายืน
   */
  private playCast(el: HTMLElement, def: SheetDef, a: NonNullable<SheetDef['anims']['cast']>, x: (i: number) => number, y: number): void {
    const spd = this.speed();
    const ms = a.ms ?? FRAME_MS;
    const cast = (this.castTime() ?? ((a.activate! - a.castStart!) * ms) / 1000) * 1000;
    const per = a.activate! > a.castStart! ? cast / (a.activate! - a.castStart!) : 0;
    const steps: { f: number; t: number }[] = [];
    let t = 0;
    for (let f = a.castStart!; f < a.frames; f++) {
      steps.push({ f, t });
      t += f < a.activate! ? per : ms;
    }
    const total = t / spd;
    const k: Keyframe[] = steps.map(s => ({ offset: s.t / t, easing: 'steps(1, end)', backgroundPosition: `${x(s.f)}% ${y}%` }));
    k.push({ offset: 1, backgroundPosition: `${x(a.frames - 1)}% ${y}%` });
    this.current = el.animate(k, { duration: total, iterations: 1 });
    this.current.onfinish = () => this.play(el, def, this.rest());
  }

  /** choreographed action clip (AnimDef.seq + steps): each key pose held for its own time, then back to idle */
  private playSteps(el: HTMLElement, def: SheetDef, seq: number[], steps: number[], x: (i: number) => number, y: number, hold: boolean): void {
    const total = steps.reduce((a, b) => a + b, 0);
    let t = 0;
    const k: Keyframe[] = seq.map((f, i) => {
      const kf = { offset: t / total, easing: 'steps(1, end)', backgroundPosition: `${x(f)}% ${y}%` };
      t += steps[i] ?? 0;
      return kf;
    });
    k.push({ offset: 1, backgroundPosition: `${x(seq[seq.length - 1])}% ${y}%` });
    this.current = el.animate(k, { duration: total / this.speed(), iterations: 1, fill: hold ? 'forwards' : 'none' });
    if (!hold) this.current.onfinish = () => this.play(el, def, this.rest());
  }

  /** step position (fractions ok) → ms from the clip start, and the clip length */
  private stepClock(steps: number[]): { at: (i: number) => number; total: number } {
    const starts = [0];
    for (const ms of steps) starts.push(starts[starts.length - 1] + ms);
    const total = starts[starts.length - 1];
    const at = (i: number) => {
      const k = Math.min(Math.max(Math.floor(i), 0), steps.length);
      return Math.min(total, starts[k] + (k < steps.length ? (i - k) * steps[k] : 0));
    };
    return { at, total };
  }

  /** AnimDef.root: [step, dx, dy] atlas px → `translate` of the sheet (outside its flip transform → dx mirrored here) */
  private playRoot(el: HTMLElement, def: SheetDef, steps: number[], keys: [number, number, number][]): void {
    const { at, total } = this.stepClock(steps);
    const sx = this.flip() ? -1 : 1;
    const tr = (dx: number, dy: number) => `${((sx * dx) / (def.cellW ?? 132)) * 100}% ${(dy / (def.cellH ?? 100)) * 100}%`;
    const k = keys.map(([i, dx, dy]) => ({ offset: at(i) / total, translate: tr(dx, dy) })).sort((p, q) => p.offset - q.offset);
    if (k[0].offset > 0) k.unshift({ offset: 0, translate: k[0].translate });
    if (k[k.length - 1].offset < 1) k.push({ offset: 1, translate: k[k.length - 1].translate });
    this.lift = el.animate(k, { duration: total / this.speed(), iterations: 1 });
  }

  /** AnimDef.opacity: [step, opacity] keys → one opacity animation over the clip (steps = same clock as the frames) */
  private playFade(el: HTMLElement, steps: number[], keys: [number, number][]): void {
    const starts = [0];
    for (const ms of steps) starts.push(starts[starts.length - 1] + ms);
    const total = starts[starts.length - 1];
    const at = (i: number) => {
      const k = Math.min(Math.max(Math.floor(i), 0), steps.length);
      return Math.min(total, starts[k] + (k < steps.length ? (i - k) * steps[k] : 0));
    };
    const k = keys.map(([i, o]) => ({ offset: at(i) / total, opacity: o })).sort((p, q) => p.offset - q.offset);
    if (k[0].offset > 0) k.unshift({ offset: 0, opacity: k[0].opacity });
    if (k[k.length - 1].offset < 1) k.push({ offset: 1, opacity: k[k.length - 1].opacity });
    this.fade = el.animate(k, { duration: total / this.speed(), iterations: 1 });
  }

  private playIdle(el: HTMLElement, order: number[], ms: number, x: (i: number) => number, y: number): void {
    const n = order.length;
    const duration = n * ms;
    const k: Keyframe[] = order.map((f, i) => ({ offset: i / n, easing: 'steps(1, end)', backgroundPosition: `${x(f)}% ${y}%` }));
    k.push({ offset: 1, backgroundPosition: `${x(order[n - 1])}% ${y}%` });
    this.current = el.animate(k, { duration, iterations: Infinity });
    this.current.currentTime = this.phase * duration;
  }
}
