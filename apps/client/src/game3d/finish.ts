/**
 * T3D-8 how a cosmetic's surface looks in the 3D view (2D uses its colours).
 * Looks only: a finish never reaches the engine or the rules.
 */
export type Finish = 'matte' | 'satin' | 'gloss' | 'wood' | 'marble' | 'metal' | 'glass' | 'pearl' | 'glow';

/** Finishes that only show their best in 3D: the shop marks their items "3D". */
export const SHOWCASE_FINISHES: readonly Finish[] = ['marble', 'metal', 'glass', 'pearl', 'glow'];

export const isShowcase = (f: Finish | undefined): boolean => f !== undefined && SHOWCASE_FINISHES.includes(f);
