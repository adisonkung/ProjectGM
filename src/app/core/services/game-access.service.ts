import { Injectable } from '@angular/core';
import { DEV_FLAGS } from '../data/dev-flags';

/** UI access policy. Everyone is GM temporarily by user request; no login/identity system yet. */
@Injectable({ providedIn: 'root' })
export class GameAccessService {
  readonly isGm = (): boolean => DEV_FLAGS.allPlayersAreGm;
}
