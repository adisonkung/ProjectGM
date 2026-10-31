import { MonsterDefinition, MonsterSkillDefinition } from '../models/monster';

/** User-approved stationary third Ascension guardian; all tier scaling remains shared and provisional. */
export const SOLAR_SKILLS: Record<string, MonsterSkillDefinition> = {
  solar_seals: {
    id:'solar_seals',name:'ตราประทับแสง',label:'SOLAR SEALS',type:'ATTACK',clip:'seals',
    castTime:2.7,cooldown:13,firstCastDelay:3,interruptible:false,range:16,
    target:{type:'ALL_HEROES'},conditions:[{type:'ENEMY_WITHIN',range:16}],
    groundTargets:{count:2,lockAfter:.8,markFx:'so-s1-seal',impactFx:'so-s1-impact'},
    effects:[{type:'DAMAGE',mul:1.2,area:'ALL_ENEMIES',center:'TARGET',damageType:'MAGIC'}],
    recovery:1.02,interruptRecovery:.3,
  },
  solar_sweep: {
    id:'solar_sweep',name:'กวาดวงแหวน',label:'RING SWEEP',type:'ATTACK',clip:'sweep',
    castTime:2,cooldown:16,firstCastDelay:7,interruptible:false,range:16,
    target:{type:'ALL_HEROES'},conditions:[{type:'ENEMY_WITHIN',range:16}],
    laneSweep:{interval:.95,reverseAlternate:true,beamFx:'so-s2-beam',emitterFx:'so-s2-emitter',durationMs:650},
    effects:[{type:'DAMAGE',mul:1.2,area:'ALL_ENEMIES',center:'SELF',damageType:'MAGIC'}],
    recovery:2.64,interruptRecovery:.3,
  },
  solar_eclipse: {
    id:'solar_eclipse',name:'สุริยคราสพิพากษา',label:'ECLIPSE JUDGEMENT',type:'ATTACK',clip:'eclipse',
    castTime:3,cooldown:18,firstCastDelay:14,interruptible:false,interruptPriority:'CRITICAL',breakRequired:100,brokenStatus:'broken',range:16,
    target:{type:'ALL_HEROES'},conditions:[{type:'ENEMY_WITHIN',range:16}],
    effects:[{type:'DAMAGE',mul:1.5,area:'ALL_ENEMIES',center:'SELF',damageType:'MAGIC'}],
    hitFx:'so-s3-impact',recovery:1.4,interruptRecovery:0,
  },
};
export const SOLAR_OCULUS: MonsterDefinition = {
 id:'solar_oculus',name:'ดวงเนตรสุริยคราส',rank:'BOSS',role:'STATIONARY RANGED / MARKS / LANE SWEEP / BREAK',
 tags:['celestial','construct','ascension'],displayClass:'mage',immune:['KNOCKBACK','ROOT','STUN'],
 // Retain the outgoing third guardian's HP/ATK/DEF and existing shared dungeon multipliers.
 stats:{maxHp:20000,attack:95,defense:34,moveSpeed:1.2,attackRange:16,preferredRange:16,
  attackCooldown:1.7,attackWindup:.95,attackRecovery:.25,targetThinkInterval:.3,hitReactionDuration:.1,minHitReactionInterval:3,
  collisionRadius:.8,minComfortableRange:0,footprint:{cols:3,rows:2,anchorC:1,anchorR:1},bodyBlock:true},
 ai:{targeting:{strategy:'NEAREST_REACHABLE_FRONT',targetLockDuration:2},movement:'RANGED_HOLD',maxRetreatSteps:0,
  holdArena:{leash:0,returnAfter:0},skillPriority:['solar_eclipse','solar_sweep','solar_seals']},
 attack:{id:'solar_shot',damageType:'MAGIC',damageMultiplier:1,delivery:'PROJECTILE',projectileId:'solar_bolt',clip:'attack',event:'PROJECTILE_SPAWN',hitTolerance:0},
 skills:['solar_seals','solar_sweep','solar_eclipse'],
 animation:{sheet:'enemy-solar-oculus.png',cellW:336,cellH:360,clips:{
  idle:{row:1,frames:48,frameMs:125},move:{row:2,frames:24,frameMs:125},
  hurt:{row:3,frames:6,frameMs:40},death:{row:4,frames:20,frameMs:110},
  attack:{row:5,frames:28,frameMs:50,events:[{frame:20,event:'PROJECTILE_SPAWN',name:'SOLAR_SHOT'}]},
  seals:{row:6,frames:48,frameMs:60,castDriven:true,events:[{frame:1,event:'CAST_START',name:'SEAL_CHARGE'},{frame:31,event:'SKILL_ACTIVATE',name:'SEAL_DETONATE'}]},
  sweep:{row:7,frames:48,frameMs:110,castDriven:true,events:[{frame:1,event:'CAST_START',name:'SWEEP_CHARGE'},{frame:25,event:'SKILL_ACTIVATE',name:'SWEEP_RELEASE'}]},
  eclipse:{row:8,frames:48,frameMs:80,castDriven:true,events:[{frame:1,event:'CAST_START',name:'ECLIPSE_CHARGE'},{frame:31,event:'SKILL_ACTIVATE',name:'ECLIPSE_RELEASE'}]},
  broken:{row:9,frames:30,frameMs:100,castDriven:true,events:[{frame:1,event:'CAST_START',name:'CORE_SHUTDOWN'},{frame:1,event:'SKILL_ACTIVATE',name:'CORE_SHUTDOWN'}]},
 }},
};
