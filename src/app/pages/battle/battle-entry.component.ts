import { afterNextRender, Component, effect, ElementRef, inject, Injector, input, OnDestroy, output, signal, viewChild } from '@angular/core';
import { BATTLE_ENTRY_ART, BattleEntryState } from '../../battle/render/battle-entry-assets';

/** Presentation only. The parent supplies real asset/renderer readiness and owns the engine clock. */
@Component({
  selector: 'app-battle-entry',
  templateUrl: './battle-entry.component.html',
  styleUrl: './battle-entry.component.scss',
})
export class BattleEntryComponent implements OnDestroy {
  readonly state = input.required<BattleEntryState>();
  readonly mapName = input.required<string>();
  readonly stageLabel = input.required<string>();
  readonly completed = output<number>();
  readonly retry = output<void>();
  readonly cancelled = output<void>();
  readonly art = BATTLE_ENTRY_ART;
  readonly motionPhase = signal('waiting');
  readonly sparks = Array.from({ length: 15 }, (_, i) => ({
    x: (i % 2 ? 1 : -1) * (12 + (i * 13) % 47), y: -34 + (i * 11) % 53,
    angle: (i % 2 ? 1 : -1) * (-24 + (i * 17) % 70), size: 2 + (i * 3) % 8, delay: (i % 5) * .07,
  }));
  private readonly left = viewChild<ElementRef<HTMLElement>>('left');
  private readonly right = viewChild<ElementRef<HTMLElement>>('right');
  private readonly shade = viewChild<ElementRef<HTMLElement>>('shade');
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);
  private animations: Animation[] = [];
  private timers: ReturnType<typeof setTimeout>[] = [];
  private generation = 0;
  private playedId: number | null = null;

  constructor() {
    effect(() => {
      const state = this.state();
      if (state.phase !== 'intro') this.stop();
      else if (this.playedId !== state.id) afterNextRender(() => {
        if (this.state().phase === 'intro' && this.state().id === state.id && this.playedId !== state.id) {
          this.playedId = state.id;
          void this.play();
        }
      }, { injector: this.injector });
    });
  }
  get percent(): number { const s = this.state(); return s.total ? Math.min(100, Math.floor(s.done / s.total * 100)) : 0; }
  private later(fn: () => void, ms: number, token: number): void {
    this.timers.push(setTimeout(() => { if (token === this.generation) fn(); }, ms));
  }
  private async play(): Promise<void> {
    if (this.state().phase !== 'intro' || !this.left() || !this.right() || !this.shade()) return;
    const token = ++this.generation;
    const id = this.state().id;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      this.motionPhase.set('glide');
      this.later(() => { this.motionPhase.set('reveal'); this.completed.emit(id); }, 300, token);
      return;
    }
    const width = this.host.nativeElement.clientWidth;
    const pose = (x: number, y: number, direction: number, px = false) => `translate3d(${x * direction}${px ? 'px' : '%'},${y * direction}px,0) skewY(-2deg)`;
    this.motionPhase.set('enter');
    this.animations = [this.left()!, this.right()!].map((ref, i) => {
      const direction = i === 0 ? 1 : -1;
      return ref.nativeElement.animate([
        { offset: 0, transform: pose(-155, 30, direction), opacity: 0, easing: 'linear' },
        { offset: .045, transform: pose(-118, 24, direction), opacity: 1, easing: 'cubic-bezier(.12,.72,.25,1)' },
        { offset: 240 / 1030, transform: pose(-.002 * width, 2, direction, true), opacity: 1, easing: 'linear' },
        { offset: 800 / 1030, transform: pose(.033 * width, -7, direction, true), opacity: 1, easing: 'cubic-bezier(.55,0,.95,.4)' },
        { offset: 1, transform: pose(155, -30, direction), opacity: 0 },
      ], { duration: 1030, fill: 'both' });
    });
    // Start from a fresh presentation frame, not the stale timeline timestamp of a long GPU warm-up frame.
    await Promise.allSettled(this.animations.map(animation => animation.ready));
    if (token !== this.generation) return;
    const start = document.timeline.currentTime;
    this.animations.forEach((animation, i) => { animation.startTime = start; animation.id = `battle-entry-${i}`; });
    this.later(() => this.motionPhase.set('impact'), 240, token);
    this.later(() => this.motionPhase.set('glide'), 390, token);
    this.later(() => this.motionPhase.set('pass'), 800, token);
    await Promise.allSettled(this.animations.map(a => a.finished));
    if (token !== this.generation) return;
    this.motionPhase.set('reveal');
    const fade = this.shade()!.nativeElement.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
    this.animations.push(fade);
    await fade.finished.catch(() => undefined);
    if (token === this.generation) this.completed.emit(id);
  }
  private stop(): void {
    this.generation++;
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.animations.forEach(a => a.cancel());
    this.animations = [];
    this.motionPhase.set('waiting');
    this.playedId = null;
  }
  ngOnDestroy(): void { this.stop(); }
}
