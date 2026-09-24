import { Component, input } from '@angular/core';
import { HeroClass } from '../../core/models/hero';
import { Side } from '../../core/models/unit';
import { BOARD_COLS, BOARD_ROWS, sideOf } from '../engine/grid';
import { FxSpriteComponent } from '../fx-sprite/fx-sprite.component';
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
  /** โล่เทียบกับเลือดสูงสุด (%) */
  shieldPct: number;
  alive: boolean;
  taunt: boolean;
  star?: number;
  level?: number;
  sprite?: string;
  boss?: boolean;
  /** หันซ้าย */
  flip?: boolean;
}

export interface FloatText {
  id: number;
  r: number;
  c: number;
  text: string;
  kind: 'dmg' | 'crit' | 'heal' | 'skill';
}

/** เอฟเฟกต์สกิลที่กำลังเล่นบนกระดาน */
export interface FxView {
  id: number;
  r: number;
  c: number;
  name: string;
  angle: number;
  flip?: boolean;
}

export interface AnimState {
  anim: SpriteAnim;
  key: number;
}

@Component({
  selector: 'app-board',
  imports: [UnitSpriteComponent, FxSpriteComponent],
  templateUrl: './board.component.html',
  styleUrl: './board.component.scss',
})
export class BoardComponent {
  readonly units = input<UnitView[]>([]);
  readonly floats = input<FloatText[]>([]);
  readonly fx = input<FxView[]>([]);
  readonly anims = input<Partial<Record<number, AnimState>>>({});
  readonly speed = input(1);

  readonly rows = BOARD_ROWS;
  readonly cols = BOARD_COLS;
  readonly cells = Array.from({ length: BOARD_ROWS * BOARD_COLS }, (_, i) => {
    const cell = { r: Math.floor(i / BOARD_COLS), c: i % BOARD_COLS };
    return { ...cell, enemy: sideOf(cell) === 'enemy' };
  });

  pos(r: number, c: number): string {
    return `translate(${c * 100}%, ${r * 100}%)`;
  }
}
