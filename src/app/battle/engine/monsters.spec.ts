import { CLASS_BASE } from '../../core/data/classes';
import { ENEMIES } from '../../core/data/enemies';
import { attackWindupOf, castTimeline, MONSTER_SKILLS, MONSTERS } from '../../core/data/monsters';
import { SHEETS } from '../../core/data/sprites';
import { STAGES } from '../../core/data/stages';
import { newGameState } from '../../core/data/starter';
import { HeroClass } from '../../core/models/hero';
import { EnemyPlacement, StageDef } from '../../core/models/stage';
import { UnitSpec } from '../../core/models/unit';
import { teamToUnits } from '../../core/rules/team';
import { BattleEngine, BattleEvent, BattleUnit } from './battle-engine';
import { applyBuff, attackModifier, buffRemaining } from './buffs';
import { DamageResolver, effectiveAttack } from './damage-resolver';
import { distance } from './grid';

// ------------------------------------------------------------------ harness

const DT = 0.05;
type Ev = BattleEvent & { t: number };

/** hero: pos = { r: depth (0 = front), c: lane } */
const hero = (name: string, cls: HeroClass, depth: number, lane: number, o: Partial<UnitSpec['stats']> = {}): UnitSpec => ({
  name,
  cls,
  stats: { ...CLASS_BASE[cls], hp: 5000, ...o },
  pos: { r: depth, c: lane },
});
const mon = (enemy: string, depth: number, lane: number): EnemyPlacement => ({ enemy, r: depth, c: lane });
const stage = (enemies: EnemyPlacement[], rounds?: EnemyPlacement[][]): StageDef => ({
  floor: 1, mode: 'eliminate', timeLimit: 999, enemies, rounds,
});

function battle(allies: UnitSpec[], enemies: EnemyPlacement[], rounds?: EnemyPlacement[][]) {
  const e = new BattleEngine({ allies, stage: stage(enemies, rounds), enemyTemplates: ENEMIES, seed: 7 });
  const log: Ev[] = [];
  const run = (sec: number, each?: () => void) => {
    const n = Math.round(sec / DT);
    for (let i = 0; i < n && !e.result; i++) {
      e.step(DT);
      for (const ev of e.drainEvents()) log.push({ ...ev, t: e.time });
      each?.();
    }
  };
  /** heroes stand still and never act (castLock) — isolates monster behaviour */
  const freeze = () => e.units.filter(u => u.side === 'ally').forEach(u => (u.castLock = 1e9));
  const hero = (name: string) => e.units.find(u => u.side === 'ally' && u.name === name)!;
  const monsters = (id: string) => e.units.filter(u => u.monster?.definitionId === id);
  const of = <T extends BattleEvent['type']>(type: T) => log.filter(x => x.type === type) as (Ev & Extract<BattleEvent, { type: T }>)[];
  const kill = (u: BattleUnit) => (e as any).applyDamage(u, u.hp + u.shield + 1, false);
  const hit = (src: BattleUnit, dst: BattleUnit, kind: 'attack' | 'skill' | 'skill2' | 'ult') => (e as any).damage(src, dst, 0.01, false, kind);
  return { e, log, run, freeze, hero, monsters, of, kill, hit };
}

const targetSwitches = (seq: (number | null)[]) => seq.filter((v, i) => i > 0 && v !== seq[i - 1] && seq[i - 1] != null).length;

// ------------------------------------------------------------------ data & shared systems

