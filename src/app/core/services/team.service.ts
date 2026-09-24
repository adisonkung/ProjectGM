import { computed, inject, Injectable } from '@angular/core';
import { autoPlace, TEAM_SIZE, teamToUnits } from '../rules/team';
import { SaveService } from './save.service';

@Injectable({ providedIn: 'root' })
export class TeamService {
  private readonly save = inject(SaveService);

  readonly slots = computed(() => this.save.state().team);
  readonly isFull = computed(() => this.slots().length >= TEAM_SIZE);

  /** ยูนิตสำหรับส่งเข้าเอนจินต่อสู้ */
  readonly units = computed(() => teamToUnits(this.slots(), this.save.state().heroes));

  /** วางหรือย้ายฮีโร่ไปช่อง (r,c) ถ้ามีคนอยู่แล้วจะสลับตำแหน่งกัน */
  place(uid: number, r: number, c: number): boolean {
    const team = [...this.slots()];
    const mine = team.findIndex(s => s.uid === uid);
    const there = team.findIndex(s => s.r === r && s.c === c);
    if (mine < 0 && there < 0 && team.length >= TEAM_SIZE) return false;
    if (there >= 0 && mine >= 0) team[there] = { ...team[there], r: team[mine].r, c: team[mine].c };
    else if (there >= 0) team.splice(there, 1);
    if (mine >= 0) team[mine] = { uid, r, c };
    else team.push({ uid, r, c });
    this.save.update(s => ({ ...s, team }));
    return true;
  }

  remove(uid: number): void {
    this.save.update(s => ({ ...s, team: s.team.filter(t => t.uid !== uid) }));
  }

  clear(): void {
    this.save.update(s => ({ ...s, team: [] }));
  }

  auto(): void {
    const ready = this.save.state().heroes.filter(h => h.injury === 0);
    this.save.update(s => ({ ...s, team: autoPlace(ready) }));
  }
}
