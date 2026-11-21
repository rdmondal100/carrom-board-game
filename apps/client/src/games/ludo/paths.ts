import { gamePath } from '../types';

/** HAPP-2 a Ludo page: `/g/ludo/<sub>`. */
export const ludoPath = (sub: string): string => gamePath('ludo', sub);
