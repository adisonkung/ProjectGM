import { StageDef, wavesOf } from '../../../core/models/stage';
import { distance } from '../grid';
import type { BattleEngine, BattleUnit } from '../battle-engine';
import { MONSTER_SKILLS, MONSTERS } from '../../../core/data/monsters';
import { MonsterSkillDefinition } from '../../../core/models/monster';
import { INTERRUPT_PRIORITY_RANK, InterruptPriority } from '../../../core/models/combat';
import { TeamSlot } from '../../../core/models/game-state';
import { OwnedHero } from '../../../core/models/hero';
import { HERO_BY_ID } from '../../../core/data/heroes';
import { kitOf } from '../../../core/data/hero-skills';
import { interruptPowerOf } from '../skill-system';
import { isPlayerUnit } from '../stage/party';

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
export function tacticalFormation(heroes: OwnedHero[], team: TeamSlot[], stage?: StageDef): TeamSlot[] {
  // against Shadow Panthers (leap onto the back row) a spread backline is picked off alone: keep the default
  // compact formation (backline behind the tank) instead
  if (stage && wavesOf(stage).some(w => w.spawns.some(sp => COMPACT_AGAINST.has(sp.monsterId)))) return team;
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
/** enemies that punish a spread backline (measured: Mist Wraiths don't — the spread formation still wins F8) */
const COMPACT_AGAINST = new Set(['shadow_panther']);

const FOCUS: Record<string, number> = {
  // TREASURE CHASE: catch the loot before it runs off
  treasure_goblin: -1,
  treasure_goblin_elite: -1,
  dark_shaman_ritual: 0,
  goblin_shaman: 1,
  dark_shaman: 1,
  mist_witch: 2,
  mist_wraith: 3,
  magic_mushroom: 4,
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
  /** Break Gauge the cast needs (0 = a plain interrupt stops it) */
  breakNeed: number;
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
          // a boss phase that unlocks the skill publishes its own first delay (Forest Oblivion: 2 s into the enrage)
          const phaseFirst = f.monster ? (MONSTERS[f.monster.definitionId]?.phases ?? []).flatMap(ph => ph.enableSkills ?? []).find(x => x.id === def.id)?.firstDelay : undefined;
          const first = (phaseFirst ?? def.firstCastDelay ?? def.cooldown * 0.5) - (def.initialDelayRandom ?? 0);
          s = { readyAt: e.time + Math.max(0, first), castTime: def.castTime, rank: INTERRUPT_PRIORITY_RANK[def.interruptPriority ?? 'MEDIUM'], breakNeed: def.interruptible ? 0 : def.breakRequired ?? 0, castingToken: null, castStartedAt: 0 };
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

  /** ends of the cast windows of the HIGH+ stoppable casts this wave can produce, soonest first (+ Break they need) */
  private importantCasts(foes: BattleUnit[]): { end: number; caster: BattleUnit; need: number }[] {
    const out: { end: number; caster: BattleUnit; need: number }[] = [];
    for (const f of foes) for (const cs of f.castSkills) {
      const s = this.seen.get(`${f.id}:${cs.def.id}`);
      if (!s || s.rank < INTERRUPT_PRIORITY_RANK.HIGH) continue;
      const left = f.casting && f.casting.def === cs.def ? f.casting.breakDamage : 0;
      out.push({ end: s.readyAt + s.castTime, caster: f, need: s.breakNeed ? Math.max(1, s.breakNeed - left) : 0 });
    }
    return out.sort((a, b) => a.end - b.end);
  }

  tick(e: BattleEngine): void {
    const heroes = e.units.filter(u => isPlayerUnit(u) && u.alive);
    const foes = e.units.filter(u => u.side === 'enemy' && u.alive && u.visible && u.wave === e.waveIndex);
    this.observe(e, foes);
    // interrupt reservation: one ready interrupt skill that can reach the caster per important (HIGH+) stoppable cast that can come before that
    // skill would be back; the other interrupt skills fire on cooldown like AUTO (holding them all only loses damage)
    const upcoming = this.importantCasts(foes);
    // a boss about to enter a phase that unlocks a Break check (the player knows the fight): hold the breakers for it
    const boss0 = foes.find(f => f.boss);
    if (boss0?.monster) {
      const next = (MONSTERS[boss0.monster.definitionId]?.phases ?? [])[boss0.monster.phaseIndex];
      const en = next?.enableSkills?.find(x => MONSTER_SKILLS[x.id]?.breakRequired);
      const brk = en ? MONSTER_SKILLS[en.id] : undefined;
      // earliest end of the first cast if the phase began now: first delay + cast time
      if (brk && boss0.hp / boss0.maxHp <= next.hpBelow + 0.12) upcoming.unshift({ end: e.time + (en!.firstDelay ?? 0) + brk.castTime, caster: boss0, need: brk.breakRequired ?? 100 });
    }
    type Tool = { h: BattleUnit; slot: 'skill' | 'skill2' | 'ult'; back: number; availableAt: number; power: number };
    const pool: Tool[] = [];
    for (const h of heroes) {
      const kit = h.kit ?? kitOf(h.heroId, h.cls);
      for (const slot of ['skill', 'skill2'] as const) {
        if (kit[slot].ai?.tier !== 'INTERRUPT') continue;
        const cd = Math.max(0, slot === 'skill' ? h.cd1 : h.cd2);
        pool.push({ h, slot, back: e.time + (kit[slot].cooldown ?? 0), availableAt: e.time + cd, power: interruptPowerOf(kit[slot], h, slot).breakPower });
      }
      // break-capable ultimates (tank / archer) count for Break checks once the gauge is (nearly) full
      const up = interruptPowerOf(kit.ult, h, 'ult');
      if (up.interrupts && up.breakPower > 0) pool.push({ h, slot: 'ult', back: Infinity, availableAt: h.mana >= h.maxMana * 0.85 ? e.time : Infinity, power: up.breakPower });
      if (this.opt.reserveHealerUlt !== false && h.cls === 'healer' && h.skillModes.ult !== 'RESERVE') e.setSkillMode(h.id, 'ult', 'RESERVE');
    }
    const reserved = new Set<Tool>();
    // travel / wind-up margin: a skill must be back a little before the cast window closes
    const MARGIN = 1.2;
    for (const { end, caster, need } of upcoming) {
      const usable = pool.filter(p => !reserved.has(p) && p.availableAt <= end - MARGIN && (p.slot === 'ult' || end < p.back || p.availableAt > e.time) &&
        (p.slot === 'ult' || e.canReachWithSkill(p.h.id, p.slot, caster.id) || caster.boss));
      if (need > 0) {
        // Break check: commit tools until their Break adds up (strongest first; skills before ultimates)
        let sum = 0;
        for (const p of usable.filter(x => x.power > 0).sort((a, b) => Number(a.slot === 'ult') - Number(b.slot === 'ult') || b.power - a.power)) {
          if (sum >= need) break;
          reserved.add(p);
          sum += p.power;
        }
      } else {
        const pick = usable.filter(p => p.slot !== 'ult').sort((a, b) => a.availableAt - b.availableAt || a.back - b.back)[0];
        if (pick) reserved.add(pick);
      }
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

    // soft Focus on the most dangerous support / caster / phase add — only once the backline can already shoot it
    // from where it stands (no repositioning into the enemy line for it) — Mist Wraiths too once they come to us (a
    // Wraith still behind its wolves pulled melee heroes into the pack: encounter pass);
    // Shadow Panthers are left to the normal AI (measured: focusing them pulls the team apart)
    const back = heroes.filter(h => h.range >= 3);
    const pick = foes
      .filter(f => f.monster && FOCUS[f.monster.definitionId] != null)
      .filter(f => back.some(b => distance(b.pos, f.pos) <= b.range))
      // a Wraith is focused once it is through to our side of the frontline (diving), not while behind its pack
      .filter(f => f.monster!.definitionId !== 'mist_wraith' || f.pos.c <= Math.max(-Infinity, ...heroes.filter(h => h.range < 3).map(h => h.pos.c)))
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
