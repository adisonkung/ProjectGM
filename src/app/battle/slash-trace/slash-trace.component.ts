import { AfterViewInit, Component, ElementRef, inject, input, NgZone, OnDestroy, output, signal } from '@angular/core';
import { SlashGrade, SlashTraceDefinition } from '../../core/data/special-skills';
import { finisherPlan, FinisherPlan, gradeStroke, Pt, slashPattern, SlashStroke, StrokeScore, toSpace } from '../../core/rules/slash-trace';

const INTRO_S = 0.7;
/** grades stay on screen this long before the finisher */
const OUTRO_S = 0.55;
/** the user's crescent slash sheet (tools/sprites/blade_trace_fx.py → public/fx) */
const SLASHES = Array.from({ length: 8 }, (_, i) => `fx/blade-slash-${i + 1}.webp`);
const RING = 'fx/blade-fire-ring.webp';
const SPARKS = [[-1, -0.6], [1, -0.8], [-0.7, 0.9], [0.9, 0.5], [0, -1]];
const GRADE_TEXT: Record<SlashGrade, string> = { PERFECT: 'PERFECT!', GOOD: 'GOOD', OK: 'OK', MISS: 'MISS' };

/**
 * Blade Trace mini-game (player special skill): sword trails light up one by one over the battle screen — drag along
 * each from its start (glowing dot) to its end before the timer runs out. Grades per trail → `done` (the battle
 * screen passes them to the engine). Runs in real time (game speed x2/x4 does not apply); the fight is paused.
 */
