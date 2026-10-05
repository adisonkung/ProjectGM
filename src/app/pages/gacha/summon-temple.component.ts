import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * The summoning temple (pure SVG, scales to any screen): rose window, perspective pillars, banners, candles and the
 * summoning circle on the floor. Used as the gacha page backdrop and inside the summon cinematic.
 * The circle reads --circle-glow (0–1) and --circle-spin (duration) from the parent.
 */
@Component({
  selector: 'app-summon-temple',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="sm-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b0716" /><stop offset=".55" stop-color="#1b1233" /><stop offset="1" stop-color="#0a0712" /></linearGradient>
        <linearGradient id="sm-pillar" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#120c22" /><stop offset=".35" stop-color="#3a2c5c" /><stop offset=".6" stop-color="#241a3c" /><stop offset="1" stop-color="#0c0818" /></linearGradient>
        <radialGradient id="sm-floor" cx=".5" cy=".2" r=".8"><stop offset="0" stop-color="#3b2a66" /><stop offset=".55" stop-color="#160f29" /><stop offset="1" stop-color="#07050d" /></radialGradient>
        <radialGradient id="sm-rose" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff3c8" stop-opacity=".9" /><stop offset=".45" stop-color="#b48cff" stop-opacity=".55" /><stop offset="1" stop-color="#3b2470" stop-opacity=".2" /></radialGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#sm-wall)" />
      <!-- back arch + rose window -->
      <path d="M520 900V360Q800 40 1080 360V900Z" fill="#100a1f" stroke="#d9b46433" stroke-width="3" />
      <g class="rose" transform="translate(800 300)">
        <circle r="150" fill="url(#sm-rose)" stroke="#d9b46499" stroke-width="5" />
        <circle r="104" fill="none" stroke="#d9b46477" stroke-width="3" />
        <circle r="40" fill="#fff6d8" fill-opacity=".55" stroke="#d9b464" stroke-width="3" />
        @for (a of spokes; track a) { <line x1="0" y1="-40" x2="0" y2="-150" stroke="#d9b46488" stroke-width="3" [attr.transform]="'rotate(' + a + ')'" /> }
        @for (a of spokes; track a) { <circle cx="0" cy="-127" r="16" fill="none" stroke="#d9b46466" stroke-width="2" [attr.transform]="'rotate(' + (a + 15) + ')'" /> }
      </g>
      <!-- pillars (perspective: big near, small far) -->
      @for (p of pillars; track $index) {
        <g [attr.transform]="'translate(' + p.x + ' ' + p.y + ') scale(' + p.s + ')'">
          <rect x="-48" y="0" width="96" height="900" fill="url(#sm-pillar)" />
          <rect x="-62" y="-6" width="124" height="34" rx="4" fill="#2b1f46" stroke="#d9b46455" stroke-width="2" />
          <rect x="-58" y="28" width="116" height="10" fill="#1a1230" />
          @for (k of [0, 1, 2]; track k) { <rect [attr.x]="-30 + k * 26" y="40" width="6" height="860" fill="#00000033" /> }
        </g>
      }
      <!-- banners + candles -->
      @for (b of banners; track $index) {
        <g [attr.transform]="'translate(' + b.x + ' 120)'">
          <path d="M-40 0h80v230l-40 -30l-40 30Z" fill="#3a1a4a" stroke="#d9b46488" stroke-width="3" />
          <path d="M0 50l14 26l-14 26l-14 -26Z" fill="#d9b464" fill-opacity=".8" />
        </g>
      }
      <!-- floor -->
      <rect y="640" width="1600" height="260" fill="url(#sm-floor)" />
      <path d="M0 640H1600" stroke="#d9b46433" stroke-width="2" />
      @for (c of candles; track $index) {
        <g class="candle" [attr.transform]="'translate(' + c.x + ' ' + c.y + ')'">
          <rect x="-6" y="0" width="12" height="40" fill="#e9dcc0" />
          <ellipse class="flame" cx="0" cy="-8" rx="6" ry="12" fill="#ffd27a" />
          <circle class="glow" cx="0" cy="-8" r="34" fill="#ffb84a" fill-opacity=".18" />
        </g>
      }
      <!-- the summoning circle (flattened for the floor) -->
      <g transform="translate(800 762) scale(1 .3)">
        <circle class="c-glow" r="260" fill="#9b6bff" />
        <g class="c-spin">
          <circle r="240" fill="none" stroke="#d9b464" stroke-width="5" stroke-dasharray="18 12" />
          <circle r="196" fill="none" stroke="#c9adff" stroke-width="3" />
          <path d="M0 -196L170 98L-170 98Z M0 196L-170 -98L170 -98Z" fill="none" stroke="#d9b464" stroke-width="3" />
        </g>
        <g class="c-spin rev"><circle r="120" fill="none" stroke="#fff3c8" stroke-width="3" stroke-dasharray="6 10" /></g>
      </g>
    </svg>
  `,
  styles: `
    :host { display: block; }
    svg { display: block; width: 100%; height: 100%; }
    .rose { transform-box: fill-box; transform-origin: center; }
    .candle .flame { animation: flick .18s ease-in-out infinite alternate; transform-box: fill-box; transform-origin: 50% 100%; }
    .candle .glow { animation: glow 2.4s ease-in-out infinite alternate; }
    .c-spin { animation: spin var(--circle-spin, 18s) linear infinite; transform-box: fill-box; transform-origin: center; }
    .c-spin.rev { animation-duration: 9s; animation-direction: reverse; }
    .c-glow { fill-opacity: var(--circle-glow, .12); transition: fill-opacity .6s; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes flick { to { transform: scale(.85, 1.1); } }
    @keyframes glow { to { fill-opacity: .3; } }
    @media (prefers-reduced-motion: reduce) { .c-spin, .candle .flame, .candle .glow { animation: none; } }
  `,
})
export class SummonTempleComponent {
  readonly spokes = Array.from({ length: 12 }, (_, i) => i * 30);
  readonly pillars = [
    { x: 150, y: 40, s: 1.35 }, { x: 410, y: 150, s: 0.95 }, { x: 1190, y: 150, s: 0.95 }, { x: 1450, y: 40, s: 1.35 },
  ];
  readonly banners = [{ x: 560 }, { x: 1040 }];
  readonly candles = [{ x: 600, y: 690 }, { x: 680, y: 720 }, { x: 920, y: 720 }, { x: 1000, y: 690 }];
}
