import { monsterReview } from './monster-review';
import { MONSTER_SKILLS } from '../../core/data/monsters';

describe('isolated monster action review',()=>{
 it('casts Aegis ground S2 with actual recipients at the chosen cells',()=>{
  const r=monsterReview('aegis_sentinel','aegis_judgement',{r:2,c:11},[{id:2,pos:{r:1,c:8}},{id:3,pos:{r:0,c:8}}],true);
  expect(r.ok).toBeTrue();const hit=r.samples.flatMap(s=>s.events).find(e=>e.type==='skillActivated');
  expect(hit?.type==='skillActivated'?hit.skill:'').toBe('aegis_judgement');
  expect(hit?.type==='skillActivated'?hit.targets.map(id=>r.ids.get(id)):[]).toEqual([2]);
  expect(r.samples[0].positions[1]).toEqual({r:2,c:11,flip:true});
 });
 it('rejects an unowned skill and preserves the global registry',()=>{
  const before=JSON.stringify(MONSTER_SKILLS);
  const r=monsterReview('aegis_sentinel','solar_eclipse',{r:2,c:11},[{id:2,pos:{r:1,c:8}}],true);
  expect(r.ok).toBeFalse();expect(JSON.stringify(MONSTER_SKILLS)).toBe(before);
 });
 it('records Jade committed landing warnings and Solar lane releases from real engine events',()=>{
  const jade=monsterReview('jadecrest_guardian','jadecrest_pounce',{r:2,c:11},[{id:2,pos:{r:2,c:6}}],true);
  expect(jade.ok).toBeTrue();expect(jade.samples.flatMap(s=>s.events).some(e=>e.type==='monsterGround'&&e.warning)).toBeTrue();
  const solar=monsterReview('solar_oculus','solar_sweep',{r:2,c:11},[{id:2,pos:{r:0,c:6}},{id:3,pos:{r:2,c:6}}],true);
  expect(solar.ok).toBeTrue();expect(solar.samples.flatMap(s=>s.events).filter(e=>e.type==='monsterBeam').length).toBe(4);
 });
});
