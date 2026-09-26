import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { FARM_DUNGEONS } from '../core/data/economy';
import { SaveService } from '../core/services/save.service';
import { PartyBarComponent } from '../battle/party-bar/party-bar.component';
import { UnitView } from '../battle/board/board.component';
import { DungeonsComponent, DUNGEON_TYPES } from './dungeons/dungeons.component';
import { ForgeComponent } from './forge/forge.component';

describe('Forge / dungeon menus / party bar', () => {
  beforeEach(() => localStorage.clear());

  it('forge crafts the chosen base into the bag and shows the result', async () => {
    await TestBed.configureTestingModule({
      imports: [ForgeComponent],
      providers: [provideRouter([]), { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } }],
    }).compileComponents();
    const save = TestBed.inject(SaveService);
    save.reset();
    save.update(s => ({ ...s, gold: 5000, inventory: { ...s.inventory, equip_frag_rare: 40 } }));
    const f = TestBed.createComponent(ForgeComponent);
    f.detectChanges();
    f.componentInstance.craft();
    f.detectChanges();
    expect(save.state().equipment.length).toBe(1);
    expect(save.state().equipment[0].definitionId).toBe('guard_armor');
    expect((f.nativeElement as HTMLElement).querySelector('.result')).not.toBeNull();
  });

  it('each dungeon type has its own page listing only its tiers', async () => {
    await TestBed.configureTestingModule({
      imports: [DungeonsComponent],
      providers: [provideRouter([]), { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ type: 'hunt' })) } }],
    }).compileComponents();
    const f = TestBed.createComponent(DungeonsComponent);
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelectorAll('.tier').length).toBe(FARM_DUNGEONS.filter(d => d.dailyBonusPool === 'HUNT').length);
    expect(el.querySelector('.target')).not.toBeNull(); // Hunt target picker lives with the Hunt dungeon
    expect(new Set(DUNGEON_TYPES.map(t => t.pool)).size).toBe(4);
  });

  it('party bar keeps the same height whether or not a status tag is shown', async () => {
    await TestBed.configureTestingModule({ imports: [PartyBarComponent] }).compileComponents();
    const f = TestBed.createComponent(PartyBarComponent);
    const u = { id: 1, name: 'ออเรล', cls: 'tank', side: 'ally', alive: true, hpPct: 100, manaPct: 10, heroId: 'aurel', star: 5 } as unknown as UnitView;
    document.body.appendChild(f.nativeElement);
    f.componentRef.setInput('units', [u]);
    f.detectChanges();
    const card = () => (f.nativeElement as HTMLElement).querySelector('.card') as HTMLElement;
    const h0 = card().getBoundingClientRect().height;
    f.componentRef.setInput('units', [{ ...u, intent: 'interrupt' }]);
    f.detectChanges();
    expect(card().querySelector('.intent')!.textContent).toContain('ตัดร่าย');
    expect(card().getBoundingClientRect().height).toBe(h0);
    f.nativeElement.remove();
  });
});
