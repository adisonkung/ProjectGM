import '../../../testing/legacy-roster';
import { TestBed } from '@angular/core/testing';
import { newGameState } from '../data/starter';
import { migrate, SaveService } from '../services/save.service';
import { TeamService } from '../services/team.service';
import { normalizePresets, presetToTeam, TEAM_PRESET_COUNT } from './team';

describe('Team presets (Phase 4)', () => {
  let team: TeamService;
  let save: SaveService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    save = TestBed.inject(SaveService);
    save.reset();
    team = TestBed.inject(TeamService);
  });

  it('a new game has empty named presets; old v6 saves get them from migrate', () => {
    expect(team.presets().length).toBe(TEAM_PRESET_COUNT);
    expect(team.presets().every(p => p.team.length === 0 && p.name)).toBeTrue();
    const old = newGameState() as unknown as Record<string, unknown>;
    delete old['teamPresets'];
    expect(migrate(old)!.teamPresets!.length).toBe(TEAM_PRESET_COUNT);
  });

  it('save → change team → load restores heroes and cells; the matching preset is marked active', () => {
    const before = team.slots().map(s => ({ ...s }));
    team.savePreset(1);
    expect(team.activePreset()).toBe(1);
    team.clear();
    team.place(save.state().heroes[7].uid, 2, 1);
    expect(team.activePreset()).toBe(-1);
    expect(team.loadPreset(1)).toBeTrue();
    expect([...team.slots()].sort((a, b) => a.uid - b.uid)).toEqual([...before].sort((a, b) => a.uid - b.uid));
    expect(team.activePreset()).toBe(1);
  });

  it('empty presets do not load; rename trims and keeps the old name when blank', () => {
    expect(team.loadPreset(2)).toBeFalse();
    team.renamePreset(0, '  Boss Duel  ');
    team.renamePreset(0, '   ');
    expect(team.presets()[0].name).toBe('Boss Duel');
  });

  it('presetToTeam drops unknown heroes, duplicates, taken cells and off-board cells', () => {
    const heroes = newGameState().heroes;
    const t = presetToTeam({ name: 'x', team: [
      { uid: 1, r: 0, c: 1 }, { uid: 1, r: 1, c: 1 }, { uid: 2, r: 0, c: 1 }, { uid: 3, r: 9, c: 0 }, { uid: 999, r: 2, c: 2 }, { uid: 4, r: 2, c: 2 },
    ] }, heroes);
    expect(t).toEqual([{ uid: 1, r: 0, c: 1 }, { uid: 4, r: 2, c: 2 }]);
    expect(normalizePresets([{ name: '', team: [] }]).map(p => p.name)).toEqual(['ทีม A', 'ทีม B', 'ทีม C']);
  });
});
