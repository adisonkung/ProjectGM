import { Component, computed, inject, input } from '@angular/core';
import { AccountService } from '../core/services/account.service';

/** Shared cosmetic frame: the art stays still while the metal, tracery and motes carry the animation. */
@Component({
  selector: 'app-profile-portrait',
  templateUrl: './profile-portrait.component.html',
  styleUrl: './profile-portrait.component.scss',
})
export class ProfilePortraitComponent {
  readonly account = inject(AccountService);
  readonly src = input('');
  readonly frame = input('');
  readonly motif = input('');
  readonly theme = computed(() => this.frame() || this.account.frame());
}