@Component({
  selector: 'app-slash-trace',
  template: `
    <svg [attr.viewBox]="'0 0 ' + w() + ' ' + h()" preserveAspectRatio="none"
         (pointerdown)="down($event)" (pointermove)="move($event)" (pointerup)="up($event)" (pointercancel)="up($event)">
      <defs>
        <filter id="st-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      @if (phase() !== 'finisher') {
      @for (s of trails(); track $index) {
        @let st = stateOf($index);
        <path class="trail" [class]="'trail ' + st" [attr.d]="pathOf(s)" [attr.stroke-width]="tolPx() * 1.1" />
        @if (st === 'active') {
          <path class="core" [attr.d]="pathOf(s)" filter="url(#st-glow)" />
          <circle class="start" [attr.cx]="s.points[0].x" [attr.cy]="s.points[0].y" [attr.r]="tolPx() * 0.55" />
          <path class="arrow" [attr.d]="arrowOf(s)" />
        }
        @if (st === 'pending') { <text class="num" [attr.x]="s.points[0].x" [attr.y]="s.points[0].y">{{ $index + 1 }}</text> }
      }
      @if (ink().length > 1) { <polyline class="ink" [attr.points]="inkPoints()" filter="url(#st-glow)" /> }
      @for (f of flashes(); track f.key) {
        <path class="slash" [class]="'slash ' + f.grade.toLowerCase()" [attr.d]="pathOf(f.trail)" />
        <text class="grade" [class]="'grade ' + f.grade.toLowerCase()" [attr.x]="f.at.x" [attr.y]="f.at.y">{{ gradeText[f.grade] }}</text>
      }
      }
    </svg>
    @if (phase() === 'finisher' && plan(); as p) {
      <!-- finisher: the screen goes dark, the graded flurry of crescent slashes rips through the centre, a fire ring +
           the final gold cut + white flash — then the damage lands -->
      <div class="fin" [style.--end]="p.duration - 0.28 + 's'">
        <div class="dark"></div>
        <div class="shake" [style.animation-iteration-count]="p.cuts.length" [style.animation-delay]="p.cuts[0].at + 's'">
          <i class="core-glow"></i>
          @for (c of p.cuts; track $index) {
            <img class="sl" [class]="'sl ' + c.grade.toLowerCase()" [src]="slashSrc($index)" alt="" draggable="false"
                 [style.width.px]="size() * (c.grade === 'MISS' ? 0.7 : 1)" [style.--tf]="cutTf(c.angle, c.offset, $index)" [style.animation-delay]="c.at + 's'" />
            @if (c.grade !== 'MISS') {
              @for (sp of sparks; track $index) {
                <i class="spark" [style.--dx]="sp[0] * size() * 0.32 + 'px'" [style.--dy]="sp[1] * size() * 0.32 + 'px'" [style.animation-delay]="c.at + 0.05 + 's'"></i>
              }
            }
          }
          <img class="ring" [src]="ring" alt="" draggable="false" [style.width.px]="size() * 2.6" [style.animation-delay]="p.finalAt + 's'" />
          <img class="sl final" [src]="slashSrc(1)" alt="" draggable="false" [style.width.px]="size() * 1.7"
               [style.--tf]="cutTf(p.finalAngle, 0, 1)" [style.animation-delay]="p.finalAt + 's'" />
        </div>
        <i class="flash" [style.animation-delay]="p.finalAt + 's'"></i>
      </div>
    }
    <div class="hud">
      <b>⚔ {{ def().name }}</b>
      @if (phase() === 'intro') { <span>ลากตามรอยดาบให้ทัน!</span> }
      @if (phase() === 'play') {
        <span>รอยที่ {{ index() + 1 }}/{{ trails().length }}</span>
        <i class="timer"><em [style.width.%]="left() * 100"></em></i>
      }
      @if (phase() === 'outro' || phase() === 'finisher') { <span class="sum">{{ summary() }}</span> }
    </div>
  `,
  styles: `
    :host { position: absolute; inset: 0; z-index: 380; touch-action: none; user-select: none; -webkit-user-select: none;
      background: radial-gradient(ellipse at 50% 50%, #0a061455, #050309bb); animation: in 0.2s ease-out; }
    svg { position: absolute; inset: 0; width: 100%; height: 100%; cursor: crosshair; }
    .trail { fill: none; stroke-linecap: round; stroke: #ffffff14; }
    .trail.pending { stroke: #ffffff38; stroke-width: 3px; stroke-dasharray: 4 10; }
    .trail.active { stroke: #7fe3ff22; }
    .trail.done { stroke: none; }
    .core { fill: none; stroke: #bff4ff; stroke-width: 3; stroke-linecap: round; stroke-dasharray: 10 8; animation: flow 0.6s linear infinite; }
    .start { fill: #7fe3ff; stroke: #fff; stroke-width: 2; animation: pulse 0.7s ease-in-out infinite alternate; }
    .arrow { fill: #bff4ff; }
    .num { fill: #fff7; font: 700 14px var(--disp, sans-serif); text-anchor: middle; dominant-baseline: middle; }
    .ink { fill: none; stroke: #fff; stroke-width: 5; stroke-linecap: round; stroke-linejoin: round; opacity: 0.9; }
    .slash { fill: none; stroke-width: 7; stroke-linecap: round; animation: cut 0.5s ease-out forwards; }
    .slash.perfect { stroke: #ffe27a; } .slash.good { stroke: #bff4ff; } .slash.ok { stroke: #9fb7c4; } .slash.miss { stroke: #ff5a4e; stroke-dasharray: 6 10; }
    .grade { font: 900 22px var(--disp, sans-serif); text-anchor: middle; paint-order: stroke; stroke: #000a; stroke-width: 4px;
      animation: pop 0.8s ease-out forwards; }
    .grade.perfect { fill: #ffe27a; } .grade.good { fill: #bff4ff; } .grade.ok { fill: #c9d6de; } .grade.miss { fill: #ff7a70; }
    .hud { position: absolute; left: 50%; top: 8px; transform: translateX(-50%); display: grid; justify-items: center; gap: 4px;
      padding: 6px 16px 8px; border-radius: 12px; background: #140f22dd; border: 1px solid #7fe3ff66; color: #e8f7ff;
      font: 600 13px var(--body, sans-serif); pointer-events: none; box-shadow: 0 0 16px #7fe3ff33;
      b { font: 800 15px var(--title, sans-serif); color: #bff4ff; letter-spacing: 0.04em; } }
    .timer { display: block; width: 180px; height: 6px; border-radius: 3px; background: #ffffff1a; overflow: hidden;
      em { display: block; height: 100%; background: linear-gradient(90deg, #ff5a4e, #ffe27a 40%, #7fe3ff); } }
    .sum { font-weight: 800; color: #ffe27a; }
    .fin { position: absolute; inset: 0; pointer-events: none; overflow: hidden; animation: finOut 0.28s ease-in forwards; animation-delay: var(--end); }
    .dark { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 52%, #0d0818f2, #000 70%); animation: in 0.16s ease-out both; }
    .shake { position: absolute; inset: 0; animation: hitshake 0.085s linear; }
    .core-glow { position: absolute; left: 50%; top: 52%; width: 46vmin; height: 46vmin; transform: translate(-50%, -50%); border-radius: 50%;
      background: radial-gradient(circle, #7a5cff33, transparent 70%); animation: aura 0.6s ease-in-out infinite alternate; }
    .sl { position: absolute; left: 50%; top: 52%; height: auto; opacity: 0; mix-blend-mode: screen; transform: var(--tf);
      animation: slashIn 0.24s cubic-bezier(.15,.8,.3,1) forwards; }
    .sl.perfect { filter: drop-shadow(0 0 10px #ffd34e) drop-shadow(0 0 22px #ff9a2e88) brightness(1.15); }
    .sl.good { filter: drop-shadow(0 0 10px #7fe3ff) drop-shadow(0 0 20px #4aa8ff66); }
    .sl.ok { filter: brightness(.75) drop-shadow(0 0 6px #c9d6de66); }
    .sl.miss { filter: sepia(1) saturate(7) hue-rotate(-40deg) brightness(.85) drop-shadow(0 0 8px #ff3b2e); }
    .sl.final { filter: sepia(.6) saturate(3) brightness(1.2) drop-shadow(0 0 16px #ffd34e) drop-shadow(0 0 40px #ff8a2e); animation-duration: 0.42s; }
    .ring { position: absolute; left: 50%; top: 60%; height: auto; opacity: 0; mix-blend-mode: screen; animation: ringOut 0.6s ease-out forwards; }
    .spark { position: absolute; left: 50%; top: 52%; width: 5px; height: 5px; margin: -2.5px; border-radius: 50%; background: #fff3b0;
      box-shadow: 0 0 6px #ffd34e; opacity: 0; animation: spark 0.32s ease-out forwards; }
    .flash { position: absolute; inset: 0; background: #fff; opacity: 0; animation: flashw 0.4s ease-out forwards; }
    @keyframes aura { from { opacity: 0.6; } to { opacity: 1; } }
    @keyframes slashIn { 0% { opacity: 0; transform: var(--tf) scale(0.5) rotate(-14deg); } 25% { opacity: 1; }
      60% { opacity: 1; transform: var(--tf) scale(1.06) rotate(4deg); } 100% { opacity: 0; transform: var(--tf) scale(1.14) rotate(8deg); } }
    @keyframes ringOut { 0% { opacity: 0; transform: translate(-50%, -50%) scale(0.25); } 20% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -50%) scale(1.15); } }
    @keyframes spark { from { transform: translate(0, 0); opacity: 1; } to { transform: translate(var(--dx), var(--dy)); opacity: 0; } }
    @keyframes hitshake { 0% { transform: translate(-5px, 2px); } 50% { transform: translate(5px, -2px); } 100% { transform: translate(0, 0); } }
    @keyframes flashw { from { opacity: 0.6; } to { opacity: 0; } }
    @keyframes finOut { to { opacity: 0; } }
    @keyframes flow { to { stroke-dashoffset: -18; } }
    @keyframes pulse { to { opacity: 0.55; } }
    @keyframes cut { from { stroke-dasharray: 2000; stroke-dashoffset: 2000; opacity: 1; } 70% { opacity: 1; } to { stroke-dasharray: 2000; stroke-dashoffset: 0; opacity: 0.25; } }
    @keyframes pop { from { transform: translateY(6px); opacity: 0; } 20% { opacity: 1; } to { transform: translateY(-14px); opacity: 0; } }
    @keyframes in { from { opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .core, .start, .slash, .grade, .spark, .shake, .core-glow { animation: none; } }
  `,
})
export class SlashTraceComponent implements AfterViewInit, OnDestroy {
  readonly def = input.required<SlashTraceDefinition>();
  /** trail layout seed (a new pattern per use) */
  readonly seed = input(1);
  /** the grades of every trail, in order (after the outro) */
  readonly done = output<SlashGrade[]>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  readonly gradeText = GRADE_TEXT;
  readonly w = signal(800);
  readonly h = signal(450);
  readonly tolPx = signal(30);
  readonly trails = signal<SlashStroke[]>([]);
  readonly index = signal(0);
  readonly phase = signal<'intro' | 'play' | 'outro' | 'finisher'>('intro');
  /** finisher: dark screen, a graded flurry of crescent slashes through the centre, a final gold cut — damage lands after it */
  readonly plan = signal<FinisherPlan | null>(null);
  readonly sparks = SPARKS;
  readonly ring = RING;
  /** fraction of the current trail's window left */
  readonly left = signal(1);
  readonly ink = signal<Pt[]>([]);
  readonly flashes = signal<{ key: number; trail: SlashStroke; grade: SlashGrade; at: Pt }[]>([]);
  readonly summary = signal('');
  readonly scores: StrokeScore[] = [];
  private drawing = false;
  private pointerId: number | null = null;
  private phaseStart = 0;
  private raf = 0;
  private finished = false;

