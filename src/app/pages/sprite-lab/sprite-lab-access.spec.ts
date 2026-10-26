import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { GameAccessService } from '../../core/services/game-access.service';
import { SpriteLabComponent } from './sprite-lab.component';

describe('Sprite lab action access', () => {
  const open = (gm: boolean) => {
    TestBed.configureTestingModule({ imports: [SpriteLabComponent], providers: [
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ hero: 'bailong', render: 'dom', gm: '1' }) } } },
      { provide: GameAccessService, useValue: { isGm: () => gm } },
    ] });
    return TestBed.createComponent(SpriteLabComponent);
  };

  it('lets GM preview all eight action states', () => {
    const f = open(true), lab = f.componentInstance;
    expect(lab.actions().map(a => a.id)).toEqual(['idle','walk','attack','hurt','die','skill','skill2','ult']);
    lab.play('hurt');
    expect(lab.last()).toBe('hurt');
    f.destroy();
  });

  it('keeps player actions at S1/S2/Ultimate and denies direct basic-action calls even with gm URL data', () => {
    const f = open(false), lab = f.componentInstance;
    expect(lab.actions().map(a => a.id)).toEqual(['skill','skill2','ult']);
    lab.play('skill');
    const animations = lab.anims();
    for (const action of ['idle','walk','attack','hurt','die'] as const) {
      lab.play(action);
      expect(lab.last()).toBe('skill');
      expect(lab.anims()).toBe(animations);
    }
    lab.play('skill2'); expect(lab.last()).toBe('skill2');
    lab.play('ult'); expect(lab.last()).toBe('ult');
    f.destroy();
  });
});
