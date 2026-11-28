import { afterNextRender, Component, computed, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SheetFxComponent } from '../../shared/sheet-fx.component';
import { IconComponent } from '../../shared/icon.component';
import { ITEMS, TOWER_REWARDS } from '../../core/data/economy';
import { FLOOR_BANDS } from '../../core/data/progression';
import { STAGES } from '../../core/data/stages';
import { TowerOrnamentComponent } from './tower-ornament.component';
import { BACKGROUNDS } from '../../core/data/backgrounds';
import { SaveService } from '../../core/services/save.service';
import { MONSTERS } from '../../core/data/monsters';
import { wavesOf } from '../../core/models/stage';
import { MonsterRank } from '../../core/models/monster';
import { HERO_BY_ID } from '../../core/data/heroes';
import { CLASS_NAME } from '../../core/data/classes';
import { heroArt } from '../../core/data/hero-art';
import { RewardBundle } from '../../core/models/economy';
import { CollectionHeaderComponent } from '../heroes/collection-header.component';
import { CLIMB_ART, climbHeight, climbRail } from './tower-climb-art';
import { TowerLayout } from './tower-layout';
import { TowerMonsterComponent } from './tower-monster.component';

const RANK_ORDER: Record<MonsterRank, number> = { COMMON: 1, SPECIAL: 2, ELITE: 3, BOSS: 4, FINAL_BOSS: 5 };
const RANK_LABEL: Record<MonsterRank, string> = { COMMON: 'ทั่วไป', SPECIAL: 'พิเศษ', ELITE: 'อีลีท', BOSS: 'บอส', FINAL_BOSS: 'บอส' };
/** progress markers on the desktop bar — no reward data exists for them yet (open design decision) */
const MILESTONES = [5, 10];

export interface TowerRewardTile { icon: string; label: string; count: string }

/** Tower floors (locked until the previous floor is cleared) — farm dungeons have their own menu (/dungeons) */
@Component({
  selector: 'app-tower',
  imports: [RouterLink, IconComponent, TowerOrnamentComponent, CollectionHeaderComponent, TowerMonsterComponent, SheetFxComponent],
  templateUrl: './tower.component.html',
  styleUrls: ['./tower.component.scss', './tower-climb.scss'],
})
export class TowerComponent {
  private readonly save = inject(SaveService);
  /** Desktop (≥ 1024 px): Milestone Climb layout; below it the earlier layout */
  readonly desktop = inject(TowerLayout).desktop;
  readonly cleared = computed(() => this.save.state().cleared);
  readonly floors = STAGES.map(s => ({
    floor: s.floor, name: s.name ?? `Floor ${s.floor}`,
    band: FLOOR_BANDS[s.floor], reward: TOWER_REWARDS[s.floor],
    mode: s.mode, timeLimit: s.timeLimit,
    thumbnail: '/' + (BACKGROUNDS[s.background ?? 'forest-1'] ?? BACKGROUNDS['forest-1']).file,
  }));
  readonly focusedFloor = signal<number | null>(null);
  readonly selected = computed(() => this.floors.find(f => f.floor === (this.focusedFloor() ?? Math.min(this.cleared() + 1, this.floors.length))) ?? this.floors[0]);
  readonly itemName = (id: string) => ITEMS[id]?.name ?? id;
  readonly roleLabel: Record<string, string> = { ONBOARDING: 'เริ่มต้น', EARLY: 'ช่วงต้น', TRANSITION: 'เปลี่ยนผ่าน', WALL: 'บททดสอบ', ENDGAME: 'ช่วงท้าย' };

  // ------------------------------------------------------------------ Desktop: Milestone Climb
  readonly pad = (n: number) => (n < 10 ? '0' + n : '' + n);
  readonly bandLabel = ([lo, hi]: readonly number[]) => (lo === hi ? `Lv ${lo}` : `Lv ${lo}–${hi}`);
  /** floors that end in a boss wave (any BOSS-rank monster) */
  private readonly bossFloors = new Set(STAGES.filter(s => wavesOf(s).some(w => w.spawns.some(sp => RANK_ORDER[MONSTERS[sp.monsterId]?.rank ?? 'COMMON'] >= RANK_ORDER.BOSS))).map(s => s.floor));
  readonly isBoss = (floor: number) => this.bossFloors.has(floor);
  readonly climb = {
    base: `url(${CLIMB_ART.base})`, loop: `url(${CLIMB_ART.loop})`,
    ratio: `${CLIMB_ART.width} / ${climbHeight(this.floors.length)}`,
    basePct: (CLIMB_ART.baseHeight / climbHeight(this.floors.length)) * 100,
  };
  /** floor plates bottom → top, each on its balcony rail */
  readonly climbFloors = computed(() => {
    const total = climbHeight(this.floors.length), cleared = this.cleared(), sel = this.selected().floor;
    return this.floors.map(f => ({
      ...f, num: this.pad(f.floor), boss: this.isBoss(f.floor),
      done: f.floor <= cleared, next: f.floor === cleared + 1, locked: f.floor > cleared + 1, selected: f.floor === sel,
      bottom: (climbRail(f.floor) / total) * 100,
      bossId: this.keyEnemy(f.floor),
    }));
  });
  readonly milestones = computed(() => MILESTONES.filter(m => m <= this.floors.length).map(m => ({ floor: m, reached: this.cleared() >= m, left: ((m - 0.5) / this.floors.length) * 100 })));
  readonly progressTicks = computed(() => this.floors.map(f => ({ floor: f.floor, done: f.floor <= this.cleared(), next: f.floor === this.cleared() + 1, left: ((f.floor - 0.5) / this.floors.length) * 100 })));
  readonly progressPct = computed(() => (Math.max(0, Math.min(this.cleared(), this.floors.length) - 0.5) / this.floors.length) * 100);

