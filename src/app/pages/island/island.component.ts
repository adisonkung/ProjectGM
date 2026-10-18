import { Component, computed, effect, ElementRef, HostListener, inject, NgZone, OnDestroy, OnInit, signal, untracked, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BUILDING_BY_ID, ISLAND_BUILDINGS, PLOT_BY_ID } from '../../core/data/island-layout';
import { ISLAND_THEMES, themeOf } from '../../core/data/island-themes';
import { HERO_BY_ID } from '../../core/data/heroes';
import { CLASS_NAME } from '../../core/data/classes';
import { STAGES } from '../../core/data/stages';
import { IslandBuildingState, IslandEvent, IslandThemeDefinition } from '../../core/models/island';
import { actionUnlockFloor, daySeed, islandStageName, pickRoamers, roamerCount, unlockFloorOf } from '../../core/rules/island';
import { IslandService } from '../../core/services/island.service';
import { RosterService } from '../../core/services/roster.service';
import { SaveService } from '../../core/services/save.service';
import { IslandHeroView } from '../../island/island-hero.component';
import { IslandSceneComponent } from '../../island/island-scene.component';
import { SkyCityComponent } from '../../island/sky-city.component';
import { CityHero, CitySim } from '../../island/city-sim';
import { SKY_PLOTS } from '../../core/data/sky-city';
import { IslandSim, SimHero } from '../../island/island-sim';
import { HeroPortraitComponent } from '../../shared/hero-portrait.component';
import { IconComponent } from '../../shared/icon.component';
import { heroArt } from '../../core/data/hero-art';

/** state a building showed before an event (pending events are revealed on screen one at a time) */
function priorState(ev: IslandEvent): IslandBuildingState {
  const def = BUILDING_BY_ID[ev.buildingId!];
  if (ev.type === 'BUILDING_UNLOCKED' || ev.type === 'STRUCTURE_REVEALED') return { buildingId: def.id, isUnlocked: false, progressionLevel: 0, visualStage: 0 };
  const prev = [...def.visualStages].filter(s => s.stage < ev.stage).pop() ?? def.visualStages[0];
  return { buildingId: def.id, isUnlocked: true, progressionLevel: prev.level, visualStage: prev.stage };
}
function stateAt(ev: IslandEvent): IslandBuildingState {
  const def = BUILDING_BY_ID[ev.buildingId!];
  const s = def.visualStages.find(x => x.stage === ev.stage) ?? def.visualStages[0];
  return { buildingId: def.id, isUnlocked: true, progressionLevel: s.level, visualStage: s.stage };
}

const EVENT_TITLE: Record<IslandEvent['type'], string> = {
  BUILDING_UNLOCKED: 'สิ่งก่อสร้างใหม่!', BUILDING_UPGRADED: 'สิ่งก่อสร้างพัฒนาขึ้น', TOWER_STAGE: 'หอคอยเปลี่ยนแปลง',
  STRUCTURE_REVEALED: 'สิ่งปริศนาปรากฏ', ISLAND_STAGE: 'เกาะของคุณเติบโต',
};

/**
 * Home Island (Patch 1 main lobby): the island itself is the menu — tap buildings / heroes.
 * Runtime only: hero roaming sim + event playback. Persistent state lives in PlayerIsland (IslandService).
 */
