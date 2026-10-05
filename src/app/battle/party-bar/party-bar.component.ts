import { Component, input, output } from '@angular/core';
import { heroArt, HeroArt } from '../../core/data/hero-art';
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
    <div class="bar" [class.compact]="compact()" role="group" aria-label="ทีมของเรา แตะรูปเมื่อเกจเต็มเพื่อใช้ท่าไม้ตาย">
      @for (u of units(); track u.id; let i = $index) {
        @let ready = u.alive && u.manaPct >= 100;
        @let art = artOf(u.heroId);
        <div class="card" [class.ready]="ready" [class.cut]="ready && alert() && !!u.interrupter" [class.queued]="!!u.queued" [class.dead]="!u.alive">
          <button type="button" class="frame" [style.--rc]="'var(--r' + (u.star ?? 1) + ')'" [disabled]="!ready" (click)="ult.emit(u.id)"
                  [attr.aria-label]="u.name + (ready ? ' ท่าไม้ตายพร้อม กดเพื่อใช้' : ' เกจ ' + pct(u.manaPct) + '%')">
            @if (art) {
              <img class="pic" [src]="art.portrait" alt="" draggable="false" />
            } @else {
              <span class="face" [class.token]="!u.sprite"><app-unit-sprite [cls]="u.cls" [sprite]="u.sprite" [star]="u.star" /></span>
            }
            <span class="key">{{ i + 1 }}</span>
            @if (u.interrupter) { <span class="int" title="ท่าไม้ตายตัดการร่ายของศัตรูได้">⚡ตัด</span> }
            @if (ready) { <span class="ult">{{ u.queued ? 'รอร่าย' : 'ULT' }}</span> }
          </button>
          <span class="hp"><i [style.width.%]="u.hpPct"></i></span>
          <span class="mana" [class.full]="ready"><i [style.width.%]="u.manaPct"></i></span>
          <span class="skills">
            @for (k of slots; track k) {
              @let cd = k === 's1' ? (u.cd1 ?? 0) : (u.cd2 ?? 0);
              @let max = k === 's1' ? (u.cd1Max ?? 1) : (u.cd2Max ?? 1);
              @let mode = modeOf(u, k === 's1' ? 'skill' : 'skill2');
              <button type="button" class="sk" [class.cooling]="u.alive && cd > 0" [style.--p]="sweep(cd, max)" [disabled]="!u.alive || cd > 0"
                      (click)="skill.emit({ id: u.id, slot: k === 's1' ? 'skill' : 'skill2' })"
                      [attr.title]="(k === 's1' ? 'สกิล 1' : 'สกิล 2') + ' (' + modeName(mode) + ')' + (cd > 0 ? ' คูลดาวน์ ' + secs(cd) + ' วิ' : ' พร้อม — แตะเพื่อใช้ทันที')">
                @if (art) { <img [src]="art[k]" alt="" draggable="false" /> } @else { <b>{{ k === 's1' ? 'S1' : 'S2' }}</b> }
                @if (u.alive && cd > 0) { <span class="cd">{{ secs(cd) }}</span> }
              </button>
            }
            <button type="button" class="sk ultk" [class.on]="ready" [disabled]="!ready" (click)="ult.emit(u.id)"
                    [style.--g]="u.alive ? u.manaPct : 0" [attr.title]="ready ? 'ท่าไม้ตายพร้อม' : 'เกจ ' + pct(u.manaPct) + '%'">
              @if (art) { <img [src]="art.ult" alt="" draggable="false" /> } @else { <b>ULT</b> }
              @if (!ready) { <span class="fill"></span> }
            </button>
          </span>
          <span class="modes">
            @for (m of modeSlots; track m.slot) {
              @let mode = modeOf(u, m.slot);
              <button type="button" class="mode" [class]="'mode ' + mode" (click)="modeChange.emit({ id: u.id, slot: m.slot })"
                      [attr.title]="m.label + ': ' + modeName(mode) + ' — แตะเพื่อเปลี่ยน (AUTO → เก็บไว้ → กดเอง)'">{{ m.short }}{{ modeTag(mode) }}</button>
            }
          </span>
          <span class="name">{{ u.name }}</span>
          <!-- the status row always takes its space (empty = invisible) so the bar never changes height mid-fight -->
          @let t = u.alive ? tag(u) : '';
          <span [class]="'intent ' + (t ? (u.onFocus ? 'focus' : u.intent) : 'none')" [attr.aria-hidden]="!t" [attr.title]="t || null">{{ t || '·' }}</span>
        </div>
      }
      <ng-content />
    </div>
  `,
  styles: `
    :host { display: block; }
    .bar { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
    .card {
      display: grid; gap: 3px; width: 84px;
      &.dead { filter: grayscale(1) brightness(0.55); }
    }
    button { padding: 0; border: 0; background: none; color: inherit; font: inherit; cursor: default; }
    button:disabled { opacity: 1; }
    .ready .frame, .sk.ultk.on { cursor: pointer; }
    .frame {
      position: relative; display: block; width: 84px; height: 84px; border-radius: 10px; overflow: hidden;
      background: color-mix(in srgb, var(--rc) 16%, var(--panel)); box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--rc) 70%, transparent);
    }
    .face {
      position: absolute; left: 0; top: 0; width: 100%; height: 100%;
      transform: translateY(62%) scale(1.7); transform-origin: 50% 100%; z-index: 2;
    }
    .face.token { transform: none; }
    .pic { position: absolute; inset: 3px; z-index: 2; width: calc(100% - 6px); height: calc(100% - 6px); border-radius: 8px; object-fit: cover; }
    // แถวไอคอนสกิลใต้รูป: สกิล 1 / สกิล 2 / ท่าไม้ตาย
    .skills { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; }
    .sk {
      position: relative; display: grid; place-items: center; aspect-ratio: 1; border-radius: 6px; overflow: hidden;
      background: var(--panel2); box-shadow: inset 0 0 0 1px #ffffff26;
      img { width: 100%; height: 100%; object-fit: cover; display: block; }
      b { font: 700 9px var(--disp); color: var(--muted); }
    }
    // คูลดาวน์: ฉากดำทับ + เงาหมุนตามเวลาที่เหลือ + ตัวเลขวินาที
    .sk.cooling::after {
      content: ''; position: absolute; inset: 0;
      background: conic-gradient(#000000b0 calc(var(--p) * 1%), #00000073 0);
    }
    .sk.cooling img { filter: grayscale(0.6); }
    .cd {
      position: absolute; inset: 0; z-index: 1; display: grid; place-items: center;
      font: 700 12px var(--disp); color: #fff; text-shadow: 0 1px 2px #000, 0 0 4px #000;
    }
    // ท่าไม้ตาย: มืดตามส่วนที่เกจยังไม่เต็ม, เต็มแล้วเรืองแสง
    .ultk .fill { position: absolute; left: 0; right: 0; top: 0; height: calc(100% - var(--g) * 1%); background: #000000a6; transition: height 0.15s linear; }
    .ultk.on { box-shadow: 0 0 0 1px var(--cyan), 0 0 8px var(--cyan); animation: pulse 1.2s ease-in-out infinite alternate; }
    .key { position: absolute; top: 3px; left: 5px; z-index: 3; font: 700 11px var(--disp); color: var(--muted); }
    .int {
      position: absolute; top: 3px; right: 4px; z-index: 3; padding: 0 4px; border-radius: 4px;
      background: #000b; font: 700 9px var(--disp); color: var(--gold);
    }
    // มีศัตรูร่ายสกิลที่ตัดได้ + ฮีโร่ตัวนี้ตัดได้และเกจเต็ม → เร่งให้กด
    .cut .frame { box-shadow: 0 0 14px var(--gold), 0 0 26px #f0b54aaa; }
    .cut .ult { color: var(--gold); }
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
    .intent {
      display: block; height: 15px; line-height: 13px; box-sizing: border-box; overflow: hidden; text-overflow: ellipsis;
      font: 700 9px var(--disp); text-align: center; border-radius: 4px; padding: 1px 2px; white-space: nowrap;
      &.none { visibility: hidden; }
      background: #ff5a4e33; color: #ffb3ad;
      &.hold { background: #5ec8e033; color: var(--cyan); }
      &.blocked { background: #8e97b533; color: var(--muted); }
      &.heal { background: #56c07a33; color: var(--hp); }
      &.interrupt { background: #f0b54a33; color: var(--gold); }
    }
    .modes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; }
    .mode {
      font: 700 8px var(--disp); border-radius: 4px; padding: 1px 0; cursor: pointer; background: #ffffff14; color: var(--muted);
      &.RESERVE { background: #f0b54a33; color: var(--gold); }
      &.MANUAL { background: #8e97b533; color: #cfd6ea; }
      &.CONDITIONAL { background: #5ec8e033; color: var(--cyan); }
    }
    .sk:not(:disabled) { cursor: pointer; }
    .name { display: block; height: 16px; line-height: 16px; font-size: 11px; color: var(--muted); text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes pulse { to { box-shadow: 0 0 18px #5ec8e0, 0 0 30px #b07cf0aa; } }
    // compact (battle-screen dock): portrait on the left, skill icons + mode chips on the right, bars + name/status below
    .compact { justify-content: flex-start; gap: 6px; flex-wrap: wrap; }
    .compact .card {
      width: auto; column-gap: 4px; row-gap: 2px; padding: 3px; border-radius: 9px; background: #0b0914c7; box-shadow: inset 0 0 0 1px #ffffff1f, 0 2px 8px #0008;
      grid-template-columns: 50px 78px; grid-template-rows: auto auto 1fr auto auto 14px;
      grid-template-areas: 'frame skills' 'frame modes' 'frame .' 'frame hp' 'frame mana' 'name intent';
    }
    .compact .frame { grid-area: frame; width: 50px; height: 50px; }
    .compact .skills { grid-area: skills; gap: 2px; }
    .compact .modes { grid-area: modes; gap: 2px; }
    .compact .hp { grid-area: hp; height: 4px; } .compact .mana { grid-area: mana; height: 4px; }
    .compact .name { grid-area: name; height: 14px; line-height: 14px; font-size: 10px; text-align: left; color: var(--text); }
    .compact .intent { grid-area: intent; height: 14px; line-height: 12px; font-size: 8px; }
    .compact .ult { font-size: 9px; bottom: 2px; }
    .compact .key { font-size: 9px; top: 1px; left: 3px; }
    .compact .int { font-size: 8px; top: 1px; right: 1px; padding: 0 2px; }
    .compact .cd { font-size: 11px; }
    @media (max-width: 480px) { .card { width: 62px; } .frame { width: 62px; height: 62px; } .cd { font-size: 10px; } }
    /* phone in landscape: party + AUTO + special in one slim row under the lanes */
    @media (orientation: landscape) and (max-height: 500px) {
      .compact { gap: 4px; flex-wrap: nowrap; }
      .compact .card { column-gap: 3px; row-gap: 1px; padding: 2px; border-radius: 7px; grid-template-columns: 38px 60px;
        grid-template-rows: auto auto 1fr auto auto; grid-template-areas: 'frame skills' 'frame modes' 'frame .' 'frame hp' 'frame mana'; }
      .compact .frame { width: 38px; height: 38px; border-radius: 7px; }
      .compact .name, .compact .intent { display: none; }
      .compact .mode { font-size: 7px; padding: 0; }
      .compact .hp, .compact .mana { height: 3px; }
      .compact .key { display: none; }
      .compact .ult { font-size: 7px; padding: 0 3px; }
      .compact .cd { font-size: 9px; }
    }
    @media (prefers-reduced-motion: reduce) { .ready .frame::before, .ready .frame { animation: none; } }
  `,
})
export class PartyBarComponent {
  readonly units = input<UnitView[]>([]);
  /** battle-screen dock layout (horizontal cards) */
  readonly compact = input(false);
  readonly ult = output<number>();
  /** tap a ready skill icon = use it now (manual command, also for RESERVE / MANUAL skills) */
  readonly skill = output<{ id: number; slot: 'skill' | 'skill2' }>();
  /** tap a mode chip = cycle that slot's AI use mode */
  readonly modeChange = output<{ id: number; slot: 'skill' | 'skill2' | 'ult' }>();

  readonly modeSlots = [
    { slot: 'skill' as const, short: 'S1', label: 'สกิล 1' },
    { slot: 'skill2' as const, short: 'S2', label: 'สกิล 2' },
    { slot: 'ult' as const, short: 'U', label: 'ท่าไม้ตาย' },
  ];

  modeOf(u: UnitView, slot: 'skill' | 'skill2' | 'ult'): string {
    return u.modes?.[slot] ?? 'AUTO';
  }
  modeName(m: string): string {
    return m === 'RESERVE' ? 'เก็บไว้ใช้กับจังหวะสำคัญ' : m === 'MANUAL' ? 'กดเองเท่านั้น' : m === 'CONDITIONAL' ? 'ตามเงื่อนไข' : 'AUTO';
  }
  modeTag(m: string): string {
    return m === 'RESERVE' ? '·R' : m === 'MANUAL' ? '·M' : m === 'CONDITIONAL' ? '·C' : '';
  }
  /** มีศัตรูกำลังร่ายสกิลที่ตัดได้ */
  readonly alert = input(false);

  /** ป้ายบอกว่า AI ตัวนี้กำลังทำอะไร (เห็นว่าโฟกัสทำงานยังไง) */
  tag(u: UnitView): string {
    if (u.onFocus) return '🎯 โฟกัส';
    switch (u.intent) {
      case 'hold': return '🛡 ถือแนวหน้า';
      case 'blocked': return '⛔ ไปไม่ถึง';
      case 'heal': return '✚ ฮีลด่วน';
      case 'interrupt': return '⚡ ตัดร่าย';
      default: return '';
    }
  }

  readonly slots = ['s1', 's2'] as const;

  artOf(heroId?: string): HeroArt | undefined {
    return heroArt(heroId);
  }

  /** % ของวงคูลดาวน์ที่ยังเหลือ (ส่วนที่มืดเข้ม) */
  sweep(cd: number, max: number): number {
    return max > 0 ? Math.min(100, Math.max(0, (cd / max) * 100)) : 0;
  }

  /** วินาทีที่เหลือ: ต่ำกว่า 1 วิแสดงทศนิยม 1 ตำแหน่ง */
  secs(cd: number): string {
    return cd < 1 ? cd.toFixed(1) : String(Math.ceil(cd));
  }

  pct(v: number): number {
    return Math.floor(v);
  }
}
