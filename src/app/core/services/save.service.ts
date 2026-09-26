import { effect, Injectable, signal } from '@angular/core';
import { validLocal } from '../../battle/engine/grid';
import { addMissingStarters, newGameState } from '../data/starter';
import { autoPlace } from '../rules/team';
import { GameState } from '../models/game-state';
import { migrateHeroProgress } from '../rules/leveling';

const KEY = 'projectgm-save-v1';

/**
 * Old saves: v1–3 start over (roster changes); v4 → v5 adds the Patch 1 economy (EXP, breakthrough tier, inventory,
 * daily bonus, Training Slots, farm records) without touching heroes / team / cleared floors.
 */
export function migrate(raw: unknown): GameState | null {
  const s = raw as Omit<Partial<GameState>, 'version'> & { version?: number };
  if (!s || (s.version !== 4 && s.version !== 5)) return null;
  const out = {
    ...s,
    version: 5,
    inventory: s.inventory ?? {},
    daily: s.daily ?? { day: '', used: {} },
    trainingSlots: s.trainingSlots ?? [],
    farm: s.farm ?? {},
    rewardCarry: s.rewardCarry ?? {},
  } as GameState;
  out.heroes = (out.heroes ?? []).map(migrateHeroProgress);
  return out;
}

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
      const s = raw ? migrate(JSON.parse(raw)) : null;
      if (!s) return null;
      // กระดานเปลี่ยนขนาด (3 เลน x ลึก 6): ตำแหน่งเก่าที่หลุดขอบ ให้จัดทีมใหม่อัตโนมัติ
      if (s.team.some(t => !validLocal(t))) {
        const inTeam = new Set(s.team.map(t => t.uid));
        s.team = autoPlace(s.heroes.filter(h => inTeam.has(h.uid) && h.injury === 0));
      }
      return addMissingStarters(s);
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
