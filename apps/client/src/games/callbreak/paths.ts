import { gamePath } from '../types';

/** HAPP-2 a Callbreak page: `/g/callbreak/<sub>`. */
export const cbPath = (sub: string): string => gamePath('callbreak', sub);

/** CB-3 points are kept in tenths: 41 → "4.1", -40 → "-4.0". */
export const formatPoints = (tenths: number): string => (tenths / 10).toFixed(1);
