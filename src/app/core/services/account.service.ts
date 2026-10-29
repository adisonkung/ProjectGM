import { HERO_ART } from '../data/hero-art';
import { computed, inject, Injectable } from '@angular/core';
import { decodeSaveText, DecodeResult, encodeSaveCode, islandNameError, needsIslandName, setIslandName } from '../rules/account';
import { SaveService } from './save.service';

/** island name + save transfer (rules in core/rules/account.ts) */
@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly save = inject(SaveService);

  readonly frames = [
    { id: 'default', name: 'เกาะลอยฟ้า', motif: '◇' },
    { id: 'wuxia', name: 'Wuxia · หยกเมฆา', motif: '☯︎' },
    { id: 'fantasy', name: 'Fantasy · มงกุฎดารา', motif: '✧' },
    { id: 'dark', name: 'Dark Fantasy · บัลลังก์รัตติกาล', motif: '✦' },
  ];
  readonly portrait = computed(() => {
    const id = this.save.state().profile?.portrait;
    return id && HERO_ART[id] ? HERO_ART[id].portrait : 'ui/eldervane/citadel.webp';
  });
  readonly frame = computed(() => {
    const id = this.save.state().profile?.frame;
    return this.frames.some(f => f.id === id) ? id! : 'default';
  });
  readonly portraitId = computed(() => this.save.state().profile?.portrait ?? 'default');
  setPortrait(id: string): void {
    if (id !== 'default' && !HERO_ART[id]) return;
    this.save.update(s => ({ ...s, profile: { portrait: id, frame: this.frame() } }));
  }
  setFrame(id: string): void {
    if (!this.frames.some(f => f.id === id)) return;
    this.save.update(s => ({ ...s, profile: { portrait: this.portraitId(), frame: id } }));
  }

  readonly islandName = computed(() => this.save.state().island?.name ?? '');
  readonly needsName = computed(() => needsIslandName(this.save.state()));

  nameError = (raw: string) => islandNameError(raw);

  /** set / rename; false when invalid */
  setName(raw: string): boolean {
    const next = setIslandName(this.save.state(), raw);
    if (next) this.save.update(() => next);
    return !!next;
  }

  transferCode(): Promise<string> {
    return encodeSaveCode(this.save.exportEnvelope());
  }

  /** pretty JSON for the downloadable save file */
  fileText(): string {
    return JSON.stringify(this.save.exportEnvelope(), null, 1);
  }

  fileName(): string {
    const n = (this.islandName() || 'island').replace(/[^\p{L}\p{M}\p{N}_-]+/gu, '_');
    return `eldervane_${n}_${new Date().toISOString().slice(0, 10)}.json`;
  }

  decode(text: string): Promise<DecodeResult> {
    return decodeSaveText(text);
  }

  /** overwrite this device's save with a decoded one */
  apply(r: DecodeResult): boolean {
    return r.ok && this.save.importState(r.envelope.state);
  }

  hasBackup = () => this.save.hasBackup();
  restoreBackup = () => this.save.restoreBackup();
}
