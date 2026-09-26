import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { skinStage } from '../core/data/island-themes';
import { BuildingSkin, PlaceholderStageStyle, Rect, SpriteStageStyle } from '../core/models/island';
import { ICON_PATHS } from '../shared/icon.component';

/**
 * Building RENDERERS — the only code that knows what a building looks like.
 * Both draw inside the plot footprint (`bounds`, bottom-centre anchored) handed to them by the scene; they never decide
 * position, collision, unlocks or interaction. PixelArt = the same contract with an <image>.
 */

/** PlaceholderBuildingRenderer: simple geometry + icon (Patch 1 prototype) */
@Component({
  selector: 'g[appPlaceholderBuilding]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let s = style();
    @let g = geo();
    @if (s.glow) { <svg:ellipse [attr.cx]="g.cx" [attr.cy]="g.bottom - g.h * 0.5" [attr.rx]="g.w * 0.75" [attr.ry]="g.h * 0.7" [attr.fill]="s.glow" filter="url(#isl-blur)" class="glow" /> }
    @switch (s.shape) {
      @case ('PILLAR') {
        <svg:rect [attr.x]="g.cx - g.w * 0.31" [attr.y]="g.bottom - g.h" [attr.width]="g.w * 0.62" [attr.height]="g.h" rx="6" [attr.fill]="s.fill" [attr.stroke]="s.stroke" stroke-width="3" />
        <svg:path [attr.d]="battlement(g)" [attr.fill]="s.fill" [attr.stroke]="s.stroke" stroke-width="3" stroke-linejoin="round" />
        <svg:rect [attr.x]="g.cx - 10" [attr.y]="g.bottom - 30" width="20" height="30" rx="10" fill="#0008" [attr.stroke]="s.stroke" stroke-width="2" />
      }
      @case ('ROUNDED_RECT') {
        <svg:rect [attr.x]="g.cx - g.w / 2" [attr.y]="g.bottom - g.h * 0.62" [attr.width]="g.w" [attr.height]="g.h * 0.62" rx="18" [attr.fill]="s.fill" [attr.stroke]="s.stroke" stroke-width="3" />
        <svg:line [attr.x1]="g.cx - g.w * 0.3" [attr.y1]="g.bottom - g.h * 0.62" [attr.x2]="g.cx - g.w * 0.3" [attr.y2]="g.bottom - g.h" [attr.stroke]="s.stroke" stroke-width="3" />
        <svg:line [attr.x1]="g.cx + g.w * 0.3" [attr.y1]="g.bottom - g.h * 0.62" [attr.x2]="g.cx + g.w * 0.3" [attr.y2]="g.bottom - g.h" [attr.stroke]="s.stroke" stroke-width="3" />
      }
      @case ('RECT') {
        <svg:rect [attr.x]="g.cx - g.w / 2" [attr.y]="g.bottom - g.h * 0.72" [attr.width]="g.w" [attr.height]="g.h * 0.72" rx="4" [attr.fill]="s.fill" [attr.stroke]="s.stroke" stroke-width="3" />
        <svg:path [attr.d]="roof(g)" [attr.fill]="s.stroke" fill-opacity="0.35" [attr.stroke]="s.stroke" stroke-width="3" stroke-linejoin="round" />
      }
      @case ('CIRCLE') {
        <svg:circle [attr.cx]="g.cx" [attr.cy]="g.bottom - g.r" [attr.r]="g.r" [attr.fill]="s.fill" [attr.stroke]="s.stroke" stroke-width="3" />
      }
      @case ('HEX') {
        <svg:path [attr.d]="hex(g)" [attr.fill]="s.fill" [attr.stroke]="s.stroke" stroke-width="3" stroke-linejoin="round" />
      }
      @case ('CAPSULE') {
        <svg:rect [attr.x]="g.cx - g.w / 2" [attr.y]="g.bottom - g.h" [attr.width]="g.w" [attr.height]="g.h" [attr.rx]="g.w / 2" [attr.fill]="s.fill" [attr.stroke]="s.stroke" stroke-width="3" />
      }
      @case ('LONG_RECT') {
        <svg:rect [attr.x]="g.cx - g.w / 2" [attr.y]="g.bottom - g.h * 0.5" [attr.width]="g.w" [attr.height]="g.h * 0.5" rx="10" [attr.fill]="s.fill" [attr.stroke]="s.stroke" stroke-width="3" />
        <svg:line [attr.x1]="g.cx" [attr.y1]="g.bottom - g.h * 0.5" [attr.x2]="g.cx + 6" [attr.y2]="g.bottom - g.h * 1.25" [attr.stroke]="s.stroke" stroke-width="3" />
      }
      @default { <!-- RUIN: broken foundation blocks inside a dashed footprint -->
        <svg:rect [attr.x]="g.fx" [attr.y]="g.bottom - 14" [attr.width]="g.fw" height="14" rx="3" fill="#0000" [attr.stroke]="s.stroke" stroke-width="2" stroke-dasharray="6 5" />
        <svg:rect [attr.x]="g.fx + 6" [attr.y]="g.bottom - 26" [attr.width]="g.fw * 0.22" height="26" rx="2" [attr.fill]="s.fill" [attr.stroke]="s.stroke" stroke-width="2" />
        <svg:rect [attr.x]="g.cx - g.fw * 0.08" [attr.y]="g.bottom - 16" [attr.width]="g.fw * 0.16" height="16" rx="2" [attr.fill]="s.fill" [attr.stroke]="s.stroke" stroke-width="2" />
        <svg:rect [attr.x]="g.fx + g.fw * 0.72" [attr.y]="g.bottom - 34" [attr.width]="g.fw * 0.18" height="34" rx="2" [attr.fill]="s.fill" [attr.stroke]="s.stroke" stroke-width="2" transform-origin="center" />
      }
    }
    <svg:svg [attr.x]="g.cx - 14" [attr.y]="iconY(g)" width="28" height="28" viewBox="0 0 24 24" fill="none" [attr.stroke]="s.stroke" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="ico">
      <svg:path [attr.d]="iconPath()" />
    </svg:svg>
  `,
})
export class PlaceholderBuildingRendererComponent {
  readonly bounds = input.required<Rect>();
  readonly style = input.required<PlaceholderStageStyle>();

  readonly iconPath = computed(() => ICON_PATHS[this.style().icon] ?? ICON_PATHS['star']);
  /** shape box: the footprint scaled by the stage (anchored bottom-centre) */
  readonly geo = computed(() => {
    const b = this.bounds(), s = this.style().scale;
    const w = b.w * s, h = b.h * s;
    return { cx: b.x + b.w / 2, bottom: b.y + b.h, w, h, r: Math.min(w, h) / 2, fx: b.x, fw: b.w };
  });
  battlement(g: { cx: number; bottom: number; w: number; h: number }) {
    const x0 = g.cx - g.w * 0.4, x1 = g.cx + g.w * 0.4, y = g.bottom - g.h, t = y - 14, step = (x1 - x0) / 5;
    let d = `M${x0} ${y} V${t}`;
    for (let i = 0; i < 5; i++) d += ` H${x0 + step * (i + 0.5)} V${i % 2 ? t : t + 7} H${x0 + step * (i + 1)} V${t}`;
    return d + ` V${y} Z`;
  }
  roof(g: { cx: number; bottom: number; w: number; h: number }) {
    const y = g.bottom - g.h * 0.72;
    return `M${g.cx - g.w / 2 - 6} ${y} L${g.cx} ${g.bottom - g.h} L${g.cx + g.w / 2 + 6} ${y} Z`;
  }
  hex(g: { cx: number; bottom: number; r: number }) {
    const cy = g.bottom - g.r;
    return Array.from({ length: 6 }, (_, i) => {
      const a = Math.PI / 6 + (i * Math.PI) / 3;
      return `${i ? 'L' : 'M'}${g.cx + Math.cos(a) * g.r} ${cy + Math.sin(a) * g.r}`;
    }).join(' ') + ' Z';
  }
  iconY(g: { bottom: number; h: number; r: number }) {
    const shape = this.style().shape;
    const mid = shape === 'CIRCLE' || shape === 'HEX' ? g.bottom - g.r : shape === 'RUIN' ? g.bottom - 44 : shape === 'PILLAR' ? g.bottom - g.h * 0.6 : g.bottom - g.h * 0.36;
    return mid - 14;
  }
}

/** PixelArtBuildingRenderer: same contract, draws a sprite anchored bottom-centre on the footprint */
@Component({
  selector: 'g[appSpriteBuilding]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let b = bounds();
    @let w = style().w ?? b.w;
    @let h = style().h ?? b.h;
    <svg:image [attr.href]="style().src" [attr.x]="b.x + b.w / 2 - w / 2" [attr.y]="b.y + b.h - h" [attr.width]="w" [attr.height]="h" preserveAspectRatio="xMidYMax meet" style="image-rendering: pixelated" />
  `,
})
export class PixelArtBuildingRendererComponent {
  readonly bounds = input.required<Rect>();
  readonly style = input.required<SpriteStageStyle>();
}

/** picks the renderer from the resolved skin — the scene only hands over (skin, stage, footprint) */
@Component({
  selector: 'g[appBuildingVisual]',
  imports: [PlaceholderBuildingRendererComponent, PixelArtBuildingRendererComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let sk = skin();
    @if (sk.kind === 'SPRITE') {
      <svg:g appSpriteBuilding [bounds]="bounds()" [style]="spriteStyle()!" />
    } @else {
      <svg:g appPlaceholderBuilding [bounds]="bounds()" [style]="placeholderStyle()!" />
    }
  `,
})
export class BuildingVisualComponent {
  readonly skin = input.required<BuildingSkin>();
  readonly stage = input.required<number>();
  readonly bounds = input.required<Rect>();
  readonly placeholderStyle = computed(() => { const s = this.skin(); return s.kind === 'PLACEHOLDER' ? skinStage(s.stages, this.stage()) : null; });
  readonly spriteStyle = computed(() => { const s = this.skin(); return s.kind === 'SPRITE' ? skinStage(s.stages, this.stage()) : null; });
}
