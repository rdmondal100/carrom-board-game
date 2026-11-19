import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import { saveSettings, settingsReducer } from './settingsSlice';

export function makeStore() {
  const s = configureStore({ reducer: { settings: settingsReducer } });
  // UI-2: every settings change is written back to localStorage.
  let last = s.getState().settings;
  s.subscribe(() => {
    const now = s.getState().settings;
    if (now !== last) {
      last = now;
      saveSettings(now);
    }
  });
  return s;
}

export const store = makeStore();

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
