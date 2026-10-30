import { JADECREST_GUARDIAN, JADECREST_SKILLS } from '../../core/data/jadecrest-guardian';
import { ascensionDuel, ascensionSelection } from '../../core/data/economy';
import { HERO_BY_ID } from '../../core/data/heroes';
import { MONSTERS, castTimeline } from '../../core/data/monsters';
import { SHEETS, FX } from '../../core/data/sprites';
import { UnitSpec } from '../../core/models/unit';
import { heroStats } from '../../core/rules/stats';
import { createBattle } from '../battle-session';
import { fxPlacement, fxPoseAt } from '../render/fx-clip';
import { BattleEvent } from './battle-engine';
import { footprintBounds, occupiesCell } from './footprint';
import { hasStatus } from './buffs';

function duel(skill: string) {
  const h=HERO_BY_ID['garrick'];
  const ally: UnitSpec={name:h.name,cls:h.cls,heroId:h.id,heroUid:1,
    stats:{...heroStats(h,{uid:1,templateId:h.id,level:1,potential:'B'}),hp:999999,atk:1},pos:{r:2,c:1}};
  const e=createBattle({allies:[ally],seed:17,stage:ascensionDuel(1,'jadecrest_guardian')});
  const boss=e.units.find(u=>u.monster)!,hero=e.units.find(u=>!u.monster)!;
  for(const cs of boss.castSkills)cs.cd=cs.def.id === skill ? .1 : Infinity;
  for(const slot of ['skill','skill2','ult'] as const)e.setSkillMode(hero.id,slot,'MANUAL');
  const events:BattleEvent[]=[];
  const run=(seconds:number,until?:()=>boolean)=>{
    for(let i=0;i<seconds/.05;i++){e.step(.05);events.push(...e.drainEvents());if(until?.())break;}
  };
  return{e,boss,hero,events,run};
}

describe('Jadecrest Guardian integration',()=>{
  it('selects the new second guardian every weekday and keeps the same kit at all three tiers',()=>{
    for(const tier of [1,2,3]){
      const d=MONSTERS[`jadecrest_guardian@${tier}`];
      expect(d.skills).toEqual(JADECREST_GUARDIAN.skills);
      expect(d.animation.sheet).toBe('enemy-jadecrest-guardian.png');
      for(let day=0;day<7;day++)expect(ascensionSelection(tier,'jadecrest_guardian',new Date(2026,10,1+day)).enemies[0].enemy).toBe(d.id);
    }
    expect(MONSTERS['moonblade_ronin@1']).toBeDefined(); // existing saved/review encounters stay valid
  });
  it('plays one peak-frame paw burst and keeps both S1 layers in front, front-impact last',()=>{
    const b=SHEETS['enemy-jadecrest-guardian.png'].monsterFx!['stomp'];
    expect(b.activate).toEqual(['jc-s1-paw','jc-s1-front']);
    expect(FX['jc-s1-front'].frames).toBe(5);expect(FX['jc-s1-front'].mirror).toBeTrue();
    expect(FX['jc-s1-paw'].frames).toBe(1);
    expect(fxPoseAt(FX['jc-s1-paw'],.05).visible).toBeTrue();
    expect(fxPoseAt(FX['jc-s1-paw'],.25).done).toBeTrue();
    expect(FX['jc-s1-front'].layer).not.toBe('under');expect(FX['jc-s1-paw'].layer).not.toBe('under');
    expect(fxPlacement(FX['jc-s1-front'],80,0,0,true,0).flip).toBeFalse();
  });
  it('keeps all three charge rings at the same feet anchor and cancels their flow at activation',()=>{
    const sh=SHEETS['enemy-jadecrest-guardian.png'];
    for(const [clip,skill] of [['stomp','jadecrest_stomp'],['pounce','jadecrest_pounce'],['roar','jadecrest_roar']]){
      const binding=sh.monsterFx![clip],def=JADECREST_SKILLS[skill];
      for(const n of ['jc-charge-under','jc-charge-front']){
        expect(binding.cast).toContain(n);expect(FX[n].dy).toBe(27.25);expect(FX[n].pivot).toEqual([.5,260/384]);
        const track=binding.tracks![n];expect(fxPoseAt(FX[n],track.durationMs/1000,false,track).done).toBeTrue();
      }
      expect(castTimeline(def,JADECREST_GUARDIAN.animation).activation).toBe(def.castTime);
    }
    const trail=sh.monsterFx!['pounce'].tracks!['jc-s2-trail'];
    expect(fxPoseAt(FX['jc-s2-trail'],1.1,false,trail).visible).toBeFalse();
    expect(fxPoseAt(FX['jc-s2-trail'],1.35,false,trail).visible).toBeTrue();
    expect(fxPoseAt(FX['jc-s2-trail'],1.35,false,trail).frame).toBe(2);
    expect(fxPoseAt(FX['jc-s2-trail'],1.35,false,trail).dy).toBeLessThan(-60);
    expect(FX['jc-s2-land'].pivot).toEqual(FX['jc-s2-rim'].pivot);
    expect(FX['jc-s2-land'].dy).toBe(FX['jc-s2-rim'].dy);
    expect(FX['jc-s3-charge'].anchor).toBe('roarCharge');expect(sh.anchors!['roarCharge'][0]).toBe(131.25);
  });
  it('commits a free full-body destination, travels for 0.6 seconds, and damages only on landing',()=>{
    const s=duel('jadecrest_pounce');
    s.run(18,()=>!!s.boss.casting);expect(s.boss.casting?.def.id).toBe('jadecrest_pounce');
    const from={...s.boss.pos};
    s.run(3,()=>!!s.boss.dashMotion);
    expect(s.boss.dashMotion).toBeDefined();expect(s.boss.pos).not.toEqual(from);
    expect(s.events.some(e=>e.type==='skillActivated'&&e.skill==='jadecrest_pounce')).toBeFalse();
    const bounds=footprintBounds(s.boss);expect(bounds.r0).toBeGreaterThanOrEqual(0);expect(bounds.r1).toBeLessThan(3);
    expect(bounds.c0).toBeGreaterThanOrEqual(0);expect(bounds.c1).toBeLessThan(16);
    expect(occupiesCell(s.boss,s.hero.pos)).toBeFalse();
    s.run(2,()=>s.events.some(e=>e.type==='skillActivated'&&e.skill==='jadecrest_pounce'));
    const activated=s.events.find(e=>e.type==='skillActivated'&&e.skill==='jadecrest_pounce');
    expect(activated).toBeDefined();expect(s.boss.dashMotion).toBeUndefined();
    expect(s.boss.actionFacing?.left).toBeTrue();
    expect(s.boss.x).toBeCloseTo(s.e.formation.originPosition+s.boss.pos.c,5);
    expect(s.hero.hp).toBeLessThan(s.hero.maxHp);
  });
  it('breaks S3 through the real interrupt path and does not release its roar',()=>{
    const s=duel('jadecrest_roar');s.run(25,()=>s.boss.casting?.def.id==='jadecrest_roar');
    expect(s.boss.casting).not.toBeNull();
    (s.e as unknown as{tryInterrupt(a:typeof s.hero,b:typeof s.boss,n:number):void}).tryInterrupt(s.hero,s.boss,100);
    expect(hasStatus(s.boss,'broken')).toBeTrue();expect(s.boss.casting).toBeNull();
    s.run(1);expect(s.events.some(e=>e.type==='skillActivated'&&e.skill==='jadecrest_roar')).toBeFalse();
  });
});
