import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';

import { provideRouter } from '@angular/router';
import { applyBuff } from '../../battle/engine/buffs';
import { STATUS_EFFECTS } from '../../core/data/status-effects';
import { BattleComponent } from './battle.component';
import { BattleEngine, BattleEvent } from '../../battle/engine/battle-engine';

describe('BattleComponent', () => {
  let component: BattleComponent;
  let fixture: ComponentFixture<BattleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BattleComponent],
      providers: [provideRouter([])],
    })
    .compileComponents();

    fixture = TestBed.createComponent(BattleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('keeps the Break pose through same-batch and later hits, and resolves the shield FX anchor/facing', fakeAsync(() => {
    component.start();component.openMenu();
    const host=component as unknown as {engine:BattleEngine;handleEvents(events:BattleEvent[]):void;snapshot():void};
    const boss=host.engine.units.find(u=>u.side==='enemy')!, hero=host.engine.units.find(u=>u.side==='ally')!;
    boss.sprite='enemy-aegis-sentinel.png';applyBuff(boss,STATUS_EFFECTS['broken'],hero.id);
    const hit:BattleEvent={type:'damage',dst:boss.id,amount:1,crit:false,blocked:0};
    host.handleEvents([{type:'broken',src:hero.id,dst:boss.id,skill:'aegis_judgement'},hit]);
    const key=component.anims()[boss.id].key;
    expect(component.anims()[boss.id].castClip).toBe('broken');
    host.handleEvents([hit]);expect(component.anims()[boss.id].key).toBe(key);
    host.snapshot();const core=component.fx().find(f=>f.name==='ae-core')!;
    expect(core.offset).toEqual([0,-44]);expect(core.flip).toBeTrue();
    tick(2000);component.ngOnDestroy();discardPeriodicTasks();
  }));
  it('shows the placement board before the battle starts', () => {
    expect(component).toBeTruthy();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('app-placement')).not.toBeNull();
    expect(el.querySelector('app-board')).toBeNull();
  });

  it('switches to the battle board after start', () => {
    component.start();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('app-board')).not.toBeNull();
    component.ngOnDestroy();
  });

  it('battle screen: wave panel + clock on top, one speed button cycling x1/x2/x4, party inside the field', () => {
    component.start();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.screen .hud-top .wave-panel')).not.toBeNull();
    expect(el.querySelector('.screen .hud-top .clock')).not.toBeNull();
    expect(el.querySelector('.screen app-party-bar.party-in .auto')).not.toBeNull();
    expect(el.querySelectorAll('.hud-right .hud-btn').length).toBe(2);
    const spd = el.querySelector<HTMLButtonElement>('.hud-btn.spd')!;
    expect(spd.textContent).toContain('x1');
    spd.click(); fixture.detectChanges();
    expect(component.speed()).toBe(2);
    spd.click(); spd.click(); fixture.detectChanges();
    expect(component.speed()).toBe(1);
    component.ngOnDestroy();
  });

  it('settings popup pauses the fight: resume / restart / exit to placement', () => {
    component.start();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    component.openMenu();
    fixture.detectChanges();
    expect(component.paused()).toBeTrue();
    const btns = [...el.querySelectorAll<HTMLButtonElement>('.menu button')].map(b => b.textContent!.trim());
    expect(btns.some(t => t.includes('เล่นต่อ'))).toBeTrue();
    expect(btns.some(t => t.includes('เริ่มใหม่'))).toBeTrue();
    expect(btns.some(t => t.includes('ออกจากด่าน'))).toBeTrue();
    // paused: the engine clock does not advance
    const t0 = component.time();
    (component as unknown as { tick(): void }).tick();
    expect(component.time()).toBe(t0);
    component.resume();
    expect(component.paused()).toBeFalse();
    expect(component.menuOpen()).toBeFalse();
    component.openMenu();
    component.restart();
    expect(component.running()).toBeTrue();
    expect(component.paused()).toBeFalse();
    expect(component.time()).toBe(0);
    component.openMenu();
    component.exitStage();
    fixture.detectChanges();
    expect(component.running()).toBeFalse();
    expect(el.querySelector('app-placement')).not.toBeNull();
    component.ngOnDestroy();
  });

  it('stage end: a short outro on the battle screen before the result popup', fakeAsync(() => {
    component.start();
    component.setSpeed(4);
    component.fx.set([{id:99999,r:1,c:5,name:'vn-ult-phantom-1',angle:0,owner:99999,managed:true}]);
    const step = () => (component as unknown as { tick(): void }).tick();
    for (let i = 0; i < 6000 && !component.ending(); i++) step();
    expect(component.ending()).toBeTrue();
    expect(component.fx().some(f=>f.owner===99999)).toBeFalse();
    expect(component.result()).toBeNull();
    expect(component.outcome()).not.toBeNull(); // rewards already granted
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.overlay')).toBeNull();
    tick(BattleComponent.OUTRO_MS + 10);
    fixture.detectChanges();
    expect(component.ending()).toBeFalse();
    expect(component.result()).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.overlay .result-card')).not.toBeNull();
    discardPeriodicTasks();
    component.ngOnDestroy();
  }));

  it('ground FX retain the cast cell after target death; immunity does not show Bind, successful Root does', fakeAsync(() => {
    component.start();
    component.openMenu();
    const host = component as unknown as { engine: BattleEngine; handleEvents(events: BattleEvent[]): void };
    const engine = host.engine;
    const caster = engine.units.find(u => u.side === 'ally')!;
    const target = engine.units.find(u => u.side === 'enemy')!;
    caster.sprite = 'hero-mirelle.png'; caster.pos = { r: 1, c: 5 };
    target.pos = { r: 1, c: 9 };
    host.handleEvents([{ type: 'cast', src: caster.id, dst: target.id, kind: 'skill2', skill: 'Glassbind' }]);
    // The original target moved and died during the cast. Engine AoE uses its captured cast-start cell.
    target.pos = { r: 2, c: 12 }; target.alive = false;
    host.handleEvents([{ type: 'animEvent', src: caster.id, kind: 'skill2', event: 'VFX_SPAWN', name: 'GLASSBIND_VFX' }]);
    const main = component.fx().find(f => f.name === 'mf-s2-main')!;
    expect(main.r).toBe(1.5);
    expect(main.c).toBe(9.5 + engine.formation.originPosition - engine.cameraX);
    host.handleEvents([{ type: 'immune', src: caster.id, dst: target.id, skill: 'Root' }]);
    expect(component.fx().some(f => f.name === 'mf-s2-bind')).toBeFalse();
    target.alive = true;
    host.handleEvents([{ type: 'buff', src: caster.id, dst: target.id, buff: 'root', name: 'Root', refreshed: false }]);
    expect(component.fx().filter(f => f.name === 'mf-s2-bind').length).toBe(1);
    tick(2000);
    component.ngOnDestroy();
    discardPeriodicTasks();
  }));

  it('cleans all pending/lingering execution layers on cancel, death, interrupt, normal end and wave transitions', fakeAsync(() => {
    component.start();component.openMenu();
    const host=component as unknown as {engine:BattleEngine;handleEvents(events:BattleEvent[]):void};
    const caster=host.engine.units.find(u=>u.side==='ally')!, target=host.engine.units.find(u=>u.side==='enemy')!;
    caster.sprite='hero-vaelric.png';
    const cast:BattleEvent={type:'cast',src:caster.id,dst:target.id,kind:'ult',skill:'Funeral of a Thousand Cuts'};
    const endings:BattleEvent[]=[
      {type:'castCancel',src:caster.id,skill:'ult',reason:'phase'},
      {type:'death',dst:caster.id},{type:'interrupt',src:target.id,dst:caster.id,skill:'interrupt'},
      {type:'ADVANCE_STARTED',from:0,to:1,duration:1}, {type:'REGROUP_STARTED',heroes:[caster.id]},
    ];
    for(const end of endings) {
      host.handleEvents([cast]);expect(component.fx().filter(f=>f.owner===caster.id).length).toBe(30);
      host.handleEvents([end]);expect(component.fx().filter(f=>f.owner===caster.id)).toEqual([]);
    }
    host.handleEvents([cast]);
    host.handleEvents([{type:'animEvent',src:caster.id,kind:'ult',event:'ANIMATION_END',name:'ULT_END'}]);
    expect(component.fx().every(f=>!!f.track)).toBeTrue();expect(component.fx().length).toBe(30);
    component.onFxFinished(component.fx().map(f=>f.id));expect(component.fx()).toEqual([]);
    host.handleEvents([cast]);component.exitStage();expect(component.fx()).toEqual([]);
    tick(5000);component.ngOnDestroy();discardPeriodicTasks();
  }));

  it('field events own the managed loop and only natural expiry produces the visual shatter', fakeAsync(() => {
    component.start(); component.openMenu();
    const host = component as unknown as { engine: BattleEngine; handleEvents(events: BattleEvent[]): void };
    const caster = host.engine.units.find(u => u.side === 'ally')!;
    caster.sprite = 'hero-mirelle.png';
    const base = { fieldId: 1, src: caster.id, at: { r: 1, c: 9 }, area: 'ADJACENT_8' as const, duration: 6 };
    host.handleEvents([{ ...base, type: 'FIELD_STARTED' }]);
    expect(component.fx().some(f => f.name === 'mf-ult-field' && f.loop && f.managed)).toBeTrue();
    host.handleEvents([{ ...base, type: 'FIELD_ENDED', reason: 'SOURCE_DIED' }]);
    expect(component.fx()).toEqual([]);
    host.handleEvents([{ ...base, fieldId: 2, type: 'FIELD_STARTED' }]);
    host.handleEvents([{ ...base, fieldId: 2, type: 'FIELD_ENDED', reason: 'EXPIRED' }]);
    expect(component.fx().map(f => f.name)).toEqual(['mf-ult-shatter', 'mf-ult-residual']);
    expect(component.floats().some(f => f.kind === 'dmg')).toBeFalse();
    component.ngOnDestroy(); discardPeriodicTasks();
  }));
});
