import { ChangeDetectionStrategy, Component, computed, HostListener, input, OnDestroy, OnInit, output, signal } from '@angular/core';
import { HERO_BY_ID } from '../../core/data/heroes';
import { HeroClass } from '../../core/models/hero';
import { PullResult } from '../../core/rules/stars';
import { UnitSpriteComponent } from '../../battle/unit-sprite/unit-sprite.component';
import { HeroPortraitComponent } from '../../shared/hero-portrait.component';
import { SummonTempleComponent } from './summon-temple.component';

export type SummonPull = PullResult & { name: string; cls: string };

/**
 * Summon cinematic: the temple → runes wake → a pillar of light strikes the circle (gold; 3★ in the pull = it bursts into
 * rainbow) → for each hero a silhouette walks out of the light → it ignites into the hero (name, stars, new / Memory).
 * Tap = next, ⏭ = skip to the results. Pure presentation — the pull already happened (GachaService.summon).
 */
type Phase = 'enter' | 'charge' | 'beam-on' | 'tease' | 'walk' | 'reveal' | 'out';

/** silhouette figures for heroes without a sprite sheet: body + the class weapon (viewBox 0 0 100 200, feet at y 196) */
const BODY = 'M50 14a17 17 0 1 0 .1 0Z M33 52Q50 45 67 52L72 100L64 104L61 140L66 196L54 196L50 150L46 196L34 196L39 140L36 104L28 100Z';
const WEAPON: Record<HeroClass, string> = {
  tank: 'M70 70h22v44q-11 14-22 0Z M30 58L18 96L24 99L36 70Z',
  fighter: 'M66 58L84 92L78 96L62 70Z M82 90L98 22L101 24L87 93Z',
  assassin: 'M66 58L82 88L76 92L62 70Z M80 86L94 62L96 64L84 90Z M34 58L18 88L24 92L38 70Z M20 86L6 62L4 64L16 90Z',
  archer: 'M66 58L80 84L74 88L62 70Z M84 30Q104 84 84 138L87 138Q108 84 87 30Z M85 32L85 136L86 136L86 32Z',
  mage: 'M66 58L82 90L76 94L62 70Z M80 20L84 20L86 150L82 150Z M82 6a10 10 0 1 0 .1 0Z',
  healer: 'M66 58L82 90L76 94L62 70Z M80 34L84 34L86 150L82 150Z M74 22h18v6h-6v10h-6v-10h-6Z M50 0a24 8 0 1 0 .1 0Z',
};
const CLASS_TH: Record<HeroClass, string> = { tank: 'แทงก์', fighter: 'นักสู้', assassin: 'นักฆ่า', archer: 'นักธนู', mage: 'นักเวท', healer: 'ฮีลเลอร์' };

