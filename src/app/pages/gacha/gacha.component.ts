import { CitadelIconComponent } from '../../shared/citadel-icon.component';
import { HeroClass } from '../../core/models/hero';
import { SummonCampaign } from './summon-campaign.component';
import { CitadelFrameComponent } from '../../shared/citadel-frame.component';
import { TowerOrnamentComponent } from '../tower/tower-ornament.component';
import { Component, computed, ElementRef, inject, OnDestroy, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { formatCurrency } from '../../shared/format-currency';
import { HERO_BY_ID, HEROES } from '../../core/data/heroes';
import { CLASS_NAME } from '../../core/data/classes';
import { DUPLICATE_MEMORY, GACHA, MAX_STAR, STAR_UP_COST } from '../../core/data/stars';
import { GachaService } from '../../core/services/gacha.service';
import { SaveService } from '../../core/services/save.service';
import { HeroPortraitComponent } from '../../shared/hero-portrait.component';
import { IconComponent } from '../../shared/icon.component';
import { SummonPull } from './summon-scene.component';
import { preloadSummonBook, SummonBookComponent } from './summon-book/summon-book.component';
import { heroArt } from '../../core/data/hero-art';

/**
 * Featured art of the standard pool (illustration only: no rate-up). The epithet / Latin name are display copy for
 * the banner name plate; a missing or unknown hero falls back to the first roster hero that has banner art.
 */
const FEATURED = { id: 'lucien', epithet: 'THE BLACK SAINT', latin: 'Lucien Valthorne' };

/** Summon gate (layout B, user 2026-11-22): full-screen featured banner, pool tabs, pity + ×1/×10. Base rarity 1★–3★ · pity · duplicates → Hero Memory (develop any hero to 6★ on its detail page) */
@Component({
  selector: 'app-gacha',
  imports: [CitadelIconComponent, CitadelFrameComponent, TowerOrnamentComponent, HeroPortraitComponent, IconComponent, RouterLink, SummonBookComponent],
  templateUrl: './gacha.component.html',
  styleUrl: './gacha.component.scss',
})
export class GachaComponent implements OnDestroy {
  private readonly save = inject(SaveService);
  private readonly gacha = inject(GachaService);

  readonly G = GACHA;
  /** warm the summon book scene in the background so pressing summon zooms straight in */
  private readonly warm = typeof window !== 'undefined' ? setTimeout(preloadSummonBook, 1200) : 0;
  get freeSummons(): boolean { return this.gacha.freeSummons; }
  canAfford(n: 1 | 10): boolean { return this.freeSummons || this.gems() >= (n === 10 ? GACHA.multi : GACHA.single); }
  readonly info = signal<'banner' | 'rates' | 'pool' | 'memory' | null>(null);
  readonly showResults = signal(false);
  readonly pending = signal<1 | 10 | null>(null);
  readonly confirmDialog = viewChild.required<ElementRef<HTMLDialogElement>>('confirmDialog');
  readonly pendingCost = computed(() => this.pending() === 10 ? GACHA.multi : GACHA.single);
  readonly lastCount = signal<1 | 10>(1);
  readonly pity = computed(() => this.save.state().pity ?? 0);
  readonly pool = HEROES.map(h => ({ ...h, portrait: heroArt(h.id)?.portrait, className: CLASS_NAME[h.cls] }));
  readonly classIcon = (cls: HeroClass) => ({ tank: 'class-tank', fighter: 'class-fighter', assassin: 'class-assassin', archer: 'class-archer', mage: 'class-mage', healer: 'class-healer' })[cls];
  readonly preview = this.pool.slice(0, 5);
  private readonly featuredId = HERO_BY_ID[FEATURED.id] && heroArt(FEATURED.id)?.banner ? FEATURED.id : HEROES.find(h => heroArt(h.id)?.banner)?.id;
  readonly featured = this.featuredId ? {
    name: HERO_BY_ID[this.featuredId].name,
    epithet: this.featuredId === FEATURED.id ? FEATURED.epithet : '',
    latin: this.featuredId === FEATURED.id ? FEATURED.latin : this.featuredId.charAt(0).toUpperCase() + this.featuredId.slice(1),
  } : null;
  readonly showcase = heroArt(this.featuredId)?.banner;
  private readonly reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** looping banner video while idle; paused out of the DOM during the summon cinematic, still under reduced motion */
  readonly featuredVideo = computed(() => (this.reducedMotion || this.playing() ? undefined : heroArt(this.featuredId)?.bannerVideo));
  readonly campaign: SummonCampaign = { id: 'standard', kind: 'standard', label: 'อัญเชิญปกติ', title: 'เสียงเรียกแห่งดวงดาว', subtitle: 'เหล่าวีรชนแห่งเอลเดอร์เวย์น', art: this.showcase };
  readonly infoDialog = viewChild.required<ElementRef<HTMLDialogElement>>('infoDialog');
  readonly resultsDialog = viewChild.required<ElementRef<HTMLDialogElement>>('resultsDialog');
  openInfo(kind: 'banner' | 'rates' | 'pool' | 'memory'): void {
    this.info.set(kind);
    if (!this.infoDialog().nativeElement.open) this.infoDialog().nativeElement.showModal();
    this.infoDialog().nativeElement.querySelector<HTMLElement>('.modal-body')?.scrollTo(0, 0);
  }
  closeInfo(): void { this.infoDialog().nativeElement.close(); }
  openResults(): void {
    if (!this.results().length || this.playing() || this.pending()) return;
    this.showResults.set(true);
    this.resultsDialog().nativeElement.showModal();
  }
  /** the summon book ends on its own card summary; "ผลครั้งล่าสุด" on the page still opens the results list */
  finishSummon(): void { this.playing.set(false); }
  summonAgain(): void { this.playing.set(false); this.summon(this.lastCount()); }
  readonly MAX_STAR = MAX_STAR;
  readonly gems = computed(() => this.save.state().gems);
  readonly gemsShort = computed(() => formatCurrency(this.gems()));
  private readonly router = inject(Router);
  /** back to the previous in-app page; a direct visit (no history) goes home */
  back(): void {
    if (history.length > 1 && this.router.lastSuccessfulNavigation?.previousNavigation) history.back();
    else this.router.navigateByUrl('/home');
  }
  /** pulls left until the guaranteed 3★ */
  readonly pityLeft = computed(() => GACHA.pity - (this.save.state().pity ?? 0));
  readonly rate3 = Math.round((GACHA.rates[3] ?? 0) * 100);
  readonly rates = Object.entries(GACHA.rates).map(([star, r]) => ({ star: +star, pct: Math.round(r * 100), count: HEROES.filter(h => h.star === +star).length }));
  readonly dupMemory = Object.entries(DUPLICATE_MEMORY).map(([star, m]) => ({ star: +star, m }));
  readonly toSix = Object.values(STAR_UP_COST).slice(2).reduce((a, b) => a + b, 0);

  readonly results = signal<SummonPull[]>([]);
  /** the summon cinematic is playing (results grid shows once it ends / is skipped) */
  readonly playing = signal(false);
  readonly error = signal<string | null>(null);

  summon(n: 1 | 10): void {
    if (this.playing() || this.pending()) return;
    if (!this.canAfford(n)) {
      this.error.set('เพชรไม่พอ');
      return;
    }
    this.resultsDialog().nativeElement.close();
    this.showResults.set(false);
    this.error.set(null);
    this.pending.set(n);
    this.confirmDialog().nativeElement.showModal();
  }
  cancelSummon(): void {
    this.pending.set(null);
    this.confirmDialog().nativeElement.close();
  }
  confirmSummon(): void {
    const n = this.pending();
    if (!n || this.playing()) return;
    // Consume the pending intent before spending; rapid clicks cannot repeat a transaction.
    this.cancelSummon();
    const r = this.gacha.summon(n);
    if (!r) {
      this.error.set('เพชรไม่พอ');
      return;
    }
    this.error.set(null);
    this.info.set(null);
    this.showResults.set(false);
    this.results.set(r.map(x => ({ ...x, name: HERO_BY_ID[x.templateId].name, cls: CLASS_NAME[HERO_BY_ID[x.templateId].cls] })));
    this.lastCount.set(n);
    this.playing.set(true);
  }
  readonly portrait = (id: string) => heroArt(id)?.portrait;
  readonly stars = (n: number) => '★'.repeat(n);
  ngOnDestroy(): void { clearTimeout(this.warm); }
}
