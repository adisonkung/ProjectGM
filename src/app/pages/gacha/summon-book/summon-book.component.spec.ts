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

  it('back() closes once and emits done once; summonAgain() emits again', () => {
    spyOn(window, 'matchMedia').and.callFake((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList);
    const fixture = TestBed.createComponent(SummonBookComponent);
    spyOn<any>(fixture.componentInstance, 'mount').and.stub();
    fixture.componentRef.setInput('results', [pull('bailong')]);
    let done = 0, again = 0;
    fixture.componentInstance.done.subscribe(() => done++);
    fixture.componentInstance.again.subscribe(() => again++);
    fixture.detectChanges();
    fixture.componentInstance.back();
    fixture.componentInstance.back();
    fixture.componentInstance.summonAgain();
    expect(done).toBe(1);
    expect(again).toBe(0);
    expect((fixture.nativeElement as HTMLElement).querySelector<HTMLDialogElement>('dialog.book')?.open).toBeFalse();
    fixture.destroy();
  });

  it('prepares while inactive, presents only real confirmed results, and prepares again after closing', () => {
    spyOn(window, 'matchMedia').and.returnValue({ matches: false } as MediaQueryList);
    const fixture = TestBed.createComponent(SummonBookComponent), c = fixture.componentInstance;
    const mount = spyOn<any>(c, 'mount').and.stub();
    fixture.componentRef.setInput('active', false);
    fixture.componentRef.setInput('results', []);
    fixture.detectChanges();
    const scene = jasmine.createSpyObj('prepared scene', ['present', 'dispose', 'skip']);
    (c as any).handle = scene; c.loading.set(false);
    fixture.detectChanges();
    expect(mount).toHaveBeenCalledTimes(1);
    expect(scene.present).not.toHaveBeenCalled();
    expect(c.stage()!.nativeElement.open).toBeFalse();
    fixture.componentRef.setInput('results', [pull('kael')]);
    fixture.componentRef.setInput('suspense', false);
    fixture.componentRef.setInput('active', true);
    fixture.detectChanges();
    expect(scene.present).toHaveBeenCalledOnceWith(bookCards([pull('kael')]), false);
    expect(c.stage()!.nativeElement.open).toBeTrue();
    c.back();
    fixture.componentRef.setInput('active', false); fixture.detectChanges();
    expect(scene.dispose).toHaveBeenCalledTimes(1);
    expect(mount).toHaveBeenCalledTimes(2);
    expect(c.stage()!.nativeElement.open).toBeFalse();
    fixture.destroy();
  });
});
