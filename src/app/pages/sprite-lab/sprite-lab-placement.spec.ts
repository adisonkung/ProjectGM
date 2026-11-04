import { TestBed,fakeAsync,tick } from '@angular/core/testing';
import { ActivatedRoute,convertToParamMap } from '@angular/router';
import { SpriteLabComponent } from './sprite-lab.component';
import { GameAccessService } from '../../core/services/game-access.service';
import { footprintBounds } from '../../battle/engine/footprint';
import { MONSTERS } from '../../core/data/monsters';

describe('expanded sprite lab actors and placement',()=>{
 const open=(gm=true)=>{
  TestBed.configureTestingModule({imports:[SpriteLabComponent],providers:[{provide:ActivatedRoute,useValue:{snapshot:{queryParamMap:convertToParamMap({render:'dom'})}}},{provide:GameAccessService,useValue:{isGm:()=>gm}}]});
  return TestBed.createComponent(SpriteLabComponent);
 };
 it('selects a real boss caster and exposes its named skill slots',()=>{
  const f=open(),lab=f.componentInstance;lab.selectActor('monster:aegis_sentinel');
  expect(lab.units()[0].sprite).toBe('enemy-aegis-sentinel.png');expect(lab.units()[0].boss).toBeTrue();
  expect(lab.actions().filter(a=>/^m\d+$/.test(a.id)).map(a=>a.label)).toEqual(['ตั้งโล่พิทักษ์','คำพิพากษาแห่งประตู','ทวนแสงทะลวงแนว']);
  f.destroy();
 });
 it('places both sides by cell and rejects a partial off-board boss footprint',()=>{
  const f=open(),lab=f.componentInstance;lab.selectActor('monster:jadecrest_guardian');
  lab.place(1,{r:0,c:1});expect(lab.logicalCell(1)).toEqual({r:2,c:11});expect(lab.placementMessage()).toBeTruthy();
  lab.place(1,{r:2,c:12});expect(lab.logicalCell(1)).toEqual({r:2,c:12});
  lab.setCell(2,'c',5);expect(lab.logicalCell(2).c).toBe(4);lab.selectActor('bailong');lab.setTargetCount(2);expect(lab.logicalCell(2).c).toBeGreaterThan(lab.logicalCell(1).c);f.destroy();
 });
 it('fits multiple boss targets in free whole bodies instead of overlapping them',()=>{
  const f=open(),lab=f.componentInstance;lab.selectTarget('aegis_sentinel');lab.setTargetCount(6);
  const cells=lab.units().filter(u=>u.id!==1).map(u=>footprintBounds({pos:lab.logicalCell(u.id),footprint:MONSTERS['aegis_sentinel'].stats.footprint}));
  expect(cells.length).toBeGreaterThan(0);expect(cells.length).toBeLessThan(6);
  cells.forEach(b=>{expect(b.c0).toBeGreaterThanOrEqual(0);expect(b.c1).toBeLessThan(16);});
  for(let i=0;i<cells.length;i++)for(let j=i+1;j<cells.length;j++)expect(cells[i].c0<=cells[j].c1&&cells[i].c1>=cells[j].c0&&cells[i].r0<=cells[j].r1&&cells[i].r1>=cells[j].r0).toBeFalse();
  f.destroy();
 });
 it('uses native Aegis release effects and cancels pending events when changing actors',fakeAsync(()=>{
  const f=open(),lab=f.componentInstance;lab.selectActor('monster:aegis_sentinel');lab.play('m1');tick(1900);
  expect(lab.fx().some(f=>f.name==='ae-s3-wave')).toBeTrue();expect(lab.anims()[1]?.castTime).toBe(0);lab.selectActor('bailong');tick(16000);
  expect(lab.fx()).toEqual([]);expect(lab.floats()).toEqual([]);f.destroy();
 }));
 it('gives every boss skill a button (Elder Treant has 4)',()=>{
  const f=open(),lab=f.componentInstance;lab.selectActor('monster:elder_treant');
  expect(lab.actions().filter(a=>/^m\d+$/.test(a.id)).length).toBe(MONSTERS['elder_treant'].skills.length);f.destroy();
 });
 it('brings out-of-range dummies in front of a melee skill and still casts it',fakeAsync(()=>{
  const f=open(),lab=f.componentInstance;lab.selectActor('monster:alpha_wolf');
  const slot=MONSTERS['alpha_wolf'].skills.indexOf('charge_claw');lab.play(`m${slot}` as never);
  expect(Math.abs(lab.logicalCell(2).c-lab.logicalCell(1).c)).toBeLessThanOrEqual(2);
  expect(lab.log().some(l=>l.text.includes('ออกสกิลจริง'))).toBeFalse();tick(1200);
  expect(lab.log().some(l=>l.text.includes('ออกสกิลจริง'))).toBeTrue();lab.reset();f.destroy();
 }));
 it('shows the cast FX and the units Call of the Forest summons',fakeAsync(()=>{
  const f=open(),lab=f.componentInstance;lab.selectActor('monster:elder_treant');
  lab.play(`m${MONSTERS['elder_treant'].skills.indexOf('call_of_the_forest')}` as never);tick(400);
  expect(lab.fx().some(x=>x.name==='fa-call-charge')).toBeTrue();tick(3200);
  expect(lab.units().filter(u=>u.id>=200).map(u=>u.sprite).sort()).toEqual([MONSTERS['forest_wolf'].animation.sheet,MONSTERS['mushroom_creature'].animation.sheet].sort());
  expect(lab.placeable().every(u=>u.id<200)).toBeTrue();lab.reset();expect(lab.units().some(u=>u.id>=200)).toBeFalse();f.destroy();
 }));
 it('does not enable monster tools for a player through direct calls',()=>{
  const f=open(false),lab=f.componentInstance;lab.selectActor('monster:aegis_sentinel');expect(lab.actorMonster()).toBeUndefined();
  expect(lab.actions().map(a=>a.id)).toEqual(['skill','skill2','ult']);f.destroy();
 });
});
