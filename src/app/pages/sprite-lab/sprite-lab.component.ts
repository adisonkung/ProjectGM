import { Component, computed, ElementRef, inject, OnDestroy, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AnimState, BoardComponent, FloatText, FxView, UnitView } from '../../battle/board/board.component';
import { fxDuration } from '../../battle/fx-sprite/fx-sprite.component';
import { playImpactFeel } from '../../battle/impact-feel/impact-feel';
import { SCENERY_ROWS } from '../../battle/engine/grid';
import { HEROES } from '../../core/data/heroes';
import { animEvents, animOf, animTiming, FX, FRAME_MS, impactFeelOf, SHEETS, SkillKind, SpriteAnim } from '../../core/data/sprites';

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
          @for (h of spriteHeroes; track h.id) { <option [value]="h.id">{{ h.name }} ({{ h.id }})</option> }
        </select>
      </header>

      <div class="stage" [class.anchors]="showAnchors()">
        <app-board #board [units]="units()" [fx]="fx()" [floats]="floats()" [anims]="anims()" [speed]="speed()" />
        @if (showAnchors()) {
          <i class="mark root" [style.left]="mark().root.x" [style.top]="mark().root.y" title="root (feet)"></i>
          @if (mark().tip; as t) { <i class="mark tip" [style.left]="t.x" [style.top]="t.y" title="VFX anchor (weapon tip)"></i> }
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
    return [
      { ...base, id: HERO_ID, side: 'ally', name: h.name, cls: h.cls, r: 1, c: hc, sprite: h.sprite, star: h.star, heroId: h.id, flip: left },
      ...DUMMY_IDS.map((id, i) => ({
        ...base, id, side: 'enemy' as const, name: 'หุ่นฝึก', cls: 'tank' as const, r: 1, c: left ? hc - 1 - i : hc + 1 + i, sprite: DUMMY_SPRITE, flip: !left,
      })),
    ];
  });

  readonly actions = computed(() => {
    const d = this.sheet();
    const list: { id: Action; label: string }[] = [
      { id: 'idle', label: 'Idle' }, { id: 'walk', label: 'Move' }, { id: 'attack', label: 'Attack' },
      { id: 'hurt', label: 'Hurt' }, { id: 'die', label: 'Death' },
    ];
    const name = (k: SkillKind) => (d?.fx?.[k] ? FX[d.fx[k]!] && d.fx[k]! : null);
    if (d?.anims.skill) list.push({ id: 'skill', label: name('skill') === 'bailong-dragon-thrust' ? 'Dragon Thrust' : 'Skill 1' });
    return list;
  });

  /** root (feet) and VFX anchor in board px — the same maths the board / FX layer use */
  readonly mark = computed(() => {
    const u = this.units()[0];
    const cell = (k: number) => `calc(var(--cell) * ${k})`;
    const root = { x: cell(u.c + 0.5), y: cell(u.r + SCENERY_ROWS + 0.7725) };
    const fxName = this.sheet()?.fx?.skill;
    const f = fxName ? FX[fxName] : undefined;
    const tip = f?.at === 'self'
      ? { x: cell(u.c + 0.5 + ((f.dx ?? 0) / 100) * (u.flip ? -1 : 1)), y: cell(u.r + SCENERY_ROWS + 0.5 + (f.dy ?? 0) / 100) }
      : null;
    return { root, tip };
  });

  ngOnDestroy(): void {
    this.clear();
  }

  reset(): void {
    this.clear();
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
    const len = clip ? (clip.frames * (clip.ms ?? FRAME_MS)) / 1000 : 0.5;
    this.note(0, `${a} start · ${clip?.frames ?? '?'} frames × ${clip?.ms ?? FRAME_MS} ms = ${len.toFixed(2)} s`);

    if (a === 'attack' || a === 'skill' || a === 'skill2' || a === 'ult') {
      const events = animEvents(sprite, a);
      const tm = animTiming(sprite, a);
      // sheets without authored events: the old hit frame is the DAMAGE (+ IMPACT for skills)
      const list = events.length ? events : [{ event: 'DAMAGE' as const, t: tm.hit, frame: -1 }];
      for (const ev of list) {
        this.at(ev.t, () => {
          this.note(ev.t, `${ev.event}${ev.frame >= 0 ? ` (frame ${ev.frame})` : ''}`);
          if (ev.event === 'VFX_SPAWN' && a !== 'attack') this.spawnVfx(a);
          if (ev.event === 'DAMAGE') this.hitDummies(a);
          if (ev.event === 'IMPACT' && a !== 'attack') playImpactFeel(this.boardEl()?.nativeElement, impactFeelOf(sprite, a));
        });
      }
    }
    if (this.loop() && a !== 'die') this.at(len + 0.6, () => this.play(a));
    if (this.loop() && a === 'die') this.at(len + 1.2, () => (this.set(HERO_ID, 'idle'), this.play('die')));
  }

  private spawnVfx(kind: SkillKind): void {
    const name = this.sheet()?.fx?.[kind];
    const def = name ? FX[name] : undefined;
    if (!name || !def) {
      this.note(-1, `VFX "${name ?? '-'}" missing → skipped (combat unaffected)`);
      return;
    }
    const u = this.units()[0];
    const f: FxView = { id: ++this.id, r: u.r, c: u.c, name, angle: 0, flip: !!u.flip };
    this.fx.update(l => [...l, f]);
    setTimeout(() => this.fx.update(l => l.filter(x => x.id !== f.id)), fxDuration(name, this.speed()) + 50);
  }

  private hitDummies(kind: 'attack' | SkillKind): void {
    const targets = kind === 'attack' ? DUMMY_IDS.slice(0, 1) : DUMMY_IDS;
    const fl: FloatText[] = targets.map(id => {
      this.set(id, 'hurt', { force: true });
      const u = this.units().find(x => x.id === id)!;
      return { id: ++this.id, r: u.r, c: u.c, text: kind === 'attack' ? '-38' : '-68', kind: 'dmg' as const };
    });
    this.floats.update(l => [...l, ...fl]);
    setTimeout(() => this.floats.update(l => l.filter(x => !fl.includes(x))), 900);
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
