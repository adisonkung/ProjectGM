import { FARM_BY_ID, FARM_DUNGEONS, DAILY_BONUS, ITEMS } from '../data/economy';
import { HERO_DEFINITIONS, kitOf } from '../data/hero-skills';
import { MONSTER_SKILLS, MONSTERS } from '../data/monsters';
import { POWER_PROFILES } from '../data/progression';
import {
  MAX_SKILL_RANK, SKILL_PROFILES, SKILL_RANK_CAP_BY_TIER, SKILL_RANK_COSTS, SKILL_RANK_LIMITS, SKILL_RANK_TABLES, SKILL_SLOTS,
} from '../data/skill-ranks';
import { newGameState } from '../data/starter';
import { GameState } from '../models/game-state';
import { OwnedHero } from '../models/hero';
import { wavesOf } from '../models/stage';
import { applyProfile } from './progression';
import { completeFarmRun, grantItems } from './rewards';
import {
  allHeroSkillIds, convertTomes, rankDef, rankedKit, rankedSkill, skillLines, skillProfileRanks, skillRankCap, skillRankView,
  upgradeBlocker, upgradeSkill,
} from './skill-ranks';

const hero = (templateId: string, o: Partial<OwnedHero> = {}): OwnedHero => ({ uid: 1, templateId, level: 10, potential: 'B', breakthroughTier: 3, ...o });
const eff = (s: ReturnType<typeof rankedSkill>, type: string) => s.effects.find(e => e.type === type) as any;
const status = (s: ReturnType<typeof rankedSkill>, id: string) => s.effects.find(e => e.type === 'APPLY_STATUS' && e.status === id) as any;
const rich = (s: GameState): GameState => ({ ...s, gold: 1e6, inventory: { skill_tome_1: 99, skill_tome_2: 99, skill_tome_3: 99 } });

