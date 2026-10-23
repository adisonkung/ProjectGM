import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { TeamService } from '../core/services/team.service';
import { IconComponent } from './icon.component';
import { HeroPortraitComponent } from './hero-portrait.component';
import { SaveService } from '../core/services/save.service';

/** three saved team setups: load (one tap), save the current placement over one, rename */
@Component({
  selector: 'app-team-presets',
  host: { '[class.compact]': 'compact()' },
  imports: [IconComponent, HeroPortraitComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="presets" role="group" aria-label="ทีมที่บันทึกไว้">
      @for (p of team.presets(); track $index; let i = $index) {
        <div class="preset" [class.active]="team.activePreset() === i" [class.empty]="!p.team.length">
          @if (editing() === i) {
            <input #nm class="name-in" [value]="p.name" maxlength="16" aria-label="ชื่อทีม"
                   (keydown.enter)="rename(i, nm.value)" (keydown.escape)="editing.set(null)" (blur)="rename(i, nm.value)" />
          } @else {
            <button type="button" class="load" (click)="load(i)" [disabled]="!p.team.length"
                    [attr.aria-label]="'ใช้ ' + p.name" [attr.aria-pressed]="team.activePreset() === i">
              <span class="name">{{ p.name }}</span>
              <span class="faces">
                @for (t of p.team; track t.uid) {
                  @if (heroId(t.uid); as id) { <app-hero-portrait [heroId]="id" [size]="24" /> }
                } @empty { <small>ว่าง — กดบันทึกเพื่อเก็บทีมนี้</small> }
              </span>
            </button>
          }
          <span class="tools">
            <button type="button" class="ico" (click)="store(i)" [title]="'บันทึกทีมปัจจุบันลง ' + p.name" aria-label="บันทึกทีมปัจจุบัน">
              <app-icon name="save" [size]="15" />
            </button>
            <button type="button" class="ico" (click)="editing.set(i)" title="เปลี่ยนชื่อ" aria-label="เปลี่ยนชื่อทีม"><app-icon name="edit" [size]="15" /></button>
          </span>
          @if (flash() === i) { <em class="ok" aria-live="polite">บันทึกแล้ว</em> }
        </div>
      }
    </div>`,
  styles: [`
    .presets { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .preset { position: relative; display: flex; align-items: stretch; gap: 4px; padding: 4px; border-radius: 3px;
      background: linear-gradient(180deg, #1b212b, #101419); border: 1px solid var(--line); min-width: 0; }
    .preset.active { border-color: var(--gold); box-shadow: 0 0 0 1px #d9b46455, 0 0 16px #d9b46433; }
    .load { flex: 1; min-width: 0; display: grid; gap: 3px; text-align: left; padding: 4px 6px; border: 0; background: none; border-radius: 2px; }
    .load:hover:not(:disabled) { background: #ffffff08; }
    .load:disabled { cursor: default; }
    .name { font: 700 13px var(--title); letter-spacing: 0.04em; color: var(--gold-hi); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .empty .name { color: var(--muted); }
    .faces { display: flex; gap: 2px; min-height: 24px; align-items: center; overflow: hidden; }
    .faces small { font-size: 11px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tools { display: grid; gap: 3px; align-content: center; }
    .ico { display: grid; place-items: center; width: 28px; height: 26px; border-radius: 2px; border: 1px solid var(--line); background: #0006; color: var(--muted); }
    .ico:hover { color: var(--gold-hi); border-color: #d9b46480; }
    .name-in { flex: 1; min-width: 0; font: 600 13px var(--body); color: var(--text); background: #0008; border: 1px solid var(--gold); border-radius: 2px; padding: 4px 8px; }
    .ok { position: absolute; right: 8px; top: -9px; font: 600 10px var(--body); font-style: normal; color: #9fe6b6; background: #141921; border: 1px solid #56c07a80; padding: 0 6px; border-radius: 99px; animation: fade 1.6s forwards; }
    @keyframes fade { 70% { opacity: 1; } to { opacity: 0; } }
    :host(.compact) { display: block; min-width: 0; }
    :host(.compact) .presets { gap: 8px; }
    :host(.compact) .preset { border-radius: 2px; background: #12161dd6; padding: 3px; }
    :host(.compact) .preset.active { background: linear-gradient(120deg, #ab82422b, #191f29e8); }
    :host(.compact) .load { padding: 6px 8px; }
    :host(.compact) .name { font-size: 13px; }
    :host(.compact) .faces { display: none; }
    :host(.compact) .tools { display: flex; gap: 1px; align-items: center; }
    :host(.compact) .ico { width: 32px; height: 44px; border-color: transparent; background: none; }
    :host(.compact) .name-in { width: 45px; }
    @media (max-width: 560px) { :host(.compact) .presets { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; } :host(.compact) .load { padding: 5px; } :host(.compact) .tools { display: grid; } :host(.compact) .ico { width: 28px; height: 36px; } }
    @media (max-width: 560px) { .presets { grid-template-columns: 1fr; } }
  `],
})
export class TeamPresetsComponent {
  readonly compact = input(false);
  readonly team = inject(TeamService);
  private readonly save = inject(SaveService);
  readonly editing = signal<number | null>(null);
  readonly flash = signal<number | null>(null);

  heroId(uid: number): string | null {
    return this.save.state().heroes.find(h => h.uid === uid)?.templateId ?? null;
  }

  load(i: number): void {
    this.team.loadPreset(i);
    this.flash.set(null);
  }

  store(i: number): void {
    this.team.savePreset(i);
    this.flash.set(null);
    setTimeout(() => this.flash.set(i));
  }

  rename(i: number, name: string): void {
    if (this.editing() !== i) return;
    this.team.renamePreset(i, name);
    this.editing.set(null);
  }
}