  ngAfterViewInit(): void {
    const r = this.host.nativeElement.getBoundingClientRect();
    const w = Math.max(200, Math.round(r.width));
    const h = Math.max(120, Math.round(r.height));
    this.w.set(w);
    this.h.set(h);
    this.tolPx.set(this.def().tolerance * Math.min(w, h));
    let x = (this.seed() * 0.6180339887) % 1 || 0.37;
    const rng = () => (x = (x * 16807 + 0.12345) % 1);
    // keep the trails off the very top (HUD) and the party bar
    const box = { x0: 0.08, x1: 0.92, y0: 0.2, y1: 0.8 };
    this.trails.set(slashPattern(this.def().strokes, rng).map(s =>
      toSpace({ points: s.points.map(p => ({ x: box.x0 + p.x * (box.x1 - box.x0), y: box.y0 + p.y * (box.y1 - box.y0) })) }, w, h)));
    this.phaseStart = performance.now();
    this.zone.runOutsideAngular(() => (this.raf = requestAnimationFrame(t => this.frame(t))));
  }

  /** slash size (px): the flurry fills the middle of the field */
  size(): number {
    return Math.min(this.h() * 0.62, this.w() * 0.5);
  }

  /** a different crescent per cut (mixed order) */
  slashSrc(i: number): string {
    return SLASHES[(i * 3 + 1) % SLASHES.length];
  }

