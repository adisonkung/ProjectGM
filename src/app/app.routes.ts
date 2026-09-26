import { Routes } from '@angular/router';
import { ArmoryComponent } from './pages/armory/armory.component';
import { BattleComponent } from './pages/battle/battle.component';
import { DungeonsComponent } from './pages/dungeons/dungeons.component';
import { ForgeComponent } from './pages/forge/forge.component';
import { GachaComponent } from './pages/gacha/gacha.component';
import { HeroDetailComponent } from './pages/hero-detail/hero-detail.component';
import { HeroesComponent } from './pages/heroes/heroes.component';
import { HomeComponent } from './pages/home/home.component';
import { TeamBuilderComponent } from './pages/team-builder/team-builder.component';
import { TowerComponent } from './pages/tower/tower.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  { path: 'home', component: HomeComponent, title: 'Summon Tower' },
  { path: 'heroes', component: HeroesComponent, title: 'หอวีรชน · Summon Tower' },
  { path: 'heroes/:uid', component: HeroDetailComponent, title: 'ฮีโร่ · Summon Tower' },
  { path: 'lobby', redirectTo: 'heroes' },
  { path: 'armory', component: ArmoryComponent, title: 'คลังอุปกรณ์ · Summon Tower' },
  { path: 'forge', component: ForgeComponent, title: 'โรงตีเหล็ก · Summon Tower' },
  { path: 'team', component: TeamBuilderComponent, title: 'จัดทีม · Summon Tower' },
  { path: 'tower', component: TowerComponent, title: 'หอคอย · Summon Tower' },
  { path: 'dungeons', pathMatch: 'full', redirectTo: 'dungeons/training' },
  { path: 'dungeons/:type', component: DungeonsComponent, title: 'ดันเจี้ยน · Summon Tower' },
  { path: 'gacha', component: GachaComponent, title: 'อัญเชิญ · Summon Tower' },
  // real runs (tower floor / farm dungeon, rewards) — the lab is the sandbox with balance tools, same screen
  { path: 'battle', component: BattleComponent, title: 'สนามรบ · Summon Tower' },
  { path: 'lab', component: BattleComponent, title: 'ห้องทดลองต่อสู้ · Summon Tower', data: { lab: true } },
  { path: '**', redirectTo: 'home' },
];
