import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { SaveService } from '../../core/services/save.service';
import { ForgeComponent } from './forge.component';
import { rollItem } from '../../core/rules/equipment';
import { EQUIPMENT_DEFS } from '../../core/data/equipment';

describe('Forge selection preview', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [ForgeComponent], providers: [provideRouter([]), { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ tab: 'enhance' }) } } }] }).compileComponents();
  });

  it('honours deep links and supports keyboard tab navigation', () => {
    const f = TestBed.createComponent(ForgeComponent); f.detectChanges();
    expect(f.componentInstance.tab()).toBe('enhance');
    const el: HTMLElement = f.nativeElement;
    el.querySelector('#forge-tab-enhance')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); f.detectChanges();
    expect(f.componentInstance.tab()).toBe('salvage');
    expect(el.querySelector('#forge-panel')!.getAttribute('aria-labelledby')).toBe('forge-tab-salvage');
    el.querySelector('#forge-tab-salvage')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })); f.detectChanges();
    expect(f.componentInstance.tab()).toBe('craft');
  });

  it('shows random crafting and only spends materials on crafting', () => {
    const f = TestBed.createComponent(ForgeComponent); f.detectChanges();
    const c = f.componentInstance, save = TestBed.inject(SaveService);
    save.update(s => ({ ...s, gold: 5000, inventory: { ...s.inventory, equip_frag_rare: 40 } }));
    const before = save.state();
    c.setTab('craft'); c.pickSlot('ACCESSORY'); f.detectChanges();
    expect(f.nativeElement.textContent).toContain('สุ่มค่าสถานะหลัก');
    expect(f.nativeElement.querySelector('.bases')).toBeNull();
    expect(save.state()).toBe(before);
    c.craft(); f.detectChanges();
    expect(save.state().gold).toBe(before.gold - c.recipe().gold);
    expect(save.state().inventory['equip_frag_rare']).toBe(0);
    expect(save.state().equipment.length).toBe(1);
    const crafted = save.state().equipment[0];
    expect(EQUIPMENT_DEFS[crafted.definitionId].slot).toBe('ACCESSORY');
    expect(EQUIPMENT_DEFS[crafted.definitionId].mainStats).toContain(crafted.main.stat);
    expect(c.canCraft()).toBeFalse();
  });
  it('recovers the enhancement preview when a filter hides the selected item without spending resources', () => {
    const f = TestBed.createComponent(ForgeComponent); f.detectChanges();
    const c = f.componentInstance, save = TestBed.inject(SaveService);
    const weapon = rollItem('heavy_blade', 'RARE', () => .25, 1);
    const armor = rollItem('guard_armor', 'RARE', () => .25, 2);
    save.update(s => ({ ...s, equipment: [weapon, armor], nextItemId: 3 }));
    c.selectedEnhanceId.set(weapon.instanceId);
    const before = save.state();
    c.enhanceSlot.set('ARMOR'); f.detectChanges();
    expect(c.selectedEnhance()?.item.instanceId).toBe(armor.instanceId);
    expect(save.state()).toBe(before);
    c.enhanceSlot.set('ACCESSORY'); f.detectChanges();
    expect(c.selectedEnhance()).toBeNull();
    expect(f.nativeElement.querySelector('.preview-empty')).not.toBeNull();
    expect(save.state()).toBe(before);
  });

  it('selects all eligible items, excludes locks and cancels confirmation without changing saves', () => {
    const f = TestBed.createComponent(ForgeComponent); f.detectChanges();
    const c = f.componentInstance, save = TestBed.inject(SaveService);
    const a = rollItem('heavy_blade', 'RARE', () => .25, 1);
    const b = { ...rollItem('guard_armor', 'RARE', () => .25, 2), locked: true };
    save.update(s => ({ ...s, equipment: [a,b], nextItemId: 3 }));
    const before = save.state();
    c.selectAllSalvage(true);
    expect(c.selectedSalvage().map(i => i.instanceId)).toEqual([1]);
    expect(c.allSalvageSelected()).toBeTrue();
    c.prepareDismantle(); c.pendingDismantleIds.set([]);
    expect(save.state()).toBe(before);
    c.prepareDismantle(); c.confirmDismantle();
    expect(save.state().equipment.map(i => i.instanceId)).toEqual([2]);
    expect(c.selectedSalvage().length).toBe(0);
    expect(save.state().inventory['enhancement_ore']).toBe((before.inventory['enhancement_ore'] ?? 0) + 8);
  });

});