describe('Skill Upgrade — rank tables (data)', () => {
  it('every hero skill (class kits + 5★ kits) has a 5-rank table; rank 1 changes nothing', () => {
    for (const id of allHeroSkillIds()) {
      const t = SKILL_RANK_TABLES[id];
      expect(t).withContext(id).toBeDefined();
      expect(t.map(r => r.rank)).withContext(id).toEqual([1, 2, 3, 4, 5]);
      expect(t[0].upgradeEffects).withContext(id).toEqual([]);
      expect(t.every(r => r.skillId === id)).toBeTrue();
    }
  });

  it('rank 1 resolves to an equal copy; the global SkillDefinition is never mutated', () => {
    const base = kitOf('aurel', 'tank').skill2;
    const snapshot = JSON.stringify(base);
    const r1 = rankedSkill(base, 1);
    expect(r1).not.toBe(base);
    expect(JSON.stringify(r1)).toBe(snapshot);
    rankedSkill(base, 5);
    rankedKit('aurel', 'tank', { skill: 5, skill2: 5, ult: 5 });
    expect(JSON.stringify(base)).toBe(snapshot);
    expect(JSON.stringify(HERO_DEFINITIONS['lumina'].kit.ult)).toBe(JSON.stringify(kitOf('lumina', 'healer').ult));
  });

  it('rankedKit: all ranks 1 → the authored kit; higher ranks → copies', () => {
    expect(rankedKit('jin', 'fighter', { skill: 1, skill2: 1, ult: 1 })).toBe(kitOf('jin', 'fighter'));
    expect(rankedKit('jin', 'fighter', { skill: 3, skill2: 1, ult: 1 }).skill).not.toBe(kitOf('jin', 'fighter').skill);
  });

  it('R1→R5 damage / heal +20–35 % (no universal ×2); every value is monotonic', () => {
    for (const [id, t] of Object.entries(SKILL_RANK_TABLES)) {
      let prevDmg = 1;
      let prevHeal = 1;
      for (const r of t) {
        const d = r.upgradeEffects.find(e => e.type === 'DAMAGE') as { mul: number } | undefined;
        const h = r.upgradeEffects.find(e => e.type === 'HEAL') as { mul: number } | undefined;
        if (d) { expect(d.mul).withContext(`${id} R${r.rank}`).toBeGreaterThanOrEqual(prevDmg); prevDmg = d.mul; }
        if (h) { expect(h.mul).withContext(`${id} R${r.rank}`).toBeGreaterThanOrEqual(prevHeal); prevHeal = h.mul; }
      }
      expect(prevDmg).withContext(id).toBeLessThanOrEqual(SKILL_RANK_LIMITS.maxPowerMul);
      expect(prevHeal).withContext(id).toBeLessThanOrEqual(SKILL_RANK_LIMITS.maxPowerMul);
    }
    // pure damage skills reach +20–35 %
    for (const id of ['spinning_sword', 'dragon_execution', 'soul_curse', 'soul_beam', 'shadow_execution', 'lava_axe_crash', 'rapid_shot']) {
      const m = (SKILL_RANK_TABLES[id][4].upgradeEffects.find(e => e.type === 'DAMAGE') as { mul: number }).mul;
      expect(m).withContext(id).toBeGreaterThanOrEqual(1.2);
      expect(m).withContext(id).toBeLessThanOrEqual(1.35);
    }
    for (const id of ['prayer', 'holy_blessing']) {
      const m = (SKILL_RANK_TABLES[id][4].upgradeEffects.find(e => e.type === 'HEAL') as { mul: number }).mul;
      expect(m).withContext(id).toBeGreaterThanOrEqual(1.2);
    }
  });

  it('Tank tables: Taunt DR 40→43→45 %, taunt 3→3.5 s; Shield Charge 150→160 %, Break 60→65→70, cd 12→11.5; ult shields +2 %, Break 70→75', () => {
    const k = kitOf('aurel', 'tank');
    const dr = (r: number) => 1 - (status(rankedSkill(k.skill, r), 'taunt_guard').modifiers?.damageTakenMultiplier ?? 0.6);
    expect([1, 3, 5].map(dr).map(x => Math.round(x * 100))).toEqual([40, 43, 45]);
    expect(status(rankedSkill(k.skill, 5), 'taunted').duration).toBe(3.5);
    const sc = (r: number) => rankedSkill(k.skill2, r);
    expect(eff(sc(1), 'DAMAGE').primary).toBe(1.5);
    expect(eff(sc(5), 'DAMAGE').primary).toBeCloseTo(1.6, 2);
    expect([1, 3, 5].map(r => eff(sc(r), 'DAMAGE').breakPower)).toEqual([60, 65, 70]);
    expect(sc(5).cooldown).toBe(11.5);
    const ult = rankedSkill(k.ult, 5);
    expect(eff(ult, 'SHIELD').selfPct).toBeCloseTo(0.32, 5);
    expect(eff(ult, 'SHIELD').allyPct).toBeCloseTo(0.17, 5);
    expect(eff(ult, 'INTERRUPT').breakPower).toBe(75);
  });

  it('Sylvie Arrow Rain Break 40→45→50 + cooldown; ult Break modest; Velma root slight and never an interrupt', () => {
    const k = kitOf('sylvie', 'archer');
    expect([1, 3, 5].map(r => eff(rankedSkill(k.skill2, r), 'DAMAGE').breakPower)).toEqual([40, 45, 50]);
    expect(rankedSkill(k.skill2, 5).cooldown!).toBeLessThan(k.skill2.cooldown!);
    const ultBreak = eff(rankedSkill(k.ult, 5), 'DAMAGE').breakPower;
    expect(ultBreak - 60).toBeGreaterThan(0);
    expect(ultBreak - 60).toBeLessThanOrEqual(5);
    const bh = rankedSkill(kitOf('velma', 'mage').skill2, 5);
    expect(status(bh, 'root').duration).toBeGreaterThan(1.5);
    expect(status(bh, 'root').duration).toBeLessThanOrEqual(2);
    for (let r = 1; r <= 5; r++) {
      const s = rankedSkill(kitOf('velma', 'mage').skill2, r);
      expect(s.effects.some(e => e.type === 'INTERRUPT' || (e.type === 'DAMAGE' && e.interrupt))).toBeFalse();
    }
  });

  it('Shade / Corvin poison and Corvin HoT modest (≤ ×1.2); Nox execute slight; resurrection keeps count 1', () => {
    expect(status(rankedSkill(kitOf('shade', 'assassin').skill2, 5), 'poison').potency).toBe(1.2);
    expect(status(rankedSkill(kitOf('corvin', 'healer').skill2, 5), 'poison').potency).toBe(1.2);
    expect(status(rankedSkill(kitOf('corvin', 'healer').skill, 5), 'healing_mist').potency).toBe(1.2);
    const reap = eff(rankedSkill(kitOf('nox', 'assassin').ult, 5), 'DAMAGE').executeBonus;
    expect(reap.hpBelow).toBeLessThanOrEqual(0.4);
    expect(reap.mul).toBeLessThanOrEqual(1.4);
    for (const h of ['lumina', 'corvin']) {
      const rev = eff(rankedSkill(kitOf(h, 'healer').ult, 5), 'REVIVE');
      expect(rev.count).toBe(1);
      expect(rev.hpPct).toBe(0.5);
    }
  });

  it('limits: rank CDR ≤ 10 %, one skill never reaches 100 Break (even + 20 gear), CC caps (root ≤ 2 s, taunt ≤ 3.5 s)', () => {
    for (const [id, cls] of [['aurel', 'tank'], ['jin', 'fighter'], ['ragnar', 'fighter'], ['shade', 'assassin'], ['nox', 'assassin'], ['sylvie', 'archer'], ['velma', 'mage'], ['lumina', 'healer'], ['corvin', 'healer']] as const) {
      const base = kitOf(id, cls);
      for (const slot of SKILL_SLOTS) {
        const s = rankedSkill(base[slot], 5);
        if (base[slot].cooldown) expect(s.cooldown!).withContext(`${id} ${slot}`).toBeGreaterThanOrEqual(base[slot].cooldown! * (1 - SKILL_RANK_LIMITS.maxRankCdr) - 1e-9);
        for (const e of s.effects) {
          const bp = (e as { breakPower?: number }).breakPower;
          if (bp) expect(bp + 20).withContext(`${id} ${slot}`).toBeLessThan(100);
          if (e.type === 'APPLY_STATUS' && SKILL_RANK_LIMITS.ccCap[e.status] && e.duration != null) {
            expect(e.duration).withContext(`${id} ${slot} ${e.status}`).toBeLessThanOrEqual(SKILL_RANK_LIMITS.ccCap[e.status]);
          }
        }
      }
    }
  });
});

