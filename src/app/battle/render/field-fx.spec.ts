import { FieldLifecycleEvent } from '../engine/fields';
import { FieldFxPlayback } from './field-fx';

describe('generic field visual lifecycle', () => {
  const start: FieldLifecycleEvent = { type: 'FIELD_STARTED', fieldId: 1, src: 3, at: { r: 1, c: 9 }, area: 'ADJACENT_8', duration: 6 };
  function scene() {
    let next = 0;
    const shown = new Map<number, { name: string; loop: boolean }>();
    const spawned: string[] = [];
    const player = new FieldFxPlayback({
      spawn: (name, _at, loop) => { const id = ++next; shown.set(id, { name, loop }); spawned.push(name); return id; },
      remove: ids => ids.forEach(id => shown.delete(id)),
    });
    return { player, shown, spawned };
  }

  it('starts once, loops independently of caster animation, reprojects the fixed world cell and shatters once at natural expiry', () => {
    const s = scene();
    s.player.handle(start, 'hero-mirelle.png', 16, 2);
    s.player.handle(start, 'hero-mirelle.png', 16, 2);
    expect(s.spawned).toEqual(['mf-ult-main', 'mf-ult-field']);
    s.player.advance(5); // cast animation and formation have ended, but the field is still alive
    expect([...s.shown.values()]).toEqual([{ name: 'mf-ult-field', loop: true }]);
    expect([...s.player.positions(20).values()]).toEqual([{ r: 1, c: 5 }]);
    const end: FieldLifecycleEvent = { ...start, type: 'FIELD_ENDED', reason: 'EXPIRED' };
    s.player.handle(end, undefined, 999, 8); // uses the stored field, never a moving/dead target or new origin
    s.player.handle(end, undefined, 999, 8);
    expect([...s.shown.values()].map(f => f.name)).toEqual(['mf-ult-shatter', 'mf-ult-residual']);
    expect(s.spawned.filter(n => n === 'mf-ult-shatter').length).toBe(1);
    s.player.advance(10);
    expect(s.shown.size).toBe(0);
  });

  it('source death and stage clear cancel startup/loop immediately, with no expiry shatter or late visuals', () => {
    for (const reason of ['SOURCE_DIED', 'CLEARED'] as const) {
      const s = scene();
      s.player.handle(start, 'hero-mirelle.png', 0, 0);
      s.player.handle({ ...start, type: 'FIELD_ENDED', reason }, undefined, 0, 0.2);
      s.player.advance(10);
      expect(s.shown.size).toBe(0);
      expect(s.spawned).toEqual(['mf-ult-main', 'mf-ult-field']);
    }
    const s = scene();
    s.player.handle(start, 'hero-mirelle.png', 0, 0);
    s.player.clear();
    expect(s.shown.size).toBe(0);
    expect(s.player.positions(0).size).toBe(0);
  });

  it('leads exactly five rain waves and renders each authoritative pulse once on the fixed six cells', () => {
    const s = scene();
    const field: FieldLifecycleEvent = { ...start, area: 'RECT_3X2', duration: 5, interval: 1 };
    s.player.handle(field, 'hero-sylvara.png', 16, 0);
    s.player.advance(0.59);
    expect(s.spawned.filter(n => n === 'sw-ult-rain').length).toBe(0);
    for (let index = 0; index < 5; index++) {
      s.player.advance(index + 0.6);
      const pulse: FieldLifecycleEvent = { ...field, type: 'FIELD_PULSED', index };
      s.player.handle(pulse, undefined, 999, index + 1);
      s.player.handle(pulse, undefined, 999, index + 1);
    }
    expect(s.spawned.filter(n => n === 'sw-ult-rain').length).toBe(5);
    expect(s.spawned.filter(n => n === 'sw-ult-impact').length).toBe(30);
    s.player.handle({ ...field, type: 'FIELD_ENDED', reason: 'EXPIRED' }, undefined, 999, 5);
    expect(s.spawned.filter(n => n === 'sw-ult-residual').length).toBe(1);
    const positions = [...s.player.positions(20).values()];
    expect(positions).toContain({ r: 1, c: 4 });
    expect(positions).toContain({ r: 2, c: 6 });
    s.player.advance(7);
    expect(s.shown.size).toBe(0);
    expect(s.spawned.filter(n => n === 'sw-ult-rain').length).toBe(5);
  });

  it('cancels a falling wave and pending waves on source death, stage clear or reset', () => {
    for (const reason of ['SOURCE_DIED', 'CLEARED'] as const) {
      const s = scene();
      const field: FieldLifecycleEvent = { ...start, area: 'RECT_3X2', duration: 5, interval: 1 };
      s.player.handle(field, 'hero-sylvara.png', 0, 0);
      s.player.advance(0.6);
      expect(s.spawned).toContain('sw-ult-rain');
      s.player.handle({ ...field, type: 'FIELD_ENDED', reason }, undefined, 0, 0.7);
      s.player.advance(20);
      expect(s.shown.size).toBe(0);
      expect(s.spawned.filter(n => n === 'sw-ult-rain').length).toBe(1);
      expect(s.spawned).not.toContain('sw-ult-impact');
      expect(s.spawned).not.toContain('sw-ult-residual');
    }
  });

  it('missing field presentation does not manufacture assets or affect combat', () => {
    const s = scene();
    s.player.handle(start, 'hero-kael.png', 0, 0);
    expect(s.spawned).toEqual([]);
  });
});
