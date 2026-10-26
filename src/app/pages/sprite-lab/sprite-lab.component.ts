import { GameAccessService } from '../../core/services/game-access.service';
import { TowerOrnamentComponent } from '../tower/tower-ornament.component';
import { CitadelIconComponent } from '../../shared/citadel-icon.component';
import { heroArt } from '../../core/data/hero-art';
import { CitadelFrameComponent } from '../../shared/citadel-frame.component';
import { sequenceFx } from '../../battle/render/sequence-fx';
import { Component, computed, ElementRef, inject, OnDestroy, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AnimState, BoardComponent, FloatText, FxView, ProjectileView, UnitView } from '../../battle/board/board.component';
import { fxDuration } from '../../battle/fx-sprite/fx-sprite.component';
import { projectileLife } from '../../battle/projectile/projectile.component';
import { playImpactFeel } from '../../battle/impact-feel/impact-feel';
import { BoardRenderer, savedRenderer, saveRenderer } from '../../battle/render/renderer-pref';
import { SCENERY_ROWS } from '../../battle/engine/grid';
import { BACKGROUNDS } from '../../core/data/backgrounds';
import { MONSTERS } from '../../core/data/monsters';
import { HEROES } from '../../core/data/heroes';
import { animEvents, animOf, animTiming, clipClock, eventFeelOf, FX, fxAttached, fxFor, fxOffset, FxTrigger, FRAME_MS, IDLE_FRAME_MS, impactFeelOf, SHEETS, SkillKind, SpriteAnim } from '../../core/data/sprites';
import { kitOf } from '../../core/data/hero-skills';
import { appliedStatusFx } from '../../core/data/sprites';
import { STATUS_ICONS } from '../../core/data/visuals';
import { groundFxCell } from '../../battle/render/fx-clip';
import { FieldFxPlayback } from '../../battle/render/field-fx';
import { StatusFxPlayback } from '../../battle/render/status-fx';
import { MotionFxPlayback } from '../../battle/render/motion-fx';
import { skillReview } from './skill-review';
import { SkillDefinition } from '../../core/models/combat';

type Action = 'idle' | 'walk' | 'attack' | 'hurt' | 'die' | SkillKind;

const HERO_ID = 1;
const DUMMY_IDS = [2, 3];
const DUMMY_SPRITE = 'enemy-straw-recruit.png';

/**
 * Sprite lab (`/sprite-lab?hero=bailong`): plays one hero's states on the real board against training dummies,
 * through the SAME pieces the battle uses — UnitSprite clips, `animEvents()` (semantic events from the sheet data),
 * FX layer (`on: 'vfx'` at VFX_SPAWN, pivot / anchor / flip), `playImpactFeel()` (hit-stop + shake) — no combat
 * engine, no balance. Loop repeats the chosen action; slow-motion and the anchor overlay help check timing / pivots.
 */
@Component({
  selector: 'app-sprite-lab',
  imports: [TowerOrnamentComponent, CitadelIconComponent, CitadelFrameComponent, BoardComponent, RouterLink],
  templateUrl: './sprite-lab.component.html',
  styles: `
    .lab { container-type: inline-size; padding: 12px; display: grid; gap: 10px; max-width: 980px; margin: 0 auto; }
    header { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    h1 { font-size: 18px; margin: 0; flex: 1; }
    .comparison { margin: 0; text-align: center; font-size: 13px; color: #b9cee2; }
    .stage { position: relative; --cell: min(56px, 6.25cqw); width: calc(16 * var(--cell)); max-width: 100%; margin: 0 auto; }
    .stage app-board { --cell: min(56px, 6.25cqw); }
    .mark { position: absolute; width: 9px; height: 9px; margin: -4.5px 0 0 -4.5px; border-radius: 50%; z-index: 300; pointer-events: none; }
    .mark.root { background: #ff3b3b; box-shadow: 0 0 0 2px #fff; }
    .mark.tip { background: #3bd1ff; box-shadow: 0 0 0 2px #fff; }
    .mark b { position: absolute; left: 10px; top: -4px; font: 600 9px monospace; color: #fff; text-shadow: 0 0 2px #000; white-space: nowrap; }
    .controls { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: center; }
    button { padding: 8px 14px; border-radius: 8px; border: 1px solid var(--line, #555); background: var(--panel2, #222); color: inherit; }
    button.on { outline: 2px solid var(--accent, #7cf); }
    .log { font: 12px/1.5 monospace; max-height: 180px; overflow: auto; margin: 0; padding-left: 20px; }
  `,
})
export class SpriteLabComponent implements OnDestroy {
  readonly access = inject(GameAccessService);
  readonly spriteHeroes = HEROES.filter(h => h.sprite && SHEETS[h.sprite]);
  onFxFinished(ids: number[]): void {
    const done = new Set(ids);
    this.fx.update(list => list.filter(f => !done.has(f.id)));
  }