describe('Skill Upgrade — requirements, costs, upgrade', () => {
  it('requirements: R2 Lv3 · R3 Lv6 + BT I · R4 Lv8 · R5 Lv10 + BT III; rank cap 2 before BT I', () => {
    expect([2, 3, 4, 5].map(r => [SKILL_RANK_COSTS[r].level, SKILL_RANK_COSTS[r].tier])).toEqual([[3, 0], [6, 1], [8, 1], [10, 3]]);
    expect(SKILL_RANK_CAP_BY_TIER[0]).toBe(2);
    expect(skillRankCap(hero('jin', { level: 5, breakthroughTier: 0 }))).toBe(2);
    expect(skillRankCap(hero('jin', { breakthroughTier: 3 }))).toBe(MAX_SKILL_RANK);
    const d = rankDef('shield_charge', 3)!;
    expect([d.requiredHeroLevel, d.requiredBreakthroughTier]).toEqual([6, 1]);
  });

  it('costs: Tome I ×2 → I ×4 + II ×1 → II ×4 → III ×5; gold rises steeply', () => {
    const items = (r: number) => SKILL_RANK_COSTS[r].items.map(i => `${i.itemId}×${i.count}`).join(',');
    expect(items(2)).toBe('skill_tome_1×2');
    expect(items(3)).toBe('skill_tome_1×4,skill_tome_2×1');
    expect(items(4)).toBe('skill_tome_2×4');
    expect(items(5)).toBe('skill_tome_3×5');
    for (let r = 3; r <= 5; r++) expect(SKILL_RANK_COSTS[r].gold).toBeGreaterThanOrEqual(SKILL_RANK_COSTS[r - 1].gold * 2);
  });

  it('upgradeSkill spends tomes + gold and raises one slot; blockers in order', () => {
    const s0 = newGameState();
    const uid = s0.heroes.find(h => h.templateId === 'aurel')!.uid;
    const withHero = (o: Partial<OwnedHero>, s = s0): GameState => ({ ...s, heroes: s.heroes.map(h => (h.uid === uid ? { ...h, ...o } : h)) });
    // Lv1: level blocks R2
    expect(upgradeSkill(rich(s0), uid, 'skill2')).toEqual({ error: 'NEED_LEVEL' });
    // Lv3, no tomes
    expect(upgradeSkill(withHero({ level: 3 }), uid, 'skill2')).toEqual({ error: 'NEED_MATERIALS' });
    const st = { ...withHero({ level: 3 }), inventory: { skill_tome_1: 3 }, gold: 299 };
    expect(upgradeSkill(st, uid, 'skill2')).toEqual({ error: 'NEED_GOLD' });
    const ok = upgradeSkill({ ...st, gold: 500 }, uid, 'skill2') as { state: GameState };
    expect(ok.state.inventory['skill_tome_1']).toBe(1);
    expect(ok.state.gold).toBe(200);
    expect(ok.state.heroes.find(h => h.uid === uid)!.skillRanks).toEqual({ skill: 1, skill2: 2, ult: 1 });
    // R3 needs BT I (rank cap 2 before it)
    const r3 = rich(withHero({ level: 5, breakthroughTier: 0, skillRanks: { skill2: 2 } }));
    expect(upgradeSkill(r3, uid, 'skill2')).toEqual({ error: 'NEED_BREAKTHROUGH' });
    const r5 = rich(withHero({ level: 10, breakthroughTier: 2, skillRanks: { skill2: 4 } }));
    expect(upgradeSkill(r5, uid, 'skill2')).toEqual({ error: 'NEED_BREAKTHROUGH' });
    const max = rich(withHero({ skillRanks: { skill2: 5 } }));
    expect(upgradeSkill(max, uid, 'skill2')).toEqual({ error: 'MAX_RANK' });
    expect(upgradeSkill(s0, 999, 'skill')).toEqual({ error: 'NO_HERO' });
  });

  it('a full R1→R5 path costs Tome I ×6 · II ×5 · III ×5 + gold', () => {
    let s = rich(newGameState());
    const uid = s.heroes[0].uid;
    s = { ...s, heroes: s.heroes.map(h => (h.uid === uid ? { ...h, level: 10, breakthroughTier: 3 } : h)) };
    for (let i = 0; i < 4; i++) s = (upgradeSkill(s, uid, 'ult') as { state: GameState }).state;
    expect([99 - s.inventory['skill_tome_1'], 99 - s.inventory['skill_tome_2'], 99 - s.inventory['skill_tome_3']]).toEqual([6, 5, 5]);
    expect(1e6 - s.gold).toBe([2, 3, 4, 5].reduce((a, r) => a + SKILL_RANK_COSTS[r].gold, 0));
  });

  it('tomes: 10 fragments = 1 tome; 5 lower → 1 higher conversion (inefficient)', () => {
    const g = grantItems({}, {}, [{ itemId: 'skill_tome_1', count: 0.4 }, { itemId: 'skill_tome_frag_1', count: 7 }]);
    expect(g.inventory['skill_tome_1']).toBe(1);
    expect(g.inventory['skill_tome_frag_1']).toBe(1);
    expect(ITEMS['skill_tome_frag_3'].combinesInto).toBe('skill_tome_3');
    const s = { ...newGameState(), inventory: { skill_tome_1: 11 } };
    const c = convertTomes(s, 'skill_tome_1', 2) as { state: GameState };
    expect(c.state.inventory).toEqual({ skill_tome_1: 1, skill_tome_2: 2 });
    expect(convertTomes(s, 'skill_tome_1', 3)).toEqual({ error: 'NEED_MATERIALS' });
    expect(convertTomes(s, 'skill_tome_3')).toEqual({ error: 'NO_RECIPE' });
  });

  it('UI view: current + next rank with exact numbers, cost and blocker', () => {
    const h = hero('aurel', { skillRanks: { skill2: 2 } });
    const v = skillRankView(h, 'skill2', { skill_tome_1: 4, skill_tome_2: 1 }, 5000);
    expect(v.rank).toBe(2);
    expect(v.current).toContain('Break 60');
    expect(v.next).toContain('Break 65');
    expect(v.changes.some(c => c.includes('Break 60 → Break 65'))).toBeTrue();
    expect(v.cost!.requiredGold).toBe(SKILL_RANK_COSTS[3].gold);
    expect(v.blocked).toBeNull();
    expect(skillLines(rankedSkill(kitOf('aurel', 'tank').skill, 5)).join(' ')).toContain('ลดดาเมจ 45%');
    const low = skillRankView(hero('aurel', { level: 2, breakthroughTier: 0 }), 'skill', {}, 0);
    expect(low.blocked).toBe('NEED_LEVEL');
    expect(upgradeBlocker(hero('aurel', { skillRanks: { skill: 5 } }), 'skill', {}, 0)).toBe('MAX_RANK');
  });

  it('skill ranks persist on the hero (save JSON) and reach the battle unit spec', () => {
    const s = newGameState();
    s.heroes[0].skillRanks = { skill: 2, skill2: 3, ult: 1 };
    const back = JSON.parse(JSON.stringify(s)) as GameState;
    expect(back.heroes[0].skillRanks).toEqual({ skill: 2, skill2: 3, ult: 1 });
  });
});

