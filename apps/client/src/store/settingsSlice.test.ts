import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS, SETTINGS_KEY, loadSettings, sanitizeSettings, setHaptics, setLanguage, setVoiceMode, setVolume,
} from './settingsSlice';
import { makeStore } from './store';

describe('settings', () => {
  beforeEach(() => localStorage.clear());

  it('UI-2 settings persist and reload', () => {
    const a = makeStore();
    a.dispatch(setLanguage('en'));
    a.dispatch(setVolume(0.3));
    a.dispatch(setHaptics(false));
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}')).toMatchObject({ language: 'en', volume: 0.3 });
    const b = makeStore();
    expect(b.getState().settings).toEqual({ ...DEFAULT_SETTINGS, language: 'en', volume: 0.3, haptics: false });
  });

  it('UI-2 corrupt storage falls back to defaults', () => {
    localStorage.setItem(SETTINGS_KEY, '{not json');
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(makeStore().getState().settings).toEqual(DEFAULT_SETTINGS);
    localStorage.setItem(SETTINGS_KEY, '[1,2]');
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('UI-2 bad fields fall back one by one; volume is clamped', () => {
    expect(sanitizeSettings({ language: 'fr', volume: 7, haptics: 'yes', viewRotation: false }))
      .toEqual({ ...DEFAULT_SETTINGS, volume: 1, viewRotation: false });
    expect(sanitizeSettings({ volume: Number.NaN }).volume).toBe(DEFAULT_SETTINGS.volume);
    const s = makeStore();
    s.dispatch(setVolume(-2));
    expect(s.getState().settings.volume).toBe(0);
  });

  it('VOICE-4 voice mode: open by default, kept when valid, off is a choice', () => {
    expect(DEFAULT_SETTINGS.voiceMode).toBe('open');
    expect(sanitizeSettings({ voiceMode: 'ptt' }).voiceMode).toBe('ptt');
    expect(sanitizeSettings({ voiceMode: 'loud' }).voiceMode).toBe('open');
    const s = makeStore();
    s.dispatch(setVoiceMode('off'));
    expect(s.getState().settings.voiceMode).toBe('off');
  });

  it('UI-2 reads the pre-05 language and rotation keys once', () => {
    localStorage.setItem('carrom.lang', 'en');
    localStorage.setItem('carrom.rotateView', 'off');
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, language: 'en', viewRotation: false });
  });
});
