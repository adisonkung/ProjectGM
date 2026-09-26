/**
 * Skill Upgrade rules (pure). The authored SkillDefinition is rank 1 and is never mutated: `rankedSkill` returns a
 * copy with the rank's totals applied; `rankedKit` builds the kit a battle unit fights with.
 */
import { CLASS_KITS, HERO_DEFINITIONS, kitOf } from '../data/hero-skills';
import { STATUS_EFFECTS } from '../data/status-effects';
import {
  MAX_SKILL_RANK, SKILL_PRIORITY_BY_CLASS, SKILL_PRIORITY_BY_HERO, SKILL_PROFILES, SKILL_RANK_CAP_BY_TIER, SKILL_RANK_LIMITS,
  SKILL_RANK_TABLES, SKILL_SLOTS, TOME_CONVERSION,
} from '../data/skill-ranks';
import { HERO_BY_ID } from '../data/heroes';
import { HeroKit, SkillDefinition, SkillEffect } from '../models/combat';
import { GameState } from '../models/game-state';
import { HeroClass, OwnedHero } from '../models/hero';
import { SkillKind, SkillRanks } from '../models/progression';
import { HeroSkillPriority, SkillRankDefinition, SkillRankView, SkillUpgradeError } from '../models/skill-rank';

const clamp = (r: number | undefined) => Math.max(1, Math.min(MAX_SKILL_RANK, Math.round(r ?? 1)));
const r2 = (n: number) => Math.round(n * 1000) / 1000;

/** the rank definition of a skill (skills without a table: rank effects empty, costs still apply) */
export function rankDef(skillId: string, rank: number): SkillRankDefinition | null {
  return SKILL_RANK_TABLES[skillId]?.[clamp(rank) - 1] ?? null;
}

/** a copy of the skill with the rank's totals applied (rank 1 → an equal copy) */
export function rankedSkill(base: SkillDefinition, rank: number): SkillDefinition {
  const def = rankDef(base.id, rank);
  const s: SkillDefinition = { ...base, effects: base.effects.map(e => ({ ...e }) as SkillEffect) };
  if (!def) return s;
  const caps = SKILL_RANK_LIMITS.ccCap;
  for (const fx of def.upgradeEffects) {
    switch (fx.type) {
      case 'COOLDOWN':
        if (s.cooldown) s.cooldown = Math.max(fx.value, base.cooldown! * (1 - SKILL_RANK_LIMITS.maxRankCdr));
        break;
      default:
        for (const e of s.effects) applyToEffect(e, fx, caps);
    }
  }
  return s;
}

function applyToEffect(e: SkillEffect, fx: SkillRankDefinition['upgradeEffects'][number], caps: Record<string, number>): void {
  switch (fx.type) {
    case 'DAMAGE':
      if (e.type === 'DAMAGE') {
        e.primary = r2(e.primary * fx.mul);
        if (e.secondary != null) e.secondary = r2(e.secondary * fx.mul);
      }
      break;
    case 'HEAL':
      if (e.type === 'HEAL') {
        e.atk = r2(e.atk * fx.mul);
        if (e.maxHpPct != null) e.maxHpPct = r2(e.maxHpPct * fx.mul);
      }
      break;
    case 'SHIELD':
      if (e.type === 'SHIELD') {
        e.selfPct = r2(e.selfPct + fx.add);
        e.allyPct = r2(e.allyPct + fx.add);
      }
      break;
    case 'BREAK':
      if ((e.type === 'DAMAGE' && e.interrupt) || e.type === 'INTERRUPT') e.breakPower = Math.min(fx.value, SKILL_RANK_LIMITS.maxSingleBreak);
      break;
    case 'STATUS_DURATION':
      if (e.type === 'APPLY_STATUS' && e.status === fx.status) e.duration = Math.min(fx.value, caps[fx.status] ?? Infinity);
      break;
    case 'STATUS_POTENCY':
      if (e.type === 'APPLY_STATUS' && e.status === fx.status) e.potency = fx.mul;
      break;
    case 'STATUS_MODIFIER':
      if (e.type === 'APPLY_STATUS' && e.status === fx.status) e.modifiers = { ...fx.modifiers };
      break;
    case 'EXECUTE':
      if (e.type === 'DAMAGE' && e.executeBonus) e.executeBonus = { hpBelow: fx.hpBelow, mul: fx.mul };
      break;
    case 'REVIVE_HP':
      if (e.type === 'REVIVE') e.hpPct = fx.value;
      break;
  }
}

