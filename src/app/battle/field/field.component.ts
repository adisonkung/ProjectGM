import { Component, computed, input } from '@angular/core';
import { BackgroundDef } from '../../core/data/backgrounds';
import { BOARD_COLS, BOARD_ROWS, SCENERY_ROWS } from '../engine/grid';

/**
 * ฉากหลังของสนามแบบพาราแลกซ์ (ด้านข้าง)
 * - ท้องฟ้า + ดวงจันทร์: นิ่ง
 * - เนินเขาไกล / แนวต้นไม้ / พื้นหญ้า + ของตกแต่ง: เลื่อนซ้ายด้วยความเร็วต่างกัน เมื่อ `scroll` เพิ่มขึ้น
 *   (scroll = ตำแหน่งกล้องในโลก หน่วยเป็นช่อง — Advance Phase เลื่อนกล้องตามจุดกำเนิดฟอร์เมชันอย่างต่อเนื่อง)
 * ถ้าด่านมีภาพพื้นหลัง (`bg`) จะใช้ภาพแทน โดยตัดเป็น 2 ชั้นที่เส้น cut: ชั้นบนเลื่อน 0.4× ชั้นพื้นเลื่อน 1×
 * วางเป็นชั้นล่างสุดของกระดาน (absolute เต็มพื้นที่) ต้องมี CSS var --cell จากกระดาน
 */
