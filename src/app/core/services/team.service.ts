import { computed, inject, Injectable } from '@angular/core';
import { TeamPreset } from '../models/game-state';
import { autoPlace, normalizePresets, presetToTeam, TEAM_SIZE, teamToUnits } from '../rules/team';
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
    this.save.update(s => ({ ...s, team: autoPlace(s.heroes) }));
  }

  // ---------------------------------------------------------------- presets

  readonly presets = computed(() => normalizePresets(this.save.state().teamPresets));

  /** index of the preset that matches the current team exactly (same heroes on the same cells), or -1 */
  readonly activePreset = computed(() => {
    const key = (t: { uid: number; r: number; c: number }[]) => t.map(x => `${x.uid}@${x.r},${x.c}`).sort().join('|');
    const cur = key(this.slots());
    return cur ? this.presets().findIndex(p => p.team.length > 0 && key(p.team) === cur) : -1;
  });

  private setPresets(fn: (p: TeamPreset[]) => TeamPreset[]): void {
    this.save.update(s => ({ ...s, teamPresets: fn(normalizePresets(s.teamPresets)) }));
  }

  /** store the current team + placement in preset i */
  savePreset(i: number): void {
    this.setPresets(p => p.map((x, k) => (k === i ? { ...x, team: this.slots().map(t => ({ ...t })) } : x)));
  }

  /** replace the current team with preset i (heroes no longer owned are skipped); false when the preset is empty */
  loadPreset(i: number): boolean {
    const p = this.presets()[i];
    if (!p) return false;
    const team = presetToTeam(p, this.save.state().heroes);
    if (!team.length) return false;
    this.save.update(s => ({ ...s, team }));
    return true;
  }

  renamePreset(i: number, name: string): void {
    const n = name.trim().slice(0, 16);
    if (n) this.setPresets(p => p.map((x, k) => (k === i ? { ...x, name: n } : x)));
  }
}