/** the kit a hero fights with at these ranks (all ranks 1 → the authored kit object itself) */
export function rankedKit(heroId: string | undefined, cls: HeroClass, ranks?: Partial<SkillRanks>): HeroKit {
  const base = kitOf(heroId, cls);
  if (!ranks || SKILL_SLOTS.every(k => clamp(ranks[k]) === 1)) return base;
  return {
    ...base,
    skill: rankedSkill(base.skill, clamp(ranks.skill)),
    skill2: rankedSkill(base.skill2, clamp(ranks.skill2)),
    ult: rankedSkill(base.ult, clamp(ranks.ult)),
  };
}

// ------------------------------------------------------------------ progression

export const heroRanks = (h: OwnedHero): SkillRanks =>
  ({ skill: clamp(h.skillRanks?.skill), skill2: clamp(h.skillRanks?.skill2), ult: clamp(h.skillRanks?.ult) });

/** highest rank this hero may hold now (breakthrough tier) */
export const skillRankCap = (h: OwnedHero) => SKILL_RANK_CAP_BY_TIER[Math.min(3, h.breakthroughTier ?? 0)] ?? MAX_SKILL_RANK;

export const heroKit = (h: OwnedHero): HeroKit => {
  const t = HERO_BY_ID[h.templateId];
  return kitOf(t.id, t.cls);
};

/** first reason the next rank of a slot is blocked (null = can upgrade) */
export function upgradeBlocker(h: OwnedHero, slot: SkillKind, inv: Record<string, number>, gold: number): SkillUpgradeError | null {
  const cur = heroRanks(h)[slot];
  if (cur >= MAX_SKILL_RANK) return 'MAX_RANK';
  const next = rankDef(heroKit(h)[slot].id, cur + 1) ?? genericCost(cur + 1);
  if ((h.breakthroughTier ?? 0) < next.requiredBreakthroughTier) return 'NEED_BREAKTHROUGH';
  if (cur + 1 > skillRankCap(h)) return 'RANK_CAP';
  if (h.level < next.requiredHeroLevel) return 'NEED_LEVEL';
  if (!next.requiredMaterials.every(m => (inv[m.itemId] ?? 0) >= m.count)) return 'NEED_MATERIALS';
  if (gold < next.requiredGold) return 'NEED_GOLD';
  return null;
}

/** skills without a table still cost the standard price (a rank changes nothing then) */
function genericCost(rank: number): SkillRankDefinition {
  const any = Object.values(SKILL_RANK_TABLES)[0][rank - 1];
  return { ...any, skillId: '?', upgradeEffects: [] };
}

/** spend tomes + gold → rank + 1 */
export function upgradeSkill(s: GameState, uid: number, slot: SkillKind): { state: GameState } | { error: SkillUpgradeError } {
  const h = s.heroes.find(x => x.uid === uid);
  if (!h) return { error: 'NO_HERO' };
  const err = upgradeBlocker(h, slot, s.inventory, s.gold);
  if (err) return { error: err };
  const cur = heroRanks(h)[slot];
  const next = rankDef(heroKit(h)[slot].id, cur + 1) ?? genericCost(cur + 1);
  const inventory = { ...s.inventory };
  for (const m of next.requiredMaterials) inventory[m.itemId] -= m.count;
  const hero: OwnedHero = { ...h, skillRanks: { ...heroRanks(h), [slot]: cur + 1 } };
  return { state: { ...s, inventory, gold: s.gold - next.requiredGold, heroes: s.heroes.map(x => (x.uid === uid ? hero : x)) } };
}

/** 5 lower tomes → 1 higher (inefficient on purpose) */
export function convertTomes(s: GameState, from: string, times = 1): { state: GameState } | { error: 'NO_RECIPE' | 'NEED_MATERIALS' } {
  const c = TOME_CONVERSION.find(x => x.from === from);
  if (!c) return { error: 'NO_RECIPE' };
  if ((s.inventory[from] ?? 0) < c.ratio * times || times < 1) return { error: 'NEED_MATERIALS' };
  return { state: { ...s, inventory: { ...s.inventory, [from]: s.inventory[from] - c.ratio * times, [c.to]: (s.inventory[c.to] ?? 0) + times } } };
}

