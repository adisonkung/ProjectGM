import { SUMMON_SEALS } from '../data/summon-seals';
import { TestBed } from '@angular/core/testing';

import { SaveService } from './save.service';
import { GachaService } from './gacha.service';

describe('GachaService', () => {
  let service: GachaService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(GachaService);
  });

  it('spends ten standard seals atomically without touching gems or the other seal types', () => {
    spyOnProperty(service, 'freeSummons', 'get').and.returnValue(false);
    const save = TestBed.inject(SaveService);
    save.update(s => ({...s,gems:1234,inventory:{...s.inventory,[SUMMON_SEALS.standard.id]:10,[SUMMON_SEALS.special.id]:3,[SUMMON_SEALS.aurora.id]:4}}));
    expect(service.summon(10)?.length).toBe(10);
    expect(save.state().gems).toBe(1234);
    expect(save.state().inventory[SUMMON_SEALS.standard.id]).toBe(0);
    expect(save.state().inventory[SUMMON_SEALS.special.id]).toBe(3);
    expect(save.state().inventory[SUMMON_SEALS.aurora.id]).toBe(4);
    const committed=JSON.stringify(save.state());
    expect(service.summon(1)).toBeNull();
    expect(JSON.stringify(save.state())).toBe(committed);
  });

  it('accepts a single seal at zero gems, and treats an absent seal balance as zero', () => {
    spyOnProperty(service, 'freeSummons', 'get').and.returnValue(false);
    const save = TestBed.inject(SaveService);
    save.update(s=>({...s,gems:0}));
    const before=JSON.stringify(save.state());
    expect(service.summon(1)).toBeNull();expect(JSON.stringify(save.state())).toBe(before);
    save.update(s=>({...s,inventory:{...s.inventory,[SUMMON_SEALS.standard.id]:1}}));
    expect(service.summon(1)?.length).toBe(1);
    expect(save.state().inventory[SUMMON_SEALS.standard.id]).toBe(0);
    expect(save.state().gems).toBe(0);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
  it('enables the user-requested free mode through the real service, including at zero gems', () => {
    const save = TestBed.inject(SaveService);
    save.update(s => ({ ...s, gems: 0 }));
    expect(service.freeSummons).toBeTrue();
    expect(service.summon(10)?.length).toBe(10);
    expect(save.state().gems).toBe(0);
  });
});
