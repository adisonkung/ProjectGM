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
