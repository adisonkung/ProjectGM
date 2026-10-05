import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { AccountService } from './core/services/account.service';
import { PreloadService } from './core/services/preload.service';
import { SaveService } from './core/services/save.service';
import { IconComponent } from './shared/icon.component';

export interface NavItem {
  path: string;
  label: string;
  icon: string;
  /** url prefixes that light this tab up (island-hub pages count as the island) */
  match: string[];
}

/**
 * Main menu = the core loops only. Everything that lives on the island (tower, dungeons, forge, armory, lab …)
 * is reached by tapping its building — those pages light up the island tab.
 */
export const MAIN_NAV: NavItem[] = [
  { path: '/home', label: 'เกาะ', icon: 'home', match: ['/home', '/island', '/tower', '/dungeons', '/forge', '/armory', '/battle', '/lab'] },
  { path: '/heroes', label: 'ฮีโร่', icon: 'heroes', match: ['/heroes'] },
  { path: '/team', label: 'จัดทัพ', icon: 'team', match: ['/team'] },
  { path: '/gacha', label: 'อัญเชิญ', icon: 'summon', match: ['/gacha'] },
];

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, IconComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  readonly save = inject(SaveService);
  readonly account = inject(AccountService);
  private readonly router = inject(Router);
  readonly nav = MAIN_NAV;

  private readonly url = toSignal(
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), map(e => (e as NavigationEnd).urlAfterRedirects)),
    { initialValue: '' },
  );
  /** the first-launch naming screen shows no game chrome */
  readonly bare = computed(() => this.url().startsWith('/welcome'));
  readonly active = computed(() => {
    const u = this.url().split(/[?#]/)[0];
    return this.nav.find(n => n.match.some(m => u === m || u.startsWith(m + '/')))?.path ?? null;
  });
  /** in a fight the mobile dock steps aside (the battle screen needs the height) */
  readonly fight = computed(() => /^\/(battle|lab)(\/|\?|$)/.test(this.url()));
  readonly onAccount = computed(() => this.url().startsWith('/account'));
  /** home = the island fills the locked screen; the bar / dock float over it */
  readonly immersive = computed(() => /^\/home([?#]|$)/.test(this.url()));

  readonly gems = computed(() => this.save.state().gems.toLocaleString('en-US'));
  readonly gold = computed(() => this.save.state().gold.toLocaleString('en-US'));

  constructor() {
    // start decoding the island art right away (the home screen is the island)
    inject(PreloadService).warmCity();
    effect(() => document.documentElement.classList.toggle('lock-screen', this.immersive()));
  }
}
