import { HERO_CLASS_BASE } from '../data/classes';
import { kitOf } from '../data/hero-skills';
import { EchoCombatProfile } from '../data/echo-trial';
import { HeroKit, SkillDefinition } from '../models/combat';
import { UnitSpec } from '../models/unit';
import { LEVEL_GROWTH } from './stats';

export function echoSpec(source: UnitSpec, p: EchoCombatProfile): UnitSpec {
  const base = HERO_CLASS_BASE[source.cls], lv = Math.max(0, p.level - 1);
  return {
    name: `Echo ${source.name}`, heroId: source.heroId, cls: source.cls,
    sprite: source.sprite, level: source.level, pos: { ...source.pos },
    stats: { ...base,
      hp: Math.round(base.hp * (1 + lv * LEVEL_GROWTH.hp) * p.hpMultiplier),
      atk: Math.round(base.atk * (1 + lv * LEVEL_GROWTH.atk) * p.attackMultiplier),
      def: Math.round(base.def * (1 + lv * LEVEL_GROWTH.def) * p.defenseMultiplier),
      maxMana: 0,
    },
  };
}

/** Runtime copies only: the authored playable kit is never mutated. No hero summon effect exists in V1. */
export function echoKit(source: UnitSpec, p: EchoCombatProfile): HeroKit {
  const original = kitOf(source.heroId, source.cls);
  return { ...original, attack: safeEchoSkill(original.attack, p), skill: safeEchoSkill(original.skill, p), skill2: safeEchoSkill(original.skill2, p),
    ult: { ...original.ult, effects: [], useMode: 'MANUAL' } };
}

export function safeEchoSkill(s: SkillDefinition, p: EchoCombatProfile): SkillDefinition {
  return ({ ...s, useMode: 'AUTO',
    cooldown: s.cooldown == null ? undefined : s.cooldown * p.cooldownMultiplier,
    effects: s.effects.filter(e => e.type !== 'REVIVE').map(e => ({ ...e })),
  });
}
