import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BattleComponent } from './battle.component';
import { artworkViewport, fullscreenViewport } from './battle-viewport';
import { BACKGROUNDS } from '../../core/data/backgrounds';
import { BattleEngine, BattleEvent } from '../../battle/engine/battle-engine';
import { battleSpriteFiles, stageMonsterSprites } from '../../battle/render/battle-assets';
import { isPlayerUnit } from '../../battle/engine/stage/party';
import { MONSTERS } from '../../core/data/monsters';
import { STAGES } from '../../core/data/stages';
import { StageDef } from '../../core/models/stage';

describe('full-screen battle viewport', () => {
  it('fits three square-cell lanes on each authored clearing without overlapping the party dock', () => {
    for (const id of ['forest-1', 'twilight-1', 'misty-1']) {
      const art = BACKGROUNDS[id];
      for (const [w, h] of [[1440, 860], [844, 390], [1920, 1080], [2560, 900]]) {
        const v = artworkViewport(w, h, art);
        const imageHeight = Math.max(w / art.w, h / art.h) * art.h;
        const horizon = Math.max(0, h - imageHeight * (1 - art.battlefieldCut!));
        const laneTop = (2 + v.extraRows) * v.cell;
        expect(laneTop).toBeGreaterThanOrEqual(horizon - 1e-6);
        expect(laneTop + 3 * v.cell).toBeLessThanOrEqual(h - v.dock);
        expect(v.width).toBeLessThanOrEqual(w);
        expect(v.foot).toBeGreaterThanOrEqual(v.dock);
        expect(v.cell * (5 + v.extraRows) + v.foot).toBeCloseTo(h, 6);
      }
    }
  });
  it('fills the window with square cells: 16 columns across, board reaches the bottom', () => {
    for (const [w, h] of [[1440, 860], [844, 390], [1920, 1080], [1280, 720]]) {
      const v = fullscreenViewport(w, h, .8, 0, .95);
      expect(v.width).toBeCloseTo(w, 4);
      expect(v.height).toBeCloseTo(h, 4);
      expect(v.cell).toBeCloseTo(w / 16, 4);
      // the party dock may only cover decorative floor / ground strip, never a lane
      expect(v.dock).toBeLessThanOrEqual(v.foot + v.cell * v.groundRows + 1e-6);
    }
  });
  it('never reveals more sky than the art allows; a very wide window centres a height-fitted board', () => {
    const tall = fullscreenViewport(1440, 1100, .8, 0, .3);
    expect(tall.extraRows).toBeCloseTo(.3, 6);
    const wide = fullscreenViewport(2560, 900, .8, 0, 0);
    expect(wide.width).toBeLessThan(2560);
    expect(wide.height).toBeCloseTo(900, 4);
    expect(wide.dock).toBeLessThanOrEqual(wide.foot + wide.cell * wide.groundRows + 1e-6);
  });
  it('keeps a background\'s required sky rows', () => {
    expect(fullscreenViewport(1440, 860, .8, 1.4, 2).extraRows).toBeGreaterThanOrEqual(1.4);
  });
});

describe('battle preload list', () => {
  it('collects every wave monster of a stage and what they summon', () => {
    const stage: StageDef = { floor: 0, mode: 'eliminate', timeLimit: 60, enemies: [{ enemy: 'elder_treant', r: 0, c: 1 }] };
    const sprites = stageMonsterSprites(stage);
    expect(sprites).toContain(MONSTERS['elder_treant'].animation.sheet!);
    expect(sprites).toContain(MONSTERS['mushroom_creature'].animation.sheet!);
    expect(sprites).toContain(MONSTERS['forest_wolf'].animation.sheet!);
  });
  it('covers the Stage 10 boss sheet and its FX strips', () => {
    const files = battleSpriteFiles(stageMonsterSprites(STAGES[9]));
    expect(files).toContain(MONSTERS['forest_oblivion'].animation.sheet!);
    expect(files.some(f => f.startsWith('fx-fo-'))).toBeTrue();
  });
  it('a hero sheet brings its skill VFX and impact strips; unknown sheets are skipped', () => {
    const files = battleSpriteFiles(['hero-bailong.png', 'no-such-sheet.png', undefined]);
    expect(files).toContain('hero-bailong.png');
    expect(files).toContain('fx-bailong-dragon-thrust.png');
    expect(files).not.toContain('no-such-sheet.png');
  });
});

describe('BattleComponent full screen / loading / ultimate cut-in', () => {
  let component: BattleComponent;
  let fixture: ComponentFixture<BattleComponent>;
  type Host = { engine: BattleEngine; handleEvents(events: BattleEvent[]): void; tick(): void; hitStopUntil: number };
  const host = () => component as unknown as Host;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [BattleComponent], providers: [provideRouter([])] }).compileComponents();
    fixture = TestBed.createComponent(BattleComponent);
    component = fixture.componentInstance;
    component.renderer.set('dom');
    fixture.detectChanges();
  });
  afterEach(() => component.ngOnDestroy());

  it('the fight takes the whole window (html.battle-full) and gives it back on leaving the stage', () => {
    expect(document.documentElement.classList.contains('battle-full')).toBeFalse();
    component.start();
    fixture.detectChanges();
    expect(component.fullscreen()).toBeTrue();
    expect(document.documentElement.classList.contains('battle-full')).toBeTrue();
    expect(fixture.nativeElement.querySelector('.lab.battle-full')).not.toBeNull();
    component.exitStage();
    fixture.detectChanges();
    expect(document.documentElement.classList.contains('battle-full')).toBeFalse();
  });

  it('a player ultimate shows the hero cut-in and holds the field still without moving game time', () => {
    component.start();
    const hero = host().engine.units.find(u => isPlayerUnit(u) && u.heroId)!;
    const t0 = host().engine.time;
    host().handleEvents([{ type: 'cast', src: hero.id, skill: 'ทดสอบอัลติ', kind: 'ult' }]);
    fixture.detectChanges();
    expect(component.cutIn()?.name).toBe(hero.name);
    expect(component.cutIn()?.skill).toBe('ทดสอบอัลติ');
    expect(fixture.nativeElement.querySelector('.ult-cutin')).not.toBeNull();
    expect(component.boardFrozen()).toBeTrue();
    host().tick();
    expect(host().engine.time).toBe(t0);
  });

  it('enemy ultimates and ordinary skills do not cut in', () => {
    component.start();
    const foe = host().engine.units.find(u => !isPlayerUnit(u))!;
    const hero = host().engine.units.find(u => isPlayerUnit(u))!;
    host().handleEvents([{ type: 'cast', src: foe.id, skill: 'x', kind: 'ult' }, { type: 'cast', src: hero.id, skill: 'y', kind: 'skill' }]);
    expect(component.cutIn()).toBeNull();
  });

  it('start button: loading screen with hero art first, then the fight starts by itself', async () => {
    component.enter();
    fixture.detectChanges();
    expect(component.loading()).not.toBeNull();
    expect(component.running()).toBeFalse();
    expect(component.placing()).toBeFalse();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.battle-loading')).not.toBeNull();
    expect(el.querySelector('app-board')).not.toBeNull(); // the board mounts underneath while loading
    const until = performance.now() + 9000;
    while (!component.running() && performance.now() < until) await new Promise(r => setTimeout(r, 50));
    expect(component.running()).toBeTrue();
  }, 12000);

  it('leaving during the loading screen cancels it — the fight never starts', async () => {
    component.enter();
    component.exitStage();
    await new Promise(r => setTimeout(r, 1300));
    expect(component.loading()).toBeNull();
    expect(component.running()).toBeFalse();
  });
});