  /** centre → shifted sideways by `offset` (plan units, ±25 of 100) → rotated; every other slash mirrored */
  cutTf(angle: number, offset: number, i: number): string {
    const a = ((angle + 90) * Math.PI) / 180;
    const d = (offset / 100) * this.size();
    return `translate(-50%, -50%) translate(${(Math.cos(a) * d).toFixed(1)}px, ${(Math.sin(a) * d).toFixed(1)}px) rotate(${angle.toFixed(1)}deg) scaleX(${i % 2 ? -1 : 1})`;
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
  }

  stateOf(i: number): 'done' | 'active' | 'pending' {
    if (this.phase() === 'intro') return 'pending';
    return i < this.index() || this.phase() === 'outro' ? 'done' : i === this.index() ? 'active' : 'pending';
  }

  pathOf(s: SlashStroke): string {
    return 'M' + s.points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L');
  }

  /** arrow head at the trail's end, pointing along it */
  arrowOf(s: SlashStroke): string {
    const n = s.points.length;
    const e = s.points[n - 1];
    const p = s.points[n - 3];
    const a = Math.atan2(e.y - p.y, e.x - p.x);
    const L = this.tolPx() * 0.9;
    const pt = (ang: number, len: number) => `${(e.x + Math.cos(ang) * len).toFixed(1)},${(e.y + Math.sin(ang) * len).toFixed(1)}`;
    return `M${pt(a, L * 0.4)} L${pt(a + 2.6, L)} L${pt(a - 2.6, L)} Z`;
  }

