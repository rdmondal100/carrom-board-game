import { gamePath } from '../types';

/** HAPP-2 a carrom page: `/g/carrom/<sub>`. */
export const carromPath = (sub: string): string => gamePath('carrom', sub);