describe('Forest monster data', () => {
  it('defines the Stage 1–3 roster with static, reusable definitions', () => {
    expect(Object.keys(MONSTERS)).toEqual(['forest_slime', 'goblin_fighter', 'goblin_archer', 'forest_wolf', 'alpha_wolf']);
    expect(MONSTERS['alpha_wolf'].rank).toBe('ELITE');
    for (const m of Object.values(MONSTERS)) {
      // stat windup must match the semantic animation event (single source of truth for timing)
      expect(attackWindupOf(m)).toBeCloseTo(m.stats.attackWindup, 5);
      expect(m.attack.damageType).toBe('PHYSICAL');
    }
  });

  it('slime DAMAGE event matches the sprite sheet hit frame (Row 5, Frame 5)', () => {
    const clip = MONSTERS['forest_slime'].animation.clips['attack'];
    const sheet = SHEETS['enemy-slime.png'].anims.attack!;
    expect(clip.row - 1).toBe(sheet.row);
    expect(clip.events![0].frame - 1).toBe(sheet.hit!);
  });

  it('DamageResolver: attack × 100/(100+def), min 1, rounded', () => {
    const a = { id: 1, atk: 18, rageMul: 1, buffs: [] };
    expect(DamageResolver.resolve({ attacker: a, target: { def: 5, taunt: 0 }, damageType: 'PHYSICAL', sourceId: 'x' }).amount).toBe(17);
    expect(DamageResolver.resolve({ attacker: a, target: { def: 5000, taunt: 0 }, damageType: 'PHYSICAL', sourceId: 'x' }).amount).toBe(1);
  });
});

// ------------------------------------------------------------------ required cases

