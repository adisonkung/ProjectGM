/** Approved Battle Start artwork, user 2026-11-25. */
export const BATTLE_ENTRY_ART = {
  aura: '/ui/battle-entry/pearl-collision.webp',
  runner: '/ui/battle-entry/goblin-run.webp',
} as const;

export interface BattleLoadToken { cancelled: boolean }
export type BattleEntryPhase = 'loading' | 'preparing' | 'intro' | 'error';
export interface BattleEntryState {
  id: number;
  phase: BattleEntryPhase;
  done: number;
  total: number;
}