  /** the strongest monster of a floor (boss / elite first) */
  keyEnemy(floor: number): string {
    const stage = STAGES.find(s => s.floor === floor);
    let best = '';
    for (const w of stage ? wavesOf(stage) : []) for (const sp of w.spawns) {
      if (!best || RANK_ORDER[MONSTERS[sp.monsterId]?.rank ?? 'COMMON'] > RANK_ORDER[MONSTERS[best]?.rank ?? 'COMMON']) best = sp.monsterId;
    }
    return best;
  }

  /** waves of the selected floor: monster, rank colour class, count */
  readonly detail = computed(() => {
    const f = this.selected(), stage = STAGES.find(s => s.floor === f.floor)!;
    const seen: string[] = [];
    const waves = wavesOf(stage).map((w, i) => {
      const counts = new Map<string, number>();
      for (const sp of [...w.spawns, ...(w.reinforcements ?? []).flatMap(r => r.spawns)]) counts.set(sp.monsterId, (counts.get(sp.monsterId) ?? 0) + 1);
      const mons = [...counts].map(([id, count]) => {
        if (!seen.includes(id)) seen.push(id);
        const rank = MONSTERS[id]?.rank ?? 'COMMON';
        return { id, name: MONSTERS[id]?.name ?? id, count, rank: rank.toLowerCase(), rankLabel: RANK_LABEL[rank] };
      });
      const boss = mons.some(m => m.rank === 'boss' || m.rank === 'final_boss');
      return { label: boss ? 'บอส' : 'เวฟ ' + (i + 1), boss, mons };
    });
    const lineup = [...seen].sort((a, b) => RANK_ORDER[MONSTERS[a]?.rank ?? 'COMMON'] - RANK_ORDER[MONSTERS[b]?.rank ?? 'COMMON']).slice(-4);
    return {
      waves, lineup, num: this.pad(f.floor), boss: this.isBoss(f.floor),
      goal: f.mode === 'survive' ? 'เอาตัวรอด' : 'กำจัดทุกเวฟ',
      status: f.floor <= this.cleared() ? 'พิชิตแล้ว' : f.floor === this.cleared() + 1 ? 'พร้อมท้าชิง' : 'ยังไม่ปลดล็อก',
    };
  });

  /** first-clear rewards until the floor is cleared, then the repeat-clear rewards */
  readonly rewards = computed(() => {
    const f = this.selected(), first = f.floor > this.cleared();
    const bundle: RewardBundle = first ? f.reward.firstClear : f.reward.clear;
    const tiles: TowerRewardTile[] = [];
    if (bundle.heroExp) tiles.push({ icon: 'exp', label: 'EXP ฮีโร่', count: '+' + bundle.heroExp });
    if (bundle.gold) tiles.push({ icon: 'coin', label: 'ทอง', count: '+' + bundle.gold });
    for (const it of bundle.items ?? []) tiles.push({ icon: it.itemId.startsWith('bt_') ? 'crystal' : it.itemId, label: this.itemName(it.itemId), count: '×' + it.count });
    return {
      first, tiles,
      title: first ? 'รางวัลผ่านครั้งแรก' : 'รางวัลลงซ้ำ',
      note: first ? 'ได้รับครั้งเดียวเมื่อผ่านชั้นนี้' : 'รับรางวัลครั้งแรกแล้ว · ลงซ้ำได้ไม่จำกัด',
    };
  });

