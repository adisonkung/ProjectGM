import { Component, input } from '@angular/core';
import { HeroClass } from '../../core/models/hero';
import { Side } from '../../core/models/unit';
import { BOARD_COLS, BOARD_ROWS } from '../engine/grid';
import { SpriteAnim, UnitSpriteComponent } from '../unit-sprite/unit-sprite.component';

/** ข้อมูลยูนิตสำหรับแสดงผล (สแนปช็อตจากเอนจินในแต่ละเฟรม) */
export interface UnitView {
  id: number;
  side: Side;
  name: string;
  cls: HeroClass;
  r: number;
  c: number;
  hpPct: number;
  manaPct: number;
  alive: boolean;
  taunt: boolean;
  star?: number;
  level?: number;
  sprite?: string;
  boss?: boolean;
}

export interface FloatText {
  id: number;
  r: number;
  c: number;
  text: string;
  kind: 'dmg' | 'crit' | 'heal' | 'skill';
}

export interface AnimState {
  anim: SpriteAnim;
  key: number;
}

@Component({
  selector: 'app-board',
  imports: [UnitSpriteComponent],
  templateUrl: './board.component.html',
  styleUrl: './board.component.scss',
})
export class BoardComponent {
  readonly units = input<UnitView[]>([]);
  readonly floats = input<FloatText[]>([]);
  readonly anims = input<Partial<Record<number, AnimState>>>({});
  readonly speed = input(1);

  readonly rows = BOARD_ROWS;
  readonly cols = BOARD_COLS;
  readonly cells = Array.from({ length: BOARD_ROWS * BOARD_COLS }, (_, i) => ({
    r: Math.floor(i / BOARD_COLS),
    c: i % BOARD_COLS,
  }));

  pos(r: number, c: number): string {
    return `translate(${c * 100}%, ${r * 100}%)`;
  }
}