describe('Stage 1–3 monsters', () => {
  it('1. Slime acquires the nearest reachable FRONT row hero (over a nearer back-row hero)', () => {
    const b = battle([hero('Tank', 'tank', 1, 2), hero('Healer', 'healer', 4, 0)], [mon('forest_slime', 0, 0)]);
    b.freeze();
    // drag the back-row healer right up to the slime — still back row, so the front tank is preferred
    const h = b.hero('Healer');
    b.e.grid.move(h.id, h.pos, { r: 0, c: 5 });
    h.pos = { r: 0, c: 5 };
    b.run(0.2);
    expect(b.monsters('forest_slime')[0].monster!.currentTargetId).toBe(b.hero('Tank').id);
  });

  it('2. Slime Body Slam damages only on its DAMAGE event', () => {
    const b = battle([hero('Tank', 'tank', 0, 1)], [mon('forest_slime', 0, 1)]);
    b.freeze();
    const tank = b.hero('Tank');
    let hpAtStart = -1;
    b.run(0.6, () => {
      if (hpAtStart < 0 && b.of('attack').length) hpAtStart = tank.hp;
    });
    const atk = b.of('attack')[0];
    const dmg = b.of('damage').find(d => d.dst === tank.id)!;
    const ev = b.of('animEvent').find(x => x.name === 'BODY_SLAM_DAMAGE')!;
    expect(hpAtStart).toBe(tank.maxHp); // attack started, no damage yet
    expect(dmg.t).toBe(ev.t);
    expect(dmg.t - atk.t).toBeGreaterThanOrEqual(0.34 - 1e-6);
    expect(dmg.t - atk.t).toBeLessThan(0.34 + DT + 1e-6);
  });

  it('3. Goblin Fighter never attacks from outside melee range', () => {
    const b = battle([hero('Tank', 'tank', 2, 1)], [mon('goblin_fighter', 3, 1)]);
    b.freeze();
    const g = b.monsters('goblin_fighter')[0];
    const tank = b.hero('Tank');
    const dists: number[] = [];
    let seen = 0;
    b.run(6, () => {
      const atks = b.of('attack');
      for (; seen < atks.length; seen++) dists.push(distance(g.pos, tank.pos));
    });
    expect(b.of('move').some(m => m.src === g.id)).toBeTrue(); // it had to walk first
    expect(dists.length).toBeGreaterThan(0);
    expect(dists.every(d => d <= MONSTERS['goblin_fighter'].stats.attackRange)).toBeTrue();
  });

  it('4. Goblin Fighter respects the frontline (tank blocks the healer behind it)', () => {
    const b = battle([hero('Tank', 'tank', 0, 1), hero('Healer', 'healer', 4, 1)], [mon('goblin_fighter', 0, 1)]);
    b.freeze();
    const g = b.monsters('goblin_fighter')[0];
    const targets = new Set<number | null>();
    b.run(6, () => targets.add(g.monster!.currentTargetId));
    targets.delete(null);
    expect([...targets]).toEqual([b.hero('Tank').id]);
    expect(b.hero('Healer').hp).toBe(b.hero('Healer').maxHp);
  });

  it('5. Goblin Archer can select a Back Row hero', () => {
    const b = battle([hero('Tank', 'tank', 0, 1), hero('Healer', 'healer', 4, 1)], [mon('goblin_fighter', 0, 1), mon('goblin_archer', 3, 1)]);
    b.freeze();
    b.hero('Healer').hp = b.hero('Healer').maxHp * 0.5;
    b.run(3);
    const a = b.monsters('goblin_archer')[0];
    expect(a.monster!.currentTargetId).toBe(b.hero('Healer').id);
    expect(b.of('projectileHit').some(h => h.dst === b.hero('Healer').id)).toBeTrue();
  });

  it('6. Archer prioritizes lowest HP percentage (not raw HP)', () => {
    const b = battle(
      [hero('Big', 'tank', 0, 0, { hp: 1000 }), hero('Small', 'archer', 3, 2, { hp: 200 })],
      [mon('goblin_archer', 2, 1)],
    );
    b.freeze();
    b.hero('Big').hp = 400; // 40%, raw 400
    b.hero('Small').hp = 150; // 75%, raw 150
    b.run(0.5);
    expect(b.monsters('goblin_archer')[0].monster!.currentTargetId).toBe(b.hero('Big').id);
  });

  it('7. Archer does not target-flicker when two heroes trade 1% HP back and forth', () => {
    const b = battle([hero('A', 'fighter', 0, 0, { hp: 1000 }), hero('B', 'fighter', 0, 2, { hp: 1000 })], [mon('goblin_archer', 2, 1)]);
    b.freeze();
    const [A, B] = [b.hero('A'), b.hero('B')];
    const arch = b.monsters('goblin_archer')[0];
    const seq: (number | null)[] = [];
    let flip = false;
    b.run(4, () => {
      flip = !flip;
      A.hp = flip ? 500 : 510;
      B.hp = flip ? 510 : 500;
      seq.push(arch.monster!.currentTargetId);
    });
    expect(targetSwitches(seq)).toBeLessThanOrEqual(1);
  });

  it('8. Arrow damage happens on collision, not at PROJECTILE_SPAWN', () => {
    const b = battle([hero('Healer', 'healer', 4, 1)], [mon('goblin_archer', 0, 1)]);
    b.freeze();
    const h = b.hero('Healer');
    let hpAtSpawn = -1;
    let flying = 0;
    b.run(2, () => {
      if (hpAtSpawn < 0 && b.of('animEvent').some(x => x.event === 'PROJECTILE_SPAWN')) {
        hpAtSpawn = h.hp;
        flying = b.e.projectiles.length;
      }
    });
    const spawn = b.of('animEvent').find(x => x.event === 'PROJECTILE_SPAWN')!;
    const hitEv = b.of('projectileHit')[0];
    const dmg = b.of('damage').find(d => d.dst === h.id)!;
    expect(hpAtSpawn).toBe(h.maxHp);
    expect(flying).toBe(1);
    expect(hitEv.t).toBeGreaterThan(spawn.t);
    expect(dmg.t).toBe(hitEv.t);
  });

  it('9. An arrow damages one hero and disappears (a hero in the way is not hit)', () => {
    const b = battle([hero('Tank', 'tank', 0, 1), hero('Healer', 'healer', 5, 1)], [mon('goblin_archer', 1, 1)]);
    b.freeze();
    b.hero('Healer').hp = 1000;
    let firstHitAt = -1;
    let leftAfterHit = -1;
    b.run(1.5, () => {
      if (firstHitAt < 0 && b.of('projectileHit').length) {
        firstHitAt = b.e.time;
        leftAfterHit = b.e.projectiles.length;
      }
    });
    const pid = b.of('projectileHit')[0].pid;
    expect(b.of('projectileHit').filter(h => h.pid === pid).length).toBe(1);
    expect(leftAfterHit).toBe(0);
    expect(b.hero('Tank').hp).toBe(b.hero('Tank').maxHp);
  });

  it('10. Forest Wolf reaches its target faster than Goblin Fighter', () => {
    const firstAttack = (id: string) => {
      const b = battle([hero('Tank', 'tank', 5, 1)], [mon(id, 5, 1)]);
      b.freeze();
      b.run(10);
      return b.of('attack')[0].t;
    };
    expect(firstAttack('forest_wolf')).toBeLessThan(firstAttack('goblin_fighter') * 0.7);
  });

  it('11. Wolf Bite damages only on its DAMAGE event', () => {
    const b = battle([hero('Tank', 'tank', 0, 1)], [mon('forest_wolf', 0, 1)]);
    b.freeze();
    b.run(0.6);
    const atk = b.of('attack')[0];
    const bite = b.of('animEvent').find(x => x.name === 'BITE_DAMAGE')!;
    const dmg = b.of('damage')[0];
    expect(dmg.t).toBe(bite.t);
    expect(dmg.t - atk.t).toBeGreaterThanOrEqual(0.255 - 1e-6);
  });

  // ---- Alpha Wolf / cast / interrupt / buff

  const pack = () => {
    const b = battle([hero('Tank', 'tank', 5, 1), hero('Archer', 'archer', 5, 0)], [mon('alpha_wolf', 1, 1), mon('forest_wolf', 0, 0), mon('forest_wolf', 0, 2)]);
    b.freeze();
    const alpha = b.monsters('alpha_wolf')[0];
    const wolves = b.monsters('forest_wolf');
    return { ...b, alpha, wolves };
  };
  const runUntil = (b: ReturnType<typeof pack>, cond: () => boolean, max = 10) => {
    for (let t = 0; t < max && !cond(); t += DT) b.run(DT);
  };

  it('12 + 13. Alpha casts Howl no sooner than 2 s after spawn, with an interruptible cast bar', () => {
    const b = pack();
    runUntil(b, () => !!b.alpha.casting);
    const start = b.of('castStart')[0];
    expect(start.label).toBe('ALPHA HOWL');
    expect(start.interruptible).toBeTrue();
    expect(start.castTime).toBe(2);
    expect(start.t).toBeGreaterThanOrEqual(2 - 1e-6);
    expect(b.alpha.monster!.state).toBe('CASTING');
    expect(b.alpha.casting!.def.id).toBe('alpha_howl');
  });

  it('14. Normal damage does not interrupt Howl', () => {
    const b = pack();
    runUntil(b, () => !!b.alpha.casting);
    const fighter = b.hero('Tank');
    b.hit(fighter, b.alpha, 'attack');
    b.hit(fighter, b.alpha, 'skill'); // tank skill 1 (taunt) is not an interrupt
    b.run(DT);
    expect(b.alpha.casting).not.toBeNull();
    expect(b.alpha.monster!.state).toBe('CASTING');
    expect(b.of('damage').filter(d => d.dst === b.alpha.id).every(d => !d.hurt)).toBeTrue();
  });

  it('15 + 16. A valid interrupt cancels Howl, no buff, full cooldown, RECOVERING', () => {
    const b = pack();
    runUntil(b, () => !!b.alpha.casting);
    b.hit(b.hero('Tank'), b.alpha, 'skill2'); // shield charge: interrupt = true
    expect(b.alpha.casting).toBeNull();
    expect(b.alpha.monster!.state).toBe('RECOVERING');
    expect(b.alpha.castSkills[0].cd).toBe(12);
    b.run(DT);
    expect(b.of('interrupt').length).toBe(1);
    b.run(3);
    expect(b.of('buff').length).toBe(0);
    expect(b.of('skillActivated').length).toBe(0);
    expect([b.alpha, ...b.wolves].every(w => w.buffs.length === 0)).toBeTrue();
  });

  it('17 + 18. Successful Howl buffs living allied wolves (+25% effective attack)', () => {
    const b = pack();
    runUntil(b, () => !!b.alpha.casting);
    b.kill(b.wolves[1]); // dies during the cast → not buffed
    runUntil(b, () => b.of('skillActivated').length > 0);
    const act = b.of('skillActivated')[0];
    expect(act.targets.sort()).toEqual([b.alpha.id, b.wolves[0].id].sort());
    expect(b.of('animEvent').some(x => x.name === 'ALPHA_HOWL_ACTIVATED')).toBeTrue();
    const w = b.wolves[0];
    expect(effectiveAttack(w)).toBeCloseTo(w.atk * 1.25, 6);
    expect(b.wolves[1].buffs.length).toBe(0);
    // resolved damage goes up by 25% too (def 0 target)
    const base = DamageResolver.resolve({ attacker: { ...w, buffs: [] }, target: { def: 0, taunt: 0 }, damageType: 'PHYSICAL', sourceId: 'x' });
    const buffed = DamageResolver.resolve({ attacker: w, target: { def: 0, taunt: 0 }, damageType: 'PHYSICAL', sourceId: 'x' });
    expect(buffed.amount).toBe(Math.round(base.amount * 1.25));
  });

  it('19. Howl buff expires after 10 seconds', () => {
    const b = pack();
    runUntil(b, () => b.of('skillActivated').length > 0);
    const w = b.wolves[0];
    b.run(9.8);
    expect(buffRemaining(w, 'alpha_howl_buff')).toBeGreaterThan(0);
    b.run(0.4);
    expect(buffRemaining(w, 'alpha_howl_buff')).toBe(0);
    expect(effectiveAttack(w)).toBe(w.atk);
    expect(b.of('buffEnd').some(x => x.dst === w.id)).toBeTrue();
  });

  it('20. Repeated Howl refreshes duration instead of stacking multiplicatively', () => {
    const b = pack();
    runUntil(b, () => b.of('skillActivated').length > 0);
    b.run(3);
    const w = b.wolves[0];
    w.buffs[0].remaining = 1; // a pack member's buff is about to run out → recast is worth it
    b.alpha.castSkills[0].cd = 0;
    runUntil(b, () => b.of('skillActivated').length > 1, 4);
    const a = b.alpha; // still had ~5 s of buff → refreshed, not stacked
    expect(a.buffs.length).toBe(1);
    expect(attackModifier(a)).toBeCloseTo(1.25, 6);
    expect(buffRemaining(a, 'alpha_howl_buff')).toBeGreaterThan(9.8);
    expect(b.of('buff').filter(x => x.dst === a.id).map(x => x.refreshed)).toEqual([false, true]);
    // and the helper itself: refresh never stacks
    const u = { buffs: [] as any[] };
    applyBuff(u, { id: 'x', name: 'x', duration: 10, stackPolicy: 'REFRESH_DURATION', modifiers: { attackMultiplier: 1.25 } }, 1);
    applyBuff(u, { id: 'x', name: 'x', duration: 10, stackPolicy: 'REFRESH_DURATION', modifiers: { attackMultiplier: 1.25 } }, 1);
    expect(attackModifier(u)).toBeCloseTo(1.25, 6);
  });

  it('Howl is not recast while the pack buff has more than 2 s left', () => {
    const b = pack();
    runUntil(b, () => b.of('skillActivated').length > 0);
    b.alpha.castSkills[0].cd = 0;
    b.run(1);
    expect(b.of('castStart').length).toBe(1);
  });

  it('21. Alpha dying mid-cast cancels Howl (no activation, bar hidden, FX stopped)', () => {
    const b = pack();
    runUntil(b, () => !!b.alpha.casting);
    b.run(1.8); // FX already started (it leads the activation)
    expect(b.of('fx').length).toBe(1);
    b.kill(b.alpha);
    b.run(1);
    expect(b.of('castCancel')[0].reason).toBe('death');
    expect(b.of('fxStop').length).toBe(1);
    expect(b.of('skillActivated').length).toBe(0);
    expect(b.wolves.every(w => w.buffs.length === 0)).toBeTrue();
    expect(b.alpha.casting).toBeNull();
  });

  it('22. An applied Howl buff stays after the Alpha dies', () => {
    const b = pack();
    runUntil(b, () => b.of('skillActivated').length > 0);
    b.kill(b.alpha);
    b.run(1);
    expect(buffRemaining(b.wolves[0], 'alpha_howl_buff')).toBeGreaterThan(8);
  });

  // ---- death, retargeting, stability

  it('23. Dead monsters cannot attack (a swing in progress is cancelled)', () => {
    const b = battle([hero('Tank', 'tank', 0, 1)], [mon('forest_slime', 0, 1)]);
    b.freeze();
    const slime = b.monsters('forest_slime')[0];
    runUntilAttack: for (let i = 0; i < 40; i++) {
      b.run(DT);
      if (b.of('attack').length) break runUntilAttack;
    }
    b.kill(slime);
    b.run(3);
    expect(b.hero('Tank').hp).toBe(b.hero('Tank').maxHp);
    expect(b.of('attack').filter(a => a.src === slime.id).length).toBe(1);
    expect(slime.monster!.state).toBe('DEAD');
  });

  it('24. Dead monsters cannot be targeted', () => {
    const b = battle([hero('Archer', 'archer', 3, 1, { atk: 5 })], [mon('forest_slime', 0, 1), mon('goblin_fighter', 0, 0)]);
    const slime = b.monsters('forest_slime')[0];
    b.kill(slime);
    expect(slime.targetable).toBeFalse();
    expect(slime.monster!.isTargetable).toBeFalse();
    const archer = b.hero('Archer');
    const aimed: (number | null)[] = [];
    b.run(3, () => aimed.push(archer.targetId));
    expect(aimed.includes(slime.id)).toBeFalse();
    expect(b.e.isValidTarget(archer, slime)).toBeFalse();
  });

  it('25. Monster retargets automatically when its hero dies', () => {
    const b = battle([hero('Tank', 'tank', 0, 1), hero('Fighter', 'fighter', 0, 0)], [mon('forest_slime', 0, 1)]);
    b.freeze();
    const slime = b.monsters('forest_slime')[0];
    b.run(0.5);
    expect(slime.monster!.currentTargetId).toBe(b.hero('Tank').id);
    b.kill(b.hero('Tank'));
    b.run(DT);
    expect(slime.monster!.currentTargetId).not.toBe(b.hero('Tank').id); // cleared at once
    b.run(1);
    expect(slime.monster!.currentTargetId).toBe(b.hero('Fighter').id);
  });

  it('26. Battle continues when several monsters die in the same tick', () => {
    const b = battle([hero('Tank', 'tank', 0, 1, { atk: 400 })], [mon('forest_slime', 0, 0), mon('forest_slime', 0, 1), mon('forest_slime', 0, 2)], [
      [mon('goblin_fighter', 0, 1)],
    ]);
    b.run(0.2);
    for (const s of b.monsters('forest_slime')) b.kill(s);
    expect(() => b.run(20)).not.toThrow();
    expect(b.of('advance').length).toBe(1);
    expect(b.e.result).toBe('win');
  });

  it('27. Melee monsters do not flicker between equally good targets', () => {
    const b = battle([hero('A', 'fighter', 0, 0), hero('B', 'fighter', 0, 2)], [mon('forest_slime', 0, 1), mon('forest_wolf', 1, 1)]);
    b.freeze();
    const seqs = [b.monsters('forest_slime')[0], b.monsters('forest_wolf')[0]].map(m => {
      const seq: (number | null)[] = [];
      return { m, seq };
    });
    b.run(6, () => seqs.forEach(s => s.seq.push(s.m.monster!.currentTargetId)));
    for (const s of seqs) expect(targetSwitches(s.seq)).toBe(0);
  });

  it('28. No movement jitter at attack / preferred range', () => {
    const b = battle([hero('Tank', 'tank', 0, 1), hero('Healer', 'healer', 4, 1)], [mon('goblin_archer', 5, 1), mon('goblin_fighter', 5, 0)]);
    b.freeze();
    const cols = new Map<number, number[]>();
    b.run(8, () => b.e.units.filter(u => u.monster).forEach(u => cols.set(u.id, [...(cols.get(u.id) ?? []), u.pos.c])));
    for (const seq of cols.values()) {
      const steps = seq.map((c, i) => (i ? Math.sign(c - seq[i - 1]) : 0)).filter(x => x !== 0);
      const reversals = steps.filter((x, i) => i > 0 && x !== steps[i - 1]).length;
      expect(reversals).toBeLessThanOrEqual(1); // archer may take at most one small step back
    }
  });

  it('29. Alpha Howl character animation and FX line up at activation', () => {
    const skill = MONSTER_SKILLS['alpha_howl'];
    const tl = castTimeline(skill, MONSTERS['alpha_wolf'].animation);
    expect(tl.startFrame).toBe(2);
    expect(tl.activateFrame).toBe(5);
    expect(tl.characterActivation).toBeCloseTo(skill.castTime, 6);
    expect(tl.fxActivation!).toBeCloseTo(skill.castTime, 6);
    // engine: FX event fires at its lead time, activation exactly castTime after CAST_STARTED
    const b = pack();
    runUntil(b, () => b.of('skillActivated').length > 0);
    const start = b.of('castStart')[0].t;
    expect(b.of('fx')[0].t - start).toBeCloseTo(tl.fxStart!, 1);
    expect(b.of('skillActivated')[0].t - start).toBeCloseTo(skill.castTime, 1);
    expect(b.of('castProgress').map(p => p.pct)).toEqual([0.25, 0.5, 0.75]);
  });

  it('30. Stage 1–3 run from start to victory without runtime errors', () => {
    const s = newGameState();
    const allies = teamToUnits(s.team, s.heroes);
    for (const st of STAGES.slice(0, 3)) {
      for (let seed = 1; seed <= 5; seed++) {
        const e = new BattleEngine({ allies, stage: st, enemyTemplates: ENEMIES, seed, autoUlt: true });
        expect(e.run()).withContext(`${st.name} seed ${seed}`).toBe('win');
      }
    }
  });

  it('hit reactions are rate-limited (no stun-lock) and elites flinch less', () => {
    const b = battle([hero('Tank', 'tank', 5, 1)], [mon('goblin_fighter', 5, 1), mon('alpha_wolf', 5, 0)]);
    b.freeze();
    b.run(0.3);
    const g = b.monsters('goblin_fighter')[0];
    const tank = b.hero('Tank');
    for (let i = 0; i < 6; i++) {
      b.hit(tank, g, 'attack');
      b.run(0.1);
    }
    const reactions = b.of('damage').filter(d => d.dst === g.id && d.hurt).length;
    expect(reactions).toBeLessThanOrEqual(1);
    expect(MONSTERS['alpha_wolf'].stats.minHitReactionInterval).toBeGreaterThan(MONSTERS['goblin_fighter'].stats.minHitReactionInterval);
  });
});
