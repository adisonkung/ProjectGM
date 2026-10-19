import { Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HERO_BY_ID, HEROES } from '../../core/data/heroes';
import { CLASS_NAME } from '../../core/data/classes';
import { DUPLICATE_MEMORY, GACHA, MAX_STAR, STAR_UP_COST } from '../../core/data/stars';
import { GachaService } from '../../core/services/gacha.service';
import { SaveService } from '../../core/services/save.service';
import { HeroPortraitComponent } from '../../shared/hero-portrait.component';
import { IconComponent } from '../../shared/icon.component';
import { SummonPull, SummonSceneComponent } from './summon-scene.component';
import { heroArt } from '../../core/data/hero-art';
import { SummonSanctumComponent } from './summon-sanctum.component';

/** Summon gate: base rarity 1★–3★ · pity · duplicates → Hero Memory (develop any hero to 6★ on its detail page) */
@Component({
  selector: 'app-gacha',
  imports: [HeroPortraitComponent, IconComponent, RouterLink, SummonSceneComponent, SummonSanctumComponent],
  templateUrl: './gacha.component.html',
  styleUrl: './gacha.component.scss',
})
export class GachaComponent {
  private readonly save = inject(SaveService);
  private readonly gacha = inject(GachaService);

  readonly G = GACHA;
  readonly info = signal<'rates' | 'pool' | 'memory' | null>(null);
  readonly showResults = signal(false);
  readonly pity = computed(() => this.save.state().pity ?? 0);
  readonly pool = HEROES.map(h => ({ ...h, portrait: heroArt(h.id)?.portrait, className: CLASS_NAME[h.cls] }));
  readonly preview = this.pool.slice(0, 5);
  readonly showcase = heroArt(HEROES[0]?.id)?.banner;
  readonly infoDialog = viewChild.required<ElementRef<HTMLDialogElement>>('infoDialog');
  readonly resultsDialog = viewChild.required<ElementRef<HTMLDialogElement>>('resultsDialog');
  openInfo(kind: 'rates' | 'pool' | 'memory'): void {
    this.info.set(kind);
    this.infoDialog().nativeElement.showModal();
  }
  closeInfo(): void { this.infoDialog().nativeElement.close(); }
  openResults(): void {
    if (!this.results().length || this.playing()) return;
    this.showResults.set(true);
    this.resultsDialog().nativeElement.showModal();
  }
  finishSummon(): void { this.playing.set(false); this.openResults(); }
  readonly MAX_STAR = MAX_STAR;
  readonly gems = computed(() => this.save.state().gems);
  /** pulls left until the guaranteed 3★ */
  readonly pityLeft = computed(() => GACHA.pity - (this.save.state().pity ?? 0));
  readonly rates = Object.entries(GACHA.rates).map(([star, r]) => ({ star: +star, pct: Math.round(r * 100), count: HEROES.filter(h => h.star === +star).length }));
  readonly dupMemory = Object.entries(DUPLICATE_MEMORY).map(([star, m]) => ({ star: +star, m }));
  readonly toSix = Object.values(STAR_UP_COST).slice(2).reduce((a, b) => a + b, 0);

  readonly results = signal<SummonPull[]>([]);
  /** the summon cinematic is playing (results grid shows once it ends / is skipped) */
  readonly playing = signal(false);
  readonly error = signal<string | null>(null);

  summon(n: 1 | 10): void {
    if (this.playing()) return;
    const r = this.gacha.summon(n);
    if (!r) {
      this.error.set('เพชรไม่พอ');
      return;
    }
    this.error.set(null);
    this.info.set(null);
    this.showResults.set(false);
    this.results.set(r.map(x => ({ ...x, name: HERO_BY_ID[x.templateId].name, cls: CLASS_NAME[HERO_BY_ID[x.templateId].cls] })));
    this.playing.set(true);
  }
  readonly stars = (n: number) => '★'.repeat(n);
}
