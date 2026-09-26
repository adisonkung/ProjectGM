import { Routes } from '@angular/router';
import { ArmoryComponent } from './pages/armory/armory.component';
import { BattleComponent } from './pages/battle/battle.component';
import { GachaComponent } from './pages/gacha/gacha.component';
import { LobbyComponent } from './pages/lobby/lobby.component';
import { TeamBuilderComponent } from './pages/team-builder/team-builder.component';
import { TowerComponent } from './pages/tower/tower.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'lab' },
  { path: 'lobby', component: LobbyComponent, title: 'ฐาน · ProjectGM' },
  { path: 'armory', component: ArmoryComponent, title: 'อุปกรณ์ · ProjectGM' },
  { path: 'team', component: TeamBuilderComponent, title: 'จัดทีม · ProjectGM' },
  { path: 'tower', component: TowerComponent, title: 'หอคอย · ProjectGM' },
  { path: 'gacha', component: GachaComponent, title: 'สุ่ม · ProjectGM' },
  { path: 'lab', component: BattleComponent, title: 'ห้องทดลองต่อสู้ · ProjectGM' },
  { path: '**', redirectTo: 'lab' },
];
