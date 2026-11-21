import { Sailboat } from 'lucide-react';
import type { ClientGame } from '../types';

/** HAPP-1 registry stub: listed as "coming soon" until its spec builds it. */
export const nodipar: ClientGame = {
  id: 'nodipar',
  nameKey: 'games.nodipar.name',
  taglineKey: 'games.nodipar.tagline',
  Icon: Sailboat,
  playModes: { local: false, bot: false, online: false, ranked: false },
  routes: {},
};
