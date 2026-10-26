import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/icon.component';
import { ITEMS, TOWER_REWARDS } from '../../core/data/economy';
import { FLOOR_BANDS } from '../../core/data/progression';
import { STAGES } from '../../core/data/stages';
import { TowerOrnamentComponent } from './tower-ornament.component';
import { BACKGROUNDS } from '../../core/data/backgrounds';
import { SaveService } from '../../core/services/save.service';

/** Tower floors (locked until the previous floor is cleared) — farm dungeons have their own menu (/dungeons) */
@Component({
  selector: 'app-tower',
  imports: [RouterLink, IconComponent, TowerOrnamentComponent],
  templateUrl: './tower.component.html',
  styleUrl: './tower.component.scss',
})
export class TowerComponent {
  private readonly save = inject(SaveService);
  readonly cleared = computed(() => this.save.state().cleared);
  readonly floors = STAGES.map(s => ({
    floor: s.floor, name: s.name ?? `Floor ${s.floor}`,
    band: FLOOR_BANDS[s.floor], reward: TOWER_REWARDS[s.floor],
    mode: s.mode, timeLimit: s.timeLimit,
    thumbnail: '/' + (BACKGROUNDS[s.background ?? 'forest-1'] ?? BACKGROUNDS['forest-1']).file,
  }));
  readonly focusedFloor = signal<number | null>(null);
  readonly selected = computed(() => this.floors.find(f => f.floor === (this.focusedFloor() ?? Math.min(this.cleared() + 1, this.floors.length))) ?? this.floors[0]);
  readonly itemName = (id: string) => ITEMS[id]?.name ?? id;
  readonly roleLabel: Record<string, string> = { ONBOARDING: 'เริ่มต้น', EARLY: 'ช่วงต้น', TRANSITION: 'เปลี่ยนผ่าน', WALL: 'บททดสอบ', ENDGAME: 'ช่วงท้าย' };
}
