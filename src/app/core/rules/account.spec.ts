import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { islandNamedGuard, welcomeGuard } from '../../app.routes';
import { newGameState } from '../data/starter';
import { GameState } from '../models/game-state';
import { AccountService } from '../services/account.service';
import { migrate, SaveService } from '../services/save.service';
import { normalizeIsland } from './island';
import {
  checksum, decodeSaveText, encodeSaveCode, ISLAND_NAME_MAX, islandNameError, makeEnvelope, nameLength, needsIslandName,
  normalizeIslandName, setIslandName, suggestIslandName,
} from './account';

const named = (name = 'เกาะดารา'): GameState => {
  const s = newGameState();
  return setIslandName(s, name)!;
};

describe('Account — island name', () => {
  it('normalizes whitespace / invisible characters and counts Thai marks with their letter', () => {
    expect(normalizeIslandName('  เกาะ   ดารา ​ ')).toBe('เกาะ ดารา');
    expect(nameLength('ดาวน้ำ')).toBe(4); // ด า ว น้ำ — tone mark + sara am ride on น (one grapheme)
    expect(nameLength('Sky')).toBe(3);
  });

  it('validates length (2–16 visible characters), allowed characters and at least one letter/digit', () => {
    expect(islandNameError('')).toBeTruthy();
    expect(islandNameError('ก')).toContain('สั้น');
    expect(islandNameError('ก'.repeat(ISLAND_NAME_MAX))).toBeNull();
    expect(islandNameError('ก'.repeat(ISLAND_NAME_MAX + 1))).toContain('ยาว');
    expect(islandNameError('<script>')).toBeTruthy();
    expect(islandNameError('--__')).toBeTruthy();
    expect(islandNameError("Moon's Isle-2")).toBeNull();
    expect(islandNameError('เกาะมรกตลอยฟ้า')).toBeNull();
  });

  it('a new game has no name → needs naming; setIslandName stores the normalized name', () => {
    const s = newGameState();
    expect(needsIslandName(s)).toBeTrue();
    expect(setIslandName(s, 'x')).toBeNull();
    const n = setIslandName(s, '  เกาะ  ดารา ')!;
    expect(n.island!.name).toBe('เกาะ ดารา');
    expect(needsIslandName(n)).toBeFalse();
  });

  it('suggestions are always valid names', () => {
    for (let i = 0; i < 50; i++) expect(islandNameError(suggestIslandName())).withContext(suggestIslandName()).toBeNull();
  });

  it('the name survives save → load (migrate / normalizeIsland); an invalid stored name is dropped', () => {
    const s = named('Sky Haven');
    const back = migrate(JSON.parse(JSON.stringify(s)))!;
    expect(back.island!.name).toBe('Sky Haven');
    const bad = normalizeIsland({ ...s.island!, name: '<<>>' }, s);
    expect(bad.name).toBeUndefined();
  });
});

describe('Account — save transfer', () => {
  it('compressed code round-trips the whole save and is much shorter than the JSON', async () => {
    const s = named();
    const env = makeEnvelope(s, new Date('2026-09-28T10:00:00Z'));
    const code = await encodeSaveCode(env);
    expect(code.startsWith('ST1Z.')).toBeTrue();
    expect(code.length).toBeLessThan(JSON.stringify(env).length);
    const r = await decodeSaveText(code);
    expect(r.ok).toBeTrue();
    if (r.ok) {
      expect(r.envelope.state).toEqual(s);
      expect(r.envelope.islandName).toBe('เกาะดารา');
    }
  });

  it('plain code and pasted file JSON both decode; whitespace / line breaks in a pasted code are ignored', async () => {
    const env = makeEnvelope(named());
    const plain = await encodeSaveCode(env, false);
    expect(plain.startsWith('ST1.')).toBeTrue();
    const wrapped = plain.replace(/(.{60})/g, '$1\n  ');
    expect((await decodeSaveText(wrapped)).ok).toBeTrue();
    expect((await decodeSaveText(JSON.stringify(env, null, 1))).ok).toBeTrue();
  });

  it('refuses damaged, truncated, foreign and newer-format saves before anything is replaced', async () => {
    const env = makeEnvelope(named());
    const code = await encodeSaveCode(env, false);
    const [p, body, sum] = code.split('.');
    const flipped = body.slice(0, 40) + (body[40] === 'A' ? 'B' : 'A') + body.slice(41);
    expect((await decodeSaveText(`${p}.${flipped}.${sum}`)).ok).toBeFalse();
    expect((await decodeSaveText(code.slice(0, code.length - 20))).ok).toBeFalse();
    expect((await decodeSaveText('hello')).ok).toBeFalse();
    expect((await decodeSaveText('{"app":"other","format":1,"state":{}}')).ok).toBeFalse();
    const newer = await decodeSaveText(JSON.stringify({ ...env, format: 99 }));
    expect(newer.ok).toBeFalse();
    if (!newer.ok) expect(newer.error).toContain('ใหม่กว่า');
    expect(checksum('a')).not.toBe(checksum('b'));
  });
});

describe('Account — service / guards', () => {
  let save: SaveService;
  let account: AccountService;
  beforeEach(() => {
    localStorage.removeItem('projectgm-save-backup');
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    save = TestBed.inject(SaveService);
    account = TestBed.inject(AccountService);
    save.reset();
  });
  afterEach(() => localStorage.removeItem('projectgm-save-backup'));

  const run = (g: typeof islandNamedGuard) => TestBed.runInInjectionContext(() => g({} as never, {} as never)) as boolean | UrlTree;
  const url = (r: boolean | UrlTree) => (r instanceof UrlTree ? TestBed.inject(Router).serializeUrl(r) : r);

  it('unnamed island → every game route goes to /welcome; named → /welcome goes home', () => {
    expect(url(run(islandNamedGuard))).toBe('/welcome');
    expect(url(run(welcomeGuard))).toBeTrue();
    expect(account.setName('เกาะดารา')).toBeTrue();
    expect(url(run(islandNamedGuard))).toBeTrue();
    expect(url(run(welcomeGuard))).toBe('/home');
  });

  it('import replaces the save, keeps a one-step backup, and undo restores the previous save', async () => {
    account.setName('เกาะเดิม');
    save.update(s => ({ ...s, gems: 111 }));
    const other = { ...named('เกาะใหม่'), gems: 999, cleared: 4 };
    const r = await account.decode(await encodeSaveCode(makeEnvelope(other)));
    expect(account.apply(r)).toBeTrue();
    expect(save.state().island!.name).toBe('เกาะใหม่');
    expect(save.state().gems).toBe(999);
    expect(save.state().cleared).toBe(4);
    expect(account.hasBackup()).toBeTrue();
    expect(account.restoreBackup()).toBeTrue();
    expect(save.state().island!.name).toBe('เกาะเดิม');
    expect(save.state().gems).toBe(111);
    expect(account.hasBackup()).toBeFalse();
  });

  it('a save too old / broken to migrate is refused and the current save is untouched', () => {
    account.setName('เกาะเดิม');
    expect(save.importState({ version: 2, heroes: [] })).toBeFalse();
    expect(save.importState({ version: 6, heroes: 'nope' })).toBeFalse();
    expect(save.state().island!.name).toBe('เกาะเดิม');
  });
});
