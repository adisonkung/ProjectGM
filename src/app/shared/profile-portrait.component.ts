import { Component, inject, input } from '@angular/core';
import { AccountService } from '../core/services/account.service';
@Component({
  selector: 'app-profile-portrait',
  template: `<span class="portrait" [attr.data-frame]="frame() || account.frame()"><img [src]="src() || account.portrait()" alt="รูปโปรไฟล์" /><i aria-hidden="true">{{ motif() || emblem() }}</i></span>`,
  styles: [`:host { display:block; aspect-ratio:1; min-width:0; }
    .portrait { --edge:#d9b870; --shade:#5d86a0; position:relative; display:block; width:100%; height:100%; box-sizing:border-box; padding:5px; background:linear-gradient(135deg,#fff2bd,var(--edge),var(--shade),var(--edge)); clip-path:polygon(12% 0,88% 0,100% 12%,100% 88%,88% 100%,12% 100%,0 88%,0 12%); }
    img { display:block; width:100%; height:100%; object-fit:cover; object-position:50% 30%; clip-path:polygon(11% 0,89% 0,100% 11%,100% 89%,89% 100%,11% 100%,0 89%,0 11%); }
    i { position:absolute; bottom:0; left:50%; transform:translateX(-50%); color:#fff0c5; background:#17232d; padding:0 7px; font-family:Georgia,serif; font-variant-emoji:text; font-style:normal; font-size:16px; }
    [data-frame=wuxia] { --edge:#83e5bd; --shade:#1c695f; padding:7px; background:conic-gradient(from 45deg,#e1cf8c,#368b76,#bae8cc,#275b52,#e1cf8c,#368b76,#bae8cc,#275b52,#e1cf8c); }
    [data-frame=fantasy] { --edge:#e9d0ff; --shade:#6659a0; padding:7px; box-shadow:inset 0 0 12px #fff; }
    [data-frame=dark] { --edge:#b85269; --shade:#251c35; padding:8px; background:conic-gradient(from 45deg,#efd1ac,#5e283f,#15121f,#b4778a,#efd1ac,#5e283f,#15121f,#b4778a,#efd1ac); }
  `],
})
export class ProfilePortraitComponent {
  readonly account = inject(AccountService);
  readonly src = input('');
  readonly frame = input('');
  readonly motif = input('');
  emblem(): string { return this.account.frames.find(f => f.id === (this.frame() || this.account.frame()))?.motif ?? '◇'; }
}
