import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { AccountService } from './core/services/account.service';
import { PreloadService } from './core/services/preload.service';
import { SaveService } from './core/services/save.service';
import { IconComponent } from './shared/icon.component';
import { CitadelFrameComponent } from './shared/citadel-frame.component';
import { CitadelIconComponent } from './shared/citadel-icon.component';
import { formatCurrency } from './shared/format-currency';

export interface NavItem {
  path: string;
  label: string;
  icon: string;
  caption?: string;
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

/** Existing game destinations share the reviewed lobby navigation. */
export const LOBBY_NAV: NavItem[] = [
  { path: '/home', label: 'หน้าหลัก', caption: 'HOME', icon: 'home', match: ['/home'] },
  { path: '/heroes', label: 'ฮีโร่', caption: 'HEROES', icon: 'heroes', match: ['/heroes'] },
  { path: '/team', label: 'จัดทัพ', caption: 'FORMATION', icon: 'armory', match: ['/team'] },
  { path: '/armory', label: 'อุปกรณ์', caption: 'GEAR', icon: 'shield', match: ['/armory', '/forge'] },
  { path: '/gacha', label: 'อัญเชิญ', caption: 'SUMMON', icon: 'summon', match: ['/gacha'] },
  { path: '/tower', label: 'ผจญภัย', caption: 'ADVENTURE', icon: 'tower', match: ['/tower', '/dungeons'] },
];

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, IconComponent, CitadelFrameComponent, CitadelIconComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  readonly save = inject(SaveService);
  readonly account = inject(AccountService);
  private readonly router = inject(Router);
  readonly nav = computed(() => this.fantasy() ? LOBBY_NAV : MAIN_NAV);

  private readonly url = toSignal(
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), map(e => (e as NavigationEnd).urlAfterRedirects)),
    { initialValue: '' },
  );
  /** the first-launch naming screen shows no game chrome */
  readonly bare = computed(() => this.url().startsWith('/welcome'));
  readonly active = computed(() => {
    const u = this.url().split(/[?#]/)[0];
    return this.nav().find(n => n.match.some(m => u === m || u.startsWith(m + '/')))?.path ?? null;
  });
  /** in a fight the mobile dock steps aside (the battle screen needs the height) */
  readonly fight = computed(() => /^\/(battle|lab)(\/|\?|$)/.test(this.url()));
  readonly onAccount = computed(() => this.url().startsWith('/account'));
  /** Home and summon sanctum fill the locked screen; chrome floats above the scene */
  readonly immersive = computed(() => /^\/(home|gacha)([?#]|$)/.test(this.url()));

  /** Collection, formation and adventure share the lobby chrome but keep normal document scrolling. */
  readonly forgePage = computed(() => /^\/forge([?#]|$)/.test(this.url()));
  readonly collection = computed(() => /^\/(heroes|team|armory|forge|account)(\/|[?#]|$)/.test(this.url()) || /^\/(tower|dungeons)(\/|[?#]|$)/.test(this.url()));
  readonly fantasy = computed(() => this.immersive() || this.collection() || this.fight() || this.url().startsWith('/sprite-lab'));
  readonly homeChrome = computed(() => !this.bare());

  readonly gemsFull = computed(() => this.save.state().gems.toLocaleString('en-US'));
  readonly goldFull = computed(() => this.save.state().gold.toLocaleString('en-US'));
  readonly gems = computed(() => formatCurrency(this.save.state().gems));
  readonly gold = computed(() => formatCurrency(this.save.state().gold));

  constructor() {
    // start decoding the island art right away (the home screen is the island)
    inject(PreloadService).warmCity();
    effect(() => document.documentElement.classList.toggle('lock-screen', this.immersive()));
  }
}
