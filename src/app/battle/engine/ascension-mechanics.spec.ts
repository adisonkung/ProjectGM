import { createBattle } from '../battle-session';
import { ascensionDuel } from '../../core/data/economy';
import { HERO_BY_ID } from '../../core/data/heroes';
import { MONSTER_SKILLS } from '../../core/data/monsters';
import { MonsterSkillDefinition } from '../../core/models/monster';
import { UnitSpec } from '../../core/models/unit';
import { heroStats } from '../../core/rules/stats';
import { BattleEvent, BattleUnit } from './battle-engine';
import { hasStatus, modifier } from './buffs';

function arena(id:'aegis_sentinel'|'jadecrest_guardian'|'solar_oculus') {
 const allies:UnitSpec[]=['garrick','tangxun','mirelle'].map((id,i)=>{
  const h=HERO_BY_ID[id];return {name:h.name,cls:h.cls,heroId:id,heroUid:i+1,
   stats:{...heroStats(h,{uid:i+1,templateId:id,level:1,potential:'B'}),hp:10000,atk:1},pos:{r:i===0?1:3,c:i}};
 });
 const e=createBattle({allies,stage:ascensionDuel(1,id),seed:9});
 const boss=e.units.find(u=>u.monster)!,heroes=e.units.filter(u=>!u.monster),events:BattleEvent[]=[];
 for(const h of heroes){h.castLock=999;h.moveCd=999;for(const slot of ['skill','skill2','ult'] as const)e.setSkillMode(h.id,slot,'MANUAL');}
 for(const cs of boss.castSkills)cs.cd=Infinity;
 boss.monster!.attackCooldownRemaining=Infinity;
 const run=(seconds:number)=>{for(let i=0;i<Math.round(seconds/.025);i++){e.step(.025);events.push(...e.drainEvents());}};
 const api=e as unknown as {
  beginCast(u:BattleUnit,d:MonsterSkillDefinition,t:BattleUnit):void;
  tryInterrupt(a:BattleUnit,b:BattleUnit,power:number):void;
  applyStatus(dst:BattleUnit,id:string,src:BattleUnit):void;
  monsterAI:{aimTarget(u:BattleUnit,d:MonsterSkillDefinition):BattleUnit|null};
 };
 run(.1);
 const cast=(id:string,target=heroes[0])=>{api.beginCast(boss,MONSTER_SKILLS[id],target);boss.monster!.state='CASTING';boss.monster!.currentSkillId=id;events.push(...e.drainEvents());};
 return {e,api,boss,heroes,events,run,cast};
}

describe('Ascension specialist mechanics V1',()=>{
 it('rewards cutting Guard with a finite exposed core and a full cooldown',()=>{
  const s=arena('aegis_sentinel');s.cast('aegis_guard');s.run(.3);
  s.boss.castSkills.find(cs=>cs.def.id==='aegis_guard')!.cd=0;
  s.api.tryInterrupt(s.heroes[0],s.boss,0);
  expect(s.boss.castSkills.find(cs=>cs.def.id==='aegis_guard')!.cd).toBe(20);
  expect(s.boss.casting).toBeNull();expect(hasStatus(s.boss,'aegis_guard')).toBeFalse();
  expect(hasStatus(s.boss,'aegis_exposed')).toBeTrue();expect(modifier(s.boss,'damageTakenMultiplier')).toBe(1.75);
  s.run(4.1);expect(hasStatus(s.boss,'aegis_exposed')).toBeFalse();
 });
 it('removes existing protection when Judgement is broken; one partial Break is insufficient',()=>{
  const s=arena('aegis_sentinel');s.api.applyStatus(s.boss,'aegis_guard',s.boss);s.cast('aegis_judgement');
  s.api.tryInterrupt(s.heroes[0],s.boss,60);expect(hasStatus(s.boss,'aegis_guard')).toBeTrue();
  s.api.tryInterrupt(s.heroes[1],s.boss,40);
  expect(s.boss.casting).toBeNull();expect(hasStatus(s.boss,'aegis_guard')).toBeFalse();
  expect(modifier(s.boss,'damageTakenMultiplier')).toBe(1.75);
  s.run(3.2);expect(s.events.some(e=>e.type==='skillActivated'&&e.skill==='aegis_judgement')).toBeFalse();
 });
 it('pounces on the strongest backliner instead of the taunted frontline, with a target warning then a fixed landing',()=>{
  const s=arena('jadecrest_guardian'),def=MONSTER_SKILLS['jadecrest_pounce'];
  s.heroes[0].atk=10000;s.heroes[1].atk=100;s.heroes[2].atk=200;
  s.boss.monster!.currentTargetId=s.heroes[0].id;
  const aim=s.api.monsterAI.aimTarget(s.boss,def);expect(aim?.id).toBe(s.heroes[2].id);
  s.cast(def.id,aim!);
  const warning=s.events.find(e=>e.type==='monsterGround'&&e.followTarget===aim!.id);
  expect(warning?.type).toBe('monsterGround');
  if(warning?.type==='monsterGround')expect(warning.durationMs).toBeCloseTo(1200,5);
  s.run(1.25);const landing={...s.boss.pos};
  expect(s.events.some(e=>e.type==='monsterGround'&&e.warning&&e.followTarget==null&&e.cells[0].c===landing.c)).toBeTrue();
  aim!.pos={r:0,c:0};s.run(.6);expect(s.boss.pos).toEqual(landing);
 });
 it('rotates seals fairly across living heroes and uses threat before a unit ID tie-break',()=>{
  const s=arena('solar_oculus');s.heroes[2].atk=200;s.heroes[1].atk=100;
  for(let i=0;i<3;i++){s.cast('solar_seals');s.run(.85);}
  const warnings=s.events.filter((e):e is Extract<BattleEvent,{type:'monsterGround'}>=>e.type==='monsterGround'&&!!e.warning);
  expect(warnings[0].cells[0]).toEqual(s.heroes[2].pos);
  expect(warnings.length).toBe(3);expect(Object.values(s.boss.monster!.groundMarks!)).toEqual([2,2,2]);
 });
 it('releases three separate team hits, allows a shield response, and stops remaining pulses on source death',()=>{
  const s=arena('solar_oculus'),target=s.heroes[0];target.shield=10000;target.shieldTime=10;
  const hp=target.hp;s.cast('solar_eclipse');s.run(3.1);
  const hits=()=>s.events.filter(e=>e.type==='damage'&&e.dst===target.id);
  expect(hits().length).toBe(1);expect(target.hp).toBe(hp);expect(target.shield).toBeLessThan(10000);
  s.run(.8);expect(hits().length).toBe(2);
  s.run(.8);expect(hits().length).toBe(3);
  const dead=arena('solar_oculus');dead.cast('solar_eclipse');dead.run(3.1);dead.boss.alive=false;dead.run(2);
  expect(dead.events.filter(e=>e.type==='damage'&&e.dst===dead.heroes[0].id).length).toBe(1);
 });
});
