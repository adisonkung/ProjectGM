import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlacementComponent } from '../../battle/placement/placement.component';
import { STAGES } from '../../core/data/stages';
import { SaveService } from '../../core/services/save.service';

/** หน้าจัดทีม: ลากวางฮีโร่ 5 ตัวลงครึ่งกระดาน 4x7 โดยดูตำแหน่งศัตรูของชั้นที่เลือกประกอบ */
@Component({
  selector: 'app-team-builder',
  imports: [PlacementComponent, RouterLink],
  templateUrl: './team-builder.component.html',
  styleUrl: './team-builder.component.scss',
})
export class TeamBuilderComponent {
  private readonly save = inject(SaveService);

  readonly stages = STAGES;
  /** ค่าเริ่มต้น: ชั้นถัดไปที่ยังไม่ผ่าน */
  readonly floor = signal(Math.min(this.save.state().cleared + 1, STAGES.length));
  readonly stage = computed(() => STAGES[this.floor() - 1]);
}
