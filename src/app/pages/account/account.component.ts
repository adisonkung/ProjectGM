import { RouterLink } from '@angular/router';
import { GameAccessService } from '../../core/services/game-access.service';
import { A11yModule } from '@angular/cdk/a11y';
import { TowerOrnamentComponent } from '../tower/tower-ornament.component';
import { CitadelIconComponent } from '../../shared/citadel-icon.component';
import { CitadelFrameComponent } from '../../shared/citadel-frame.component';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ISLAND_NAME_MAX, nameLength, normalizeIslandName } from '../../core/rules/account';
import { AccountService } from '../../core/services/account.service';
import { IconComponent } from '../../shared/icon.component';
import { SaveImportComponent } from '../../shared/save-import.component';

/** island name + move the save to another device (transfer code / file) — step 1 before cloud login */
@Component({
  selector: 'app-account',
  imports: [RouterLink, A11yModule, TowerOrnamentComponent, CitadelIconComponent, CitadelFrameComponent, IconComponent, SaveImportComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './account.component.html',
  styleUrl: './account.component.scss',
})
export class AccountComponent {
  readonly account = inject(AccountService);
  readonly access = inject(GameAccessService);
  readonly max = ISLAND_NAME_MAX;

  readonly editing = signal(false);
  readonly draft = signal('');
  readonly draftLength = computed(() => nameLength(normalizeIslandName(this.draft())));
  readonly draftError = computed(() => this.account.nameError(this.draft()));

  readonly code = signal('');
  readonly copied = signal(false);
  readonly notice = signal('');
  readonly backup = signal(this.account.hasBackup());

  edit(): void {
    this.draft.set(this.account.islandName());
    this.editing.set(true);
  }

  saveName(): void {
    if (this.account.setName(this.draft())) {
      this.editing.set(false);
      this.flash('เปลี่ยนชื่อเกาะแล้ว');
    }
  }

  async makeCode(): Promise<void> {
    this.copied.set(false);
    this.code.set(await this.account.transferCode());
  }

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.code());
      this.copied.set(true);
    } catch {
      this.flash('คัดลอกอัตโนมัติไม่ได้ — กดค้างที่รหัสแล้วคัดลอกเอง');
    }
  }

  download(): void {
    const url = URL.createObjectURL(new Blob([this.account.fileText()], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = this.account.fileName();
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  imported(): void {
    this.code.set('');
    this.backup.set(this.account.hasBackup());
    this.flash('นำเข้าเซฟแล้ว — ยินดีต้อนรับกลับสู่เกาะ ' + (this.account.islandName() || ''));
  }

  undo(): void {
    if (this.account.restoreBackup()) {
      this.backup.set(false);
      this.code.set('');
      this.flash('ย้อนกลับเป็นเซฟก่อนนำเข้าแล้ว');
    }
  }

  private flash(msg: string): void {
    this.notice.set(msg);
    setTimeout(() => this.notice() === msg && this.notice.set(''), 3500);
  }
}
