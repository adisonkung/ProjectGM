import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { SaveService } from '../../core/services/save.service';
import { ForgeComponent } from './forge.component';
import { rollItem } from '../../core/rules/equipment';
import { EQUIPMENT_DEFS } from '../../core/data/equipment';
import { ForgeLayout } from './forge-layout';

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

describe('Forge desktop Anvil', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [ForgeComponent], providers: [provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
      { provide: ForgeLayout, useValue: { desktop: signal(true) } }] }).compileComponents();
  });

  it('renders the left menu rail and moves through tabs with the vertical arrow keys', () => {
    const f = TestBed.createComponent(ForgeComponent); f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('.anvil-rail')).not.toBeNull();
    expect(el.querySelectorAll('.anvil-rail [role=tab]').length).toBe(3);
    el.querySelector('#forge-tab-craft')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); f.detectChanges();
    expect(f.componentInstance.tab()).toBe('enhance');
    expect(el.querySelector('#forge-panel')!.getAttribute('aria-labelledby')).toBe('forge-tab-enhance');
  });

  it('crafts ×10 only when all ten are paid for, then shows the whole batch', () => {
    const f = TestBed.createComponent(ForgeComponent); f.detectChanges();
    const c = f.componentInstance, save = TestBed.inject(SaveService);
    save.update(s => ({ ...s, gold: 8000, inventory: { ...s.inventory, equip_frag_rare: 399 } }));
    c.pickTier('RARE'); c.pickKind('weapon'); c.craftQty.set(10); f.detectChanges();
    expect(c.maxCraft()).toBe(9);
    expect(c.canCraft()).toBeFalse();
    const before = save.state();
    c.craft();
    expect(save.state()).toBe(before);
    save.update(s => ({ ...s, inventory: { ...s.inventory, equip_frag_rare: 400 } }));
    expect(c.canCraft()).toBeTrue();
    c.craft(); f.detectChanges();
    expect(save.state().equipment.length).toBe(10);
    expect(save.state().gold).toBe(0);
    expect(save.state().inventory['equip_frag_rare']).toBe(0);
    expect(save.state().equipment.every(i => EQUIPMENT_DEFS[i.definitionId].slot === 'WEAPON' && i.rarity === 'RARE')).toBeTrue();
    expect(c.craftBatch().length).toBe(10);
    expect(c.fx()?.kind).toBe('craft');
    expect(f.nativeElement.querySelectorAll('.anvil-grid.results li').length).toBe(10);
  });

  it('shows T1–T5, keeps tiers without a recipe and illustrative kinds locked', () => {
    const f = TestBed.createComponent(ForgeComponent); f.detectChanges();
    const c = f.componentInstance;
    expect(c.tiers.map(t => t.no)).toEqual(['T1', 'T2', 'T3', 'T4', 'T5']);
    expect(c.tiers[0].open).toBeFalse();
    c.pickTier('RARE'); c.pickTier('COMMON');
    expect(c.craftRarity()).toBe('RARE');
    c.pickKind('helmet'); c.pickKind('artifact');
    expect(c.craftKind()).toBe('armor');
    c.pickKind('ring');
    expect(c.slotFilter()).toBe('ACCESSORY');
    expect(c.accessoryPreview()).toBe('ring');
    f.detectChanges();
    const tierButtons: HTMLButtonElement[] = Array.from(f.nativeElement.querySelectorAll('.anvil-tiers button'));
    expect(tierButtons.map(b => b.disabled)).toEqual([true, false, false, false, false]);
  });

  it('enhances with the shared effect and quick-selects salvage by rarity without locked items', () => {
    const f = TestBed.createComponent(ForgeComponent); f.detectChanges();
    const c = f.componentInstance, save = TestBed.inject(SaveService);
    const rare = rollItem('heavy_blade', 'RARE', () => .25, 1);
    const locked = { ...rollItem('guard_armor', 'RARE', () => .25, 2), locked: true };
    const common = rollItem('guard_armor', 'COMMON', () => .25, 3);
    save.update(s => ({ ...s, gold: 1000, equipment: [rare, locked, common], nextItemId: 4, inventory: { ...s.inventory, enhancement_ore: 50 } }));
    c.setTab('enhance'); c.selectedEnhanceId.set(rare.instanceId); f.detectChanges();
    c.anvilUpgrade(c.anvilEnhance()!.item);
    expect(save.state().equipment.find(i => i.instanceId === 1)!.upgradeLevel).toBe(1);
    expect(save.state().inventory['enhancement_ore']).toBe(40);
    expect(c.fx()).toEqual(jasmine.objectContaining({ kind: 'enhance', level: 1 }));
    c.setTab('salvage'); f.detectChanges();
    c.selectSalvageRarity('RARE');
    expect(c.selectedSalvage().map(i => i.instanceId)).toEqual([1]);
    c.prepareDismantle(); c.confirmDismantle();
    expect(save.state().equipment.map(i => i.instanceId)).toEqual([2, 3]);
    expect(c.fx()).toEqual(jasmine.objectContaining({ kind: 'salvage', count: 1 }));
  });
});
