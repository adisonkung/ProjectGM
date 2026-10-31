import type { FxDef, SheetDef } from './sprites';
const charge=(durationMs:number)=>({durationMs,alpha:[[0,0],[120,1],[durationMs-80,1],[durationMs,0]] as [number,number][]});
export const SOLAR_PRESENTATION:Partial<SheetDef>={
 displayScale:1.25,pixelated:true,hitFlashStrength:.25,anchors:{eye:[11.9,-181.4]},
 attackFx:['so-charge-short'],preloadFx:['so-contact','so-s1-impact','so-s2-beam','so-s3-impact'],
 statusFx:{broken:{loop:'so-core'}},deathFx:'so-death',
 monsterFx:{
  seals:{cast:['so-charge'],tracks:{'so-charge':charge(2700)}},
  sweep:{cast:['so-charge'],tracks:{'so-charge':charge(2000)}},
  eclipse:{cast:['so-charge','so-s3-ground'],tracks:{'so-charge':charge(3000),'so-s3-ground':charge(3000)}},
 },
};
export const SOLAR_FX:Record<string,FxDef>={
 'so-charge':{file:'fx-solar-charge.png',frames:60,w:256,h:256,frameMs:50,at:'self',anchor:'eye',fitCells:4.25,attach:true},
 'so-charge-short':{file:'fx-solar-charge-short.png',frames:19,w:256,h:256,frameMs:50,at:'self',anchor:'eye',fitCells:3.875,attach:true},
 'so-s1-seal':{file:'fx-solar-seal.png',frames:40,w:256,h:256,frameMs:50,at:'target',fitCells:1.8,pivot:[.5,380/512],dy:27.25,attach:false,layer:'under'},
 'so-s1-impact':{file:'fx-solar-seal-impact.png',frames:8,w:320,h:320,frameMs:106.25,at:'target',fitCells:2.6,pivot:[.5,380/512],dy:27.25,attach:false},
 'so-s3-ground':{file:'fx-solar-ground-charge.png',frames:60,w:360,h:360,frameMs:50,at:'self',fitCells:5.4,pivot:[.5,380/512],dy:27.25,attach:false,layer:'under'},
 'so-s3-impact':{file:'fx-solar-judgement-impact.png',frames:8,w:360,h:360,frameMs:131.25,at:'target',fitCells:3,pivot:[.5,380/512],dy:27.25,attach:false},
 'so-contact':{file:'fx-solar-hit.png',frames:8,w:160,h:160,frameMs:60,at:'target',fitCells:1.2,dy:-30,attach:false},
 'so-s2-beam':{file:'fx-solar-beam.png',frames:8,w:768,h:120,frameMs:45,repeat:2,at:'self',anchor:'eye',fitCells:10,fitRows:.8,pivot:[0,.5],attach:false},
 'so-s2-emitter':{file:'fx-solar-emitter.png',frames:1,w:256,h:256,frameMs:650,at:'self',anchor:'eye',fitCells:3.25,attach:false},
 'so-bolt':{file:'fx-solar-bolt.png',frames:2,w:256,h:128,frameMs:50,at:'target',scale:.7,angle0:0,muzzle:[11.9,-173.4],hitFx:'so-contact'},
 'so-core':{file:'fx-solar-break.png',frames:4,w:160,h:160,frameMs:160,at:'self',anchor:'eye',fitCells:1.6,attach:true},
 'so-death':{file:'fx-solar-death.png',frames:8,w:320,h:320,frameMs:150,delayMs:350,fadeOutMs:150,at:'self',anchor:'eye',fitCells:5.2,attach:true},
};
