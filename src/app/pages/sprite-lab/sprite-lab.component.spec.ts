import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { SpriteLabComponent } from './sprite-lab.component';
import { animTiming } from '../../core/data/sprites';

describe('Sprite lab single-target projectile review', () => {
  let fixture: ComponentFixture<SpriteLabComponent>;
  let lab: SpriteLabComponent;
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SpriteLabComponent], providers: [
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ hero: 'mirelle', render: 'dom' }) } } },
    ] });
    fixture = TestBed.createComponent(SpriteLabComponent);
    lab = fixture.componentInstance;
    // No board render: test the preview scheduling independently of WebGL / wall-clock animation.
  });
  afterEach(() => fixture.destroy());

  it('shows a projectile at release, hurts only the primary at arrival, and clears stale effects on reset', fakeAsync(() => {
    lab.play('skill');
    const releaseMs = animTiming('hero-mirelle.png', 'skill').hit * 1000;
    tick(releaseMs + 1);
    expect(lab.projectiles().length).toBe(1);
    expect(lab.floats().length).toBe(0);
    tick(170);
    expect(lab.floats().length).toBe(1);
    expect(lab.anims()[2]!.anim).toBe('hurt');
    expect(lab.anims()[3]?.anim).not.toBe('hurt');
    expect(lab.fx().map(f => f.name)).toEqual(['mf-s1-impact']);
    lab.reset();
    tick(2000);
    expect(lab.projectiles()).toEqual([]);
    expect(lab.fx()).toEqual([]);
    expect(lab.floats()).toEqual([]);
  }));

  it('cancels pending arrival when switching actions and excludes base fallbacks from produced-skill buttons', fakeAsync(() => {
    expect(lab.actions().map(a => a.id)).toContain('skill');
    expect(lab.actions().map(a => a.id)).toContain('skill2');
    expect(lab.actions().map(a => a.id)).not.toContain('ult');
    lab.speed.set(0.5);
    lab.faceLeft.set(true);
    lab.play('skill');
    tick(animTiming('hero-mirelle.png', 'skill').hit * 2000 + 1);
    expect(lab.projectiles()[0].from.x).toBeGreaterThan(lab.projectiles()[0].to.x);
    lab.play('idle');
    tick(3000);
    expect(lab.fx()).toEqual([]);
    expect(lab.floats()).toEqual([]);
  }));
});

describe('Sprite lab engine-backed area/status review', () => {
  let fixture: ComponentFixture<SpriteLabComponent>;
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SpriteLabComponent], providers: [
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({
        hero: 'mirelle', render: 'dom', combat: '1', formation: 'square', status: 'chill', distance: '4', enemy: 'forest_slime',
      }) } } },
    ] });
    fixture = TestBed.createComponent(SpriteLabComponent);
  });
  afterEach(() => fixture.destroy());

  it('uses one area FX, four actual damage results and only the pre-Chilled target gets Bind; reset removes pending replay', fakeAsync(() => {
    const lab = fixture.componentInstance;
    lab.play('skill2');
    tick(animTiming('hero-mirelle.png', 'skill2').hit * 1000 + 60);
    const area = lab.fx().filter(f => f.name === 'mf-s2-main');
    expect(area.length).toBe(1);
    expect([area[0].r, area[0].c]).toEqual([1.5, 9.5]);
    expect(lab.floats().filter(f => f.kind === 'dmg').length).toBe(4);
    const binds = lab.fx().filter(f => f.name === 'mf-s2-bind');
    expect(binds.length).toBe(1);
    expect(binds[0].follow).toBe(2);
    expect(lab.units().find(u => u.id === 2)!.statuses!.map(b => b.id)).toContain('root');
    expect(lab.units().find(u => u.id === 3)!.statuses!.map(b => b.id)).not.toContain('root');
    lab.reset();
    tick(6000);
    expect(lab.fx()).toEqual([]);
    expect(lab.floats()).toEqual([]);
  }));
});
