import { STATUS_EFFECTS } from '../../core/data/status-effects';
import { BattleEngine } from '../../battle/engine/battle-engine';
import { ENEMIES } from '../../core/data/enemies';
import { HERO_BY_ID } from '../../core/data/heroes';
import { MONSTERS, MONSTER_SKILLS } from '../../core/data/monsters';
import { heroStats } from '../../core/rules/stats';
import { Cell } from '../../core/models/unit';
import { ReviewSample } from './skill-review';

/** One selected cast on an isolated real engine. Durable targets and frozen AI never touch saves. */
export function monsterReview(monsterId:string,skillId:string,at:Cell,targets:{id:number;pos:Cell}[],left:boolean,targetMonsterId?:string){
 const h=HERO_BY_ID['bailong'],definition=MONSTERS[monsterId],skill=MONSTER_SKILLS[skillId];
 const engine=new BattleEngine({allies:targets.map((t,i)=>({name:'เป้าฝึก',heroId:h.id,cls:h.cls,pos:{r:i,c:0},stats:{...heroStats(h,{uid:i+1,templateId:h.id,level:1,potential:'B'}),hp:100000,footprint:MONSTERS[targetMonsterId??'']?.stats.footprint}})),
 stage:{floor:1,mode:'eliminate',timeLimit:999,enemies:[{enemy:monsterId,r:0,c:1}]},enemyTemplates:ENEMIES,monsters:MONSTERS,seed:7});
 const freeze=()=>engine.units.forEach(u=>{u.castLock=1e6;u.moveCd=1e6;u.cd1=u.cd2=1e6;if(u.monster){u.monster.attackCooldownRemaining=1e6;for(const cs of u.castSkills)cs.cd=Infinity;}});
 freeze();engine.step(.05);const caster=engine.units.find(u=>u.monster)!,allies=engine.units.filter(u=>!u.monster);
 const place=(u:typeof caster,c:Cell)=>{engine.grid.move(u.id,u.pos,c);u.pos={...c};u.x=c.c;u.y=c.r;};
 place(caster,at);caster.monster!.facingDirection=left?-1:1;caster.monster!.state='IDLE';
 allies.forEach((u,i)=>place(u,targets[i].pos));
 const ids=new Map([[caster.id,1],...allies.map((u,i)=>[u.id,targets[i].id] as [number,number])]);
 caster.castSkills=definition.skills.map(id=>({def:MONSTER_SKILLS[id],cd:id===skillId?0:Infinity}));engine.drainEvents();
 const started=engine.time,samples:ReviewSample[]=[];
 const extras=new Map<number,string>();
 // summoned units (Call of the Forest …) join the review under lab ids 200+
 const track=()=>{for(const u of engine.units)if(u.monster&&!ids.has(u.id)){const lab=200+extras.size;ids.set(u.id,lab);extras.set(lab,u.monster.definitionId);}};
 const snap=()=>{track();samples.push({t:engine.time-started,events:engine.drainEvents(),positions:Object.fromEntries(engine.units.filter(u=>ids.has(u.id)).map(u=>[ids.get(u.id)!,{r:u.y,c:u.x,flip:u===caster||u.monster?left:!left}])),vitals:Object.fromEntries(engine.units.filter(u=>ids.has(u.id)).map(u=>[ids.get(u.id)!,{hpPct:u.hp/u.maxHp*100,shieldPct:u.shield/u.maxHp*100}])),statuses:Object.fromEntries(engine.units.filter(u=>ids.has(u.id)).map(u=>[ids.get(u.id)!,u.buffs.map(b=>({id:b.def.id,left:b.remaining,sourceId:ids.get(b.sourceId)??b.sourceId}))]))});};
 const ok=engine.requestMonsterSkill(caster.id,skillId);snap();
 const statusDuration=Math.max(0,...skill.effects.filter(e=>e.type==='APPLY_STATUS').map(e=>e.duration??STATUS_EFFECTS[e.status]?.duration??0));
 const seconds=skill.castTime+Math.max((skill.recovery??1)+4,statusDuration+1);
 if(ok)for(let i=0;i<Math.ceil(seconds/.05);i++){freeze();engine.step(.05);snap();}
 return {ids,samples,ok,extras};
}
