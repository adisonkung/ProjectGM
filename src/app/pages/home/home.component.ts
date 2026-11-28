import { A11yModule } from '@angular/cdk/a11y';
import { Component, computed, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DAILY_BONUS } from '../../core/data/economy';
import { HERO_ART, heroArt } from '../../core/data/hero-art';
import { HEROES } from '../../core/data/heroes';
import { STAGES } from '../../core/data/stages';
import { dailyBonusLeft, ensureDaily } from '../../core/rules/rewards';
import { AccountService } from '../../core/services/account.service';
import { IslandService } from '../../core/services/island.service';
import { RosterService } from '../../core/services/roster.service';
import { SaveService } from '../../core/services/save.service';
import { formatCurrency } from '../../shared/format-currency';
import { HOME_EVENTS, HomeEvent, MENU_TILES, MenuTile, MOCK_MAIL, WORLD_BOSS } from './home-mock';
import { HomeBagComponent } from './home-bag.component';
import { HomeCardArtComponent } from './home-card-art.component';
import { HomeIconComponent } from './home-icon.component';
import { HomeMotionDirective } from './home-motion.directive';
import { LineIconComponent } from './line-icon.component';

/** layout is authored on a 1600 × 900 board and scaled to the window (landscape only) */
const BOARD_W = 1600, BOARD_H = 900, MIN_SCALE = 0.55, MAX_SCALE = 1.2;

export const HOME_NAV = [
  { path: '/heroes', icon: 'hero', th: 'ฮีโร่', en: 'HEROES' },
  { path: '/team', icon: 'squad', th: 'จัดทัพ', en: 'SQUAD' },
  // user 2026-11-28: the main-menu slot opens the Anvil forge (the armory stays reachable from the forge rail)
  { path: '/forge', icon: 'forge', th: 'โรงตีเหล็ก', en: 'FORGE' },
  { path: '/gacha', icon: 'summon', th: 'อัญเชิญ', en: 'SUMMON' },
  { path: '/island', icon: 'isle', th: 'เกาะลอยฟ้า', en: 'SKY ISLE' },
] as const;

/**
 * K7 home (user 2026-11-19): banner-led lobby, black glass + amber selection.
 * The Sky Isle moved to its own page (`/island`). Events / world boss / mail are mock (home-mock.ts).
 */