@Component({
  selector: 'app-field',
  template: `
    @if (img(); as g) {
      <div class="layers" [style.--shift]="live() ? null : shift()" [style.--dur]="live() ? '0ms' : duration() + 'ms'">
        <div class="img" [style.height.%]="g.cut * 100" [style.background-image]="g.url" [style.background-size]="g.size"
             [style.background-position]="'calc(var(--shift) * var(--screen) * -0.4) ' + g.y"></div>
        <div class="img" [style.top.%]="g.cut * 100" [style.bottom]="0" [style.background-image]="g.url" [style.background-size]="g.size"
             [style.background-position]="'calc(var(--shift) * var(--screen) * -1) ' + g.yGround"></div>
        <div class="mid faint" [style.top.%]="g.cut * 100"></div>
      </div>
      <!-- free strip under the lanes: the image's bottom band again, darkened into a tray -->
      <div class="foot" [style.background-image]="g.url" [style.background-size]="g.size"
           [style.background-position]="'calc(var(--shift, ' + shift() + ') * var(--cell) * -1) 100%'"></div>
    } @else {
    <div class="layers" [style.--shift]="live() ? null : shift()" [style.--dur]="live() ? '0ms' : duration() + 'ms'">
      <div class="sky" [style.height.%]="skyPct"></div>
      <div class="hills" [style.height.%]="skyPct"></div>
      <div class="trees" [style.height.%]="skyPct"></div>
      <div class="ground" [style.top.%]="skyPct"></div>
      <div class="deco" [style.top.%]="skyPct"></div>
      <div class="tint" [style.top.%]="skyPct"></div>
      <div class="mid" [style.top.%]="skyPct"></div>
    </div>
    <div class="foot plain"></div>
    }
  `,
  styles: `
    :host { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
    .layers { position: absolute; left: 0; right: 0; top: 0; bottom: var(--foot, 0px); --screen: var(--cell); }
    .foot { position: absolute; left: 0; right: 0; bottom: 0; height: var(--foot, 0px); background-repeat: repeat-x; image-rendering: pixelated;
      transition: background-position var(--dur, 0ms) linear; }
    .foot::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, #0b081400 0%, #0b081499 35%, #0b0814d9 100%); }
    .foot.plain { background: linear-gradient(180deg, #27432b, #1b2e1f); }
    .layers > div { position: absolute; left: 0; right: 0; }
    .sky {
      top: 0;
      background:
        radial-gradient(circle at 80% 32%, #f3d59a66 0 5%, transparent 16%),
        linear-gradient(180deg, #121a33 0%, #2a3150 55%, #4a4258 100%);
    }
    .hills, .trees, .ground, .deco {
      background-repeat: repeat-x;
      transition: background-position var(--dur, 0ms) linear;
    }
    .hills {
      top: 0;
      background-image:
        radial-gradient(ellipse 50% 55% at 25% 100%, #2a4049 70%, transparent 72%),
        radial-gradient(ellipse 45% 45% at 75% 100%, #243841 70%, transparent 72%);
      background-size: calc(var(--cell) * 9) 100%;
      background-position: calc(var(--shift) * var(--screen) * -0.15) 0;
    }
    .trees {
      top: 0;
      background-image:
        radial-gradient(ellipse 22% 36% at 12% 100%, #173226 60%, transparent 62%),
        radial-gradient(ellipse 16% 28% at 34% 100%, #1b3b2c 60%, transparent 62%),
        radial-gradient(ellipse 20% 42% at 55% 100%, #163024 60%, transparent 62%),
        radial-gradient(ellipse 14% 30% at 78% 100%, #1a3a2b 60%, transparent 62%),
        linear-gradient(180deg, transparent 78%, #24402b);
      background-size: calc(var(--cell) * 5) 100%;
      background-position: calc(var(--shift) * var(--screen) * -0.45) 0;
    }
    .ground {
      bottom: 0;
      background-color: #28462d;
      background-image:
        conic-gradient(#ffffff08 25%, transparent 0 50%, #ffffff08 0 75%, transparent 0),
        linear-gradient(180deg, #24402b, #2c4c30 40%, #27432b);
      background-size: calc(var(--cell) * 2) calc(var(--cell) * 2), 100% 100%;
      background-position: calc(var(--shift) * var(--screen) * -1) 0, 0 0;
    }
    .deco {
      bottom: 0;
      background-image:
        radial-gradient(ellipse 5% 7% at 20% 18%, #6b7a6a 60%, transparent 64%),
        radial-gradient(ellipse 3% 4% at 23% 21%, #58665a 60%, transparent 64%),
        radial-gradient(circle at 55% 72%, #e9d27a 0 0.8%, transparent 1.2%),
        radial-gradient(circle at 57% 75%, #e98fb0 0 0.8%, transparent 1.2%),
        radial-gradient(ellipse 7% 5% at 82% 48%, #3d6b3f 60%, transparent 64%),
        radial-gradient(ellipse 4% 3% at 40% 92%, #6b7a6a 60%, transparent 64%);
      background-size: calc(var(--cell) * 7) 100%;
      background-position: calc(var(--shift) * var(--screen) * -1) 0;
      opacity: 0.9;
    }
    .img {
      top: 0; background-repeat: repeat-x; image-rendering: pixelated;
      transition: background-position var(--dur, 0ms) linear;
    }
    .mid.faint { opacity: 0.25; }
    .tint { bottom: 0; background: linear-gradient(90deg, #5ec8e00c 50%, #e3625a0e 50%); }
    .mid {
      bottom: 0; left: 50% !important; right: auto !important; width: 2px; margin-left: -1px;
      background: repeating-linear-gradient(180deg, var(--gold) 0 6px, transparent 6px 11px); opacity: 0.45;
    }
  `,
})
export class FieldComponent {
  /** camera x in world cells (the party's formation origin) */
  readonly scroll = input(0);
  /** tween time between two scroll values (ms) — one engine snapshot */
  readonly duration = input(0);
  /** battle: the board writes --shift every display frame (interpolated camera) — no binding, no transition */
  readonly live = input(false);
  /** ภาพพื้นหลังของด่าน (ไม่มี = วาดฉากด้วย CSS) */
  readonly bg = input<BackgroundDef | null | undefined>(null);

  /** ตำแหน่ง/ขนาดของภาพ คิดเป็นหน่วยช่อง (ภาพสูง zoom เท่าของสนาม ชิดขอบล่าง) */
  readonly img = computed(() => {
    const b = this.bg();
    if (!b) return null;
    const rows = BOARD_ROWS + SCENERY_ROWS;
    const imgH = rows * b.zoom;
    const top = rows - imgH;
    const cut = (top + b.cut * imgH) / rows;
    const cells = (n: number) => `calc(var(--cell) * ${n.toFixed(4)})`;
    return {
      url: `url(${b.file})`,
      size: `auto ${cells(imgH)}`,
      y: cells(top),
      yGround: cells(top - cut * rows),
      cut,
    };
  });

  readonly shift = computed(() => this.scroll());
  readonly skyPct = (SCENERY_ROWS / (SCENERY_ROWS + BOARD_ROWS)) * 100;
  readonly cols = BOARD_COLS;
}
