import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { UltimateCutinArt } from '../core/data/ultimate-cutins';

@Component({
  selector: 'app-themed-cutin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './themed-cutin.component.html',
  styleUrl: './themed-cutin.component.scss',
})
export class ThemedCutinComponent {
  readonly art = input.required<UltimateCutinArt>();
  readonly name = input.required<string>();
  readonly skill = input.required<string>();
  readonly motes = Array.from({ length: 12 }, (_, i) => i);
}
