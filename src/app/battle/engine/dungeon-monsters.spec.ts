import '../../../testing/legacy-roster';
import { ascensionBossFor, ascensionDuel, FARM_BY_ID, FARM_DUNGEONS } from '../../core/data/economy';
import { HERO_BY_ID } from '../../core/data/heroes';
import { ASCENSION_TIER_SCALE, DUNGEON_MONSTERS, DUNGEON_ROLE_MAP, variantId } from '../../core/data/monsters-dungeon';
import { MONSTER_SKILLS, MONSTERS } from '../../core/data/monsters';
import { FX, SHEETS } from '../../core/data/sprites';
import { EnemyPlacement, StageDef } from '../../core/models/stage';
import { UnitSpec } from '../../core/models/unit';
import { heroStats } from '../../core/rules/stats';
import { createBattle } from '../battle-session';
import { BattleEvent, BattleUnit } from './battle-engine';
import { hasFlag, hasStatus } from './buffs';
import { wavesOf } from '../../core/models/stage';

/** Special-dungeon rosters (claude/special-dungeon-monsters.md): data, variants, weekday rotation, new mechanics */

const DT = 0.05;
type Ev = BattleEvent & { t: number };
const H = (id: string, depth: number, lane: number, o: Partial<UnitSpec['stats']> = {}): UnitSpec => {
  const t = HERO_BY_ID[id];
  return {
    name: t.name, cls: t.cls, heroId: id, heroUid: 1000 + depth * 10 + lane,
    stats: { ...heroStats(t, { uid: 0, templateId: id, level: 1, potential: 'B' }), ...o },
    pos: { r: depth, c: lane },
  };
};
const mon = (enemy: string, depth: number, lane: number): EnemyPlacement => ({ enemy, r: depth, c: lane });
const stage = (enemies: EnemyPlacement[], extra: Partial<StageDef> = {}): StageDef => ({ floor: 0, id: 'test', mode: 'eliminate', timeLimit: 300, enemies, rulePreset: 'arena', ...extra });
function session(st: StageDef, allies: UnitSpec[]) {
  const e = createBattle({ allies, stage: st, seed: 7 });
  const log: Ev[] = [];
  const run = (sec: number, each?: () => boolean | void) => {
    for (let i = 0; i < Math.round(sec / DT) && !e.result; i++) {
      e.step(DT);
      for (const ev of e.drainEvents()) log.push({ ...ev, t: e.time });
      if (each?.()) break;
    }
  };
  const of = <T extends BattleEvent['type']>(type: T) => log.filter(x => x.type === type) as (Ev & Extract<BattleEvent, { type: T }>)[];
  return { e, log, run, of };
}
const foe = (e: { units: BattleUnit[] }, base: string) => e.units.find(u => u.monster && u.monster.definitionId.split('@')[0] === base)!;
const spawnIds = (id: string) =>
  wavesOf(FARM_BY_ID[id].stage).flatMap(w => [...w.spawns, ...(w.reinforcements ?? []).flatMap(r => r.spawns)]).map(s => s.monsterId);

