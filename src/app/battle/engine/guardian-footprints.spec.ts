import { ascensionDuel } from '../../core/data/economy';
import { MONSTERS, MONSTER_SKILLS } from '../../core/data/monsters';
import { HERO_BY_ID } from '../../core/data/heroes';
import { MonsterSkillDefinition } from '../../core/models/monster';
import { UnitSpec } from '../../core/models/unit';
import { heroStats } from '../../core/rules/stats';
import { createBattle } from '../battle-session';
import { BattleUnit } from './battle-engine';
import { bodyFrontCell, footprintBounds, footprintCells } from './footprint';
import { inBasicAttackRange, meleeStandY } from './melee-contact';

function arena(id:'aegis_sentinel'|'jadecrest_guardian',positions:{r:number;c:number}[]) {
 const h=HERO_BY_ID['garrick'];
 const allies:UnitSpec[]=positions.map((_,i)=>({name:h.name,cls:h.cls,heroId:h.id,heroUid:i+1,
 stats:{...heroStats(h,{uid:i+1,templateId:h.id,level:1,potential:'B'}),hp:10000,atk:1},pos:{r:4,c:i%3}}));
 const e=createBattle({allies,stage:ascensionDuel(1,id),seed:17}),boss=e.units.find(u=>u.monster)!,heroes=e.units.filter(u=>!u.monster);
 const api=e as unknown as {relocate(u:BattleUnit,c:{r:number;c:number},how:'blink'):void;beginCast(u:BattleUnit,d:MonsterSkillDefinition,t:BattleUnit):void;activateMonsterSkill(u:BattleUnit,d:MonsterSkillDefinition,target:number,leaped:boolean):void};
 const run=(n:number)=>{for(let i=0;i<Math.round(n/.025);i++){e.step(.025);e.drainEvents();}};
 for(const cs of boss.castSkills)cs.cd=Infinity;boss.monster!.attackCooldownRemaining=Infinity;
 heroes.forEach((u,i)=>{api.relocate(u,positions[i],'blink');u.castLock=999;u.moveCd=999;for(const k of ['skill','skill2','ult']as const)e.setSkillMode(u.id,k,'MANUAL');});run(.1);
 boss.monster!.facingDirection=-1;
 return {e,api,boss,heroes,run};
}

describe('User guardian4x2 standing footprints',()=>{
 it('keeps the requested lower O column at every tier: Aegis third, Jade fourth',()=>{
  for(const tier of [1,2,3])for(const [id,anchorC,c0,c1]of [['aegis_sentinel',2,9,12],['jadecrest_guardian',3,8,11]]as const){
   const d=MONSTERS[`${id}@${tier}`],body={pos:{r:2,c:11},footprint:d.stats.footprint};
   expect(body.footprint).toEqual({cols:4,rows:2,anchorC,anchorR:1});
   expect(footprintBounds(body)).toEqual({r0:1,r1:2,c0,c1});expect(footprintCells(body).length).toBe(8);
   expect(bodyFrontCell(body,true)).toEqual({r:2,c:c0});expect(bodyFrontCell(body,false)).toEqual({r:2,c:c1});
  }
  expect(MONSTERS['solar_oculus'].stats.footprint!.cols).toBe(3);
 });
 it('retains full-row contact: increasing width does not lower the top-lane hero',()=>{
  const boss={pos:{r:2,c:11},x:11,y:2,footprint:MONSTERS['aegis_sentinel'].stats.footprint};
  const hero={pos:{r:0,c:8},x:8,y:0};expect(meleeStandY(hero,boss)).toBe(.5);
  expect(inBasicAttackRange({...hero,y:.5},boss,1.5)).toBeTrue();
 });
 it('places Aegis S2 outside the enlarged leading edge instead of inside its own reserved cells',()=>{
  const s=arena('aegis_sentinel',[{r:1,c:8},{r:2,c:6},{r:2,c:13},{r:0,c:8}]);
  s.api.beginCast(s.boss,MONSTER_SKILLS['aegis_judgement'],s.heroes[0]);s.boss.monster!.state='CASTING';s.run(2);
  expect(s.heroes.map(u=>u.hp<u.maxHp)).toEqual([true,true,false,false]);
 });
 it('lets Jade stomp reach the two front columns after moving O to its rightmost column',()=>{
  const s=arena('jadecrest_guardian',[{r:1,c:7},{r:2,c:6},{r:2,c:12},{r:0,c:7}]);
  s.api.beginCast(s.boss,MONSTER_SKILLS['jadecrest_stomp'],s.heroes[0]);s.boss.monster!.state='CASTING';s.run(1.5);
  expect(s.heroes.map(u=>u.hp<u.maxHp)).toEqual([true,true,false,false]);
 });
 it('pounce landing reaches an adjacent victim at either end of the wide body',()=>{
  const s=arena('jadecrest_guardian',[{r:2,c:7},{r:2,c:12},{r:0,c:5}]);
  s.api.activateMonsterSkill(s.boss,MONSTER_SKILLS['jadecrest_pounce'],s.heroes[0].id,true);
  expect(s.heroes.map(u=>u.hp<u.maxHp)).toEqual([true,true,false]);
 });
});
