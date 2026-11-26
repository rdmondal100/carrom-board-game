import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, sanitizeSettings } from '@/store/settingsSlice';
import { resolveView, webglSupported } from './support';

describe('3D view choice', () => {
  it('T3D-1 the choice wins; unset means 3D on capable devices, 2D on small ones', () => {
    expect(resolveView('2d', true, 8)).toBe('2d');
    expect(resolveView('3d', true, 2)).toBe('3d');
    expect(resolveView(undefined, true, 8)).toBe('3d');
    expect(resolveView(undefined, true, 2)).toBe('2d');
    expect(resolveView(undefined, true, undefined)).toBe('3d');
  });

  it('T3D-2 no WebGL: always 2D, whatever was chosen', () => {
    expect(resolveView('3d', false, 8)).toBe('2d');
    expect(webglSupported()).toBe(false); // jsdom has no WebGL 2
  });

  it('T3D-1 settings keep only known games and views, and a known quality', () => {
    expect(DEFAULT_SETTINGS.view).toEqual({});
    expect(DEFAULT_SETTINGS.quality).toBe('auto');
    const s = sanitizeSettings({ view: { ludo: '3d', carrom: '2d', chess: '3d', callbreak: '4d' }, quality: 'ultra' });
    expect(s.view).toEqual({ ludo: '3d', carrom: '2d' });
    expect(s.quality).toBe('auto');
    expect(sanitizeSettings({ view: ['3d'], quality: 'low' })).toMatchObject({ view: {}, quality: 'low' });
  });
});
