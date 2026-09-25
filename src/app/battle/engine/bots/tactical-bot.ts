import type { BattleEngine, BattleUnit } from '../battle-engine';
import { MONSTER_SKILLS, MONSTERS } from '../../../core/data/monsters';
import { INTERRUPT_PRIORITY_RANK, InterruptPriority } from '../../../core/models/combat';
import { TeamSlot } from '../../../core/models/game-state';
import { OwnedHero } from '../../../core/models/hero';
import { HERO_BY_ID } from '../../../core/data/heroes';
import { kitOf } from '../../../core/data/hero-skills';

/**
 * Simulation player bots.
 * AUTO     = what a player gets by switching AUTO on and watching: normal hero AI, automatic skills, AUTO ultimates,
 *            no Focus, default formation. No knowledge of future boss actions.
 * TACTICAL = a player who knows the stage: spread formation, soft Focus on supports / casters / phase adds,
 *            interrupt skills in RESERVE for the most important casts (break coordination at the final boss),
 *            ultimates in RESERVE (tank / archer / healer).
 */
export type BotName = 'AUTO' | 'TACTICAL';

/** TACTICAL formation: a full frontline (tank centre) + the backline split to the outer lanes, out of one 3×3 AoE */
export function tacticalFormation(heroes: OwnedHero[], team: TeamSlot[]): TeamSlot[] {
  const spots: Record<string, [number, number][]> = {
    tank: [[0, 1]], fighter: [[0, 0], [0, 2]], assassin: [[0, 2], [0, 0]], archer: [[3, 2], [3, 0]], mage: [[3, 0], [3, 2]], healer: [[3, 0], [3, 2]],
  };
  const taken = new Set<string>();
  return team.map(slot => {
    const h = heroes.find(x => x.uid === slot.uid)!;
    const cls = HERO_BY_ID[h.templateId].cls;
    const spot = (spots[cls] ?? []).find(([r, c]) => !taken.has(`${r},${c}`));
    if (!spot) return slot;
    taken.add(`${spot[0]},${spot[1]}`);
    return { uid: slot.uid, r: spot[0], c: spot[1] };
  });
}

/** Focus priorities of the TACTICAL bot (the hero AI only engages them when it is safe) */
const FOCUS: Record<string, number> = {
  dark_shaman_ritual: 0,
  goblin_shaman: 1,
  dark_shaman: 1,
  mist_witch: 2,
  mist_wraith: 3,
  magic_mushroom: 4,
  shadow_panther: 5,
};

const maxCastPriority = (u: BattleUnit): number =>
  Math.max(-1, ...u.castSkills.filter(cs => cs.def.interruptible || (cs.def as { breakRequired?: number }).breakRequired)
    .map(cs => INTERRUPT_PRIORITY_RANK[((cs.def as { interruptPriority?: InterruptPriority }).interruptPriority) ?? 'MEDIUM']));

const RANKS: InterruptPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export class TacticalBot {
  private configured = false;

  tick(e: BattleEngine): void {
    const heroes = e.units.filter(u => u.side === 'ally' && u.alive);
    const foes = e.units.filter(u => u.side === 'enemy' && u.alive && u.visible && u.wave === e.waveIndex);
    if (!this.configured) {
      this.configured = true;
      for (const h of e.units.filter(u => u.side === 'ally')) {
        const kit = kitOf(h.heroId, h.cls);
        for (const slot of ['skill', 'skill2'] as const) if (kit[slot].ai?.tier === 'INTERRUPT') e.setSkillMode(h.id, slot, 'RESERVE');
        if (h.cls === 'tank' || h.cls === 'archer' || h.cls === 'healer') e.setSkillMode(h.id, 'ult', 'RESERVE');
      }
    }
    // interrupt reservation: spend interrupts only on the most important cast this wave can produce
    // (boss about to enrage → keep everything for the Break check)
    const boss = foes.find(f => f.boss);
    let min = Math.max(0, ...foes.map(maxCastPriority));
    if (boss?.monster) {
      const phases = MONSTERS[boss.monster.definitionId]?.phases ?? [];
      const next = phases[boss.monster.phaseIndex];
      const unlocks = next?.enableSkills?.some(s => MONSTER_SKILLS[s.id]?.breakRequired);
      if (unlocks && boss.hp / boss.maxHp <= next.hpBelow + 0.12) min = INTERRUPT_PRIORITY_RANK.CRITICAL;
    }
    for (const h of heroes) if (h.interruptMinPriority !== RANKS[min]) e.setInterruptMinPriority(h.id, RANKS[min]);

    // soft Focus on the most dangerous support / caster / phase add (the AI only goes for it when it is safe)
    const pick = foes
      .filter(f => f.monster && FOCUS[f.monster.definitionId] != null)
      .sort((a, b) => FOCUS[a.monster!.definitionId] - FOCUS[b.monster!.definitionId] || a.hp - b.hp)[0];
    if (pick && pick.id !== e.focusTargetId) e.setFocus(pick.id);
  }
}

/** kept for the trace tool: the id the TACTICAL bot would focus now */
export function focusPriority(e: BattleEngine): number | null {
  const foes = e.units.filter(u => u.side === 'enemy' && u.alive && u.visible && u.wave === e.waveIndex && u.monster);
  return foes.filter(f => FOCUS[f.monster!.definitionId] != null)
    .sort((a, b) => FOCUS[a.monster!.definitionId] - FOCUS[b.monster!.definitionId] || a.hp - b.hp)[0]?.id ?? null;
}
