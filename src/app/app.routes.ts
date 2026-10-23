import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { AccountService } from './core/services/account.service';

/** first launch (or an old save without a name): name the island before anything else */
export const islandNamedGuard: CanActivateFn = () => (inject(AccountService).needsName() ? inject(Router).createUrlTree(['/welcome']) : true);
/** /welcome only while the island has no name */
export const welcomeGuard: CanActivateFn = () => (inject(AccountService).needsName() ? true : inject(Router).createUrlTree(['/home']));

/** every page is lazy-loaded: the initial bundle holds only the shell + shared services (keeps it under the size budget) */
const GAME_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  { path: 'account', loadComponent: () => import('./pages/account/account.component').then(m => m.AccountComponent), title: 'บัญชี & ย้ายเซฟ · Eldervane' },
  { path: 'home', loadComponent: () => import('./pages/island/island.component').then(m => m.IslandComponent), title: 'เกาะของฉัน · Eldervane' },
  { path: 'island', redirectTo: 'home' },
  { path: 'heroes', loadComponent: () => import('./pages/heroes/heroes.component').then(m => m.HeroesComponent), title: 'หอวีรชน · Eldervane' },
  { path: 'heroes/:uid', loadComponent: () => import('./pages/hero-detail/hero-detail.component').then(m => m.HeroDetailComponent), title: 'ฮีโร่ · Eldervane' },
  { path: 'lobby', redirectTo: 'heroes' },
  { path: 'armory', loadComponent: () => import('./pages/armory/armory.component').then(m => m.ArmoryComponent), title: 'คลังอุปกรณ์ · Eldervane' },
  { path: 'forge', loadComponent: () => import('./pages/forge/forge.component').then(m => m.ForgeComponent), title: 'โรงตีเหล็ก · Eldervane' },
  { path: 'team', loadComponent: () => import('./pages/team-builder/team-builder.component').then(m => m.TeamBuilderComponent), title: 'จัดทีม · Eldervane' },
  { path: 'tower', loadComponent: () => import('./pages/tower/tower.component').then(m => m.TowerComponent), title: 'หอคอย · Eldervane' },
  { path: 'dungeons', pathMatch: 'full', redirectTo: 'dungeons/training' },
  { path: 'dungeons/:type', loadComponent: () => import('./pages/dungeons/dungeons.component').then(m => m.DungeonsComponent), title: 'ดันเจี้ยน · Eldervane' },
  { path: 'gacha', loadComponent: () => import('./pages/gacha/gacha.component').then(m => m.GachaComponent), title: 'อัญเชิญ · Eldervane' },
  // real runs (tower floor / farm dungeon, rewards) — the lab is the sandbox with balance tools, same screen
  { path: 'battle', loadComponent: () => import('./pages/battle/battle.component').then(m => m.BattleComponent), title: 'สนามรบ · Eldervane' },
  { path: 'lab', loadComponent: () => import('./pages/battle/battle.component').then(m => m.BattleComponent), title: 'ห้องทดลองต่อสู้ · Eldervane', data: { lab: true } },
  { path: 'sprite-lab', loadComponent: () => import('./pages/sprite-lab/sprite-lab.component').then(m => m.SpriteLabComponent), title: 'ห้องทดสอบท่า · Eldervane' },
  { path: '**', redirectTo: 'home' },
];

export const routes: Routes = [
  { path: 'welcome', canActivate: [welcomeGuard], loadComponent: () => import('./pages/welcome/welcome.component').then(m => m.WelcomeComponent), title: 'ยินดีต้อนรับ · Eldervane' },
  { path: '', canActivateChild: [islandNamedGuard], children: GAME_ROUTES },
];