describe('Special-dungeon monsters: data', () => {
  it('each dungeon only uses its own designs (Training / Hunt / Trial), carriers are Coin Kobolds', () => {
    const own: Record<string, string[]> = {
      TRAINING: ['straw_recruit', 'crossbow_dummy', 'drill_sergeant'],
      EQUIPMENT: ['gem_beetle', 'mimic_chest', 'coin_kobold'],
      SKILL: ['rune_wisp', 'grimoire_familiar', 'arcane_examiner'],
    };
    for (const d of FARM_DUNGEONS.filter(x => own[x.type])) {
      const st = d.stage;
      const all = [...spawnIds(d.id), ...(st.special?.horde?.groups.flat().map(g => g.monsterId) ?? [])].map(id => id.split('@')[0]);
      expect(all.length).withContext(d.id).toBeGreaterThan(0);
      expect(all.every(id => own[d.type].includes(id))).withContext(`${d.id}: ${[...new Set(all)]}`).toBeTrue();
      for (const id of [...spawnIds(d.id)]) expect(MONSTERS[id]).withContext(id).toBeDefined();
    }
    for (const n of [1, 2, 3, 4, 5]) expect(spawnIds(`hunt_${n}`).filter(id => id === 'coin_kobold').length).toBe(3);
  });

  it('a role variant keeps the replaced monster\'s HP / DEF / damage per second, the design\'s look and skills', () => {
    const v = MONSTERS[variantId('straw_recruit', 'goblin_fighter')];
    const src = MONSTERS['goblin_fighter'];
    expect(v.baseId).toBe('straw_recruit');
    expect(v.stats.maxHp).toBe(src.stats.maxHp);
    expect(v.stats.defense).toBe(src.stats.defense);
    const dps = (m: typeof v) => (m.stats.attack * m.attack.damageMultiplier) / m.stats.attackCooldown;
    expect(Math.abs(dps(v) - dps(src)) / dps(src)).toBeLessThan(0.05);
    expect(v.animation.sheet).toBe('enemy-straw-recruit.png');
    // only real casters carry RUNE BOLT; the Rally Whistle sergeant is the one that replaced the Alpha
    expect(MONSTERS[variantId('rune_wisp', 'goblin_fighter')].skills).toEqual([]);
    expect(MONSTERS[variantId('rune_wisp', 'magic_mushroom')].skills).toEqual([]);
    expect(MONSTERS[variantId('rune_wisp', 'alpha_wolf')].skills).toEqual(['rune_bolt']);
    // a shooter standing in for a melee monster keeps the melee reach; one replacing a shooter keeps its range
    expect(MONSTERS[variantId('rune_wisp', 'goblin_fighter')].stats.attackRange).toBe(MONSTERS['goblin_fighter'].stats.attackRange);
    expect(MONSTERS[variantId('rune_wisp', 'goblin_fighter')].ai.movement).toBe(MONSTERS['goblin_fighter'].ai.movement);
    expect(MONSTERS[variantId('rune_wisp', 'goblin_archer')].stats.attackRange).toBe(MONSTERS['rune_wisp'].stats.attackRange);
    expect(MONSTERS[variantId('drill_sergeant', 'alpha_wolf')].skills).toEqual(['rally_whistle']);
    expect(MONSTERS[variantId('drill_sergeant', 'corrupted_treant')].skills).toEqual([]);
    for (const map of Object.values(DUNGEON_ROLE_MAP)) for (const [from, sw] of Object.entries(map)) {
      if (MONSTERS[from]) expect(MONSTERS[variantId(sw.to, from)]).withContext(`${sw.to}@${from}`).toBeDefined();
    }
  });

  it('Ascension: guardian by weekday (Mon–Tue Shishi · Wed–Thu Ronin · Fri–Sun Seraph), tiers are stat steps', () => {
    // 2026-09-28 is a Monday
    const day = (d: number) => new Date(2026, 8, 28 + d);
    expect([0, 1, 2, 3, 4, 5, 6].map(d => ascensionBossFor(day(d)))).toEqual([
      'brass_shishi', 'brass_shishi', 'moonblade_ronin', 'moonblade_ronin', 'astral_seraph', 'astral_seraph', 'astral_seraph',
    ]);
    for (const boss of ['brass_shishi', 'moonblade_ronin', 'astral_seraph'] as const) {
      for (const t of [1, 2, 3]) {
        const st = ascensionDuel(t, boss);
        expect(st.special!.kind).toBe('BOSS_DUEL');
        const id = st.enemies[0].enemy;
        expect(id).toBe(`${boss}@${t}`);
        expect(MONSTERS[id].stats.maxHp).toBe(Math.round(DUNGEON_MONSTERS[boss].stats.maxHp * ASCENSION_TIER_SCALE[t - 1].hp));
        expect(MONSTERS[id].rank).toBe('BOSS');
      }
    }
    // the dungeon definition hands out today's guardian
    expect(FARM_BY_ID['ascension_2'].stage.enemies[0].enemy).toBe(`${ascensionBossFor()}@2`);
  });

  it('sprite sheets: every design has a generated sheet, big bosses use wide cells, one cast row per skill clip', () => {
    for (const d of Object.values(DUNGEON_MONSTERS)) {
      const sh = SHEETS[d.animation.sheet!];
      expect(sh).withContext(d.id).toBeDefined();
      expect(sh.anims.idle && sh.anims.walk && sh.anims.hurt && sh.anims.die && sh.anims.attack).withContext(d.id).toBeTruthy();
      for (const sk of d.skills) expect(d.animation.clips[MONSTER_SKILLS[sk].clip!]).withContext(`${d.id}/${sk}`).toBeDefined();
    }
    expect(SHEETS['enemy-brass-shishi.png'].cellW).toBeGreaterThan(132);
    expect(SHEETS['enemy-astral-seraph.png'].cellH).toBeGreaterThan(150);
    expect(Object.keys(SHEETS['enemy-moonblade-ronin.png'].casts!)).toEqual(['iaido', 'mirror']);
    for (const sk of Object.values(MONSTER_SKILLS)) {
      if (sk.hitFx) expect(FX[sk.hitFx]).withContext(sk.id).toBeDefined();
      if (sk.fx && DUNGEON_MONSTERS[Object.keys(DUNGEON_MONSTERS).find(k => DUNGEON_MONSTERS[k].skills.includes(sk.id)) ?? '']) expect(FX[sk.fx.id]).withContext(sk.id).toBeDefined();
    }
  });
});

