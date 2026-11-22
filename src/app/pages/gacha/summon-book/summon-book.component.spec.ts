import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SummonPull } from '../summon-scene.component';
import { bookCards, SummonBookComponent } from './summon-book.component';
import { heroIntro } from './hero-intro';

const pull = (templateId: string, star = 3): SummonPull => ({ templateId, star, isNew: true, memory: 0, universal: 0, name: templateId, cls: 'x' });

describe('SummonBookComponent', () => {
  it('builds the cards from the real pull: game name and class, intro copy, portrait and banner art', () => {
    const [c] = bookCards([pull('lucien')]);
    expect(c.id).toBe('lucien');
    expect(c.star).toBe(3);
    expect(c.th).toBe('ลูเซียน วัลธอร์น');
    expect(c.en).toBe('Lucien Valthorne');
    expect(c.epithet).toBe('The Black Saint');
    expect(c.quote.length).toBeGreaterThan(0);
    expect(c.portrait.startsWith('/')).toBeTrue();
    expect(c.banner?.startsWith('/')).toBeTrue();
  });

  it('a hero without intro copy still gets a card with its id as the Latin name and no line', () => {
    expect(heroIntro('newhero')).toEqual({ en: 'Newhero', epithet: '', quote: '' });
  });

  describe('with reduced motion', () => {
    let fixture: ComponentFixture<SummonBookComponent>;
    beforeEach(() => {
      spyOn(window, 'matchMedia').and.callFake((q: string) => ({ matches: q.includes('reduced-motion'), media: q, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList);
      fixture = TestBed.createComponent(SummonBookComponent);
      fixture.componentRef.setInput('results', [pull('bailong'), pull('kael')]);
      fixture.detectChanges();
    });
    afterEach(() => fixture.destroy());

    it('shows the 2D summon scene instead of the WebGL book', () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('app-summon-scene')).not.toBeNull();
      expect(el.querySelector('dialog.book')).toBeNull();
    });
  });

  it('finish() closes once and emits done once', () => {
    spyOn(window, 'matchMedia').and.callFake((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList);
    const fixture = TestBed.createComponent(SummonBookComponent);
    fixture.componentRef.setInput('results', [pull('bailong')]);
    let done = 0;
    fixture.componentInstance.done.subscribe(() => done++);
    fixture.detectChanges();
    fixture.componentInstance.finish();
    fixture.componentInstance.finish();
    expect(done).toBe(1);
    expect((fixture.nativeElement as HTMLElement).querySelector<HTMLDialogElement>('dialog.book')?.open).toBeFalse();
    fixture.destroy();
  });
});
