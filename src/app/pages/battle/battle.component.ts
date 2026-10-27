import { battleViewport } from './battle-viewport';
import { BattleEmblemComponent } from './battle-emblem.component';
import { TowerOrnamentComponent } from '../tower/tower-ornament.component';
import { A11yModule } from '@angular/cdk/a11y';
import { CitadelIconComponent } from '../../shared/citadel-icon.component';
import { CitadelFrameComponent } from '../../shared/citadel-frame.component';
import { sequenceFx } from '../../battle/render/sequence-fx';
import { itemName as itemNameOf } from '../../core/rules/equipment';
import { BACKGROUNDS } from '../../core/data/backgrounds';
import { Component, computed, effect, ElementRef, HostListener, inject, isDevMode, NgZone, OnDestroy, signal, untracked, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TeamPresetsComponent } from '../../shared/team-presets.component';
import { DUNGEON_TYPES } from '../dungeons/dungeons.component';
import { IconComponent } from '../../shared/icon.component';
import { STAGES } from '../../core/data/stages';
import { FARM_BY_ID } from '../../core/data/economy';
import { ITEMS } from '../../core/data/economy';
import { ProgressionService, RunReward } from '../../core/services/progression.service';
import { power } from '../../core/rules/stats';
import { TeamService } from '../../core/services/team.service';
import { AnimState, BoardComponent, FloatText, FxView, ProjectileView, UnitView, WorldDebug, ZoneView } from '../../battle/board/board.component';
import { projectileLife } from '../../battle/projectile/projectile.component';
import { ENEMY_ZONE_START, SCENERY_ROWS, SIDE_DEPTH } from '../../battle/engine/grid';
import { BattlePhase } from '../../battle/engine/stage/types';
import { PartyBarComponent } from '../../battle/party-bar/party-bar.component';
import { DEV_FLAGS } from '../../core/data/dev-flags';
import { kitInterrupts, kitOf } from '../../core/data/hero-skills';
import { hasStatus } from '../../battle/engine/buffs';
import { StatusFxPlayback } from '../../battle/render/status-fx';
import { MotionFxPlayback } from '../../battle/render/motion-fx';
import { PlacementComponent } from '../../battle/placement/placement.component';
import { fxDuration } from '../../battle/fx-sprite/fx-sprite.component';
import { playImpactFeel } from '../../battle/impact-feel/impact-feel';
import { BoardRenderer, savedRenderer, saveRenderer } from '../../battle/render/renderer-pref';
import { animOf, appliedStatusFx, retaliateFx, CLASS_PROJECTILE, FX, fxFor, eventFeelOf, fxAttached, fxOffset, FxTrigger, fxWidthCells, impactFeelOf, projectileOrigin, SHEETS, SkillKind } from '../../core/data/sprites';
import { groundFxCell } from '../../battle/render/fx-clip';
import { FieldFxPlayback } from '../../battle/render/field-fx';
import { BattleEngine, BattleEvent, BattleResult, BattleUnit } from '../../battle/engine/battle-engine';
import { BattleOutcome, createBattle, modeStatus, outcomeOf } from '../../battle/battle-session';
import { Router } from '@angular/router';
import { monsterSnapshot } from '../../battle/engine/monster-controller';
import { MONSTER_SKILLS, MONSTERS } from '../../core/data/monsters';
import { mockVisualOf, STATUS_ICONS } from '../../core/data/visuals';
import { isBossRank, MonsterSkillDefinition } from '../../core/models/monster';
import { AreaPattern } from '../../core/models/combat';
import { hasFlag } from '../../battle/engine/buffs';
import { isPlayerUnit, PLAYER_TEAM } from '../../battle/engine/stage/party';
import { expToNext } from '../../core/rules/leveling';
import { HeroPortraitComponent } from '../../shared/hero-portrait.component';
import { SlashTraceComponent } from '../../battle/slash-trace/slash-trace.component';
import { SlashGrade } from '../../core/data/special-skills';
import { strokeMultipliers } from '../../core/rules/slash-trace';

const TICK = 0.05;

/**
 * ห้องทดลองต่อสู้: เลือกชั้น จัดตำแหน่งบนกระดาน แล้วดูทีมปัจจุบันสู้กับศัตรูบนกระดาน 5×16 (สองแถวบนเป็นฉาก)
 * ผลการต่อสู้ไม่มีผลกับเซฟ (แต่การจัดตำแหน่งบันทึกลงทีม) ใช้ทดสอบเอนจินและปรับสมดุล
 */
@Component({
  selector: 'app-battle',
  imports: [BattleEmblemComponent, A11yModule, TowerOrnamentComponent, CitadelIconComponent, CitadelFrameComponent, BoardComponent, PlacementComponent, PartyBarComponent, TeamPresetsComponent, IconComponent, RouterLink, HeroPortraitComponent, SlashTraceComponent],
  templateUrl: './battle.component.html',
  styleUrl: './battle.component.scss',
})
export class BattleComponent implements OnDestroy {
  onFxFinished(ids: number[]): void {
    const done = new Set(ids);
    this.fx.update(list => list.filter(f => !done.has(f.id)));
  }

  private readonly team = inject(TeamService);
  readonly progression = inject(ProgressionService);
  /** sandbox (no rewards), a tower run (clear EXP) or a farm dungeon run (?farm=training_1) */
  readonly mode = signal<'lab' | 'tower' | 'farm'>('lab');
  readonly farmId = signal<string | null>(null);
  readonly reward = signal<RunReward | null>(null);
  /** finished tower / farm run (result card) · live special-mode HUD */
  readonly outcome = signal<BattleOutcome | null>(null);
  readonly modeHud = signal<{ goal: string; line: string } | null>(null);
  private readonly router = inject(Router);
  /** tower: the next floor exists and is now reachable */
  readonly nextFloor = computed(() => {
    const n = this.floor() + 1;
    return this.mode() === 'tower' && n <= STAGES.length && this.progression.cleared() >= n - 1 ? n : null;
  });
  /** dungeon name / floor name for the result card */
  readonly runTitle = computed(() => (this.farmId() ? FARM_BY_ID[this.farmId()!].name : `ชั้น ${this.floor()} · ${this.stage().name ?? ''}`));
  /** hero uid → name (EXP lines on the result card) */
  heroName(uid: number): string {
    return this.engine?.units.find(u => u.heroUid === uid)?.name ?? `#${uid}`;
  }
  readonly itemName = (id: string) => ITEMS[id]?.name ?? id;
  readonly itemIcon = (id: string) => id.startsWith('bt_') ? 'crystal' : id;
  /** result popup: one tile per hero (team order, left → right) with the EXP bar before / after this run */
  readonly expStrip = computed(() => {
    const rw = this.reward();
    if (!rw?.exp.length) return [];
    const order = (uid: number) => {
      const i = this.engine?.units.findIndex(u => isPlayerUnit(u) && u.heroUid === uid) ?? -1;
      return i < 0 ? 999 : i;
    };
    return [...rw.exp].sort((a, b) => order(a.uid) - order(b.uid)).map(x => {
      const u = this.engine?.units.find(v => v.heroUid === x.uid);
      const up = x.after.level > x.before.level;
      const need = expToNext(x.after.level);
      const pct = (e: number) => (need > 0 ? Math.min(100, (e / need) * 100) : 100);
      return {
        uid: x.uid, heroId: u?.heroId ?? '', name: u?.name ?? `#${x.uid}`, up, gained: x.gained, share: x.share,
        before: x.before.level, after: x.after.level, max: need === 0,
        from: up ? 0 : pct(x.before.exp), to: pct(x.after.exp),
        exp: x.after.exp, need,
      };
    });
  });
  readonly totalHeroExp = computed(() => this.expStrip().reduce((n,x) => n + x.gained,0));
  readonly gearName = itemNameOf;

