import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { SaveService } from '../../core/services/save.service';
import { ForgeComponent } from './forge.component';

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

  it('previews the real accessory main value and only spends materials on crafting', () => {
    const f = TestBed.createComponent(ForgeComponent); f.detectChanges();
    const c = f.componentInstance, save = TestBed.inject(SaveService);
    save.update(s => ({ ...s, gold: 5000, inventory: { ...s.inventory, equip_frag_rare: 40 } }));
    const before = save.state();
    c.setTab('craft'); c.pickSlot('ACCESSORY'); c.craftMain.set('hpPct'); f.detectChanges();
    expect(c.mainPreview()).toBe('HP +3.0 %');
    expect(save.state()).toBe(before);
    c.craft(); f.detectChanges();
    expect(save.state().gold).toBe(before.gold - c.recipe().gold);
    expect(save.state().inventory['equip_frag_rare']).toBe(0);
    expect(save.state().equipment.length).toBe(1);
    expect(save.state().equipment[0].main.value).toBe(.03);
    expect(c.canCraft()).toBeFalse();
  });
});
