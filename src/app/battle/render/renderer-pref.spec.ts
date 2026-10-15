import { savedRenderer, saveRenderer } from './renderer-pref';

describe('renderer preference', () => {
  const KEY = 'projectgm-renderer-v2';
  afterEach(() => localStorage.removeItem(KEY));

  it('Pixi is the default; an explicit choice is remembered', () => {
    localStorage.removeItem(KEY);
    expect(savedRenderer()).toBe('pixi');
    saveRenderer('dom');
    expect(savedRenderer()).toBe('dom');
    saveRenderer('pixi');
    expect(savedRenderer()).toBe('pixi');
  });

  it('an old phase-1 toggle (previous key) does not pin DOM', () => {
    localStorage.setItem('projectgm-renderer', 'dom');
    expect(savedRenderer()).toBe('pixi');
    localStorage.removeItem('projectgm-renderer');
  });
});