  private readonly qp = inject(ActivatedRoute).snapshot.queryParamMap;
  /** Optional lab-only comparison uses real roster sheets, never changes saves or combat. */
  readonly comparisonHeroes = HEROES.filter(h => (this.qp.get('compare') ?? '').split(',').includes(h.id) && h.sprite && SHEETS[h.sprite]).slice(0, 2);
  readonly comparisonNames = this.comparisonHeroes.map(h => h.name).join(' / ');
  readonly previewBackground = BACKGROUNDS[this.qp.get('bg') ?? ''] ?? BACKGROUNDS['forest-1'];
  private readonly comparisonMonster = MONSTERS[this.qp.get('enemy') ?? ''];
  private readonly targetDistance = Math.min(5, Math.max(1, Number(this.qp.get('distance')) || 1));
  readonly engineReview = this.qp.get('combat') === '1';
  readonly initialStatus = this.qp.get('status') ?? '';
  private readonly dummyIds = this.qp.get('formation') === 'front2x3' ? [2, 3, 4, 5, 6, 7] : ['square', 'home', 'field'].includes(this.qp.get('formation') ?? '') ? [2, 3, 4, 5] : DUMMY_IDS;
  private readonly reviewVitals = signal<Record<number, { hpPct: number; shieldPct: number }>>({});
  private readonly reviewPositions = signal<Partial<Record<number, { r: number; c: number; flip?: boolean }>>>({});
  private readonly motionVisuals = new MotionFxPlayback({
    spawn: (name, source, loop) => {
      const u = this.units().find(u => u.id === source)!;
      const id = ++this.id;
      this.fx.update(l => [...l, { id, name, r: u.r, c: u.c, angle: 0, flip: u.flip,
        offset: fxOffset(name), under: FX[name].layer === 'under', follow: source, managed: true, loop }]);
      return id;
    },
    remove: ids => this.fx.update(l => l.filter(f => !ids.includes(f.id))),
  });
  private readonly reviewStatuses = signal<Record<number, { id: string; left: number }[]>>({});
  readonly heroId = signal(this.qp.get('hero') ?? 'bailong');
  readonly hero = computed(() => this.spriteHeroes.find(h => h.id === this.heroId()) ?? this.spriteHeroes[0]);
  readonly heroName = computed(() => this.hero()?.name ?? '');
  readonly heroPortrait = computed(() => heroArt(this.hero()?.id)?.portrait);
  readonly actionLabels: Record<Action, string> = { idle: 'Idle', walk: 'Walk', attack: 'Attack', hurt: 'Hurt', die: 'Die', skill: 'S1', skill2: 'S2', ult: 'ULT' };
  readonly animationInfo = computed(() => {
    const sheet = this.sheet();
    const clip = animOf(this.hero()?.sprite, this.last());
    if (!sheet || !clip) return null;
    const clock = clipClock(this.last() === 'idle' ? { ...clip, ms: clip.ms ?? IDLE_FRAME_MS } : clip);
    return { frames: clock.count, fps: (clock.count / clock.total).toFixed(1), seconds: clock.total.toFixed(2), size: `${sheet.cellW} × ${sheet.cellH}` };
  });
  readonly sheet = computed(() => SHEETS[this.hero()?.sprite ?? '']);

