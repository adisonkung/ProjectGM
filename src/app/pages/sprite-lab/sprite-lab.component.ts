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
import { animEvents, animOf, animTiming, clipClock, eventFeelOf, FX, fxAttached, fxFor, fxOffset, FxTrigger, FRAME_MS, impactFeelOf, SHEETS, SkillKind, SpriteAnim } from '../../core/data/sprites';
import { kitOf } from '../../core/data/hero-skills';
import { appliedStatusFx } from '../../core/data/sprites';
import { STATUS_ICONS } from '../../core/data/visuals';
import { groundFxCell } from '../../battle/render/fx-clip';
import { skillReview } from './skill-review';

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
  imports: [BoardComponent, RouterLink],
  template: `
    <section class="lab">
      <header>
        <a routerLink="/heroes">← กลับ</a>
        <h1>ห้องทดสอบท่า · {{ heroName() }}</h1>
        <select [value]="heroId()" (change)="heroId.set($any($event.target).value); reset()">
          @for (h of spriteHeroes; track h.id) { <option [value]="h.id" [selected]="h.id === heroId()">{{ h.name }} ({{ h.id }})</option> }
        </select>
      </header>

      @if (comparisonHeroes.length) {
        <p class="comparison">เทียบสัดส่วน: {{ comparisonNames }} · ตัวละครยืนบนเลนเดียวกัน</p>
      }
      @if (activeEngineReview()) {
        <p class="comparison">ทดสอบหนึ่งครั้งด้วยระบบต่อสู้ · เป้าแรก{{ initialStatus ? ' มี ' + initialStatus + ' ก่อนร่าย' : ' ยังไม่มีสถานะก่อนร่าย' }} · จังหวะสำหรับรีวิว</p>
      }
      <div class="stage" [class.anchors]="showAnchors()">
        <app-board #board [background]="previewBackground" [units]="units()" [fx]="fx()" [projectiles]="projectiles()" [floats]="floats()" [anims]="anims()" [speed]="speed()" [renderer]="renderer()" [frozen]="frozen" />
        @if (showAnchors()) {
          <i class="mark root" [style.left]="mark().root.x" [style.top]="mark().root.y" title="root (feet)"></i>
          @for (t of mark().anchors; track t.name) { <i class="mark tip" [style.left]="t.x" [style.top]="t.y" [title]="t.name"><b>{{ t.name }}</b></i> }
        }
      </div>

      <div class="controls">
        @for (a of actions(); track a.id) {
          <button type="button" (click)="play(a.id)" [class.on]="last() === a.id">{{ a.label }}</button>
        }
      </div>
      <div class="controls">
        <label><input type="checkbox" [checked]="loop()" (change)="loop.set($any($event.target).checked); loop() && play(last())" /> วนซ้ำ</label>
        <label><input type="checkbox" [checked]="faceLeft()" (change)="faceLeft.set($any($event.target).checked)" /> หันซ้าย</label>
        <label><input type="checkbox" [checked]="showAnchors()" (change)="showAnchors.set($any($event.target).checked)" /> จุด root / anchor</label>
        <label>ความเร็ว
          <select [value]="speed()" (change)="speed.set(+$any($event.target).value)">
            <option value="0.25">×0.25</option><option value="0.5">×0.5</option><option value="1">×1</option>
          </select>
        </label>
        <label>ตัววาด
          <select [value]="renderer()" (change)="setRenderer($any($event.target).value)">
            <option value="dom">DOM</option><option value="pixi">Pixi (WebGL)</option>
          </select>
        </label>
      </div>

      <ol class="log" aria-live="polite">
        @for (l of log(); track $index) { <li><b>{{ l.t }}</b> {{ l.text }}</li> }
      </ol>
    </section>
  `,
  styles: `
    .lab { padding: 12px; display: grid; gap: 10px; max-width: 980px; margin: 0 auto; }
    header { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    h1 { font-size: 18px; margin: 0; flex: 1; }
    .comparison { margin: 0; text-align: center; font-size: 13px; color: #b9cee2; }
    .stage { position: relative; --cell: min(56px, calc((100vw - 32px) / 16)); width: calc(16 * var(--cell)); margin: 0 auto; }
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
  readonly spriteHeroes = HEROES.filter(h => h.sprite && SHEETS[h.sprite]);
  private readonly qp = inject(ActivatedRoute).snapshot.queryParamMap;
  /** Optional lab-only comparison uses real roster sheets, never changes saves or combat. */
  readonly comparisonHeroes = HEROES.filter(h => (this.qp.get('compare') ?? '').split(',').includes(h.id) && h.sprite && SHEETS[h.sprite]).slice(0, 2);
  readonly comparisonNames = this.comparisonHeroes.map(h => h.name).join(' / ');
  readonly previewBackground = BACKGROUNDS[this.qp.get('bg') ?? ''] ?? null;
  private readonly comparisonMonster = MONSTERS[this.qp.get('enemy') ?? ''];
  private readonly targetDistance = Math.min(5, Math.max(1, Number(this.qp.get('distance')) || 1));
  readonly engineReview = this.qp.get('combat') === '1';
  readonly initialStatus = this.qp.get('status') ?? '';
  private readonly dummyIds = this.qp.get('formation') === 'square' ? [2, 3, 4, 5] : DUMMY_IDS;
  private readonly reviewStatuses = signal<Record<number, { id: string; left: number }[]>>({});
  readonly heroId = signal(this.qp.get('hero') ?? 'bailong');
  readonly hero = computed(() => this.spriteHeroes.find(h => h.id === this.heroId()) ?? this.spriteHeroes[0]);
  readonly heroName = computed(() => this.hero()?.name ?? '');
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
    if (!this.engineReview || (action !== 'skill' && action !== 'skill2' && action !== 'ult')) return false;
    const h = this.hero();
    return (kitOf(h.id, h.cls)[action].delivery ?? 'INSTANT') === 'INSTANT';
  });
  /** blink clips (AnimDef.move): columns the hero is relocated by until the clip ends · own-fade = clip opacity */
  readonly blinked = signal<{ dc: number; ownFade: boolean } | null>(null);
  readonly anims = signal<Partial<Record<number, AnimState>>>({});
  readonly fx = signal<FxView[]>([]);
  readonly projectiles = signal<ProjectileView[]>([]);
  readonly floats = signal<FloatText[]>([]);
  readonly log = signal<{ t: string; text: string }[]>([]);

  private readonly boardEl = viewChild(BoardComponent, { read: ElementRef });

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
    const base = { hpPct: 100, manaPct: 0, shieldPct: 0, alive: true, taunt: false };
    const hc = left ? 8 : 5;
    const b = this.blinked();
    return [
      { ...base, id: HERO_ID, side: 'ally', name: h.name, cls: h.cls, r: 1, c: hc + (b ? b.dc * (left ? -1 : 1) : 0), sprite: h.sprite, star: h.star, heroId: h.id, flip: left,
        blink: !!b, blinkFade: !b?.ownFade },
      ...this.comparisonHeroes.filter(other => other.id !== h.id).map((other, i) => ({
        ...base, id: 100 + i, side: 'ally' as const, name: other.name, cls: other.cls,
        r: 1, c: hc - (i + 1) * 2 * (left ? -1 : 1), sprite: other.sprite, star: other.star, heroId: other.id, flip: left,
      })),
      ...this.dummyIds.map((id, i) => ({
        ...base, id, side: 'enemy' as const, name: this.comparisonMonster?.name ?? 'หุ่นฝึก', cls: 'tank' as const,
        r: this.dummyIds.length === 4 ? 1 + Math.floor(i / 2) : 1,
        c: hc + (this.targetDistance + (this.dummyIds.length === 4 ? i % 2 : i)) * (left ? -1 : 1),
        sprite: this.comparisonMonster?.animation.sheet ?? DUMMY_SPRITE, flip: !left,
        statuses: (this.reviewStatuses()[id] ?? []).filter(b => STATUS_ICONS[b.id]).map(b => ({ ...b, icon: STATUS_ICONS[b.id] })),
      })),
    ];
  });

  readonly actions = computed(() => {
    const d = this.sheet();
    const h = this.hero();
    const kit = kitOf(h.id, h.cls);
    const list: { id: Action; label: string }[] = [{ id: 'idle', label: 'Idle' }, { id: 'walk', label: 'Move' }, { id: 'attack', label: 'Normal Attack' }];
    for (const k of ['skill', 'skill2', 'ult'] as const)
      if (d?.anims[k] && d.anims[k] !== d.anims.attack) list.push({ id: k, label: kit[k].label ?? k });
    list.push({ id: 'hurt', label: 'Hurt' }, { id: 'die', label: 'Death' });
    return list;
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
    if (this.engineReview && kitSkill && (kitSkill.delivery ?? 'INSTANT') === 'INSTANT') {
      this.playEngineReview(a as SkillKind);
      if (this.loop()) this.at(len + 0.8, () => this.play(a));
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
    if (!names.length && trig.on === 'event' && trig.event === 'VFX_SPAWN') this.note(-1, 'no VFX for VFX_SPAWN → skipped (combat unaffected)');
    const units = this.units();
    const me = units[0];
    for (const name of names) {
      const def = FX[name];
      const at = def.at === 'target' ? (trig.on === 'event' ? this.dummyIds.slice(0, 1) : hits).slice(def.exceptPrimary ? 1 : 0).slice(0, def.perHit ?? 1).map(id => units.find(x => x.id === id)!) : [me];
      for (const u of at) {
        const cell = groundFxCell(def, { r: me.r, c: me.c }, { r: u.r, c: u.c });
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

  /** Optional isolated actual-engine review for instant skills; no duplicate imitation of Chill/Root rules. */
  private playEngineReview(kind: SkillKind): void {
    const units = this.units();
    const me = units[0];
    const targets = units.filter(u => this.dummyIds.includes(u.id));
    const review = skillReview(this.hero().id, kind, { r: me.r, c: me.c }, targets.map((u, i) =>
      ({ id: u.id, pos: { r: u.r, c: u.c }, statuses: i === 0 && this.initialStatus ? [this.initialStatus] : [] })), this.qp.get('enemy') ?? 'forest_slime');
    const id = (n: number) => review.ids.get(n)!;
    for (const sample of review.samples) this.at(sample.t, () => {
      this.reviewStatuses.set(sample.statuses);
      for (const e of sample.events) {
        if (e.type === 'animEvent') {
          this.note(sample.t, e.event);
          if (e.event !== 'DAMAGE' && e.event !== 'IMPACT') this.spawn(kind, { on: 'event', event: e.event, index: e.index });
        } else if (e.type === 'impact') {
          this.spawn(kind, { on: 'impact', hit: e.index }, (e.hits ?? []).map(id));
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
    this.projectiles.set([]);
    this.fx.set([]);
    this.floats.set([]);
    this.reviewStatuses.set({});
  }
}
