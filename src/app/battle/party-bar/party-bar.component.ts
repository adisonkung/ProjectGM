import { Component, input, output } from '@angular/core';
import { UnitView } from '../board/board.component';
import { UnitSpriteComponent } from '../unit-sprite/unit-sprite.component';

/**
 * แถบตัวละครใต้สนาม เรียงซ้าย→ขวาตามทีม: กรอบรูป + เลือด + เกจมานา (ท่าไม้ตาย)
 * เกจเต็ม → กรอบมีแสงนีออนวิ่งรอบ แตะรูปเพื่อใช้ท่าไม้ตาย
 */
@Component({
  selector: 'app-party-bar',
  imports: [UnitSpriteComponent],
  template: `
    <div class="bar" role="group" aria-label="ทีมของเรา แตะรูปเมื่อเกจเต็มเพื่อใช้ท่าไม้ตาย">
      @for (u of units(); track u.id; let i = $index) {
        @let ready = u.alive && u.manaPct >= 100;
        <button type="button" class="card" [class.ready]="ready" [class.queued]="!!u.queued" [class.dead]="!u.alive"
                [disabled]="!ready" (click)="ult.emit(u.id)"
                [attr.aria-label]="u.name + (ready ? ' ท่าไม้ตายพร้อม กดเพื่อใช้' : ' เกจ ' + pct(u.manaPct) + '%')">
          <span class="frame" [style.--rc]="'var(--r' + (u.star ?? 1) + ')'">
            <span class="face" [class.token]="!u.sprite"><app-unit-sprite [cls]="u.cls" [sprite]="u.sprite" [star]="u.star" /></span>
            <span class="key">{{ i + 1 }}</span>
            @if (ready) { <span class="ult">{{ u.queued ? 'รอร่าย' : 'ULT' }}</span> }
          </span>
          <span class="hp"><i [style.width.%]="u.hpPct"></i></span>
          <span class="mana" [class.full]="ready"><i [style.width.%]="u.manaPct"></i></span>
          <span class="name">{{ u.name }}</span>
        </button>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .bar { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
    .card {
      display: grid; gap: 3px; width: 76px; padding: 0; border: 0; background: none; color: inherit;
      cursor: default; font: inherit;
      &.ready { cursor: pointer; }
      &:disabled { opacity: 1; }
      &.dead { filter: grayscale(1) brightness(0.55); }
    }
    .frame {
      position: relative; display: block; width: 76px; height: 76px; border-radius: 10px; overflow: hidden;
      background: color-mix(in srgb, var(--rc) 16%, var(--panel)); box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--rc) 70%, transparent);
    }
    .face {
      position: absolute; left: 0; top: 0; width: 100%; height: 100%;
      transform: translateY(62%) scale(1.7); transform-origin: 50% 100%; z-index: 2;
    }
    .face.token { transform: none; }
    .key { position: absolute; top: 3px; left: 5px; z-index: 3; font: 700 11px var(--disp); color: var(--muted); }
    .ult {
      position: absolute; left: 50%; bottom: 4px; transform: translateX(-50%); z-index: 3; padding: 0 6px;
      border-radius: 999px; background: #000b; font: 700 11px var(--disp); color: var(--cyan); letter-spacing: 0.08em;
    }
    // เกจเต็ม: เส้นนีออนวิ่งรอบกรอบ (conic-gradient หมุน แล้วเจาะกลางด้วย ::after)
    .ready .frame { box-shadow: 0 0 12px #5ec8e0aa, 0 0 22px #b07cf066; animation: pulse 1.2s ease-in-out infinite alternate; }
    .ready .frame::before {
      content: ''; position: absolute; inset: -40%; z-index: 0;
      background: conic-gradient(from 0deg, transparent 0 55%, #5ec8e0, #fff, #b07cf0, transparent 85%);
      animation: spin 1.4s linear infinite;
    }
    .ready .frame::after {
      content: ''; position: absolute; inset: 3px; z-index: 1; border-radius: 8px;
      background: color-mix(in srgb, var(--rc) 16%, var(--panel));
    }
    .queued .frame { box-shadow: 0 0 16px #fff, 0 0 26px #5ec8e0; }
    .hp, .mana { display: block; height: 5px; border-radius: 3px; background: #0009; overflow: hidden; }
    .hp i, .mana i { display: block; height: 100%; transition: width 0.15s linear; }
    .hp i { background: var(--hp); }
    .mana { height: 7px; }
    .mana i { background: linear-gradient(90deg, #3d8fd8, var(--cyan)); }
    .mana.full i { background: linear-gradient(90deg, var(--cyan), #fff, #b07cf0); }
    .name { font-size: 11px; color: var(--muted); text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes pulse { to { box-shadow: 0 0 18px #5ec8e0, 0 0 30px #b07cf0aa; } }
    @media (max-width: 480px) { .card { width: 58px; } .frame { width: 58px; height: 58px; } }
    @media (prefers-reduced-motion: reduce) { .ready .frame::before, .ready .frame { animation: none; } }
  `,
})
export class PartyBarComponent {
  readonly units = input<UnitView[]>([]);
  readonly ult = output<number>();

  pct(v: number): number {
    return Math.floor(v);
  }
}
