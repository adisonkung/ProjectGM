import { DOCUMENT } from '@angular/common';
import { Injectable, NgZone, computed, inject, signal } from '@angular/core';

/** the basic sounds in public/sfx (built by tools/audio/build_ui_sfx.sh) */
export type SoundName = 'tap' | 'open' | 'close' | 'levelup' | 'summon';
export const SOUND_NAMES: readonly SoundName[] = ['tap', 'open', 'close', 'levelup', 'summon'];

export interface SoundSettings {
  /** sound on/off */
  enabled: boolean;
  /** master volume 0–1 */
  volume: number;
}

export const DEFAULT_SOUND: SoundSettings = { enabled: true, volume: 0.7 };
const KEY = 'eldervane-sound';

/** level of each sound under the master volume (taps are heard many times a minute) */
const MIX: Record<SoundName, number> = { tap: 0.55, open: 0.7, close: 0.65, levelup: 0.9, summon: 1 };
/** the same sound again sooner than this is dropped (a double click, two dialogs at once) */
const MIN_GAP_MS: Record<SoundName, number> = { tap: 45, open: 120, close: 120, levelup: 300, summon: 800 };

/** clicks on these play a tap, unless the element (or a parent) sets data-sfx="none" or another sound name */
const TAPPABLE = 'button, a[href], [role="button"], [role="tab"], input[type="checkbox"], input[type="radio"], select, summary';
/** a dialog appearing or leaving plays open / close */
const DIALOG = '[role="dialog"], [role="alertdialog"], dialog[open]';

export function readSoundSettings(raw: string | null): SoundSettings {
  try {
    const v = raw ? JSON.parse(raw) : null;
    if (!v || typeof v !== 'object') return { ...DEFAULT_SOUND };
    const volume = Number(v.volume);
    return {
      enabled: typeof v.enabled === 'boolean' ? v.enabled : DEFAULT_SOUND.enabled,
      volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : DEFAULT_SOUND.volume,
    };
  } catch {
    return { ...DEFAULT_SOUND };
  }
}

/**
 * Game sound effects through Web Audio: one context, one master gain, buffers decoded on first use.
 * Settings are per device (localStorage), not part of the save. Nothing plays before the first user
 * gesture (browser autoplay rules); `install()` hooks taps on buttons and dialogs opening/closing for
 * the whole app, other sounds are played by the code that knows the moment (summon, level up).
 */
@Injectable({ providedIn: 'root' })
export class SoundService {
  private readonly doc = inject(DOCUMENT);
  private readonly zone = inject(NgZone);

  private readonly state = signal<SoundSettings>(this.load());
  readonly enabled = computed(() => this.state().enabled);
  readonly volume = computed(() => this.state().volume);

  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly buffers = new Map<SoundName, Promise<AudioBuffer | null>>();
  private readonly last = new Map<SoundName, number>();
  private installed = false;
  private observer: MutationObserver | null = null;
  private dialogs = 0;

  setEnabled(on: boolean): void {
    this.store({ ...this.state(), enabled: on });
    if (on) this.play('tap');
  }

  setVolume(v: number): void {
    this.store({ ...this.state(), volume: Math.min(1, Math.max(0, v)) });
  }

  /** play a sound now (silently skipped when off, at zero volume, or when audio is unavailable) */
  play(name: SoundName): void {
    const s = this.state();
    if (!s.enabled || s.volume <= 0) return;
    const now = performance.now();
    if (now - (this.last.get(name) ?? -Infinity) < MIN_GAP_MS[name]) return;
    this.last.set(name, now);
    const ctx = this.context();
    if (!ctx || !this.master) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    const master = this.master;
    void this.buffer(name).then(buf => {
      if (!buf) return;
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      gain.gain.value = MIX[name];
      src.buffer = buf;
      src.connect(gain).connect(master);
      src.start();
    });
  }

  /** global hooks: a tap on every button / link, open and close when a dialog appears or leaves */
  install(): void {
    if (this.installed || typeof MutationObserver === 'undefined') return;
    this.installed = true;
    this.zone.runOutsideAngular(() => {
      this.doc.addEventListener('click', e => this.onClick(e), { capture: true, passive: true });
      this.dialogs = this.countDialogs();
      this.observer = new MutationObserver(() => this.onDomChange());
      this.observer.observe(this.doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });
    });
  }

  private onClick(e: Event): void {
    const t = e.target instanceof Element ? e.target : null;
    const el = t?.closest(TAPPABLE);
    if (!el || (el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return;
    const override = el.closest('[data-sfx]')?.getAttribute('data-sfx');
    if (override === 'none') return;
    this.play(override && (SOUND_NAMES as readonly string[]).includes(override) ? (override as SoundName) : 'tap');
  }

  private onDomChange(): void {
    const n = this.countDialogs();
    if (n > this.dialogs) this.play('open');
    else if (n < this.dialogs) this.play('close');
    this.dialogs = n;
  }

  private countDialogs(): number {
    let n = 0;
    this.doc.querySelectorAll(DIALOG).forEach(el => {
      if (!el.closest('[data-sfx="none"]')) n++;
    });
    return n;
  }

  private context(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume();
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  private buffer(name: SoundName): Promise<AudioBuffer | null> {
    let p = this.buffers.get(name);
    if (!p) {
      const ctx = this.ctx!;
      p = fetch(`sfx/${name}.${this.format()}`)
        .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
        .then(data => ctx.decodeAudioData(data))
        .catch(() => null);
      this.buffers.set(name, p);
    }
    return p;
  }

  /** Opus in WebM where the browser plays it (Chrome, Firefox, newer Safari), MP3 elsewhere */
  private format(): 'webm' | 'mp3' {
    try {
      const a = this.doc.createElement('audio');
      return a.canPlayType('audio/webm; codecs="opus"') ? 'webm' : 'mp3';
    } catch {
      return 'mp3';
    }
  }

  private store(s: SoundSettings): void {
    this.state.set(s);
    if (this.master) this.master.gain.value = s.volume;
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* private window: this session only */
    }
  }

  private load(): SoundSettings {
    try {
      return readSoundSettings(localStorage.getItem(KEY));
    } catch {
      return { ...DEFAULT_SOUND };
    }
  }
}
