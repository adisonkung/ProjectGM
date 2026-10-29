import { TestBed } from '@angular/core/testing';
import { AccountService } from './account.service';
import { SaveService } from './save.service';

describe('Account profile cosmetics', () => {
  let account: AccountService;
  let save: SaveService;
  beforeEach(() => {
    TestBed.configureTestingModule({});
    save = TestBed.inject(SaveService);
    save.update(s => ({ ...s, profile: undefined }));
    account = TestBed.inject(AccountService);
  });
  it('uses the island portrait for existing saves and rejects unknown cosmetics', () => {
    expect(account.portrait()).toBe('ui/eldervane/citadel.webp');
    account.setPortrait('../invalid');
    account.setFrame('invalid');
    expect(save.state().profile).toBeUndefined();
  });
  it('preserves progress and the other cosmetic when changing portrait or frame', () => {
    const cleared = save.state().cleared;
    account.setFrame('wuxia');
    account.setPortrait('kael');
    expect(account.frame()).toBe('wuxia');
    expect(account.portrait()).toBe('portraits/kael.webp');
    expect(save.exportEnvelope().state.profile).toEqual({ portrait:'kael', frame:'wuxia' });
    expect(save.state().cleared).toBe(cleared);
    account.setPortrait('default');
    expect(account.frame()).toBe('wuxia');
  });
});