  readonly speed = signal(1);
  /** same renderer switch as the battle (`?render=pixi|dom`, remembered) — check a clip exactly as the battle draws it */
  readonly renderer = signal<BoardRenderer>(this.qp.get('render') === 'pixi' ? 'pixi' : this.qp.get('render') === 'dom' ? 'dom' : savedRenderer());
  /** Pixi board clock stands still during the authored hit-stop (DOM animations are paused by playImpactFeel) */
  private hitStopUntil = 0;
  readonly frozen = (): boolean => performance.now() < this.hitStopUntil;
  readonly loop = signal(false);
  readonly faceLeft = signal(false);
  readonly showAnchors = signal(false);
  readonly last = signal<Action>('idle');
  readonly activeEngineReview = computed(() => {
    const action = this.last();
    if (action !== 'skill' && action !== 'skill2' && action !== 'ult') return false;
    const h = this.hero();
    return this.enginePlayback(kitOf(h.id, h.cls)[action]);
  });
  /** blink clips (AnimDef.move): columns the hero is relocated by until the clip ends · own-fade = clip opacity */
  readonly blinked = signal<{ dc: number; ownFade: boolean } | null>(null);
  readonly anims = signal<Partial<Record<number, AnimState>>>({});
  readonly fx = signal<FxView[]>([]);
  private fieldVisuals = new FieldFxPlayback({
    spawn: (name, world, loop) => {
      const id = ++this.id;
      this.fx.update(l => [...l, { id, name, r: world.r, c: world.c, angle: 0,
        offset: fxOffset(name), under: FX[name].layer === 'under', managed: true, loop }]);
      return id;
    },
    remove: ids => this.fx.update(l => l.filter(f => !ids.includes(f.id))),
  });
  private statusVisuals = new StatusFxPlayback({
    spawn: (name, target, at, loop) => {
      const id = ++this.id;
      this.fx.update(l => [...l, { id, name, ...at, angle: 0, offset: fxOffset(name),
        under: FX[name].layer === 'under', follow: target, managed: true, loop }]);
      return id;
    },
    remove: ids => this.fx.update(l => l.filter(f => !ids.includes(f.id))),
  });
  readonly projectiles = signal<ProjectileView[]>([]);
  readonly floats = signal<FloatText[]>([]);
  readonly log = signal<{ t: string; text: string }[]>([]);

  private readonly boardEl = viewChild(BoardComponent, { read: ElementRef });

  private enginePlayback(skill: SkillDefinition): boolean {
    return this.engineReview || skill.action?.type === 'STATIONARY' || skill.movement?.type === 'DASH_PATH' || skill.target === 'LOWEST_HP_ALLY' || skill.effects.some(e => e.type === 'FIELD') || (skill.delivery === 'PROJECTILE' && skill.effects.some(e => e.type === 'DAMAGE' && e.area !== 'SINGLE'));
  }

  setRenderer(r: BoardRenderer): void {
    this.renderer.set(r);
    saveRenderer(r);
  }

  /** impact feel + hold the Pixi clock for its hit-stop */
  private feel(f: Parameters<typeof playImpactFeel>[1]): void {
    const stop = playImpactFeel(this.boardEl()?.nativeElement, f);
    if (stop) this.hitStopUntil = Math.max(this.hitStopUntil, performance.now() + stop);
  }
  private timers: ReturnType<typeof setTimeout>[] = [];
  private key = 0;
  private id = 0;

