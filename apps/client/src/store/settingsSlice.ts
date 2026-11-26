import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { GAME_IDS, type GameId } from '@hub/game-kit';
import { readJson, readStorage, writeStorage } from '@/lib/storage';

export type Lang = 'bn' | 'en';

export interface Settings {
  language: Lang;
  /** Turn the board so the shooter sits at the bottom (LOC-3). */
  viewRotation: boolean;
  /** Sound volume, 0–1. */
  volume: number;
  haptics: boolean;
  /** The shot clock switch's starting value on the setup screen. */
  defaultShotClock: boolean;
  /** VOICE-4 voice in online rooms: open mic (tap to talk), push-to-talk (hold), or off entirely. */
  voiceMode: VoiceMode;
  /** T3D-1 2D or 3D board per game; a game missing here uses the device default. */
  view: Partial<Record<GameId, View>>;
  /** T3D-1 3D detail for every game. */
  quality: Quality;
}

export type VoiceMode = 'open' | 'ptt' | 'off';
export const VOICE_MODES: readonly VoiceMode[] = ['open', 'ptt', 'off'];
export type View = '2d' | '3d';
export const VIEWS: readonly View[] = ['2d', '3d'];
export type Quality = 'auto' | 'low' | 'high';
export const QUALITIES: readonly Quality[] = ['auto', 'low', 'high'];

export const SETTINGS_KEY = 'carrom.settings';
/** Keys written before spec 05; read once when no settings are saved yet. */
const LEGACY_LANG_KEY = 'carrom.lang';
const LEGACY_ROTATE_KEY = 'carrom.rotateView';
const DEFAULT_VOLUME = 0.8;

export const DEFAULT_SETTINGS: Settings = {
  language: 'bn', viewRotation: true, volume: DEFAULT_VOLUME, haptics: true, defaultShotClock: true, voiceMode: 'open',
  view: {}, quality: 'auto',
};

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const isLang = (v: unknown): v is Lang => v === 'bn' || v === 'en';

/** T3D-1 keep only known games with a known view. */
function sanitizeView(raw: unknown): Partial<Record<GameId, View>> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const out: Partial<Record<GameId, View>> = {};
  for (const [k, v] of Object.entries(raw)) {
    if ((GAME_IDS as readonly string[]).includes(k) && VIEWS.includes(v as View)) out[k as GameId] = v as View;
  }
  return out;
}

/** Keep each valid field; anything missing or of the wrong type falls back to its default. */
export function sanitizeSettings(raw: unknown): Settings {
  const d = DEFAULT_SETTINGS;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ...d };
  const r = raw as Record<string, unknown>;
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
  return {
    language: isLang(r.language) ? r.language : d.language,
    viewRotation: bool(r.viewRotation, d.viewRotation),
    volume: typeof r.volume === 'number' && Number.isFinite(r.volume) ? clamp01(r.volume) : d.volume,
    haptics: bool(r.haptics, d.haptics),
    defaultShotClock: bool(r.defaultShotClock, d.defaultShotClock),
    voiceMode: VOICE_MODES.includes(r.voiceMode as VoiceMode) ? r.voiceMode as VoiceMode : d.voiceMode,
    view: sanitizeView(r.view),
    quality: QUALITIES.includes(r.quality as Quality) ? r.quality as Quality : d.quality,
  };
}

export function loadSettings(): Settings {
  const saved = readJson(SETTINGS_KEY);
  if (saved !== null) return sanitizeSettings(saved);
  const lang = readStorage(LEGACY_LANG_KEY);
  return {
    ...DEFAULT_SETTINGS,
    language: isLang(lang) ? lang : DEFAULT_SETTINGS.language,
    viewRotation: readStorage(LEGACY_ROTATE_KEY) !== 'off',
  };
}

export function saveSettings(s: Settings): void {
  writeStorage(SETTINGS_KEY, JSON.stringify(s));
}

const settingsSlice = createSlice({
  name: 'settings',
  initialState: loadSettings,
  reducers: {
    setLanguage: (s, a: PayloadAction<Lang>) => { s.language = a.payload; },
    setViewRotation: (s, a: PayloadAction<boolean>) => { s.viewRotation = a.payload; },
    setVolume: (s, a: PayloadAction<number>) => { s.volume = clamp01(a.payload); },
    setHaptics: (s, a: PayloadAction<boolean>) => { s.haptics = a.payload; },
    setDefaultShotClock: (s, a: PayloadAction<boolean>) => { s.defaultShotClock = a.payload; },
    setVoiceMode: (s, a: PayloadAction<VoiceMode>) => { s.voiceMode = a.payload; },
    setGameView: (s, a: PayloadAction<{ game: GameId; view: View }>) => { s.view = { ...s.view, [a.payload.game]: a.payload.view }; },
    setQuality: (s, a: PayloadAction<Quality>) => { s.quality = a.payload; },
    resetSettings: () => ({ ...DEFAULT_SETTINGS }),
  },
});

export const {
  setLanguage, setViewRotation, setVolume, setHaptics, setDefaultShotClock, setVoiceMode, setGameView, setQuality, resetSettings,
} = settingsSlice.actions;
export const settingsReducer = settingsSlice.reducer;
