import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MONSTERS } from '../../core/data/monsters';
import { spriteUrl } from '../../core/data/sprite-files';
import { IconComponent } from '../../shared/icon.component';

/** First idle frame of a monster's battle sheet, scaled to `height` (decorative — the name is shown next to it). */
@Component({
  selector: 'app-tower-monster',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (frame(); as f) {
    <span class="box" [style.width.px]="f.w" [style.height.px]="height()"><span class="cell" [style.width.px]="f.cellW" [style.height.px]="f.cellH"
      [style.background-image]="f.url" [style.background-position]="f.pos" [style.transform]="f.scale"></span></span>
  } @else { <app-icon name="skull" [size]="height() * 0.6" /> }`,
  styles: `:host{display:inline-flex;align-items:flex-end;justify-content:center;line-height:0}
    .box{position:relative;display:block;overflow:hidden}
    .cell{position:absolute;left:0;bottom:0;transform-origin:0 100%;background-repeat:no-repeat;image-rendering:pixelated}`,
})
export class TowerMonsterComponent {
  readonly id = input.required<string>();
  readonly height = input(64);
  readonly frame = computed(() => {
    const anim = MONSTERS[this.id()]?.animation;
    if (!anim?.sheet) return null;
    const cellW = anim.cellW ?? 132, cellH = anim.cellH ?? 100;
    const row = anim.clips['idle']?.row ?? 1;
    const s = this.height() / cellH;
    return {
      cellW, cellH, w: Math.round(cellW * s),
      url: `url(/${spriteUrl(anim.sheet)})`,
      pos: `0 ${-(row - 1) * cellH}px`,
      scale: `scale(${s})`,
    };
  });
}
