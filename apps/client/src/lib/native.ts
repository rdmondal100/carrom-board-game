import { App } from '@capacitor/app';
import { Capacitor, SystemBars } from '@capacitor/core';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { store } from '@/store/store';

/** True inside the Android (or any native) app, false in a browser. */
export const isNative = (): boolean => Capacitor.isNativePlatform();
export const isAndroid = (): boolean => isNative() && Capacitor.getPlatform() === 'android';

/** Web fallback buzz lengths when the browser has no haptics engine, ms. */
const WEB_BUZZ_MS = { strike: 15, pocket: 25 } as const;
const IMPACT = { strike: ImpactStyle.Medium, pocket: ImpactStyle.Light } as const;

export type HapticKind = keyof typeof WEB_BUZZ_MS;

/** Native calls can fail (old device, plugin missing in a dev build); feel effects are optional. */
const quiet = (p: Promise<unknown>): void => { void p.catch(() => {}); };

/**
 * APP-7: a short tap on the striker hit and on a pocket, only when the
 * haptics setting is on. Native: Capacitor Haptics. Web: navigator.vibrate.
 */
export function haptic(kind: HapticKind): void {
  if (!store.getState().settings.haptics) return;
  if (isNative()) {
    quiet(Haptics.impact({ style: IMPACT[kind] }));
    return;
  }
  try {
    navigator.vibrate?.(WEB_BUZZ_MS[kind]);
  } catch {
    // Some browsers throw without a user gesture; haptics are optional.
  }
}

/**
 * APP-2: during a match hide the system bars (immersive; a swipe shows them
 * for a moment) and keep the screen awake. Off again when the match screen closes.
 */
export function setMatchMode(on: boolean): void {
  if (!isNative()) return;
  if (on) {
    quiet(SystemBars.hide());
    quiet(KeepAwake.keepAwake());
  } else {
    quiet(SystemBars.show());
    quiet(KeepAwake.allowSleep());
  }
}

/** APP-3: listen to the hardware back button (native only); returns the unsubscribe function. */
export function onHardwareBack(cb: () => void): () => void {
  if (!isNative()) return () => {};
  const handle = App.addListener('backButton', cb);
  return () => { void handle.then((h) => h.remove()); };
}

export function exitApp(): void {
  if (isNative()) quiet(App.exitApp());
}
