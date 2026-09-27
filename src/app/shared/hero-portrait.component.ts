import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { heroArt } from '../core/data/hero-art';
import { HERO_BY_ID } from '../core/data/heroes';
import { HeroClass } from '../core/models/hero';

/** class sigil drawn when a hero has no painted portrait yet */
const CLASS_GLYPH: Record<HeroClass, string> = {
  tank: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  fighter: 'M14.5 3H21v6.5L10 20.5 3.5 14z M5 19l-2 2 M8 16l-3-3',
  assassin: 'M4 20L20 4 M14 4h6v6 M4 14l6 6 M7 11l6 6',
  archer: 'M5 19C5 10 10 5 19 5 M5 19l14-14 M15 5h4v4 M3 21l3-3',
  mage: 'M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z',
  healer: 'M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z',
};

const firstGrapheme = (s: string) => {
  const Seg = (Intl as unknown as { Segmenter?: new (l: string, o: object) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  if (!Seg) return s.slice(0, 1);
  for (const g of new Seg('th', { granularity: 'grapheme' }).segment(s)) return g.segment;
  return '';
};

/** framed hero portrait: painted art or a class sigil, rarity-coloured frame (1★ steel … 5★ gold) */
@Component({
  selector: 'app-hero-portrait',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="frame r{{ star() }}" [style.width.px]="size()" [style.height.px]="size()">
      @if (art(); as src) {
        <img [src]="src" [alt]="alt()" loading="lazy" draggable="false" />
      } @else {
        <span class="sigil" [attr.aria-label]="alt()" role="img">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path [attr.d]="glyph()" /></svg>
          <b>{{ initial() }}</b>
        </span>
      }
    </span>`,
  styles: [`
    :host { display: inline-flex; flex: none; }
    .frame { position: relative; display: block; border-radius: 12px; overflow: hidden; padding: 2px;
      background: linear-gradient(160deg, var(--rc), #0000 45%, var(--rc)); box-shadow: 0 0 0 1px #000, 0 0 14px color-mix(in srgb, var(--rc) 35%, transparent); }
    .r1 { --rc: var(--r1); } .r2 { --rc: var(--r2); } .r3 { --rc: var(--r3); } .r4 { --rc: var(--r4); } .r5 { --rc: var(--r5); } .r6 { --rc: var(--r6); }
    .r6 { box-shadow: 0 0 0 1px #000, 0 0 16px color-mix(in srgb, var(--r6) 60%, transparent), 0 0 30px color-mix(in srgb, var(--r5) 35%, transparent); }
    img, .sigil { display: block; width: 100%; height: 100%; border-radius: 10px; object-fit: cover; background: #0c0a14; }
    .sigil { position: relative; display: grid; place-items: center; color: var(--rc);
      background: radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--rc) 28%, #16122a), #0b0914 75%); }
    .sigil svg { width: 52%; height: 52%; opacity: 0.55; }
    .sigil b { position: absolute; inset: auto 0 6%; text-align: center; font: 700 clamp(10px, 22%, 22px) var(--title); color: var(--text); text-shadow: 0 1px 4px #000; }
  `],
})
export class HeroPortraitComponent {
  readonly heroId = input.required<string>();
  readonly size = input(72);
  /** owned (developed) star — frame colour; default = the template's base rarity */
  readonly ownedStar = input<number | null>(null, { alias: 'star' });
  readonly t = computed(() => HERO_BY_ID[this.heroId()]);
  readonly star = computed(() => this.ownedStar() ?? this.t()?.star ?? 1);
  readonly art = computed(() => heroArt(this.heroId())?.portrait ?? null);
  readonly alt = computed(() => this.t()?.name ?? this.heroId());
  readonly initial = computed(() => firstGrapheme(this.alt()));
  readonly glyph = computed(() => CLASS_GLYPH[this.t()?.cls ?? 'fighter']);
}
