import { AfterViewInit, ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, NgZone, OnDestroy, signal } from '@angular/core';

let frameId = 0;

/** Responsive metal contour: corner cuts stay in CSS pixels, including on narrow phones. */
@Component({
  selector: 'app-citadel-frame',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.viewBox]="'0 0 ' + width() + ' ' + height()" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient [id]="id + '-metal'" x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stop-color="#fff3bb" style="stop-color:var(--citadel-gold-stop-0,#fff3bb)"/><stop offset=".12" stop-color="#9b6426" style="stop-color:var(--citadel-gold-stop-1,#9b6426)"/>
          <stop offset=".25" stop-color="#ffe8a5" style="stop-color:var(--citadel-gold-stop-2,#ffe8a5)"/><stop offset=".43" stop-color="#d1a44e" style="stop-color:var(--citadel-gold-stop-3,#d1a44e)"/>
          <stop offset=".63" stop-color="#755124" style="stop-color:var(--citadel-gold-stop-4,#755124)"/><stop offset=".8" stop-color="#ffe8a2" style="stop-color:var(--citadel-gold-stop-5,#ffe8a2)"/><stop offset="1" stop-color="#ba863b" style="stop-color:var(--citadel-gold-stop-6,#ba863b)"/>
        </linearGradient>
        <linearGradient [id]="id + '-face'" x1="0" y1="0" x2=".8" y2="1">
          <stop offset="0" [attr.stop-color]="crimson() ? '#550009' : '#1f2428'"/>
          <stop offset=".4" [attr.stop-color]="crimson() ? '#a90016' : '#11171b'"/>
          <stop offset="1" [attr.stop-color]="crimson() ? '#4d0008' : '#101316'"/>
        </linearGradient>
        <radialGradient [id]="id + '-gloss'" cx=".5" cy="0" r=".8">
          <stop offset="0" [attr.stop-color]="crimson() ? '#ff402d' : '#d7e5e9'" [attr.stop-opacity]="crimson() ? '.28' : '.08'"/>
          <stop offset="1" stop-color="#000" stop-opacity="0"/>
        </radialGradient>
        <pattern [id]="id + '-runes'" width="76" height="76" patternUnits="userSpaceOnUse">
          <path d="M38 1 75 38 38 75 1 38Z M38 13 63 38 38 63 13 38Z M1 1 75 75 M75 1 1 75 M23 38a15 15 0 1 0 30 0a15 15 0 1 0-30 0" fill="none" stroke="#cca552" stroke-width=".6" opacity=".025"/>
        </pattern>
        @if (lacquer()) {
          <pattern [id]="id + '-lacquer'" width="1" height="1" patternContentUnits="objectBoundingBox">
            <image href="/ui/eldervane/home-tower-button.webp" x="-.14" y="-.22" width="1.28" height="1.44" preserveAspectRatio="none" />
          </pattern>
          <linearGradient [id]="id + '-polish'" x1="0" y1="0" x2=".45" y2="1">
            <stop offset="0" stop-color="#fff0d1" stop-opacity=".2"/>
            <stop offset=".32" stop-color="#ffab78" stop-opacity=".04"/>
            <stop offset=".5" stop-color="#fff0d1" stop-opacity=".1"/>
            <stop offset=".53" stop-color="#260008" stop-opacity=".14"/>
            <stop offset="1" stop-color="#260008" stop-opacity=".28"/>
          </linearGradient>
          <clipPath [id]="id + '-surface'"><path [attr.d]="contour(9)" /></clipPath>
        }
      </defs>
      <path [attr.d]="contour(2)" fill="#090c0f" stroke="#090b0d" stroke-width="4"/>
      <path [attr.d]="contour(3)" [attr.fill]="url('face')" [attr.stroke]="url('metal')" stroke-width="2.8"/>
      @if (lacquer()) {
        <path [attr.d]="contour(8)" fill="#370008" />
        <path [attr.d]="contour(8)" [attr.fill]="url('lacquer')" opacity=".76" />
        <path [attr.d]="contour(8)" [attr.fill]="url('polish')" />
        @if (width() > 100) {
          <g [attr.clip-path]="url('surface')" fill="none" stroke="#f2aa79" stroke-width=".75" opacity=".2">
            <g [attr.transform]="'translate(' + (width() - 78) + ' 9)'">
              <path d="M8 0C8 18 28 2 28 18S8 28 8 40 M4 4C22 4 12 20 32 20 M20 0 24 8 32 12 24 16 20 24 16 16 8 12 16 8Z M28 26C16 22 16 41 6 41 M0 44C5 33 17 44 22 34" />
            </g>
          </g>
        }
      }
      <path [attr.d]="contour(7)" fill="none" stroke="#080a0d" stroke-width="3"/>
      <path [attr.d]="contour(7)" [attr.fill]="url('gloss')" [attr.stroke]="url('metal')" stroke-width="1.1"/>
      <path [attr.d]="contour(9)" [attr.fill]="url('runes')" stroke="#f5d28a" stroke-opacity=".18" stroke-width=".6"/>
      <path [attr.d]="glint()" fill="none" [attr.stroke]="crimson() ? '#ffb28a' : '#fff1c3'" stroke-width="1" opacity=".9"/>
      @if (crimson() && !lacquer()) {
        <path [attr.d]="light()" stroke="#ff3020" stroke-width="2"/>
        <path [attr.d]="light(true)" stroke="#fff0c4" stroke-width="1"/>
      }
    </svg>`,
  styles: [`:host { position: absolute; inset: 0; display: block; pointer-events: none; z-index: -1; } svg { display: block; width: 100%; height: 100%; overflow: visible; }`],
})
export class CitadelFrameComponent implements AfterViewInit, OnDestroy {
  readonly id = 'citadel-frame-' + frameId++;
  readonly shape = input<'panel' | 'chapter' | 'hex' | 'tab' | 'rect'>('panel');
  readonly crimson = input(false);
  readonly lacquer = input(false);
  readonly cut = input(22);
  readonly width = signal(100);
  readonly height = signal(60);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private observer?: ResizeObserver;
  readonly glint = computed(() => `M${this.width() * .22} 3H${this.width() * .61}`);
  url(part: string): string { return `url(#${this.id}-${part})`; }
  contour(inset: number): string {
    const w = this.width(), h = this.height(), c = Math.min(this.cut(), h / 2 - 2, w / 4);
    if (this.shape() === 'rect') return `M${inset} ${inset}H${w - inset}V${h - inset}H${inset}Z`;
    if (this.shape() === 'tab') return `M${c + inset} ${inset}H${w - inset}L${w - c - inset} ${h - inset}H${inset}Z`;
    if (this.shape() === 'hex') return `M${c + inset / 2} ${inset}H${w - c - inset / 2}L${w - inset} ${h / 2} ${w - c - inset / 2} ${h - inset}H${c + inset / 2}L${inset} ${h / 2}Z`;
    const k = Math.max(2, c - inset * .3);
    if (this.shape() === 'chapter') {
      const rightCut = Math.min(h * .34, 75) - inset * .3;
      return `M${inset + k} ${inset}H${w - inset - rightCut}L${w - inset} ${inset + rightCut}V${h - inset - rightCut}L${w - inset - rightCut} ${h - inset}H${inset + k}L${inset} ${h - inset - k}V${inset + k}Z`;
    }
    return `M${inset + k} ${inset}H${w - inset - k}L${w - inset} ${inset + k}V${h - inset - k}L${w - inset - k} ${h - inset}H${inset + k}L${inset} ${h - inset - k}V${inset + k}Z`;
  }
  light(inner = false): string {
    const w = this.width(), y = inner ? this.height() - 7 : this.height() - 3;
    return `M${w * .32} ${y}H${w * .68}`;
  }
  ngAfterViewInit(): void {
    if (typeof ResizeObserver === 'undefined') return;
    this.observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      this.zone.run(() => { this.width.set(Math.max(1, width)); this.height.set(Math.max(1, height)); });
    });
    this.observer.observe(this.host.nativeElement);
  }
  ngOnDestroy(): void { this.observer?.disconnect(); }
}