@Component({
  selector: 'app-home',
  imports: [A11yModule, RouterLink, LineIconComponent, HomeCardArtComponent, HomeIconComponent, HomeMotionDirective, HomeBagComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit, OnDestroy {
  private readonly save = inject(SaveService);
  private readonly roster = inject(RosterService);
  private readonly isl = inject(IslandService);
  private readonly router = inject(Router);
  readonly account = inject(AccountService);

  // ---------------------------------------------------------------- scale to window
  readonly scale = signal(1);
  readonly boardW = signal(BOARD_W);
  readonly boardH = signal(BOARD_H);
  @HostListener('window:resize')
  fit(): void {
    const w = window.innerWidth, h = window.innerHeight;
    const k = Math.max(MIN_SCALE, Math.min(MAX_SCALE, w / BOARD_W, h / BOARD_H));
    this.scale.set(k);
    this.boardW.set(w / k);
    this.boardH.set(h / k);
  }

  // ---------------------------------------------------------------- data
  readonly nav = HOME_NAV;
  readonly tiles = MENU_TILES;
  readonly events = HOME_EVENTS;
  readonly mail = MOCK_MAIL;
  readonly boss = WORLD_BOSS;
  readonly menuBadge = MENU_TILES.filter(t => t.badge || t.dot).length;

  readonly gems = computed(() => formatCurrency(this.save.state().gems));
  readonly gold = computed(() => formatCurrency(this.save.state().gold));
  readonly gemsFull = computed(() => this.save.state().gems.toLocaleString('en-US'));
  readonly goldFull = computed(() => this.save.state().gold.toLocaleString('en-US'));

  readonly totalFloors = STAGES.length;
  readonly cleared = computed(() => this.save.state().cleared);
  readonly nextFloor = computed(() => Math.min(this.cleared() + 1, this.totalFloors));

  /** automatic background = the island's main hero banner (falls back to the first team hero with art) */
  private readonly autoBanner = computed(() => {
    const s = this.save.state();
    const ids = [s.heroes.find(h => h.uid === this.isl.mainHeroUid())?.templateId,
      ...s.team.map(t => s.heroes.find(h => h.uid === t.uid)?.templateId)];
    return ids.find(id => id && heroArt(id)?.banner) ?? 'kael';
  });
  /** hero whose banner fills the home screen: the banner picker's choice, else automatic */
  readonly bannerHero = computed(() => {
    const id = this.account.bannerId();
    return id !== 'auto' && this.ownedBanners().some(o => o.id === id) ? id : this.autoBanner();
  });
  readonly background = computed(() => heroArt(this.bannerHero())?.banner ?? 'banners/kael.webp');
  readonly bannerDrop = computed(() => heroArt(this.bannerHero())?.bannerDrop ?? 0);
  readonly reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** looping animated banner (muted) — none under reduced motion, the still is its poster */
  readonly backgroundVideo = computed(() => (this.reducedMotion ? undefined : heroArt(this.bannerHero())?.bannerVideo));

  // ---------------------------------------------------------------- banner picker
  /** owned heroes that have banner art, in roster order */
  readonly ownedBanners = computed(() => {
    const owned = new Set(this.save.state().heroes.map(h => h.templateId));
    return HEROES.filter(t => owned.has(t.id) && HERO_ART[t.id]?.banner)
      .map(t => ({ id: t.id, name: t.name, banner: HERO_ART[t.id].banner!, video: !!HERO_ART[t.id].bannerVideo }));
  });
  readonly bannerOpen = signal(false);
  openBanners(): void { this.menuOpen.set(false); this.bannerOpen.set(true); }
  readonly bagOpen = signal(false);
  openBag(): void { this.menuOpen.set(false); this.bannerOpen.set(false); this.bagOpen.set(true); }
  pickBanner(id: string): void { this.account.setBanner(id); }

  readonly readyCount = computed(() => this.save.state().heroes.filter(h => {
    const p = this.roster.progress(h);
    return p.state === 'BREAKTHROUGH_READY' || this.roster.skills(h).some(v => v.next && !v.blocked);
  }).length);
  readonly islandNews = computed(() => this.isl.island().pendingEvents.length);
  readonly dailyLeft = computed(() => {
    const daily = ensureDaily(this.save.state().daily, new Date());
    return Object.keys(DAILY_BONUS).reduce((sum, pool) => sum + dailyBonusLeft(daily, pool), 0);
  });

  // ---------------------------------------------------------------- event banner carousel
  readonly slide = signal(0);
  private timer?: ReturnType<typeof setInterval>;
  private swipeX: number | null = null;
  show(i: number): void {
    const n = this.events.length;
    this.slide.set(((i % n) + n) % n);
    this.restartAuto();
  }
  private restartAuto(): void {
    clearInterval(this.timer);
    const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) this.timer = setInterval(() => this.slide.update(i => (i + 1) % this.events.length), 5000);
  }
  swipeStart(e: PointerEvent): void { this.swipeX = e.clientX; }
  swipeEnd(e: PointerEvent, ev: HomeEvent): void {
    const start = this.swipeX;
    this.swipeX = null;
    if (start === null) return;
    const dx = e.clientX - start;
    if (Math.abs(dx) > 30) this.show(this.slide() + (dx < 0 ? 1 : -1));
    else this.open(ev.route);
  }

  // ---------------------------------------------------------------- menu + notices
  readonly menuOpen = signal(false);
  readonly notice = signal<string | null>(null);
  private noticeTimer?: ReturnType<typeof setTimeout>;
  toggleMenu(): void { this.menuOpen.update(v => !v); }
  @HostListener('document:keydown.escape')
  closeMenu(): void { this.menuOpen.set(false); this.bannerOpen.set(false); this.bagOpen.set(false); }
  /** real page if the entry has one, otherwise the feature is still mock → short notice */
  open(route?: string): void {
    if (route) { this.menuOpen.set(false); void this.router.navigateByUrl(route); return; }
    this.soon();
  }
  tile(t: MenuTile): void { if (t.action === 'banners') this.openBanners(); else this.open(t.route); }
  soon(): void {
    clearTimeout(this.noticeTimer);
    this.notice.set('เร็ว ๆ นี้ — ฟีเจอร์นี้ยังไม่เปิดให้เล่น');
    this.noticeTimer = setTimeout(() => this.notice.set(null), 1800);
  }

  readonly embers = Array.from({ length: 12 }, (_, k) => ({ left: (k * 53) % 420, dur: 3.2 + (k % 4) * 0.7, delay: (k * 0.61) % 3 }));

  useCardFallback(event: Event, fallback: string): void {
    const image = event.target as HTMLImageElement;
    if (image.getAttribute('src') === fallback) return;
    image.classList.add('fallback');
    image.src = fallback;
  }

  ngOnInit(): void {
    this.fit();
    this.isl.sync();
    this.restartAuto();
  }
  ngOnDestroy(): void {
    clearInterval(this.timer);
    clearTimeout(this.noticeTimer);
  }
}
