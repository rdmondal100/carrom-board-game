import { Sailboat } from 'lucide-react';
import { readStorage } from '@/lib/storage';
import { lazyNamed } from '../lazy';
import type { ClientGame } from '../types';

/** Same key as save.ts (kept here so the hub doesn't load the game to check for a save). */
const SAVE_KEY = 'nodipar.localGame';

/** NODI-5 Nodi Par in the hub: same device, vs bot and private rooms (ranked after playtesting). */
export const nodipar: ClientGame = {
  id: 'nodipar',
  nameKey: 'games.nodipar.name',
  taglineKey: 'games.nodipar.tagline',
  Icon: Sailboat,
  playModes: { local: true, bot: true, online: true, ranked: false },
  routes: {
    setup: lazyNamed(() => import('./pages/NodiSetup'), 'NodiSetup'),
    localGame: lazyNamed(() => import('./pages/NodiLocal'), 'NodiLocal'),
    online: lazyNamed(() => import('./pages/NodiOnlineMenu'), 'NodiOnlineMenu'),
    lobby: lazyNamed(() => import('./pages/NodiLobby'), 'NodiLobby'),
    onlineGame: lazyNamed(() => import('./pages/NodiOnline'), 'NodiOnline'),
    howToPlay: lazyNamed(() => import('./pages/NodiHowTo'), 'NodiHowTo'),
  },
  CosmeticPreview: lazyNamed(() => import('./components/NodiPreview'), 'NodiPreview'),
  hasSave: () => readStorage(SAVE_KEY) !== null,
};