  /** the saved battle team with levels against the floor's recommended band */
  readonly team = computed(() => {
    const s = this.save.state(), f = this.selected();
    const heroes = s.team.map(t => s.heroes.find(h => h.uid === t.uid)).filter((h): h is NonNullable<typeof h> => !!h);
    const rows = heroes.map(h => {
      const tpl = HERO_BY_ID[h.templateId];
      return { uid: h.uid, name: tpl?.name ?? h.templateId, cls: tpl ? CLASS_NAME[tpl.cls] : '', level: h.level, star: h.star ?? tpl?.star ?? 1, portrait: '/' + (heroArt(h.templateId)?.portrait ?? 'portraits/' + h.templateId + '.webp') };
    });
    const avg = rows.length ? rows.reduce((a, r) => a + r.level, 0) / rows.length : 0;
    const [lo, hi] = f.band.levels;
    const fit = !rows.length ? 'empty' : avg >= hi ? 'ready' : avg >= lo ? 'close' : 'weak';
    const fitLabel = { empty: 'ยังไม่มีทีม', ready: 'พร้อม', close: 'ใกล้เคียง', weak: 'อ่อนกว่าแนะนำ' }[fit];
    return { rows, avg: avg.toFixed(1), fit, fitLabel, band: this.bandLabel(f.band.levels) };
  });
  readonly stars = (n: number) => '★'.repeat(Math.max(0, Math.min(6, n)));

  // ------------------------------------------------------------------ Desktop effects (decorative; reduced motion = off)
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** bumps on every floor pick so the detail / reward / plate effects replay */
  readonly fxTick = signal(0);
  /** true while the entrance ascent runs (warp glow at the entrance) */
  readonly entering = signal(!this.reduceMotion);
  /** floor whose battle is opening (warp-out overlay), null otherwise */
  readonly warping = signal<number | null>(null);
  /** drifting light motes over the climb column */
  readonly motes = Array.from({ length: 18 }, (_, i) => ({ left: (i * 37 + 11) % 100, delay: (i * 0.73) % 9, dur: 7 + (i * 1.9) % 6, size: 2 + (i * 5) % 4 }));
  /** where the warp portal sits in the climb column (source px of the base art: centre y 1330) */
  readonly portalPct = ((CLIMB_ART.baseHeight - 1330) / climbHeight(STAGES.length)) * 100;
  readonly battleHref = (floor: number) => this.router.serializeUrl(this.router.createUrlTree(['/battle'], { queryParams: { floor, mode: 'tower' } }));
  private timers: ReturnType<typeof setTimeout>[] = [];
  private raf = 0;

  pickFloor(floor: number): void {
    this.focusedFloor.set(floor);
    this.fxTick.update(t => t + 1);
  }

  /** challenge: short warp-out, then the battle (instant with reduced motion or a modified click) */
  enterBattle(event: MouseEvent, floor: number): void {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const go = () => this.router.navigate(['/battle'], { queryParams: { floor, mode: 'tower' } });
    if (this.reduceMotion) { go(); return; }
    if (this.warping() !== null) return;
    this.warping.set(floor);
    this.timers.push(setTimeout(go, 820));
  }

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('climbScroll');
  constructor() {
    // entrance: start at the warp gate and climb to the selected floor (instant with reduced motion)
    afterNextRender(() => {
      if (this.reduceMotion) { this.scrollToFloor(this.selected().floor, 'instant'); return; }
      const box = this.scroller()?.nativeElement;
      if (box) box.scrollTop = box.scrollHeight;
      this.timers.push(setTimeout(() => this.ascend(this.selected().floor), 380));
    });
    this.destroyRef.onDestroy(() => { this.timers.forEach(clearTimeout); cancelAnimationFrame(this.raf); });
  }
  /** eased climb from the current scroll position up to a floor */
  private ascend(floor: number): void {
    const box = this.scroller()?.nativeElement;
    const plate = box?.querySelector<HTMLElement>(`[data-floor="${floor}"]`);
    if (!box || !plate || typeof requestAnimationFrame !== 'function') { this.entering.set(false); return; }
    const from = box.scrollTop, to = Math.max(0, plate.offsetTop - box.clientHeight / 2 + plate.offsetHeight / 2);
    const ms = Math.min(2200, 900 + Math.abs(from - to) * 0.9), t0 = performance.now();
    const ease = (t: number) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / ms);
      box.scrollTop = from + (to - from) * ease(t);
      if (t < 1) this.raf = requestAnimationFrame(step);
      else { this.entering.set(false); this.fxTick.update(x => x + 1); }
    };
    this.raf = requestAnimationFrame(step);
  }
  scrollToFloor(floor: number, behavior: ScrollBehavior = 'smooth'): void {
    const box = this.scroller()?.nativeElement;
    const plate = box?.querySelector<HTMLElement>(`[data-floor="${floor}"]`);
    if (!box || !plate) return;
    const top = plate.offsetTop - box.clientHeight / 2 + plate.offsetHeight / 2;
    box.scrollTo({ top: Math.max(0, top), behavior });
  }
}