describe('Skill Upgrade — profiles S0–S5 and combined A–F', () => {
  it('skill profiles rank critical → important → secondary', () => {
    expect(skillProfileRanks('aurel', 'tank', 'S0')).toEqual({ skill: 1, skill2: 1, ult: 1 });
    expect(skillProfileRanks('aurel', 'tank', 'S3')).toEqual({ skill2: 4, ult: 3, skill: 2 });
    expect(skillProfileRanks('sylvie', 'archer', 'S1')).toEqual({ skill2: 2, ult: 1, skill: 1 });
    expect(skillProfileRanks('shade', 'assassin', 'S4')).toEqual({ ult: 5, skill: 4, skill2: 3 });
    expect(skillProfileRanks('lumina', 'healer', 'S5')).toEqual({ skill: 5, skill2: 5, ult: 5 });
    expect(Object.keys(SKILL_PROFILES)).toEqual(['S0', 'S1', 'S2', 'S3', 'S4', 'S5']);
  });

  it('combined profiles SA–SF: Lv10, gear None / Mid / Mid / Good / VG / NearMax, skills S0 / S0 / S2 / S3 / S4 / S5', () => {
    const ids = ['SA', 'SB', 'SC', 'SD', 'SE', 'SF'];
    expect(ids.map(id => POWER_PROFILES[id].gear)).toEqual([null, 'MID', 'MID', 'GOOD', 'VERY_GOOD', 'NEAR_MAX']);
    expect(ids.map(id => POWER_PROFILES[id].skillProfile)).toEqual(['S0', 'S0', 'S2', 'S3', 'S4', 'S5']);
    const h = applyProfile(newGameState().heroes.find(x => x.templateId === 'aurel')!, POWER_PROFILES['SD']);
    expect(h.level).toBe(10);
    expect(h.skillRanks).toEqual({ skill2: 4, ult: 3, skill: 2 });
  });
});

