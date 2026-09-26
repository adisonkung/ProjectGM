import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FARM_DUNGEONS, ITEMS, TOWER_REWARDS } from '../../core/data/economy';
import { FLOOR_BANDS } from '../../core/data/progression';
import { STAGES } from '../../core/data/stages';
import { ProgressionService } from '../../core/services/progression.service';
import { SaveService } from '../../core/services/save.service';

/** Tower floors (first clear EXP, recommended level band) + farm dungeons (Training Ground / Ascension Trial) */
@Component({
  selector: 'app-tower',
  imports: [RouterLink],
  templateUrl: './tower.component.html',
  styleUrl: './tower.component.scss',
})
export class TowerComponent {
  private readonly save = inject(SaveService);
  readonly prog = inject(ProgressionService);
  readonly cleared = computed(() => this.save.state().cleared);
  readonly floors = STAGES.map(s => ({
    floor: s.floor, name: s.name ?? `Floor ${s.floor}`, band: FLOOR_BANDS[s.floor], reward: TOWER_REWARDS[s.floor],
  }));
  readonly dungeons = FARM_DUNGEONS;
  readonly itemName = (id: string) => ITEMS[id]?.name ?? id;
  readonly farm = computed(() => this.save.state().farm);
  readonly left = (pool: string) => this.prog.bonusLeft(pool);
}