  readonly stages = STAGES;
  readonly floor = signal(1);
  readonly viewport = signal({ width: typeof window === 'undefined' ? 1280 : window.innerWidth, height: typeof window === 'undefined' ? 900 : window.innerHeight });
  readonly fieldLayout = computed(() => battleViewport(this.viewport().width,this.viewport().height));
  readonly sceneryExtraRows = computed(() => {
    if (this.mode() === 'lab') return 0;
    const requested = this.placing() ? (this.viewport().width >= 900 ? .65 : 0) : this.fieldLayout().extraRows;
    // Reveal only pixels already cropped above the map; never expose an empty image band.
    return Math.min(requested, Math.max(0, ((this.background()?.zoom ?? 1) - 1) * 5));
  });
  @HostListener('window:resize') onViewportResize(): void { this.viewport.set({ width: window.innerWidth, height: window.innerHeight }); }
  readonly speed = signal(1);
  readonly running = signal(false);
  /** settings popup open → the fight is paused (engine not stepped, board animations frozen) */
  readonly paused = signal(false);
  readonly menuOpen = signal(false);
  /** who draws the battle units: DOM (Web Animations) or Pixi (WebGL, one game clock) — `?render=pixi|dom`, remembered */
  readonly renderer = signal<BoardRenderer>(savedRenderer());
  /** the board's game clock stands still (paused / hit-stop) */
  readonly boardFrozen = (): boolean => this.paused() || performance.now() < this.hitStopUntil;
  toggleRenderer(): void {
    this.renderer.update(r => (r === 'pixi' ? 'dom' : 'pixi'));
    saveRenderer(this.renderer());
  }
  readonly result = signal<BattleResult | null>(null);
  readonly time = signal(0);
  readonly views = signal<UnitView[]>([]);
  readonly floats = signal<FloatText[]>([]);
  readonly fx = signal<FxView[]>([]);
  /** mock FX: telegraphed cast areas / activation flashes */
  readonly zones = signal<ZoneView[]>([]);
  /** boss bar (BOSS / FINAL_BOSS on the field): name, HP%, phase label, state */
  readonly bossBar = computed(() => {
    const v = this.views().find(x => x.side === 'enemy' && x.alive && x.boss && x.bossRank);
    return v ? { name: v.name, hpPct: v.hpPct, phase: this.bossPhase(), final: v.bossRank === 'FINAL_BOSS', sealed: !!v.untargetable, broken: !!v.broken, enraged: !!v.enraged } : null;
  });
  readonly bossPhase = signal<string | null>(null);
  readonly projectiles = signal<ProjectileView[]>([]);
  readonly anims = signal<Record<number, AnimState>>({});
  readonly simReport = signal<string | null>(null);
  readonly simStats = signal<{ floor: number; runs: number; wins: number; seconds: number } | null>(null);
  /** เวฟปัจจุบัน (เริ่ม 0) / ทั้งหมด · ช่วงของการต่อสู้ (BattlePhase) */
  readonly wave = signal(0);
  readonly totalWaves = signal(1);
  readonly wavePips = computed(() => Array.from({ length: this.totalWaves() }, (_, i) => i));
  readonly phase = signal<BattlePhase>(BattlePhase.PREPARATION);
  /** ตำแหน่งกล้องในโลก (ช่อง) — ฉากเลื่อนตามอย่างต่อเนื่องตอน Advance */
  readonly scroll = signal(0);
  readonly tickMs = TICK * 1000;
  /** debug: stage header + every hero (incl. DEAD_HIDDEN ones that aren't on the board) */
  readonly stageDebug = signal<{ header: string; heroes: { id: number; lines: string[] }[] } | null>(null);
  readonly worldDebug = signal<WorldDebug | null>(null);
  /** สรุปผลด่าน (ฮีโร่ที่รอด/ล้ม/ถูกชุบ) */
  readonly summary = signal<string | null>(null);
  /** ป้ายกลางจอ เช่น "เวฟ 2/3" */
  readonly banner = signal<string | null>(null);
  /** ฝั่งเราร่ายท่าไม้ตายเองเมื่อเกจเต็ม */
  readonly autoUlt = signal(false);
  /** player special skill (separate button, not a hero skill): charge 0–1 · usable now · mini-game open */
  readonly specialCharge = signal(0);
  readonly specialReady = signal(false);
  readonly tracing = signal(false);
  readonly traceSeed = signal(1);
  /** impact flash after the mini-game (key re-triggers the CSS animation) */
  readonly specialFlash = signal<number | null>(null);
  get specialDef() {
    return this.engine.special;
  }
  /** combat debug overlay (dev builds only): ?debug=1 or key D */
  readonly debug = signal(false);
  /** running cast FX per unit (removed on fxStop) */
  private castFx = new Map<number, number>();
  /** Target cell at cast start, for ground visuals when an aimed unit dies before activation. */
  private castAim = new Map<number, { id: number; at: { r: number; c: number } }>();
  /** ground footprint of the current cast per caster: every ground FX layer of one cast (spawn → loop → burst) lands
   *  on the cell the first one used, even if the target steps away meanwhile (cleared on the next cast) */
  private groundLock = new Map<number, { r: number; c: number }>();
  private fieldVisuals = new FieldFxPlayback({
    spawn: (name, world, loop) => {
      const id = ++this.floatId;
      this.fx.update(l => [...l, { id, name, r: world.r, c: world.c - this.engine.cameraX, angle: 0,
        offset: fxOffset(name), under: FX[name].layer === 'under', managed: true, loop }]);
      return id;
    },
    remove: ids => this.fx.update(l => l.filter(f => !ids.includes(f.id))),
  });
  private statusVisuals = new StatusFxPlayback({
    spawn: (name, target, at, loop) => {
      const id = ++this.floatId;
      this.fx.update(l => [...l, { id, name, ...at, angle: 0, offset: fxOffset(name),
        under: FX[name].layer === 'under', follow: target, managed: true, loop }]);
      return id;
    },
    remove: ids => this.fx.update(l => l.filter(f => !ids.includes(f.id))),
  });
  private motionVisuals = new MotionFxPlayback({
    spawn: (name, source, loop) => {
      const u = this.engine.units.find(u => u.id === source)!;
      const id = ++this.floatId;
      this.fx.update(l => [...l, { id, name, ...this.screenOf(u), angle: 0,
        flip: u.actionFacing?.left ?? this.facing.get(source), offset: fxOffset(name),
        under: FX[name].layer === 'under', follow: source, managed: true, loop }]);
      return id;
    },
    remove: ids => this.fx.update(l => l.filter(f => !ids.includes(f.id))),
  });
  /** ฮีโร่ของเรา เรียงตามทีม (ซ้าย→ขวาในแถบด้านล่าง) */
  readonly party = computed(() => this.views().filter(v => isPlayerUnit(v)));
  /** STEP 9: ศัตรูที่แตะเลือกไว้ และเป้าโฟกัสของทีม */
  readonly selectedId = signal<number | null>(null);
  readonly focusId = signal<number | null>(null);
  /** การ์ดข้อมูลศัตรู: เป้าโฟกัส หรือตัวที่เลือกอยู่ */
  readonly focusCard = computed(() => {
    const id = this.selectedId() ?? this.focusId();
    const v = this.views().find(x => x.id === id && x.alive && x.side === 'enemy');
    return v ? { ...v, isFocus: v.id === this.focusId() } : null;
  });
  /** ฮีโร่ที่ตีเป้าโฟกัสอยู่ / ทั้งหมด */
  readonly focusCount = computed(() => {
    const p = this.party().filter(v => v.alive);
    return { on: p.filter(v => v.onFocus).length, total: p.length };
  });
  /** debug: can at least one hero engage the Focus Target safely right now? */
  readonly focusSafe = signal(true);
  /** ศัตรูที่กำลังร่ายสกิล (แสดงแถบเตือนเหนือสนาม) */
  readonly casts = computed(() => this.views().filter(v => v.alive && v.cast));
  /** มีสกิลร่ายที่ตัดได้อยู่ตอนนี้ → ไฮไลต์ฮีโร่ที่ท่าไม้ตายตัดได้ */
  readonly cuttable = computed(() => this.casts().some(v => v.cast!.interruptible));

  readonly stage = computed(() => (this.farmId() ? FARM_BY_ID[this.farmId()!].stage : STAGES[this.floor() - 1]));
  readonly background = computed(() => BACKGROUNDS[this.stage().background ?? ''] ?? null);
  /** ก่อนกดเริ่ม: แสดงกระดานจัดตำแหน่ง */
  readonly placing = computed(() => !this.running() && !this.result());
  readonly teamPower = computed(() => this.team.units().reduce((a, u) => a + power(u.stats), 0));
  readonly timeLeft = computed(() => Math.max(0, Math.ceil(this.stage().timeLimit - this.time())));

