import { useState } from 'react';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { GOOGLE_CLIENT_ID } from '@/constants/apiBase';
import { t, useLang } from '@/i18n/t';
import { GoogleCancelled, googleMode, nativeGoogleIdToken } from '@/lib/googleSignIn';
import { googleLogin } from '@/store/authSlice';
import { useAppDispatch } from '@/store/store';

type Props = { onDone?: () => void };

/**
 * AUTH-5 / AUTH-9 / APP-6: Google sign-in. Sends the ID token to the server
 * (with the guest's token, so a guest is upgraded). Web: Google's button;
 * Android app: the native account picker. Hidden when VITE_GOOGLE_CLIENT_ID is not set.
 */
export function GoogleButton({ onDone }: Props) {
  useLang();
  if (GOOGLE_CLIENT_ID === '') return null;
  return googleMode() === 'native' ? <NativeGoogle onDone={onDone} /> : <WebGoogle onDone={onDone} />;
}

function useSendToken(onDone?: () => void) {
  const dispatch = useAppDispatch();
  return async (idToken: string) => {
    const res = await dispatch(googleLogin({ idToken }));
    if (googleLogin.fulfilled.match(res)) onDone?.();
  };
}

function NativeGoogle({ onDone }: Props) {
  const send = useSendToken(onDone);
  const [busy, setBusy] = useState(false);
  const signIn = async () => {
    setBusy(true);
    try {
      await send(await nativeGoogleIdToken(GOOGLE_CLIENT_ID));
    } catch (e) {
      if (!(e instanceof GoogleCancelled)) toast.error(t('auth.err.google'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex justify-center">
      <Button variant="outline" className="w-[280px] rounded-full" disabled={busy} onClick={() => void signIn()} data-testid="google-native">
        {t('auth.google')}
      </Button>
    </div>
  );
}

function WebGoogle({ onDone }: Props) {
  const lang = useLang();
  const send = useSendToken(onDone);
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID} locale={lang}>
      <div className="flex justify-center">
        <GoogleLogin
          theme="filled_black"
          shape="pill"
          width={280}
          onSuccess={async (r) => {
            if (!r.credential) {
              toast.error(t('auth.err.google'));
              return;
            }
            await send(r.credential);
          }}
          onError={() => { toast.error(t('auth.err.google')); }}
        />
      </div>
    </GoogleOAuthProvider>
  );
}