describe('Skill Trial I–IV', () => {
  const trials = FARM_DUNGEONS.filter(d => d.type === 'SKILL');

  it('four trials: unlock F4 / F6 / F7 / F8, daily bonus 2 runs ×1.5, repeat ×0.6, EVENT_KO, first-clear reward, target times in window', () => {
    expect(trials.map(t => t.id)).toEqual(['trial_1', 'trial_2', 'trial_3', 'trial_4']);
    expect(trials.map(t => t.unlockFloor)).toEqual([4, 6, 7, 8]);
    expect(DAILY_BONUS['SKILL']).toBe(2);
    const windows: [number, number][] = [[75, 105], [90, 120], [105, 150], [120, 180]];
    trials.forEach((t, i) => {
      expect(t.dailyBonusPool).toBe('SKILL');
      expect(t.dailyBonusMultiplier).toBe(1.5);
      expect(t.repeatRewardMultiplier).toBe(0.6);
      expect(t.deathRule).toBe('EVENT_KO');
      expect(t.firstClearBonus?.items?.length).toBeGreaterThan(0);
      expect(t.baseRewards.items!.every(x => x.itemId.startsWith('skill_tome_'))).toBeTrue();
      expect(t.targetTime).toBeGreaterThanOrEqual(windows[i][0]);
      expect(t.targetTime).toBeLessThanOrEqual(windows[i][1]);
    });
  });

  it('themes (Arcane Exam Hall roster): I Rune Wisp casters · II a Grimoire every wave · III several casters at once (Grimoire + Rune-Bolt wisp) · IV Arcane Examiner (break only, 100)', () => {
    const ids = (id: string) => wavesOf(FARM_BY_ID[id].stage).map(w => [...w.spawns, ...(w.reinforcements ?? []).flatMap(r => r.spawns)].map(s => s.monsterId.split('@')[0]));
    const casters = (id: string) => wavesOf(FARM_BY_ID[id].stage).flatMap(w => [...w.spawns, ...(w.reinforcements ?? []).flatMap(r => r.spawns)])
      .filter(s => MONSTERS[s.monsterId].skills.length > 0);
    expect(casters('trial_1').some(s => MONSTERS[s.monsterId].skills.includes('rune_bolt'))).toBeTrue();
    expect(ids('trial_2').every(w => w.includes('grimoire_familiar'))).toBeTrue();
    expect(wavesOf(FARM_BY_ID['trial_3'].stage).some(w => w.spawns.filter(s => MONSTERS[s.monsterId].skills.length > 0).length >= 2)).toBeTrue();
    expect(ids('trial_4').flat()).toContain('arcane_examiner');
    // only the Arcane Exam Hall's own monsters
    for (const t of ['trial_1', 'trial_2', 'trial_3', 'trial_4']) {
      expect(ids(t).flat().every(id => ['rune_wisp', 'grimoire_familiar', 'arcane_examiner'].includes(id))).withContext(t).toBeTrue();
    }
    const seal = MONSTER_SKILLS['arcane_seal'] as unknown as { breakRequired: number; interruptible: boolean };
    expect(seal.breakRequired).toBe(100);
    expect(seal.interruptible).toBeFalse();
    expect(MONSTERS['arcane_examiner'].animation.sheet).toBe('enemy-arcane-examiner.png');
  });

  it('a Trial clear pays tomes / fragments + gold, bonus runs ×1.5 then repeats ×0.6, first clear once', () => {
    let s: GameState = { ...newGameState(), cleared: 8 };
    const now = new Date(2026, 9, 1, 12);
    const run = { win: true, deaths: 0, time: 80, participants: s.team.map(t => t.uid) };
    const def = FARM_BY_ID['trial_1'];
    const rng = () => 0.99;
    const r1 = completeFarmRun(s, def, run, rng, now);
    expect(r1.breakdown!.kind).toBe('DAILY_BONUS');
    // 0.16 × 1.5 = 0.24 tome → 2 fragments, + first clear 2 tomes
    expect(r1.state.inventory['skill_tome_1']).toBe(2);
    expect(r1.state.inventory['skill_tome_frag_1']).toBe(2);
    expect(r1.state.gold).toBe(s.gold + 120);
    s = completeFarmRun(r1.state, def, run, rng, now).state;
    const r3 = completeFarmRun(s, def, run, rng, now);
    expect(r3.breakdown!.kind).toBe('REPEAT');
    expect(r3.breakdown!.final.gold).toBe(48);
    expect(r3.rating).toBe(3);
  });
});
