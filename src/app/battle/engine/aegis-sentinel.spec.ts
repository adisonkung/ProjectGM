import { AEGIS_SENTINEL, AEGIS_SKILLS } from '../../core/data/aegis-sentinel';
import { ascensionDuel } from '../../core/data/economy';
import { HERO_BY_ID } from '../../core/data/heroes';
import { MONSTERS, castTimeline } from '../../core/data/monsters';
import { SHEETS, FX } from '../../core/data/sprites';
import { STATUS_EFFECTS } from '../../core/data/status-effects';
import { UnitSpec } from '../../core/models/unit';
import { heroStats } from '../../core/rules/stats';
import { createBattle } from '../battle-session';
import { StatusFxPlayback } from '../render/status-fx';
import { clipTimeline } from '../render/unit-clip';
import { BattleEvent } from './battle-engine';
import { hasStatus } from './buffs';
import { resolveArea } from './area';
import { edgeBeamStretch, fxPlacement, fxPivot, groundFxCell, fxPoseAt } from '../render/fx-clip';

function duel(skill: string) {
  const h = HERO_BY_ID['bailong'];
  const ally: UnitSpec = { name: h.name, cls: h.cls, heroId: h.id, heroUid: 1,
    stats: { ...heroStats(h, { uid: 1, templateId: h.id, level: 1, potential: 'B' }), hp: 999999, atk: 1 }, pos: { r: 0, c: 1 } };
  const e = createBattle({ allies: [ally], seed: 7, stage: { floor: 0, id: 'aegis-test', mode: 'eliminate',
    timeLimit: 300, enemies: [{ enemy: 'aegis_sentinel@1', r: 0, c: 1 }], rulePreset: 'arena' } });
  const boss = e.units.find(u => u.monster)!;
  for (const cs of boss.castSkills) cs.cd = cs.def.id === skill ? .1 : Infinity;
  for (const slot of ['skill','skill2','ult'] as const) e.setSkillMode(e.units[0].id, slot, 'MANUAL');
  const events: BattleEvent[] = [];
  const run = (seconds: number, until?: () => boolean) => {
    for (let i = 0; i < seconds / .05; i++) { e.step(.05); events.push(...e.drainEvents()); if (until?.()) break; }
  };
  return { e, boss, events, run };
}

