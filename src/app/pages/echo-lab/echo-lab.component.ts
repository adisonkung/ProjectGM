import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HEROES } from '../../core/data/heroes';
import { UnitSpriteComponent, SpriteAnim } from '../../battle/unit-sprite/unit-sprite.component';

/** Live original sprite renderer, not generated replacement artwork. */
@Component({
  selector: 'app-echo-lab', imports: [RouterLink, UnitSpriteComponent],
  template: `
    <header><a routerLink="/dungeons/trial">← Skill Trial</a><h1>Hall of Reflection · Shadow Violet</h1>
      <p>ฮีโร่ปกติ / Echo · {{ heroes.length }} ตัวละคร · โจมตีปกติ + สกิล 1/2 · ไม่มีอัลติเมต</p>
      <nav>@for (clip of clips; track clip) { <button (click)="play(clip)" [class.active]="anim() === clip">{{ clip }}</button> }</nav>
    </header>
    <main>@for (h of heroes; track h.id) {
      <article [attr.data-hero]="h.id"><h2>{{ h.name }} <small>{{ h.cls }}</small></h2><div class="pair">
        <section><div class="actor"><app-unit-sprite [cls]="h.cls" [sprite]="h.sprite" [anim]="anim()" [animKey]="key()" /></div><span>Original</span><div class="hp player"></div></section>
        <section class="spectral"><div class="actor"><app-unit-sprite class="echo-actor" [cls]="h.cls" [sprite]="h.sprite" side="enemy" [flip]="true" [anim]="anim()" [animKey]="key()" /></div><span>◇ Echo</span><div class="hp enemy"></div></section>
      </div></article>
    }</main>`,
  styles: [`
    :host { display:block; min-height:100vh; padding:24px; background:#111c24; color:#e9e3d2; }
    header { max-width:1200px; margin:auto; } h1 { color:#bea4e5; margin:12px 0; } a { color:#dbc18a; }
    nav { display:flex; gap:8px; flex-wrap:wrap; margin:20px 0; } button { background:#20323c; color:#e9e3d2; border:1px solid #68716b; padding:8px 16px; cursor:pointer; } button.active { border-color:#a68ace; }
    main { max-width:1200px; margin:auto; display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:16px; }
    article { border:1px solid #81704c; background:linear-gradient(#253139,#121e27); padding:12px; }
    h2 { font-size:16px; text-align:center; margin:4px; } small { display:block; font-size:11px; color:#a5adb0; }
    .pair { display:grid; grid-template-columns:1fr 1fr; } section { text-align:center; position:relative; }
    .actor { position:relative; width:100px; height:130px; margin:12px auto 0; }
    .spectral .actor::after { content:''; position:absolute; width:72px; height:15px; bottom:0; left:14px; border:1px solid #a58ade55; border-radius:50%; background:radial-gradient(ellipse,#59407835,transparent 70%); box-shadow:0 -5px 8px #4b31651a; }
    section span { display:block; font-size:12px; color:#c9c4b9; margin:10px; } .spectral span { color:#b49bdc; }
    .hp { height:4px; width:64px; margin:0 auto 8px; } .player { background:#6eaf72; } .enemy { background:#cd5d67; }
    @media(max-width:900px) { main { grid-template-columns:repeat(2,minmax(0,1fr)); } }
    @media(max-width:540px) { main { grid-template-columns:1fr; } :host { padding:12px; } }
  `],
})
export class EchoLabComponent {
  readonly heroes = HEROES;
  readonly clips: SpriteAnim[] = ['idle', 'walk', 'attack', 'skill', 'skill2', 'hurt', 'die'];
  readonly anim = signal<SpriteAnim>('idle');
  readonly key = signal(0);
  play(clip: SpriteAnim): void { this.anim.set(clip); this.key.update(k => k + 1); }
}
