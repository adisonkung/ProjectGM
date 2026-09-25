import type { BattleEngine, BattleUnit } from '../battle-engine';
import { MONSTER_SKILLS, MONSTERS } from '../../../core/data/monsters';
import { MonsterSkillDefinition } from '../../../core/models/monster';
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

/**
 * What the player has seen of a stoppable enemy cast: when it can come next. Built only from observable events
 * (spawn, cast start, cast stopped early) + the published skill data (cooldown, first-cast delay) — no engine timers.
 */
interface SeenCast {
  readyAt: number;
  castTime: number;
  rank: number;
  castingToken: number | null;
  castStartedAt: number;
}

/** parts of the TACTICAL play that can be switched off (balance experiments: which decision matters) */
export interface TacticalOptions {
  focus?: boolean;
  reserveInterrupts?: boolean;
  reserveHealerUlt?: boolean;
  interruptPriority?: boolean;
}

export class TacticalBot {
  constructor(private readonly opt: TacticalOptions = {}) {}

  private seen = new Map<string, SeenCast>();

  private observe(e: BattleEngine, foes: BattleUnit[]): void {
    for (const f of foes) {
      for (const cs of f.castSkills) {
        const def = cs.def as MonsterSkillDefinition;
        if (!def.interruptible && !def.breakRequired) continue;
        const key = `${f.id}:${def.id}`;
        let s = this.seen.get(key);
        if (!s) {
          const first = (def.firstCastDelay ?? def.cooldown * 0.5) - (def.initialDelayRandom ?? 0);
          s = { readyAt: e.time + Math.max(0, first), castTime: def.castTime, rank: INTERRUPT_PRIORITY_RANK[def.interruptPriority ?? 'MEDIUM'], castingToken: null, castStartedAt: 0 };
          this.seen.set(key, s);
        }
        const c = f.casting && f.casting.def === cs.def ? f.casting : null;
        if (c && s.castingToken !== c.token) {
          s.castingToken = c.token;
          s.castStartedAt = e.time;
          s.readyAt = e.time + def.cooldown;
        } else if (!c && s.castingToken != null) {
          // the cast ended early → it was stopped: full cooldown from now
          if (e.time - s.castStartedAt < def.castTime - 0.1) s.readyAt = e.time + (def.interruptedCooldown ?? def.cooldown);
          s.castingToken = null;
        }
      }
    }
  }

  /** ends of the cast windows of the HIGH+ stoppable casts this wave can produce, soonest first */
  private importantCasts(foes: BattleUnit[]): { end: number; caster: BattleUnit }[] {
    const out: { end: number; caster: BattleUnit }[] = [];
    for (const f of foes) for (const cs of f.castSkills) {
      const s = this.seen.get(`${f.id}:${cs.def.id}`);
      if (s && s.rank >= INTERRUPT_PRIORITY_RANK.HIGH) out.push({ end: s.readyAt + s.castTime, caster: f });
    }
    return out.sort((a, b) => a.end - b.end);
  }

  tick(e: BattleEngine): void {
    const heroes = e.units.filter(u => u.side === 'ally' && u.alive);
    const foes = e.units.filter(u => u.side === 'enemy' && u.alive && u.visible && u.wave === e.waveIndex);
    this.observe(e, foes);
    // interrupt reservation: one ready interrupt skill that can reach the caster per important (HIGH+) stoppable cast that can come before that
    // skill would be back; the other interrupt skills fire on cooldown like AUTO (holding them all only loses damage)
    const upcoming = this.importantCasts(foes);
    const pool: { h: BattleUnit; slot: 'skill' | 'skill2'; back: number; ready: boolean }[] = [];
    for (const h of heroes) {
      const kit = kitOf(h.heroId, h.cls);
      for (const slot of ['skill', 'skill2'] as const) {
        if (kit[slot].ai?.tier !== 'INTERRUPT') continue;
        pool.push({ h, slot, back: e.time + (kit[slot].cooldown ?? 0), ready: (slot === 'skill' ? h.cd1 : h.cd2) <= 0 });
      }
      if (this.opt.reserveHealerUlt !== false && h.cls === 'healer' && h.skillModes.ult !== 'RESERVE') e.setSkillMode(h.id, 'ult', 'RESERVE');
    }
    const reserved = new Set<(typeof pool)[number]>();
    for (const { end, caster } of upcoming) {
      const pick = pool
        .filter(p => p.ready && !reserved.has(p) && end < p.back && e.canReachWithSkill(p.h.id, p.slot, caster.id))
        .sort((a, b) => a.back - b.back)[0];
      if (pick) reserved.add(pick);
    }
    for (const p of pool) {
      const want = reserved.has(p) && this.opt.reserveInterrupts !== false ? 'RESERVE' : 'AUTO';
      if ((p.h.skillModes[p.slot] ?? 'AUTO') !== want) e.setSkillMode(p.h.id, p.slot, want);
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
    if (this.opt.interruptPriority !== false) for (const h of heroes) if (h.interruptMinPriority !== RANKS[min]) e.setInterruptMinPriority(h.id, RANKS[min]);

    // soft Focus on the most dangerous support / caster / phase add (the AI only goes for it when it is safe)
    const pick = foes
      .filter(f => f.monster && FOCUS[f.monster.definitionId] != null)
      .sort((a, b) => FOCUS[a.monster!.definitionId] - FOCUS[b.monster!.definitionId] || a.hp - b.hp)[0];
    if (this.opt.focus !== false && pick && pick.id !== e.focusTargetId) e.setFocus(pick.id);
  }
}

/** kept for the trace tool: the id the TACTICAL bot would focus now */
export function focusPriority(e: BattleEngine): number | null {
  const foes = e.units.filter(u => u.side === 'enemy' && u.alive && u.visible && u.wave === e.waveIndex && u.monster);
  return foes.filter(f => FOCUS[f.monster!.definitionId] != null)
    .sort((a, b) => FOCUS[a.monster!.definitionId] - FOCUS[b.monster!.definitionId] || a.hp - b.hp)[0]?.id ?? null;
}