  /** hero in lane 1, column 5 · dummies right in front (column 6) and one behind it (7) — LINE_2 */
  readonly units = computed<UnitView[]>(() => {
    const h = this.hero();
    const left = this.faceLeft();
    const action = this.last();
    const fieldSupport = (action === 'skill' || action === 'skill2' || action === 'ult') && kitOf(h.id, h.cls)[action].effects.some(e => e.type === 'FIELD' && e.field.aura?.team === 'ALLY');
    const centeredField = fieldSupport && (action === 'skill' || action === 'skill2' || action === 'ult') && kitOf(h.id, h.cls)[action].effects.some(e => e.type === 'FIELD' && e.field.area === 'RECT_6X3_CENTERED');
    const support = fieldSupport || ((action === 'skill' || action === 'skill2' || action === 'ult') && kitOf(h.id, h.cls)[action].target === 'LOWEST_HP_ALLY');
    const base = { hpPct: 100, manaPct: 0, shieldPct: 0, alive: true, taunt: false };
    const hc = fieldSupport ? (left ? 12 : 3) : left ? 8 : 5;
    const b = this.blinked();
    return [
      { ...base, id: HERO_ID, side: 'ally', name: h.name, cls: h.cls, r: 1, c: hc + (b ? b.dc * (left ? -1 : 1) : 0), sprite: h.sprite, star: h.star, heroId: h.id, flip: left, ...(this.reviewVitals()[HERO_ID] ?? {}),
        blink: !!b, blinkFade: !b?.ownFade, ...(this.reviewPositions()[HERO_ID] ?? {}) },
      ...this.comparisonHeroes.filter(other => other.id !== h.id).map((other, i) => ({
        ...base, id: 100 + i, side: 'ally' as const, name: other.name, cls: other.cls,
        r: 1, c: hc - (i + 1) * 2 * (left ? -1 : 1), sprite: other.sprite, star: other.star, heroId: other.id, flip: left,
      })),
      ...this.dummyIds.map((id, i) => ({
        ...base, id, side: support ? 'ally' as const : 'enemy' as const,
        hpPct: this.reviewVitals()[id]?.hpPct ?? (support ? (i === 0 ? 40 : 70) : 100),
        shieldPct: this.reviewVitals()[id]?.shieldPct ?? 0,
        name: support ? 'พันธมิตรฝึก' : this.comparisonMonster?.name ?? 'หุ่นฝึก', cls: 'tank' as const,
        r: this.dummyIds.length === 6 ? Math.floor(i / 2) : centeredField ? [1, 0, 2, 2][i] : fieldSupport ? [0, 1, 2, 2][i] : this.dummyIds.length === 4 ? 1 + Math.floor(i / 2) : 1,
        c: centeredField ? (left ? 15 - [7, 6, 8, 3][i] : [7, 6, 8, 3][i]) : fieldSupport ? (left ? 15 - [1, 2, 4, 1][i] : [1, 2, 4, 1][i]) : hc + (this.targetDistance + (this.dummyIds.length >= 4 ? i % 2 : i)) * (left ? -1 : 1),
        sprite: support ? 'hero-bailong.png' : this.comparisonMonster?.animation.sheet ?? DUMMY_SPRITE, flip: support ? left : !left,
        statuses: (this.reviewStatuses()[id] ?? []).filter(b => STATUS_ICONS[b.id]).map(b => ({ ...b, icon: STATUS_ICONS[b.id] })),
      })),
    ];
  });

  readonly actions = computed(() => {
    const h = this.hero();
    const kit = kitOf(h.id, h.cls);
    const skills: { id: Action; label: string }[] = [
      { id: 'skill', label: kit.skill.label ?? 'S1' },
      { id: 'skill2', label: kit.skill2.label ?? 'S2' },
      { id: 'ult', label: kit.ult.label ?? 'Ultimate' },
    ];
    return this.access.isGm() ? [
      { id: 'idle' as Action, label: 'Idle' }, { id: 'walk' as Action, label: 'Walk' },
      { id: 'attack' as Action, label: 'Attack' }, { id: 'hurt' as Action, label: 'Hurt' },
      { id: 'die' as Action, label: 'Die' }, ...skills,
    ] : skills;
  });

  /** root (feet) and the sheet's named anchors in board px — the same maths the board / FX layer use */
  readonly mark = computed(() => {
    const u = this.units()[0];
    const cell = (k: number) => `calc(var(--cell) * ${k})`;
    const root = { x: cell(u.c + 0.5), y: cell(u.r + SCENERY_ROWS + 0.7725) };
    const anchors = Object.entries(this.sheet()?.anchors ?? {})
      .filter(([n]) => n !== 'feet')
      .map(([name, [dx, dy]]) => ({ name, x: cell(u.c + 0.5 + (dx / 100) * (u.flip ? -1 : 1)), y: cell(u.r + SCENERY_ROWS + 0.5 + dy / 100) }));
    return { root, anchors };
  });

