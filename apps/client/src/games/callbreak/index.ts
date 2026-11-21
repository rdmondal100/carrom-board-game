import { Spade } from 'lucide-react';
import { readStorage } from '@/lib/storage';
import { lazyNamed } from '../lazy';
import type { ClientGame } from '../types';

/** Same key as save.ts (kept here so the hub doesn't load the game to check for a save). */
const SAVE_KEY = 'callbreak.localGame';

/**
 * CB-7 Callbreak in the hub: vs bots and online rooms. No same-device mode
 * (hands are secret) and no ranked yet (CB-8). Every page loads on first use.
 */
export const callbreak: ClientGame = {
  id: 'callbreak',
  nameKey: 'games.callbreak.name',
  taglineKey: 'games.callbreak.tagline',
  Icon: Spade,
  playModes: { local: false, bot: true, online: true, ranked: false },
  routes: {
    setup: lazyNamed(() => import('./pages/CbSetup'), 'CbSetup'),
    localGame: lazyNamed(() => import('./pages/CbLocal'), 'CbLocal'),
    online: lazyNamed(() => import('./pages/CbOnlineMenu'), 'CbOnlineMenu'),
    lobby: lazyNamed(() => import('./pages/CbLobby'), 'CbLobby'),
    onlineGame: lazyNamed(() => import('./pages/CbOnline'), 'CbOnline'),
    howToPlay: lazyNamed(() => import('./pages/CbHowTo'), 'CbHowTo'),
  },
  CosmeticPreview: lazyNamed(() => import('./components/CbPreview'), 'CbPreview'),
  hasSave: () => readStorage(SAVE_KEY) !== null,
};
