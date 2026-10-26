import { A11yModule } from '@angular/cdk/a11y';
import { TowerOrnamentComponent } from '../pages/tower/tower-ornament.component';
import { CitadelFrameComponent } from './citadel-frame.component';
import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { DecodeResult, saveSummary } from '../core/rules/account';
import { AccountService } from '../core/services/account.service';
import { IconComponent } from './icon.component';

/** paste a transfer code or pick a save file → preview → confirm → this device's save is replaced */
@Component({
  selector: 'app-save-import',
  imports: [A11yModule, TowerOrnamentComponent, CitadelFrameComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './save-import.component.html',
  styles: [`
    :host { display: grid; gap: 8px; }
    .lbl { font-size: 12.5px; color: var(--muted); }
    .code { width: 100%; box-sizing: border-box; resize: vertical; min-height: 64px; padding: 8px 10px; border-radius: 3px;
      background: #0f1218; border: 1px solid var(--line); color: var(--text); font: 12px/1.4 ui-monospace, Menlo, monospace; word-break: break-all; }
    .code:focus { outline: none; border-color: var(--gold); box-shadow: 0 0 0 2px #d9b46433; }
    .row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .or { color: var(--muted); font-size: 12px; }
    .file { position: relative; overflow: hidden; cursor: pointer; }
    .file input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
    .preview { display: grid; gap: 4px; padding: 12px; border-radius: 3px; background: #56c07a12; border: 1px solid #56c07a55; }
    .preview b { font: 700 16px var(--title); color: var(--gold-hi); }
    .preview span { font-size: 13px; }
    .preview small { color: var(--muted); font-size: 11.5px; }
    .preview .gm-btn { justify-self: start; margin-top: 4px; }
    .warn { margin: 4px 0 0; display: flex; gap: 6px; align-items: center; color: #ffcf8a; font-size: 12px; }
    .err { margin: 0; color: #ff9d95; font-size: 13px; }
  `],
})
export class SaveImportComponent {
  private readonly account = inject(AccountService);
  readonly imported = output<void>();

  readonly text = signal('');
  readonly busy = signal(false);
  readonly result = signal<DecodeResult | null>(null);
  readonly pending = signal<DecodeResult | null>(null);

  review(r: DecodeResult): void { if (r.ok) this.pending.set(r); }

  async check(): Promise<void> {
    this.busy.set(true);
    this.result.set(await this.account.decode(this.text()));
    this.busy.set(false);
  }

  async pickFile(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    if (f.size > 5_000_000) return this.result.set({ ok: false, error: 'ไฟล์ใหญ่เกินไป — ไม่ใช่ไฟล์เซฟ' });
    this.text.set('');
    this.busy.set(true);
    this.result.set(await this.account.decode(await f.text()));
    this.busy.set(false);
  }

  summary(r: DecodeResult) {
    return r.ok ? saveSummary(r.envelope.state) : { name: '', heroes: 0, cleared: 0, gems: 0 };
  }

  when(r: DecodeResult): string {
    if (!r.ok) return '';
    const d = new Date(r.envelope.exportedAt);
    return isNaN(+d) ? '-' : d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
  }

  confirm(r: DecodeResult): void {
    this.pending.set(null);
    if (this.account.apply(r)) {
      this.result.set(null);
      this.text.set('');
      this.imported.emit();
    } else {
      this.result.set({ ok: false, error: 'เซฟนี้เก่าเกินไปหรือเสียหาย — นำเข้าไม่ได้' });
    }
  }
}
