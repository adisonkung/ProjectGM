import { computed, inject, Injectable } from '@angular/core';
import { IslandVisitView, PlayerIsland } from '../models/island';
import { islandVisitView, normalizeIsland, setMainHero, setTheme, syncIsland } from '../rules/island';
import { SaveService } from './save.service';

/** Home Island state on the saved game (rules in core/rules/island.ts) */
@Injectable({ providedIn: 'root' })
export class IslandService {
  private readonly save = inject(SaveService);

  readonly island = computed<PlayerIsland>(() => {
    const s = this.save.state();
    return s.island ?? normalizeIsland(undefined, s);
  });
  readonly mainHeroUid = computed(() => this.island().mainIslandHeroId);

  /**
   * "Return to Island": compare the saved snapshot with tower progress, queue new progression events, persist.
   * Returns how many events were added.
   */
  sync(): number {
    const s = this.save.state();
    const r = syncIsland(this.island(), s.cleared);
    if (r.events.length || !s.island) this.save.update(st => ({ ...st, island: r.island }));
    return r.events.length;
  }

  /** the event on screen has been shown */
  popEvent(): void {
    this.save.update(st => (st.island ? { ...st, island: { ...st.island, pendingEvents: st.island.pendingEvents.slice(1) } } : st));
  }

  /** "skip all" — the buildings simply appear */
  clearEvents(): void {
    this.save.update(st => (st.island ? { ...st, island: { ...st.island, pendingEvents: [] } } : st));
  }

  setMainHero(uid: number): boolean {
    const s = this.save.state();
    const next = setMainHero(this.island(), s.heroes, uid);
    if (next) this.save.update(st => ({ ...st, island: next }));
    return !!next;
  }

  setTheme(themeId: string): boolean {
    const next = setTheme(this.island(), themeId);
    if (next) this.save.update(st => ({ ...st, island: next }));
    return !!next;
  }

  /** what a visitor would see (future online "Visit Island") */
  visitView(): IslandVisitView {
    const s = this.save.state();
    return islandVisitView({ ...s, island: this.island() });
  }
}
