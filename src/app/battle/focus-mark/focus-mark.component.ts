import { Component, input } from '@angular/core';

/** เครื่องหมายเป้าโฟกัส (🎯 + วงเล็งหมุนที่เท้า) หรือกรอบเลือก (ยังไม่โฟกัส) */
@Component({
  selector: 'app-focus-mark',
  template: `
    <span class="ring" [class.sel]="!focused()"></span>
    @if (focused()) { <b class="tag">🎯 FOCUS</b> }
  `,
  styles: `
    :host { position: absolute; inset: 0; pointer-events: none; z-index: 4; }
    .ring {
      position: absolute; left: 50%; bottom: -2%; width: 92%; aspect-ratio: 2.4; transform: translateX(-50%);
      border-radius: 50%; border: 2px dashed #ff5a4e; box-shadow: 0 0 10px #ff5a4eaa, inset 0 0 8px #ff5a4e66;
      animation: spin 3s linear infinite;
      &.sel { border: 2px solid #fff9; box-shadow: 0 0 8px #fff6; animation: none; }
    }
    .tag {
      position: absolute; left: 50%; top: -34%; transform: translateX(-50%); white-space: nowrap;
      padding: 1px 6px; border-radius: 999px; background: #ff5a4e; color: #fff; font: 700 9px var(--disp);
      letter-spacing: 0.06em; box-shadow: 0 0 8px #ff5a4e; animation: bob 0.9s ease-in-out infinite alternate;
    }
    @keyframes spin { to { transform: translateX(-50%) rotate(360deg); } }
    @keyframes bob { to { transform: translate(-50%, -3px); } }
    @media (prefers-reduced-motion: reduce) { .ring, .tag { animation: none; } }
  `,
})
export class FocusMarkComponent {
  readonly focused = input(false);
}