  ngOnDestroy(): void {
    this.clear();
  }

  reset(): void {
    this.clear();
    this.blinked.set(null);
    this.fx.set([]);
    this.set(HERO_ID, 'idle');
    this.dummyIds.forEach(id => this.set(id, 'idle'));
  }

  play(a: Action): void {
    if (!this.access.isGm() && a !== 'skill' && a !== 'skill2' && a !== 'ult') return;
    this.clear();
    this.last.set(a);
    this.log.set([]);
    if (a === 'idle') {
      this.dummyIds.forEach(id => this.set(id, 'idle'));
      this.set(HERO_ID, 'idle');
      return;
    }
    const sprite = this.hero().sprite;
    this.set(HERO_ID, a as SpriteAnim, { force: true });
    const clip = animOf(sprite, a as 'attack' | SkillKind) ?? this.sheet()?.anims[a as SpriteAnim];
    const clk = clip ? clipClock(clip) : null;
    const len = clk ? clk.total : 0.5;
    this.note(0, `${a} start · ${clip?.steps ? `${clk!.count} key poses (choreographed)` : `${clip?.frames ?? '?'} frames × ${clip?.ms ?? FRAME_MS} ms`} = ${len.toFixed(2)} s`);

    if (this.blinked()) this.blinked.set(null);
    const kitSkill = a === 'skill' || a === 'skill2' || a === 'ult' ? kitOf(this.hero().id, this.hero().cls)[a] : undefined;
    // Lab-only single-target projectile preview. Contact follows travel, just as in the combat engine.
    const singleProjectile = kitSkill?.delivery === 'PROJECTILE' && kitSkill.effects.some(e => e.type === 'DAMAGE' && e.area === 'SINGLE');
    if (kitSkill && this.enginePlayback(kitSkill)) {
      const duration = this.playEngineReview(a as SkillKind);
      if (this.loop()) this.at(duration + 0.4, () => this.play(a));
      return;
    }
    if (clip?.move != null && kitSkill?.movement?.type === 'BLINK_BEHIND') {
      // blink skill: stand on the front dummy's cell (the back dummy is the target) from the clip's `move`, back after it
      const mt = clk!.at(clip.move);
      this.at(mt, () => (this.blinked.set({ dc: 1, ownFade: !!clip.opacity }), this.note(mt, 'blink → 1 cell ahead (BLINK_BEHIND)')));
      this.at(len + 0.4, () => this.blinked.set(null));
    }
    if (a === 'attack' || a === 'skill' || a === 'skill2' || a === 'ult') {
      const events = animEvents(sprite, a);
      const tm = animTiming(sprite, a);
      // sheets without authored events: the old hit frame(s) are the DAMAGE (+ IMPACT for skills)
      const list = events.length ? events : tm.hits.map((t, index) => ({ event: 'DAMAGE' as const, t, frame: -1, index, art: undefined as number | undefined }));
      const kind = a === 'attack' ? null : a;
      const hasImpact = list.some(e => e.event === 'IMPACT');
      for (const ev of list) {
        if (singleProjectile && ev.event === 'IMPACT') continue; // contact is scheduled by flight, not the cast clip
        this.at(ev.t, () => {
          this.note(ev.t, `${ev.event}${ev.index ? ' #' + (ev.index + 1) : ''}${ev.event === 'ANIMATION_END' ? ' (end)' : ev.frame >= 0 ? ` (frame ${(ev.art ?? ev.frame) + 1})` : ''}`);
          if (!kind) {
            if (ev.event === 'DAMAGE') this.hitDummies('attack', 0);
            return;
          }
          if (ev.event !== 'DAMAGE' && ev.event !== 'IMPACT') this.spawn(kind, { on: 'event', event: ev.event, index: ev.index });
          this.feel(eventFeelOf(sprite, kind, ev.event));
          if (ev.event === 'DAMAGE') {
            if (singleProjectile) {
              this.launchSingleProjectile(kind, ev.t, () => {
                const hits = this.hitDummies(kind, ev.index, true);
                this.spawn(kind, { on: 'impact', hit: ev.index }, hits);
                this.feel(impactFeelOf(sprite, kind, ev.index));
              });
              return;
            }
            const hits = this.hitDummies(kind, ev.index);
            this.spawn(kind, { on: 'impact', hit: ev.index }, hits);
            if (!hasImpact) this.feel(impactFeelOf(sprite, kind, ev.index));
          }
          if (ev.event === 'IMPACT') this.feel(impactFeelOf(sprite, kind, ev.index));
        });
      }
      if (kind) this.spawn(kind, { on: 'cast' });
    }
    if (this.loop() && a !== 'die') this.at(len + 0.6, () => this.play(a));
    if (this.loop() && a === 'die') this.at(len + 1.2, () => (this.set(HERO_ID, 'idle'), this.play('die')));
  }

