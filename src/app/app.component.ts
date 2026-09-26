import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SaveService } from './core/services/save.service';
import { IconComponent } from './shared/icon.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  readonly save = inject(SaveService);
  readonly nav = [
    { path: '/home', label: 'เกาะ', icon: 'home' },
    { path: '/heroes', label: 'ฮีโร่', icon: 'heroes' },
    { path: '/armory', label: 'อุปกรณ์', icon: 'armory' },
    { path: '/forge', label: 'ตีเหล็ก', icon: 'flame' },
    { path: '/team', label: 'จัดทีม', icon: 'team' },
    { path: '/tower', label: 'หอคอย', icon: 'tower' },
    { path: '/dungeons', label: 'ดันเจี้ยน', icon: 'scroll' },
    { path: '/gacha', label: 'อัญเชิญ', icon: 'summon' },
    { path: '/lab', label: 'ทดลองสู้', icon: 'lab', dev: true },
  ];
}
