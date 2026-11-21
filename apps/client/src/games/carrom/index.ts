import { readStorage } from '@/lib/storage';
import { lazyNamed } from '../lazy';
import type { ClientGame } from '../types';
import { CarromLogo } from './components/BoardDiagram';

/** Same key as save.ts (kept here so the hub doesn't load the game to check for a save). */
const SAVE_KEY = 'carrom.localGame';

/** HAPP-1 carrom in the hub. Every page is loaded on first use. */
export const carrom: ClientGame = {
  id: 'carrom',
  nameKey: 'games.carrom.name',
  taglineKey: 'games.carrom.tagline',
  Icon: CarromLogo,
  playModes: { local: true, bot: true, online: true, ranked: true },
  routes: {
    setup: lazyNamed(() => import('./pages/LocalSetup'), 'LocalSetup'),
    localGame: lazyNamed(() => import('./pages/LocalGame'), 'LocalGame'),
    online: lazyNamed(() => import('./pages/OnlineMenu'), 'OnlineMenu'),
    lobby: lazyNamed(() => import('./pages/Lobby'), 'Lobby'),
    onlineGame: lazyNamed(() => import('./pages/OnlineGame'), 'OnlineGame'),
    howToPlay: lazyNamed(() => import('./pages/HowToPlay'), 'HowToPlay'),
  },
  CosmeticPreview: lazyNamed(() => import('./components/SkinPreview'), 'CarromPreview'),
  SettingsCard: lazyNamed(() => import('./components/CarromSettings'), 'CarromSettings'),
  hasSave: () => readStorage(SAVE_KEY) !== null,
  devRoutes: [
    { path: 'dev/sandbox', labelKey: 'nav.sandbox', element: lazyNamed(() => import('./pages/Sandbox'), 'Sandbox') },
    { path: 'dev/determinism', labelKey: 'nav.determinism', element: lazyNamed(() => import('./pages/DevDeterminism'), 'DevDeterminism') },
  ],
};
