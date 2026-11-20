import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SUMMON_ALTAR_ART } from './summon-cinematic';

/** The local stage and light effects share the engraved altar's screen-space origin. */
@Component({
  selector: 'app-summon-altar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[class.opening]': 'opening()',
    '[class.releasing]': 'release()',
    '[class.grand]': 'grand()',
  },
  template: `
    <div class="view"><img [src]="art" alt="" width="1672" height="941" /></div>
    @if (opening()) {
      <div class="altar-light">
        <div class="plane"><i class="inlay"></i><i class="sweep"></i><i class="shockwave"></i></div>
        <i class="shaft"></i><i class="star"></i>
        @for (mote of motes; track $index) {
          <i class="mote" [style.--start.px]="mote.start" [style.--end.vw]="mote.end"
             [style.--rise.dvh]="mote.rise" [style.--delay.ms]="mote.delay"></i>
        }
      </div>
    }
  `,
  styleUrl: './summon-altar.component.scss',
})
export class SummonAltarComponent {
  readonly opening = input(false);
  readonly release = input(false);
  readonly grand = input(false);
  readonly art = SUMMON_ALTAR_ART;
  readonly motes = Array.from({ length: 16 }, (_, i) => ({
    start: (i % 2 ? -1 : 1) * (13 + (i * 19) % 91),
    end: (i % 2 ? -1 : 1) * (4 + (i * 7) % 16),
    rise: 19 + (i * 13) % 23,
    delay: ((i * 43) % 310) + 35,
  }));
}
