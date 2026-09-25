import { Component, input } from '@angular/core';

export interface CastView {
  label: string;
  name: string;
  /** 0–100 */
  pct: number;
  left: number;
  interruptible: boolean;
  /** breakable cast: Break Gauge fill 0–100 */
  breakPct?: number;
}

/** แถบร่ายสกิลของศัตรูเหนือหัว: ⚠ ชื่อ + แถบ + วินาทีที่เหลือ (ตัดไม่ได้ = กรอบแดง UNINTERRUPTIBLE) */
@Component({
  selector: 'app-cast-bar',
  template: `
    <div class="cast" [class.hard]="!cast().interruptible" role="status">
      <b>⚠ {{ cast().label }}</b>
      <span class="track"><i [style.width.%]="cast().pct"></i></span>
      @if (cast().breakPct != null) {
        <span class="track brk" title="Break Gauge"><i [style.width.%]="cast().breakPct"></i></span>
        <small>{{ cast().left.toFixed(1) }}s · BREAK {{ cast().breakPct!.toFixed(0) }}%</small>
      } @else {
        <small>{{ cast().left.toFixed(1) }}s{{ cast().interruptible ? '' : ' · UNINTERRUPTIBLE' }}</small>
      }
    </div>
  `,
  styles: `
    :host { position: absolute; left: 50%; bottom: 112%; transform: translateX(-50%); z-index: 5; pointer-events: none; }
    .cast {
      display: grid; justify-items: center; gap: 2px; padding: 3px 6px 2px; border-radius: 6px;
      background: #0d1220e6; border: 1px solid var(--gold); box-shadow: 0 0 10px #f0b54a66;
      animation: blink 0.6s ease-in-out infinite alternate;
    }
    b { font: 700 10px var(--disp); color: var(--gold); letter-spacing: 0.06em; white-space: nowrap; }
    small { font: 600 9px var(--disp); color: var(--text); white-space: nowrap; }
    .track { display: block; width: 64px; height: 5px; border-radius: 3px; background: #0009; overflow: hidden; }
    i { display: block; height: 100%; background: linear-gradient(90deg, var(--gold), #fff3c4); }
    .brk { width: 64px; i { background: linear-gradient(90deg, #ff8a2a, #ffe08a) !important; } }
    .hard { border-color: var(--danger); box-shadow: 0 0 10px #e3625a88; b { color: var(--danger); } i { background: var(--danger); } }
    @keyframes blink { to { box-shadow: 0 0 16px #f0b54a; } }
    @media (prefers-reduced-motion: reduce) { .cast { animation: none; } }
  `,
})
export class CastBarComponent {
  readonly cast = input.required<CastView>();
}