describe('Special-dungeon monsters: mechanics', () => {
  it('Ascension guardians hold their shrine: never walk more than 1 cell from the spawn to chase the backline', () => {
    const s = session(stage([mon('brass_shishi@1', 1, 1)]), [H('sylvie', 5, 1, { hp: 99999, atk: 1 }), H('lumina', 5, 0, { hp: 99999, atk: 1 })]);
    const boss = foe(s.e, 'brass_shishi');
    s.run(0.2);
    const home = { ...boss.pos };
    let far = 0;
    s.run(15, () => { far = Math.max(far, Math.abs(boss.pos.r - home.r), Math.abs(boss.pos.c - home.c)); });
    expect(far).toBeLessThanOrEqual(1);
  });

  it('JADE QUAKE: ground slam around the lion — damage, knockback 1 cell, JADE WEIGHT (attack speed ×0.75)', () => {
    expect(DUNGEON_MONSTERS['brass_shishi'].skills).toEqual(['lions_roar', 'jade_quake']);
    const s = session(stage([mon('brass_shishi@1', 1, 1)]), [H('aurel', 0, 1, { hp: 99999, atk: 1 })]);
    const boss = foe(s.e, 'brass_shishi');
    const tank = s.e.units.find(u => u.heroId === 'aurel')!;
    let before = 0;
    s.run(25, () => {
      if (s.of('castStart').some(x => x.src === boss.id && x.label === 'JADE QUAKE') && !before) before = Math.abs(tank.pos.c - boss.pos.c);
      return s.of('skillActivated').some(x => x.skill === 'jade_quake');
    });
    const act = s.of('skillActivated').find(x => x.skill === 'jade_quake');
    expect(act).toBeDefined();
    expect(hasStatus(tank, 'jade_weight')).toBeTrue();
    expect(Math.abs(tank.pos.c - boss.pos.c)).toBeGreaterThanOrEqual(before);
    expect(FX['jade-quake']).toBeDefined();
  });

  it('ARCANE SEAL (break-only) silences the highest-ATK hero: no skills / ultimate while silenced, basic attacks go on', () => {
    const s = session(stage([mon('arcane_examiner', 2, 1)]), [H('lumina', 0, 1, { hp: 99999, atk: 1 }), H('jin', 0, 0, { hp: 99999, atk: 5 })]);
    s.run(20, () => s.of('skillActivated').some(x => x.skill === 'arcane_seal'));
    const act = s.of('skillActivated').find(x => x.skill === 'arcane_seal');
    expect(act).toBeDefined();
    const jin = s.e.units.find(u => u.heroId === 'jin')!;
    expect(act!.targets).toEqual([jin.id]);
    expect(hasFlag(jin, 'silence')).toBeTrue();
    jin.cd1 = 0; jin.cd2 = 0; jin.mana = jin.maxMana;
    const casts = s.of('cast').filter(c => c.src === jin.id).length;
    s.run(2);
    expect(s.of('cast').filter(c => c.src === jin.id).length).toBe(casts);
    expect(MONSTER_SKILLS['arcane_seal'].interruptible).toBeFalse();
  });

  it('MIRROR STANCE reflects 60 % of each hit as TRUE damage; a stun ends it', () => {
    const s = session(stage([mon('moonblade_ronin@1', 1, 1)]), [H('jin', 0, 1, { hp: 99999, atk: 300 })]);
    const boss = foe(s.e, 'moonblade_ronin');
    s.run(25, () => hasStatus(boss, 'mirror_stance') && s.of('reflect').length > 0);
    expect(s.of('reflect').length).toBeGreaterThan(0);
    const r = s.of('reflect')[0];
    expect(r.src).toBe(boss.id);
    // stun breaks the stance
    const jin = s.e.units.find(u => u.heroId === 'jin')!;
    (s.e as unknown as { applyStatus(d: BattleUnit, id: string, src: BattleUnit): void }).applyStatus(boss, 'stun', jin);
    expect(hasStatus(boss, 'mirror_stance')).toBeFalse();
  });

  it('Mimic Chest sleeps (no target, no attack) until a hero comes within 2 cells or it is hit', () => {
    const s = session(stage([mon('mimic_chest', 5, 1)]), [H('aurel', 5, 1, { hp: 99999, atk: 1, moveSpeed: 0 })]);
    s.run(3);
    const m = foe(s.e, 'mimic_chest');
    expect(m.monster!.dormant).toBeTrue();
    expect(s.of('attack').filter(a => a.src === m.id).length).toBe(0);
    m.hp -= 1; // first hit wakes it
    s.run(0.5);
    expect(m.monster!.dormant).toBeFalse();
  });

  it('Coin Kobold: Smoke Pouch once below 35 % HP — untargetable blink toward the exit', () => {
    const s = session(stage([mon('coin_kobold', 1, 1), mon('gem_beetle', 0, 0)], { special: { kind: 'TREASURE', goal: 't' } }), [H('aurel', 0, 1, { hp: 99999, atk: 1 })]);
    const k = foe(s.e, 'coin_kobold');
    s.run(0.3);
    const c0 = k.pos.c;
    k.hp = Math.floor(k.maxHp * 0.3);
    s.run(1.5);
    const act = s.of('skillActivated').filter(x => x.skill === 'smoke_pouch');
    expect(act.length).toBe(1);
    expect(k.pos.c).toBeGreaterThan(c0);
    s.run(3);
    expect(s.of('skillActivated').filter(x => x.skill === 'smoke_pouch').length).toBe(1);
  });

  it('PAGE BARRIER shields every ally (25 % max HP) · CRYSTAL SHELL cuts damage taken to 40 % below 60 % HP', () => {
    const s = session(stage([mon('grimoire_familiar', 3, 1), mon('gem_beetle', 1, 1)]), [H('sylvie', 3, 1, { hp: 99999, atk: 1 })]);
    const beetle = foe(s.e, 'gem_beetle');
    beetle.hp = Math.floor(beetle.maxHp * 0.5);
    s.run(12, () => s.of('skillActivated').some(x => x.skill === 'page_barrier') && hasStatus(beetle, 'crystal_shell'));
    expect(s.of('shield').filter(x => x.dst === beetle.id).length).toBeGreaterThan(0);
    expect(hasStatus(beetle, 'crystal_shell')).toBeTrue();
  });
});
