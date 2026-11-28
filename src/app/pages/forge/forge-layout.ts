import { BreakpointObserver } from '@angular/cdk/layout';
import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

/** Same Desktop breakpoint as the Celestial Seal armory: the Anvil forge from 1024 px, the earlier layout below it. */
const FORGE_DESKTOP = '(min-width: 1024px)';

@Injectable({ providedIn: 'root' })
export class ForgeLayout {
  private readonly layout = inject(BreakpointObserver);
  readonly desktop = toSignal(this.layout.observe(FORGE_DESKTOP).pipe(map(state => state.matches)), {
    initialValue: this.layout.isMatched(FORGE_DESKTOP),
  });
}
