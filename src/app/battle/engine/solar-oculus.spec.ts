import { SOLAR_OCULUS, SOLAR_SKILLS } from '../../core/data/solar-oculus';
import { ascensionDuel, ascensionSelection } from '../../core/data/economy';
import { HERO_BY_ID } from '../../core/data/heroes';
import { MONSTERS, castTimeline } from '../../core/data/monsters';
import { unitGeometry } from '../render/unit-geometry';
import { FX, SHEETS } from '../../core/data/sprites';
import { UnitSpec } from '../../core/models/unit';
import { MonsterSkillDefinition } from '../../core/models/monster';
import { heroStats } from '../../core/rules/stats';
import { createBattle } from '../battle-session';
import { BattleEvent, BattleUnit } from './battle-engine';
import { hasStatus } from './buffs';

function fixture(){
 const h=HERO_BY_ID['garrick'];
 const allies:UnitSpec[]=[0,1,2].map((r)=>({name:h.name,cls:h.cls,heroId:h.id,heroUid:r+1,
  stats:{...heroStats(h,{uid:r+1,templateId:h.id,level:1,potential:'B'}),hp:999999,atk:1},pos:{r:1,c:r}}));
 const e=createBattle({allies,stage:ascensionDuel(1,'solar_oculus'),seed:31});
 const boss=e.units.find(u=>u.monster)!,heroes=e.units.filter(u=>!u.monster);const events:BattleEvent[]=[];
 for(const u of heroes){u.castLock=999;u.moveCd=999;for(const slot of ['skill','skill2','ult'] as const)e.setSkillMode(u.id,slot,'MANUAL');}
 for(const cs of boss.castSkills)cs.cd=Infinity;
 boss.monster!.attackCooldownRemaining=Infinity;
 const run=(n:number)=>{for(let i=0;i<Math.round(n/.025);i++){e.step(.025);events.push(...e.drainEvents());}};
 run(.1);
 const cast=(id:string)=>{
  const api=e as unknown as{beginCast(u:BattleUnit,d:MonsterSkillDefinition,t:BattleUnit):void};
  api.beginCast(boss,SOLAR_SKILLS[id],heroes[0]);boss.monster!.state='CASTING';boss.monster!.currentSkillId=id;
  events.push(...e.drainEvents());
 };
 return{e,boss,heroes,events,run,cast};
}
describe('Solar Oculus integration',()=>{
 it('selects Solar at all tiers and weekdays, retains old Seraph saves and assigns each supplied arena',()=>{
  for(const t of [1,2,3]){
   expect(MONSTERS[`solar_oculus@${t}`].skills).toEqual(SOLAR_OCULUS.skills);
   expect(MONSTERS[`astral_seraph@${t}`]).toBeDefined();
   for(let d=0;d<7;d++)expect(ascensionSelection(t,'solar_oculus',new Date(2026,10,1+d)).enemies[0].enemy).toBe(`solar_oculus@${t}`);
  }
  for(const [id,bg] of [['aegis_sentinel','ascension-aegis'],['jadecrest_guardian','ascension-jadecrest'],['solar_oculus','ascension-solar']] as const)
   expect(ascensionDuel(1,id).background).toBe(bg);
 });
 it('locks two distinct cells, lets the original hero leave, and hits a replacement occupant at activation',()=>{
  const s=fixture();s.cast('solar_seals');s.run(.85);
  const mark=s.events.find(e=>e.type==='monsterGround'&&e.warning);
  expect(mark?.type).toBe('monsterGround');if(mark?.type!=='monsterGround')return;
  expect(mark.cells.length).toBe(2);const cell=mark.cells[0];
  const leaving=s.heroes.find(h=>h.pos.r===cell.r&&h.pos.c===cell.c)!;
  const replacement=s.heroes.find(h=>!mark.cells.some(c=>c.r===h.pos.r&&c.c===h.pos.c))!;
  leaving.pos={r:2,c:3};leaving.x=s.e.formation.originPosition+3;leaving.y=2;
  replacement.pos={...cell};replacement.x=s.e.formation.originPosition+cell.c;replacement.y=cell.r;
  const hp=leaving.hp,other=replacement.hp;s.run(2);
  expect(leaving.hp).toBe(hp);expect(replacement.hp).toBeLessThan(other);
  expect(s.events.some(e=>e.type==='monsterGround'&&!e.warning&&e.cells.some(c=>c.r===cell.r&&c.c===cell.c))).toBeTrue();
 });
 it('fires one lane per pulse, leaves later lanes safe, and reverses the next completed sweep',()=>{
  const s=fixture();s.cast('solar_sweep');const hp=s.heroes.map(h=>h.hp);s.run(2.1);
  expect(s.heroes[0].hp).toBeLessThan(hp[0]);expect(s.heroes[1].hp).toBe(hp[1]);expect(s.heroes[2].hp).toBe(hp[2]);
  s.run(2.6);expect(s.events.filter(e=>e.type==='monsterBeam').map(e=>e.type==='monsterBeam'?e.lane:-1)).toEqual([0,1,2]);
  s.cast('solar_sweep');s.run(4.7);
  expect(s.events.filter(e=>e.type==='monsterBeam').map(e=>e.type==='monsterBeam'?e.lane:-1)).toEqual([0,1,2,2,1,0]);
 });
 it('cancels remaining lane pulses when the source dies',()=>{
  const s=fixture();s.cast('solar_sweep');s.run(2.1);s.boss.alive=false;s.run(2);
  expect(s.events.filter(e=>e.type==='monsterBeam').length).toBe(1);
 });
 it('breaks Eclipse through the real interrupt path without releasing team damage',()=>{
  const s=fixture();s.cast('solar_eclipse');const hp=s.heroes.map(h=>h.hp);s.run(.4);
  (s.e as unknown as{tryInterrupt(a:BattleUnit,b:BattleUnit,n:number):void}).tryInterrupt(s.heroes[0],s.boss,100);
  expect(hasStatus(s.boss,'broken')).toBeTrue();expect(s.boss.casting).toBeNull();s.run(3);
  expect(s.heroes.map(h=>h.hp)).toEqual(hp);expect(s.events.some(e=>e.type==='skillActivated'&&e.skill==='solar_eclipse')).toBeFalse();
 });
 it('does not leave a ground warning behind when killed before lock time and never walks its arena',()=>{
  const s=fixture(),home={...s.boss.pos};s.cast('solar_seals');s.boss.alive=false;s.run(1);
  expect(s.events.some(e=>e.type==='monsterGround')).toBeFalse();expect(s.boss.pos).toEqual(home);
 });
 it('registers the approved eye anchor and fade-only beam without a height-collapse track',()=>{
  const sh=SHEETS['enemy-solar-oculus.png'];expect(sh.displayScale).toBe(1.25);
  const geometry=unitGeometry(sh,100),sourceEyeY=198+(249-255)*(260/336)*.5;
  expect(sh.anchors!['eye'][1]).toBeCloseTo(geometry.bottomY+(sourceEyeY-360)*geometry.k-50,0);
  for(const id of SOLAR_OCULUS.skills)expect(castTimeline(SOLAR_SKILLS[id],SOLAR_OCULUS.animation).activation).toBeCloseTo(SOLAR_SKILLS[id].castTime,5);
  expect(FX['so-s2-beam'].fitRows).toBe(.8);expect(FX['so-s3-ground'].pivot).toEqual(FX['so-s1-seal'].pivot);
 });
});
