import { TacticalBot } from './bots/tactical-bot';
import { HERO_BY_ID } from '../../core/data/heroes';
import { CLASS_KITS, kitOf } from '../../core/data/hero-skills';
import { ENEMIES } from '../../core/data/enemies';
import { MONSTERS } from '../../core/data/monsters';
import { STATUS_EFFECTS } from '../../core/data/status-effects';
import { STARTER_BENCH, STARTER_TEAM } from '../../core/data/starter';
import { animTiming } from '../../core/data/sprites';
import { SkillSlot } from '../../core/models/combat';
import { Cell } from '../../core/models/unit';
import { heroStats } from '../../core/rules/stats';
import { rankedKit, skillLines } from '../../core/rules/skill-ranks';
import { BattleEngine, BattleUnit } from './battle-engine';
import { applyBuff, hasStatus, modifier, tickStatuses } from './buffs';
import { DamageResolver } from './damage-resolver';
import { repeatHit } from './skill-system';

describe('Vaelric — Phantom Executioner, provisional Phase A', () => {
  const kit = () => kitOf('vaelric', 'assassin');
  function battle(count = 3) {
    const t = HERO_BY_ID['vaelric'];
    const e = new BattleEngine({
      allies: [{ name: t.name, cls: t.cls, heroId: t.id, sprite: t.sprite, pos: { r: 3, c: 1 },
        stats: { ...heroStats(t, { uid: 1, templateId: t.id, level: 1, potential: 'B' }), hp: 10000 } }],
      stage: { floor: 1, mode: 'eliminate', timeLimit: 999,
        enemies: Array.from({ length: count }, (_, i) => ({ enemy: 'forest_slime', r: i % 3, c: 1 })) },
      enemyTemplates: ENEMIES, monsters: { ...MONSTERS }, seed: 7,
    });
    const freeze = () => e.units.forEach(u => { u.castLock = 1e6; u.cd1 = u.cd2 = 1e6; });
    freeze(); e.step(0.05);
    const caster = e.units.find(u => u.heroId === 'vaelric')!;
    const foes = e.units.filter(u => u.side === 'enemy' && u.alive);
    const place = (u: BattleUnit, p: Cell) => {
      e.grid.move(u.id, u.pos, p); u.pos = { ...p }; u.x = p.c; u.y = p.r;
    };
    place(caster, { r: 1, c: 5 });
    foes.forEach((f, i) => { f.hp = f.maxHp = 1e6; place(f, { r: i % 3, c: 6 }); });
    const run = (s: number) => { for (let i = 0; i < Math.round(s / .05); i++) { freeze(); e.step(.05); } };
    const use = (slot: SkillSlot) => e.skills.use(caster, slot, kit()[slot], foes[0]);
    const kill = (u: BattleUnit) => (e as unknown as { applyDamage(t: BattleUnit, n: number, crit: boolean): void })
      .applyDamage(u, u.hp + u.shield + 1, false);
    e.drainEvents();
    return { e, caster, foes, place, run, use, kill };
  }

  it('uses Assassin progression without adding the hero to existing starter saves', () => {
    expect(HERO_BY_ID['vaelric'].cls).toBe('assassin');
    expect([kit().skill.id, kit().skill2.id, kit().ult.id])
      .toEqual([CLASS_KITS.assassin.skill.id, CLASS_KITS.assassin.skill2.id, CLASS_KITS.assassin.ult.id]);
    expect(STARTER_TEAM).not.toContain('vaelric'); expect(STARTER_BENCH).not.toContain('vaelric');
  });

  it('Phantom Draw deals one contact hit and no projectile', () => {
    const b = battle(); b.use('attack'); b.run(.25);
    expect(b.foes.every(f => f.hp === 1e6)).toBeTrue();
    b.run(.65);
    const ev = b.e.drainEvents();
    expect(ev.filter(x => x.type === 'damage').length).toBe(1);
    expect(ev.some(x => x.type === 'projectile')).toBeFalse();
  });

  it('Phantom Crossing holds damage during the dash, marks stacked crossed foes once and lands at start+3', () => {
    const b = battle(); b.place(b.foes[0], { r: 1, c: 6 }); b.place(b.foes[1], { r: 1, c: 6 }); b.place(b.foes[2], { r: 1, c: 7 });
    b.use('skill'); b.run(.3);
    expect(b.caster.pos).toEqual({ r: 1, c: 8 });
    expect(b.caster.x).toBeCloseTo(5, 7);
    b.run(.25);
    expect(b.foes.every(f => f.hp === 1e6)).toBeTrue();
    const early = b.e.drainEvents();
    expect(early.filter(e => e.type === 'dashMark').length).toBe(3);
    expect(early.some(e => e.type === 'damage')).toBeFalse();
    b.run(.05);
    expect(b.caster.x).toBeCloseTo(8, 7);
    expect(b.caster.dashMotion).toBeUndefined();
    const contact = b.e.drainEvents();
    expect(contact.filter(e => e.type === 'damage').length).toBe(3);
    expect(contact.filter(e => e.type === 'impact').length).toBe(1);
    expect(b.foes.every(f => !hasStatus(f, 'bleed'))).toBeTrue();
    b.run(.1);
    const burst = b.e.drainEvents();
    expect(burst.filter(e => e.type === 'damage').length).toBe(6);
    expect(burst.filter(e => e.type === 'impact').map(e => e.type === 'impact' ? e.index : -1)).toEqual([1, 2]);
    b.run(1);
    expect(b.e.drainEvents().some(e => e.type === 'damage')).toBeFalse();
  });

  it('splits the original total coefficient equally across three smaller contacts, with one full Impact playback', () => {
    const s = kit().skill;
    const multipliers = [0, 1, 2].map(i => {
      const d = repeatHit(s, i).effects.find(e => e.type === 'DAMAGE')!;
      return d.type === 'DAMAGE' ? d.primary : 0;
    });
    expect(s.repeat?.count).toBe(3); expect(s.repeat?.gap).toBe(.05);
    multipliers.forEach(m => expect(m).toBeCloseTo(2.2 / 3, 8));
    expect(multipliers.reduce((a, b) => a + b, 0)).toBeCloseTo(2.2, 8);
  });

  it('does not replace dead marked targets or continue the burst after caster death', () => {
    for (const killCaster of [false, true]) {
      const b = battle();
      b.place(b.foes[0], { r: 1, c: 6 }); b.place(b.foes[1], { r: 0, c: 6 });
      b.use('skill'); b.run(.6); b.e.drainEvents();
      b.kill(killCaster ? b.caster : b.foes[0]); b.e.drainEvents(); b.run(.5);
      expect(b.e.drainEvents().some(e => e.type === 'damage')).toBeFalse();
    }
  });

  it('dash mirrors the same three-cell route and keeps facing through the entire recovery', () => {
    const b = battle(); b.place(b.caster, { r: 1, c: 8 }); b.place(b.foes[0], { r: 1, c: 7 });
    b.use('skill'); expect(b.caster.actionFacing?.left).toBeTrue(); b.run(.6);
    expect(b.caster.pos.c).toBe(5); expect(b.caster.x).toBeCloseTo(5, 7);
    expect(b.caster.actionFacing?.left).toBeTrue(); b.run(.5);
    expect(b.caster.actionFacing?.left).toBeTrue(); b.run(.05);
    expect(b.caster.actionFacing).toBeUndefined(); expect(b.caster.targetId).toBe(b.foes[0].id);
  });

  it('invalid edge routes do not leave the board or damage untraversed enemies', () => {
    for (const [from, to] of [[14, 15], [1, 0]]) {
      const b = battle(); b.place(b.caster, { r: 1, c: from }); b.place(b.foes[0], { r: 1, c: to });
      b.use('skill'); b.run(.6);
      expect(b.caster.pos.c).toBe(from);
      expect(b.e.drainEvents().some(e => e.type === 'damage' || e.type === 'dashMark')).toBeFalse();
    }
  });

  it('blocked landing shortens along the same lane and excludes the landing cell from marks', () => {
    const b = battle(); b.place(b.foes[0], { r: 1, c: 6 }); b.place(b.foes[1], { r: 1, c: 8 }); b.place(b.foes[2], { r: 0, c: 7 });
    b.use('skill'); b.run(.6);
    expect(b.caster.pos).toEqual({ r: 1, c: 7 });
    expect(b.foes.map(f => f.hp < 1e6)).toEqual([true, false, false]);
  });

  it('a marked enemy moving forward is not marked twice; its live mark follows the enemy, not its old cell', () => {
    const b = battle(); b.place(b.foes[0], { r: 1, c: 6 }); b.place(b.foes[1], { r: 1, c: 7 });
    b.use('skill'); b.run(.45);
    b.place(b.foes[0], { r: 1, c: 7 }); b.run(.1); b.place(b.foes[0], { r: 1, c: 12 }); b.run(.05);
    const events = b.e.drainEvents();
    expect(events.filter(e => e.type === 'dashMark' && e.dst === b.foes[0].id).length).toBe(1);
    expect(events.filter(e => e.type === 'damage' && e.dst === b.foes[0].id).length).toBe(1);
    expect(b.foes[2].hp).toBe(1e6); // different lane
  });

  it('dead or untargetable marks are skipped at F9 without retargeting', () => {
    const b = battle(); b.place(b.foes[0], { r: 1, c: 6 }); b.place(b.foes[1], { r: 1, c: 7 });
    b.use('skill'); b.run(.55); b.kill(b.foes[0]);
    applyBuff(b.foes[1], STATUS_EFFECTS['untargetable'], b.foes[1].id); b.e.drainEvents(); b.run(.1);
    expect(b.e.drainEvents().some(e => e.type === 'damage')).toBeFalse();
  });

  it('death or encounter teardown during F8 cancels motion, pending damage and the loop lifetime', () => {
    for (const die of [true, false]) {
      const b = battle(); b.place(b.foes[0], { r: 1, c: 6 }); b.use('skill'); b.run(.35); b.e.drainEvents();
      if (die) b.kill(b.caster);
      else (b.e as unknown as { quiesce(reason: 'advance'): void }).quiesce('advance');
      expect(b.caster.dashMotion).toBeUndefined(); expect(b.caster.actionFacing).toBeUndefined();
      expect(b.e.drainEvents().some(e => e.type === 'animEvent' && e.event === 'DASH_END')).toBeTrue();
      b.run(2); expect(b.e.drainEvents().some(e => e.type === 'damage')).toBeFalse();
    }
  });

  it('path targeting chooses only a crossed enemy on the same lane, not diagonal or landing-cell enemies', () => {
    const b = battle(); b.place(b.foes[0], { r: 0, c: 6 }); b.place(b.foes[1], { r: 1, c: 8 }); b.place(b.foes[2], { r: 1, c: 7 });
    expect(b.e.skills.pickTarget(b.caster, kit().skill, b.foes[0])).toBe(b.foes[2]);
  });

  it('Hollow Requiem hits all six front cells including stacked foes exactly at .40/.65/.90, with Curse only on hit3', () => {
    for (const direction of [1, -1]) {
      const b = battle(9); const start = direction === 1 ? 5 : 8;
      b.place(b.caster, { r: 1, c: start });
      const cells = [
        { r: 1, c: start + direction }, { r: 0, c: start + direction }, { r: 2, c: start + direction },
        { r: 1, c: start + 2 * direction }, { r: 0, c: start + 2 * direction }, { r: 2, c: start + 2 * direction },
        { r: 1, c: start + direction }, { r: 1, c: start }, { r: 1, c: start + 3 * direction },
      ];
      b.foes.forEach((f, i) => b.place(f, cells[i])); b.use('skill2'); b.run(.35);
      expect(b.foes.every(f => f.hp === 1e6)).toBeTrue();
      for (const gap of [.05, .25, .25]) {
        b.run(gap);
        const events = b.e.drainEvents();
        expect(events.filter(e => e.type === 'damage').map(e => e.type === 'damage' ? e.dst : -1).sort())
          .toEqual(b.foes.slice(0, 7).map(f => f.id).sort());
        expect(b.caster.pos).toEqual({ r: 1, c: start });
      }
      expect(b.foes.map(f => hasStatus(f, 'curse_mark'))).toEqual([true,true,true,true,true,true,true,false,false]);
      b.run(.6); expect(b.e.drainEvents().some(e => e.type === 'damage')).toBeFalse();
      expect(b.caster.skillAction).toBeUndefined(); expect(b.caster.actionFacing).toBeUndefined();
    }
  });

  it('S2 re-detects occupants on each hit while its area stays forward when the original target moves behind', () => {
    const b = battle(); b.place(b.foes[0], { r: 1, c: 6 }); b.place(b.foes[1], { r: 0, c: 12 });
    b.use('skill2'); b.run(.4); b.e.drainEvents();
    b.place(b.foes[0], { r: 1, c: 4 }); b.place(b.foes[1], { r: 0, c: 7 }); b.run(.25);
    expect(b.e.drainEvents().filter(e => e.type === 'damage').map(e => e.type === 'damage' ? e.dst : -1)).toEqual([b.foes[1].id, b.foes[2].id]);
    expect(b.caster.actionFacing?.left).toBeFalse();
    b.run(.55); expect(b.caster.actionFacing?.left).toBeFalse(); b.run(.05);
    expect(b.caster.actionFacing).toBeUndefined(); expect(b.caster.targetId).toBe(b.foes[0].id);
  });

  it('S2 continues its full animation after an empty area or a dead original target, hitting remaining occupants', () => {
    const b = battle(); b.place(b.foes[0], { r: 1, c: 6 }); b.use('skill2'); b.kill(b.foes[0]); b.e.drainEvents();
    b.run(.9);
    expect(b.e.drainEvents().filter(e => e.type === 'damage').length).toBe(6);
    b.place(b.foes[1], { r: 0, c: 12 }); b.place(b.foes[2], { r: 2, c: 12 }); b.run(.35);
    expect(b.caster.skillAction).toBeUndefined();
    const empty = battle(); empty.use('skill2'); empty.foes.forEach(f => empty.place(f, { r: 1, c: 12 })); empty.run(1.25);
    const events = empty.e.drainEvents();
    expect(events.some(e => e.type === 'damage')).toBeFalse();
    expect(events.some(e => e.type === 'animEvent' && e.event === 'ANIMATION_END')).toBeTrue();
    expect(events.some(e => e.type === 'move' || e.type === 'blink' || (e.type === 'animEvent' && e.event === 'DASH_START'))).toBeFalse();
  });

  it('S2 applies DEF Down only to successful third-event hits and skips untargetable occupants', () => {
    const b = battle(); b.place(b.foes[0], { r: 1, c: 6 }); b.use('skill2'); b.run(.65);
    expect(b.foes.every(f => !hasStatus(f, 'curse_mark'))).toBeTrue();
    applyBuff(b.foes[0], STATUS_EFFECTS['untargetable'], b.foes[0].id); b.e.drainEvents(); b.run(.25);
    expect(hasStatus(b.foes[0], 'curse_mark')).toBeFalse();
    expect(b.foes.slice(1).every(f => hasStatus(f, 'curse_mark'))).toBeTrue();
  });

  it('a dedicated interrupt cancels S2 damage/recovery callbacks, while plain stun does not interrupt it', () => {
    const b = battle(); b.use('skill2'); b.run(.4); b.e.drainEvents();
    b.e.skills.applyEffects(b.foes[0], { ...kit().skill2, effects: [{ type: 'INTERRUPT', area: 'SINGLE' }] }, 'skill2', b.caster, b.caster.pos);
    const interrupt = b.e.drainEvents();
    expect(interrupt.some(e => e.type === 'CAST_INTERRUPTED' && e.dst === b.caster.id)).toBeTrue();
    expect(b.caster.skillAction).toBeUndefined(); expect(b.caster.actionFacing).toBeUndefined();
    b.run(2); expect(b.e.drainEvents().some(e => e.type === 'damage' || e.type === 'animEvent')).toBeFalse();
    const c = battle(); c.use('skill2'); c.run(.2); applyBuff(c.caster, STATUS_EFFECTS['stun'], c.foes[0].id); c.run(.8);
    expect(c.e.drainEvents().filter(e => e.type === 'damage').length).toBe(9); // three occupants, three hits
  });

  it('curse refresh never compounds DEF reduction, does not mutate stats and expires normally', () => {
    const b = battle(); const f = b.foes[0]; const original = f.def;
    const damage = (type: 'PHYSICAL' | 'MAGIC' | 'TRUE') => DamageResolver.resolve({
      attacker: b.caster, target: f, baseDamage: 10000, damageType: type, sourceId: 'test',
    }).amount;
    const before = damage('PHYSICAL');
    applyBuff(f, STATUS_EFFECTS['curse_mark'], b.caster.id);
    expect(damage('PHYSICAL')).toBeGreaterThan(before);
    expect(damage('MAGIC')).toBe(damage('PHYSICAL')); // explicit magicDefense absent: same DEF fallback
    expect(damage('TRUE')).toBe(10000);
    expect(DamageResolver.resolve({ attacker: b.caster, target: { ...f, magicDefense: 100 },
      baseDamage: 10000, damageType: 'MAGIC', sourceId: 'test' }).amount).toBe(5000);
    applyBuff(f, STATUS_EFFECTS['curse_mark'], 999);
    expect(modifier(f, 'defenseMultiplier')).toBe(.8);
    expect(f.buffs.filter(x => x.def.id === 'curse_mark').length).toBe(1);
    expect(f.def).toBe(original);
    tickStatuses(f, 4);
    expect(damage('PHYSICAL')).toBe(before);
  });

  it('V5 acquires within Chebyshev3 before retreat, blinks once and keeps its locked target beyond range', () => {
    for(const direction of [1,-1]) {
      const b=battle(),start=direction>0?5:8;
      b.place(b.caster,{r:1,c:start});b.place(b.foes[0],{r:1,c:start+direction*3});
      b.foes.slice(1).forEach((f,i)=>b.place(f,{r:i*2,c:15}));
      expect(b.e.skills.pickTarget(b.caster,kit().ult,b.foes[0])).toBe(b.foes[0]);
      b.place(b.foes[0],{r:1,c:start+direction*4});
      expect(b.e.skills.pickTarget(b.caster,kit().ult,b.foes[0])).toBeNull();
      b.place(b.foes[0],{r:1,c:start+direction*3});b.use('ult');b.run(.3);
      expect(b.caster.pos.c).toBe(start);b.e.drainEvents();b.run(.05);
      expect(b.caster.pos.c).toBe(start-direction);expect(b.caster.x).toBe(start-direction);
      expect(b.caster.dashMotion).toBeUndefined();
      const retreat=b.e.drainEvents();expect(retreat.filter(e=>e.type==='blink').length).toBe(1);
      expect(retreat.some(e=>e.type==='damage'||e.type==='move')).toBeFalse();
      b.run(3.55);expect(b.e.drainEvents().some(e=>e.type==='damage')).toBeFalse();
      expect(b.caster.actionFacing?.left).toBe(direction>0);
      b.run(.05);const hit=b.e.drainEvents();expect(hit.filter(e=>e.type==='impact').length).toBe(1);
      expect(hit.filter(e=>e.type==='damage'&&e.dst===b.foes[0].id).length).toBe(1);
      b.run(.2);expect(b.caster.skillAction).toBeUndefined();expect(b.caster.actionFacing).toBeUndefined();
      expect(b.caster.pos.c).toBe(start-direction);expect(b.caster.targetId).toBe(b.foes[0].id);
      b.run(1);expect(b.e.drainEvents().some(e=>e.type==='damage')).toBeFalse();
    }
  });

  it('V5 blocked/out-of-bounds retreats stay in place and continue; a newly occupied landing is rechecked',()=>{
    for(const edge of [false,true]) {
      const b=battle(),start=edge?0:5;
      b.place(b.caster,{r:1,c:start});b.place(b.foes[0],{r:1,c:start+1});b.use('ult');b.run(.3);
      if(!edge)b.place(b.foes[1],{r:1,c:start-1});
      b.e.drainEvents();b.run(.1);expect(b.caster.pos.c).toBe(start);
      expect(b.e.drainEvents().some(e=>e.type==='blink')).toBeFalse();
      b.run(4.15);expect(b.e.drainEvents().filter(e=>e.type==='impact').length).toBe(1);
      expect(b.caster.skillAction).toBeUndefined();
    }
  });

  it('V5 turns away once at F9 using the live target position, locks recovery, and keeps same-column ties',()=>{
    for(const column of [3,4,7]) {
      const b=battle();b.place(b.foes[0],{r:1,c:6});b.use('ult');b.run(3.25);
      expect(b.caster.actionFacing?.left).toBeFalse();
      b.place(b.foes[0],{r:0,c:column});b.run(.05);
      expect(b.caster.actionFacing?.left).toBe(column>4);
      b.place(b.foes[0],{r:0,c:column>4?2:9});b.run(.8);
      expect(b.caster.actionFacing?.left).toBe(column>4);b.run(.05);
      expect(b.caster.actionFacing).toBeUndefined();
    }
  });

  it('Ultimate cancels the final hit for dead or untargetable primary without redirecting or damaging neighbors', () => {
    for (const dead of [false, true]) {
      const b = battle(); b.place(b.foes[0], { r: 1, c: 6 }); b.use('ult'); b.run(3);
      if (dead) b.kill(b.foes[0]); else applyBuff(b.foes[0], STATUS_EFFECTS['untargetable'], b.foes[0].id);
      b.e.drainEvents(); b.run(1.6);
      expect(b.e.drainEvents().some(e => e.type === 'impact' || e.type === 'damage')).toBeFalse();
      expect(b.caster.skillAction).toBeUndefined(); expect(b.caster.actionFacing).toBeUndefined();
      expect(b.foes.slice(1).every(f => f.hp === 1e6)).toBeTrue();
    }
  });

  it('dedicated interrupt cancels Ultimate callbacks in every phase; ordinary stun preserves the sequence', () => {
    for (const phase of [.2, .35, .6, .8, 1.6, 2.8, 3.5, 3.8]) {
      const b = battle(); b.use('ult'); b.run(phase); b.e.drainEvents();
      b.e.skills.applyEffects(b.foes[0], { ...kit().skill2, effects: [{ type: 'INTERRUPT', area: 'SINGLE' }] }, 'skill2', b.caster, b.caster.pos);
      expect(b.e.drainEvents().some(e => e.type === 'CAST_INTERRUPTED')).toBeTrue();
      b.run(4); expect(b.e.drainEvents().some(e => e.type === 'damage' || e.type === 'animEvent')).toBeFalse();
      expect(b.caster.actionFacing).toBeUndefined();
    }
    const b = battle(); b.use('ult'); b.run(1.5);
    applyBuff(b.caster, STATUS_EFFECTS['stun'], b.foes[0].id); b.run(3.1);
    expect(b.e.drainEvents().filter(e => e.type === 'impact').length).toBe(1);
  });

  it('caster death cancels remaining dash/cuts and delayed final damage', () => {
    for (const slot of ['skill', 'skill2', 'ult'] as const) {
      const b = battle(); b.use(slot); b.run(.15); b.kill(b.caster); b.e.drainEvents(); b.run(4);
      expect(b.e.drainEvents().some(x => x.type === 'damage' || x.type === 'move')).toBeFalse();
      const c = battle(); c.use(slot); c.run(.4); c.kill(c.caster); c.e.drainEvents(); c.run(4);
      expect(c.e.drainEvents().some(x => x.type === 'damage' || x.type === 'move')).toBeFalse();
    }
  });

  it('AUTO and TACTICAL both cast the preserved stationary Ultimate and resolve one existing peak', () => {
    for (const tactical of [false,true]) {
      const b=battle(); b.e.autoUlt=true;b.caster.mana=b.caster.maxMana;b.caster.castLock=0;
      const bot=tactical?new TacticalBot():null;
      let castAt:number|undefined; const impactAt:number[]=[];
      for(let i=0;i<104;i++) {
        for(const f of b.foes) { f.castLock=1e6;f.cd1=f.cd2=1e6; }
        b.caster.cd1=b.caster.cd2=1e6;
        bot?.tick(b.e);b.e.step(.05);
        for(const e of b.e.drainEvents()) {
          if(e.type==='cast'&&e.src===b.caster.id&&e.kind==='ult') castAt=b.e.time;
          if(e.type==='impact'&&e.src===b.caster.id&&e.kind==='ult') impactAt.push(b.e.time);
        }
      }
      expect(castAt).withContext(tactical?'TACTICAL':'AUTO').toBeDefined();expect(impactAt.length).toBe(1);
      expect(impactAt[0]-castAt!).toBeCloseTo(3.95,7);
      expect(b.caster.skillAction).toBeUndefined();expect(b.caster.actionFacing).toBeUndefined();
    }
  });

  it('rank upgrades copy the kit while preserving hit weights, marks and delayed final timing', () => {
    const original = JSON.stringify(kit());
    const ranked = rankedKit('vaelric', 'assassin', { skill: 5, skill2: 5, ult: 5 });
    expect(JSON.stringify(kit())).toBe(original);
    for (const slot of ['skill', 'skill2', 'ult'] as const) {
      expect(ranked[slot].repeat).toEqual(kit()[slot].repeat);
      const base = kit()[slot].effects.find(x => x.type === 'DAMAGE')!;
      const up = ranked[slot].effects.find(x => x.type === 'DAMAGE')!;
      if (base.type === 'DAMAGE' && up.type === 'DAMAGE') expect(up.primary).toBeGreaterThan(base.primary);
    }
    expect(skillLines(kit().skill2).some(x => x.includes('DEF 80%'))).toBeTrue();
    expect(animTiming('hero-vaelric.png', 'ult').hits[0]).toBeCloseTo(3.93,8);
  });
});