describe('Aegis Sentinel integration', () => {
  it('S3 covers exactly the six cells directly ahead of the lower O anchor, including stacked targets once', () => {
    for (const left of [true,false]) {
      const caster = { id: 1,pos: { r: 2,c: 7 },actionFacing: { left } };
      const dir = left ? -1 : 1;
      const cells = [1,2,3].flatMap(c => [1,2].map(r => ({ id: c*10+r,pos: { r,c: 7+dir*c } })));
      const stacked = { id: 99,pos: cells[0].pos };
      const outside = [{ id: 100,pos: { r: 2,c: 7 } },{ id: 101,pos: { r: 0,c: 7+dir*2 } },
        { id: 102,pos: { r: 2,c: 7-dir } },{ id: 103,pos: { r: 2,c: 7+dir*4 } }];
      const hits = resolveArea({ pattern: 'FRONT_RECT_3X2',caster,primary: outside[0],candidates: [...cells,stacked,...outside] });
      expect(hits.map(x => x.id)).toEqual([...cells,stacked].map(x => x.id));
    }
  });

  it('S3 keeps its committed forward area if its only opponent moves behind during charge', () => {
    const s = duel('aegis_judgement');
    s.run(4,() => s.boss.casting?.def.id === 'aegis_judgement');
    expect(s.boss.actionFacing?.left).toBeTrue();
    const hero = s.e.units.find(u => !u.monster)!;
    const cell = { r: s.boss.pos.r,c: s.boss.pos.c+3 };
    s.e.grid.move(hero.id,hero.pos,cell);hero.pos = cell;hero.x = cell.c;hero.y = cell.r;
    hero.moveCd = 999;hero.atkCd = 999;
    s.run(4,() => s.events.some(e => e.type === 'skillActivated' && e.skill === 'aegis_judgement'));
    const hit = s.events.find(e => e.type === 'skillActivated' && e.skill === 'aegis_judgement');
    expect(hit?.type === 'skillActivated' ? hit.targets : []).toEqual([]);
    expect(s.boss.casting).toBeNull();
  });

  it('ground charge and front impact pin every visible lower edge to the feet plane, with full half-cell widths', () => {
    const body = { r: 2,c: 11 },cell = 50;
    for (const name of ['ae-s3-ground-charge','ae-s3-wave']) {
      const d = FX[name],point = groundFxCell(d,body,body,true);
      expect(point).toEqual(name === 'ae-s3-wave' ? { r: 2,c: 9 } : body);
      for (let frame = 0; frame < d.frames; frame++) {
        const at = fxPlacement(d,cell,point.c*cell,point.r*cell,true,0);
        const pivot = fxPivot(d,frame);
        const top = at.y-pivot[1]*at.height;
        expect(top+d.ground![frame]/d.h*at.height).toBeCloseTo((2+.5+.2725)*cell,6);
        if (name === 'ae-s3-wave') {
          expect(at.x-at.width/2).toBe(8*cell);
          expect(at.x+at.width/2).toBe(11*cell);
        }
      }
    }
    const sheet = SHEETS['enemy-aegis-sentinel.png'];
    const binding = sheet.monsterFx!['judgement'];
    for (const name of binding.cast!) {
      const track = binding.tracks![name];
      expect(fxPoseAt(FX[name],2.95,false,track).visible).toBeTrue();
      expect(fxPoseAt(FX[name],3,false,track).done).toBeTrue();
    }
    const track = binding.tracks!['ae-s3-charge'];
    const upright = fxPoseAt(FX['ae-s3-charge'],.2,false,track),raised = fxPoseAt(FX['ae-s3-charge'],1.9,false,track);
    expect(upright.dx).toBe(0);
    expect(raised.dx).toBeLessThan(-150); // follows the spear raised behind the boss, not its old fixed position.
    expect(AEGIS_SKILLS['aegis_judgement'].breakRequired).toBe(100);
    expect(AEGIS_SKILLS['aegis_judgement'].castTime).toBe(3);
  });
  it('the straight beam hits all three lanes ahead to the edge, once per unit, never behind the committed facing', () => {
    const caster = { id: 1, pos: { r: 2, c: 11 }, actionFacing: { left: true } };
    const candidates = [
      { id: 2, pos: { r: 0, c: 0 } }, { id: 3, pos: { r: 1, c: 5 } },
      { id: 4, pos: { r: 2, c: 10 } }, { id: 5, pos: { r: 2, c: 10 } },
      { id: 6, pos: { r: 1, c: 12 } }, { id: 7, pos: { r: 2, c: 11 } },
    ];
    expect(resolveArea({ pattern: 'FRONT_BEAM_3', caster, primary: candidates[4], candidates }).map(u => u.id)).toEqual([2,3,4,5]);
    const right = { ...caster, actionFacing: { left: false } };
    expect(resolveArea({ pattern: 'FRONT_BEAM_3', caster: right,
      primary: candidates[0], candidates }).map(u => u.id)).toEqual([6]);
  });

  it('the shaft reaches either screen edge from its tip anchor without changing vertical size or angle', () => {
    const def = FX['ae-s2-beam'];
    const offset: [number,number] = [186,-120];
    for (const left of [true,false]) for (const cell of [40,80]) {
      const at = fxPlacement(def,cell,11*cell,2*cell,left,0,offset,1,edgeBeamStretch(def,11,left,offset));
      expect(at.x + (left ? -at.width : at.width)).toBeCloseTo(left ? 0 : 16*cell,6);
      expect(at.height).toBe(3*cell);
      expect(at.rotation).toBe(0);
    }
  });

  it('all Aegis dungeon tiers start and stay on the bottom anchor instead of walking upward', () => {
    for (const tier of [1,2,3]) {
      const stage = ascensionDuel(tier,'aegis_sentinel');
      expect(stage.waveDefs![0].spawns[0].formationSlot).toEqual({ depth: 1,lane: 2 });
      const e = createBattle({ allies: [],seed: 7,stage });
      const boss = e.units.find(u => u.monster)!;
      expect(boss.pos).toEqual({ r: 2,c: 11 });
    }
    const s = duel('aegis_lance');
    const start = { ...s.boss.pos };
    s.run(15);
    expect(s.boss.pos).toEqual(start);
    expect(castTimeline(AEGIS_SKILLS['aegis_lance'],AEGIS_SENTINEL.animation).activation).toBe(1.8);
  });
  it('all tiers share the three-skill kit and original guardian base stat progression', () => {
    for (const tier of [1,2,3]) {
      const d = MONSTERS[`aegis_sentinel@${tier}`];
      expect(d.skills).toEqual(['aegis_guard','aegis_lance','aegis_judgement']);
      expect(d.animation.sheet).toBe('enemy-aegis-sentinel.png');
    }
    expect(AEGIS_SENTINEL.stats.maxHp).toBe(20000);
    expect(AEGIS_SENTINEL.attack.delivery).toBe('MELEE');
  });

  it('guard lasts eight seconds while normal attacks and other skills resume after its brief recovery', () => {
    const s = duel('aegis_guard');
    s.run(8, () => hasStatus(s.boss, 'aegis_guard'));
    expect(hasStatus(s.boss, 'aegis_guard')).toBeTrue();
    expect(s.boss.shield).toBe(0);
    const appliedAt = s.e.time;
    expect(s.boss.buffs.find(b => b.def.id === 'aegis_guard')!.remaining).toBeCloseTo(8, 1);
    expect(STATUS_EFFECTS['aegis_guard'].modifiers.damageTakenMultiplier).toBe(.4);
    s.run(3);
    expect(hasStatus(s.boss, 'aegis_guard')).toBeTrue();
    expect(s.events.filter(x => x.type === 'attack' && x.src === s.boss.id).length).toBeGreaterThan(0);
    s.boss.castSkills.find(cs => cs.def.id === 'aegis_lance')!.cd = 0;
    s.run(3, () => s.events.some(x => x.type === 'skillActivated' && x.skill === 'aegis_lance'));
    expect(s.events.some(x => x.type === 'skillActivated' && x.skill === 'aegis_lance')).toBeTrue();
    expect(hasStatus(s.boss, 'aegis_guard')).toBeTrue();
    s.run(Math.max(0, 8.1 - (s.e.time - appliedAt)));
    expect(hasStatus(s.boss, 'aegis_guard')).toBeFalse();
    expect(s.e.time - appliedAt).toBeCloseTo(8.1, 1);
  });

  it('S2 applies one semantic release and unique recipients, without moving the caster', () => {
    const s = duel('aegis_lance');
    s.run(10, () => s.boss.casting?.def.id === 'aegis_lance');
    const start = { ...s.boss.pos };
    s.run(3, () => s.events.some(e => e.type === 'skillActivated' && e.skill === 'aegis_lance'));
    const release = s.events.find(e => e.type === 'skillActivated' && e.skill === 'aegis_lance');
    expect(release).toBeDefined();
    if (release?.type === 'skillActivated') {
      expect(release.targets.length).toBeGreaterThan(0);
      expect(new Set(release.targets).size).toBe(release.targets.length);
    }
    expect(s.boss.pos).toEqual(start);
  });

  it('guard pose ends before the buff; surface lights retain ownership across refresh and stop on expiry/death', () => {
    const sh = SHEETS['enemy-aegis-sentinel.png'];
    const tl = clipTimeline(sh.casts!['guard'], 'cast', { anim: 'cast', castClip: 'guard', castTime: 2.5 });
    expect(tl.duration).toBeCloseTo(2.8, 6);
    expect(tl.duration).toBeLessThan(2.5 + STATUS_EFFECTS['aegis_guard'].duration);
    expect(castTimeline(AEGIS_SKILLS['aegis_judgement'], AEGIS_SENTINEL.animation).activation).toBe(3);
    let next = 0;
    const shown = new Map<number,string>();
    const playback = new StatusFxPlayback({ spawn: name => { shown.set(++next,name); return next; }, remove: ids => ids.forEach(id => shown.delete(id)) });
    const instance = { target: 2, source: 2, status: 'aegis_guard', sprite: 'enemy-aegis-sentinel.png', at: { r: 1,c: 10 } };
    playback.sync([instance],0);
    expect([...shown.values()]).toEqual(['ae-s1-in','ae-s1-loop']);
    playback.sync([instance],.5);
    playback.sync([instance],7); // refreshing the status does not spawn another orbit.
    expect(next).toBe(2);
    expect([...shown.values()]).toEqual(['ae-s1-loop']);
    playback.sync([],8);
    expect(shown.size).toBe(0);
    expect(FX['ae-s1-loop'].frames * FX['ae-s1-loop'].frameMs).toBe(2560);
    expect(sh.casts!['broken'].frames * sh.casts!['broken'].ms!).toBe(3000);
  });
});
