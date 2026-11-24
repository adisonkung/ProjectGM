import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AccountComponent } from './account.component';

describe('AccountComponent', () => {
  it('settings page links to the test rooms (sprite lab dummies + battle lab)', async () => {
    await TestBed.configureTestingModule({ imports: [AccountComponent], providers: [provideRouter([])] }).compileComponents();
    const f = TestBed.createComponent(AccountComponent);
    f.detectChanges();
    const links = Array.from((f.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('.test-rooms a'));
    expect(links.map(a => a.getAttribute('href'))).toEqual(['/sprite-lab', '/lab']);
    expect(links[0].textContent).toContain('ห้องทดสอบท่า');
    expect(links[1].textContent).toContain('ห้องทดลองต่อสู้');
  });

  it('settings page has a sound toggle, a volume slider and test buttons', async () => {
    localStorage.removeItem('eldervane-sound');
    await TestBed.configureTestingModule({ imports: [AccountComponent], providers: [provideRouter([])] }).compileComponents();
    const f = TestBed.createComponent(AccountComponent);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const toggle = el.querySelector<HTMLInputElement>('.sound-toggle input')!;
    const slider = el.querySelector<HTMLInputElement>('#sound-volume')!;
    expect(toggle.checked).toBeTrue();
    expect(slider.value).toBe('70');
    expect(el.querySelectorAll('.sound-tests button').length).toBe(5);
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change'));
    f.detectChanges();
    expect(slider.disabled).toBeTrue();
    expect(JSON.parse(localStorage.getItem('eldervane-sound')!).enabled).toBeFalse();
    localStorage.removeItem('eldervane-sound');
  });
});
