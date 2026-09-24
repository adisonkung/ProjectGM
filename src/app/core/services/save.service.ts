import { effect, Injectable, signal } from '@angular/core';
import { newGameState } from '../data/starter';
import { GameState } from '../models/game-state';

const KEY = 'projectgm-save-v1';

/** เก็บสถานะเกมทั้งหมดไว้ใน signal เดียว และบันทึกลง localStorage อัตโนมัติ */
@Injectable({ providedIn: 'root' })
export class SaveService {
  readonly state = signal<GameState>(this.load() ?? newGameState());

  constructor() {
    effect(() => this.persist(this.state()));
  }

  update(fn: (s: GameState) => GameState): void {
    this.state.update(fn);
  }

  reset(): void {
    this.state.set(newGameState());
  }

  private load(): GameState | null {
    try {
      const raw = localStorage.getItem(KEY);
      const s = raw ? (JSON.parse(raw) as GameState) : null;
      // เปลี่ยนเวอร์ชันแล้วเริ่มเกมใหม่ (v2: ออเรลแทนกอร์แรน, v3: เชดแทนทิม)
      return s?.version === 3 ? s : null;
    } catch {
      return null;
    }
  }

  private persist(s: GameState): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* โหมดส่วนตัวหรือพื้นที่เต็ม: เล่นต่อได้แต่ไม่เซฟ */
    }
  }
}