  inkPoints(): string {
    return this.ink().map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  }

  private local(ev: PointerEvent): Pt {
    const r = this.host.nativeElement.getBoundingClientRect();
    return { x: ((ev.clientX - r.left) / r.width) * this.w(), y: ((ev.clientY - r.top) / r.height) * this.h() };
  }

  down(ev: PointerEvent): void {
    if (this.phase() !== 'play' || this.drawing) return;
    ev.preventDefault();
    this.drawing = true;
    this.pointerId = ev.pointerId;
    (ev.target as Element).setPointerCapture?.(ev.pointerId);
    this.ink.set([this.local(ev)]);
  }

  move(ev: PointerEvent): void {
    if (!this.drawing || ev.pointerId !== this.pointerId) return;
    ev.preventDefault();
    const p = this.local(ev);
    const last = this.ink().at(-1)!;
    if (Math.hypot(p.x - last.x, p.y - last.y) >= 3) this.ink.update(v => [...v, p]);
  }

  up(ev: PointerEvent): void {
    if (!this.drawing || ev.pointerId !== this.pointerId) return;
    this.drawing = false;
    this.pointerId = null;
    const pts = this.ink();
    const first = pts[0];
    const last = pts.at(-1)!;
    // a tap / tiny wiggle is not an attempt — keep waiting for a real stroke
    if (Math.hypot(last.x - first.x, last.y - first.y) < this.tolPx() * 1.2) {
      this.ink.set([]);
      return;
    }
    this.finishStroke(pts, true);
  }

  private finishStroke(drawn: Pt[], inTime: boolean): void {
    const i = this.index();
    const trail = this.trails()[i];
    const sc = gradeStroke(trail, drawn, this.tolPx(), inTime, this.def());
    this.scores.push(sc);
    const mid = trail.points[Math.floor(trail.points.length / 2)];
    this.flashes.update(v => [...v, { key: i, trail, grade: sc.grade, at: { x: mid.x, y: mid.y - this.tolPx() } }]);
    this.ink.set([]);
    this.drawing = false;
    if (i + 1 < this.trails().length) {
      this.index.set(i + 1);
      this.phaseStart = performance.now();
      this.left.set(1);
    } else {
      this.phase.set('outro');
      const n = (g: SlashGrade) => this.scores.filter(s => s.grade === g).length;
      this.summary.set(this.scores.every(s => s.grade === 'PERFECT') ? 'ALL PERFECT!!' : `PERFECT ${n('PERFECT')} · GOOD ${n('GOOD')} · OK ${n('OK')} · MISS ${n('MISS')}`);
      this.phaseStart = performance.now();
    }
  }

  private frame(now: number): void {
    const t = (now - this.phaseStart) / 1000;
    this.zone.run(() => {
      if (this.phase() === 'intro' && t >= INTRO_S) {
        this.phase.set('play');
        this.phaseStart = now;
      } else if (this.phase() === 'play') {
        const left = Math.max(0, 1 - t / this.def().strokeWindow);
        this.left.set(left);
        // out of time: whatever was drawn does not count
        if (left <= 0) this.finishStroke(this.ink(), false);
      } else if (this.phase() === 'outro' && t >= OUTRO_S) {
        let x = (this.seed() * 0.41421356) % 1 || 0.29;
        this.plan.set(finisherPlan(this.scores.map(s => s.grade), () => (x = (x * 16807 + 0.12345) % 1)));
        this.phase.set('finisher');
        this.phaseStart = now;
      } else if (this.phase() === 'finisher' && t >= this.plan()!.duration && !this.finished) {
        this.finished = true;
        this.done.emit(this.scores.map(s => s.grade));
      }
    });
    if (!this.finished) this.raf = requestAnimationFrame(x => this.frame(x));
  }
}
