import { BreakpointObserver } from '@angular/cdk/layout';
import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

const ARCHIVE_DESKTOP = '(min-width: 1024px)';

@Injectable({ providedIn: 'root' })
export class TeamBuilderLayout {
  private readonly layout = inject(BreakpointObserver);
  readonly desktop = toSignal(this.layout.observe(ARCHIVE_DESKTOP).pipe(map(state => state.matches)), {
    initialValue: this.layout.isMatched(ARCHIVE_DESKTOP),
  });
}
