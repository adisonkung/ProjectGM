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
});
