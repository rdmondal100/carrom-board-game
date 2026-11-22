import { gamePath } from '../types';

/** HAPP-2 a Nodi Par page: `/g/nodipar/<sub>`. */
export const nodiPath = (sub: string): string => gamePath('nodipar', sub);
