import type { BattleEngine } from '../../src/app/battle/engine/battle-engine';

/** TACTICAL player policy: which enemy deserves the Focus right now (null = leave Focus alone) */
const PRIORITY: Record<string, number> = {
  dark_shaman_ritual: 0,
  goblin_shaman: 1,
  dark_shaman: 1,
  mist_witch: 2,
  magic_mushroom: 3,
};

export function focusPriority(e: BattleEngine): number | null {
  const foes = e.units.filter(u => u.side === 'enemy' && u.alive && u.visible && u.wave === e.waveIndex && u.monster && e.isValidTarget(e.units[0], u));
  // a boss on the field: only the Sacrifice shaman is worth pulling the team off the boss
  if (foes.some(u => u.boss)) return null;
  const ranked = foes
    .map(u => ({ u, p: PRIORITY[u.monster!.definitionId] ?? 99 }))
    .filter(x => x.p < 99)
    // only what the backline can already shoot (Focus would otherwise walk it into the enemy's range)
    .filter(x => heroesCanReach(e, x.u))
    .sort((a, b) => a.p - b.p || a.u.hp - b.u.hp);
  return ranked[0]?.u.id ?? null;
}

/** focus only what no ranged hero would have to step forward for (Focus pulls the backline up to 2 cells) */
function heroesCanReach(e: BattleEngine, t: import('../../src/app/battle/engine/battle-engine').BattleUnit): boolean {
  const d = (a: { pos: { r: number; c: number } }) => Math.max(Math.abs(a.pos.r - t.pos.r), Math.abs(a.pos.c - t.pos.c));
  const ranged = e.units.filter(h => h.side === 'ally' && h.alive && h.range >= 3);
  return ranged.length > 0 && ranged.every(h => d(h) <= h.range);
}
