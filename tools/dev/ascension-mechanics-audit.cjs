// Read-only audit: first run npx tsc -p tsconfig.sim.json from the repository root.
const fs=require('fs'),path=require('path'),base=path.resolve(__dirname,'../../dist/sim/src/app')+'/';
const {BattleEngine}=require(base+'battle/engine/battle-engine');
const {TacticalBot,tacticalFormation}=require(base+'battle/engine/bots/tactical-bot');
const {ENEMIES}=require(base+'core/data/enemies');
const {ascensionDuel}=require(base+'core/data/economy');
const {POWER_PROFILES}=require(base+'core/data/progression');
const {applyProfile}=require(base+'core/rules/progression');
const {autoPlace,teamToUnits}=require(base+'core/rules/team');
const teams={starter:['bailong','yuezheng','moye','tangxun','linxue'],break:['garrick','kael','tangxun','mirelle','linxue'],ranged:['yuezheng','mirelle','sylvara','sylas','elira'],sustain:['draeven','bailong','sylas','elira','linxue'],burst:['garrick','kael','moye','vaelric','lucien']};
const profiles=['B','D','G','G6'];let rows=[];let runs=0;
for(const profile of profiles)for(const [team,ids]of Object.entries(teams))for(const tier of[1,2,3])for(const boss of['aegis_sentinel','jadecrest_guardian','solar_oculus'])for(const mode of['AUTO','TACTICAL']){
 const p=POWER_PROFILES[profile==='G6'?'G':profile];const owned=ids.map((id,i)=>applyProfile({uid:i+1,templateId:id,level:1,potential:'B',exp:0,breakthroughTier:0,...(profile==='G6'?{star:6}:{})},p));
 const stage=ascensionDuel(tier,boss),formation=autoPlace(owned),allies=teamToUnits(mode==='TACTICAL'?tacticalFormation(owned,formation,stage):formation,owned);
 const row={profile,level:p.level,team,tier,boss,mode,n:10,wins:0,time:0,survivors:0,bossHp:0,breaks:0,interrupts:0,casts:{}};
 for(let seed=1;seed<=10;seed++){
  const e=new BattleEngine({allies,stage,enemyTemplates:ENEMIES,seed,autoUlt:true});
  const bot=mode==='TACTICAL'?new TacticalBot({focus:true,reserveInterrupts:true,reserveHealerUlt:true,interruptPriority:true}):null;
  while(!e.result&&e.time<250){bot?.tick(e);e.step(.05);for(const ev of e.drainEvents()){
   if(ev.type==='broken')row.breaks++;if(ev.type==='interrupt')row.interrupts++;
   if(ev.type==='castDone'&&e.units.find(u=>u.id===ev.src)?.monster)row.casts[ev.skill]=(row.casts[ev.skill]??0)+1;
  }}
  row.wins+=e.result==='win'?1:0;row.time+=e.time;row.survivors+=e.units.filter(u=>u.side==='ally'&&u.alive&&u.heroId).length;
  const b=e.units.find(u=>u.monster);row.bossHp+=b?b.hp/b.maxHp:0;runs++;
 }
 for(const key of['time','survivors','bossHp','breaks','interrupts'])row[key]=Number((row[key]/10).toFixed(3));rows.push(row);
 console.log(profile,team,tier,boss,mode,row.wins+'/10',row.time);
}
fs.writeFileSync(path.resolve(process.argv[2]??'dist/ascension-mechanics-results.json'),JSON.stringify({baseline:'fef69f1807b24a0297ac7f84d7fac2a0054190ce',revision:require('child_process').execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),runs,teams,profiles,notes:['Current shipped roster; no legacy-roster override','No full-ultimate dev switch; engine production start gauge','AUTO default formation; TACTICAL existing bot, not a boss-specific or movement-dodge AI','B: Lv5 Basic ranks1/2/1; D: Lv8 Mid ranks2/3/2; G: Lv10 NearMax ranks5/5/5; G6 uses OwnedHero.star=6','The audit never mutates gameplay definitions'],rows},null,2));
