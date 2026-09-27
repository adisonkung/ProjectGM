import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ISLAND_NAME_MAX, nameLength, normalizeIslandName, suggestIslandName } from '../../core/rules/account';
import { AccountService } from '../../core/services/account.service';
import { IconComponent } from '../../shared/icon.component';
import { SaveImportComponent } from '../../shared/save-import.component';

/** first launch: name your island (or bring a save from another device) */
@Component({
  selector: 'app-welcome',
  imports: [IconComponent, SaveImportComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './welcome.component.html',
  styleUrl: './welcome.component.scss',
})
export class WelcomeComponent {
  private readonly account = inject(AccountService);
  private readonly router = inject(Router);

  readonly max = ISLAND_NAME_MAX;
  readonly name = signal('');
  readonly touched = signal(false);
  readonly mode = signal<'name' | 'import'>('name');

  readonly clean = computed(() => normalizeIslandName(this.name()));
  readonly length = computed(() => nameLength(this.clean()));
  readonly error = computed(() => this.account.nameError(this.name()));

  input(v: string): void {
    this.name.set(v);
    this.touched.set(true);
  }

  suggest(): void {
    this.name.set(suggestIslandName());
    this.touched.set(true);
  }

  start(): void {
    this.touched.set(true);
    if (this.account.setName(this.name())) this.router.navigateByUrl('/home');
  }

  imported(): void {
    // an imported save may already have its name → straight to the island; otherwise name it here
    if (!this.account.needsName()) this.router.navigateByUrl('/home');
    else this.mode.set('name');
  }
}
