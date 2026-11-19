import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { toast } from 'sonner';
import { GOOGLE_CLIENT_ID } from '@/constants/apiBase';
import { t, useLang } from '@/i18n/t';
import { googleLogin } from '@/store/authSlice';
import { useAppDispatch } from '@/store/store';

/**
 * AUTH-5 / AUTH-9: Google's web sign-in button. Sends the ID token to the
 * server (with the guest's token, so a guest is upgraded). Hidden when
 * VITE_GOOGLE_CLIENT_ID is not set. Android native sign-in is spec 11.
 */
export function GoogleButton({ onDone }: { onDone?: () => void }) {
  const lang = useLang();
  const dispatch = useAppDispatch();
  if (GOOGLE_CLIENT_ID === '') return null;
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
            const res = await dispatch(googleLogin({ idToken: r.credential }));
            if (googleLogin.fulfilled.match(res)) onDone?.();
          }}
          onError={() => { toast.error(t('auth.err.google')); }}
        />
      </div>
    </GoogleOAuthProvider>
  );
}
