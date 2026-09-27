import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { DecodeResult, saveSummary } from '../core/rules/account';
import { AccountService } from '../core/services/account.service';
import { IconComponent } from './icon.component';

/** paste a transfer code or pick a save file → preview → confirm → this device's save is replaced */
@Component({
  selector: 'app-save-import',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="lbl" for="imp-code">รหัสย้ายเซฟ</label>
    <textarea id="imp-code" class="code" rows="3" spellcheck="false" autocomplete="off" placeholder="วางรหัสที่ขึ้นต้นด้วย ST1…"
              [value]="text()" (input)="text.set($any($event.target).value); result.set(null)"></textarea>
    <div class="row">
      <button type="button" class="gm-btn small" (click)="check()" [disabled]="busy() || !text().trim()"><app-icon name="load" [size]="13" /> ตรวจรหัส</button>
      <span class="or">หรือ</span>
      <label class="gm-btn small ghost file"><app-icon name="scroll" [size]="13" /> เลือกไฟล์เซฟ (.json)
        <input type="file" accept=".json,application/json" (change)="pickFile($event)" />
      </label>
    </div>

    @if (result(); as r) {
      @if (r.ok) {
        <div class="preview" role="status">
          <b>{{ summary(r).name }}</b>
          <span>ฮีโร่ {{ summary(r).heroes }} · หอคอยชั้น {{ summary(r).cleared }} · เพชร {{ summary(r).gems }}</span>
          <small>ส่งออกเมื่อ {{ when(r) }}</small>
          <p class="warn"><app-icon name="lock" [size]="13" /> เซฟในเครื่องนี้จะถูกแทนที่ (เก็บสำรองไว้ย้อนกลับได้ 1 ครั้ง)</p>
          <button type="button" class="gm-btn primary" (click)="confirm(r)">ใช้เซฟนี้</button>
        </div>
      } @else {
        <p class="err" role="alert">{{ r.error }}</p>
      }
    }
  `,
  styles: [`
    :host { display: grid; gap: 8px; }
    .lbl { font-size: 12.5px; color: var(--muted); }
    .code { width: 100%; box-sizing: border-box; resize: vertical; min-height: 64px; padding: 8px 10px; border-radius: 10px;
      background: #0b0914; border: 1px solid var(--line); color: var(--text); font: 12px/1.4 ui-monospace, Menlo, monospace; word-break: break-all; }
    .code:focus { outline: none; border-color: var(--gold); box-shadow: 0 0 0 2px #d9b46433; }
    .row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .or { color: var(--muted); font-size: 12px; }
    .file { position: relative; overflow: hidden; cursor: pointer; }
    .file input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
    .preview { display: grid; gap: 4px; padding: 12px; border-radius: 12px; background: #56c07a12; border: 1px solid #56c07a55; }
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
    if (this.account.apply(r)) {
      this.result.set(null);
      this.text.set('');
      this.imported.emit();
    } else {
      this.result.set({ ok: false, error: 'เซฟนี้เก่าเกินไปหรือเสียหาย — นำเข้าไม่ได้' });
    }
  }
}
