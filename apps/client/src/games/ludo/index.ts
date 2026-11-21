import { Dices } from 'lucide-react';
import type { ClientGame } from '../types';

/** HAPP-1 registry stub: listed as "coming soon" until its spec builds it. */
export const ludo: ClientGame = {
  id: 'ludo',
  nameKey: 'games.ludo.name',
  taglineKey: 'games.ludo.tagline',
  Icon: Dices,
  playModes: { local: false, bot: false, online: false, ranked: false },
  routes: {},
};
