import { Component, computed, ElementRef, inject, OnDestroy, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AnimState, BoardComponent, FloatText, FxView, UnitView } from '../../battle/board/board.component';
import { fxDuration } from '../../battle/fx-sprite/fx-sprite.component';
import { playImpactFeel } from '../../battle/impact-feel/impact-feel';
import { SCENERY_ROWS } from '../../battle/engine/grid';
import { HEROES } from '../../core/data/heroes';
import { animEvents, animOf, animTiming, clipClock, FX, fxFor, fxOffset, FxTrigger, FRAME_MS, impactFeelOf, SHEETS, SkillKind, SpriteAnim } from '../../core/data/sprites';
import { kitOf } from '../../core/data/hero-skills';

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

      <div class="stage" [class.anchors]="showAnchors()">
        <app-board #board [units]="units()" [fx]="fx()" [floats]="floats()" [anims]="anims()" [speed]="speed()" />
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
  readonly heroId = signal(inject(ActivatedRoute).snapshot.queryParamMap.get('hero') ?? 'bailong');
  readonly hero = computed(() => this.spriteHeroes.find(h => h.id === this.heroId()) ?? this.spriteHeroes[0]);
  readonly heroName = computed(() => this.hero()?.name ?? '');
  readonly sheet = computed(() => SHEETS[this.hero()?.sprite ?? '']);

  readonly speed = signal(1);
  readonly loop = signal(false);
  readonly faceLeft = signal(false);
  readonly showAnchors = signal(false);
  readonly last = signal<Action>('idle');
  /** blink clips (AnimDef.move): columns the hero is relocated by until the clip ends · own-fade = clip opacity */
  readonly blinked = signal<{ dc: number; ownFade: boolean } | null>(null);
  readonly anims = signal<Partial<Record<number, AnimState>>>({});
  readonly fx = signal<FxView[]>([]);
  readonly floats = signal<FloatText[]>([]);
  readonly log = signal<{ t: string; text: string }[]>([]);

  private readonly boardEl = viewChild(BoardComponent, { read: ElementRef });
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
      ...DUMMY_IDS.map((id, i) => ({
        ...base, id, side: 'enemy' as const, name: 'หุ่นฝึก', cls: 'tank' as const, r: 1, c: left ? hc - 1 - i : hc + 1 + i, sprite: DUMMY_SPRITE, flip: !left,
      })),
    ];
  });

  readonly actions = computed(() => {
    const d = this.sheet();
    const h = this.hero();
    const kit = kitOf(h.id, h.cls);
    const list: { id: Action; label: string }[] = [{ id: 'idle', label: 'Idle' }, { id: 'walk', label: 'Move' }, { id: 'attack', label: 'Normal Attack' }];
    for (const k of ['skill', 'skill2', 'ult'] as const) if (d?.anims[k]) list.push({ id: k, label: kit[k].label ?? k });
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
    DUMMY_IDS.forEach(id => this.set(id, 'idle'));
  }

  play(a: Action): void {
    this.clear();
    this.last.set(a);
    this.log.set([]);
    if (a === 'idle') {
      DUMMY_IDS.forEach(id => this.set(id, 'idle'));
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
        this.at(ev.t, () => {
          this.note(ev.t, `${ev.event}${ev.index ? ' #' + (ev.index + 1) : ''}${ev.event === 'ANIMATION_END' ? ' (end)' : ev.frame >= 0 ? ` (frame ${(ev.art ?? ev.frame) + 1})` : ''}`);
          if (!kind) {
            if (ev.event === 'DAMAGE') this.hitDummies('attack', 0);
            return;
          }
          if (ev.event !== 'DAMAGE' && ev.event !== 'IMPACT') this.spawn(kind, { on: 'event', event: ev.event, index: ev.index });
          if (ev.event === 'DAMAGE') {
            const hits = this.hitDummies(kind, ev.index);
            this.spawn(kind, { on: 'impact', hit: ev.index }, hits);
            if (!hasImpact) playImpactFeel(this.boardEl()?.nativeElement, impactFeelOf(sprite, kind, ev.index));
          }
          if (ev.event === 'IMPACT') playImpactFeel(this.boardEl()?.nativeElement, impactFeelOf(sprite, kind, ev.index));
        });
      }
      if (kind) this.spawn(kind, { on: 'cast' });
    }
    if (this.loop() && a !== 'die') this.at(len + 0.6, () => this.play(a));
    if (this.loop() && a === 'die') this.at(len + 1.2, () => (this.set(HERO_ID, 'idle'), this.play('die')));
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
      const at = def.at === 'target' ? (trig.on === 'event' ? DUMMY_IDS.slice(0, 1) : hits).slice(def.exceptPrimary ? 1 : 0).slice(0, def.perHit ?? 1).map(id => units.find(x => x.id === id)!) : [me];
      for (const u of at) {
        const f: FxView = { id: ++this.id, r: u.r, c: u.c, name, angle: 0, flip: !!me.flip, offset: fxOffset(name, def.at === 'self' ? sprite : undefined), under: def.layer === 'under' };
        this.fx.update(l => [...l, f]);
        setTimeout(() => this.fx.update(l => l.filter(x => x.id !== f.id)), fxDuration(name, this.speed()) + 50);
      }
    }
  }

  /** dummies hit by this action (ult / sweep = both, thrust = both in the line, attack = the front one) → ids */
  private hitDummies(kind: 'attack' | SkillKind, index = 0): number[] {
    const targets = kind === 'attack' ? DUMMY_IDS.slice(0, 1) : DUMMY_IDS;
    const fl: FloatText[] = targets.map(id => {
      this.set(id, 'hurt', { force: true });
      const u = this.units().find(x => x.id === id)!;
      return { id: ++this.id, r: u.r, c: u.c, text: kind === 'attack' ? '-38' : kind === 'ult' ? `-${[45, 54, 81][index] ?? 50}` : '-68', kind: 'dmg' as const };
    });
    this.floats.update(l => [...l, ...fl]);
    setTimeout(() => this.floats.update(l => l.filter(x => !fl.includes(x))), 900);
    return targets;
  }

  private set(id: number, anim: SpriteAnim, extra: Partial<AnimState> = {}): void {
    this.anims.update(m => ({ ...m, [id]: { anim, key: ++this.key, ...extra } }));
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
  }
}
