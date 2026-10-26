import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from './icon.component';

/** Decorative compass seal for empty/error states, using the existing game icon set. */
@Component({
  selector: 'app-state-emblem',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `<svg viewBox="0 0 200 200" fill="none">
    <circle cx="100" cy="100" r="65"/><circle cx="100" cy="100" r="73"/><circle cx="100" cy="100" r="82" stroke-dasharray="1 9"/>
    <path d="M100 3 106 27 100 43 94 27Z M197 100 173 106 157 100 173 94Z M100 197 94 173 100 157 106 173Z M3 100 27 94 43 100 27 106Z M100 19V55 M100 145V181 M19 100H55 M145 100H181 M43 43 60 60 M140 140 157 157 M43 157 60 140 M140 60 157 43"/>
    <path d="M54 26 58 40 72 44 58 48 54 62 50 48 36 44 50 40Z M148 141 152 153 164 157 152 161 148 173 144 161 132 157 144 153Z"/>
  </svg>@if (icon() === 'search') { <app-icon name="search" [size]="88" /> } @else if (icon() === 'armor') { <svg class="core" viewBox="0 0 100 100"><path d="M33 18 15 30 22 47 32 43 29 80Q50 88 71 80L68 43 78 47 85 30 67 18Q63 38 50 39 37 38 33 18Z M33 18 43 14H57L67 18 M32 54 44 61H56L68 54 M50 40V78"/></svg> } @else { <app-icon [name]="icon()" [size]="76" /> }`,
  styles: [`:host{position:relative;display:grid;place-items:center;width:190px;height:190px;color:#f4db9c;filter:drop-shadow(0 2px 2px #000b);}svg{position:absolute;inset:0;width:100%;height:100%;stroke:#e6c58b;stroke-width:1.1;} :host::before{content:'';position:absolute;inset:26px;border-radius:50%;background:radial-gradient(circle,#18232bd9,#27323acc 64%,#eed49933);box-shadow:0 0 20px #f7df9d44,inset 0 0 18px #040b0f99;}.core{position:relative;width:88px;height:88px;stroke:#f7e1ad;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;fill:#e9cd8e25;}app-icon{position:relative;filter:drop-shadow(0 1px 0 #fff3c388);}`],
})
export class StateEmblemComponent { readonly icon = input('search'); }