@Component({
  selector: 'app-island',
  imports: [IslandSceneComponent, SkyCityComponent, HeroPortraitComponent, IconComponent, RouterLink],
  templateUrl: './island.component.html',
  styleUrl: './island.component.scss',
})
export class IslandComponent implements OnInit, OnDestroy {
  private readonly save = inject(SaveService);
  readonly isl = inject(IslandService);
  private readonly roster = inject(RosterService);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);

  readonly island = this.isl.island;
  /** browser full screen for the island view (desktop / Android; iPhone Safari has no element full screen) */
  private readonly stageEl = viewChild<ElementRef<HTMLElement>>('stage');
  readonly canFullscreen = typeof document !== 'undefined' && !!document.fullscreenEnabled;
  readonly isFull = signal(false);
  toggleFullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void this.stageEl()?.nativeElement.requestFullscreen?.().catch(() => {});
  }
  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    this.isFull.set(!!document.fullscreenElement);
  }
  readonly theme = computed(() => themeOf(this.island().themeId));
  /** cosmetic themes the player can switch between (visual only) */
  readonly themes = Object.values(ISLAND_THEMES);
  setTheme(id: string): void {
    this.isl.setTheme(id);
  }
  /** Sky City (default) or the classic island */
  readonly isCity = this.isl.isCity;
  readonly towerStage = computed(() => this.island().towerVisualStage);
  setMap(m: 'city' | 'classic'): void {
    this.isl.setMap(m);
  }
  readonly themeSheet = signal(false);
  openThemes(): void {
    this.selectedBuilding.set(null);
    this.selectedHero.set(null);
    this.themeSheet.set(true);
  }
  /** picker preview: the theme's own sky + tower art */
  previewOf(t: IslandThemeDefinition): string {
    const sky = t.assets['bg.sky'];
    return sky ? `url(${sky.src})` : 'none';
  }
  towerOf(t: IslandThemeDefinition): string | null {
    return t.assets['building.tower.base.active']?.src ?? null;
  }
  readonly cleared = computed(() => this.save.state().cleared);
  readonly totalFloors = STAGES.length;
  readonly stageName = computed(() => islandStageName(this.island().islandProgressionStage));
  readonly progressExpanded = signal(false);
  readonly partySlots = [0, 1, 2, 3, 4];
  readonly party = computed(() => {
    const s = this.save.state();
    return s.team.flatMap(slot => {
      const h = s.heroes.find(hero => hero.uid === slot.uid);
      const t = h && HERO_BY_ID[h.templateId];
      if (!h || !t) return [];
      return [{ uid: h.uid, id: t.id, name: t.name, level: this.roster.progress(h).level,
        star: this.roster.star(h), power: this.roster.power(h), portrait: heroArt(t.id)?.portrait,
        icon: ({ tank: 'shield', fighter: 'sword', assassin: 'armory', archer: 'heroes', mage: 'crystal', healer: 'potion' })[t.cls] }];
    });
  });
  readonly partyPower = computed(() => this.party().reduce((sum, h) => sum + h.power, 0).toLocaleString('en-US'));
  readonly nextStage = computed(() => STAGES.find(stage => stage.floor === this.nextFloor()));

  // ---------------------------------------------------------------- progression events (one at a time)
  readonly events = computed(() => this.island().pendingEvents);
  readonly current = computed(() => this.events()[0] ?? null);
  /** 'focus' = camera moving, old look · 'reveal' = new look + FX + banner */
  readonly phase = signal<'focus' | 'reveal'>('focus');
  private eventTimer?: ReturnType<typeof setTimeout>;
  readonly eventTitle = (e: IslandEvent) => EVENT_TITLE[e.type];
  readonly eventText = (e: IslandEvent) => {
    if (e.type === 'ISLAND_STAGE') return `เกาะเข้าสู่ขั้น "${islandStageName(e.stage)}"`;
    const def = BUILDING_BY_ID[e.buildingId!];
    const label = def.visualStages.find(s => s.stage === e.stage)?.label ?? def.name;
    return e.type === 'BUILDING_UNLOCKED' ? `${def.name} เปิดใช้งานแล้ว` : e.type === 'STRUCTURE_REVEALED' ? `${label} — ${def.description}` : label;
  };

  /** building looks as the player should currently see them (pending events hold their building back) */
  readonly display = computed<Record<string, IslandBuildingState>>(() => {
    const out = { ...this.island().buildingProgression };
    const evs = this.events();
    const held = new Set<string>();
    evs.forEach((ev, i) => {
      if (!ev.buildingId || held.has(ev.buildingId)) return;
      held.add(ev.buildingId);
      out[ev.buildingId] = i === 0 && this.phase() === 'reveal' ? stateAt(ev) : priorState(ev);
    });
    // once the first event is revealed, later events of other buildings still hold theirs
    return out;
  });
  readonly focus = computed(() => {
    const ev = this.current();
    if (!ev?.buildingId) return null;
    if (this.isCity()) return SKY_PLOTS[ev.buildingId]?.focus ?? null;
    const p = PLOT_BY_ID[BUILDING_BY_ID[ev.buildingId].plotId];
    return { x: p.position.x, y: p.position.y - p.buildingBounds.h / 2 };
  });
  readonly fxBuilding = computed(() => (this.phase() === 'reveal' ? this.current()?.buildingId ?? null : null));

  // ---------------------------------------------------------------- heroes
  readonly mainUid = this.isl.mainHeroUid;
  readonly heroViews = signal<IslandHeroView[]>([]);
  private sim: IslandSim | CitySim | null = null;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private cycle = 0;

  // ---------------------------------------------------------------- sheets
  readonly selectedBuilding = signal<string | null>(null);
  readonly selectedHero = signal<number | null>(null);
  readonly buildingSheet = computed(() => {
    const id = this.selectedBuilding();
    if (!id) return null;
    const def = BUILDING_BY_ID[id];
    const st = this.display()[id];
    const stage = def.visualStages.find(s => s.stage === st.visualStage) ?? def.visualStages[0];
    const next = def.visualStages.find(s => s.stage > st.visualStage);
    const cleared = this.cleared();
    // the island is the hub: a feature opens on its own floor, even while the building is still a ruin
    const actions = def.actions.map(a => ({ ...a, floor: actionUnlockFloor(def, a), open: cleared >= actionUnlockFloor(def, a) }));
    return { def, st, stageLabel: stage.label, unlockFloor: unlockFloorOf(def), next, actions, anyOpen: actions.some(a => a.open) };
  });
  readonly heroSheet = computed(() => {
    const uid = this.selectedHero();
    const h = this.save.state().heroes.find(x => x.uid === uid);
    if (!h) return null;
    const t = HERO_BY_ID[h.templateId];
    return { h, t, cls: CLASS_NAME[t.cls], power: this.roster.power(h), isMain: this.mainUid() === h.uid };
  });

  // ---------------------------------------------------------------- HUD
  readonly nextGoal = computed(() => {
    const c = this.cleared();
    return ISLAND_BUILDINGS.filter(b => unlockFloorOf(b) > c).sort((a, b) => unlockFloorOf(a) - unlockFloorOf(b))[0] ?? null;
  });
  readonly unlockFloorOf = unlockFloorOf;
  /** ruins whose feature already opened (e.g. Training I at F0 while the training yard is rebuilt at F3) */
  readonly usableRuins = computed(() => {
    const c = this.cleared(), d = this.display();
    return ISLAND_BUILDINGS.filter(b => !b.future && !d[b.id]?.isUnlocked && b.actions.some(a => c >= actionUnlockFloor(b, a))).map(b => b.id);
  });
  readonly nextFloor = computed(() => Math.min(this.cleared() + 1, this.totalFloors));
  readonly readyCount = computed(() => this.save.state().heroes.filter(h => {
    const p = this.roster.progress(h);
    return p.state === 'BREAKTHROUGH_READY' || this.roster.skills(h).some(v => v.next && !v.blocked);
  }).length);
  readonly buildingTotal = ISLAND_BUILDINGS.length - 1;
  readonly builtCount = computed(() => Object.values(this.display()).filter(b => b.isUnlocked && b.buildingId !== 'tower').length);

  constructor() {
    // new event on top of the queue → focus first, reveal shortly after
    effect(() => {
      const ev = this.current();
      untracked(() => {
        clearTimeout(this.eventTimer);
        this.phase.set('focus');
        if (ev) this.eventTimer = setTimeout(() => this.phase.set('reveal'), ev.buildingId ? 750 : 50);
      });
    });
    // roaming party follows the main hero / island stage / revealed buildings
    effect(() => {
      const main = this.mainUid();
      const stage = this.island().islandProgressionStage;
      this.isCity();
      untracked(() => this.buildSim(main, stage));
    });
    effect(() => {
      const unlocked = Object.values(this.display()).filter(b => b.isUnlocked).map(b => b.buildingId);
      untracked(() => this.sim?.setUnlocked(unlocked));
    });
  }

  ngOnInit(): void {
    this.isl.sync();
    this.zone.runOutsideAngular(() => (this.raf = requestAnimationFrame(t => this.frame(t))));
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.eventTimer);
  }

  private buildSim(mainUid: number | null, stage: number): void {
    const s = this.save.state();
    const main = s.heroes.find(h => h.uid === mainUid);
    const extra = pickRoamers(s.heroes, s.team, mainUid, roamerCount(stage, s.heroes.length), daySeed());
    const list = [...(main ? [main] : []), ...extra].map(h => ({ uid: h.uid, templateId: h.templateId, cls: HERO_BY_ID[h.templateId].cls, isMain: h.uid === mainUid }));
    const unlocked = Object.values(this.display()).filter(b => b.isUnlocked).map(b => b.buildingId);
    this.sim = this.isCity() ? new CitySim(list, unlocked) : new IslandSim(list, unlocked);
    this.publish();
  }

  /** render the sim every animation frame (heroes move with a GPU transform, so 60 fps is cheap and smooth) */
  private frame(t: number): void {
    const dt = this.last ? Math.min(0.1, (t - this.last) / 1000) : 0;
    this.last = t;
    if (this.sim && dt > 0 && document.visibilityState !== 'hidden') {
      this.sim.step(dt);
      this.cycle += dt;
      this.acc += dt;
      if (this.acc >= 1 / 75) {
        this.acc = 0;
        this.publish();
      }
    }
    this.raf = requestAnimationFrame(x => this.frame(x));
  }

  private publish(): void {
    if (!this.sim) return;
    const views = (this.sim.heroes as (SimHero | CityHero)[]).map((h, i) => ({
      uid: h.heroId, templateId: h.templateId, name: HERO_BY_ID[h.templateId]?.name ?? '', cls: h.cls,
      x: h.currentPosition.x, y: h.currentPosition.y, walking: h.walking, facingLeft: h.facingLeft, isMain: h.isMainHero,
      phase: (this.cycle * (h.walking ? 2.4 : 0.5) + i * 0.37) % 1, interacting: h.currentState === 'BUILDING_IDLE',
    }));
    this.zone.run(() => this.heroViews.set(views));
  }

  // ---------------------------------------------------------------- interactions
  tapBuilding(id: string): void {
    if (this.current()) return; // an event is playing
    this.selectedHero.set(null);
    this.themeSheet.set(false);
    this.selectedBuilding.set(id);
  }
  tapHero(uid: number): void {
    if (this.current()) return;
    this.selectedBuilding.set(null);
    this.themeSheet.set(false);
    this.selectedHero.set(uid);
  }
  closeSheets(): void {
    this.selectedBuilding.set(null);
    this.selectedHero.set(null);
    this.themeSheet.set(false);
  }
  go(route: string, query?: Record<string, string | number>): void {
    this.router.navigate([route], { queryParams: query });
  }
  setMain(uid: number): void {
    this.isl.setMainHero(uid);
  }
  /** banner "continue" → next event */
  nextEvent(): void {
    clearTimeout(this.eventTimer);
    this.isl.popEvent();
  }
  skipEvents(): void {
    clearTimeout(this.eventTimer);
    this.isl.clearEvents();
  }
}
