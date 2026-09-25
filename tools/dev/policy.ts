import type { BattleEngine } from '../../src/app/battle/engine/battle-engine';

/** TACTICAL player policy: which enemy deserves the Focus right now (null = leave Focus alone) */
const PRIORITY: Record<string, number> = {
  dark_shaman_ritual: 0,
  goblin_shaman: 1,
  dark_shaman: 1,
  mist_witch: 2,
  magic_mushroom: 3,
  forest_spirit: 4,
  shadow_panther: 5,
  mist_wraith: 6,
};

export function focusPriority(e: BattleEngine): number | null {
  const foes = e.units.filter(u => u.side === 'enemy' && u.alive && u.visible && u.wave === e.waveIndex && u.monster && e.isValidTarget(e.units[0], u));
  // a boss on the field: only the Sacrifice shaman is worth pulling the team off the boss
  if (foes.some(u => u.boss)) return null;
  const ranked = foes
    .map(u => ({ u, p: PRIORITY[u.monster!.definitionId] ?? 99 }))
    .filter(x => x.p < 99)
    .sort((a, b) => a.p - b.p || a.u.hp - b.u.hp);
  return ranked[0]?.u.id ?? null;
}

/**
 * TACTICAL manual ultimates (autoUlt off): interrupt ults (tank / archer) are saved for a stoppable cast
 * (Forest Oblivion break, Sacrifice, Healing Ritual …); the healer ult waits for a crisis; damage ults fire when full.
 */
export function tacticalUlts(e: BattleEngine): void {
  const heroes = e.units.filter(u => u.side === 'ally' && u.alive);
  const foes = e.units.filter(u => u.side === 'enemy' && u.alive && e.isValidTarget(heroes[0] ?? u, u));
  if (!foes.length) return;
  const stoppable = foes.some(f => f.casting && (f.casting.def.interruptible || (f.casting.def as { breakRequired?: number }).breakRequired));
  const casterAround = foes.some(f => f.castSkills.some(cs => cs.def.interruptible || (cs.def as { breakRequired?: number }).breakRequired));
  const crisis = heroes.some(h => h.hp < h.maxHp * 0.4) || e.getDeadVisibleHeroes().length + e.getDeadHiddenHeroes().length > 0;
  for (const h of heroes) {
    if (h.mana < h.maxMana || h.ultQueued) continue;
    const fire =
      h.cls === 'tank' || h.cls === 'archer' ? stoppable || (!casterAround && crisis) || !casterAround
        : h.cls === 'healer' ? crisis
          : true;
    if (fire) e.requestUlt(h.id);
  }
}
