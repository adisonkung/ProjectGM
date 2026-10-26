import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, inject, input, NgZone, OnDestroy, signal } from '@angular/core';

let ornamentId = 0;

/** Decorative metal only; independent of layout and pointer/keyboard interaction. */
@Component({
  selector: 'app-tower-ornament',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', '[class.crimson]': 'crimson()', '[class.ornate]': 'ornate()', '[class.arrow]': 'arrow()', '[class.challenge]': 'challenge()' },
  template: `<div class="face"></div><div class="inner-face"></div>
    <svg class="contours" [attr.viewBox]="'0 0 ' + width() + ' ' + height()" preserveAspectRatio="none" fill="none">
      <defs><linearGradient [id]="id" x1="0" y1="0" x2=".25" y2="1"><stop stop-color="#fff3c6" style="stop-color:var(--ornament-gold-light,#fff3c6)"/><stop offset=".2" stop-color="#b78743" style="stop-color:var(--ornament-gold-low,#b78743)"/><stop offset=".48" stop-color="#ffdf9b" style="stop-color:var(--ornament-gold-mid,#ffdf9b)"/><stop offset=".7" stop-color="#a57839" style="stop-color:var(--ornament-gold-shadow,#a57839)"/><stop offset="1" stop-color="#ffe3a4" style="stop-color:var(--ornament-gold-end,#ffe3a4)"/></linearGradient></defs>
      @if (grooved()) { <path class="edge-groove" [attr.d]="contour(1.5)" stroke="#100e0a" stroke-width="5"/> }
      <path class="outer-edge" [attr.d]="contour(1.5)" [attr.stroke]="'url(#' + id + ')'" [attr.stroke-width]="crimson() ? 1.8 : 1.3"/>
      <path class="inner-edge" [attr.d]="contour(6)" stroke="#f6d394" style="stroke:var(--ornament-inner-color,#f6d394)" stroke-width=".8" opacity=".85"/>
      @if (crimson()) { <path [attr.d]="'M' + (width() * .2) + ' 1.5H' + (width() * .78)" stroke="#fff7de" style="stroke:var(--ornament-glint,#fff7de)" stroke-width="1.4"/> }
    </svg>
    @if (ornate()) { @for (corner of corners; track corner) {
      <svg class="engraving" [class]="'engraving ' + corner" viewBox="0 0 94 94" fill="none">
        <path d="M4 72V27L27 4H72 M9 58V29L29 9H58 M5 39C32 39 18 12 42 12 M12 43C31 45 29 23 46 25 M26 6L31 17 42 22 31 27 26 38 21 27 10 22 21 17Z M34 31C37 42 45 38 51 45 M40 37L44 45 52 49 44 53 40 61 36 53 28 49 36 45Z M55 10H81 M10 55V81" stroke="currentColor" stroke-width=".8" />
        <path d="M26 18L30 22 26 26 22 22Z M38 47L40 43 42 47 46 49 42 51 40 55 38 51 34 49Z" fill="currentColor" opacity=".6" />
      </svg>
    } }
    @if (crimson()) { <svg class="seal" viewBox="0 0 64 64" fill="none"><path d="M32 3 61 32 32 61 3 32Z M32 11 53 32 32 53 11 32Z M32 1V63 M1 32H63 M18 18 46 46 M46 18 18 46 M32 18 36 28 46 32 36 36 32 46 28 36 18 32 28 28Z" stroke="currentColor" stroke-width=".6" /><circle cx="32" cy="32" r="19" stroke="currentColor" stroke-width=".6" /></svg> }`,
  styles: [`
    :host {--cut:18px;--edge:linear-gradient(150deg,#fff2c9,#ca9953 24%,#ffe7aa 48%,#a47b43 75%,#ffe5a5);--shape:polygon(var(--cut) 0,calc(100% - var(--cut)) 0,100% var(--cut),100% calc(100% - var(--cut)),calc(100% - var(--cut)) 100%,var(--cut) 100%,0 calc(100% - var(--cut)),0 var(--cut));position:absolute;inset:0;display:block;pointer-events:none;z-index:-1;filter:drop-shadow(0 5px 12px #120b0a55);}
    .face,.inner-face{position:absolute;clip-path:var(--shape);inset:0;}
    .face{inset:1px;background:var(--ornament-face,linear-gradient(135deg,#231c17ad,#0b0b10d9 70%));}.inner-face{inset:6px;background:var(--ornament-inset,radial-gradient(ellipse at 15% 0,#e5b97512,transparent 60%),linear-gradient(120deg,#221a1433,#0f0f1544 65%));}
    .contours{position:absolute;inset:0;width:100%;height:100%;overflow:visible;filter:var(--ornament-edge-filter,drop-shadow(0 0 2px #ffd89155));}
    .contours>.outer-edge{stroke-width:var(--ornament-outer-width,1.3px);}:host(.crimson) .contours>.outer-edge{stroke-width:var(--ornament-outer-width,1.8px);}.contours>.inner-edge{stroke-width:var(--ornament-inner-width,.8px);}
    .engraving{position:absolute;width:74px;height:74px;left:0;top:0;color:var(--ornament-engraving,#ffdea0);opacity:.95;}.tr{left:auto;right:0;transform:rotate(90deg);}.br{left:auto;right:0;top:auto;bottom:0;transform:rotate(180deg);}.bl{top:auto;bottom:0;transform:rotate(270deg);}
    :host(.arrow){--cut:24px;--shape:polygon(var(--cut) 0,calc(100% - var(--cut)) 0,100% 50%,calc(100% - var(--cut)) 100%,var(--cut) 100%,0 50%);}
    :host(.crimson){filter:var(--ornament-crimson-filter,drop-shadow(0 0 2px #ffd59eaa) drop-shadow(0 0 8px #ff7f332e));}:host(.crimson) .face{background:#410009;}:host(.crimson) .inner-face{background:linear-gradient(180deg,#ffdca740,transparent 16%,#12000222 50%,#0006),linear-gradient(100deg,#62000b,#8b0817 48%,#360006);box-shadow:inset 0 2px 12px #ffb17c66;}:host(.crimson) .inner-face::after{content:'';position:absolute;inset:0;background:linear-gradient(176deg,#fff4db77,transparent 12%,transparent 45%,#e4633722 49%,transparent 75%);}
    :host(.challenge){filter:var(--ornament-challenge-filter,drop-shadow(0 0 1px #ffe6b9) drop-shadow(0 2px 6px #fa8c4933));}
    :host(.challenge) .face{background:linear-gradient(90deg,#430005,#6e0409 46%,#350005);}
    :host(.challenge) .inner-face{background:radial-gradient(ellipse at 52% 0,#ed5b3f3d,transparent 65%),linear-gradient(172deg,#ffd4a52b,transparent 22%,#0003 65%),linear-gradient(90deg,#4a0006,#85080e 45%,#3a0007);box-shadow:inset 0 1px 5px #ffd6b04d;}
    :host(.challenge) .inner-face::after{background:linear-gradient(176deg,#ffe4be55,transparent 12%,transparent 70%);}
    :host(.challenge) .seal{right:8px;width:48px;height:48px;opacity:.23;}
    :host(.challenge) .inner-face::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(45deg,transparent 0 11px,#e4ac6730 11px 12px,transparent 12px 22px),repeating-linear-gradient(-45deg,transparent 0 11px,#e4ac6720 11px 12px,transparent 12px 22px);mask-image:linear-gradient(90deg,#000,transparent 17%,transparent 83%,#000);opacity:.7;}
    .seal{position:absolute;right:27px;top:50%;width:50px;height:50px;transform:translateY(-50%);color:#f5d38f;opacity:.42;}
  `],
})
export class TowerOrnamentComponent implements AfterViewInit, OnDestroy {
  readonly id = 'tower-metal-' + ornamentId++;
  readonly width = signal(100);
  readonly height = signal(60);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private observer?: ResizeObserver;
  readonly grooved = input(false);
  readonly challenge = input(false);
  readonly crimson = input(false);
  readonly ornate = input(false);
  readonly arrow = input(false);
  readonly corners = ['tl', 'tr', 'br', 'bl'];
  contour(inset: number): string {
    const w = this.width(), h = this.height(), c = this.arrow() ? Math.min(24, h / 2 - 2) : 18;
    if (this.arrow()) return `M${c + inset / 2} ${inset}H${w - c - inset / 2}L${w - inset} ${h / 2} ${w - c - inset / 2} ${h - inset}H${c + inset / 2}L${inset} ${h / 2}Z`;
    const k = c - inset * .3;
    return `M${inset + k} ${inset}H${w - inset - k}L${w - inset} ${inset + k}V${h - inset - k}L${w - inset - k} ${h - inset}H${inset + k}L${inset} ${h - inset - k}V${inset + k}Z`;
  }
  ngAfterViewInit(): void {
    if (typeof ResizeObserver === 'undefined') return;
    this.observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      this.zone.run(() => { this.width.set(Math.max(1, width)); this.height.set(Math.max(1, height)); });
    });
    this.observer.observe(this.element.nativeElement);
  }
  ngOnDestroy(): void { this.observer?.disconnect(); }
}