// ------------------------------------------------------------------ profiles

export const skillPriorityOf = (heroId: string | undefined, cls: HeroClass): HeroSkillPriority =>
  (heroId && SKILL_PRIORITY_BY_HERO[heroId]) || SKILL_PRIORITY_BY_CLASS[cls];

/** ranks of a hero at a skill profile S0–S5 */
export function skillProfileRanks(heroId: string | undefined, cls: HeroClass, profile: string): SkillRanks {
  const p = SKILL_PROFILES[profile];
  if (!p) throw new Error(`unknown skill profile ${profile}`);
  const pr = skillPriorityOf(heroId, cls);
  return { [pr.critical]: p.critical, [pr.important]: p.important, [pr.secondary]: p.secondary } as SkillRanks;
}

// ------------------------------------------------------------------ UI

const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;

/** every number of a skill as readable lines (exact values; used for the current / next rank comparison) */
export function skillLines(s: SkillDefinition): string[] {
  const out: string[] = [];
  for (const e of s.effects) {
    switch (e.type) {
      case 'DAMAGE':
        out.push(`ดาเมจ ${pct(e.primary)} ATK` + (e.secondary != null && e.secondary !== e.primary ? ` (รอบข้าง ${pct(e.secondary)})` : ''));
        if (e.breakPower) out.push(`Break ${e.breakPower}`);
        if (e.executeBonus) out.push(`ประหาร: เป้า HP < ${pct(e.executeBonus.hpBelow)} ดาเมจ ×${e.executeBonus.mul}`);
        break;
      case 'HEAL':
        out.push(`ฮีล ${pct(e.atk)} ATK` + (e.maxHpPct ? ` + ${pct(e.maxHpPct)} HP สูงสุด` : ''));
        break;
      case 'SHIELD':
        out.push(`โล่ ตัวเอง ${pct(e.selfPct)} / เพื่อน ${pct(e.allyPct)} ของ HP สูงสุด ${e.duration} วิ`);
        break;
      case 'INTERRUPT':
        out.push(`ตัดร่าย` + (e.breakPower ? ` · Break ${e.breakPower}` : ''));
        break;
      case 'APPLY_STATUS': {
        const d = STATUS_EFFECTS[e.status];
        const dur = e.duration ?? d?.duration;
        let line = `${d?.name ?? e.status} ${dur} วิ`;
        const dt = e.modifiers?.damageTakenMultiplier ?? d?.modifiers.damageTakenMultiplier;
        if (e.status === 'taunt_guard' && dt != null) line += ` · ลดดาเมจ ${pct(1 - dt)}`;
        if (d?.tick) line += ` · ${pct(d.tick.perSecond * (e.potency ?? 1))} ATK/วิ`;
        out.push(line);
        break;
      }
      case 'REVIVE':
        out.push(`ชุบ ${e.count} คน ${pct(e.hpPct)} HP (1 ครั้ง/ด่าน)`);
        break;
      case 'KNOCKBACK':
        out.push(`ผลักถอย ${e.cells} ช่อง`);
        break;
    }
  }
  if (s.cooldown) out.push(`คูลดาวน์ ${s.cooldown} วิ`);
  return out;
}

export function skillRankView(h: OwnedHero, slot: SkillKind, inv: Record<string, number>, gold: number): SkillRankView {
  const base = heroKit(h)[slot];
  const rank = heroRanks(h)[slot];
  const current = skillLines(rankedSkill(base, rank));
  const next = rank < MAX_SKILL_RANK ? skillLines(rankedSkill(base, rank + 1)) : null;
  const changes = next ? next.map((l, i) => (l !== current[i] ? `${current[i]} → ${l}` : '')).filter(Boolean) : [];
  return {
    slot, skillId: base.id, name: base.name, rank, maxRank: MAX_SKILL_RANK, current, next, changes,
    cost: rank < MAX_SKILL_RANK ? rankDef(base.id, rank + 1) ?? genericCost(rank + 1) : null,
    blocked: upgradeBlocker(h, slot, inv, gold),
  };
}

/** every skill id a hero can own (tests: each has a rank table) */
export const allHeroSkillIds = (): string[] => [
  ...new Set([...Object.values(CLASS_KITS), ...Object.values(HERO_DEFINITIONS).map(d => d.kit)].flatMap(k => SKILL_SLOTS.map(s => k[s].id))),
];
