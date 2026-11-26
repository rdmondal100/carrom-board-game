import type { View } from '@/store/settingsSlice';

/** T3D-1 below this much device memory (GB) 3D starts off; the player can still turn it on. */
const MIN_MEMORY_GB = 4;

let cached: boolean | null = null;

/** T3D-2 can this browser draw WebGL 2? Checked once; never throws. */
export function webglSupported(): boolean {
  if (cached !== null) return cached;
  try {
    // No WebGL 2 at all (old browsers, jsdom): don't even make a canvas.
    if (typeof WebGL2RenderingContext === 'undefined') return (cached = false);
    const ctx = document.createElement('canvas').getContext('webgl2');
    cached = ctx !== null;
    (ctx?.getExtension('WEBGL_lose_context') as { loseContext?: () => void } | null)?.loseContext?.();
  } catch {
    cached = false;
  }
  return cached;
}

/** T3D-1 the view a game uses: the player's choice, else 3D on capable devices; never 3D without WebGL. */
export function resolveView(chosen: View | undefined, supported: boolean, memoryGb: number | undefined): View {
  if (!supported) return '2d';
  if (chosen) return chosen;
  return (memoryGb ?? MIN_MEMORY_GB) >= MIN_MEMORY_GB ? '3d' : '2d';
}

/** `navigator.deviceMemory` (Chrome, Android); undefined elsewhere. */
export const deviceMemory = (): number | undefined =>
  typeof navigator === 'undefined' ? undefined : (navigator as { deviceMemory?: number }).deviceMemory;
