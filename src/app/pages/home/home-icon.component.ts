import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { SheetFxComponent } from '../../shared/sheet-fx.component';
import { HOME_ART, HOME_ICONS } from './home-art';
import { LineIconComponent } from './line-icon.component';

const SPIN_ICONS = new Set(['grid', 'summon', 'settings']);

@Component({
  selector: 'app-home-icon',
  imports: [LineIconComponent, SheetFxComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', '[style.--icon-size]': 'size() + "px"' },
  templateUrl: './home-icon.component.html',
  styleUrl: './home-icon.component.scss',
})
export class HomeIconComponent {
  readonly name = input.required<string>();
  readonly size = input(30);
  readonly active = input(false);
  readonly short = input(false);
  readonly art = HOME_ART;
  readonly spark = HOME_ART + 'fx_small_spark.webp';
  readonly squares = ['tl', 'tr', 'bl', 'br'];
  readonly missing = signal<ReadonlySet<string>>(new Set());
  readonly layers = computed(() => HOME_ICONS[this.name()]);
  readonly primary = computed(() => this.url(this.layers()?.[0]));
  readonly secondary = computed(() => this.url(this.layers()?.[1]));
  /** turn-in-place hover (menu grid, summon, settings) */
  readonly spin = computed(() => SPIN_ICONS.has(this.name()));
  readonly lightSweep = computed(() => ['hero', 'achieve', 'account'].includes(this.name()));

  markMissing(url: string): void {
    this.missing.update(urls => new Set([...urls, url]));
  }

  private url(file?: string): string | undefined {
    if (!file) return undefined;
    const url = HOME_ART + file + '.webp';
    return this.missing().has(url) ? undefined : url;
  }
}
