import { DOCUMENT } from '@angular/common';
import { Component, HostListener, inject, input, signal } from '@angular/core';

/** Decorative layers only: no gameplay or save state. CSS motion stops when hidden or reduced. */
@Component({
  selector: 'app-adventure-scene',
  host: { 'aria-hidden': 'true', '[class.paused]': 'paused()', '[attr.data-scene]': 'kind()' },
  template: `
    <div class="landscape" [style.background-image]="'url(' + backgrounds[kind()] + ')' "></div>
    <div class="veil"></div><div class="rays"></div><div class="glow"></div>
    <div class="mist mist-back"></div><div class="mist mist-front"></div>
    <div class="motes">@for (m of motes; track $index) {
      <i [style.left.%]="m.x" [style.top.%]="m.y" [style.animation-delay.s]="m.delay" [style.animation-duration.s]="m.duration"></i>
    }</div>
  `,
  styleUrl: './adventure-scene.component.scss',
})
export class AdventureSceneComponent {
  readonly kind = input('tower');
  private readonly document = inject(DOCUMENT);
  readonly paused = signal(this.document.hidden);
  readonly backgrounds: Record<string, string> = {
    tower: '/ui/adventure-tower.png', training: '/ui/formation-open-court.png',
    ascension: '/ui/heroes-hall.png', hunt: '/ui/adventure-vault.png', trial: '/ui/summon-sanctum.jpg',
  };
  readonly motes = Array.from({ length: 16 }, (_, i) => ({ x: (i * 37 + 9) % 100, y: (i * 23 + 18) % 100, delay: -i * 2.7, duration: 12 + i % 7 }));
  @HostListener('document:visibilitychange') visibilityChanged(): void { this.paused.set(this.document.hidden); }
}
