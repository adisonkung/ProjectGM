import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SKY_BASE, SKY_LAYERS, SKY_PLOTS, SKY_SPIRE, SKY_WORLD } from '../../core/data/sky-city';
import { PLOT_BY_ID, BUILDING_BY_ID } from '../../core/data/island-layout';
import { IslandBuildingState, IslandThemeDefinition } from '../../core/models/island';
import { buildingDraw } from '../../island/island-view-model';
import { unlockFloorOf } from '../../core/rules/island';

/** A still crop of the actual map layers, not an illustration of an invented building. */
@Component({
  selector: 'app-island-detail-art',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <svg [attr.viewBox]="box()" preserveAspectRatio="xMidYMid slice">
      @if (city()) {
        <image [attr.href]="sky" x="0" y="0" [attr.width]="world.w" [attr.height]="world.h" preserveAspectRatio="xMidYMid slice"/>
        <image [attr.href]="base.src" [attr.x]="base.x" [attr.y]="base.y" [attr.width]="base.w" [attr.height]="base.h"/>
        <image [attr.href]="spire.src" [attr.x]="spire.x" [attr.y]="spire.y" [attr.width]="spire.w" [attr.height]="spire.h"/>
        @for (a of landmarks(); track a.src) { <image [attr.href]="a.src" [attr.x]="a.x" [attr.y]="a.y" [attr.width]="a.w" [attr.height]="a.h"/> }
      } @else {
        @for (s of classic(); track s.key) {
          <svg [attr.x]="s.x" [attr.y]="s.y" [attr.width]="s.w" [attr.height]="s.h" [attr.viewBox]="'0 0 ' + s.w + ' ' + s.h" overflow="hidden">
            <image [attr.href]="s.src" x="0" y="0" [attr.width]="s.w * (s.frames ?? 1)" [attr.height]="s.h" preserveAspectRatio="none"/>
          </svg>
        }
      }
    </svg>`,
  styles: [`:host{display:block;overflow:hidden;background:radial-gradient(ellipse at 40% 40%,#bcd2d1,#63746f 75%);}svg{display:block;width:100%;height:100%;}`],
})
export class IslandDetailArtComponent {
  readonly buildingId = input.required<string>();
  readonly city = input(true);
  readonly theme = input.required<IslandThemeDefinition>();
  readonly states = input.required<Record<string, IslandBuildingState>>();
  readonly overrides = input<Record<string, string>>({});
  readonly base = SKY_BASE;
  readonly spire = SKY_SPIRE;
  readonly sky = SKY_LAYERS.sky;
  readonly world = SKY_WORLD;
  readonly landmarks = computed(() => Object.values(SKY_PLOTS).flatMap(p => this.states()[p.id]?.isUnlocked && p.art ? [p.art] : []).sort((a,b) => a.z-b.z));
  readonly classic = computed(() => buildingDraw(this.theme(), this.states(), this.overrides(), unlockFloorOf).sprites.filter(s => s.key.startsWith(this.buildingId() + ':')));
  readonly box = computed(() => {
    if (this.city()) {
      const p = SKY_PLOTS[this.buildingId()].hit;
      return `${p.x - p.w * .35} ${p.y - p.h * .2} ${p.w * 1.7} ${p.h * 1.35}`;
    }
    const p = PLOT_BY_ID[BUILDING_BY_ID[this.buildingId()].plotId].buildingBounds;
    const sprites = this.classic();
    const x = Math.min(p.x,...sprites.map(s => s.x)), y = Math.min(p.y,...sprites.map(s => s.y));
    const right = Math.max(p.x+p.w,...sprites.map(s => s.x+s.w)), bottom = Math.max(p.y+p.h,...sprites.map(s => s.y+s.h));
    return `${x-30} ${y-30} ${right-x+60} ${bottom-y+60}`;
  });
}