  private engine!: BattleEngine;
  /**
   * Game loop on requestAnimationFrame with a fixed 50 ms step (accumulator): ticks land on display frames at an even
   * cadence (setInterval drifted against the frames → units stopped and jumped). The loop runs outside Angular; only
   * frames that actually step the engine enter the zone (change detection ~20×/s as before). Board tweens between ticks.
   */
  private raf = 0;
  private lastFrame = 0;
  private acc = 0;
  private readonly zone = inject(NgZone);
  private startLoop(): void {
    this.stopLoop();
    this.acc = 0;
    this.lastFrame = performance.now();
    this.zone.runOutsideAngular(() => (this.raf = requestAnimationFrame(this.frame)));
  }
  private stopLoop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
  private readonly frame = (now: number): void => {
    // a hidden tab / long frame: never fast-forward more than a few ticks at once · paused / hit-stop: time stands
    // still (the board holds its in-between position instead of drifting to the next snapshot)
    const frozen = this.paused() || now < this.hitStopUntil;
    if (!frozen) this.acc += Math.min(now - this.lastFrame, 4 * TICK * 1000);
    this.lastFrame = now;
    const step = TICK * 1000;
    if (this.acc >= step) {
      this.zone.run(() => {
        while (this.acc >= step && this.raf) {
          this.acc -= step;
          this.tick();
        }
      });
    }
    if (this.raf) this.raf = requestAnimationFrame(this.frame);
  };
  /** engine steps so far (board: a new snapshot pair starts) · how far the display is into the next step (0–1) */
  readonly simTick = signal(0);
  readonly alpha = (): number => (this.raf ? Math.min(1, Math.max(0, this.acc / (TICK * 1000))) : 1);
  /** movement → walk cycle: last world position seen per tick and the tick until which the unit counts as moving */
  private lastPos = new Map<number, [number, number]>();
  private movingUntil = new Map<number, number>();
  /** smoothed ground speed (cells / game s) while walking — the walk cycle runs at pace / AnimDef.pace */
  private paces = new Map<number, number>();
  /** hits taken per unit (white hit flash on the Pixi board) */
  private hits = new Map<number, number>();
  private tickNo = 0;
  private trackMovement(): void {
    this.tickNo++;
    for (const u of this.engine.units) {
      const prev = this.lastPos.get(u.id);
      this.lastPos.set(u.id, [u.x, u.y]);
      const d = prev ? Math.hypot(u.x - prev[0], u.y - prev[1]) : 0;
      // ~0.2 cell/s or faster = walking · 3 ticks of grace so a stop-and-go between cells keeps the cycle running
      if (d > 0.01) {
        this.movingUntil.set(u.id, this.tickNo + 3);
        // a blink / knock-back jump is not walking: keep the pace it had
        const v = d / TICK;
        const p = this.paces.get(u.id);
        if (v <= 6) this.paces.set(u.id, p == null ? v : p + (v - p) * 0.35);
      }
    }
  }
  private isMoving(u: BattleUnit): boolean {
    return u.alive && (this.movingUntil.get(u.id) ?? 0) > this.tickNo;
  }
  private floatId = 0;
  /** ทิศที่แต่ละตัวหันอยู่ (true = ซ้าย) คงไว้เมื่อเป้าอยู่คอลัมน์เดียวกัน */
  private facing = new Map<number, boolean>();
  /** ตัวที่เพิ่งวาร์ป: ปิดการเลื่อนตัวบนจอชั่วครู่ (เวลาเอนจินที่หมดผล) */
  private blinkUntil = new Map<number, number>();
  /** units whose current blink fades through its clip's own opacity curve */
  private ownFade = new Set<number>();
  private animKey = 0;
  private bannerTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    const route = inject(ActivatedRoute).snapshot;
    const qp = route.queryParamMap;
    const q = Number(qp.get('floor'));
    if (isDevMode() && qp.get('debug') === '1') this.debug.set(true);
    const render = qp.get('render');
    if (render === 'pixi' || render === 'dom') this.renderer.set(render);
    if (q >= 1 && q <= STAGES.length) this.floor.set(q);
    const farm = qp.get('farm');
    if (farm && FARM_BY_ID[farm]) {
      this.farmId.set(farm);
      this.mode.set('farm');
    } else if (qp.get('mode') === 'tower' || !route.data['lab']) this.mode.set('tower');
    // real tower runs: never past the next unlocked floor (default = the next floor to clear)
    if (this.mode() === 'tower') {
      const top = Math.min(this.progression.cleared() + 1, STAGES.length);
      if (!(q >= 1) || q > top) this.floor.set(top);
    }
    // จัดทีมใหม่ระหว่างรอเริ่ม: สร้างการต่อสู้ใหม่ให้ตรงกับตำแหน่งล่าสุด
    effect(() => {
      this.team.units();
      untracked(() => {
        // (not while a result card is up: rewards change the heroes — the next start() rebuilds with them)
        if (!this.running() && !this.result()) this.prepare();
      });
    });
  }

  ngOnDestroy(): void {
    this.stopLoop();
    this.endTimers.forEach(clearTimeout);
    this.portraitMq?.removeEventListener('change', this.onOrientation);
    this.releaseLandscape();
  }

  // ---------------------------------------------------------------- phones: the fight is played in landscape
  /** a phone held upright (touch screen, narrow portrait) — the field is unplayably small; the fight pauses behind a "rotate" card */
  private readonly portraitMq = typeof matchMedia === 'function' ? matchMedia('(orientation: portrait) and (max-width: 700px) and (pointer: coarse)') : null;
  readonly portraitPhone = signal(!!this.portraitMq?.matches);
  private rotatePaused = false;
  private readonly onOrientation = () => {
    this.portraitPhone.set(!!this.portraitMq?.matches);
    if (this.portraitPhone()) {
      if (this.running() && !this.paused()) {
        this.paused.set(true);
        this.rotatePaused = true;
      }
    } else if (this.rotatePaused) {
      this.rotatePaused = false;
      if (!this.menuOpen()) this.paused.set(false);
    }
  };
  private readonly _orientationWatch = this.portraitMq?.addEventListener('change', this.onOrientation);

  /** Android (Chrome): full screen + lock to landscape for the fight. iOS / desktop: not supported → nothing happens */
  private lockLandscape(): void {
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    if (!coarse || typeof document === 'undefined' || Math.min(screen.width, screen.height) > 700) return;
    const lock = () => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })?.lock?.('landscape').catch(() => {});
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).then(lock, () => {});
    else lock();
  }
  private releaseLandscape(): void {
    if (typeof document === 'undefined') return;
    try {
      (screen.orientation as ScreenOrientation & { unlock?: () => void })?.unlock?.();
    } catch {
      /* not locked */
    }
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }

  selectFloor(n: number): void {
    this.floor.set(n);
    this.farmId.set(null);
    if (this.mode() === 'farm') this.mode.set('lab');
    this.prepare();
  }

  /** สร้างการต่อสู้ใหม่และแสดงตำแหน่งเริ่มต้น */
  prepare(): void {
    this.stopLoop();
    this.endTimers.forEach(clearTimeout);
    this.endTimers = [];
    this.ending.set(false);
    this.running.set(false);
    this.paused.set(false);
    this.menuOpen.set(false);
    this.tracing.set(false);
    this.result.set(null);
    this.reward.set(null);
    this.simReport.set(null);
    this.simStats.set(null);
    this.floats.set([]);
    this.fx.set([]);
    this.zones.set([]);
    this.bossPhase.set(null);
    this.projectiles.set([]);
    this.anims.set({});
    this.engine = createBattle({ allies: this.team.units(), stage: this.stage(), autoUlt: this.autoUlt() });
    // testing a new hero: ultimate ready from the first second (core/data/dev-flags.ts)
    if (DEV_FLAGS.fullUltAtStart) for (const u of this.engine.units) if (isPlayerUnit(u)) u.mana = u.maxMana;
    this.outcome.set(null);
    this.modeHud.set(modeStatus(this.engine));
    this.time.set(0);
    this.wave.set(0);
    this.totalWaves.set(this.engine.totalWaves);
    this.phase.set(this.engine.phase);
    this.scroll.set(this.engine.cameraX);
    this.summary.set(null);
    this.banner.set(null);
    this.lastPos.clear();
    this.movingUntil.clear();
    this.paces.clear();
    this.hits.clear();
    this.selectedId.set(null);
    this.focusId.set(null);
    this.facing.clear();
    this.castAim.clear();
    this.groundLock.clear();
    this.fieldVisuals.clear();
    this.statusVisuals.clear();
    this.motionVisuals.clear();
    this.blinkUntil.clear();
    this.ownFade.clear();
    this.snapshot();
  }

  start(): void {
    if (this.running()) return;
    if (this.result()) this.prepare();
    if (!this.engine.alive(PLAYER_TEAM).length) return;
    this.running.set(true);
    if (this.mode() !== 'lab' && typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' });
    this.lockLandscape();
    if (this.portraitPhone()) {
      this.paused.set(true);
      this.rotatePaused = true;
    }
    this.startLoop();
  }

  /** แตะรูปตัวละคร (หรือกดปุ่ม 1–5): ใช้ท่าไม้ตายเมื่อเกจเต็ม */
  useUlt(id: number): void {
    if (this.running() && !this.paused() && this.engine.requestUlt(id)) this.snapshot();
  }

  /** แตะไอคอนสกิลที่พร้อม: ใช้ทันที (สั่งเอง ใช้ได้แม้สกิลตั้งเป็น เก็บไว้ / กดเอง) */
  useSkill(ev: { id: number; slot: 'skill' | 'skill2' }): void {
    if (this.running() && !this.paused() && this.engine.requestSkill(ev.id, ev.slot)) this.snapshot();
  }

  /** แตะชิปโหมด: AUTO → RESERVE (เก็บไว้) → MANUAL (กดเอง) → AUTO */
  cycleMode(ev: { id: number; slot: 'skill' | 'skill2' | 'ult' }): void {
    const u = this.engine?.units.find(x => x.id === ev.id);
    if (!u) return;
    const order = ['AUTO', 'RESERVE', 'MANUAL'] as const;
    const cur = this.engine.skills.mode(u, ev.slot);
    const next = order[(order.indexOf(cur as (typeof order)[number]) + 1) % order.length];
    this.engine.setSkillMode(ev.id, ev.slot, next);
    this.snapshot();
  }

  /** แตะศัตรู: ครั้งแรก = เลือก (ขึ้นการ์ด) · แตะซ้ำ = 🎯 โฟกัส · แตะเป้าโฟกัส = ยกเลิก */
  pickEnemy(id: number): void {
    if (!this.running()) return;
    if (id === this.focusId()) return this.cancelFocus();
    if (id === this.selectedId()) return this.setFocus(id);
    this.selectedId.set(id);
  }

  setFocus(id: number | null): void {
    if (!this.engine || id == null) return this.cancelFocus();
    if (id !== this.engine.focusTargetId) this.engine.setFocus(id);
    this.selectedId.set(null);
    this.focusId.set(this.engine.focusTargetId);
    this.snapshot();
  }

  cancelFocus(): void {
    if (this.engine?.focusTargetId != null) this.engine.setFocus(this.engine.focusTargetId);
    this.selectedId.set(null);
    this.focusId.set(null);
    this.snapshot();
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (this.tracing()) return;
    if (e.key === 'Escape') return this.menuOpen() ? this.resume() : this.cancelFocus();
    if (this.paused()) return;
    if ((e.key === 'd' || e.key === 'D') && isDevMode()) {
      this.debug.update(v => !v);
      return this.snapshot();
    }
    if ((e.key === 'f' || e.key === 'F') && this.selectedId() != null) return this.setFocus(this.selectedId());
    if ((e.key === 's' || e.key === 'S' || e.key === ' ') && this.specialReady()) return this.useSpecial();
    const n = Number(e.key);
    if (!this.running() || !Number.isInteger(n) || n < 1) return;
    const u = this.party()[n - 1];
    if (u) this.useUlt(u.id);
  }

  /** special skill button: pause the fight and open the Blade Trace mini-game */
  useSpecial(): void {
    if (!this.running() || this.paused() || this.ending() || !this.engine.canUseSpecial()) return;
    this.traceSeed.update(v => v + 1);
    this.tracing.set(true);
    this.paused.set(true);
  }

  /** mini-game over: grades → trail multipliers → the engine deals the hits, the fight goes on */
  specialDone(grades: SlashGrade[]): void {
    this.tracing.set(false);
    this.paused.set(false);
    if (this.engine.useSpecial(strokeMultipliers(grades, this.engine.special))) {
      this.handleEvents(this.engine.drainEvents());
      this.snapshot();
    }
  }

  toggleAuto(): void {
    this.autoUlt.update(v => !v);
    if (this.engine) this.engine.autoUlt = this.autoUlt();
  }

  setSpeed(v: number): void {
    this.speed.set(v);
  }

  /** one speed button: x1 → x2 → x4 → x1 */
  cycleSpeed(): void {
    const order = [1, 2, 4];
    this.speed.set(order[(order.indexOf(this.speed()) + 1) % order.length]);
  }

  /** settings popup: pauses the fight while open */
  openMenu(): void {
    if (!this.running() || this.ending() || this.tracing()) return;
    this.menuOpen.set(true);
    this.paused.set(true);
  }
  resume(): void {
    this.menuOpen.set(false);
    this.paused.set(false);
  }
  /** start the same stage over (same team / placement) */
  restart(): void {
    this.prepare();
    this.start();
  }
  /** leave the stage → back to the pre-fight placement screen (no rewards, nothing saved) */
  exitStage(): void {
    this.prepare();
  }

  /** จำลอง 100 รอบแบบไม่แสดงผล เพื่อดูอัตราชนะ */
  simulate(runs = 100): void {
    let wins = 0;
    let t = 0;
    for (let seed = 1; seed <= runs; seed++) {
      const e = createBattle({ allies: this.team.units(), stage: this.stage(), seed, autoUlt: true });
      if (e.run() === 'win') wins++;
      t += e.time;
    }
    this.simStats.set({ floor: this.floor(), runs, wins, seconds: t / runs });
    this.simReport.set(`จำลอง ${runs} รอบ: ชนะ ${Math.round((wins / runs) * 100)}% · เฉลี่ย ${(t / runs).toFixed(1)} วินาที`);
  }

  /** board element (hit-stop / screen shake) */
  private readonly boardEl = viewChild(BoardComponent, { read: ElementRef });
  /** hit-stop: the engine holds until this real time (performance.now ms) — presentation only, game time just waits */
  private hitStopUntil = 0;

  private tick(): void {
    if (this.paused()) return;
    if (performance.now() < this.hitStopUntil) return;
    for (let i = 0; i < this.speed() && !this.engine.result; i++) this.engine.step(TICK);
    this.trackMovement();
    this.simTick.update(n => n + 1);
    this.handleEvents(this.engine.drainEvents());
    this.time.set(this.engine.fightTime);
    this.phase.set(this.engine.phase);
    this.scroll.set(this.engine.cameraX);
    this.snapshot();
    this.modeHud.set(modeStatus(this.engine));
    if (this.engine.result) {
      this.stopLoop();
      this.finishSoon();
    }
  }

  /** stage over: a short outro on the battle screen (winners swing once more, banner) before the result popup */
  readonly ending = signal(false);
  private endTimers: ReturnType<typeof setTimeout>[] = [];
  static readonly OUTRO_MS = 2400;
  private finishSoon(): void {
    this.fx.update(list => list.filter(f => f.owner == null));
    const win = this.engine.result === 'win';
    this.ending.set(true);
    // rewards are saved right away (leaving during the outro loses nothing); only the popup waits
    this.grantRewards();
    const r = this.engine.stageResult;
    if (r) {
      const names = (ids: number[]) => this.engine.units.filter(u => isPlayerUnit(u) && ids.includes(u.heroUid ?? u.id)).map(u => u.name).join(', ') || '-';
      this.summary.set(`เคลียร์ ${r.wavesCleared}/${r.totalWaves} เวฟ · รอด: ${names(r.survivingHeroIds)} · ล้ม: ${names(r.deadHeroIds)}${r.revivedHeroIds.length ? ' · ถูกชุบ: ' + names(r.revivedHeroIds) : ''} · ดาเมจที่รับ ${r.damageTaken}`);
    }

    this.showBanner(win ? 'ชนะ!' : this.engine.result === 'timeout' ? 'หมดเวลา' : 'พ่ายแพ้…', BattleComponent.OUTRO_MS * this.speed());
    if (win) {
      const swing = () => {
        const anims = { ...this.anims() };
        for (const u of this.engine.units) {
          if (!isPlayerUnit(u) || !u.alive || !u.visible) continue;
          this.facing.set(u.id, false);
          anims[u.id] = { anim: 'attack', key: ++this.animKey, force: true };
        }
        this.anims.set(anims);
        this.snapshot();
      };
      this.endTimers.push(setTimeout(swing, 350), setTimeout(swing, 1350));
    }
    this.endTimers.push(setTimeout(() => this.finish(), BattleComponent.OUTRO_MS));
  }

  private finish(): void {
    this.ending.set(false);
    this.running.set(false);
    this.result.set(this.engine.result);
  }

  /** tower / farm runs: rewards on a win (no penalty for heroes that fell) */
  private grantRewards(): void {
    const out = outcomeOf(this.engine);
    this.outcome.set(out);
    if (this.mode() === 'lab') return;
    const run = { win: out.win, deaths: out.deaths, time: out.time, participants: out.participants, mode: out.mode };
    if (this.mode() === 'farm' && this.farmId()) this.reward.set(this.progression.completeFarm(this.farmId()!, run));
    else if (this.mode() === 'tower') this.reward.set(this.progression.completeTower(this.floor(), run));
  }

  /** result card: go to the next tower floor */
  goNext(): void {
    const n = this.nextFloor();
    if (n == null) return;
    this.router.navigate([], { queryParams: { floor: n, mode: 'tower' } });
    this.selectFloorKeepMode(n);
  }

  /** where "back" goes: the tower, or this dungeon's own menu */
  readonly backLink = computed(() => {
    const f = this.farmId();
    const t = f ? DUNGEON_TYPES.find(x => x.pool === FARM_BY_ID[f].dailyBonusPool) : null;
    return t ? ['/dungeons', t.id] : ['/tower'];
  });

  /** result card: back to the tower / dungeon screen */
  backToTower(): void {
    this.router.navigate(this.backLink());
  }

  private selectFloorKeepMode(n: number): void {
    this.floor.set(n);
    this.prepare();
  }

  /** screen position (cells) of a unit: continuous world position minus the camera */
  private screenOf(u: BattleUnit): { r: number; c: number } {
    return { r: u.y, c: u.x - this.engine.cameraX };
  }

  private snapshot(): void {
    const e = this.engine;
    this.fieldVisuals.advance(e.time);
    const fieldPositions = this.fieldVisuals.positions(e.cameraX);
    if (fieldPositions.size) this.fx.update(l => l.map(f => fieldPositions.has(f.id) ? { ...f, ...fieldPositions.get(f.id)! } : f));
    this.specialCharge.set(e.specialCharge);
    this.specialReady.set(this.running() && e.canUseSpecial());
    const byId = new Map(e.units.map(u => [u.id, u]));
    this.statusVisuals.sync(e.units.filter(u => u.alive && u.visible).flatMap(u => u.buffs.filter(b => b.remaining > 0).map(b => ({
      target: u.id, source: b.sourceId, status: b.def.id, sprite: byId.get(b.sourceId)?.sprite, at: this.screenOf(u),
    }))), e.time);
    const combat = e.phase === BattlePhase.COMBAT;
    for (const u of e.units) {
      const t = u.targetId != null ? byId.get(u.targetId) : undefined;
      const dx = u.x - (this.lastFacingX.get(u.id) ?? u.x);
      this.lastFacingX.set(u.id, u.x);
      // transitions: face where you walk (heroes default forward) · combat: face the target
      if (u.actionFacing) this.facing.set(u.id, u.actionFacing.left);
      else if (!combat && Math.abs(dx) > 1e-3) this.facing.set(u.id, dx < 0);
      else if (!combat && isPlayerUnit(u) && u.life === 'ALIVE' && e.phase !== BattlePhase.REGROUPING) this.facing.set(u.id, false);
      else if (t && t.pos.c !== u.pos.c) this.facing.set(u.id, t.pos.c < u.pos.c);
      else if (!this.facing.has(u.id)) this.facing.set(u.id, u.side === 'enemy');
    }
    const dbg = this.debug() ? e.flow.debugInfo() : null;
    const focus = e.focusTargetId != null ? byId.get(e.focusTargetId) : undefined;
    this.focusSafe.set(!focus || e.units.some(h => isPlayerUnit(h) && h.alive && e.canEngage(h, focus)));
    this.stageDebug.set(dbg);
    this.worldDebug.set(this.debug() ? this.buildWorldDebug() : null);
    const heroDbg = new Map(dbg?.heroes.map(h => [h.id, h.lines]) ?? []);
    this.views.set(
      // only what is physically on the battlefield: DEAD_HIDDEN heroes and old waves' corpses are not rendered
      e.units.filter(u => u.visible).map(u => ({
        id: u.id,
        side: u.side,
        name: u.name,
        cls: u.cls,
        ...this.screenOf(u),
        hpPct: (u.hp / u.maxHp) * 100,
        manaPct: u.maxMana > 0 ? (u.mana / u.maxMana) * 100 : 0,
        shieldPct: (u.shield / u.maxHp) * 100,
        alive: u.alive,
        reviving: u.life === 'REVIVING',
        taunt: hasStatus(u, 'taunt_guard'),
        star: u.star,
        level: u.level,
        sprite: u.sprite,
        boss: u.boss,
        flip: this.facing.get(u.id),
        blink: (this.blinkUntil.get(u.id) ?? 0) > this.engine.time,
        blinkFade: !this.ownFade.has(u.id),
        queued: u.ultQueued,
        focused: u.id === e.focusTargetId,
        selected: u.id === this.selectedId(),
        intent: isPlayerUnit(u) ? u.intent : undefined,
        heroId: u.heroId,
        cd1: Math.max(0, u.cd1),
        cd2: Math.max(0, u.cd2),
        cd1Max: (u.kit ?? kitOf(u.heroId, u.cls)).skill.cooldown ?? 1,
        cd2Max: (u.kit ?? kitOf(u.heroId, u.cls)).skill2.cooldown ?? 1,
        onFocus: isPlayerUnit(u) && e.focusTargetId != null && u.targetId === e.focusTargetId,
        elite: u.elite,
        moveSec: u.monster ? Math.min(0.6, 1 / u.moveSpeed) : undefined,
        moving: this.isMoving(u),
        pace: this.paces.get(u.id),
        hit: this.hits.get(u.id),
        buffed: u.buffs.some(b => (b.def.modifiers.attackMultiplier ?? 1) > 1),
        icon: u.monster ? MONSTERS[u.monster.definitionId]?.animation.tokenIcon : undefined,
        mock: u.sprite ? undefined : mockVisualOf(u.monster ? MONSTERS[u.monster.definitionId]?.visual : undefined),
        bossRank: u.monster && isBossRank(MONSTERS[u.monster.definitionId]?.rank ?? 'COMMON') ? MONSTERS[u.monster.definitionId].rank : undefined,
        statuses: u.buffs.filter(b => STATUS_ICONS[b.def.id]).map(b => ({ id: b.def.id, icon: STATUS_ICONS[b.def.id], left: b.remaining })),
        untargetable: hasFlag(u, 'untargetable'),
        broken: hasFlag(u, 'broken'),
        enraged: u.buffs.some(b => b.def.id === 'guardian_enrage' || b.def.id === 'ancient_rage'),
        debug: this.debug() ? (u.monster ? this.debugLines(u, byId) : heroDbg.get(u.id)) : undefined,
        targetId: u.targetId,
        line: u.line,
        interrupter: isPlayerUnit(u) && kitInterrupts((u.kit ?? kitOf(u.heroId, u.cls)), 'ult'),
        modes: isPlayerUnit(u) ? { skill: e.skills.mode(u, 'skill'), skill2: e.skills.mode(u, 'skill2'), ult: e.skills.mode(u, 'ult') } : undefined,
        cast: u.casting && !(u.casting.def as MonsterSkillDefinition).untargetableWhileCasting
          ? {
              label: u.casting.def.label,
              name: u.casting.def.name,
              pct: (1 - u.casting.left / u.casting.def.castTime) * 100,
              left: Math.max(0, u.casting.left),
              interruptible: u.casting.def.interruptible,
              breakPct: (u.casting.def as MonsterSkillDefinition).breakRequired
                ? (u.casting.breakDamage / (u.casting.def as MonsterSkillDefinition).breakRequired!) * 100
                : undefined,
            }
          : undefined,
      })),
    );
  }

  /** debug overlay text for a monster: name, state, target, HP, cooldowns, skill / cast */
  private debugLines(u: BattleUnit, byId: Map<number, BattleUnit>): string[] {
    const m = monsterSnapshot(u)!;
    const t = m.currentTargetId != null ? byId.get(m.currentTargetId) : undefined;
    const lines = [
      `${u.name} · ${m.state}`,
      `→ ${t ? t.name : '-'} · HP ${Math.ceil(u.hp)}/${u.maxHp}`,
      `atkCD ${m.attackCooldownRemaining.toFixed(1)}`,
    ];
    for (const [id, cd] of Object.entries(m.skillCooldowns)) {
      const casting = u.casting?.def.id === id;
      const tag = casting ? `CASTING ${m.castTimer.toFixed(1)}s` : m.state === 'RECOVERING' && cd > 0 && this.interrupted.has(u.id) ? `INTERRUPTED ${cd.toFixed(1)}` : cd > 0 ? `COOLDOWN ${cd.toFixed(1)}` : 'READY';
      lines.push(`${id}: ${tag}`);
    }
    if (u.buffs.length) lines.push(u.buffs.map(b => `${b.def.id} ${b.remaining.toFixed(1)}s`).join(', '));
    return lines;
  }

  /** units whose last cast was interrupted (debug label) */
  private interrupted = new Set<number>();

  /** last world x seen by the facing (movement direction outside combat) */
  private lastFacingX = new Map<number, number>();



  /** debug overlay in screen cells: anchors (both formations), neutral zone, advance target, regroup radius */
  private buildWorldDebug(): WorldDebug {
    const e = this.engine;
    const cam = e.cameraX;
    const f = e.flow;
    const anchors: WorldDebug['anchors'] = [];
    for (const [form, team] of [[f.formation, 'ally'], [f.enemyFormation, 'enemy']] as const) {
      for (const s of form.slots) {
        anchors.push({
          x: form.originPosition + s.localOffset.x - cam,
          y: s.localOffset.y,
          team,
          label: s.slotId.replace(/_\d+_\d+$/, '') + (s.activeOccupant == null ? ' ∅' : ''),
          empty: s.activeOccupant == null,
        });
      }
    }
    const origin = f.formation.originPosition;
    return {
      anchors,
      neutral: { x0: origin + SIDE_DEPTH - cam, x1: origin + ENEMY_ZONE_START - cam },
      advanceTarget: e.phase === BattlePhase.ADVANCING ? origin + SIDE_DEPTH - cam : null,
      regroupRadius: e.rules.regroupTolerance,
    };
  }

  private showBanner(text: string, ms: number): void {
    clearTimeout(this.bannerTimer);
    this.banner.set(text);
    this.bannerTimer = setTimeout(() => this.banner.set(null), ms / this.speed());
  }

  // ---------------------------------------------------------------- mock FX (independent of the skill data)

  /** screen rectangle of a skill area around a unit (approximation for telegraphs) */
  private areaRect(area: AreaPattern, center: BattleUnit, caster: BattleUnit): { r: number; c: number; w: number; h: number } {
    const p = this.screenOf(center);
    const k = area === 'ADJACENT_8' || area === 'CROSS_1' ? 1 : area === 'RADIUS_2' ? 2 : area === 'RADIUS_3' ? 3 : 0;
    if (area === 'ALL_ENEMIES' || area === 'ALL_ALLIES') {
      const team = this.engine.units.filter(u => u.alive && u.visible && u.side === center.side).map(u => this.screenOf(u));
      if (!team.length) return { r: p.r, c: p.c, w: 1, h: 1 };
      const c0 = Math.min(...team.map(q => q.c)), c1 = Math.max(...team.map(q => q.c));
      return { r: 0, c: c0 - 0.2, w: c1 - c0 + 1.4, h: 3 };
    }
    if (area === 'FRONT_ARC') {
      const q = this.screenOf(caster);
      const dir = this.facing.get(caster.id) ? -1 : 1;
      return { r: q.r - 1, c: dir > 0 ? q.c : q.c - 2, w: 3, h: 3 };
    }
    return { r: p.r - k, c: p.c - k, w: 2 * k + 1, h: 2 * k + 1 };
  }

  private skillByName(u: BattleUnit, name: string): MonsterSkillDefinition | undefined {
    return Object.values(MONSTER_SKILLS).find(s => s.name === name || s.id === name) as MonsterSkillDefinition | undefined;
  }

  private zoneOwner = new Map<number, number[]>();

  private telegraph(src: number, skillName: string, castTime: number, dst?: number): void {
    const u = this.engine.units.find(x => x.id === src);
    const sk = u ? this.skillByName(u, skillName) : undefined;
    if (!u || !sk?.mockFx) return;
    const center = dst != null ? this.engine.units.find(x => x.id === dst) ?? u : sk.target.type === 'ALL_HEROES' ? this.engine.alive(PLAYER_TEAM)[0] ?? u : u;
    const z: ZoneView = { id: ++this.floatId, ...this.areaRect(sk.mockFx.area, center, u), color: sk.mockFx.color, kind: 'telegraph', sec: castTime / this.speed() };
    this.zones.update(l => [...l, z]);
    this.zoneOwner.set(src, [...(this.zoneOwner.get(src) ?? []), z.id]);
  }

  private dropZones(src: number): void {
    const ids = new Set(this.zoneOwner.get(src) ?? []);
    if (!ids.size) return;
    this.zoneOwner.delete(src);
    this.zones.update(l => l.filter(z => !ids.has(z.id)));
  }

  private flash(src: number, skillId: string): void {
    const u = this.engine.units.find(x => x.id === src);
    const sk = u ? this.skillByName(u, skillId) : undefined;
    const rects = this.zoneOwner.get(src) ?? [];
    const last = this.zones().find(z => z.id === rects[rects.length - 1]);
    this.dropZones(src);
    if (!sk?.mockFx || !last) return;
    const z: ZoneView = { ...last, id: ++this.floatId, kind: 'flash' };
    this.zones.update(l => [...l, z]);
    setTimeout(() => this.zones.update(l => l.filter(x => x.id !== z.id)), 500);
  }

  private flashHeroes(color: string): void {
    const hero = this.engine.alive(PLAYER_TEAM)[0];
    if (!hero) return;
    const z: ZoneView = { id: ++this.floatId, ...this.areaRect('ALL_ALLIES', hero, hero), color, kind: 'flash' };
    this.zones.update(l => [...l, z]);
    setTimeout(() => this.zones.update(l => l.filter(x => x.id !== z.id)), 500);
  }

  private handleEvents(events: BattleEvent[]): void {
    if (!events.length) return;
    const anims = { ...this.anims() };
    const floats: FloatText[] = [];
    const fx: FxView[] = [];
    const unitOf = (id: number) => this.engine.units.find(u => u.id === id)!;
    const posOf = (id: number) => this.screenOf(unitOf(id));
    const set = (id: number, anim: AnimState['anim'], extra: Partial<AnimState> = {}) => (anims[id] = { anim, key: ++this.animKey, ...extra });
    /** FX layers of this skill that start on this trigger (data: FxDef.on / event / hitIndex / perHit / anchor / layer) */
    const addFx = (src: number, dst: number | undefined, kind: SkillKind, trig: FxTrigger, hits?: number[]) => {
      const sprite = unitOf(src).sprite;
      for (const name of fxFor(sprite, kind, trig)) {
        const def = FX[name];
        const p = posOf(src);
        const aim = def.groundArea && dst == null ? this.castAim.get(src) : undefined;
        const target = dst ?? aim?.id;
        // contact FX on every unit the hit damaged (capped, primary first) — or the primary only
        const at = def.at === 'target'
          ? (def.perHit ? [...new Set([...(def.hitsOnly ? [] : [target]), ...(hits ?? [])].filter((x): x is number => x != null && !(def.exceptPrimary && x === target) && !!this.engine.units.find(u => u.id === x)))].slice(0, def.perHit === 'all' ? undefined : def.perHit) : target != null ? [target] : [src])
          : [src];
        if (def.at === 'allies') {
          // team field: the centre of the caster's living formation (lanes / columns averaged), never rotated
          const team = this.engine.units.filter(u => u.side === unitOf(src).side && u.alive).map(u => posOf(u.id));
          const r = team.reduce((s, q) => s + q.r, 0) / Math.max(1, team.length);
          const c = team.reduce((s, q) => s + q.c, 0) / Math.max(1, team.length);
          fx.push({ id: ++this.floatId, r: team.length ? r : p.r, c: team.length ? c : p.c, name, angle: 0, flip: !!this.facing.get(src),
            offset: fxOffset(name), under: def.layer === 'under' });
          continue;
        }
        for (const id of at) {
          const q = id === src ? p : posOf(id);
          if (def.span && q === p) continue; // a tether to himself (no ally to link) draws nothing
          const areaCell = (def.groundArea && this.groundLock.get(src)) || groundFxCell(def, unitOf(src).pos, aim?.at ?? unitOf(id).pos,
            unitOf(src).actionFacing?.left ?? this.facing.get(src));
          if (def.groundArea && !this.groundLock.has(src)) this.groundLock.set(src, areaCell);
          const cell = def.groundArea
            ? { r: areaCell.r, c: areaCell.c + this.engine.formation.originPosition - this.engine.cameraX }
            : q;
          const rotate = q !== p && def.orient !== 'flip';
          let angle = rotate ? (Math.atan2(q.r - p.r, q.c - p.c) * 180) / Math.PI : 0;
          // หันตามผู้ใช้ (หรือตามทิศไปหาเป้าหมาย ถ้าเป้าไม่ได้อยู่คอลัมน์เดียวกัน)
          let flip = rotate ? false : q.c !== p.c ? q.c < p.c : !!this.facing.get(src);
          // tether (FxDef.span): from the target back to the caster, stretched to their distance
          let stretch: number | undefined;
          if (def.span && def.at === 'target' && q !== p) {
            angle = (Math.atan2(p.r - q.r, p.c - q.c) * 180) / Math.PI;
            flip = false;
            stretch = Math.hypot(p.c - q.c, p.r - q.r) / fxWidthCells(def);
          }
          // wave arrival (FxDef.arrival): the copy on this unit waits until a wave from the caster reaches it
          const delayMs = def.arrival && q !== p
            ? Math.max(0, Math.hypot(q.c - p.c, q.r - p.r) - def.arrival.from) / def.arrival.speed * 1000 : undefined;
          fx.push({ id: ++this.floatId, r: cell.r, c: cell.c, name, angle, flip, stretch, delayMs, offset: fxOffset(name, def.at === 'self' ? sprite : undefined), under: def.layer === 'under',
            follow: fxAttached(name) ? id : undefined });
        }
      }
    };

    for (const e of events) {
      switch (e.type) {
        case 'FIELD_STARTED':
        case 'FIELD_PULSED':
        case 'FIELD_ENDED':
          this.fieldVisuals.handle(e, unitOf(e.src)?.sprite, this.engine.formation.originPosition, this.engine.time);
          break;
        case 'WAVE_STARTED':
          this.wave.set(e.wave);
          if (e.wave > 0) this.showBanner(`เวฟ ${e.wave + 1}/${e.totalWaves} ศัตรูบุก!`, 1200);
          break;
        case 'special':
          this.showBanner(`⚔ ${this.engine.special.name} · ${e.total.toLocaleString()} ดาเมจ`, 1300);
          {
            const key = Date.now();
            this.specialFlash.set(key);
            setTimeout(() => this.specialFlash() === key && this.specialFlash.set(null), 700);
          }
          break;
        case 'WAVE_CLEARED':
          if (!e.final) this.showBanner(`เคลียร์เวฟ ${e.wave + 1}/${e.totalWaves}!`, 900);
          break;
        case 'ADVANCE_STARTED':
          fx.length = 0;
          this.fx.set([]);
          this.floats.set([]);
          this.projectiles.set([]);
          this.showBanner(`เดินหน้า… ไปเวฟ ${this.wave() + 2}/${this.totalWaves()}`, e.duration * 1000);
          break;
        case 'REGROUP_STARTED':
          fx.length = 0;
          this.motionVisuals.clear();
          this.fx.set([]);
          this.projectiles.set([]);
          break;
        case 'HERO_HIDDEN_AFTER_DEATH':
          this.castFx.delete(e.unit);
          break;
        case 'HERO_REVIVED':
          set(e.unit, 'idle');
          break;
        case 'attack': {
          set(e.src, 'attack');
          const sheet = SHEETS[unitOf(e.src).sprite ?? ''];
          if (sheet?.attackFx) {
            const p = posOf(e.src);
            for (const name of sheet.attackFx) {
              if (!FX[name]) continue;
              fx.push({ id: ++this.floatId, r: p.r, c: p.c, name, angle: 0, flip: !!this.facing.get(e.src),
                offset: fxOffset(name, unitOf(e.src).sprite), under: FX[name].layer === 'under',
                follow: fxAttached(name) ? e.src : undefined });
            }
          }
          break;
        }
        case 'move':
          if (anims[e.src]?.anim !== 'die') set(e.src, 'walk');
          break;
        case 'cast': {
          this.groundLock.delete(e.src);
          if (e.dst != null) this.castAim.set(e.src, { id: e.dst, at: { ...unitOf(e.dst).pos } });
          else this.castAim.delete(e.src);
          set(e.src, e.kind);
          const p = posOf(e.src);
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: e.skill, kind: 'skill' });
          addFx(e.src, e.dst, e.kind, { on: 'cast' });
          fx.push(...sequenceFx(unitOf(e.src).sprite, e.kind, e.src, e.dst, this.animKey, posOf, unitOf(e.src).actionFacing?.left ?? !!this.facing.get(e.src))
            .map(f => ({ ...f, id: ++this.floatId })));
          break;
        }
        case 'impact': {
          addFx(e.src, e.dst, e.kind, { on: 'impact', hit: e.index }, e.hits);
          // contact feel authored on the clip (AnimDef.impact, per hit): hit-stop + shake (+ flash) — only on a real hit
          if (e.hits?.length !== 0) {
            const ip = posOf(e.dst != null && this.engine.units.some(u => u.id === e.dst) ? e.dst : e.src);
            const stop = playImpactFeel(this.boardEl()?.nativeElement, impactFeelOf(unitOf(e.src).sprite, e.kind, e.index ?? 0), { c: ip.c, r: ip.r + SCENERY_ROWS });
            if (stop) this.hitStopUntil = Math.max(this.hitStopUntil, performance.now() + stop);
          }
          break;
        }
        case 'animEvent':
          if (e.event === 'ANIMATION_END') {
            this.fx.update(list => list.filter(f => f.owner !== e.src || !!f.track));
            fx.splice(0, fx.length, ...fx.filter(f => f.owner !== e.src || !!f.track));
          }
          this.motionVisuals.handle(e.src, unitOf(e.src)?.sprite, e.kind, e.event);
          // hero clip events (VFX_SPAWN, CHARGE_START, STRIKE_START …): the FX layers bound to them; missing FX = no-op
          if (e.kind) {
            addFx(e.src, e.dst, e.kind, { on: 'event', event: e.event, index: e.index });
            const fp = posOf(e.dst != null && this.engine.units.some(u => u.id === e.dst) ? e.dst : e.src);
            const stop = playImpactFeel(this.boardEl()?.nativeElement, eventFeelOf(unitOf(e.src).sprite, e.kind, e.event), { c: fp.c, r: fp.r + SCENERY_ROWS });
            if (stop) this.hitStopUntil = Math.max(this.hitStopUntil, performance.now() + stop);
          }
          break;
        case 'blink':
          // วาร์ป: ย้ายทันที + ค่อย ๆ ปรากฏ (ไม่ไถลข้ามสนาม)
          this.blinkUntil.set(e.src, this.engine.time + 0.3);
          // a clip that draws its own vanish / reappear (AnimDef.opacity) → no board blink-in fade on top of it
          if (animOf(unitOf(e.src).sprite, anims[e.src]?.anim ?? 'idle')?.opacity) this.ownFade.add(e.src);
          else this.ownFade.delete(e.src);
          break;
        case 'damage': {
          if (!e.poison && e.hurt !== false && anims[e.dst]?.anim !== 'die') set(e.dst, 'hurt');
          // white hit flash (Pixi renderer): every real, non-poison hit
          if (e.amount > 0 && !e.poison) this.hits.set(e.dst, (this.hits.get(e.dst) ?? 0) + 1);
          const p = posOf(e.dst);
          const text = e.amount > 0 ? `-${e.amount}` : 'บล็อก';
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text, kind: e.poison ? 'poison' : e.crit ? 'crit' : 'dmg' });
          break;
        }
        case 'shield': {
          const p = posOf(e.dst);
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: `+โล่ ${e.amount}`, kind: 'shield' });
          // ตัวผู้ให้มีเอฟเฟกต์ท่าไม้ตายอยู่แล้ว ส่วนเพื่อนได้โดมโล่เล็ก
          const ward = SHEETS[unitOf(e.src).sprite ?? '']?.shieldFx;
          if (e.src !== e.dst && ward && FX[ward]) fx.push({ id: ++this.floatId, r: p.r, c: p.c, name: ward, angle: 0 });
          break;
        }
        case 'cleanse': {
          const p = posOf(e.dst);
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: 'ชำระล้าง', kind: 'shield' });
          break;
        }
        case 'projectile': {
          const src = unitOf(e.src);
          const name = SHEETS[src.sprite ?? '']?.projectile?.[e.kind] ?? CLASS_PROJECTILE[src.cls];
          if (!name || !FX[name]) break;
          const p = posOf(e.src), q = posOf(e.dst);
          const to = { x: q.c, y: q.r + SCENERY_ROWS };
          // ตกจากฟ้า: เริ่มเหนือเป้า 3 ช่อง เยื้องมาทางฝั่งผู้ยิง
          const dir = isPlayerUnit(src) ? -1 : 1;
          const from = e.sky ? { x: to.x + dir * 1.2, y: to.y - 3.2 }
            : projectileOrigin(name, { x: p.c, y: p.r + SCENERY_ROWS }, to.x, -dir);
          // piercing blade: keeps flying past the target at the same speed (visual only — damage already timed)
          let end = to, flight = e.flight * 1000;
          const over = FX[name].overshoot;
          if (over && !e.sky) {
            const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
            end = { x: to.x + ((to.x - from.x) / len) * over, y: to.y + ((to.y - from.y) / len) * over };
            flight *= (len + over) / len;
          }
          const pv: ProjectileView = { id: ++this.floatId, name, from, to: end, flight };
          const sp = this.speed();
          this.projectiles.update(l => [...l, pv]);
          setTimeout(() => this.projectiles.update(l => l.filter(x => x.id !== pv.id)), projectileLife(pv.flight, sp));
          const hit = FX[name].hitFx;
          if (hit && FX[hit]) {
            setTimeout(() => {
              const f: FxView = { id: ++this.floatId, r: q.r, c: q.c, name: hit, angle: 0 };
              this.fx.update(l => [...l, f]);
              setTimeout(() => this.fx.update(l => l.filter(x => x.id !== f.id)), fxDuration(hit, sp) + 50);
            }, pv.flight / sp);
          }
          break;
        }
        case 'revive': {
          set(e.dst, 'idle');
          const p = posOf(e.dst);
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: `คืนชีพ! +${e.amount}`, kind: 'revive' });
          break;
        }
        case 'heal': {
          const p = posOf(e.dst);
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: `+${e.amount}`, kind: 'heal' });
          // เอฟเฟกต์ฮีลของผู้รักษา (ถ้าแผ่นกำหนดไว้)
          const hf = e.src != null ? SHEETS[unitOf(e.src).sprite ?? '']?.healFx : undefined;
          if (hf && FX[hf]) fx.push({ id: ++this.floatId, r: p.r, c: p.c, name: hf, angle: 0 });
          break;
        }
        case 'focus':
          this.focusId.set(e.dst);
          if (e.dst == null && e.reason === 'dead') this.showBanner('🎯 เป้าโฟกัสล้มแล้ว — ทีมกลับไปใช้ AI ปกติ', 1400);
          break;
        case 'breakGauge': {
          const p = posOf(e.dst);
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: `BREAK ${e.value}/${e.max}`, kind: 'break' });
          break;
        }
        case 'broken': {
          const p = posOf(e.dst);
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: 'BREAK!!', kind: 'break' });
          this.dropZones(e.dst);
          this.showBanner('💥 BREAK! บอสเสียหลัก 3 วิ — รับดาเมจ +25%', 1600);
          set(e.dst, 'hurt', { force: true });
          break;
        }
        case 'bossPhase':
          this.bossPhase.set(e.label);
          this.dropZones(e.src);
          this.showBanner(`⚠ ${unitOf(e.src).name}: ${e.label}`, 1800);
          break;
        case 'sealBroken':
          this.showBanner('🔓 ผนึกแตก! โจมตีบอสได้แล้ว', 1400);
          break;
        case 'pulse': {
          const p = posOf(e.src);
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: e.name, kind: 'skill' });
          this.flashHeroes('#6b2bd6');
          break;
        }
        case 'soulLink': {
          const p = posOf(e.dst);
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: `🔗-${e.amount}`, kind: 'dmg' });
          break;
        }
        case 'castStart': {
          this.telegraph(e.src, e.skill, e.castTime, e.dst);
          // monster cast clip (e.g. Alpha Howl): frames stretched over the cast time; sheets without one fall back
          if (SHEETS[unitOf(e.src).sprite ?? '']?.anims.cast) {
            const sk = this.skillByName(unitOf(e.src), e.skill);
            set(e.src, 'cast', { castTime: e.castTime, castClip: sk?.clip });
          }
          const p = posOf(e.src);
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: e.skill, kind: 'skill' });
          break;
        }
        case 'fx': {
          // cast FX (e.g. Alpha Howl) — started by the engine so its activation frame lands on SKILL_ACTIVATE
          const p = posOf(e.src);
          const f: FxView = { id: ++this.floatId, r: p.r, c: p.c, name: e.name, angle: 0, flip: !!this.facing.get(e.src) };
          this.castFx.set(e.src, f.id);
          fx.push(f);
          break;
        }
        case 'fxStop': {
          const id = this.castFx.get(e.src);
          if (id != null) this.fx.update(l => l.filter(x => x.id !== id));
          this.castFx.delete(e.src);
          break;
        }
        case 'skillActivated': {
          this.flash(e.src, e.skill);
          // sprite FX on every unit the skill landed on (Starfall, Devour, Arcane Seal …)
          const hitFx = this.skillByName(unitOf(e.src), e.skill)?.hitFx;
          if (hitFx && FX[hitFx]) {
            for (const id of e.targets) {
              const q = posOf(id);
              fx.push({ id: ++this.floatId, r: q.r, c: q.c, name: hitFx, angle: 0, flip: !!this.facing.get(e.src) });
            }
          }
          const p = posOf(e.src);
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: e.name + '!', kind: 'skill' });
          this.castFx.delete(e.src);
          this.interrupted.delete(e.src);
          break;
        }
        case 'buff': {
          const p = posOf(e.dst);
          const name = appliedStatusFx(unitOf(e.src).sprite, e.buff);
          if (name) fx.push({ id: ++this.floatId, r: p.r, c: p.c, name, angle: 0,
            offset: fxOffset(name), under: FX[name].layer === 'under', follow: fxAttached(name) ? e.dst : undefined });
          const text = e.buff === 'alpha_howl_buff' ? (e.refreshed ? 'ATK↑ ต่อเวลา' : 'ATK +25%') : e.refreshed ? '' : e.name;
          if (text) floats.push({ id: ++this.floatId, r: p.r, c: p.c, text, kind: 'buff' });
          break;
        }
        case 'retaliateStart': {
          // Blood Reprisal: the burst (Crimson Spike Eruption) starts on the threshold hit; damage lands at its peak
          const name = retaliateFx(unitOf(e.src).sprite, e.status);
          const p = posOf(e.src);
          if (name) fx.push({ id: ++this.floatId, r: p.r, c: p.c, name, angle: 0, offset: fxOffset(name),
            under: FX[name].layer === 'under', follow: fxAttached(name) ? e.src : undefined });
          break;
        }
        case 'retaliate': {
          // Blood Reprisal peak: label the eruption on the holder
          const p = posOf(e.src);
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: 'โลหิตตอบแทน', kind: 'dmg' });
          break;
        }
        case 'reflect': {
          const p = posOf(e.dst);
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: `สะท้อน -${e.amount}`, kind: 'dmg' });
          break;
        }
        case 'miss': {
          const p = posOf(e.src);
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: 'MISS', kind: 'miss' });
          break;
        }
        case 'interrupt': {
          this.fx.update(list => list.filter(f => f.owner !== e.dst));
          fx.splice(0, fx.length, ...fx.filter(f => f.owner !== e.dst));
          this.dropZones(e.dst);
          this.interrupted.add(e.dst);
          const p = posOf(e.dst);
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: 'INTERRUPTED!', kind: 'interrupt' });
          set(e.dst, 'hurt', { force: true });
          break;
        }
        case 'immune': {
          const p = posOf(e.dst);
          const casting = unitOf(e.dst).casting?.def.name === e.skill;
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: casting ? 'UNINTERRUPTIBLE' : `IMMUNE ${e.skill}`, kind: 'immune' });
          break;
        }
        case 'castCancel':
          this.fx.update(list => list.filter(f => f.owner !== e.src));
          fx.splice(0, fx.length, ...fx.filter(f => f.owner !== e.src));
          this.dropZones(e.src);
          break;
        case 'death':
          this.fx.update(list => list.filter(f => f.owner !== e.dst));
          fx.splice(0, fx.length, ...fx.filter(f => f.owner !== e.dst));
          this.dropZones(e.dst);
          set(e.dst, 'die');
          break;
      }
    }
    this.anims.set(anims);
    for (const f of fx) {
      this.fx.update(list => [...list, f]);
      if (f.owner == null) setTimeout(() => this.fx.update(list => list.filter(x => x.id !== f.id)), fxDuration(f.name, this.speed()) + (f.delayMs ?? 0) / this.speed() + 50);
    }
    if (floats.length) {
      this.floats.update(f => [...f, ...floats].slice(-40));
      const ids = new Set(floats.map(f => f.id));
      setTimeout(() => this.floats.update(f => f.filter(x => !ids.has(x.id))), 900);
    }
  }
}
