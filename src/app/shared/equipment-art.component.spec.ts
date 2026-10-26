import { TestBed } from '@angular/core/testing';
import { EquipmentArtComponent } from './equipment-art.component';
import { EquipmentAuraComponent } from './equipment-aura.component';

describe('Equipment presentation identity', () => {
  it('preserves an owned accessory appearance across bag, inspect, forge, upgrade and rarity views', () => {
    const make = (context: 'inventory' | 'inspect' | 'forge') => {
      const f = TestBed.createComponent(EquipmentArtComponent);
      f.componentRef.setInput('definitionId', 'trinket');
      f.componentRef.setInput('context', context);
      return f;
    };
    const views = [make('inventory'), make('inspect'), make('forge')];
    const seen = new Set<string>();
    for (let instanceId = 1; instanceId <= 32; instanceId++) {
      for (const f of views) { f.componentRef.setInput('instanceId', instanceId); f.detectChanges(); }
      const family = views[0].componentInstance.family();
      seen.add(family);
      for (const f of views) {
        expect(f.componentInstance.family()).toBe(family);
        f.componentRef.setInput('level', 10);
        f.componentRef.setInput('rarity', 'EPIC');
        f.detectChanges();
        expect(f.componentInstance.family()).toBe(family);
        expect(f.nativeElement.querySelector('img.foreground').src).toContain('/' + family + '/epic');
      }
    }
    expect([...seen].sort()).toEqual(['necklace', 'ring']);
  });

  it('keeps bag effects paused and enables decorative motion only in an inspected view', () => {
    const f = TestBed.createComponent(EquipmentArtComponent);
    f.componentRef.setInput('definitionId', 'guard_armor');
    f.componentRef.setInput('rarity', 'EPIC');
    f.detectChanges();
    const aura = () => f.nativeElement.querySelector('app-equipment-aura');
    expect(aura().classList.contains('moving')).toBeFalse();
    expect(aura().querySelectorAll('.sparks i').length).toBe(0);
    f.componentRef.setInput('context', 'inspect'); f.detectChanges();
    expect(aura().classList.contains('moving')).toBeTrue();
    expect(aura().querySelectorAll('.sparks i').length).toBeGreaterThan(0);
    f.componentRef.setInput('context', 'inventory'); f.detectChanges();
    expect(aura().classList.contains('moving')).toBeFalse();
  });

  it('pauses live aura orbits while the document is hidden', () => {
    const hidden = spyOnProperty(document, 'hidden', 'get').and.returnValue(false);
    const f = TestBed.createComponent(EquipmentAuraComponent);
    f.componentRef.setInput('animated', true); f.detectChanges();
    expect(f.componentInstance.moving()).toBeTrue();
    hidden.and.returnValue(true); document.dispatchEvent(new Event('visibilitychange')); f.detectChanges();
    expect(f.componentInstance.moving()).toBeFalse();
    hidden.and.returnValue(false); document.dispatchEvent(new Event('visibilitychange')); f.detectChanges();
    expect(f.componentInstance.moving()).toBeTrue();
  });
});
