import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { AuthError, Field } from '@/components/AuthForm';
import { GoogleButton } from '@/components/GoogleButton';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { t, useLang } from '@/i18n/t';
import { loginSchema, type LoginForm } from '@/schemas/auth';
import { clearAuthError, guestLogin, loginUser } from '@/store/authSlice';
import { useAppDispatch, useAppSelector } from '@/store/store';

/** Where to go after signing in: `?next=/path` (same-site paths only), else the profile. */
export function nextPath(raw: string | null): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/profile';
}

/** AUTH-9: email + password, Google, or play at once as a guest. */
export function Login() {
  useLang();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = nextPath(params.get('next'));
  const { user, loading } = useAppSelector((s) => s.auth);
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  useEffect(() => { dispatch(clearAuthError()); }, [dispatch]);

  if (user && !user.isGuest) return <Navigate to={next} replace />;

  const onSubmit = async (v: LoginForm) => {
    const r = await dispatch(loginUser(v));
    if (loginUser.fulfilled.match(r)) navigate(next, { replace: true });
  };
  const onGuest = async () => {
    const r = await dispatch(guestLogin(undefined));
    if (guestLogin.fulfilled.match(r)) navigate(next, { replace: true });
  };

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4">
      <h2 className="text-xl font-bold">{t('auth.login.title')}</h2>
      <Card>
        <form className="flex flex-col gap-3" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Field label={t('auth.email')} type="email" autoComplete="email" error={errors.email} {...register('email')} />
          <Field label={t('auth.password')} type="password" autoComplete="current-password" error={errors.password} {...register('password')} />
          <AuthError actions={['login', 'guest', 'google']} />
          <Button type="submit" disabled={loading}>{t('auth.login.submit')}</Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">{t('auth.or')}</p>
        <GoogleButton onDone={() => navigate(next, { replace: true })} />
        {!user && (
          <Button variant="outline" onClick={onGuest} disabled={loading}>{t('auth.guest')}</Button>
        )}
      </Card>
      <p className="text-center text-sm">
        {t('auth.login.noAccount')}{' '}
        <Link to="/register" className="font-semibold text-primary underline-offset-4 hover:underline">{t('auth.register.link')}</Link>
      </p>
    </div>
  );
}
