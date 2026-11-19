import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { SheetFxComponent } from '../../shared/sheet-fx.component';
import { HOME_ART } from './home-art';
import { LineIconComponent } from './line-icon.component';

/** Independent decorative layers on the right side of each K7 function card. */
@Component({
  selector: 'app-home-card-art',
  imports: [LineIconComponent, SheetFxComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', '[class.active]': 'active()' },
  templateUrl: './home-card-art.component.html',
  styleUrl: './home-card-art.component.scss',
})
export class HomeCardArtComponent {
  readonly card = input.required<'adventure' | 'arena' | 'daily'>();
  readonly active = input(false);
  readonly failed = signal(false);
  readonly art = HOME_ART;
  readonly dust = [24, 45, 66, 80];
}
