import { HeroStarsComponent } from '../../shared/hero-stars.component';
import { summonCardBack } from './summon-card-art';
import { SummonAltarComponent } from './summon-altar.component';
import { SUMMON_TIMING } from './summon-cinematic';
import { SummonFlightComponent } from './summon-flight.component';
import { TowerOrnamentComponent } from '../tower/tower-ornament.component';
import { AfterViewInit, ChangeDetectionStrategy, Component, computed, ElementRef, input, OnDestroy, output, signal, viewChild } from '@angular/core';
import { heroArt } from '../../core/data/hero-art';
import { PullResult } from '../../core/rules/stars';
import { HeroPortraitComponent } from '../../shared/hero-portrait.component';

export type SummonPull = PullResult & { name: string; cls: string };
type Phase = 'charge' | 'burst' | 'cards' | 'spotlight' | 'out';

/** Presentation of a committed transaction. Skipping / revealing never rolls or spends again. */
@Component({
  selector: 'app-summon-scene',
  imports: [HeroStarsComponent, SummonAltarComponent, SummonFlightComponent, TowerOrnamentComponent, HeroPortraitComponent],
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
  readonly timing = computed(() => this.grand() ? SUMMON_TIMING.grand : SUMMON_TIMING.ordinary);
  readonly opening = computed(() => this.phase() === 'charge' || this.phase() === 'burst');
  readonly current = computed(() => this.results()[this.index()] ?? null);
  readonly banner = computed(() => heroArt(this.current()?.templateId ?? '')?.banner);
  readonly remaining = computed(() => this.results().length - this.opened().size);
  readonly cardBack = summonCardBack;
  readonly flightStars = computed(() => this.results().map(r => r.star));
  private timers: ReturnType<typeof setTimeout>[] = [];
  private readonly motion = matchMedia('(prefers-reduced-motion: reduce)');
  private readonly onMotion = () => { if (this.motion.matches) this.showCards(); };

  ngAfterViewInit(): void {
    this.stage().nativeElement.showModal();
    this.motion.addEventListener('change', this.onMotion);
    if (this.motion.matches) { this.showCards(); return; }
    const { charge, burst } = this.timing();
    this.at(charge, () => this.phase.set('burst'));
    this.at(charge + burst, () => this.showCards());
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
