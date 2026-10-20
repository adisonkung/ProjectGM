import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { rollItem } from '../../core/rules/equipment';
import { SaveService } from '../../core/services/save.service';
import { ArmoryComponent } from './armory.component';

describe('Armory selection and equipment actions', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ArmoryComponent],
      providers: [provideRouter([]), { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ hero: '1' }) } } }],
    }).compileComponents();
    const save = TestBed.inject(SaveService);
    save.reset();
    save.update(s => ({ ...s, equipment: [rollItem('heavy_blade', 'RARE', () => .5, 101), rollItem('twin_daggers', 'UNCOMMON', () => .5, 102), rollItem('guard_armor', 'ELITE', () => .5, 103)] }));
  });

  it('selects a bag item, equips it once and can inspect and remove the same instance', () => {
    const f = TestBed.createComponent(ArmoryComponent); f.detectChanges();
    const c = f.componentInstance;
    c.selectedId.set(101); f.detectChanges();
    const selected = c.selected()!;
    c.equip(selected); f.detectChanges();
    const save = TestBed.inject(SaveService);
    expect(save.state().heroes[0].gear?.WEAPON?.instanceId).toBe(101);
    expect(c.selectedWorn()).toBeTrue();
    expect(c.bag().some(i => i.instanceId === 101)).toBeFalse();
    c.unequip('WEAPON'); f.detectChanges();
    expect(c.selected()!.instanceId).toBe(101);
    expect(c.selectedWorn()).toBeFalse();
    expect(c.bag().filter(i => i.instanceId === 101).length).toBe(1);
  });

  it('prevents incompatible equip and locked sale; selection recovers after selling', () => {
    const f = TestBed.createComponent(ArmoryComponent); f.detectChanges();
    const c = f.componentInstance, save = TestBed.inject(SaveService);
    c.selectedId.set(102); f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.equip-action')!.disabled).toBeTrue();
    c.equip(c.selected()!); expect(save.state().heroes[0].gear?.WEAPON).toBeUndefined();
    c.selectedId.set(103); c.toggleLock(c.selected()!); f.detectChanges();
    const before = save.state(); c.sell(c.selected()!);
    expect(save.state()).toBe(before);
    c.toggleLock(c.selected()!); c.sell(c.selected()!); f.detectChanges();
    expect(c.selected()!.instanceId).not.toBe(103);
    expect(save.state().equipment.some(i => i.instanceId === 103)).toBeFalse();
  });

  it('filters and sorts presentation without changing the save', () => {
    const f = TestBed.createComponent(ArmoryComponent); f.detectChanges();
    const c = f.componentInstance, save = TestBed.inject(SaveService), before = save.state();
    c.sort.set('rarity'); expect(c.bag()[0].instanceId).toBe(103);
    c.chooseFilter('WEAPON'); expect(c.bag().length).toBe(2);
    expect(c.bag().every(i => c.slotOf(i) === 'WEAPON')).toBeTrue();
    c.chooseFilter('ACCESSORY'); f.detectChanges();
    expect(c.selected()).toBeNull();
    expect((f.nativeElement as HTMLElement).querySelector('.bag-empty')).not.toBeNull();
    expect(save.state()).toBe(before);
  });
});
