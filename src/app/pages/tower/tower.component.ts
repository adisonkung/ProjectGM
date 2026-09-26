import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FARM_DUNGEONS, ITEMS, TOWER_REWARDS } from '../../core/data/economy';
import { FLOOR_BANDS } from '../../core/data/progression';
import { STAGES } from '../../core/data/stages';
import { ProgressionService } from '../../core/services/progression.service';
import { FarmDungeonDefinition } from '../../core/models/economy';
import { SaveService } from '../../core/services/save.service';

/** Tower floors (locked until the previous floor is cleared) + farm dungeons, each a special mode (survival / boss duel / treasure chase / challenge) */
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
  readonly pct = (x: number) => Math.round(x * 100);
  readonly kindOf = (d: FarmDungeonDefinition) => d.stage.special?.kind ?? 'STORY';
  /** mode badge of a farm dungeon */
  readonly kindLabel = (d: FarmDungeonDefinition) =>
    ({ SURVIVAL: '🛡 ต้านคลื่น', BOSS_DUEL: '👑 ตีบอสเดี่ยว', TREASURE: '💰 ล่าสมบัติ', CHALLENGE: '📜 ภารกิจทดสอบ', STORY: '' } as Record<string, string>)[this.kindOf(d)];
}
