import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ITEMS } from '../../core/data/economy';
import { EQUIPMENT_DEFS } from '../../core/data/equipment';
import { SaveService } from '../../core/services/save.service';
import { HomeBagComponent } from './home-bag.component';

@Component({ template: '' })
class StubPage {}

describe('HomeBagComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [HomeBagComponent],
      providers: [provideRouter([{ path: '**', component: StubPage }])],
    }).compileComponents();
  });

  function make() {
    const f = TestBed.createComponent(HomeBagComponent); f.detectChanges();
    return { f, c: f.componentInstance, el: f.nativeElement as HTMLElement, save: TestBed.inject(SaveService) };
  }

  it('dev seed fills all three tabs; every item id appears exactly once', () => {
    const { f, c, el, save } = make();
    save.update(s => ({ ...s, inventory: {}, equipment: [] }));
    (el.querySelector('.dev') as HTMLButtonElement).click(); f.detectChanges();
    const items = c.slots().filter(x => x.type === 'item').map(x => x.id);
    expect(items.sort()).toEqual(Object.keys(ITEMS).sort());
    expect(c.slots().filter(x => x.type === 'equipment').length).toBe(Object.keys(EQUIPMENT_DEFS).length);
    for (const t of c.tabs) expect(c.counts()[t.id]).toBeGreaterThan(0);
    expect(el.querySelectorAll('.slot').length).toBe(c.counts().equipment);
  });

  it('large stacks are shown in 999 slots', () => {
    const { f, c, el, save } = make();
    save.update(s => ({ ...s, inventory: { astral_summon_seal: 2500 } }));
    c.pickTab('summon'); f.detectChanges();
    expect([...el.querySelectorAll('.slot .n')].map(n => n.textContent!.trim())).toEqual(['999', '999', '502']);
  });

  it('use opens the related page', () => {
    const { c, save } = make();
    const nav = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    save.update(s => ({ ...s, inventory: { exp_potion_s: 1, astral_summon_seal: 1, enhancement_ore: 1, skill_tome_1: 1 } }));
    const slot = (id: string) => c.slots().find(x => x.id === id)!;
    const uid = save.state().team[0]?.uid ?? save.state().heroes[0].uid;
    c.use(slot('exp_potion_s')); expect(nav).toHaveBeenCalledWith(`/heroes/${uid}?tab=growth`);
    c.use(slot('skill_tome_1')); expect(nav).toHaveBeenCalledWith(`/heroes/${uid}?tab=skills`);
    c.use(slot('astral_summon_seal')); expect(nav).toHaveBeenCalledWith('/gacha');
    c.use(slot('enhancement_ore')); expect(nav).toHaveBeenCalledWith('/forge?tab=enhance');
  });

  it('sell uses the equipment rule; plain items have a disabled sell', () => {
    const { f, c, el, save } = make();
    save.update(s => ({ ...s, inventory: { exp_potion_s: 3 }, equipment: [] }));
    c.seed(); f.detectChanges();
    const gold = save.state().gold;
    const gear = c.slots().find(x => x.type === 'equipment')!;
    c.sell(gear);
    expect(save.state().gold).toBe(gold + gear.sellGold!);
    expect(save.state().equipment.some(i => i.instanceId === gear.instance!.instanceId)).toBeFalse();
    c.pickTab('materials'); f.detectChanges();
    expect((el.querySelector('.sell') as HTMLButtonElement).disabled).toBeTrue();
    expect(el.querySelector('.hint')!.textContent).toContain('ยังขายไม่ได้');
  });
});