@Component({
  selector: 'app-summon-scene',
  imports: [UnitSpriteComponent, HeroPortraitComponent, SummonTempleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="scene" [class]="'scene ' + phase() + (rainbow() ? ' rainbow' : ' gold')" (click)="tap()" role="dialog" aria-label="อัญเชิญฮีโร่">
      <div class="cam" [class.shake]="shake()">
      <!-- the temple -->
      <app-summon-temple class="temple" />

      <!-- light: rays fan, the pillar of light, the impact -->
      <div class="fan" aria-hidden="true"></div>
      <div class="beam" aria-hidden="true"><i></i></div>
      <div class="impact" aria-hidden="true"></div>
      <div class="motes" aria-hidden="true">@for (m of motes; track $index) { <i [style.left.%]="m.x" [style.animation-delay.s]="m.d" [style.animation-duration.s]="m.t"></i> }</div>

      <!-- the hero: silhouette walks out of the light, then ignites -->
      @if (cur(); as c) {
        @if (phase() === 'walk' || phase() === 'reveal') {
          <div class="figure" [class.lit]="phase() === 'reveal'" [class.r3]="c.star >= 3" [attr.data-key]="index()">
            @if (c.sprite) {
              <div class="spr"><app-unit-sprite [cls]="c.cls" [sprite]="c.sprite" [anim]="phase() === 'walk' ? 'walk' : 'idle'" /></div>
            } @else {
              <svg class="sil" viewBox="0 0 100 200" aria-hidden="true"><path [attr.d]="c.body" /></svg>
            }
          </div>
        }
        @if (phase() === 'reveal') {
          <div class="card" [class.r3]="c.star >= 3" [attr.data-key]="index()">
            <app-hero-portrait [heroId]="c.templateId" [size]="132" />
            <div class="txt">
              <span class="stars">{{ '★'.repeat(c.star) }}</span>
              <b>{{ c.name }}</b>
              <small>{{ c.clsName }}</small>
              @if (c.isNew) { <em class="new">NEW!</em> }
              @else if (c.memory) { <small class="dup">ตัวซ้ำ → Hero Memory +{{ c.memory }}</small> }
              @else { <small class="dup">6★ แล้ว → Universal +{{ c.universal }}</small> }
            </div>
          </div>
          @if (c.star >= 3) { <div class="burst" aria-hidden="true">@for (s of sparks; track $index) { <i [style.--a]="s.a + 'deg'" [style.--d]="s.d + 'px'" [style.animation-delay.s]="s.t"></i> }</div> }
        }
      }

      </div>
      <div class="hud">
        @if (results().length > 1 && index() >= 0) { <span class="count">{{ index() + 1 }} / {{ results().length }}</span> }
        <button type="button" class="skip" (click)="skip($event)">ข้าม ⏭</button>
      </div>
      @if (phase() === 'reveal') { <p class="hint">แตะเพื่อ{{ index() + 1 < results().length ? 'ไปต่อ' : 'ดูผลทั้งหมด' }}</p> }
      <div class="flash" aria-hidden="true" [class.on]="flash()"></div>
    </div>
  `,
  styles: `
    :host { position: fixed; inset: 0; z-index: 1500; display: block; }
    .scene { position: absolute; inset: 0; overflow: hidden; background: #07050d; cursor: pointer; user-select: none; -webkit-user-select: none;
      --beam: #ffe6a0; --beam2: #ffb84a; animation: in .5s ease-out both; }
    .scene.rainbow { --beam: #ffffff; --beam2: #b48cff; }
    .cam { position: absolute; inset: 0; }
    .temple { position: absolute; inset: 0; }
    /* the circle wakes up (TempleComponent reads --circle-glow / --circle-spin) */
    .charge, .beam-on, .tease, .walk, .reveal { --circle-glow: .45; }
    .charge { --circle-spin: 3s; }

    /* light pillar: grows down from above, flickers, gold or rainbow */
    .beam { position: absolute; left: 50%; top: -5%; bottom: 13%; width: min(260px, 34vw); transform: translateX(-50%) scaleY(0); transform-origin: 50% 0;
      opacity: 0; pointer-events: none; mix-blend-mode: screen; transition: transform .35s cubic-bezier(.3,1.4,.6,1), opacity .2s; }
    .beam i { position: absolute; inset: 0; border-radius: 40%/6%;
      background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--beam2) 55%, transparent) 25%, var(--beam) 45%, #fff 50%, var(--beam) 55%, color-mix(in srgb, var(--beam2) 55%, transparent) 75%, transparent);
      filter: blur(2px); animation: beamFlick .12s linear infinite alternate; }
    .rainbow .beam i { background: linear-gradient(90deg, transparent, #ff5a8a77 12%, #ffd27acc 25%, #8dffb0cc 38%, #fff 50%, #7fe3ffcc 62%, #b48cffcc 75%, #ff5a8a77 88%, transparent);
      animation: beamFlick .12s linear infinite alternate, hue 1.6s linear infinite; }
    .beam-on .beam, .tease .beam, .walk .beam, .reveal .beam { transform: translateX(-50%) scaleY(1); opacity: 1; }
    .reveal .beam { opacity: .55; }
    .fan { position: absolute; left: 50%; top: 82%; width: 260vmax; height: 260vmax; transform: translate(-50%, -50%); border-radius: 50%; opacity: 0; pointer-events: none;
      background: repeating-conic-gradient(from 0deg, color-mix(in srgb, var(--beam) 22%, transparent) 0deg 6deg, transparent 6deg 18deg);
      mask-image: radial-gradient(circle, #000 0%, transparent 42%); -webkit-mask-image: radial-gradient(circle, #000 0%, transparent 42%);
      animation: spin 30s linear infinite; transition: opacity .6s; mix-blend-mode: screen; }
    .rainbow .fan { background: repeating-conic-gradient(from 0deg, #ff5a8a33 0deg 6deg, transparent 6deg 12deg, #7fe3ff33 12deg 18deg, transparent 18deg 24deg, #ffd27a33 24deg 30deg, transparent 30deg 36deg); }
    .beam-on .fan, .tease .fan, .walk .fan, .reveal .fan { opacity: 1; }
    .impact { position: absolute; left: 50%; top: 85%; width: min(560px, 80vw); aspect-ratio: 3 / 1; transform: translate(-50%, -50%) scale(.2); border-radius: 50%; opacity: 0; pointer-events: none;
      background: radial-gradient(ellipse, #fff 0%, var(--beam) 30%, color-mix(in srgb, var(--beam2) 50%, transparent) 55%, transparent 72%); mix-blend-mode: screen; }
    .beam-on .impact, .tease .impact { animation: impact .7s ease-out both; }
    .rainbow .impact { background: radial-gradient(ellipse, #fff 0%, #ffd27a 25%, #7fe3ff 40%, #b48cff88 55%, transparent 72%); animation: impact .7s ease-out both, hue 1.6s linear infinite; }
    .motes { position: absolute; inset: 0; pointer-events: none; }
    .motes i { position: absolute; bottom: 12%; width: 4px; height: 4px; border-radius: 50%; background: var(--beam); box-shadow: 0 0 8px var(--beam2); opacity: 0;
      animation: rise linear infinite; }
    .enter .motes i { animation-play-state: paused; }

    /* the hero coming out of the light */
    .figure { position: absolute; left: 50%; bottom: 12%; width: min(240px, 34vw); aspect-ratio: 1 / 1.4; transform: translateX(-50%); pointer-events: none;
      animation: walkOut 1.15s cubic-bezier(.25,.6,.3,1) both; }
    .spr { position: absolute; left: 0; right: 0; bottom: 0; aspect-ratio: 1; }
    .spr app-unit-sprite { position: absolute; inset: 0; }
    .sil { position: absolute; inset: 0; width: 100%; height: 100%; fill: #05030a; }
    .figure .spr, .figure .sil { filter: brightness(0) drop-shadow(0 0 3px var(--beam)) drop-shadow(0 0 14px var(--beam2)); transition: filter .5s ease, opacity .5s; }
    .figure.lit .spr { filter: drop-shadow(0 0 10px var(--beam)); }
    .figure.lit .sil { opacity: 0; }
    .figure.lit { animation: none; transform: translateX(-50%); }
    .rainbow .figure.r3 .spr, .rainbow .figure.r3 .sil { animation: hue 1.6s linear infinite; }

    .card { position: absolute; left: 50%; top: 14%; transform: translateX(-50%); display: flex; align-items: center; gap: 16px; padding: 14px 22px 14px 14px; border-radius: 18px;
      background: linear-gradient(180deg, #1c1630ee, #0b0914ee); border: 1px solid #d9b464aa; box-shadow: 0 0 30px #d9b46455, 0 10px 30px #000c;
      animation: cardIn .45s cubic-bezier(.2,1.3,.4,1) both; white-space: nowrap; }
    .card.r3 { border-color: transparent; background: linear-gradient(#140f22, #0b0914) padding-box, linear-gradient(90deg, #ff5a8a, #ffd27a, #8dffb0, #7fe3ff, #b48cff, #ff5a8a) border-box;
      border: 2px solid transparent; box-shadow: 0 0 40px #b48cff88, 0 0 70px #7fe3ff44; }
    .txt { display: grid; gap: 2px; justify-items: start; }
    .stars { font-size: 26px; letter-spacing: 3px; color: var(--gold-hi); text-shadow: 0 0 10px #d9b464aa; }
    .card.r3 .stars { background: linear-gradient(90deg, #ff5a8a, #ffd27a, #8dffb0, #7fe3ff, #b48cff); -webkit-background-clip: text; background-clip: text; color: transparent;
      text-shadow: none; filter: drop-shadow(0 0 8px #ffffffaa); }
    .txt b { font: 800 30px var(--title); color: #fff3d6; letter-spacing: .04em; text-shadow: 0 2px 0 #000, 0 0 16px #d9b46488; }
    .txt small { font-size: 13px; color: var(--muted); }
    .txt .dup { color: #c9adff; }
    .new { font-style: normal; padding: 1px 10px; border-radius: 99px; background: linear-gradient(180deg, #f8e4a8, #d9b464); color: #211606; font: 800 12px var(--title); letter-spacing: .08em; }

    .burst { position: absolute; left: 50%; top: 62%; pointer-events: none; }
    .burst i { position: absolute; width: 8px; height: 8px; border-radius: 2px; transform: rotate(45deg);
      background: hsl(calc(var(--a) * 1), 90%, 70%); box-shadow: 0 0 10px hsl(calc(var(--a) * 1), 90%, 70%);
      animation: spark 1.2s cubic-bezier(.2,.8,.3,1) both; }

    .hud { position: absolute; top: max(12px, env(safe-area-inset-top)); right: 14px; display: flex; gap: 10px; align-items: center; z-index: 3; }
    .count { font: 700 14px var(--title); color: var(--gold-hi); text-shadow: 0 1px 2px #000; }
    .skip { padding: 6px 14px; border-radius: 99px; border: 1px solid #d9b46488; background: #0b0914cc; color: var(--gold-hi); font: 700 13px var(--title); cursor: pointer; }
    .hint { position: absolute; left: 0; right: 0; bottom: 3%; margin: 0; text-align: center; color: #fff3d6aa; font-size: 13px; animation: pulse 1.4s ease-in-out infinite alternate; }
    .flash { position: absolute; inset: 0; background: #fff; opacity: 0; pointer-events: none; transition: opacity .38s ease-out; }
    .flash.on { opacity: .7; transition: none; }
    .rainbow .flash.on { background: linear-gradient(120deg, #ffd6e4, #fff6d8, #d8fff0, #d8f4ff, #ecdfff); }
    .shake { animation: shake .4s linear; }

    @keyframes in { from { opacity: 0; } }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes flick { to { transform: scale(.85, 1.1); } }
    @keyframes glow { to { fill-opacity: .3; } }
    @keyframes beamFlick { to { opacity: .82; } }
    @keyframes hue { to { filter: hue-rotate(360deg); } }
    @keyframes impact { 0% { opacity: 0; transform: translate(-50%, -50%) scale(.2); } 25% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -50%) scale(1.6); } }
    @keyframes rise { 0% { opacity: 0; transform: translateY(0); } 15% { opacity: .9; } 100% { opacity: 0; transform: translateY(-60vh); } }
    @keyframes walkOut { 0% { opacity: 0; transform: translateX(-50%) translateY(-60px) scale(.45); } 25% { opacity: 1; } 100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); } }
    @keyframes cardIn { from { opacity: 0; transform: translateX(-50%) translateY(-14px) scale(.9); } }
    @keyframes spark { from { transform: rotate(var(--a)) translateX(0) rotate(45deg) scale(1); opacity: 1; } to { transform: rotate(var(--a)) translateX(var(--d)) rotate(45deg) scale(.3); opacity: 0; } }
    @keyframes shake { 0%, 100% { transform: none; } 20% { transform: translate(-6px, 3px); } 40% { transform: translate(5px, -4px); } 60% { transform: translate(-4px, 2px); } 80% { transform: translate(3px, -1px); } }
    @keyframes pulse { to { opacity: .45; } }
    @media (max-width: 700px) {
      .card { top: 8%; gap: 10px; padding: 10px 14px 10px 10px; }
      .card app-hero-portrait { transform: scale(.75); margin: -16px; }
      .txt b { font-size: 22px; } .stars { font-size: 20px; }
    }
    @media (prefers-reduced-motion: reduce) { .fan, .motes i, .beam i { animation: none !important; } }
  `,
})
export class SummonSceneComponent implements OnInit, OnDestroy {
  readonly results = input.required<SummonPull[]>();
  readonly done = output<void>();

  readonly phase = signal<Phase>('enter');
  readonly index = signal(-1);
  readonly flash = signal(false);
  readonly shake = signal(false);
  /** best rarity of the pull — the intro beam turns rainbow for a 3★ */
  readonly best = computed(() => Math.max(...this.results().map(r => r.star)));
  /** colour of the light right now: the intro follows the best pull, each reveal follows its own hero */
  readonly rainbow = computed(() => {
    const p = this.phase(), i = this.index();
    if (i < 0 || p === 'out') return this.teased();
    return (this.results()[i]?.star ?? 1) >= 3;
  });
  private readonly teased = signal(false);
  readonly cur = computed(() => {
    const r = this.results()[this.index()];
    if (!r) return null;
    const t = HERO_BY_ID[r.templateId];
    const cls = (t?.cls ?? 'fighter') as HeroClass;
    return { ...r, cls, clsName: CLASS_TH[cls], sprite: t?.sprite, body: BODY + ' ' + WEAPON[cls] };
  });

  readonly motes = Array.from({ length: 22 }, (_, i) => ({ x: 38 + ((i * 37) % 24), d: -(i * 0.41) % 4, t: 2.6 + (i % 5) * 0.5 }));
  readonly sparks = Array.from({ length: 28 }, (_, i) => ({ a: (i * 360) / 28, d: 140 + (i % 4) * 50, t: (i % 3) * 0.05 }));

  private timers: ReturnType<typeof setTimeout>[] = [];
  private readonly fast = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  ngOnInit(): void {
    // the opening: runes wake → the beam strikes (gold) → a 3★ in the pull = it bursts into rainbow → first hero
    const k = this.fast ? 0.4 : 1;
    this.at(450 * k, () => this.phase.set('charge'));
    this.at(1300 * k, () => {
      this.phase.set('beam-on');
      this.hit();
    });
    let t = 2100 * k;
    if (this.best() >= 3) {
      this.at(t, () => {
        this.teased.set(true);
        this.phase.set('tease');
        this.hit();
      });
      t += 900 * k;
    }
    this.at(t, () => this.show(0));
  }

  ngOnDestroy(): void {
    this.timers.forEach(clearTimeout);
  }

  private at(ms: number, fn: () => void): void {
    this.timers.push(setTimeout(fn, ms));
  }

  private hit(): void {
    this.flash.set(true);
    this.shake.set(true);
    this.at(60, () => this.flash.set(false));
    this.at(420, () => this.shake.set(false));
  }

  /** hero i: silhouette walks out of the light, then ignites */
  private show(i: number): void {
    this.index.set(i);
    this.phase.set('walk');
    this.at(this.fast ? 400 : 1150, () => {
      this.phase.set('reveal');
      this.hit();
    });
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') this.finish();
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.tap();
    }
  }

  tap(): void {
    if (this.phase() !== 'reveal') return;
    const next = this.index() + 1;
    if (next < this.results().length) this.show(next);
    else this.finish();
  }

  skip(e: Event): void {
    e.stopPropagation();
    this.finish();
  }

  private finish(): void {
    if (this.phase() === 'out') return;
    this.phase.set('out');
    this.timers.forEach(clearTimeout);
    this.done.emit();
  }
}