  /** Presentation demo only: engine hero flight rule (0.1 + 0.06 × cell distance), not a fixed VFX delay. */
  private launchSingleProjectile(kind: SkillKind, release: number, contact: () => void): void {
    const name = this.sheet()?.projectile?.[kind];
    const [me] = this.units();
    const target = this.units().find(u => u.id === this.dummyIds[0])!;
    const flight = 0.1 + 0.06 * Math.max(Math.abs(target.c - me.c), Math.abs(target.r - me.r));
    if (name && FX[name]) {
      const p: ProjectileView = { id: ++this.id, name,
        from: { x: me.c, y: me.r + SCENERY_ROWS }, to: { x: target.c, y: target.r + SCENERY_ROWS }, flight: flight * 1000 };
      this.projectiles.update(l => [...l, p]);
      this.at(projectileLife(p.flight) / 1000, () => this.projectiles.update(l => l.filter(x => x.id !== p.id)));
    }
    this.at(flight, () => { this.note(release + flight, 'IMPACT · projectile arrival (visual preview)'); contact(); });
  }

  /** the FX layers bound to this trigger (same `fxFor` / `fxOffset` the battle page uses) */
  private spawn(kind: SkillKind, trig: FxTrigger, hits: number[] = []): void {
    const sprite = this.hero().sprite;
    const names = fxFor(sprite, kind, trig);
    if (!names.length && !SHEETS[sprite ?? '']?.sequenceFx?.[kind]?.length && trig.on === 'event' && trig.event === 'VFX_SPAWN') this.note(-1, 'no VFX for VFX_SPAWN → skipped (combat unaffected)');
    const units = this.units();
    const me = units[0];
    for (const name of names) {
      const def = FX[name];
      const at = def.at === 'target' ? (trig.on === 'event' ? this.dummyIds.slice(0, 1) : hits).slice(def.exceptPrimary ? 1 : 0).slice(0, def.perHit === 'all' ? undefined : def.perHit ?? 1).map(id => units.find(x => x.id === id)!) : [me];
      for (const u of at) {
        const cell = groundFxCell(def, { r: me.r, c: me.c }, { r: u.r, c: u.c }, !!me.flip);
        const f: FxView = { id: ++this.id, r: cell.r, c: cell.c, name, angle: 0, flip: !!me.flip, offset: fxOffset(name, def.at === 'self' ? sprite : undefined), under: def.layer === 'under',
          follow: fxAttached(name) ? u.id : undefined };
        this.fx.update(l => [...l, f]);
        this.at((fxDuration(name) + 50) / 1000, () => this.fx.update(l => l.filter(x => x.id !== f.id)));
      }
    }
  }

  /** dummies hit by this action (ult / sweep = both, thrust = both in the line, attack = the front one) → ids */
  private hitDummies(kind: 'attack' | SkillKind, index = 0, single = false): number[] {
    const targets = kind === 'attack' || single ? this.dummyIds.slice(0, 1) : this.dummyIds;
    const fl: FloatText[] = targets.map(id => {
      this.set(id, 'hurt', { force: true });
      const u = this.units().find(x => x.id === id)!;
      return { id: ++this.id, r: u.r, c: u.c, text: kind === 'attack' ? '-38' : kind === 'ult' ? `-${[45, 54, 81][index] ?? 50}` : '-68', kind: 'dmg' as const };
    });
    this.floats.update(l => [...l, ...fl]);
    this.at(0.9, () => this.floats.update(l => l.filter(x => !fl.includes(x))));
    return targets;
  }

