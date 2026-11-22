import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, input, OnDestroy, output, signal, viewChild } from '@angular/core';
import { CLASS_NAME } from '../../../core/data/classes';
import { HERO_BY_ID } from '../../../core/data/heroes';
import { heroArt } from '../../../core/data/hero-art';
import { SummonPull, SummonSceneComponent } from '../summon-scene.component';
import type { BookCard, BookSceneHandle } from './book-scene';
import { heroIntro } from './hero-intro';

/** share of 3★ pulls that play the blue-then-gold suspense version of the trace */
export const SUSPENSE_CHANCE = 0.35;
const ASSET_DIR = '/ui/summon-book/';
const url = (p?: string) => (!p ? '' : /^(\/|https?:)/.test(p) ? p : '/' + p);

/** The pull's cards as the book scene draws them (pure, tested). */
export function bookCards(results: readonly SummonPull[]): BookCard[] {
  return results.map(r => {
    const t = HERO_BY_ID[r.templateId], intro = heroIntro(r.templateId), art = heroArt(r.templateId);
    return { star: r.star, id: r.templateId, th: t?.name ?? r.name, en: intro.en, cls: t ? CLASS_NAME[t.cls] : r.cls, epithet: intro.epithet, quote: intro.quote, portrait: url(art?.portrait), banner: url(art?.banner) || undefined };
  });
}

/**
 * Summon opening "Book of Heroes · Astral Archive" (user-approved 2.5D animatic, 2026-11-22): the book floats over the
 * dais, light traces its cover (blue = no 3★, gold = 3★, sometimes blue that bursts into gold), it shakes and bursts
 * into the sky, then the cards fall; every 3★ card waits for a tap and plays the hero's intro. Presentation of a
 * committed transaction only: skipping never rolls or spends. No WebGL or reduced motion → the 2D summon scene.
 */
@Component({
  selector: 'app-summon-book',
  imports: [SummonSceneComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './summon-book.component.html',
  styleUrl: './summon-book.component.scss',
})
export class SummonBookComponent implements AfterViewInit, OnDestroy {
  readonly results = input.required<SummonPull[]>();
  /** test hook: force (or forbid) the blue-then-gold version */
  readonly suspense = input<boolean | null>(null);
  readonly done = output<void>();
  readonly fallback = signal(typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  readonly loading = signal(true);
  readonly finished = signal(false);
  readonly stage = viewChild<ElementRef<HTMLDialogElement>>('stage');
  readonly host = viewChild<ElementRef<HTMLElement>>('host');
  private handle: BookSceneHandle | null = null;
  private destroyed = false;
  private closed = false;

  ngAfterViewInit(): void {
    if (this.fallback()) return;
    this.stage()?.nativeElement.showModal();
    void this.mount();
  }

  private async mount(): Promise<void> {
    const host = this.host()?.nativeElement, root = this.stage()?.nativeElement;
    if (!host || !root) return;
    const q = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
    try {
      const { mountBookScene } = await import('./book-scene');
      if (this.destroyed) return;
      const top = Math.max(...this.results().map(r => r.star));
      const suspense = this.suspense() ?? (top >= 3 && Math.random() < SUSPENSE_CHANCE);
      this.handle = await mountBookScene(host, {
        cards: bookCards(this.results()), suspense, asset: f => ASSET_DIR + f,
        overlay: { cine: q('.cine'), cineQuote: q('.cine-quote'), cineBan: q('.cine-ban'), cineImg: q('.cine-ban img'), cineEp: q('.cine-ep'), cineTh: q('.cine-th'), cineEn: q('.cine-en'), cineTap: q('.cine-tap'), cap: q('.cap'), hint: q('.hint') },
        onFinished: () => this.finished.set(true),
      });
      if (this.destroyed) { this.handle.dispose(); this.handle = null; return; }
      this.loading.set(false);
    } catch {
      // no WebGL (or the chunk failed): the 2D scene shows the same results
      if (this.destroyed) return;
      this.stage()?.nativeElement.close();
      this.fallback.set(true);
    }
  }

  finish(): void {
    if (this.closed) return;
    this.closed = true;
    this.handle?.dispose();
    this.handle = null;
    this.stage()?.nativeElement.close();
    this.done.emit();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.handle?.dispose();
    this.handle = null;
    const d = this.stage()?.nativeElement;
    if (d?.open) d.close();
  }
}
