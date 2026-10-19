import { AfterViewInit, ChangeDetectionStrategy, Component, computed, ElementRef, input, OnDestroy, output, signal, viewChild } from '@angular/core';
import { heroArt } from '../../core/data/hero-art';
import { PullResult } from '../../core/rules/stars';
import { HeroPortraitComponent } from '../../shared/hero-portrait.component';
import { SummonSanctumComponent } from './summon-sanctum.component';

export type SummonPull = PullResult & { name: string; cls: string };
type Phase = 'charge' | 'burst' | 'cards' | 'spotlight' | 'out';

/** Presentation of a committed transaction. Skipping / revealing never rolls or spends again. */
@Component({
  selector: 'app-summon-scene',
  imports: [HeroPortraitComponent, SummonSanctumComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './summon-scene.component.html',
  styleUrl: './summon-scene.component.scss',
})
export class SummonSceneComponent implements AfterViewInit, OnDestroy {
  readonly results = input.required<SummonPull[]>();
  readonly done = output<void>();
  readonly stage = viewChild.required<ElementRef<HTMLDialogElement>>('stage');
  readonly phase = signal<Phase>('charge');
  readonly index = signal(-1);
  readonly opened = signal<ReadonlySet<number>>(new Set());
  readonly grand = computed(() => this.results().some(r => r.star >= 3));
  readonly current = computed(() => this.results()[this.index()] ?? null);
  readonly banner = computed(() => heroArt(this.current()?.templateId ?? '')?.banner);
  readonly remaining = computed(() => this.results().length - this.opened().size);
  readonly motes = Array.from({ length: 26 }, (_, i) => ({ x: (i * 37) % 100, delay: -(i % 7) * .4, duration: 2 + (i % 5) * .4 }));
  readonly cardBack = (star: number) => star >= 3 ? '/ui/summon-card-3star.jpg' : '/ui/summon-card.jpg';
  readonly flights = computed(() => Array.from({ length: 12 }, (_, i) => ({
    x: Math.cos(i * Math.PI / 6 + .2) * (42 + i % 3 * 12),
    y: Math.sin(i * Math.PI / 6 + .2) * (38 + i % 4 * 10),
    tilt: i * 47 - 190, delay: i % 4 * .065,
    star: this.results()[i % this.results().length]?.star ?? 1,
  })));
  private timers: ReturnType<typeof setTimeout>[] = [];
  private readonly motion = matchMedia('(prefers-reduced-motion: reduce)');
  private readonly onMotion = () => { if (this.motion.matches) this.showCards(); };

  ngAfterViewInit(): void {
    this.stage().nativeElement.showModal();
    this.motion.addEventListener('change', this.onMotion);
    if (this.motion.matches) { this.showCards(); return; }
    this.at(this.grand() ? 1650 : 550, () => this.phase.set('burst'));
    this.at(this.grand() ? 3150 : 2050, () => this.showCards());
  }
  ngOnDestroy(): void {
    this.clearTimers();
    this.motion.removeEventListener('change', this.onMotion);
    this.stage().nativeElement.close();
  }
  private at(ms: number, fn: () => void): void { this.timers.push(setTimeout(fn, ms)); }
  private clearTimers(): void { this.timers.forEach(clearTimeout); this.timers = []; }
  private showCards(): void {
    if (this.phase() !== 'charge' && this.phase() !== 'burst') return;
    this.clearTimers();
    this.phase.set('cards');
  }
  reveal(i: number): void {
    if (this.phase() !== 'cards' || this.opened().has(i) || !this.results()[i]) return;
    this.index.set(i);
    this.opened.update(s => new Set([...s, i]));
    this.phase.set('spotlight');
  }
  revealNext(): void { this.reveal(this.results().findIndex((_, i) => !this.opened().has(i))); }
  continue(): void {
    if (this.phase() !== 'spotlight') return;
    if (this.remaining()) this.phase.set('cards'); else this.finish();
  }
  finish(): void {
    if (this.phase() === 'out') return;
    this.clearTimers();
    this.phase.set('out');
    this.stage().nativeElement.close();
    this.done.emit();
  }
}
