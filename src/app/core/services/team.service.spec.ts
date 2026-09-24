import { TestBed } from '@angular/core/testing';
import { newGameState } from '../data/starter';
import { SaveService } from './save.service';
import { TeamService } from './team.service';

describe('TeamService', () => {
  let service: TeamService;
  let save: SaveService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    save = TestBed.inject(SaveService);
    save.reset();
    service = TestBed.inject(TeamService);
  });

  const slot = (uid: number) => service.slots().find(s => s.uid === uid);

  it('starts with a full auto-placed team', () => {
    expect(service.slots().length).toBe(5);
    expect(service.isFull()).toBeTrue();
  });

  it('moves a hero to an empty cell', () => {
    const uid = service.slots()[0].uid;
    expect(service.place(uid, 2, 6)).toBeTrue();
    expect(slot(uid)).toEqual({ uid, r: 2, c: 6 });
  });

  it('swaps two heroes when dropping on an occupied cell', () => {
    const [a, b] = service.slots();
    service.place(a.uid, b.r, b.c);
    expect(slot(a.uid)).toEqual({ uid: a.uid, r: b.r, c: b.c });
    expect(slot(b.uid)).toEqual({ uid: b.uid, r: a.r, c: a.c });
  });

  it('refuses a 6th hero on an empty cell but replaces on an occupied one', () => {
    save.update(s => ({ ...s, heroes: [...s.heroes, { uid: 99, templateId: 'bron', level: 1, potential: 'C', injury: 0 }] }));
    const occupied = service.slots()[0];
    const free = { r: 2, c: 0 };
    expect(service.slots().some(s => s.r === free.r && s.c === free.c)).toBeFalse();
    expect(service.place(99, free.r, free.c)).toBeFalse();
    expect(service.place(99, occupied.r, occupied.c)).toBeTrue();
    expect(slot(occupied.uid)).toBeUndefined();
    expect(service.slots().length).toBe(5);
  });

  it('removes and clears', () => {
    const uid = service.slots()[0].uid;
    service.remove(uid);
    expect(slot(uid)).toBeUndefined();
    service.clear();
    expect(service.slots().length).toBe(0);
    expect(service.units().length).toBe(0);
  });

  it('auto skips injured heroes', () => {
    const st = newGameState();
    save.update(() => ({ ...st, heroes: st.heroes.map((h, i) => (i === 0 ? { ...h, injury: 2 } : h)) }));
    service.auto();
    expect(slot(st.heroes[0].uid)).toBeUndefined();
    expect(service.slots().length).toBe(4);
  });
});
