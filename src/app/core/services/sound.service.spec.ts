import { TestBed } from '@angular/core/testing';
import { DEFAULT_SOUND, readSoundSettings, SoundService } from './sound.service';

describe('SoundService', () => {
  const KEY = 'eldervane-sound';
  beforeEach(() => localStorage.removeItem(KEY));
  afterEach(() => localStorage.removeItem(KEY));

  it('reads settings safely (defaults, clamps, bad JSON)', () => {
    expect(readSoundSettings(null)).toEqual(DEFAULT_SOUND);
    expect(readSoundSettings('{oops')).toEqual(DEFAULT_SOUND);
    expect(readSoundSettings('{"enabled":false,"volume":3}')).toEqual({ enabled: false, volume: 1 });
    expect(readSoundSettings('{"enabled":"x","volume":-1}')).toEqual({ enabled: true, volume: 0 });
  });

  it('remembers on/off and volume on this device', () => {
    const s = TestBed.inject(SoundService);
    s.setVolume(0.35);
    s.setEnabled(false);
    expect(s.enabled()).toBeFalse();
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ enabled: false, volume: 0.35 });
  });

  it('makes no audio context while sound is off', () => {
    localStorage.setItem(KEY, JSON.stringify({ enabled: false, volume: 1 }));
    const spy = spyOn(window, 'AudioContext' as never).and.callThrough();
    const s = TestBed.inject(SoundService);
    s.play('tap');
    s.play('summon');
    expect(spy).not.toHaveBeenCalled();
  });
});
