import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import { onLobbyChange } from '@/lib/colyseus';
import { addaReducer } from './addaSlice';
import { authReducer } from './authSlice';
import { rankedReducer } from './rankedSlice';
import { lobbyChanged, roomReducer } from './roomSlice';
import { saveSettings, settingsReducer } from './settingsSlice';
import { shopReducer } from './shopSlice';
import { voiceReducer } from './voiceSlice';

export function makeStore() {
  const s = configureStore({
    reducer: {
      settings: settingsReducer, auth: authReducer, room: roomReducer, ranked: rankedReducer, shop: shopReducer, voice: voiceReducer, adda: addaReducer,
    },
  });
  // UI-2: every settings change is written back to localStorage.
  let last = s.getState().settings;
  s.subscribe(() => {
    const now = s.getState().settings;
    if (now !== last) {
      last = now;
      saveSettings(now);
    }
  });
  // ROOM-3: the synced lobby state follows the room.
  onLobbyChange((v) => s.dispatch(lobbyChanged(v)));
  return s;
}

export const store = makeStore();

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
