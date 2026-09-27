import { Routes } from '@angular/router';

/** every page is lazy-loaded: the initial bundle holds only the shell + shared services (keeps it under the size budget) */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  { path: 'home', loadComponent: () => import('./pages/island/island.component').then(m => m.IslandComponent), title: 'เกาะของฉัน · Summon Tower' },
  { path: 'island', redirectTo: 'home' },
  { path: 'heroes', loadComponent: () => import('./pages/heroes/heroes.component').then(m => m.HeroesComponent), title: 'หอวีรชน · Summon Tower' },
  { path: 'heroes/:uid', loadComponent: () => import('./pages/hero-detail/hero-detail.component').then(m => m.HeroDetailComponent), title: 'ฮีโร่ · Summon Tower' },
  { path: 'lobby', redirectTo: 'heroes' },
  { path: 'armory', loadComponent: () => import('./pages/armory/armory.component').then(m => m.ArmoryComponent), title: 'คลังอุปกรณ์ · Summon Tower' },
  { path: 'forge', loadComponent: () => import('./pages/forge/forge.component').then(m => m.ForgeComponent), title: 'โรงตีเหล็ก · Summon Tower' },
  { path: 'team', loadComponent: () => import('./pages/team-builder/team-builder.component').then(m => m.TeamBuilderComponent), title: 'จัดทีม · Summon Tower' },
  { path: 'tower', loadComponent: () => import('./pages/tower/tower.component').then(m => m.TowerComponent), title: 'หอคอย · Summon Tower' },
  { path: 'dungeons', pathMatch: 'full', redirectTo: 'dungeons/training' },
  { path: 'dungeons/:type', loadComponent: () => import('./pages/dungeons/dungeons.component').then(m => m.DungeonsComponent), title: 'ดันเจี้ยน · Summon Tower' },
  { path: 'gacha', loadComponent: () => import('./pages/gacha/gacha.component').then(m => m.GachaComponent), title: 'อัญเชิญ · Summon Tower' },
  // real runs (tower floor / farm dungeon, rewards) — the lab is the sandbox with balance tools, same screen
  { path: 'battle', loadComponent: () => import('./pages/battle/battle.component').then(m => m.BattleComponent), title: 'สนามรบ · Summon Tower' },
  { path: 'lab', loadComponent: () => import('./pages/battle/battle.component').then(m => m.BattleComponent), title: 'ห้องทดลองต่อสู้ · Summon Tower', data: { lab: true } },
  { path: '**', redirectTo: 'home' },
];
