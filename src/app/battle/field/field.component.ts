import { Component } from '@angular/core';
import { BOARD_COLS, BOARD_ROWS, SCENERY_ROWS, SIDE_DEPTH } from '../engine/grid';

/**
 * ฉากหลังของสนาม: แถวบน SCENERY_ROWS แถวเป็นทิวทัศน์ (ต้นไม้/เนินเขา) ให้ดูมีความสูง
 * แถวล่างเป็นพื้นหญ้าที่ยืนได้ แบ่งช่องจาง ๆ ฝั่งเรา (ซ้าย) / ศัตรู (ขวา)
 * วางเป็นชั้นล่างสุดของกระดาน (absolute เต็มพื้นที่)
 */
@Component({
  selector: 'app-field',
  template: `
    <div class="sky" [style.height.%]="skyPct"></div>
    <div class="ground" [style.top.%]="skyPct" [style.grid-template-columns]="'repeat(' + cols + ', 1fr)'" [style.grid-template-rows]="'repeat(' + rows + ', 1fr)'">
      @for (t of tiles; track $index) {
        <i [class.enemy]="t.enemy" [class.odd]="t.odd"></i>
      }
    </div>
    <div class="mid" [style.top.%]="skyPct"></div>
  `,
  styles: `
    :host { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
    .sky {
      position: absolute; left: 0; right: 0; top: 0;
      background:
        radial-gradient(ellipse 14% 38% at 6% 100%, #173226 60%, transparent 62%),
        radial-gradient(ellipse 10% 30% at 19% 100%, #1a3a2b 60%, transparent 62%),
        radial-gradient(ellipse 13% 42% at 33% 100%, #163024 60%, transparent 62%),
        radial-gradient(ellipse 9% 28% at 47% 100%, #1b3b2c 60%, transparent 62%),
        radial-gradient(ellipse 15% 40% at 62% 100%, #173226 60%, transparent 62%),
        radial-gradient(ellipse 10% 32% at 78% 100%, #1a3a2b 60%, transparent 62%),
        radial-gradient(ellipse 13% 44% at 93% 100%, #163024 60%, transparent 62%),
        radial-gradient(ellipse 60% 55% at 30% 100%, #243b43 70%, transparent 72%),
        radial-gradient(ellipse 55% 50% at 80% 100%, #22363f 70%, transparent 72%),
        radial-gradient(circle at 78% 30%, #f3d59a55 0 6%, transparent 18%),
        linear-gradient(180deg, #121a33 0%, #2a3150 55%, #4a4258 100%);
    }
    .sky::after {
      content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 22%;
      background: linear-gradient(180deg, transparent, #24402b);
    }
    .ground {
      position: absolute; left: 0; right: 0; bottom: 0; display: grid;
      background: linear-gradient(180deg, #24402b, #2c4c30 40%, #27432b);
    }
    i { box-shadow: inset 0 0 0 0.5px #ffffff0d; background: #5ec8e008; }
    i.odd { background: #5ec8e012; }
    i.enemy { background: #e3625a08; }
    i.enemy.odd { background: #e3625a14; }
    .mid {
      position: absolute; bottom: 0; left: 50%; width: 2px; margin-left: -1px;
      background: repeating-linear-gradient(180deg, var(--gold) 0 6px, transparent 6px 11px); opacity: 0.45;
    }
  `,
})
export class FieldComponent {
  readonly cols = BOARD_COLS;
  readonly rows = BOARD_ROWS;
  readonly skyPct = (SCENERY_ROWS / (SCENERY_ROWS + BOARD_ROWS)) * 100;
  readonly tiles = Array.from({ length: BOARD_ROWS * BOARD_COLS }, (_, i) => {
    const r = Math.floor(i / BOARD_COLS);
    const c = i % BOARD_COLS;
    return { enemy: c >= SIDE_DEPTH, odd: (r + c) % 2 === 1 };
  });
}
