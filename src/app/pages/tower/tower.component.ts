import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/icon.component';
import { TOWER_REWARDS } from '../../core/data/economy';
import { FLOOR_BANDS } from '../../core/data/progression';
import { STAGES } from '../../core/data/stages';
import { SaveService } from '../../core/services/save.service';

/** Tower floors (locked until the previous floor is cleared) — farm dungeons have their own menu (/dungeons) */
@Component({
  selector: 'app-tower',
  imports: [RouterLink, IconComponent],
  templateUrl: './tower.component.html',
  styleUrl: './tower.component.scss',
})
export class TowerComponent {
  private readonly save = inject(SaveService);
  readonly cleared = computed(() => this.save.state().cleared);
  readonly floors = STAGES.map(s => ({
    floor: s.floor, name: s.name ?? `Floor ${s.floor}`, band: FLOOR_BANDS[s.floor], reward: TOWER_REWARDS[s.floor],
  }));
  /** floors top-down (the tower is climbed upward) */
  readonly floorsDesc = [...this.floors].reverse();
}
