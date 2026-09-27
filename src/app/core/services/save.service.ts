import { effect, Injectable, signal } from '@angular/core';
import { validLocal } from '../../battle/engine/grid';
import { addMissingStarters, newGameState } from '../data/starter';
import { autoPlace, normalizePresets } from '../rules/team';
import { GameState } from '../models/game-state';
import { migrateHeroProgress } from '../rules/leveling';
import { normalizeIsland } from '../rules/island';
import { makeEnvelope, SaveEnvelope } from '../rules/account';

const KEY = 'projectgm-save-v1';
/** the save that an import replaced (one-step undo) */
const BACKUP_KEY = 'projectgm-save-backup';

/**
 * Old saves: v1–3 start over (roster changes); v4 → v5 adds the Patch 1 economy (EXP, breakthrough tier, inventory,
 * daily bonus, Training Slots, farm records); v5 → v6 adds equipment (bag, item ids, Hunt target) and drops the
 * provisional tier-id `equipment` field; the old `injury` counter is dropped. Heroes / team / cleared floors are never touched.
 */
export function migrate(raw: unknown): GameState | null {
  const s = raw as Omit<Partial<GameState>, 'version'> & { version?: number };
  if (!s || (s.version !== 4 && s.version !== 5 && s.version !== 6)) return null;
  const out = {
    ...s,
    version: 6,
    equipment: s.equipment ?? [],
    nextItemId: s.nextItemId ?? 1,
    huntTarget: s.huntTarget ?? 'ANY',
    inventory: s.inventory ?? {},
    daily: s.daily ?? { day: '', used: {} },
    trainingSlots: s.trainingSlots ?? [],
    farm: s.farm ?? {},
    rewardCarry: s.rewardCarry ?? {},
    teamPresets: normalizePresets(s.teamPresets),
  } as GameState;
  out.heroes = (out.heroes ?? []).map(h => {
    // `equipment` = provisional v5 field · `injury` = removed injury system (heroes are never locked out now)
    const { equipment: _legacy, injury: _injury, ...rest } = h as typeof h & { equipment?: unknown; injury?: unknown };
    return migrateHeroProgress(rest);
  });
  out.island = normalizeIsland(s.island, out);
  return out;
}

/** migrate + the load-time repairs (used for the local save and for imported saves) */
export function prepare(raw: unknown): GameState | null {
  let s: GameState | null;
  try {
    s = migrate(raw);
  } catch {
    return null;
  }
  if (!s) return null;
  // กระดานเปลี่ยนขนาด (3 เลน x ลึก 6): ตำแหน่งเก่าที่หลุดขอบ ให้จัดทีมใหม่อัตโนมัติ
  if (!Array.isArray(s.heroes) || !Array.isArray(s.team)) return null;
  if (s.team.some(t => !validLocal(t))) {
    const inTeam = new Set(s.team.map(t => t.uid));
    s.team = autoPlace(s.heroes.filter(h => inTeam.has(h.uid)));
  }
  return addMissingStarters(s);
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

  /** the whole save, ready for a transfer code / file (and later a cloud save) */
  exportEnvelope(): SaveEnvelope {
    return makeEnvelope(this.state());
  }

  /**
   * Replace this device's save with an imported one (transfer code / file). The current save is kept as a one-step
   * backup (`restoreBackup`). false when the save can't be migrated (too old / broken).
   */
  importState(raw: unknown): boolean {
    const s = prepare(raw);
    if (!s) return false;
    try {
      localStorage.setItem(BACKUP_KEY, JSON.stringify(this.state()));
    } catch {
      /* no backup possible — still import */
    }
    this.state.set(s);
    return true;
  }

  hasBackup(): boolean {
    try {
      return !!localStorage.getItem(BACKUP_KEY);
    } catch {
      return false;
    }
  }

  /** undo the last import */
  restoreBackup(): boolean {
    try {
      const raw = localStorage.getItem(BACKUP_KEY);
      const s = raw ? prepare(JSON.parse(raw)) : null;
      if (!s) return false;
      localStorage.removeItem(BACKUP_KEY);
      this.state.set(s);
      return true;
    } catch {
      return false;
    }
  }

  private load(): GameState | null {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? prepare(JSON.parse(raw)) : null;
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
