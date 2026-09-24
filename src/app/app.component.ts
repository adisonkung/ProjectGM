import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SaveService } from './core/services/save.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  readonly save = inject(SaveService);
  readonly nav = [
    { path: '/lobby', label: 'ฐาน' },
    { path: '/team', label: 'จัดทีม' },
    { path: '/tower', label: 'หอคอย' },
    { path: '/gacha', label: 'สุ่ม' },
    { path: '/lab', label: 'ทดลองสู้' },
  ];
}