  private set(id: number, anim: SpriteAnim, extra: Partial<AnimState> = {}): void {
    this.anims.update(m => ({ ...m, [id]: { anim, key: ++this.key, ...extra } }));
  }

  /** Isolated actual-engine review; damage, projectiles and status lifetime all come from engine samples. */
  private playEngineReview(kind: SkillKind): number {
    const units = this.units();
    const me = units[0];
    const targets = units.filter(u => this.dummyIds.includes(u.id));
    const sequence = sequenceFx(this.hero().sprite, kind, me.id, this.dummyIds[0], this.key,
      id => { const u = units.find(x => x.id === id)!; return { r: u.r, c: u.c }; }, !!me.flip, this.qp.get('fxVariant') ?? undefined)
      .map(f => ({ ...f, id: ++this.id }));
    this.fx.update(list => [...list, ...sequence]);
    for (const f of sequence) if (!f.track) this.at((fxDuration(f.name) + (f.delayMs ?? 0) + 50) / 1000,
      () => this.fx.update(list => list.filter(x => x.id !== f.id)));
    const review = skillReview(this.hero().id, kind, { r: me.r, c: me.c }, targets.map((u, i) =>
      ({ id: u.id, pos: { r: u.r, c: u.c }, statuses: i === 0 && this.initialStatus ? [this.initialStatus] : [] })), this.qp.get('enemy') ?? 'forest_slime', this.faceLeft() && kitOf(this.hero().id, this.hero().cls)[kind].effects.some(e => e.type === 'FIELD' && e.field.aura?.team === 'ALLY') ? 'enemy' : 'ally');
    const id = (n: number) => review.ids.get(n)!;
    for (const sample of review.samples) this.at(sample.t, () => {
      this.reviewStatuses.set(sample.statuses);
      this.reviewPositions.set(sample.positions);
      this.reviewVitals.set(sample.vitals);
      this.fieldVisuals.advance(sample.t);
      this.statusVisuals.sync(Object.entries(sample.statuses).flatMap(([target, buffs]) => buffs.filter(b => b.left > 0).map(b => ({
        target: Number(target), source: b.sourceId, status: b.id,
        sprite: units.find(u => u.id === b.sourceId)?.sprite,
        at: { r: units.find(u => u.id === Number(target))!.r, c: units.find(u => u.id === Number(target))!.c },
      }))), sample.t);
      const markers = new Set<string>();
      for (const e of sample.events) {
        if (e.type === 'FIELD_STARTED' || e.type === 'FIELD_ENDED' || e.type === 'FIELD_PULSED') {
          this.note(sample.t, `${e.type}${e.type === 'FIELD_ENDED' ? ' · ' + e.reason : e.type === 'FIELD_PULSED' ? ' · ' + (e.index + 1) : ''}`);
          this.fieldVisuals.handle(e, this.hero().sprite, 0, sample.t);
        } else if (e.type === 'animEvent') {
          this.motionVisuals.handle(id(e.src), this.hero().sprite, e.kind, e.event);
          // Engine launch + authored clip may describe the same marker in one step; present it only once.
          const marker = `${e.event}:${e.kind ?? kind}:${e.index ?? 0}`;
          if (markers.has(marker)) continue;
          markers.add(marker);
          this.note(sample.t, e.event);
          if (e.event !== 'DAMAGE' && e.event !== 'IMPACT') this.spawn(kind, { on: 'event', event: e.event, index: e.index });
        } else if (e.type === 'blink' && id(e.src) === HERO_ID) {
          this.blinked.set({ dc: 0, ownFade: !!SHEETS[this.hero().sprite ?? '']?.anims[kind]?.opacity });
          this.at(.1, () => this.blinked.set(null));
          this.note(sample.t, 'BLINK');
        } else if (e.type === 'dashMark') {
          this.note(sample.t, `MARK ${id(e.dst)}`);
        } else if (e.type === 'projectile') {
          const from = units.find(u => u.id === id(e.src))!;
          const to = units.find(u => u.id === id(e.dst))!;
          const name = SHEETS[from.sprite ?? '']?.projectile?.[e.kind];
          if (name && FX[name]) {
            const p: ProjectileView = { id: ++this.id, name, flight: e.flight * 1000,
              from: e.sky ? { x: to.c + (from.c < to.c ? -1.2 : 1.2), y: to.r + SCENERY_ROWS - 3.2 }
                : { x: from.c, y: from.r + SCENERY_ROWS }, to: { x: to.c, y: to.r + SCENERY_ROWS } };
            this.projectiles.update(l => [...l, p]);
            this.at(projectileLife(p.flight) / 1000, () => this.projectiles.update(l => l.filter(x => x.id !== p.id)));
          }
        } else if (e.type === 'impact') {
          this.spawn(kind, { on: 'impact', hit: e.index }, (e.hits ?? []).map(id));
        } else if (e.type === 'shield') {
          const target = units.find(u => u.id === id(e.dst))!;
          const f: FloatText = { id: ++this.id, r: target.r, c: target.c, text: `+โล่ ${e.amount}`, kind: 'shield' };
          this.floats.update(l => [...l, f]);
          this.note(sample.t, `PROTECTION_APPLY → ${target.id} (+${e.amount})`);
          this.at(0.9, () => this.floats.update(l => l.filter(x => x.id !== f.id)));
        } else if (e.type === 'heal') {
          const target = units.find(u => u.id === id(e.dst))!;
          const f: FloatText = { id: ++this.id, r: target.r, c: target.c, text: `+${e.amount}`, kind: 'heal' };
          this.floats.update(l => [...l, f]);
          this.note(sample.t, `HEAL_APPLY → ${target.id} (+${e.amount})`);
          this.at(0.9, () => this.floats.update(l => l.filter(x => x.id !== f.id)));
        } else if (e.type === 'damage' || e.type === 'buff') {
          const target = units.find(u => u.id === id(e.dst))!;
          const f: FloatText = { id: ++this.id, r: target.r, c: target.c,
            text: e.type === 'damage' ? `-${e.amount}` : e.name, kind: e.type === 'damage' ? 'dmg' : 'buff' };
          this.floats.update(l => [...l, f]);
          this.at(0.9, () => this.floats.update(l => l.filter(x => x.id !== f.id)));
          if (e.type === 'damage') this.set(target.id, 'hurt', { force: true });
          else {
            this.note(sample.t, `${e.buff} → ${target.id} (applied)`);
            const name = appliedStatusFx(this.hero().sprite, e.buff);
            if (name) {
              const effect: FxView = { id: ++this.id, r: target.r, c: target.c, name, angle: 0,
                offset: fxOffset(name), under: FX[name].layer === 'under', follow: fxAttached(name) ? target.id : undefined };
              this.fx.update(l => [...l, effect]);
              this.at((fxDuration(name) + 50) / 1000, () => this.fx.update(l => l.filter(x => x.id !== effect.id)));
            }
          }
        }
      }
    });
    return review.samples.at(-1)?.t ?? 0;
  }

  /** game seconds → real ms at the lab speed */
  private at(t: number, fn: () => void): void {
    this.timers.push(setTimeout(fn, (t * 1000) / this.speed()));
  }

  private note(t: number, text: string): void {
    this.log.update(l => [...l, { t: t < 0 ? '  !  ' : `${t.toFixed(3)}s`, text }]);
  }

  private clear(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.fieldVisuals.clear();
    this.statusVisuals.clear();
    this.motionVisuals.clear();
    this.projectiles.set([]);
    this.fx.set([]);
    this.floats.set([]);
    this.reviewStatuses.set({});
    this.reviewVitals.set({});
    this.reviewPositions.set({});
  }
}
