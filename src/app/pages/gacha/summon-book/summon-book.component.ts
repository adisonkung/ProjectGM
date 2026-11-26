import { HeroStarsComponent } from '../../../shared/hero-stars.component';
import { SummonButtonComponent } from '../summon-button.component';
import { IconComponent } from '../../../shared/icon.component';
import { AfterViewInit, ChangeDetectionStrategy, Component, computed, ElementRef, input, OnChanges, OnDestroy, output, signal, viewChild } from '@angular/core';
import { CLASS_NAME } from '../../../core/data/classes';
import { HERO_BY_ID } from '../../../core/data/heroes';
import { heroArt } from '../../../core/data/hero-art';
import { SummonPull, SummonSceneComponent } from '../summon-scene.component';
import type { BookCard, BookSceneHandle } from './book-scene';
import { heroIntro } from './hero-intro';
import { BOOK_ART_DIR } from './book-assets';
import { preloadBookImages, loadBookImage } from './book-preload';

/** share of 3★ pulls that play the blue-then-gold suspense version of the trace */
export const SUSPENSE_CHANCE = 0.35;
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
  imports: [HeroStarsComponent, SummonSceneComponent, SummonButtonComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './summon-book.component.html',
  styleUrl: './summon-book.component.scss',
})
export class SummonBookComponent implements AfterViewInit, OnChanges, OnDestroy {
  /** Prepare on route entry, but open only after the page commits a real pull. */
  readonly active = input(true);
  readonly canRepeat = input(true);
  readonly results = input.required<SummonPull[]>();
  /** test hook: force (or forbid) the blue-then-gold version */
  readonly suspense = input<boolean | null>(null);
  /** back to the summon page */
  readonly done = output<void>();
  /** summon again with the same count (the page asks for confirmation as usual) */
  readonly again = output<void>();
  readonly fallback = signal(typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  readonly loading = signal(true);
  readonly finished = signal(false);
  readonly repeatCount = computed<1 | 10>(() => this.results().length === 10 ? 10 : 1);
  readonly stage = viewChild<ElementRef<HTMLDialogElement>>('stage');
  readonly host = viewChild<ElementRef<HTMLElement>>('host');
  private handle: BookSceneHandle | null = null;
  private destroyed = false;
  private closed = false;
  private skipWhenReady = false;
  private viewReady = false;
  private generation = 0;
  private presented = false;

  ngOnChanges(): void {
    if (!this.viewReady) return;
    if (this.active()) this.present();
    else if (this.presented || this.closed) {
      this.generation++;
      this.handle?.dispose(); this.handle = null;
      this.stage()?.nativeElement.close();
      this.closed = this.presented = this.skipWhenReady = false;
      this.loading.set(true); this.finished.set(false);
      if (!this.fallback()) void this.mount();
    }
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    if (this.fallback()) return;
    void this.mount();
  }

  private async mount(): Promise<void> {
    const host = this.host()?.nativeElement, root = this.stage()?.nativeElement;
    if (!host || !root) return;
    const generation = ++this.generation;
    const q = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
    try {
      const [{ mountBookScene }] = await Promise.all([import('./book-scene'), preloadBookImages()]);
      if (this.destroyed || generation !== this.generation) return;
      const handle = await mountBookScene(host, {
        cards: [], suspense: false, prepared: true, asset: f => BOOK_ART_DIR + f,
        overlay: { cine: q('.cine'), cineQuote: q('.cine-quote'), cineBan: q('.cine-ban'), cineImg: q('.cine-ban img'), cineEp: q('.cine-ep'), cineTh: q('.cine-th'), cineEn: q('.cine-en'), cineTap: q('.cine-tap'), cap: q('.cap'), hint: q('.hint'), summon: q('.summon') },
        onFinished: () => this.finished.set(true),
      });
      if (this.destroyed || generation !== this.generation) { handle.dispose(); return; }
      this.handle = handle;
      this.loading.set(false);
      this.present();
    } catch {
      // no WebGL (or the chunk failed): the 2D scene shows the same results
      if (this.destroyed || generation !== this.generation) return;
      this.stage()?.nativeElement.close();
      this.fallback.set(true);
    }
  }

  private present(): void {
    if (!this.active() || !this.results().length || !this.handle || this.presented || this.closed) return;
    this.presented = true;
    const cards = bookCards(this.results());
    const top = Math.max(...cards.map(c => c.star));
    this.handle.present(cards, this.suspense() ?? (top >= 3 && Math.random() < SUSPENSE_CHANCE));
    // Intro banners have the room/trace/card sequence to decode before they are revealed.
    for (const card of cards) if (card.banner) void loadBookImage(card.banner).catch(() => {});
    this.stage()?.nativeElement.showModal();
    if (this.skipWhenReady) this.handle.skip();
  }

  /** jump to the summary: every card face up, the two summary buttons showing */
  skip(): void {
    if (this.handle) this.handle.skip(); else this.skipWhenReady = true;
  }
  /** close and go back to the summon page */
  back(): void { if (this.close()) this.done.emit(); }
  /** close and summon again */
  summonAgain(): void { if (this.close()) this.again.emit(); }
  private close(): boolean {
    if (this.closed) return false;
    this.closed = true;
    this.handle?.dispose();
    this.handle = null;
    this.stage()?.nativeElement.close();
    return true;
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.generation++;
    this.handle?.dispose();
    this.handle = null;
    const d = this.stage()?.nativeElement;
    if (d?.open) d.close();
  }
}
