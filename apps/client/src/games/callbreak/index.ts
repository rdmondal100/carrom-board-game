import { Spade } from 'lucide-react';
import type { ClientGame } from '../types';

/** HAPP-1 registry stub: listed as "coming soon" until its spec builds it. */
export const callbreak: ClientGame = {
  id: 'callbreak',
  nameKey: 'games.callbreak.name',
  taglineKey: 'games.callbreak.tagline',
  Icon: Spade,
  playModes: { local: false, bot: false, online: false, ranked: false },
  routes: {},
};
