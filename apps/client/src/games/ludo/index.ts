import { Dices } from 'lucide-react';
import { readStorage } from '@/lib/storage';
import { lazyNamed } from '../lazy';
import type { ClientGame } from '../types';

/** Same key as save.ts (kept here so the hub doesn't load the game to check for a save). */
const SAVE_KEY = 'ludo.localGame';

/** LUDO-6 Ludo in the hub. Every page is loaded on first use. */
export const ludo: ClientGame = {
  id: 'ludo',
  nameKey: 'games.ludo.name',
  taglineKey: 'games.ludo.tagline',
  Icon: Dices,
  playModes: { local: true, bot: true, online: true, ranked: true },
  routes: {
    setup: lazyNamed(() => import('./pages/LudoSetup'), 'LudoSetup'),
    localGame: lazyNamed(() => import('./pages/LudoLocal'), 'LudoLocal'),
    online: lazyNamed(() => import('./pages/LudoOnlineMenu'), 'LudoOnlineMenu'),
    lobby: lazyNamed(() => import('./pages/LudoLobby'), 'LudoLobby'),
    onlineGame: lazyNamed(() => import('./pages/LudoOnline'), 'LudoOnline'),
    howToPlay: lazyNamed(() => import('./pages/LudoHowTo'), 'LudoHowTo'),
  },
  CosmeticPreview: lazyNamed(() => import('./components/LudoPreview'), 'LudoPreview'),
  hasSave: () => readStorage(SAVE_KEY) !== null,
};
