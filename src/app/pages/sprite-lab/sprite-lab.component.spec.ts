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
    expect(lab.actions().map(a => a.id)).not.toContain('skill2');
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
